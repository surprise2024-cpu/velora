
import "express-session";

declare module "express-session" {
  interface SessionData {
    googleOAuth?: {
      codeVerifier: string;
      state: string;
      nonce: string;
    };

    userId?: string;
  }
}
