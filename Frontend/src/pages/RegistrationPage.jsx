import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { apiRequest } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

export const RegistrationPage = () => {
  const navigate = useNavigate();
  const { refreshAuth } = useAuth();
  const { showToast } = useToast();

  const [formData, setFormData] = useState({
    full_name: '',
    username: '',
    email: '',
    otp: '',
    phone: '',
    password: '',
    confirm_password: '',
  });

  const [otpSent, setOtpSent] = useState(false);
  const [otpVerified, setOtpVerified] = useState(false);
  const [otpTimer, setOtpTimer] = useState(0);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [otpStatusMsg, setOtpStatusMsg] = useState('Enter your email and click "Send OTP" to receive your verification code.');
  const [otpStatusType, setOtpStatusType] = useState('info'); // 'info' | 'success' | 'error'

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const timerRef = useRef(null);

  // OTP Countdown timer
  useEffect(() => {
    if (otpTimer > 0) {
      timerRef.current = setTimeout(() => {
        setOtpTimer((prev) => prev - 1);
      }, 1000);
    }
    return () => clearTimeout(timerRef.current);
  }, [otpTimer]);

  // Password requirements calculation
  const p = formData.password;
  const reqLength = p.length >= 8;
  const reqUpper = /[A-Z]/.test(p);
  const reqLower = /[a-z]/.test(p);
  const reqNum = /[0-9]/.test(p);
  const reqSpec = /[^A-Za-z0-9]/.test(p);
  const metCount = [reqLength, reqUpper, reqLower, reqNum, reqSpec].filter(Boolean).length;
  const allReqsMet = metCount === 5;

  const handleSendOtp = async () => {
    if (!formData.email.trim() || !formData.email.includes('@')) {
      showToast('Please enter a valid email address first.');
      return;
    }

    setSendingOtp(true);
    setOtpStatusMsg('Sending verification code...');
    setOtpStatusType('info');

    try {
      const res = await apiRequest('/api/auth/send-otp', {
        method: 'POST',
        body: JSON.stringify({ email: formData.email.trim() }),
      });

      setOtpSent(true);
      setOtpVerified(false);
      setOtpTimer(60);
      setOtpStatusMsg(res.message || 'OTP sent successfully! Please check your inbox.');
      setOtpStatusType('success');
      showToast('OTP sent to your email ✉️');
    } catch (err) {
      setOtpStatusMsg(err.message || 'Failed to send OTP. Please try again.');
      setOtpStatusType('error');
      showToast(err.message || 'Failed to send OTP');
    } finally {
      setSendingOtp(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!formData.otp.trim() || formData.otp.trim().length !== 6) {
      showToast('Please enter the 6-digit OTP code.');
      return;
    }

    setVerifyingOtp(true);
    setOtpStatusMsg('Verifying OTP code...');
    setOtpStatusType('info');

    try {
      const res = await apiRequest('/api/auth/verify-otp', {
        method: 'POST',
        body: JSON.stringify({
          email: formData.email.trim(),
          otp: formData.otp.trim(),
        }),
      });

      setOtpVerified(true);
      setOtpStatusMsg('Email verified successfully! ✓');
      setOtpStatusType('success');
      showToast('Email verified successfully! ✓');
    } catch (err) {
      setOtpVerified(false);
      setOtpStatusMsg(err.message || 'Invalid or expired OTP.');
      setOtpStatusType('error');
      showToast(err.message || 'OTP verification failed');
    } finally {
      setVerifyingOtp(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');

    if (!formData.full_name.trim()) {
      setErrorMessage('Please enter your full name.');
      return;
    }
    if (!formData.username.trim()) {
      setErrorMessage('Please enter a username.');
      return;
    }
    if (!formData.email.trim()) {
      setErrorMessage('Please enter your email.');
      return;
    }
    if (otpSent && !otpVerified) {
      setErrorMessage('Please verify your email with the 6-digit OTP code.');
      return;
    }
    if (!allReqsMet) {
      setErrorMessage('Password must meet all 5 security requirements.');
      return;
    }
    if (formData.password !== formData.confirm_password) {
      setErrorMessage('Passwords do not match.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await apiRequest('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          full_name: formData.full_name.trim(),
          username: formData.username.trim(),
          email: formData.email.trim(),
          mobile: formData.phone.trim() || undefined,
          phone: formData.phone.trim() || undefined,
          otp: formData.otp.trim(),
          password: formData.password,
          confirm_password: formData.confirm_password,
        }),
      });

      showToast(res.message || 'Account created successfully! Welcome to MAXSHOW! 🎉');
      await refreshAuth();
      navigate('/dashboard');
    } catch (err) {
      setErrorMessage(err.message || 'Registration failed.');
      showToast(err.message || 'Registration failed');
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
            to="/user"
            className="text-sm font-bold text-slate-600 transition hover:text-coral dark:text-slate-300 dark:hover:text-coral"
          >
            Already a member? Sign in
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto grid min-h-[calc(100vh-5rem)] max-w-7xl items-center gap-8 lg:gap-12 px-4 sm:px-6 py-4 sm:py-6 lg:py-8 lg:grid-cols-[1.05fr_1.05fr] lg:px-8 flex-1">
        {/* Left Side Value Props */}
        <section className="hidden lg:flex flex-col justify-center space-y-5 pr-2">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-white/90 dark:bg-white/10 px-4 py-1.5 text-xs font-bold text-coral backdrop-blur border border-coral/20 shadow-sm">
              <span className="h-2 w-2 rounded-full bg-coral animate-pulse"></span>
              <span>Join 12,000+ Local Explorers</span>
            </div>
            <h1 className="mt-3 text-3xl sm:text-4xl lg:text-[2.75rem] font-black leading-[1.1] tracking-tight text-ink dark:text-white">
              Make more room for <span className="text-coral">good plans.</span>
            </h1>
            <p className="mt-3 text-sm sm:text-base leading-relaxed text-slate-600 dark:text-slate-300 max-w-lg">
              Your personal gateway to intimate live music, secret comedy rooms, creative workshops, and weekend gatherings across Pune &amp; PCMC.
            </p>
          </div>

          <div className="space-y-3 max-w-lg">
            <div className="flex items-start gap-3.5 rounded-2xl border border-stone-200/80 bg-white/80 p-3.5 shadow-sm backdrop-blur transition hover:border-coral/40 hover:shadow-md dark:border-slate-800 dark:bg-[#1c2733]/90">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-[#FFE7E3] to-[#FFD5CE] text-lg shadow-sm dark:from-[#352225] dark:to-[#28181b]">
                🎟️
              </div>
              <div>
                <h2 className="text-xs sm:text-sm font-black text-ink dark:text-white">Instant QR Entry &amp; Digital Passes</h2>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  Book tickets in seconds with verified Razorpay checkout and access entry passes anytime.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3.5 rounded-2xl border border-stone-200/80 bg-white/80 p-3.5 shadow-sm backdrop-blur transition hover:border-coral/40 hover:shadow-md dark:border-slate-800 dark:bg-[#1c2733]/90">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-[#EDE9FE] to-[#DDD6FE] text-lg shadow-sm dark:from-[#2a1d42] dark:to-[#1e1433]">
                🔔
              </div>
              <div>
                <h2 className="text-xs sm:text-sm font-black text-ink dark:text-white">Early Access &amp; Drop Alerts</h2>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  Get notified when limited-capacity acoustic sets and secret screenings open for booking.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Right Side Registration Form */}
        <section className="mx-auto w-full max-w-xl rounded-[2rem] bg-white p-6 sm:p-7 shadow-xl shadow-stone-300/30 dark:bg-[#1c2733] dark:border dark:border-slate-700">
          <p className="text-xs font-bold uppercase tracking-[.16em] text-coral">Start exploring</p>
          <h2 className="mt-1 text-2xl sm:text-3xl font-black text-ink dark:text-white">Create your account</h2>
          <p className="mt-1 text-xs sm:text-sm text-slate-500 dark:text-slate-400">A few details and you’re ready to book.</p>

          {errorMessage && (
            <div className="mt-4 rounded-xl bg-red-50 p-3 text-xs font-bold text-red-600 dark:bg-red-950/50 dark:text-red-300">
              ⚠️ {errorMessage}
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-5 grid gap-3.5 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-bold text-ink dark:text-slate-200" htmlFor="full_name">
                Full name
              </label>
              <input
                id="full_name"
                type="text"
                value={formData.full_name}
                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                placeholder="e.g. Rahul Sharma"
                className="w-full rounded-xl border border-stone-300 px-3.5 py-2.5 text-sm font-semibold outline-none transition focus:border-coral focus:ring-4 focus:ring-coral/20 dark:border-slate-700 dark:bg-[#101820] dark:text-white"
                required
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-bold text-ink dark:text-slate-200" htmlFor="username">
                Username
              </label>
              <input
                id="username"
                type="text"
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                placeholder="e.g. rahul_99"
                maxLength={30}
                className="w-full rounded-xl border border-stone-300 px-3.5 py-2.5 text-sm font-semibold outline-none transition focus:border-coral focus:ring-4 focus:ring-coral/20 dark:border-slate-700 dark:bg-[#101820] dark:text-white"
                required
              />
            </div>

            {/* Email with Send OTP action */}
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-bold text-ink dark:text-slate-200" htmlFor="email">
                Email address
              </label>
              <div className="flex gap-2">
                <input
                  id="email"
                  type="email"
                  value={formData.email}
                  disabled={otpVerified}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="you@example.com"
                  className="w-full rounded-xl border border-stone-300 px-3.5 py-2.5 text-sm font-semibold outline-none transition focus:border-coral focus:ring-4 focus:ring-coral/20 dark:border-slate-700 dark:bg-[#101820] dark:text-white disabled:opacity-70"
                  required
                />
                <button
                  type="button"
                  onClick={handleSendOtp}
                  disabled={sendingOtp || otpTimer > 0 || otpVerified}
                  className="shrink-0 rounded-xl bg-coral px-4 py-2.5 text-xs font-bold text-white shadow-md shadow-coral/20 hover:bg-[#df503c] transition whitespace-nowrap disabled:opacity-50"
                >
                  {otpVerified ? 'Verified ✓' : sendingOtp ? 'Sending...' : otpTimer > 0 ? `Resend in ${otpTimer}s` : 'Send OTP'}
                </button>
              </div>
            </div>

            {/* OTP Section (Shown if OTP sent or active) */}
            {(otpSent || otpVerified) && (
              <div className="sm:col-span-2 rounded-2xl bg-coral/5 border border-coral/20 p-3.5 dark:bg-[#151f2b] dark:border-slate-700 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold uppercase tracking-wider text-coral" htmlFor="otp">
                    Enter 6-Digit OTP *
                  </label>
                  {otpVerified && <span className="text-xs font-bold text-emerald-500">Verified ✓</span>}
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    id="otp"
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={formData.otp}
                    disabled={otpVerified}
                    onChange={(e) => setFormData({ ...formData, otp: e.target.value.replace(/\D/g, '') })}
                    placeholder="------"
                    className="w-full rounded-xl border border-stone-300 px-4 py-2 text-base font-mono font-bold tracking-[0.35em] text-center outline-none transition focus:border-coral focus:ring-4 focus:ring-coral/20 dark:border-slate-700 dark:bg-[#101820] dark:text-white"
                  />
                  {!otpVerified && (
                    <button
                      type="button"
                      onClick={handleVerifyOtp}
                      disabled={verifyingOtp || formData.otp.length !== 6}
                      className="rounded-xl bg-ink text-white dark:bg-slate-800 dark:text-white px-5 py-2 text-xs font-bold transition hover:bg-coral dark:hover:bg-coral whitespace-nowrap disabled:opacity-50"
                    >
                      {verifyingOtp ? 'Verifying...' : 'Verify OTP'}
                    </button>
                  )}
                </div>
                <p
                  className={`text-xs font-semibold ${
                    otpStatusType === 'success'
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : otpStatusType === 'error'
                      ? 'text-red-500'
                      : 'text-slate-500 dark:text-slate-400'
                  }`}
                >
                  {otpStatusMsg}
                </p>
              </div>
            )}

            {/* Mobile Number */}
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-bold text-ink dark:text-slate-200" htmlFor="phone">
                Mobile number (optional)
              </label>
              <input
                id="phone"
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value.replace(/[^\d+]/g, '') })}
                placeholder="10-digit mobile for ticket SMS"
                maxLength={13}
                className="w-full rounded-xl border border-stone-300 px-3.5 py-2.5 text-sm font-semibold outline-none transition focus:border-coral focus:ring-4 focus:ring-coral/20 dark:border-slate-700 dark:bg-[#101820] dark:text-white"
              />
            </div>

            {/* Password */}
            <div>
              <label className="mb-1 block text-xs font-bold text-ink dark:text-slate-200" htmlFor="password">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder="Create password"
                  className="w-full rounded-xl border border-stone-300 px-3.5 py-2.5 pr-10 text-sm font-semibold outline-none transition focus:border-coral focus:ring-4 focus:ring-coral/20 dark:border-slate-700 dark:bg-[#101820] dark:text-white"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm"
                >
                  {showPassword ? '🙈' : '👁'}
                </button>
              </div>
            </div>

            {/* Confirm Password */}
            <div>
              <label className="mb-1 block text-xs font-bold text-ink dark:text-slate-200" htmlFor="confirm_password">
                Confirm password
              </label>
              <div className="relative">
                <input
                  id="confirm_password"
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={formData.confirm_password}
                  onChange={(e) => setFormData({ ...formData, confirm_password: e.target.value })}
                  placeholder="Confirm password"
                  className="w-full rounded-xl border border-stone-300 px-3.5 py-2.5 pr-10 text-sm font-semibold outline-none transition focus:border-coral focus:ring-4 focus:ring-coral/20 dark:border-slate-700 dark:bg-[#101820] dark:text-white"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword((prev) => !prev)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm"
                >
                  {showConfirmPassword ? '🙈' : '👁'}
                </button>
              </div>
            </div>

            {/* Live Password Checklist */}
            <div className="sm:col-span-2 rounded-2xl bg-stone-50 dark:bg-[#151f2b] p-3 border border-stone-200 dark:border-slate-700 text-xs">
              <div className="flex items-center justify-between mb-1.5 font-bold">
                <span className="text-slate-500 dark:text-slate-400">Password strength</span>
                <span className={allReqsMet ? 'text-emerald-500' : 'text-coral'}>{metCount}/5 met</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-1 font-medium text-[11px]">
                <span className={reqLength ? 'text-emerald-500' : 'text-slate-400'}>{reqLength ? '✓' : '○'} 8+ chars</span>
                <span className={reqUpper ? 'text-emerald-500' : 'text-slate-400'}>{reqUpper ? '✓' : '○'} Uppercase</span>
                <span className={reqLower ? 'text-emerald-500' : 'text-slate-400'}>{reqLower ? '✓' : '○'} Lowercase</span>
                <span className={reqNum ? 'text-emerald-500' : 'text-slate-400'}>{reqNum ? '✓' : '○'} Number</span>
                <span className={reqSpec ? 'text-emerald-500' : 'text-slate-400'}>{reqSpec ? '✓' : '○'} Special char</span>
              </div>
            </div>

            {/* Submit Button */}
            <div className="sm:col-span-2 pt-1">
              <button
                disabled={submitting}
                type="submit"
                className="w-full rounded-2xl bg-coral px-5 py-3 text-sm sm:text-base font-bold text-white transition hover:bg-[#df503c] shadow-lg shadow-coral/25 disabled:opacity-50"
              >
                {submitting ? 'Creating account...' : 'Create account & explore'}
              </button>
            </div>
          </form>

          <p className="mt-4 text-center text-xs sm:text-sm text-slate-600 dark:text-slate-400">
            Already have an account?{' '}
            <Link className="font-bold text-coral hover:underline" to="/user">
              Sign in
            </Link>
          </p>
        </section>
      </main>
    </div>
  );
};
