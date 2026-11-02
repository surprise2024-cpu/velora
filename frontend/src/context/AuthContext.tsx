
import {
  useEffect,
  useState,
  type ReactNode,
} from "react";

import {
  apiRequest,
  ApiError,
  clearCsrfToken,
} from "../lib/api";

import { 
    AuthContext, 
    type AuthUser 
} from "./authContext";

type AuthResponse = {
  success: boolean;
  user: AuthUser;
};

export function AuthProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  async function refreshUser() {
    try {
      const response = await apiRequest<AuthResponse>(
        "/auth/me"
      );

      setUser(response.user);
    } catch (error) {
      if (
        error instanceof ApiError &&
        error.status === 401
      ) {
        setUser(null);
        return;
      }

      throw error;
    }
  }

  useEffect(() => {
    let active = true;

    async function initializeAuth() {
      try {
        const response = await apiRequest<AuthResponse>(
          "/auth/me"
        );

        if (active) {
          setUser(response.user);
        }
      } catch (error) {
        if (active) {
          setUser(null);

          if (
            !(error instanceof ApiError &&
              error.status === 401)
          ) {
            console.error(
              "Unable to initialize authentication:",
              error
            );
          }
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void initializeAuth();

    return () => {
      active = false;
    };
  }, []);

  async function logout() {
    await apiRequest("/auth/logout", {
      method: "POST",
    });

    clearCsrfToken();
    setUser(null);
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        refreshUser,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

