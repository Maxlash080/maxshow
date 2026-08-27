import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { apiRequest } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

export const AdminSignInPage = () => {
  const navigate = useNavigate();
  const { refreshAuth } = useAuth();
  const { showToast } = useToast();

  const [formData, setFormData] = useState({ username: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');

    if (!formData.username.trim() || !formData.password) {
      setErrorMessage('Please enter both username and password.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await apiRequest('/api/admin/login', {
        method: 'POST',
        body: JSON.stringify({
          username: formData.username.trim(),
          password: formData.password,
        }),
      });

      showToast(res.message || 'Welcome to Admin Control Centre! 🚀');
      await refreshAuth();
      navigate('/admin-dashboard');
    } catch (err) {
      setErrorMessage(err.message || 'Invalid admin credentials.');
      showToast(err.message || 'Admin sign in failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-cream text-ink dark:bg-[#101820] dark:text-white flex flex-col justify-between">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-stone-200/80 bg-cream/95 backdrop-blur dark:bg-[#1c2733]/95 dark:border-slate-800">
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link to="/" className="flex items-center gap-2.5 group">
            <img
              src="/logo.png"
              alt="MAXSHOW Logo"
              className="h-10 w-10 rounded-2xl object-cover shadow-sm ring-1 ring-black/5 dark:ring-white/10 transition-transform group-hover:scale-105"
            />
            <span className="text-xl font-black tracking-tight text-ink dark:text-white">MAXSHOW</span>
          </Link>
          <Link
            to="/"
            className="text-sm font-bold text-slate-600 transition hover:text-coral dark:text-slate-300 dark:hover:text-coral"
          >
            ← Back to home
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto grid min-h-[calc(100vh-5rem)] max-w-7xl items-center gap-8 lg:gap-12 px-4 sm:px-6 py-6 sm:py-8 lg:grid-cols-2 lg:px-8 flex-1">
        {/* Left Side */}
        <section className="hidden lg:block">
          <p className="text-xs sm:text-sm font-bold uppercase tracking-[.16em] text-coral">For event organisers</p>
          <h1 className="mt-3 max-w-lg text-4xl lg:text-5xl font-black leading-[1.05] tracking-tight text-ink dark:text-white">
            Bring your next good plan to life.
          </h1>
          <p className="mt-4 max-w-md text-sm sm:text-base leading-7 text-slate-600 dark:text-slate-300">
            Sign in to manage your events, welcome your audience, and keep the city calendar full of experiences worth showing up for.
          </p>
          <div className="mt-6 rounded-[2rem] bg-[#F9D9B7] p-6 text-ink shadow-sm">
            <p className="text-2xl">✦</p>
            <p className="mt-3 text-base font-black">Your events, all in one place.</p>
            <p className="mt-1 text-xs sm:text-sm leading-6 text-slate-700">
              Create listings, update details, and keep your MAXSHOW community moving.
            </p>
          </div>
        </section>

        {/* Right Side Admin Form */}
        <section className="mx-auto w-full max-w-md rounded-[2rem] bg-white p-6 sm:p-7 shadow-xl shadow-stone-300/30 dark:bg-[#1c2733] dark:border dark:border-slate-700">
          <p className="text-xs font-bold uppercase tracking-[.16em] text-coral">Secure workspace</p>
          <h2 className="mt-1 text-2xl sm:text-3xl font-black text-ink dark:text-white">Admin sign in</h2>
          <p className="mt-1 text-xs sm:text-sm leading-6 text-slate-500 dark:text-slate-400">
            Use your admin account to manage events and users.
          </p>

          {errorMessage && (
            <div className="mt-4 rounded-xl bg-red-50 p-3 text-xs font-bold text-red-600 dark:bg-red-950/50 dark:text-red-300">
              ⚠️ {errorMessage}
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
            <div>
              <label className="mb-1.5 block text-xs sm:text-sm font-bold text-ink dark:text-slate-200" htmlFor="username">
                Username
              </label>
              <input
                id="username"
                type="text"
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                placeholder="Enter your username"
                className="w-full rounded-xl border border-stone-300 px-4 py-2.5 sm:py-3 text-sm font-semibold outline-none transition focus:border-coral focus:ring-4 focus:ring-coral/20 dark:border-slate-700 dark:bg-[#101820] dark:text-white"
                required
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs sm:text-sm font-bold text-ink dark:text-slate-200" htmlFor="password">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder="Enter your password"
                  className="w-full rounded-xl border border-stone-300 px-4 py-2.5 sm:py-3 pr-11 text-sm font-semibold outline-none transition focus:border-coral focus:ring-4 focus:ring-coral/20 dark:border-slate-700 dark:bg-[#101820] dark:text-white"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-base"
                >
                  {showPassword ? '🙈' : '👁'}
                </button>
              </div>
            </div>

            <button
              disabled={submitting}
              type="submit"
              className="w-full rounded-2xl bg-coral px-5 py-3 sm:py-3.5 text-sm sm:text-base font-bold text-white transition hover:bg-[#df503c] shadow-lg shadow-coral/25 disabled:opacity-50"
            >
              {submitting ? 'Signing in...' : 'Sign in as admin'}
            </button>
          </form>

          <p className="mt-5 text-center text-xs sm:text-sm text-slate-600 dark:text-slate-400">
            Looking for the standard user sign in?{' '}
            <Link className="font-bold text-coral hover:underline" to="/user">
              User sign in →
            </Link>
          </p>
        </section>
      </main>
    </div>
  );
};
