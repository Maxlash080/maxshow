import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LocationPicker } from './LocationPicker';

export const Navbar = ({ currentLocation, onLocationChange }) => {
  const { user, isAuthenticated, isAdmin, logout } = useAuth();
  const location = useLocation();

  const initial = user?.name?.trim()?.charAt(0)?.toUpperCase() || 'U';
  const firstName = user?.name?.trim()?.split(' ')[0] || 'Profile';

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
          {isAdmin && (
            <span className="rounded-full bg-ink px-2.5 py-0.5 text-[11px] sm:text-xs font-black uppercase tracking-wider text-white dark:bg-slate-700">
              Admin
            </span>
          )}
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

          {isAdmin ? (
            <div className="flex items-center gap-2">
              <Link
                to="/admin-dashboard"
                className="rounded-full bg-coral px-4 py-2 text-xs sm:text-sm font-bold text-white shadow-sm hover:bg-[#df503c] transition"
              >
                Dashboard
              </Link>
              <button
                onClick={logout}
                className="rounded-full border border-stone-300 bg-white px-3 sm:px-4 py-2 text-xs sm:text-sm font-bold text-red-600 transition hover:border-red-400 hover:bg-red-50 dark:border-slate-700 dark:bg-[#1c2733] dark:hover:bg-red-950/40"
                type="button"
              >
                Log out
              </button>
            </div>
          ) : isAuthenticated ? (
            <Link
              to="/dashboard"
              className="flex items-center gap-2 rounded-full border border-stone-300 bg-white py-1.5 pl-2 pr-3 text-sm font-bold shadow-sm transition hover:border-coral hover:text-coral dark:border-slate-700 dark:bg-[#1c2733] dark:text-white"
              title="Open your profile dashboard"
              aria-label={`Open ${user.name}'s dashboard`}
            >
              <span className="grid h-7 w-7 place-items-center rounded-full bg-coral text-xs font-black text-white">
                {initial}
              </span>
              <span className="max-w-[100px] truncate">{firstName}</span>
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
