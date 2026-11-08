import { Link } from "react-router-dom";
import FavouriteButton from "./FavouriteButton";
import styles from "./HotelCard.module.css";
import { ArrowRight } from "lucide-react";

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
  policies: string[];
  isActive: boolean;
};

type HotelCardProps = {
  branch: HotelBranch;
};

export default function HotelCard({ branch }: HotelCardProps) {
  const coverImage = branch.images?.[0];

  return (
    <article className={styles.card}>
      <div className={styles.imageContainer}>
        {coverImage ? (
          <img
            src={coverImage}
            alt={`${branch.name} hotel exterior or accommodation`}
            className={styles.hotelImage}
            loading="lazy"
          />
        ) : (
          <div className={styles.imagePlaceholder}>
            <span className={styles.placeholderBrand}>
              VELORA HOTELS
            </span>

            <span className={styles.placeholderMessage}>
              Hotel photography coming soon
            </span>
          </div>
        )}

        <div className={styles.favouriteControl}>
          <FavouriteButton branchId={branch.id} />
        </div>
      </div>

      <div className={styles.content}>
        <p className={styles.location}>
          {branch.city}, {branch.province}
        </p>

        <h3 className={styles.name}>
          {branch.name}
        </h3>

        <Link
          to={`/hotels/${branch.id}`}
          className={styles.detailsLink}
        >
          Explore branch
          <ArrowRight
            size={17}
            strokeWidth={2}
            aria-hidden="true"
          />
        </Link>
      </div>
    </article>
  );
}
