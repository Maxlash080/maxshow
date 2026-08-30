import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LocationPicker } from './LocationPicker';

export const Navbar = ({ currentLocation, onLocationChange, availableLocations }) => {
  const { user, isAuthenticated, isAdmin, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const initial = user?.name?.trim()?.charAt(0)?.toUpperCase() || 'U';
  const firstName = user?.name?.trim()?.split(' ')[0] || 'Profile';
  const isDashboardPage = location.pathname === '/dashboard' || location.pathname === '/dashboard.html';

  const isActive = (path) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  const handleScrollTo = (e, sectionId) => {
    e.preventDefault();
    setMobileMenuOpen(false);

    if (location.pathname !== '/' && location.pathname !== '/index.html') {
      navigate(`/#${sectionId}`);
      setTimeout(() => {
        const el = document.getElementById(sectionId);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 250);
    } else {
      const el = document.getElementById(sectionId);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-stone-200/70 bg-white/80 backdrop-blur-xl dark:bg-[#101820]/80 dark:border-white/[0.08] transition-colors duration-200">
      <div className="mx-auto flex h-16 sm:h-18 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Left Side: Brand Logo */}
        <div className="flex items-center gap-3">
          <Link to="/" className="flex items-center gap-2.5 group" aria-label="MAXSHOW home">
            <img
              src="/logo.png"
              alt="MAXSHOW Logo"
              className="h-9 w-9 sm:h-10 sm:w-10 rounded-2xl object-cover ring-1 ring-black/10 dark:ring-white/15 transition-transform duration-200 group-hover:scale-105 shadow-sm"
            />
            <span className="text-xl font-black tracking-tight text-ink dark:text-white">
              MAXSHOW
            </span>
          </Link>
        </div>

        {/* Center: Navigation Links (Text Only, Mathematically Centered) */}
        <nav className="hidden items-center gap-7 lg:gap-9 text-[15px] font-bold md:flex absolute left-1/2 -translate-x-1/2">
          <Link
            to="/all-events"
            className={`transition-colors duration-150 ${
              isActive('/all-events')
                ? 'text-coral font-black'
                : 'text-ink dark:text-white hover:text-coral dark:hover:text-coral'
            }`}
          >
            All events
          </Link>

          <button
            type="button"
            onClick={(e) => handleScrollTo(e, 'city-picks')}
            className="text-ink dark:text-white hover:text-coral dark:hover:text-coral transition-colors duration-150 cursor-pointer font-bold"
          >
            City picks
          </button>

          <button
            type="button"
            onClick={(e) => handleScrollTo(e, 'categories')}
            className="text-ink dark:text-white hover:text-coral dark:hover:text-coral transition-colors duration-150 cursor-pointer font-bold"
          >
            Categories
          </button>

          <Link
            to="/about"
            className={`transition-colors duration-150 ${
              isActive('/about')
                ? 'text-coral font-black'
                : 'text-ink dark:text-white hover:text-coral dark:hover:text-coral'
            }`}
          >
            About us
          </Link>
        </nav>

        {/* Right Side: Actions & Profile */}
        <div className="flex items-center gap-2 sm:gap-3">
          {onLocationChange && (
            <LocationPicker
              currentLocation={currentLocation}
              onLocationChange={onLocationChange}
              availableLocations={availableLocations}
            />
          )}

          {isAuthenticated ? (
            !isDashboardPage ? (
              <Link
                to="/dashboard"
                className="group flex items-center gap-2 rounded-full bg-gradient-to-r from-coral to-[#ff5d47] px-3.5 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-bold text-white shadow-sm shadow-coral/25 hover:shadow-md hover:shadow-coral/30 hover:scale-[1.02] active:scale-98 transition-all duration-150"
                title="Open your profile dashboard"
                aria-label={`Open ${user?.name || 'User'}'s profile dashboard`}
              >
                <span className="grid h-5 w-5 sm:h-5.5 sm:w-5.5 place-items-center rounded-full bg-white/25 text-[11px] font-black text-white shadow-inner">
                  {initial}
                </span>
                <span className="truncate max-w-[80px] sm:max-w-none">{firstName}</span>
                <svg className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-white/80 group-hover:translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            ) : null
          ) : isAdmin ? (
            <Link
              to="/admin-dashboard"
              className="flex items-center gap-1.5 rounded-full bg-gradient-to-r from-coral to-[#ff5d47] px-4 py-1.5 text-xs sm:text-sm font-bold text-white shadow-sm shadow-coral/25 hover:shadow-md hover:shadow-coral/30 hover:scale-[1.02] transition-all"
            >
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
              <span>Admin Centre</span>
            </Link>
          ) : (
            <Link
              to="/user"
              className="rounded-full bg-ink dark:bg-white/10 px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-bold text-white hover:bg-coral dark:hover:bg-coral transition-all duration-150 shadow-xs active:scale-95"
            >
              Sign in
            </Link>
          )}

          {/* Mobile Menu Hamburger Button */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden flex h-9 w-9 items-center justify-center rounded-2xl border border-stone-200/80 bg-stone-50 dark:border-white/10 dark:bg-white/5 text-slate-700 dark:text-slate-200 hover:border-coral hover:text-coral transition-all active:scale-95"
            aria-label="Toggle navigation menu"
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? (
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16m-7 6h7" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-stone-200/70 dark:border-white/[0.08] bg-white/95 dark:bg-[#101820]/95 backdrop-blur-xl px-4 py-4 space-y-3 animate-in slide-in-from-top-2 duration-150">
          {onLocationChange && (
            <div className="pb-2 border-b border-stone-100 dark:border-white/5 flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Current Location</span>
              <LocationPicker
                currentLocation={currentLocation}
                onLocationChange={onLocationChange}
                availableLocations={availableLocations}
              />
            </div>
          )}
          <nav className="flex flex-col space-y-1">
            <Link
              to="/all-events"
              onClick={() => setMobileMenuOpen(false)}
              className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-bold transition ${
                isActive('/all-events')
                  ? 'bg-coral/10 text-coral dark:bg-coral/20 font-black'
                  : 'text-slate-700 dark:text-slate-200 hover:bg-stone-50 dark:hover:bg-white/5'
              }`}
            >
              <span>All events</span>
              <span className="text-xs text-slate-400">→</span>
            </Link>
            <button
              type="button"
              onClick={(e) => handleScrollTo(e, 'city-picks')}
              className="flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-bold text-slate-700 dark:text-slate-200 hover:bg-stone-50 dark:hover:bg-white/5 transition text-left cursor-pointer w-full"
            >
              <span>City picks</span>
              <span className="text-xs text-slate-400">→</span>
            </button>
            <button
              type="button"
              onClick={(e) => handleScrollTo(e, 'categories')}
              className="flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-bold text-slate-700 dark:text-slate-200 hover:bg-stone-50 dark:hover:bg-white/5 transition text-left cursor-pointer w-full"
            >
              <span>Categories</span>
              <span className="text-xs text-slate-400">→</span>
            </button>
            <Link
              to="/about"
              onClick={() => setMobileMenuOpen(false)}
              className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-bold transition ${
                isActive('/about')
                  ? 'bg-coral/10 text-coral dark:bg-coral/20 font-black'
                  : 'text-slate-700 dark:text-slate-200 hover:bg-stone-50 dark:hover:bg-white/5'
              }`}
            >
              <span>About us</span>
              <span className="text-xs text-slate-400">→</span>
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
};
