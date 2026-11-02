
const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ??
  "http://localhost:5000/api/v1";

type ApiOptions = Omit<RequestInit, "credentials">;

let csrfToken: string | null = null;


export class ApiError extends Error {
  public status: number;

  constructor(status: number, message: string) {
    super(message);

    this.name = "ApiError";
    this.status = status;
  }
}


async function getCsrfToken(): Promise<string> {
  if (csrfToken) {
    return csrfToken;
  }

  const response = await fetch(
    `${API_BASE_URL}/auth/csrf-token`,
    {
      method: "GET",
      credentials: "include",
    }
  );

  if (!response.ok) {
    throw new ApiError(
      response.status,
      "Unable to initialize CSRF protection"
    );
  }

  const data: { csrfToken: string } =
    await response.json();

  if (!data.csrfToken) {
    throw new Error("CSRF token missing from response");
  }

  csrfToken = data.csrfToken;
  return csrfToken;
}

export function clearCsrfToken(): void {
  csrfToken = null;
}

export async function apiRequest<T>(
  endpoint: string,
  options: ApiOptions = {}
): Promise<T> {
  const method = (options.method ?? "GET").toUpperCase();
  const headers = new Headers(options.headers);

  if (
    !["GET", "HEAD", "OPTIONS"].includes(method)
  ) {
    headers.set("x-csrf-token", await getCsrfToken());
  }

  if (
    options.body != null &&
    !headers.has("Content-Type") &&
    typeof options.body === "string"
  ) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(
    `${API_BASE_URL}${endpoint}`,
    {
      ...options,
      method,
      headers,
      credentials: "include",
    }
  );

  if (!response.ok) {
    let message = `Request failed (${response.status})`;

    try {
      const data = await response.json();
      if (typeof data.message === "string") {
        message = data.message;
      }
    } catch {
      // Keep the default error message.
    }

    throw new ApiError(response.status, message);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}
