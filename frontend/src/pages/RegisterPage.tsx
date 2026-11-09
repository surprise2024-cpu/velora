
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

export default function RegisterPage() {
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
              JOIN THE VELORA EXPERIENCE
            </p>

            <h1>Make every stay memorable.</h1>

            <p className={styles.visualDescription}>
              Create your Velora account to discover beautiful
              destinations, save your favourite hotels, and
              manage your reservations with ease.
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

              <h2>Create your account.</h2>

              <p className={styles.description}>
                Your journey to memorable stays begins here.
                Join Velora Hotels in just a few clicks.
              </p>
            </div>

            <div className={styles.benefitsPanel}>
              <ShieldCheck
                size={22}
                aria-hidden="true"
              />

              <div>
                <h3>One account. Endless possibilities.</h3>

                <p>
                  Save favourite hotels, manage your bookings,
                  and enjoy a seamless reservation experience
                  across every Velora destination.
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
              Create account with Google
            </a>

            <p className={styles.securityNote}>
              <LockKeyhole
                size={14}
                aria-hidden="true"
              />
              Secure account creation with Google
            </p>

            <p
              style={{
                marginTop: "24px",
                textAlign: "center",
                fontSize: "14px",
              }}
            >
              Already have an account?{" "}
              <Link
                to="/login"
                style={{
                  color: "#b68b54",
                  fontWeight: 600,
                  textDecoration: "none",
                }}
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
