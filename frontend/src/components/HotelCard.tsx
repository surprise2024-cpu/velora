
import { Link } from "react-router-dom";
import styles from "./HotelCard.module.css";


export type HotelBranch = {
  id: string;
  name: string;
  description: string | null;
  address: string;
  city: string;
  province: string;
  country: string;
  starRating: number | null;
  amenities: string[];
  images: string[];
  policies: unknown[];
  isActive: boolean;
};


type HotelCardProps = {
  branch: HotelBranch;
};

export default function HotelCard({ branch }: HotelCardProps) {
  return (
    <article className={styles.card}>
      <div className={styles.imagePlaceholder}>
        <span className={styles.placeholderBrand}>
          VELORA HOTELS
        </span>
        <span className={styles.placeholderMessage}>
          Hotel photography coming soon
        </span>
      </div>

      <div className={styles.content}>
        <div className={styles.metadata}>
          <span className={styles.location}>
            {branch.city}, {branch.province}
          </span>

          {branch.starRating !== null && (
            <span
              className={styles.rating}
              aria-label={`${branch.starRating} star hotel`}
            >
              ★ {branch.starRating}
            </span>
          )}
        </div>

        <h3 className={styles.name}>{branch.name}</h3>

        <p className={styles.address}>{branch.address}</p>

        {branch.description && (
          <p className={styles.description}>
            {branch.description}
          </p>
        )}

        {branch.amenities.length > 0 && (
          <div className={styles.amenities}>
            {branch.amenities.slice(0, 3).map((amenity) => (
              <span key={amenity} className={styles.amenity}>
                {amenity}
              </span>
            ))}
          </div>
        )}

        <Link
          to={`/hotels/${branch.id}`}
          className={styles.detailsLink}
        >
          View Hotel Details →
        </Link>
      </div>
    </article>
  );
}
