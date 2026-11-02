
import { createContext } from "react";

export type AuthUser = {
  id: string;
  email: string;
  name: string | null;
  role: "CUSTOMER" | "ADMIN";
};

export type AuthContextValue = {
  user: AuthUser | null;
  loading: boolean;
  refreshUser: () => Promise<void>;
  logout: () => Promise<void>;
};

export const AuthContext = createContext<AuthContextValue | null>(
  null
);
