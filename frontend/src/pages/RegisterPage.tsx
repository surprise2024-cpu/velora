
import { useState, type FormEvent } from "react";
import {
  Link,
  Navigate,
  useNavigate,
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

export default function RegisterPage() {
  const { user, loading, refreshUser } = useAuth();
  const navigate = useNavigate();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] =
    useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleRegister(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (password.length < 12) {
      setError(
        "Password must contain at least 12 characters."
      );
      return;
    }

    if (!acceptedTerms) {
      setError(
        "Please accept the Terms and Privacy Policy."
      );
      return;
    }

    setSubmitting(true);

    let accountCreated = false;

    try {
      await apiRequest("/auth/register", {
        method: "POST",
        body: JSON.stringify({
          firstName,
          lastName,
          email,
          password,
          confirmPassword,
          acceptedTerms,
        }),
      });

      accountCreated = true;

      clearCsrfToken();

      await refreshUser();

      navigate("/", { replace: true });
    } catch (err) {
      if (accountCreated) {
        setError(
          "Your account was created, but we couldn't confirm " +
          "your login session. Please try signing in."
        );
      } else {
        setError(
          err instanceof ApiError
            ? err.message
            : "Unable to create your account. Please try again."
        );
      }
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
              JOIN THE VELORA EXPERIENCE
            </p>

            <h1>Make every stay memorable.</h1>

            <p className={styles.visualDescription}>
              Create your Velora account to discover
              beautiful destinations, save your favourite
              hotels, and manage your reservations
              with ease.
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

              <h2>Create your account.</h2>
            </div>

            <form
              onSubmit={handleRegister}
              className={styles.authForm}
            >
              <div className={styles.nameRow}>
                <label>
                  First name
                  <input
                    type="text"
                    autoComplete="given-name"
                    placeholder="Enter your first name"
                    value={firstName}
                    onChange={(event) =>
                      setFirstName(event.target.value)
                    }
                    maxLength={50}
                    required
                  />
                </label>

                <label>
                  Last name
                  <input
                    type="text"
                    autoComplete="family-name"
                    placeholder="Enter your last name"
                    value={lastName}
                    onChange={(event) =>
                      setLastName(event.target.value)
                    }
                    maxLength={50}
                    required
                  />
                </label>
              </div>

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
                    autoComplete="new-password"
                    placeholder="At least 12 characters"
                    value={password}
                    onChange={(event) =>
                      setPassword(event.target.value)
                    }
                    minLength={12}
                    maxLength={128}
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

              <label>
                Confirm password

                <div className={styles.passwordField}>
                  <input
                    type={
                      showConfirmPassword
                        ? "text"
                        : "password"
                    }
                    autoComplete="new-password"
                    placeholder="Confirm your password"
                    value={confirmPassword}
                    onChange={(event) =>
                      setConfirmPassword(event.target.value)
                    }
                    minLength={12}
                    maxLength={128}
                    required
                  />

                  <button
                    type="button"
                    className={styles.passwordToggle}
                    onClick={() =>
                      setShowConfirmPassword(
                        (previous) => !previous
                      )
                    }
                    aria-label={
                      showConfirmPassword
                        ? "Hide confirmation password"
                        : "Show confirmation password"
                    }
                    aria-pressed={showConfirmPassword}
                    title={
                      showConfirmPassword
                        ? "Hide confirmation password"
                        : "Show confirmation password"
                    }
                  >
                    {showConfirmPassword ? (
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

              <label className={styles.terms}>
                <input
                  type="checkbox"
                  checked={acceptedTerms}
                  onChange={(event) =>
                    setAcceptedTerms(event.target.checked)
                  }
                  required
                />

                <span>
                  I agree to the Terms and Privacy Policy.
                </span>
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
                  ? "Creating account..."
                  : "Create account"}
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

              Create account with Google
            </a>

            <p className={styles.securityNote}>
              <LockKeyhole
                size={14}
                aria-hidden="true"
              />
              Secure account creation
            </p>

            <p className={styles.authSwitch}>
              Already have an account?{" "}

              <Link
                to="/login"
                className={styles.authSwitchLink}
              >
                Sign in
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
