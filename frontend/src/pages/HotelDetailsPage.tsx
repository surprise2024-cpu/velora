
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { apiRequest } from "../lib/api";
import Navbar from "../components/Navbar";
import type { HotelBranch } from "../components/HotelCard";
import styles from "./HotelDetailsPage.module.css";
import RoomAvailability from "../components/RoomAvailability";
import FavouriteButton from "../components/FavouriteButton";

import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  MapPin,
  Star,
  Images,
  CalendarDays,
  Info,
} from "lucide-react";

type BranchResponse = {
  success: boolean;
  data: HotelBranch;
};

export default function HotelDetailsPage() {
  const { branchId } = useParams<{ branchId: string }>();

  const [branch, setBranch] = useState<HotelBranch | null>(null);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
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

      setLoading(true);
      setError(null);

      try {
        const result = await apiRequest<BranchResponse>(
          `/branches/${encodeURIComponent(branchId)}`
        );

        if (!result.success || !result.data) {
          throw new Error("Hotel details could not be loaded.");
        }

        if (active) {
          setBranch(result.data);
          setSelectedImageIndex(0);
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

  const galleryImages = branch?.images ?? [];

  const activeImage =
    galleryImages[selectedImageIndex] ?? galleryImages[0];

  return (
    <div className={styles.page}>
      <Navbar />

      <main className={styles.container}>
        <Link to="/" className={styles.backLink}>
          <ArrowLeft size={17} aria-hidden="true" />
          Back to Hotels
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
              <div className={styles.headingInfo}>
                <p className={styles.location}>
                  {branch.city}, {branch.province}, {branch.country}
                </p>

                <h1>{branch.name}</h1>

                <div className={styles.metadata}>
                  <span>
                    <MapPin size={15} aria-hidden="true" />
                    {branch.address}
                  </span>

                  {branch.starRating !== null && (
                    <span className={styles.rating}>
                      <Star
                        size={16}
                        fill="currentColor"
                        aria-hidden="true"
                      />
                      {branch.starRating} Star Hotel
                    </span>
                  )}
                </div>
              </div>

              <FavouriteButton branchId={branch.id} />
            </header>

            <div className={styles.showcaseGrid}>
              <div className={styles.showcaseGallery}>
                {galleryImages.length > 0 ? (
                  <section
                    className={styles.gallery}
                    aria-label={`${branch.name} photo gallery`}
                  >
                    <div className={styles.mainImageContainer}>
                      <img
                        src={activeImage}
                        alt={`${branch.name} photograph ${selectedImageIndex + 1}`}
                        className={styles.mainImage}
                      />

                      {galleryImages.length > 1 && (
                        <>
                          <button
                            type="button"
                            className={`${styles.galleryArrow} ${styles.previous}`}
                            onClick={() =>
                              setSelectedImageIndex(
                                (current) =>
                                  (current - 1 + galleryImages.length) %
                                  galleryImages.length
                              )
                            }
                            aria-label="Previous hotel photo"
                          >
                            <ChevronLeft
                              size={24}
                              aria-hidden="true"
                            />
                          </button>

                          <button
                            type="button"
                            className={`${styles.galleryArrow} ${styles.next}`}
                            onClick={() =>
                              setSelectedImageIndex(
                                (current) =>
                                  (current + 1) % galleryImages.length
                              )
                            }
                            aria-label="Next hotel photo"
                          >
                            <ChevronRight
                              size={24}
                              aria-hidden="true"
                            />
                          </button>
                        </>
                      )}

                      <span className={styles.imageCounter}>
                        <Images size={14} aria-hidden="true" />
                        {selectedImageIndex + 1} /{" "}
                        {galleryImages.length}
                      </span>
                    </div>

                    {galleryImages.length > 1 && (
                      <div className={styles.thumbnailGrid}>
                        {galleryImages
                          .slice(0, 3)
                          .map((image, index) => (
                            <button
                              key={`${image}-${index}`}
                              type="button"
                              className={`${styles.thumbnailButton} ${
                                selectedImageIndex === index
                                  ? styles.thumbnailActive
                                  : ""
                              }`}
                              onClick={() =>
                                setSelectedImageIndex(index)
                              }
                              aria-label={`View photograph ${index + 1}`}
                              aria-pressed={
                                selectedImageIndex === index
                              }
                            >
                              <img
                                src={image}
                                alt=""
                                className={styles.thumbnailImage}
                                loading="lazy"
                              />
                            </button>
                          ))}
                      </div>
                    )}
                  </section>
                ) : (
                  <div className={styles.galleryPlaceholder}>
                    <strong>VELORA HOTELS</strong>
                    <span>Hotel photography coming soon</span>
                  </div>
                )}

                <section
                  className={styles.amenitiesStrip}
                  aria-label="Hotel amenities preview"
                >
                  {branch.amenities.length > 0 ? (
                    branch.amenities
                      .slice(0, 6)
                      .map((amenity) => (
                        <span key={amenity}>
                          {amenity}
                        </span>
                      ))
                  ) : (
                    <span>Amenities coming soon</span>
                  )}
                </section>

                <div className={styles.contentGrid}>
                  <div className={styles.mainContent}>
                    <section className={styles.section}>
                      <h2>About this hotel</h2>

                      <p>
                        {branch.description ||
                          "No hotel description is currently available."}
                      </p>
                    </section>

                    <section className={styles.section}>
                      <h2>Facilities</h2>

                      {branch.amenities.length > 0 ? (
                        <ul className={styles.amenities}>
                          {branch.amenities.map((amenity) => (
                            <li key={amenity}>
                              {amenity}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p>
                          Amenities have not been listed yet.
                        </p>
                      )}
                    </section>

                    <section className={styles.section}>
                      <h2>Policies</h2>

                      {branch.policies.length > 0 ? (
                        <ul className={styles.amenities}>
                          {branch.policies.map(
                            (policy, index) => (
                              <li key={`${index}-${policy}`}>
                                {policy}
                              </li>
                            )
                          )}
                        </ul>
                      ) : (
                        <p>
                          Hotel policies have not been
                          published yet.
                        </p>
                      )}
                    </section>
                  </div>
                </div>
              </div>

              <aside className={styles.bookingPanel}>
                <div className={styles.bookingPanelHeading}>
                  <CalendarDays
                    size={20}
                    aria-hidden="true"
                  />

                  <div>
                    <h2>Plan your stay</h2>
                    <p>
                      Choose your dates and discover
                      available rooms.
                    </p>
                  </div>
                </div>

                <div id="velora-booking-search-form" />

                <div className={styles.bookingBenefits}>
                  <span>
                    <Info size={15} aria-hidden="true" />
                    Room availability and estimated pricing
                    are displayed after your search.
                  </span>
                </div>
              </aside>
            </div>

            <section
              id="availability"
              className={styles.availability}
            >
              <h2>Rooms & Availability</h2>

              <p>
                Select your dates and guest count above
                to check room availability and estimated pricing.
              </p>

              <RoomAvailability
                branchId={branch.id}
                branchName={branch.name}
                searchFormTargetId="velora-booking-search-form"
              />
            </section>
          </>
        )}
      </main>
    </div>
  );
}
