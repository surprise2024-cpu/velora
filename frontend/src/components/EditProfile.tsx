
import { useState, type FormEvent } from "react";
import { useAuth } from "../context/useAuth";
import { apiRequest } from "../lib/api";
import styles from "./EditProfile.module.css";

type UpdateProfileResponse = {
  success: boolean;
  message: string;
};

export default function EditProfile() {
  const { user, refreshUser } = useAuth();

  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(user?.name ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  if (!user) {
    return null;
  }

  function startEditing() {
    setName(user?.name ?? "");
    setError("");
    setSuccess("");
    setEditing(true);
  }

  function cancelEditing() {
    setEditing(false);
    setError("");
    setSuccess("");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (saving) return;

    const trimmedName = name.trim();

    if (trimmedName.length < 2 || trimmedName.length > 100) {
      setError("Name must contain between 2 and 100 characters.");
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      await apiRequest<UpdateProfileResponse>("/auth/me", {
        method: "PATCH",
        body: JSON.stringify({
          name: trimmedName,
        }),
      });

      try {
        await refreshUser();
        setEditing(false);
        setSuccess("Your profile has been updated successfully.");
      } catch {
        setEditing(false);
        setError(
          "Your name was saved, but the latest profile could not be loaded. Please refresh the page."
        );
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to update your profile. Please try again."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className={styles.section}>
      <div className={styles.header}>
        <div>
          <h2>Personal Information</h2>
          <p>Manage your Velora account information.</p>
        </div>

        {!editing && (
          <button
            type="button"
            className={styles.editButton}
            onClick={startEditing}
          >
            Edit Profile
          </button>
        )}
      </div>

      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}

      {success && (
        <p className={styles.success} role="status">
          {success}
        </p>
      )}

      {editing ? (
        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.field}>
            <label htmlFor="profile-name">Full Name</label>
            <input
              id="profile-name"
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              minLength={2}
              maxLength={100}
              autoComplete="name"
              required
              disabled={saving}
            />
          </div>

          <div className={styles.field}>
            <label htmlFor="profile-email">Email Address</label>
            <input
              id="profile-email"
              type="email"
              value={user.email}
              readOnly
              aria-describedby="email-help"
            />
            <small id="email-help">
              Your email is managed through your Google account.
            </small>
          </div>

          <div className={styles.actions}>
            <button
              type="button"
              className={styles.cancelButton}
              onClick={cancelEditing}
              disabled={saving}
            >
              Cancel
            </button>

            <button
              type="submit"
              className={styles.saveButton}
              disabled={saving}
            >
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      ) : (
        <div className={styles.informationGrid}>
          <div className={styles.informationField}>
            <span>Full Name</span>
            <strong>{user.name?.trim() || "Not provided"}</strong>
          </div>

          <div className={styles.informationField}>
            <span>Email Address</span>
            <strong>{user.email}</strong>
          </div>

          <div className={styles.informationField}>
            <span>Account Type</span>
            <strong>
              {user.role === "CUSTOMER"
                ? "Customer"
                : "Administrator"}
            </strong>
          </div>

          <div className={styles.informationField}>
            <span>Account ID</span>
            <strong className={styles.accountId}>
              {user.id}
            </strong>
          </div>
        </div>
      )}
    </section>
  );
}
