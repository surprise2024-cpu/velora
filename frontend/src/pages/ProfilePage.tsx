
import { Link } from "react-router-dom";
import Navbar from "../components/Navbar";
import LogoutButton from "../components/LogoutButton";
import { useAuth } from "../context/useAuth";
import styles from "./ProfilePage.module.css";
import EditProfile from "../components/EditProfile";

export default function ProfilePage() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className={styles.page}>
        <Navbar />
        <main className={styles.container}>
          <p role="status">Loading your profile...</p>
        </main>
      </div>
    );
  }

  if (!user) {
    return (
      <div className={styles.page}>
        <Navbar />
        <main className={styles.container}>
          <h1>Sign in required</h1>
          <Link to="/login">Sign In</Link>
        </main>
      </div>
    );
  }

  const displayName = user.name?.trim() || "Velora Guest";

  const initials = displayName
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");

  return (
    <div className={styles.page}>
      <Navbar />

      <main className={styles.container}>
        <div className={styles.breadcrumb}>
          <Link to="/">Home</Link>
          <span>/</span>
          <span>My Account</span>
        </div>

        <header className={styles.pageHeader}>
          <p className={styles.eyebrow}>YOUR VELORA ACCOUNT</p>
          <h1>My Profile</h1>
          <p>
            View your personal information and manage your
            Velora experience.
          </p>
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
              className={styles.accountNavigation}
              aria-label="Account navigation"
            >
              <Link
                to="/account"
                className={styles.activeLink}
                aria-current="page"
              >
                My Profile
              </Link>

              <span className={styles.disabledLink}>
                My Bookings — Coming Soon
              </span>

              <span className={styles.disabledLink}>
                My Favourites — Coming Soon
              </span>

              <span className={styles.disabledLink}>
                Account Settings — Coming Soon
              </span>
            </nav>

            <div className={styles.logoutArea}>
              <LogoutButton />
            </div>
          </aside>

          <div className={styles.mainContent}>
            <section className={styles.card}>
                <EditProfile />
            </section>

            <section className={styles.card}>
              <h2>My Velora Experience</h2>
              <p className={styles.cardDescription}>
                Your reservations and saved hotels will
                appear in your account as we complete
                the remaining features.
              </p>

              <div className={styles.quickLinks}>
                <div className={styles.quickLink}>
                  <h3>My Bookings</h3>
                  <p>
                    View your hotel reservations and
                    payment statuses.
                  </p>
                  <span>Coming Soon</span>
                </div>

                <div className={styles.quickLink}>
                  <h3>My Favourites</h3>
                  <p>
                    Keep track of the Velora hotels
                    you love.
                  </p>
                  <span>Coming Soon</span>
                </div>
              </div>
            </section>

            <section className={styles.card}>
              <h2>Explore More Hotels</h2>
              <p className={styles.cardDescription}>
                Discover another Velora destination
                for your next stay.
              </p>

              <Link to="/#hotels" className={styles.exploreButton}>
                Explore Our Hotels
              </Link>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}
