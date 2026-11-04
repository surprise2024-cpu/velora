
import { Routes, Route } from "react-router-dom";
import HomePage from "./pages/HomePage";
import ProtectedRoute from "./components/ProtectedRoutes";
import LogoutButton from "./components/LogoutButton";
import HotelDetailsPage from "./pages/HotelDetailsPage";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ??
  "http://localhost:5000/api/v1";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />

      <Route
        path="/hotels/:branchId"
        element={<HotelDetailsPage />}
      />

      <Route
        path="/login"
        element={
          <main>
            <h1>Welcome to Velora Hotels</h1>
            <p>Sign in to manage your hotel bookings.</p>
            <a href={`${API_BASE_URL}/auth/google`}>
              Sign in with Google
            </a>
          </main>
        }
      />

      <Route element={<ProtectedRoute allowedRole="CUSTOMER" />}>
        <Route
          path="/account"
          element={
            <main>
              <h1>Velora Customer Account</h1>
              <LogoutButton />
            </main>
          }
        />
      </Route>

      <Route element={<ProtectedRoute allowedRole="ADMIN" />}>
        <Route
          path="/admin"
          element={
            <main>
              <h1>Velora Admin Dashboard</h1>
              <LogoutButton />
            </main>
          }
        />
      </Route>

      <Route path="*" element={<h1>404 — Page Not Found</h1>} />
    </Routes>
  );
}
