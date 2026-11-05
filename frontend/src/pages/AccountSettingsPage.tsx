
import { Link } from "react-router-dom";
import { useAuth } from "../context/useAuth";
import LogoutButton from "../components/LogoutButton";

export default function AccountSettingsPage() {
  const { user } = useAuth();

  if (!user) {
    return null;
  }

  return (
    <section
      aria-labelledby="account-settings-title"
      style={{
        display: "grid",
        gap: "1.5rem",
        maxWidth: "800px",
      }}
    >
      <header>
        <h2 id="account-settings-title">
          Account Settings
        </h2>
        <p>
          Manage your Velora account and session.
        </p>
      </header>

      <section
        style={{
          padding: "1.5rem",
          border: "1px solid #ddd",
          borderRadius: "12px",
        }}
      >
        <h3>Account Information</h3>

        <dl>
          <dt>Full Name</dt>
          <dd>{user.name?.trim() || "Not provided"}</dd>

          <dt>Email Address</dt>
          <dd>{user.email}</dd>

          <dt>Account Type</dt>
          <dd>
            {user.role === "CUSTOMER"
              ? "Customer"
              : "Administrator"}
          </dd>
        </dl>

        <Link to="/account">
          Edit Personal Information
        </Link>
      </section>

      <section
        style={{
          padding: "1.5rem",
          border: "1px solid #ddd",
          borderRadius: "12px",
        }}
      >
        <h3>Sign-in Method</h3>
        <p>
          Your Velora account uses Google authentication.
          Your email and Google password are managed
          through your Google account.
        </p>
      </section>

      <section
        style={{
          padding: "1.5rem",
          border: "1px solid #ddd",
          borderRadius: "12px",
        }}
      >
        <h3>Session Management</h3>
        <p>
          Sign out of Velora on this device.
        </p>

        <LogoutButton />
      </section>
    </section>
  );
}
