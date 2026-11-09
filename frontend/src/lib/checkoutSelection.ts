
import type { BookingSelection } from "../components/BookingConfirmation";

const STORAGE_KEY = "velora.checkoutSelection";

export type CheckoutSelection = BookingSelection & {
  roomImage?: string;
};

export function saveCheckoutSelection(
  selection: CheckoutSelection
): void {
  sessionStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(selection)
  );
}

export function loadCheckoutSelection():
  CheckoutSelection | null {
  try {
    const saved = sessionStorage.getItem(STORAGE_KEY);

    if (!saved) {
      return null;
    }

    const data: unknown = JSON.parse(saved);

    if (!data || typeof data !== "object") {
      return null;
    }

    const selection = data as CheckoutSelection;

    if (
      typeof selection.branchId !== "string" ||
      !selection.branchId ||
      typeof selection.branchName !== "string" ||
      !selection.branchName ||
      typeof selection.roomTypeId !== "string" ||
      !selection.roomTypeId ||
      typeof selection.roomName !== "string" ||
      !selection.roomName ||
      typeof selection.checkIn !== "string" ||
      !/^\d{4}-\d{2}-\d{2}$/.test(selection.checkIn) ||
      typeof selection.checkOut !== "string" ||
      !/^\d{4}-\d{2}-\d{2}$/.test(selection.checkOut) ||
      !Number.isInteger(selection.guestCount) ||
      selection.guestCount < 1 ||
      !Number.isFinite(selection.nightlyPrice) ||
      selection.nightlyPrice < 0 ||
      typeof selection.currency !== "string" ||
      !/^[A-Z]{3}$/.test(selection.currency) ||
      !Number.isInteger(selection.nights) ||
      selection.nights < 1 ||
      (selection.roomImage !== undefined &&
        typeof selection.roomImage !== "string")
    ) {
      return null;
    }

    const start = Date.parse(
      `${selection.checkIn}T00:00:00Z`
    );

    const end = Date.parse(
      `${selection.checkOut}T00:00:00Z`
    );

    if (
      !Number.isFinite(start) ||
      !Number.isFinite(end) ||
      Math.round((end - start) / 86_400_000) !==
        selection.nights
    ) {
      return null;
    }

    return selection;
  } catch {
    return null;
  }
}

export function clearCheckoutSelection(): void {
  sessionStorage.removeItem(STORAGE_KEY);
}
