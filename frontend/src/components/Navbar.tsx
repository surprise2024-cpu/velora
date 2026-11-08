import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/useAuth";
import veloraLogo from "../assets/velora-logo.png";
import styles from "./Navbar.module.css";
import { Menu, X } from "lucide-react";

export default function Navbar() {
  const { user } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  const accountPath =
    user?.role === "ADMIN" ? "/admin" : "/account";

  function closeMenu() {
    setMenuOpen(false);
  }

  return (
    <header className={styles.header}>
      <div className={styles.container}>
        <Link
          to="/"
          className={styles.logo}
          aria-label="Velora Hotels home"
          onClick={closeMenu}
        >
          <img
            src={veloraLogo}
            alt="Velora Hotels"
            className={styles.logoImage}
          />
        </Link>

        <button
          type="button"
          className={styles.menuToggle}
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          aria-expanded={menuOpen}
          aria-controls="velora-main-navigation"
          onClick={() => setMenuOpen((open) => !open)}
        >
          {menuOpen ? (
            <X size={22} strokeWidth={2} aria-hidden="true" />
          ) : (
            <Menu size={22} strokeWidth={2} aria-hidden="true" />
          )}
        </button>

        <nav
          id="velora-main-navigation"
          className={`${styles.navigation} ${
            menuOpen ? styles.navigationOpen : ""
          }`}
          aria-label="Main navigation"
        >
          <Link
            to="/"
            className={styles.navLink}
            onClick={closeMenu}
          >
            Home
          </Link>

          <a
            href="/#hotels"
            className={styles.navLink}
            onClick={closeMenu}
          >
            Our Hotels
          </a>

          <Link
            to="/account/favourites"
            className={styles.navLink}
            onClick={closeMenu}
          >
            Favourites
          </Link>

          {user ? (
            <Link
              to={accountPath}
              className={styles.accountButton}
              onClick={closeMenu}
            >
              My Account
            </Link>
          ) : (
            <Link
              to="/login"
              className={styles.accountButton}
              onClick={closeMenu}
            >
              Sign In
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
