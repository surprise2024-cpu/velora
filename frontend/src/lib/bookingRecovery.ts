
import type { BookingSelection } from "../components/BookingConfirmation";

const STORAGE_KEY = "velora.guestBookingRecovery";

export type GuestBookingRecovery = {
  bookingId: string;
  guestToken: string;
  selection: BookingSelection;
};

export function saveGuestBookingRecovery(
  recovery: GuestBookingRecovery
): void {
  sessionStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(recovery)
  );
}

export function loadGuestBookingRecovery():
  GuestBookingRecovery | null {
  try {
    const saved = sessionStorage.getItem(STORAGE_KEY);
    if (!saved) return null;

    const data: unknown = JSON.parse(saved);

    if (
      !data ||
      typeof data !== "object" ||
      !("bookingId" in data) ||
      !("guestToken" in data) ||
      !("selection" in data)
    ) {
      return null;
    }

    const recovery = data as GuestBookingRecovery;

    if (
      !/^[0-9a-f-]{36}$/i.test(recovery.bookingId) ||
      !/^[0-9a-f]{64}$/.test(recovery.guestToken) ||
      !recovery.selection ||
      typeof recovery.selection.branchId !== "string" ||
      typeof recovery.selection.roomTypeId !== "string" ||
      typeof recovery.selection.checkIn !== "string" ||
      typeof recovery.selection.checkOut !== "string"
    ) {
      return null;
    }

    return recovery;
  } catch {
    return null;
  }
}

export function clearGuestBookingRecovery(): void {
  sessionStorage.removeItem(STORAGE_KEY);
}
