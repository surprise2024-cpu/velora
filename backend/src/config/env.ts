
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

export function validateEnvironment(): void {
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
