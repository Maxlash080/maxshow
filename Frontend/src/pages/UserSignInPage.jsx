import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { apiRequest } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

export const UserSignInPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { refreshAuth } = useAuth();
  const { showToast } = useToast();

  const [formData, setFormData] = useState({
    email: '',
    password: '',
    remember_me: false,
  });
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const redirectUrl = new URLSearchParams(location.search).get('redirect') || '/';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');

    if (!formData.email.trim() || !formData.password) {
      setErrorMessage('Please fill in your email/username and password.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await apiRequest('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          email: formData.email.trim(),
          password: formData.password,
          remember_me: formData.remember_me,
        }),
      });

      showToast(res.message || 'Signed in successfully! 👋');
      await refreshAuth();
      navigate(redirectUrl);
    } catch (err) {
      setErrorMessage(err.message || 'Invalid email or password.');
      showToast(err.message || 'Sign in failed');
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
      <main className="mx-auto grid min-h-[calc(100vh-5rem)] max-w-7xl items-center gap-8 lg:gap-12 px-4 sm:px-6 py-4 sm:py-6 lg:py-8 lg:grid-cols-[1.1fr_0.9fr] lg:px-8 flex-1">
        {/* Left Side Value Props */}
        <section className="hidden lg:flex flex-col justify-center space-y-6 pr-4">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-white/90 dark:bg-white/10 px-4 py-1.5 text-xs font-bold text-coral backdrop-blur border border-coral/20 shadow-sm">
              <span className="h-2 w-2 rounded-full bg-coral animate-pulse"></span>
              <span>Welcome back to MAXSHOW</span>
            </div>
            <h1 className="mt-3 text-3xl sm:text-4xl lg:text-[2.75rem] font-black leading-[1.1] tracking-tight text-ink dark:text-white">
              Your next good plan is <span className="text-coral">waiting.</span>
            </h1>
            <p className="mt-3 text-sm sm:text-base leading-relaxed text-slate-600 dark:text-slate-300 max-w-lg">
              Sign in to access your digital tickets, manage upcoming reservations, and discover tonight's best happenings around you.
            </p>
          </div>

          <div className="space-y-3 max-w-lg">
            <div className="flex items-start gap-3.5 rounded-2xl border border-stone-200/80 bg-white/80 p-3.5 shadow-sm backdrop-blur transition hover:border-coral/40 hover:shadow-md dark:border-slate-800 dark:bg-[#1c2733]/90">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-[#FFE7E3] to-[#FFD5CE] text-lg shadow-sm dark:from-[#352225] dark:to-[#28181b]">
                🎟️
              </div>
              <div>
                <h2 className="text-xs sm:text-sm font-black text-ink dark:text-white">Your Bookings &amp; Tickets</h2>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  Quick access to all your confirmed QR tickets and booking history.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3.5 rounded-2xl border border-stone-200/80 bg-white/80 p-3.5 shadow-sm backdrop-blur transition hover:border-coral/40 hover:shadow-md dark:border-slate-800 dark:bg-[#1c2733]/90">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-[#EDE9FE] to-[#DDD6FE] text-lg shadow-sm dark:from-[#2a1d42] dark:to-[#1e1433]">
                ✨
              </div>
              <div>
                <h2 className="text-xs sm:text-sm font-black text-ink dark:text-white">Personalised Experience Feed</h2>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  Tailored recommendations for acoustic gigs, comedy sets, and weekend pop-ups.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3.5 rounded-2xl bg-[#F9D9B7]/40 dark:bg-slate-800/60 p-3 border border-stone-200/60 dark:border-slate-700/60 backdrop-blur max-w-lg">
            <div className="flex -space-x-2 overflow-hidden">
              <span className="inline-grid h-7 w-7 place-items-center rounded-full bg-[#FFD5CE] text-xs ring-2 ring-white dark:ring-slate-900 shadow-sm">🎸</span>
              <span className="inline-grid h-7 w-7 place-items-center rounded-full bg-[#E7DBF3] text-xs ring-2 ring-white dark:ring-slate-900 shadow-sm">🎨</span>
              <span className="inline-grid h-7 w-7 place-items-center rounded-full bg-[#D2E8E3] text-xs ring-2 ring-white dark:ring-slate-900 shadow-sm">🍜</span>
              <span className="inline-grid h-7 w-7 place-items-center rounded-full bg-coral text-white text-[11px] font-black ring-2 ring-white dark:ring-slate-900 shadow-sm">+99</span>
            </div>
            <div className="text-xs">
              <p className="font-bold text-ink dark:text-white">Experiences across 7 local areas</p>
              <p className="text-slate-500 dark:text-slate-400 font-medium">Pimpri, Chinchwad, Hinjawadi, Kasarwadi, Baner &amp; Aundh</p>
            </div>
          </div>
        </section>

        {/* Right Side Sign-In Form */}
        <section className="mx-auto w-full max-w-md rounded-[2rem] bg-white p-6 sm:p-7 shadow-xl shadow-stone-300/30 dark:bg-[#1c2733] dark:border dark:border-slate-700">
          <p className="text-xs font-bold uppercase tracking-[.16em] text-coral">Account</p>
          <h2 className="mt-1 text-2xl sm:text-3xl font-black text-ink dark:text-white">Sign in</h2>
          <p className="mt-1 text-xs sm:text-sm text-slate-500 dark:text-slate-400">Enter your details to continue your booking.</p>

          {errorMessage && (
            <div className="mt-4 rounded-xl bg-red-50 p-3 text-xs font-bold text-red-600 dark:bg-red-950/50 dark:text-red-300">
              ⚠️ {errorMessage}
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-5 space-y-3.5">
            <div>
              <label className="mb-1.5 block text-xs sm:text-sm font-bold text-ink dark:text-slate-200" htmlFor="email">
                Email address or username
              </label>
              <input
                id="email"
                type="text"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="you@example.com or username"
                className="w-full rounded-xl border border-stone-300 px-4 py-2.5 sm:py-3 text-sm font-semibold outline-none transition focus:border-coral focus:ring-4 focus:ring-coral/20 dark:border-slate-700 dark:bg-[#101820] dark:text-white"
                required
              />
            </div>

            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label className="text-xs sm:text-sm font-bold text-ink dark:text-slate-200" htmlFor="password">
                  Password
                </label>
                <a className="text-xs font-bold text-coral hover:underline" href="#">Forgot password?</a>
              </div>
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
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-ink dark:hover:text-white text-base focus:outline-none"
                  aria-label="Toggle password visibility"
                >
                  {showPassword ? '🙈' : '👁'}
                </button>
              </div>
            </div>

            <label className="flex items-center gap-2 text-xs sm:text-sm text-slate-600 dark:text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.remember_me}
                onChange={(e) => setFormData({ ...formData, remember_me: e.target.checked })}
                className="h-4 w-4 rounded border-stone-300 text-coral focus:ring-coral dark:border-slate-600 dark:bg-[#101820] accent-coral"
              />
              Remember me
            </label>

            <button
              disabled={submitting}
              type="submit"
              className="w-full rounded-2xl bg-coral px-5 py-3 sm:py-3.5 text-sm sm:text-base font-bold text-white transition hover:bg-[#df503c] shadow-lg shadow-coral/25 disabled:opacity-50"
            >
              {submitting ? 'Signing in...' : 'Sign in to MAXSHOW'}
            </button>
          </form>

          <p className="mt-4 text-center text-xs sm:text-sm text-slate-600 dark:text-slate-400">
            New here?{' '}
            <Link className="font-bold text-coral hover:underline" to="/registration">
              Create an account
            </Link>
          </p>

          <div className="my-3.5 border-t border-stone-100 dark:border-slate-700/80"></div>

          <p className="text-center text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            Organising an event?{' '}
            <Link className="font-bold text-ink hover:text-coral dark:text-white dark:hover:text-coral" to="/admin">
              Use the organiser portal →
            </Link>
          </p>
        </section>
      </main>
    </div>
  );
};
