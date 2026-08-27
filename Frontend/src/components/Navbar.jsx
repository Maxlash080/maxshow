import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LocationPicker } from './LocationPicker';

export const Navbar = ({ currentLocation, onLocationChange }) => {
  const { user, isAuthenticated, isAdmin, logout } = useAuth();
  const location = useLocation();

  const initial = user?.name?.trim()?.charAt(0)?.toUpperCase() || 'U';
  const firstName = user?.name?.trim()?.split(' ')[0] || 'Profile';
  const isDashboardPage = location.pathname === '/dashboard' || location.pathname === '/dashboard.html';

  return (
    <header className="sticky top-0 z-30 border-b border-stone-200/80 bg-cream/95 backdrop-blur dark:bg-[#1c2733]/95 dark:border-slate-800">
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          <Link to="/" className="flex items-center gap-2.5 group" aria-label="MAXSHOW home">
            <img
              src="/logo.png"
              alt="MAXSHOW Logo"
              className="h-10 w-10 rounded-2xl object-cover shadow-sm ring-1 ring-black/5 dark:ring-white/10 transition-transform group-hover:scale-105"
            />
            <span className="text-xl font-black tracking-tight text-ink dark:text-white">MAXSHOW</span>
          </Link>
        </div>

        <nav className="hidden items-center gap-7 text-sm font-semibold md:flex">
          <Link className="transition hover:text-coral text-ink dark:text-white" to="/all-events">
            All events
          </Link>
          <a className="transition hover:text-coral text-ink dark:text-white" href="/#location-picks">
            City picks
          </a>
          <a className="transition hover:text-coral text-ink dark:text-white" href="/#categories">
            Categories
          </a>
          <Link className="transition hover:text-coral text-ink dark:text-white" to="/about">
            About us
          </Link>
        </nav>

        <div className="flex items-center gap-2.5 sm:gap-3">
          {onLocationChange && (
            <LocationPicker currentLocation={currentLocation} onLocationChange={onLocationChange} />
          )}

          {isAuthenticated ? (
            !isDashboardPage ? (
              <Link
                to="/dashboard"
                className="flex items-center gap-2 rounded-full bg-coral px-4 py-2 text-xs sm:text-sm font-bold text-white shadow-sm hover:bg-[#df503c] transition"
                title="Open your profile dashboard"
                aria-label={`Open ${user?.name || 'User'}'s profile dashboard`}
              >
                <span className="grid h-5 w-5 place-items-center rounded-full bg-white/20 text-[11px] font-black text-white">
                  {initial}
                </span>
                <span>Profile</span>
              </Link>
            ) : null
          ) : isAdmin ? (
            <Link
              to="/admin-dashboard"
              className="rounded-full bg-coral px-4 py-2 text-xs sm:text-sm font-bold text-white shadow-sm hover:bg-[#df503c] transition"
            >
              Admin Centre
            </Link>
          ) : (
            <Link
              to="/user"
              className="rounded-full bg-ink px-4 py-2 text-xs sm:text-sm font-bold text-white transition hover:bg-coral dark:bg-[#283747]"
            >
              Sign in
            </Link>
          )}
        </div>
      </div>
    </header>
  );
};
