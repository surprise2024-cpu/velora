
import { useState, type FormEvent } from "react";
import {
  Link,
  Navigate,
  useNavigate,
  useLocation,
} from "react-router-dom";

import { useAuth } from "../context/useAuth";

import {
  apiRequest,
  ApiError,
  clearCsrfToken,
} from "../lib/api";

import styles from "./LoginPage.module.css";

import {
  ArrowLeft,
  Eye,
  EyeOff,
  LockKeyhole,
} from "lucide-react";

const API_BASE_URL = import.meta.env.PROD
  ? "/api/v1"
  : import.meta.env.VITE_API_BASE_URL ??
    "http://localhost:5000/api/v1";

export default function LoginPage() {
  const { user, loading, refreshUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const message =
    (location.state as { message?: string } | null)
      ?.message ?? "";

  async function handleLogin(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();
    setError("");
    setSubmitting(true);

    let authenticated = false;

    try {
      await apiRequest("/auth/login", {
        method: "POST",
        body: JSON.stringify({
          email,
          password,
        }),
      });

      authenticated = true;

      clearCsrfToken();

      await refreshUser();

      navigate("/", { replace: true });
    } catch (err) {
      setError(
        authenticated
          ? "Signed in, but we couldn't refresh your session. Please reload the page."
          : err instanceof ApiError
            ? err.message
            : "Unable to sign in. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <main
        className={styles.loading}
        role="status"
      >
        Checking your session...
      </main>
    );
  }

  if (user) {
    return (
      <Navigate
        to={user.role === "ADMIN" ? "/admin" : "/"}
        replace
      />
    );
  }

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <aside className={styles.visualPanel}>
          <div className={styles.visualContent}>
            <p className={styles.eyebrow}>
              WELCOME BACK
            </p>

            <h1>Your next stay starts here.</h1>

            <p className={styles.visualDescription}>
              Sign in to manage bookings, save favourite
              hotels, and explore new destinations.
            </p>
          </div>
        </aside>

        <section className={styles.formPanel}>
          <div className={styles.formContent}>
            <div className={styles.formIntro}>
              <div className={styles.introTop}>
                <Link
                  to="/"
                  className={styles.backLink}
                >
                  <ArrowLeft
                    size={17}
                    strokeWidth={2}
                    aria-hidden="true"
                  />
                  <span>Back to hotels</span>
                </Link>
              </div>

              <h2>Welcome back.</h2>

              <p className={styles.description}>
                Your next memorable stay is just a
                sign-in away.
              </p>
            </div>

            {message && (
              <p
                role="status"
                className={styles.authSuccess}
              >
                {message}
              </p>
            )}

            <form
              onSubmit={handleLogin}
              className={styles.authForm}
            >
              <label>
                Email address
                <input
                  type="email"
                  autoComplete="email"
                  placeholder="Enter your email address"
                  value={email}
                  onChange={(event) =>
                    setEmail(event.target.value)
                  }
                  maxLength={254}
                  required
                />
              </label>

              <label>
                Password

                <div className={styles.passwordField}>
                  <input
                    type={
                      showPassword ? "text" : "password"
                    }
                    autoComplete="current-password"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(event) =>
                      setPassword(event.target.value)
                    }
                    required
                  />

                  <button
                    type="button"
                    className={styles.passwordToggle}
                    onClick={() =>
                      setShowPassword(
                        (previous) => !previous
                      )
                    }
                    aria-label={
                      showPassword
                        ? "Hide password"
                        : "Show password"
                    }
                    aria-pressed={showPassword}
                    title={
                      showPassword
                        ? "Hide password"
                        : "Show password"
                    }
                  >
                    {showPassword ? (
                      <EyeOff
                        size={19}
                        aria-hidden="true"
                      />
                    ) : (
                      <Eye
                        size={19}
                        aria-hidden="true"
                      />
                    )}
                  </button>
                </div>
              </label>

              {error && (
                <p
                  role="alert"
                  className={styles.authError}
                >
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={submitting}
              >
                {submitting
                  ? "Signing in..."
                  : "Sign in"}
              </button>
            </form>

            <p className={styles.authDivider}>
              or continue with
            </p>

            <a
              href={`${API_BASE_URL}/auth/google`}
              className={styles.googleButton}
            >
              <span
                className={styles.googleIcon}
                aria-hidden="true"
              >
                G
              </span>

              Continue with Google
            </a>

            <p className={styles.securityNote}>
              <LockKeyhole
                size={14}
                aria-hidden="true"
              />
              Secure sign-in to Velora Hotels
            </p>

            <p className={styles.authSwitch}>
              Don't have an account?{" "}

              <Link
                to="/register"
                className={styles.authSwitchLink}
              >
                Create an account
              </Link>
            </p>
          </div>

          <p className={styles.footer}>
            © {new Date().getFullYear()} Velora Hotels.
            All rights reserved.
          </p>
        </section>
      </div>
    </main>
  );
}
