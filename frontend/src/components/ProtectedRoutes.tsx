
import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../context/useAuth";
import type { AuthUser } from "../context/authContext";

type ProtectedRouteProps = {
  allowedRole: AuthUser["role"];
};

export default function ProtectedRoute({
  allowedRole,
}: ProtectedRouteProps) {
  const { user, loading } = useAuth();

  if (loading) {
    return <p>Checking authentication...</p>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (user.role !== allowedRole) {
    return (
      <Navigate
        to={user.role === "ADMIN" ? "/admin" : "/account"}
        replace
      />
    );
  }

  return <Outlet />;
}
