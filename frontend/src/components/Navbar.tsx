
import { Link } from "react-router-dom";
import { useAuth } from "../context/useAuth";
import styles from "./Navbar.module.css";

export default function Navbar() {
  const { user } = useAuth();

  const accountPath =
    user?.role === "ADMIN" ? "/admin" : "/account";

  return (
    <header className={styles.header}>
      <div className={styles.container}>
        <Link to="/" className={styles.logo}>
          VELORA<span>.</span>
        </Link>

        <nav className={styles.navigation} aria-label="Main navigation">
          <a href="/#hotels">Our Hotels</a>

          {user ? (
            <Link to={accountPath} className={styles.accountButton}>
              My Account
            </Link>
          ) : (
            <Link to="/login" className={styles.accountButton}>
              Sign In
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
