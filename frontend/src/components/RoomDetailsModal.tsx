
import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import styles from "./RoomDetailsModal.module.css";
import { ChevronLeft, ChevronRight } from "lucide-react";

export type RoomDetails = {
  roomTypeId: string;
  name: string;
  description: string | null;
  amenities: string[];
  maxGuests: number;
  basePrice: string;
  currency: string;
  availableRooms: number;
  images?: string[];
};

type Props = {
  room: RoomDetails;
  branchName: string;
  nights: number;
  canBook: boolean;
  onClose: () => void;
  onSelect: (room: RoomDetails) => void;
};

function formatPrice(value: number, currency: string) {
  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency,
  }).format(value);
}

export default function RoomDetailsModal({
  room,
  branchName,
  nights,
  canBook,
  onClose,
  onSelect,
}: Props) {
  const [imageIndex, setImageIndex] = useState(0);
  const [amenitiesExpanded, setAmenitiesExpanded] =
    useState(false);
  const [descriptionExpanded, setDescriptionExpanded] =
    useState(false);
  const [descriptionOverflow, setDescriptionOverflow] =
    useState(false);

  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const descriptionRef = useRef<HTMLParagraphElement>(null);

  const titleId = useId();
  const descriptionId = useId();
  const amenitiesId = useId();

  const images = room.images ?? [];
  const amenities = room.amenities ?? [];
  const description = room.description?.trim() ?? "";
  const price = Number(room.basePrice);
  const validPrice = Number.isFinite(price) && price >= 0;

  const visibleAmenities = amenitiesExpanded
    ? amenities
    : amenities.slice(0, 4);

  // Measure whether the collapsed description exceeds four lines.
  useLayoutEffect(() => {
    const element = descriptionRef.current;

    if (!element) return;

    const measure = () => {
      const computed = window.getComputedStyle(element);
      const lineHeight = parseFloat(computed.lineHeight);

      if (!Number.isFinite(lineHeight) || lineHeight <= 0) {
        return;
      }

      const previousClamp = element.style.webkitLineClamp;
      const previousDisplay = element.style.display;

      element.style.webkitLineClamp = "unset";
      element.style.display = "block";

      const fullHeight = element.scrollHeight;

      element.style.webkitLineClamp = previousClamp;
      element.style.display = previousDisplay;

      setDescriptionOverflow(fullHeight > lineHeight * 4 + 1);
    };

    measure();

    const observer = new ResizeObserver(measure);
    observer.observe(element);

    return () => observer.disconnect();
  }, [description]);

  // Focus the modal when it opens.
  useEffect(() => {
    const previouslyFocused = document.activeElement;

    closeButtonRef.current?.focus();

    return () => {
      if (previouslyFocused instanceof HTMLElement) {
        previouslyFocused.focus();
      }
    };
  }, []);

  // Trap keyboard focus inside the modal.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key !== "Tab") return;

      const focusable = Array.from(
        dialog!.querySelectorAll<HTMLElement>(
          'button:not(:disabled), [href], input:not(:disabled), [tabindex]:not([tabindex="-1"])'
        )
      );

      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (
        !event.shiftKey &&
        document.activeElement === last
      ) {
        event.preventDefault();
        first.focus();
      }
    }

    dialog.addEventListener("keydown", handleKeyDown);

    return () => {
      dialog.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  // Prevent the background page from scrolling.
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  function previousImage() {
    setImageIndex((current) =>
      (current - 1 + images.length) % images.length
    );
  }

  function nextImage() {
    setImageIndex((current) =>
      (current + 1) % images.length
    );
  }

  return (
    <div
      className={styles.overlay}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        ref={dialogRef}
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <header className={styles.header}>
          <div>
            <h2 id={titleId}>{room.name}</h2>
            <p>{branchName}</p>
          </div>

          <button
            ref={closeButtonRef}
            type="button"
            className={styles.closeButton}
            onClick={onClose}
            aria-label="Close room details"
          >
            ×
          </button>
        </header>

        <div className={styles.content}>
          <div className={styles.gallery}>
            {images.length > 0 ? (
              <>
                <img
                  src={images[imageIndex]}
                  alt={`${room.name} photo ${imageIndex + 1}`}
                  className={styles.roomImage}
                />

                {images.length > 1 && (
                  <>
                    <button
                      type="button"
                      className={`${styles.galleryArrow} ${styles.previous}`}
                      onClick={previousImage}
                      aria-label="Previous room photo"
                    >
                      <ChevronLeft size={24} strokeWidth={2.5} aria-hidden="true" />
                    </button>

                    <button
                      type="button"
                      className={`${styles.galleryArrow} ${styles.next}`}
                      onClick={nextImage}
                      aria-label="Next room photo"
                    >
                      <ChevronRight size={24} strokeWidth={2.5} aria-hidden="true" />
                    </button>

                    <span className={styles.imageCounter}>
                      {imageIndex + 1} / {images.length}
                    </span>
                  </>
                )}
              </>
            ) : (
              <div className={styles.imagePlaceholder}>
                <strong>VELORA HOTELS</strong>
                <span>Room photography coming soon</span>
              </div>
            )}
          </div>

          <div className={styles.details}>
            <section className={styles.section}>
              <h3>Description</h3>

              {description ? (
                <>
                  <p
                    ref={descriptionRef}
                    id={descriptionId}
                    className={
                      descriptionExpanded
                        ? styles.description
                        : `${styles.description} ${styles.clamped}`
                    }
                  >
                    {description}
                  </p>

                  {descriptionOverflow && (
                    <button
                      type="button"
                      className={styles.expandButton}
                      aria-expanded={descriptionExpanded}
                      aria-controls={descriptionId}
                      onClick={() =>
                        setDescriptionExpanded((value) => !value)
                      }
                    >
                      {descriptionExpanded
                        ? "Close description"
                        : "See more"}
                    </button>
                  )}
                </>
              ) : (
                <p className={styles.muted}>
                  No description available.
                </p>
              )}
            </section>

            <section className={styles.section}>
              <h3>Room amenities</h3>

              {amenities.length > 0 ? (
                <>
                  <ul
                    id={amenitiesId}
                    className={styles.amenitiesList}
                  >
                    {visibleAmenities.map((amenity) => (
                      <li key={amenity}>
                        <span aria-hidden="true">✓</span>
                        {amenity}
                      </li>
                    ))}
                  </ul>

                  {amenities.length > 4 && (
                    <button
                      type="button"
                      className={styles.expandButton}
                      aria-expanded={amenitiesExpanded}
                      aria-controls={amenitiesId}
                      onClick={() =>
                        setAmenitiesExpanded((value) => !value)
                      }
                    >
                      {amenitiesExpanded
                        ? "Close amenities"
                        : "See more"}
                    </button>
                  )}
                </>
              ) : (
                <p className={styles.muted}>
                  Amenities have not been listed yet.
                </p>
              )}
            </section>

            <section className={styles.section}>
              <h3>Room information</h3>
              <p>Maximum guests: {room.maxGuests}</p>
              <p>Available rooms: {room.availableRooms}</p>
            </section>
          </div>
        </div>

        <footer className={styles.footer}>
          <div className={styles.price}>
            {validPrice ? (
              <>
                <strong>
                  {formatPrice(price, room.currency)}
                </strong>
                <span>per night</span>
                <p>
                  Estimated stay:{" "}
                  {formatPrice(price * nights, room.currency)}
                </p>
              </>
            ) : (
              <p>Price unavailable</p>
            )}
          </div>

          <button
            type="button"
            className={styles.selectButton}
            disabled={!canBook}
            onClick={() => onSelect(room)}
          >
            {canBook ? "Select Room" : "Unavailable"}
          </button>
        </footer>
      </div>
    </div>
  );
}
