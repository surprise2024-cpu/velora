
import { Link, Navigate } from "react-router-dom";
import { useAuth } from "../context/useAuth";
import styles from "./LoginPage.module.css";

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
        <section className={styles.formPanel}>
          <Link to="/" className={styles.logo}>
            VELORA<span>.</span>
          </Link>

          <div className={styles.formContent}>
            <p className={styles.eyebrow}>
              WELCOME TO VELORA HOTELS
            </p>

            <h1>
              Your next stay
              <br />
              starts here.
            </h1>

            <p className={styles.description}>
              Explore our hotels, discover your ideal room,
              and enjoy a seamless booking experience.
            </p>

            <a
              href={`${API_BASE_URL}/auth/google`}
              className={styles.googleButton}
            >
              <span className={styles.googleIcon} aria-hidden="true">
                G
              </span>
              Continue with Google
            </a>

            <div className={styles.divider}>
              <span>or</span>
            </div>

            <Link to="/" className={styles.guestButton}>
              Explore Hotels as Guest
            </Link>

            <p className={styles.note}>
              No account is needed to browse hotels or
              check room availability.
            </p>
          </div>

          <p className={styles.footer}>
            © {new Date().getFullYear()} Velora Hotels.
            All rights reserved.
          </p>
        </section>

        <aside className={styles.visualPanel}>
          <div className={styles.visualContent}>
            <p>THE VELORA EXPERIENCE</p>
            <h2>
              Stay somewhere
              <br />
              extraordinary.
            </h2>
            <span>
              Comfort, thoughtful design, and unforgettable
              experiences await.
            </span>
          </div>
        </aside>
      </div>
    </main>
  );
}
