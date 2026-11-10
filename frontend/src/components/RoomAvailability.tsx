import { useEffect, useRef, useState } from "react";
import type { MouseEvent, FormEvent } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { apiRequest } from "../lib/api";
import styles from "./RoomAvailability.module.css";
import { saveCheckoutSelection } from "../lib/checkoutSelection";
import RoomDetailsModal from "./RoomDetailsModal";

type RoomAvailabilityItem = {
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

type AvailabilityResponse = {
  success: boolean;
  data: RoomAvailabilityItem[];
};

type Props = {
  branchId: string;
  branchName: string;
  searchFormTargetId?: string;
};

function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function addDays(dateString: string, days: number): string {
  const [year, month, day] = dateString.split("-").map(Number);
  const date = new Date(year, month - 1, day + days);

  return formatLocalDate(date);
}

function calculateNights(
  checkIn: string,
  checkOut: string
): number {
  const start = Date.parse(`${checkIn}T00:00:00Z`);
  const end = Date.parse(`${checkOut}T00:00:00Z`);

  return Math.round((end - start) / 86_400_000);
}

function formatPrice(value: number, currency: string): string {
  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency,
  }).format(value);
}

function openDatePicker(event: MouseEvent<HTMLInputElement>) {
  const input = event.currentTarget;

  if (typeof input.showPicker === "function") {
    try {
      input.showPicker();
    } catch {
      input.focus();
    }
  } else {
    input.focus();
  }
}

