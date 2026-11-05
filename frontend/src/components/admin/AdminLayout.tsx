
import { useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../../context/useAuth";
import LogoutButton from "../LogoutButton";
import styles from "./AdminLayout.module.css";

const navigation = [
  {
    label: "Dashboard",
    path: "/admin",
    icon: "▦",
    end: true,
  },
  {
    label: "Branches",
    path: "/admin/branches",
    icon: "▥",
  },
  {
    label: "Room Types",
    path: "/admin/room-types",
    icon: "▤",
  },
  {
    label: "Rooms",
    path: "/admin/rooms",
    icon: "▣",
  },
  {
    label: "Bookings",
    path: "/admin/bookings",
    icon: "▦",
  },
  {
    label: "Payments",
    path: "/admin/payments",
    icon: "▭",
  },
];

export default function AdminLayout() {
  const [menuOpen, setMenuOpen] = useState(false);
  const { user } = useAuth();

  return (
    <div className={styles["admin-shell"]}>
      {/* ADMIN SIDEBAR */}
      <aside
        id="admin-sidebar"
        className={`${styles["admin-sidebar"]} ${
          menuOpen ? styles.open : ""
        }`}
        aria-label="Administrator navigation"
      >
        {/* BRANDING */}
        <div className={styles["admin-brand"]}>
          <strong>VELORA</strong>
          <span>ADMIN CONSOLE</span>
        </div>

        {/* NAVIGATION */}
        <nav
          className={styles["admin-navigation"]}
          aria-label="Admin sections"
        >
          {navigation.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.end}
              onClick={() => setMenuOpen(false)}
              className={({ isActive }) =>
                `${styles["admin-nav-link"]} ${
                  isActive ? styles.active : ""
                }`
              }
            >
              <span
                className={styles["admin-nav-icon"]}
                aria-hidden="true"
              >
                {item.icon}
              </span>

              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        {/* ADMIN PROFILE AND LOGOUT */}
        <div className={styles["admin-sidebar-footer"]}>
          <div className={styles["admin-user-card"]}>
            <strong>
              {user?.name?.trim() || "Admin User"}
            </strong>

            <span>Property Management</span>
          </div>

          <LogoutButton />
        </div>
      </aside>

      {/* MAIN ADMIN AREA */}
      <div className={styles["admin-main-area"]}>
        {/* TOP BAR */}
        <header className={styles["admin-topbar"]}>
          <button
            type="button"
            className={styles["admin-menu-toggle"]}
            onClick={() => setMenuOpen((open) => !open)}
            aria-expanded={menuOpen}
            aria-controls="admin-sidebar"
          >
            {menuOpen ? "Close menu" : "☰ Menu"}
          </button>

          <span>Velora Management Console</span>

          <span className={styles["admin-topbar-role"]}>
            Administrator
          </span>
        </header>

        {/* ACTIVE ADMIN PAGE */}
        <div className={styles["admin-content"]}>
          <Outlet />
        </div>
      </div>
    </div>
  );
}
