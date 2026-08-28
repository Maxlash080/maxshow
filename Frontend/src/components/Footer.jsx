import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export const Footer = () => {
  const { isAuthenticated, isAdmin } = useAuth();

  return (
    <footer id="about" className="border-t border-stone-200 bg-white dark:border-slate-800 dark:bg-[#1c2733]">
      <div className="mx-auto flex max-w-7xl flex-col justify-between gap-6 px-4 sm:px-6 py-8 sm:py-10 sm:flex-row sm:items-center lg:px-8">
        <div>
          <Link to="/" className="text-xl font-black tracking-tight text-ink dark:text-white">
            MAXSHOW
          </Link>
          <p className="mt-1 text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            Good plans, close to home.
          </p>
        </div>
        <div className="flex flex-wrap gap-4 sm:gap-6 text-xs sm:text-sm font-semibold text-slate-600 dark:text-slate-300">
          <Link className="hover:text-coral transition" to="/all-events">
            All events
          </Link>
          <Link className="hover:text-coral transition" to="/about">
            About us
          </Link>
          <a
            className="hover:text-coral transition"
            href="https://mail.google.com/mail/?view=cm&fs=1&to=official.maxshow@gmail.com"
            target="_blank"
            rel="noopener noreferrer"
            title="Send email to official.maxshow@gmail.com"
          >
            Contact us
          </a>
          {isAdmin ? (
            <Link className="hover:text-coral transition" to="/admin-dashboard">
              Dashboard
            </Link>
          ) : isAuthenticated ? (
            <Link className="hover:text-coral transition" to="/dashboard">
              Dashboard
            </Link>
          ) : (
            <Link className="hover:text-coral transition" to="/registration">
              Create account
            </Link>
          )}
          <Link className="hover:text-coral transition" to={isAdmin ? "/admin-dashboard" : "/admin"}>
            For organisers
          </Link>
        </div>
      </div>
    </footer>
  );
};
