
const isProduction = process.env.NODE_ENV === "production";

function requireProductionUrl(
  name: string,
  options: { allowPath: boolean }
): URL {
  const value = process.env[name];

  if (!value?.trim()) {
    throw new Error(`${name} is required in production`);
  }

  let url: URL;

  try {
    url = new URL(value);
  } catch {
    throw new Error(`${name} must be a valid URL`);
  }

  if (url.protocol !== "https:") {
    throw new Error(`${name} must use HTTPS in production`);
  }

  if (
    url.hostname === "localhost" ||
    url.hostname === "127.0.0.1" ||
    url.hostname === "::1"
  ) {
    throw new Error(`${name} cannot use localhost in production`);
  }

  if (
    url.username ||
    url.password ||
    url.search ||
    url.hash
  ) {
    throw new Error(`${name} contains unsupported URL components`);
  }

  if (!options.allowPath && url.pathname !== "/") {
    throw new Error(`${name} must be an origin without a path`);
  }

  return url;
}

function validatePaystackEnvironment(): void {
  const secretKey = process.env.PAYSTACK_SECRET_KEY;

  if (!secretKey?.trim()) {
    throw new Error(
      "PAYSTACK_SECRET_KEY is required"
    );
  }

  if (!secretKey.startsWith("sk_test_")) {
    throw new Error(
      "Velora only supports Paystack Test Mode"
    );
  }

  const baseUrl =
    process.env.PAYSTACK_BASE_URL ??
    "https://api.paystack.co";

  if (baseUrl !== "https://api.paystack.co") {
    throw new Error(
      "PAYSTACK_BASE_URL must be https://api.paystack.co"
    );
  }
}

function validateCheckoutRecoveryEnvironment(): void {
  const secret = process.env.CHECKOUT_RECOVERY_SECRET;

  if (!secret || !/^[a-fA-F0-9]{64}$/.test(secret)) {
    throw new Error(
      "CHECKOUT_RECOVERY_SECRET must be a 64-character hexadecimal value"
    );
  }
}

export function validateEnvironment(): void {
  validatePaystackEnvironment();
  validateCheckoutRecoveryEnvironment();

  if (!isProduction) {
    return;
  }

  requireProductionUrl("FRONTEND_URL", {
    allowPath: false,
  });

  requireProductionUrl("GOOGLE_CALLBACK_URL", {
    allowPath: true,
  });
}
