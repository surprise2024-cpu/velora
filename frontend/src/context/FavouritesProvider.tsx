
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { apiRequest } from "../lib/api";
import { useAuth } from "./useAuth";
import {
  FavouritesContext,
  type Favourite,
} from "./FavouritesContext";

type FavouritesResponse = {
  success: boolean;
  data: Favourite[];
};

type Props = {
  children: ReactNode;
};

type LoadState = {
  userId: string;
  favourites: Favourite[];
  error: string;
  finished: boolean;
};

export default function FavouritesProvider({
  children,
}: Props) {
  const { user, loading: authLoading } = useAuth();

  const customerId =
    user?.role === "CUSTOMER" ? user.id : null;

  const [loadState, setLoadState] = useState<LoadState | null>(
    null
  );
  const [pendingCount, setPendingCount] = useState(0);

  const refreshFavourites = useCallback(async () => {
    if (!customerId) return;

    setPendingCount((count) => count + 1);

    try {
      const response = await apiRequest<FavouritesResponse>(
        "/favourites"
      );

      if (!response.success || !Array.isArray(response.data)) {
        throw new Error("Invalid favourites response.");
      }

      setLoadState({
        userId: customerId,
        favourites: response.data,
        error: "",
        finished: true,
      });
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Unable to load favourites.";

      setLoadState((previous) => ({
        userId: customerId,
        favourites:
          previous?.userId === customerId
            ? previous.favourites
            : [],
        error: message,
        finished: true,
      }));

      throw err;
    } finally {
      setPendingCount((count) => count - 1);
    }
  }, [customerId]);


    useEffect(() => {
    if (!customerId) return;

    const activeCustomerId = customerId;
    
    let active = true;

    async function load() {
        try {
        const response = await apiRequest<FavouritesResponse>(
            "/favourites"
        );

        if (!active) return;

        if (!response.success || !Array.isArray(response.data)) {
            throw new Error("Invalid favourites response.");
        }

        setLoadState({
            userId: activeCustomerId,
            favourites: response.data,
            error: "",
            finished: true,
        });
        } catch (err) {
        if (!active) return;

        setLoadState({
            userId: activeCustomerId,
            favourites: [],
            error:
            err instanceof Error
                ? err.message
                : "Unable to load favourites.",
            finished: true,
        });
        }
    }

    void load();

    return () => {
        active = false;
    };
    }, [customerId]);


  const addFavourite = useCallback(
    async (branchId: string) => {
      if (!customerId) {
        throw new Error("Customer login required.");
      }

      setPendingCount((count) => count + 1);

      try {
        await apiRequest("/favourites", {
          method: "POST",
          body: JSON.stringify({ branchId }),
        });

        await refreshFavourites();
      } finally {
        setPendingCount((count) => count - 1);
      }
    },
    [customerId, refreshFavourites]
  );

  const removeFavourite = useCallback(
    async (branchId: string) => {
      if (!customerId) {
        throw new Error("Customer login required.");
      }

      setPendingCount((count) => count + 1);

      try {
        await apiRequest(`/favourites/${branchId}`, {
          method: "DELETE",
        });

        await refreshFavourites();
      } finally {
        setPendingCount((count) => count - 1);
      }
    },
    [customerId, refreshFavourites]
  );

  
    const currentState =
    loadState?.userId === customerId
        ? loadState
        : null;

    const favourites = useMemo(
    () => currentState?.favourites ?? [],
    [currentState]
    );

  const loading =
    authLoading ||
    (customerId !== null &&
      !currentState?.finished) ||
    pendingCount > 0;

  const value = useMemo(
    () => ({
      favourites,
      loading,
      error: currentState?.error ?? "",
      isFavourite: (branchId: string) =>
        favourites.some(
          (favourite) => favourite.branchId === branchId
        ),
      addFavourite,
      removeFavourite,
      refreshFavourites,
    }),
    [
      favourites,
      loading,
      currentState?.error,
      addFavourite,
      removeFavourite,
      refreshFavourites,
    ]
  );

  return (
    <FavouritesContext.Provider value={value}>
      {children}
    </FavouritesContext.Provider>
  );
}
