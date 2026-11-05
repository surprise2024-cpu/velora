
import { createContext } from "react";

export type Favourite = {
  id: string;
  userId: string;
  branchId: string;
  createdAt: string;
  branch: {
    id: string;
    name: string;
    city: string;
    address: string;
    starRating: number;
  };
};

export type FavouritesContextValue = {
  favourites: Favourite[];
  loading: boolean;
  error: string;
  isFavourite: (branchId: string) => boolean;
  addFavourite: (branchId: string) => Promise<void>;
  removeFavourite: (branchId: string) => Promise<void>;
  refreshFavourites: () => Promise<void>;
};

export const FavouritesContext =
  createContext<FavouritesContextValue | undefined>(undefined);