export default function RoomAvailability({
  branchId,
  branchName,
  searchFormTargetId,
}: Props) {
  const navigate = useNavigate();
  const today = formatLocalDate(new Date());

  const [checkIn, setCheckIn] = useState(today);
  const [checkOut, setCheckOut] = useState(
    addDays(today, 1)
  );
  const [guests, setGuests] = useState(2);

  const [rooms, setRooms] = useState<RoomAvailabilityItem[]>([]);

  const [detailsRoom, setDetailsRoom] =
    useState<RoomAvailabilityItem | null>(null);

  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const requestId = useRef(0);

  const [searchFormTarget, setSearchFormTarget] =
    useState<HTMLElement | null>(null);

  const nights = calculateNights(checkIn, checkOut);

  useEffect(() => {
    if (!searched || loading) {
      return;
    }

    document.getElementById("room-results")?.scrollIntoView({
      behavior: window.matchMedia(
        "(prefers-reduced-motion: reduce)"
      ).matches
        ? "auto"
        : "smooth",
      block: "start",
    });
  }, [searched, loading]);

  useEffect(() => {
    if (!searchFormTargetId) {
      return;
    }

    const target = document.getElementById(
      searchFormTargetId
    );

    if (target) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSearchFormTarget(target);
    }
  }, [searchFormTargetId]);

  useEffect(() => {
    requestId.current += 1;

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRooms([]);
    setSearched(false);
    setError(null);
    setLoading(false);
  }, [branchId]);

  async function searchAvailability(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    const currentRequest = ++requestId.current;

    setRooms([]);
    setSearched(false);
    setError(null);

    const currentToday = formatLocalDate(new Date());

    if (checkIn < currentToday) {
      setError("Check-in cannot be in the past.");
      return;
    }

    if (nights <= 0 || !Number.isFinite(nights)) {
      setError("Check-out must be after check-in.");
      return;
    }

    if (!Number.isInteger(guests) || guests < 1) {
      setError("Enter a valid number of guests.");
      return;
    }

    setLoading(true);

    try {
      const params = new URLSearchParams({
        checkIn,
        checkOut,
        guests: String(guests),
      });

      const response =
        await apiRequest<AvailabilityResponse>(
          `/branches/${encodeURIComponent(
            branchId
          )}/availability?${params}`
        );

      if (
        !response.success ||
        !Array.isArray(response.data)
      ) {
        throw new Error(
          "Invalid room availability response."
        );
      }

      if (currentRequest === requestId.current) {
        setRooms(response.data);
        setSearched(true);
      }
    } catch (err) {
      if (currentRequest === requestId.current) {
        setError(
          err instanceof Error
            ? err.message
            : "Unable to check room availability."
        );
      }
    } finally {
      if (currentRequest === requestId.current) {
        setLoading(false);
      }
    }
  }

  function updateSearch() {
    requestId.current += 1;
    setRooms([]);
    setSearched(false);
    setError(null);
    setLoading(false);
  }

  function selectRoom(room: RoomAvailabilityItem) {
    const price = Number(room.basePrice);

    if (
      room.availableRooms < 1 ||
      room.maxGuests < guests ||
      !Number.isFinite(price) ||
      price < 0 ||
      nights < 1
    ) {
      return;
    }

    saveCheckoutSelection({
      branchId,
      branchName,
      roomTypeId: room.roomTypeId,
      roomName: room.name,
      checkIn,
      checkOut,
      guestCount: guests,
      nightlyPrice: price,
      currency: room.currency,
      nights,
      roomImage: room.images?.[0],
    });

    navigate("/checkout");
  }

  const searchForm = (
    <form
      className={styles.searchForm}
      onSubmit={(event) =>
        void searchAvailability(event)
      }
    >
      <div className={styles.field}>
        <label htmlFor="velora-check-in">
          Check-in
        </label>

        <input
          id="velora-check-in"
          type="date"
          value={checkIn}
          min={today}
          required
          onClick={openDatePicker}
          onChange={(event) => {
            const value = event.target.value;

            setCheckIn(value);

            if (value && checkOut <= value) {
              setCheckOut(addDays(value, 1));
            }

            updateSearch();
          }}
        />
      </div>

      <div className={styles.field}>
        <label htmlFor="velora-check-out">
          Check-out
        </label>

        <input
          id="velora-check-out"
          type="date"
          value={checkOut}
          min={
            checkIn
              ? addDays(checkIn, 1)
              : today
          }
          required
          onClick={openDatePicker}
          onChange={(event) => {
            setCheckOut(event.target.value);
            updateSearch();
          }}
        />
      </div>

      <div className={styles.field}>
        <label htmlFor="velora-guests">
          Guests
        </label>

        <input
          id="velora-guests"
          type="number"
          min="1"
          step="1"
          value={guests}
          required
          onWheel={(event) => {
            event.currentTarget.blur();
          }}
          onChange={(event) => {
            const rawValue = event.target.value;
            const normalized = rawValue.replace(
              /^0+(?=\d)/,
              ""
            );

            setGuests(
              normalized === ""
                ? 0
                : Number(normalized)
            );

            updateSearch();
          }}
        />
      </div>

      <button
        className={styles.searchButton}
        type="submit"
        disabled={loading}
      >
        {loading
          ? "Checking..."
          : "Check Availability"}
      </button>
    </form>
  );

  return (
    <div className={styles.container}>
      {searchFormTarget && searchFormTargetId
        ? createPortal(
            searchForm,
            searchFormTarget
          )
        : searchForm}

      {error && (
        <p
          className={styles.error}
          role="alert"
        >
          {error}
        </p>
      )}

      {loading && (
        <p
          className={styles.message}
          role="status"
        >
          Searching available rooms...
        </p>
      )}

      {searched &&
        !loading && (
          <div
            id="room-results"
            className={styles.results}
          >
            <div className={styles.resultsHeading}>
              <h3>Room Availability</h3>

              <p>
                {nights}{" "}
                {nights === 1
                  ? "night"
                  : "nights"}{" "}
                · {guests}{" "}
                {guests === 1
                  ? "guest"
                  : "guests"}
              </p>
            </div>

            {rooms.length === 0 ? (
              <div
                className={styles.emptyState}
                role="status"
              >
                <h4>
                  No matching rooms found
                </h4>

                <p>
                  We couldn't find a room
                  matching your selected dates
                  and guest count.
                </p>

                <p>
                  Try adjusting your dates or
                  reducing the number of
                  guests.
                </p>
              </div>
            ) : (
              <div className={styles.roomList}>
                {rooms.map((room) => {
                  const price = Number(
                    room.basePrice
                  );

                  const validPrice =
                    Number.isFinite(price) &&
                    price >= 0;

                  const canBook =
                    room.availableRooms > 0 &&
                    room.maxGuests >= guests &&
                    validPrice;

                  return (
                    <article
                      key={room.roomTypeId}
                      className={styles.roomCard}
                    >
                      <div
                        className={
                          styles.roomImageContainer
                        }
                      >
                        {room.images?.[0] ? (
                          <img
                            src={room.images[0]}
                            alt={`${room.name} at ${branchName}`}
                            className={
                              styles.roomImage
                            }
                            loading="lazy"
                          />
                        ) : (
                          <div
                            className={
                              styles.roomImagePlaceholder
                            }
                          >
                            <strong>
                              VELORA HOTELS
                            </strong>

                            <span>
                              Room photography
                              coming soon
                            </span>
                          </div>
                        )}
                      </div>

                      <div
                        className={styles.roomInfo}
                      >
                        <div
                          className={
                            styles.roomTitleRow
                          }
                        >
                          <h4>{room.name}</h4>

                          <span
                            className={
                              canBook
                                ? styles.available
                                : styles.unavailable
                            }
                          >
                            {canBook
                              ? "Available"
                              : "Unavailable for this search"}
                          </span>
                        </div>

                        <button
                          type="button"
                          className={
                            styles.detailsButton
                          }
                          onClick={() =>
                            setDetailsRoom(room)
                          }
                        >
                          View Room Details
                        </button>

                        <p>
                          Maximum guests:{" "}
                          {room.maxGuests}
                        </p>

                        <p>
                          Available rooms:{" "}
                          {room.availableRooms}
                        </p>
                      </div>

                      <div
                        className={
                          styles.priceSection
                        }
                      >
                        {validPrice ? (
                          <>
                            <strong>
                              {formatPrice(
                                price,
                                room.currency
                              )}
                            </strong>

                            <span>
                              per night
                            </span>

                            <p>
                              Estimated stay:{" "}
                              {formatPrice(
                                price * nights,
                                room.currency
                              )}
                            </p>
                          </>
                        ) : (
                          <p>
                            Price unavailable
                          </p>
                        )}

                        <button
                          type="button"
                          className={
                            styles.selectButton
                          }
                          disabled={!canBook}
                          onClick={() =>
                            selectRoom(room)
                          }
                        >
                          {canBook
                            ? "Select Room"
                            : "Unavailable"}
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        )}

      {detailsRoom && (
        <RoomDetailsModal
          key={detailsRoom.roomTypeId}
          room={detailsRoom}
          branchName={branchName}
          nights={nights}
          canBook={
            detailsRoom.availableRooms > 0 &&
            detailsRoom.maxGuests >= guests &&
            Number.isFinite(
              Number(detailsRoom.basePrice)
            ) &&
            Number(detailsRoom.basePrice) >= 0 &&
            nights >= 1
          }
          onClose={() =>
            setDetailsRoom(null)
          }
          onSelect={(room) => {
            setDetailsRoom(null);
            selectRoom(room);
          }}
        />
      )}
    </div>
  );
}