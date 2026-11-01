
import * as oidc from "openid-client";

const clientId = process.env.GOOGLE_CLIENT_ID;
const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
const callbackUrl = process.env.GOOGLE_CALLBACK_URL;

if (!clientId || !clientSecret || !callbackUrl) {
  throw new Error(
    "Google OAuth environment variables are missing"
  );
}

export const googleCallbackUrl = callbackUrl;

let googleConfigPromise:
  | Promise<oidc.Configuration>
  | undefined;

export function getGoogleConfig(): Promise<oidc.Configuration> {
  googleConfigPromise ??= oidc.discovery(
    new URL("https://accounts.google.com"),
    clientId!,
    clientSecret!
  ).catch((error: unknown) => {
    googleConfigPromise = undefined;
    throw error;
  });

  return googleConfigPromise;
}
