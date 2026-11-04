
import { Link } from "react-router-dom";
import EditProfile from "../components/EditProfile";
import styles from "./ProfilePage.module.css";

export default function ProfilePage() {
  return (
    <div className={styles.mainContent}>
      <section className={styles.card}>
        <EditProfile />
      </section>

      <section className={styles.card}>
        <h2>My Velora Experience</h2>
        <p className={styles.cardDescription}>
          Manage your hotel reservations and saved
          accommodations from your account.
        </p>

        <div className={styles.quickLinks}>
          <div className={styles.quickLink}>
            <h3>My Bookings</h3>
            <p>
              View your reservations and payment history.
            </p>
            <Link to="/account/bookings">
              View Bookings
            </Link>
          </div>

          <div className={styles.quickLink}>
            <h3>My Favourites</h3>
            <p>
              View your saved Velora accommodations.
            </p>
            <Link to="/account/favourites">
              View Favourites
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
