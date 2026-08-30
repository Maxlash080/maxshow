import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ToastProvider } from './context/ToastContext';
import { ModalProvider } from './context/ModalContext';
import { AuthProvider } from './context/AuthContext';

import { HomePage } from './pages/HomePage';
import { UserSignInPage } from './pages/UserSignInPage';
import { ForgotPasswordPage } from './pages/ForgotPasswordPage';
import { RegistrationPage } from './pages/RegistrationPage';
import { AdminSignInPage } from './pages/AdminSignInPage';
import { AdminDashboard } from './pages/AdminDashboard';
import { UserDashboard } from './pages/UserDashboard';
import { EventDetailsPage } from './pages/EventDetailsPage';
import { BookingPage } from './pages/BookingPage';
import { AllEventsPage } from './pages/AllEventsPage';
import { SettingsPage } from './pages/SettingsPage';
import { AboutPage } from './pages/AboutPage';

export const App = () => {
  return (
    <BrowserRouter>
      <ToastProvider>
        <ModalProvider>
          <AuthProvider>
            <Routes>
              {/* Home Routes */}
              <Route path="/" element={<HomePage />} />
              <Route path="/index.html" element={<HomePage />} />

              {/* Authentication Routes */}
              <Route path="/user" element={<UserSignInPage />} />
              <Route path="/user.html" element={<UserSignInPage />} />
              <Route path="/login" element={<UserSignInPage />} />

              <Route path="/forgot-password" element={<ForgotPasswordPage />} />
              <Route path="/forgot-password.html" element={<ForgotPasswordPage />} />

              <Route path="/registration" element={<RegistrationPage />} />
              <Route path="/registration.html" element={<RegistrationPage />} />
              <Route path="/register" element={<RegistrationPage />} />

              {/* Admin Routes */}
              <Route path="/admin" element={<AdminSignInPage />} />
              <Route path="/admin.html" element={<AdminSignInPage />} />
              <Route path="/admin-dashboard" element={<AdminDashboard />} />
              <Route path="/admin-dashboard.html" element={<AdminDashboard />} />

              {/* User Dashboard */}
              <Route path="/dashboard" element={<UserDashboard />} />
              <Route path="/dashboard.html" element={<UserDashboard />} />

              {/* Event Details */}
              <Route path="/event/:slug" element={<EventDetailsPage />} />
              <Route path="/event" element={<EventDetailsPage />} />
              <Route path="/event.html" element={<EventDetailsPage />} />

              {/* Booking */}
              <Route path="/booking" element={<BookingPage />} />
              <Route path="/booking.html" element={<BookingPage />} />

              {/* All Events Catalogue */}
              <Route path="/all-events" element={<AllEventsPage />} />
              <Route path="/all-events.html" element={<AllEventsPage />} />
              <Route path="/events" element={<AllEventsPage />} />
              <Route path="/events.html" element={<AllEventsPage />} />

              {/* Static / Settings Pages */}
              <Route path="/about" element={<AboutPage />} />
              <Route path="/about.html" element={<AboutPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/settings.html" element={<SettingsPage />} />

              {/* Catch-all fallback */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </AuthProvider>
        </ModalProvider>
      </ToastProvider>
    </BrowserRouter>
  );
};

export default App;
