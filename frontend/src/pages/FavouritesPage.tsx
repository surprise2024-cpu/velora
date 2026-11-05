
import { Link } from "react-router-dom";
import { useFavourites } from "../context/useFavourites";
import FavouriteButton from "../components/FavouriteButton";
import styles from "./FavouritesPage.module.css";

export default function FavouritesPage() {
  const {
    favourites,
    loading,
    error,
    refreshFavourites,
  } = useFavourites();

  return (
    <section className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1>My Favourites</h1>
          <p>
            Your saved Velora destinations, all in one place.
          </p>
        </div>

        <span className={styles.count}>
          {favourites.length} saved
        </span>
      </header>

      {loading && (
        <p className={styles.message} role="status">
          Loading your favourite hotels...
        </p>
      )}

      {error && (
        <div className={styles.error} role="alert">
          <p>{error}</p>
          <button
            type="button"
            onClick={() => {
              void refreshFavourites().catch(() => undefined);
            }}
          >
            Try Again
          </button>
        </div>
      )}

      {!loading && !error && favourites.length === 0 && (
        <div className={styles.empty}>
          <span className={styles.emptyIcon}>♡</span>
          <h2>No favourites yet</h2>
          <p>
            Save hotels you love and they'll appear here.
          </p>
          <Link to="/" className={styles.exploreLink}>
            Explore Hotels
          </Link>
        </div>
      )}

      {!loading && !error && favourites.length > 0 && (
        <div className={styles.grid}>
          {favourites.map((favourite) => (
            <article
              key={favourite.id}
              className={styles.card}
            >
              <div className={styles.cardTop}>
                <div className={styles.hotelIcon}>
                  V
                </div>

                <FavouriteButton
                  branchId={favourite.branchId}
                />
              </div>

              <div className={styles.cardBody}>
                <div className={styles.location}>
                  {favourite.branch.city}
                </div>

                <h2>{favourite.branch.name}</h2>

                <p className={styles.address}>
                  {favourite.branch.address}
                </p>

                <p className={styles.rating}>
                  {"★".repeat(
                    Math.max(
                      0,
                      Math.min(
                        5,
                        Math.floor(
                          favourite.branch.starRating ?? 0
                        )
                      )
                    )
                  )}
                  <span>
                    {favourite.branch.starRating} star hotel
                  </span>
                </p>

                <Link
                  to={`/hotels/${favourite.branchId}`}
                  className={styles.viewLink}
                >
                  View Hotel
                </Link>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
