
import { Link, Navigate } from "react-router-dom";
import { useAuth } from "../context/useAuth";
import styles from "./LoginPage.module.css";

import {
  ArrowLeft,
  LockKeyhole,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

const API_BASE_URL = import.meta.env.PROD
  ? "/api/v1"
  : import.meta.env.VITE_API_BASE_URL ??
    "http://localhost:5000/api/v1";

export default function LoginPage() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <main className={styles.loading} role="status">
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
              Sign in to manage bookings, save favourite hotels,
              and explore new destinations.
            </p>
          </div>
        </aside>

        <section className={styles.formPanel}>
          <div className={styles.formContent}>
            <div className={styles.formIntro}>
              <div className={styles.introTop}>
                <Link to="/" className={styles.backLink}>
                  <ArrowLeft
                    size={17}
                    strokeWidth={2}
                    aria-hidden="true"
                  />
                  <span>Back to hotels</span>
                </Link>

                <p className={styles.formEyebrow}>
                  <Sparkles
                    size={15}
                    aria-hidden="true"
                  />
                  YOUR VELORA EXPERIENCE
                </p>
              </div>

              <h2>Welcome back.</h2>

              <p className={styles.description}>
                Your next memorable stay is just a sign-in away.
              </p>
            </div>

            <div className={styles.benefitsPanel}>
              <ShieldCheck
                size={22}
                aria-hidden="true"
              />

              <div>
                <h3>One account. Every Velora stay.</h3>

                <p>
                  Manage reservations, save your favourite hotels,
                  and personalise your experience.
                </p>
              </div>
            </div>

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
              Secure sign-in with Google
            </p>

            <p
              style={{
                marginTop: "24px",
                textAlign: "center",
                fontSize: "14px",
              }}
            >
              Don't have an account?{" "}
              <Link
                to="/register"
                style={{
                  color: "#b68b54",
                  fontWeight: 600,
                  textDecoration: "none",
                }}
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
