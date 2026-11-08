
import { useState } from "react";
import { useAuth } from "../context/useAuth";
import { useFavourites } from "../context/useFavourites";
import styles from "./FavouriteButton.module.css";
import { Heart } from "lucide-react";

type Props = {
  branchId: string;
  onChange?: (isFavourite: boolean) => void;
};

export default function FavouriteButton({
  branchId,
  onChange,
}: Props) {
  const { user } = useAuth();
  const {
    isFavourite,
    addFavourite,
    removeFavourite,
    loading,
    error: loadError,
  } = useFavourites();

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  if (user?.role !== "CUSTOMER") return null;

  const saved = isFavourite(branchId);

  async function toggleFavourite() {
    if (loading || saving) return;

    setSaving(true);
    setError("");

    try {
      if (saved) {
        await removeFavourite(branchId);
      } else {
        await addFavourite(branchId);
      }

      onChange?.(!saved);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to update favourites."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={styles.wrapper}>
      <button
        type="button"
        className={`${styles.button} ${
          saved ? styles.active : ""
        }`}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          void toggleFavourite();
        }}
        disabled={loading || saving || Boolean(loadError)}
        aria-pressed={saved}
        aria-label={
          saved
            ? "Remove hotel from favourites"
            : "Add hotel to favourites"
        }
        title={
          saved
            ? "Remove from favourites"
            : "Add to favourites"
        }
      >
        <Heart
          size={24}
          strokeWidth={2}
          fill={saved ? "currentColor" : "none"}
          aria-hidden="true"
        />
      </button>

      {(error || loadError) && (
        <small className={styles.error} role="alert">
          {error || loadError}
        </small>
      )}
    </div>
  );
}
