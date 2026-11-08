
import { useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../../context/useAuth";
import LogoutButton from "../LogoutButton";
import styles from "./AdminLayout.module.css";

import {
  BedDouble,
  Building2,
  CalendarCheck,
  CreditCard,
  DoorOpen,
  LayoutDashboard,
  Menu,
  X,
} from "lucide-react";

const navigation = [
  {
    label: "Dashboard",
    path: "/admin",
    icon: LayoutDashboard,
    end: true,
  },
  {
    label: "Branches",
    path: "/admin/branches",
    icon: Building2,
  },
  {
    label: "Room Types",
    path: "/admin/room-types",
    icon: BedDouble,
  },
  {
    label: "Rooms",
    path: "/admin/rooms",
    icon: DoorOpen,
  },
  {
    label: "Bookings",
    path: "/admin/bookings",
    icon: CalendarCheck,
  },
  {
    label: "Payments",
    path: "/admin/payments",
    icon: CreditCard,
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
          {navigation.map((item) => {
            const Icon = item.icon;

            return (
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
                <Icon
                  className={styles["admin-nav-icon"]}
                  size={19}
                  strokeWidth={1.8}
                  aria-hidden="true"
                />

                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        {/* ADMIN PROFILE AND LOGOUT */}
        <div className={styles["admin-sidebar-footer"]}>
          <div className={styles["admin-user-card"]}>
            <strong>
              {user?.name?.trim() || "Admin User"}
            </strong>

            <span>Property Management</span>
          </div>

          <LogoutButton variant="admin" />
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
            {menuOpen ? (
              <>
                <X size={18} strokeWidth={2} aria-hidden="true" />
                Close menu
              </>
            ) : (
              <>
                <Menu size={18} strokeWidth={2} aria-hidden="true" />
                Menu
              </>
            )}
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
