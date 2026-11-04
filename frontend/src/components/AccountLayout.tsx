
import { NavLink, Outlet } from "react-router-dom";
import Navbar from "./Navbar";
import LogoutButton from "./LogoutButton";
import { useAuth } from "../context/useAuth";
import styles from "./AccountLayout.module.css";

const accountLinks = [
  { to: "/account", label: "My Profile", end: true },
  { to: "/account/bookings", label: "My Bookings", end: false },
  { to: "/account/favourites", label: "My Favourites", end: false },
  { to: "/account/settings", label: "Account Settings", end: false },
];

export default function AccountLayout() {
  const { user } = useAuth();

  if (!user) return null;

  const displayName = user.name?.trim() || "Velora Guest";

  const initials = displayName
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");

  return (
    <div className={styles.page}>
      <Navbar />

      <div className={styles.container}>
        <header className={styles.heading}>
          <p>YOUR VELORA ACCOUNT</p>
          <h1>My Account</h1>
        </header>

        <div className={styles.layout}>
          <aside className={styles.sidebar}>
            <div className={styles.profileSummary}>
              <div className={styles.avatar} aria-hidden="true">
                {initials}
              </div>

              <h2>{displayName}</h2>
              <p>{user.email}</p>
            </div>

            <nav
              className={styles.navigation}
              aria-label="Customer account navigation"
            >
              {accountLinks.map((link) => (
                <NavLink
                  key={link.to}
                  to={link.to}
                  end={link.end}
                  className={({ isActive }) =>
                    isActive ? styles.activeLink : styles.link
                  }
                >
                  {link.label}
                </NavLink>
              ))}
            </nav>

            <div className={styles.logoutArea}>
              <LogoutButton />
            </div>
          </aside>

          <main className={styles.content}>
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}
