import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { LogOut } from "lucide-react";
import { useAuth } from "../context/useAuth";
import styles from "./LogoutButton.module.css";

type LogoutButtonProps = {
  variant?: "customer" | "admin";
};

export default function LogoutButton({
  variant = "customer",
}: LogoutButtonProps) {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLogout() {
    if (loading) return;

    setLoading(true);
    setError(null);

    try {
      await logout();
      navigate("/login", { replace: true });
    } catch {
      setError("Unable to log out. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.container}>
      <button
        type="button"
        className={`${styles.button} ${
          variant === "admin" ? styles.admin : styles.customer
        }`}
        onClick={handleLogout}
        disabled={loading}
      >
        <LogOut size={18} strokeWidth={2} aria-hidden="true" />
        <span>{loading ? "Signing out..." : "Sign Out"}</span>
      </button>

      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
