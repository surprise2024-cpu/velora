
import { Router } from "express";
import * as oidc from "openid-client";
import {
  getGoogleConfig,
  googleCallbackUrl,
} from "../config/googleAuth.js";
import { prisma } from "../lib/prisma.js";
import { Prisma } from "../generated/prisma/client.js";
import { generateToken } from "../config/csrf.js";
import { z } from "zod";

const router = Router();


const updateProfileSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, "Name must contain at least 2 characters")
      .max(100, "Name cannot exceed 100 characters"),
  })
  .strict();


router.get("/google", async (req, res) => {
  try {
    const config = await getGoogleConfig();

    const codeVerifier = oidc.randomPKCECodeVerifier();
    const codeChallenge =
      await oidc.calculatePKCECodeChallenge(codeVerifier);

    const state = oidc.randomState();
    const nonce = oidc.randomNonce();

    req.session.googleOAuth = {
      codeVerifier,
      state,
      nonce,
    };

    const authorizationUrl = oidc.buildAuthorizationUrl(config, {
      redirect_uri: googleCallbackUrl,
      scope: "openid email profile",
      code_challenge: codeChallenge,
      code_challenge_method: "S256",
      state,
      nonce,
    });

    req.session.save((error) => {
      if (error) {
        console.error("Failed to save OAuth session:", error);

        return res.status(500).json({
          success: false,
          message: "Unable to start Google authentication",
        });
      }

      return res.redirect(authorizationUrl.href);
    });
  } catch (error) {
    console.error("Google OAuth initialization failed:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to start Google authentication",
    });
  }
});


router.get("/google/callback", async (req, res) => {

    if (typeof req.query.error === "string") {
        delete req.session.googleOAuth;

        return res.status(400).json({
            success: false,
            message: "Google authentication was cancelled or denied",
        });
    }

  const pending = req.session.googleOAuth;

  if (!pending) {
    return res.status(400).json({
      success: false,
      message: "Google login session is missing or expired",
    });
  }

  // Prevent the same OAuth session from being reused.
  delete req.session.googleOAuth;

  try {
    const config = await getGoogleConfig();

    const currentUrl = new URL(
      req.originalUrl,
      googleCallbackUrl
    );

    const tokens = await oidc.authorizationCodeGrant(
      config,
      currentUrl,
      {
        pkceCodeVerifier: pending.codeVerifier,
        expectedState: pending.state,
        expectedNonce: pending.nonce,
        idTokenExpected: true,
      }
    );

    const claims = tokens.claims();

    if (
      !claims?.sub ||
      typeof claims.email !== "string" ||
      claims.email_verified !== true
    ) {
      return res.status(401).json({
        success: false,
        message: "Google did not provide a verified identity",
      });
    }

    const googleId = claims.sub;
    const email = claims.email;
    const name =
      typeof claims.name === "string"
        ? claims.name
        : null;

    let user = await prisma.user.findUnique({
      where: {
        provider_providerId: {
          provider: "google",
          providerId: googleId,
        },
      },
    });

    if (!user) {
      const existingEmail = await prisma.user.findUnique({
        where: { email },
      });

      if (existingEmail) {
        return res.status(409).json({
          success: false,
          message: "An account already exists with this email",
        });
      }

      try {
        user = await prisma.user.create({
          data: {
            email,
            name,
            provider: "google",
            providerId: googleId,
            role: "CUSTOMER",
          },
        });
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2002"
        ) {
          user = await prisma.user.findUnique({
            where: {
              provider_providerId: {
                provider: "google",
                providerId: googleId,
              },
            },
          });

          if (!user) {
            return res.status(409).json({
              success: false,
              message: "Account identity conflict",
            });
          }
        } else {
          throw error;
        }
      }
    }

    const userId = user.id;

    req.session.regenerate((error) => {
      if (error) {
        console.error("Session regeneration failed:", error);

        return res.status(500).json({
          success: false,
          message: "Unable to complete authentication",
        });
      }

      req.session.userId = userId;

      req.session.save((saveError) => {
        if (saveError) {
          console.error("Session save failed:", saveError);

          return res.status(500).json({
            success: false,
            message: "Unable to save authenticated session",
          });
        }

        const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";

        const destination = user.role === "ADMIN" ? "/admin" : "/account";

        return res.redirect(
          303,
          `${frontendUrl}${destination}`
        )

      });

    });
    
  } catch (error) {
    console.error("Google OAuth callback failed:", error);

    return res.status(401).json({
      success: false,
      message: "Google authentication failed",
    });
  }
});


router.get("/me", async (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({
      success: false,
      message: "Not authenticated",
    });
  }

  try {
    const user = await prisma.user.findUnique({
      where: {
        id: req.session.userId,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
      },
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User account not found",
      });
    }

    return res.status(200).json({
      success: true,
      user,
    });
  } catch (error) {
    console.error("Failed to retrieve authenticated user:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to retrieve user information",
    });
  }
});


router.patch("/me", async (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({
      success: false,
      message: "Not authenticated",
    });
  }

  const validation = updateProfileSchema.safeParse(req.body);

  if (!validation.success) {
    return res.status(400).json({
      success: false,
      message: "Invalid profile information",
      errors: validation.error.flatten(),
    });
  }

  try {
    const user = await prisma.user.update({
      where: {
        id: req.session.userId,
      },
      data: {
        name: validation.data.name,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
      },
    });

    return res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      user,
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      return res.status(401).json({
        success: false,
        message: "User account not found",
      });
    }

    console.error("Failed to update profile:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to update profile",
    });
  }
});



router.post("/logout", (req, res) => {
  req.session.destroy((error) => {
    if (error) {
      console.error("Logout failed:", error);

      return res.status(500).json({
        success: false,
        message: "Unable to log out",
      });
    }

    
    const isProduction = process.env.NODE_ENV === "production";

    res.clearCookie("velora.sid", {
      path: "/",
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? "none" : "lax",
    });


    return res.status(200).json({
      success: true,
      message: "Logged out successfully",
    });
  });
});

router.get("/csrf-token", (req, res) => {
  const csrfToken = generateToken(req);

  req.session.save((error) => {
    if (error) {
      console.error("Failed to save CSRF session:", error);

      return res.status(500).json({
        success: false,
        message: "Unable to initialize CSRF protection",
      });
    }

    return res.status(200).json({
      success: true,
      csrfToken,
    });
  });
});

export default router;
