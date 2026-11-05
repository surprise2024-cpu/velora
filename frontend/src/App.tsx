
import { Routes, Route } from "react-router-dom";
import HomePage from "./pages/HomePage";
import ProtectedRoute from "./components/ProtectedRoutes";
import HotelDetailsPage from "./pages/HotelDetailsPage";
import PaymentReturnPage from "./pages/PaymentReturnPage";
import ProfilePage from "./pages/ProfilePage";

import AccountLayout from "./components/AccountLayout";
import MyBookingsPage from "./pages/MyBookingsPage";
import FavouritesPage from "./pages/FavouritesPage";
import AccountSettingsPage from "./pages/AccountSettingsPage";
import LoginPage from "./pages/LoginPage";
import AdminDashboardPage from "./pages/admin/AdminDashboardPage";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />

      <Route
        path="/hotels/:branchId"
        element={<HotelDetailsPage />}
      />

      
      <Route
        path="/payment/callback"
        element={<PaymentReturnPage />}
      />

      <Route
        path="/payment/return"
        element={<PaymentReturnPage />}
      />

      <Route path="/login" element={<LoginPage />} />
      
      <Route element={<ProtectedRoute allowedRole="CUSTOMER" />}>
        <Route path="/account" element={<AccountLayout />}>
          <Route index element={<ProfilePage />} />
          <Route path="bookings" element={<MyBookingsPage />} />
          <Route path="favourites" element={<FavouritesPage />} />
          <Route path="settings" element={<AccountSettingsPage />} />
        </Route>
      </Route>



      <Route element={<ProtectedRoute allowedRole="ADMIN" />}>
        <Route
          path="/admin"
          element={<AdminDashboardPage />}
        />
      </Route>

      <Route path="*" element={<h1>404 — Page Not Found</h1>} />
    </Routes>
  );
}
