
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { apiRequest } from "../lib/api";
import Navbar from "../components/Navbar";
import type { HotelBranch } from "../components/HotelCard";
import styles from "./HotelDetailsPage.module.css";
import RoomAvailability from "../components/RoomAvailability";

type BranchResponse = {
  success: boolean;
  data: HotelBranch;
};

export default function HotelDetailsPage() {
  const { branchId } = useParams<{ branchId: string }>();

  const [branch, setBranch] = useState<HotelBranch | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadBranch() {
      if (!branchId) {
        setError("Hotel ID is missing.");
        setLoading(false);
        return;
      }

      try {
        const result = await apiRequest<BranchResponse>(
          `/branches/${encodeURIComponent(branchId)}`
        );

        if (!result.success || !result.data) {
          throw new Error("Hotel details could not be loaded.");
        }

        if (active) {
          setBranch(result.data);
        }
      } catch (err) {
        if (active) {
          setError(
            err instanceof Error
              ? err.message
              : "Unable to load hotel details."
          );
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadBranch();

    return () => {
      active = false;
    };
  }, [branchId]);

  return (
    <div className={styles.page}>
      <Navbar />

      <main className={styles.container}>
        <Link to="/" className={styles.backLink}>
          ← Back to Hotels
        </Link>

        {loading && (
          <p role="status">Loading hotel details...</p>
        )}

        {error && (
          <p role="alert" className={styles.error}>
            {error}
          </p>
        )}

        {!loading && !error && branch && (
          <>
            <header className={styles.heading}>
              <p className={styles.location}>
                {branch.city}, {branch.province},{" "}
                {branch.country}
              </p>

              <h1>{branch.name}</h1>

              <div className={styles.metadata}>
                <span>{branch.address}</span>

                {branch.starRating !== null && (
                  <span className={styles.rating}>
                    ★ {branch.starRating} Star Hotel
                  </span>
                )}
              </div>
            </header>

            <div className={styles.galleryPlaceholder}>
              <strong>VELORA HOTELS</strong>
              <span>Hotel photography coming soon</span>
            </div>

            <div className={styles.contentGrid}>
              <div className={styles.mainContent}>
                <section className={styles.section}>
                  <h2>About This Hotel</h2>
                  <p>
                    {branch.description ||
                      "No hotel description is currently available."}
                  </p>
                </section>

                <section className={styles.section}>
                  <h2>Hotel Amenities</h2>

                  {branch.amenities.length > 0 ? (
                    <ul className={styles.amenities}>
                      {branch.amenities.map((amenity) => (
                        <li key={amenity}>{amenity}</li>
                      ))}
                    </ul>
                  ) : (
                    <p>
                      Amenities have not been listed for
                      this hotel yet.
                    </p>
                  )}
                </section>

                <section className={styles.section}>
                  <h2>Hotel Policies</h2>
                  <p>
                    {branch.policies.length === 0
                      ? "Hotel policies have not been published yet."
                      : "Hotel policies are available."}
                  </p>
                </section>
              </div>

              <aside className={styles.bookingPanel}>
                <h2>Plan Your Stay</h2>

                <p>
                  Choose your dates to explore available
                  rooms and rates.
                </p>
                <a
                  href="#availability"
                  className={styles.bookingButton}
                >
                  Check Availability
                </a>
              </aside>
            </div>

            
            <section
            id="availability"
            className={styles.availability}
            >
            <h2>Rooms & Availability</h2>

            <p>
                Select your dates and guest count to check
                room availability and estimated pricing.
            </p>

            <RoomAvailability branchId={branch.id} />
            </section>

          </>
        )}
      </main>
    </div>
  );
}
