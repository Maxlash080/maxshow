import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { apiRequest } from '../utils/api';
import { useToast } from '../context/ToastContext';
import { validateEmail } from '../utils/formatters';

export const ForgotPasswordPage = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [formData, setFormData] = useState({
    username: '',
    email: '',
    otp: '',
    password: '',
    confirm_password: '',
  });

  const [otpSent, setOtpSent] = useState(false);
  const [otpSending, setOtpSending] = useState(false);
  const [otpVerified, setOtpVerified] = useState(false);
  const [otpVerifying, setOtpVerifying] = useState(false);
  const [countdown, setCountdown] = useState(0);

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const QUICK_EMAIL_DOMAINS = ['@gmail.com', '@yahoo.com', '@outlook.com'];

  // Dynamic filter: when entering @g -> gmail only, @y -> yahoo only, @ou -> outlook only
  const getMatchingDomains = (email) => {
    if (!email || !email.includes('@')) return [];
    const atIndex = email.lastIndexOf('@');
    const domainQuery = email.slice(atIndex).toLowerCase();
    return QUICK_EMAIL_DOMAINS.filter((d) => d.startsWith(domainQuery) && d !== domainQuery);
  };

  const matchingDomains = getMatchingDomains(formData.email);

  const handleDomainSelect = (domain) => {
    const current = formData.email.trim();
    let newEmail = '';
    if (!current) {
      newEmail = domain;
    } else if (current.includes('@')) {
      const localPart = current.slice(0, current.lastIndexOf('@'));
      newEmail = `${localPart}${domain}`;
    } else {
      newEmail = `${current}${domain}`;
    }
    setFormData({ ...formData, email: newEmail });
    if (otpVerified) setOtpVerified(false);
    if (otpSent) setOtpSent(false);
  };

  // 60-second OTP resend countdown timer
  useEffect(() => {
    let timer;
    if (countdown > 0) {
      timer = setTimeout(() => setCountdown((prev) => prev - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [countdown]);

  // Password Security Checklist Requirements
  const pwd = formData.password;
  const reqLength = pwd.length >= 8;
  const reqUpper = /[A-Z]/.test(pwd);
  const reqLower = /[a-z]/.test(pwd);
  const reqNumber = /[0-9]/.test(pwd);
  const reqSpecial = /[!@#$%^&*(),.?":{}|<>\-_+=\[\]\\\/~`]/.test(pwd);
  const allReqsMet = reqLength && reqUpper && reqLower && reqNumber && reqSpecial;

  // Handle Send Password Reset OTP
  const handleSendOtp = async () => {
    setErrorMessage('');
    if (!formData.username.trim()) {
      setErrorMessage('Please enter your MAXSHOW username.');
      return;
    }
    const emailCheck = validateEmail(formData.email);
    if (!emailCheck.isValid) {
      setErrorMessage(emailCheck.error);
      return;
    }

    setOtpSending(true);
    try {
      const res = await apiRequest('/api/auth/forgot-password/send-otp', {
        method: 'POST',
        body: JSON.stringify({
          username: formData.username.trim(),
          email: formData.email.trim(),
        }),
      });

      setOtpSent(true);
      setCountdown(60);
      showToast(res.message || 'Verification code sent to your email! ✉️');
    } catch (err) {
      setErrorMessage(err.message || 'Could not verify account details.');
      showToast(err.message || 'Verification code failed to send');
    } finally {
      setOtpSending(false);
    }
  };

  // Handle Verify OTP
  const handleVerifyOtp = async () => {
    setErrorMessage('');
    if (!formData.otp || formData.otp.trim().length !== 6) {
      setErrorMessage('Please enter the 6-digit verification code sent to your email.');
      return;
    }

    setOtpVerifying(true);
    try {
      const res = await apiRequest('/api/auth/forgot-password/verify-otp', {
        method: 'POST',
        body: JSON.stringify({
          email: formData.email.trim(),
          otp: formData.otp.trim(),
        }),
      });

      setOtpVerified(true);
      showToast(res.message || 'Code verified successfully! Please enter your new password.');
    } catch (err) {
      setErrorMessage(err.message || 'Invalid or expired verification code.');
      showToast(err.message || 'OTP verification failed');
    } finally {
      setOtpVerifying(false);
    }
  };

  // Handle Reset Password Submit
  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');

    if (!formData.username.trim() || !formData.email.trim()) {
      setErrorMessage('Please provide your username and email.');
      return;
    }
    if (!otpVerified) {
      setErrorMessage('Please verify your email address using the OTP code first.');
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
      const res = await apiRequest('/api/auth/forgot-password/reset', {
        method: 'POST',
        body: JSON.stringify({
          username: formData.username.trim(),
          email: formData.email.trim(),
          otp: formData.otp.trim(),
          password: formData.password,
          confirm_password: formData.confirm_password,
        }),
      });

      showToast(res.message || 'Password changed successfully! 🎉');
      navigate('/user', {
        state: {
          email: formData.email.trim(),
          successMessage: 'Password changed successfully! Please sign in with your new password.',
        },
      });
    } catch (err) {
      setErrorMessage(err.message || 'Failed to update password.');
      showToast(err.message || 'Password reset failed');
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
            className="text-sm font-bold text-slate-600 transition hover:text-coral dark:text-slate-300 dark:hover:text-coral flex items-center gap-1.5"
          >
            <span>←</span>
            <span>Back to Sign In</span>
          </Link>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="mx-auto grid min-h-[calc(100vh-5rem)] max-w-7xl items-center gap-8 lg:gap-12 px-4 sm:px-6 py-6 lg:py-10 lg:grid-cols-[1.1fr_0.9fr] lg:px-8 flex-1">
        {/* Left Hero Section */}
        <section className="hidden lg:flex flex-col justify-center space-y-6 pr-4">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-white/90 dark:bg-white/10 px-4 py-1.5 text-xs font-bold text-coral backdrop-blur border border-coral/20 shadow-sm">
              <span className="h-2 w-2 rounded-full bg-coral animate-pulse"></span>
              <span>Account Recovery &amp; Security</span>
            </div>
            <h1 className="mt-3 text-3xl sm:text-4xl lg:text-[2.65rem] font-black leading-[1.15] tracking-tight text-ink dark:text-white">
              Regain access to your <span className="text-coral">account &amp; tickets.</span>
            </h1>
            <p className="mt-3 text-sm sm:text-base leading-relaxed text-slate-600 dark:text-slate-300 max-w-lg">
              Don't worry — it happens! Verify your registered username and email address to safely create a new password and restore your access instantly.
            </p>
          </div>

          {/* 3-Step Interactive Process Timeline Card */}
          <div className="rounded-3xl border border-stone-200/80 bg-white/80 p-5 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-[#1c2733]/90 max-w-lg space-y-3.5">
            <p className="text-[11px] font-black uppercase tracking-wider text-slate-400">
              3-Step Fast Recovery Process
            </p>

            <div className="space-y-3">
              {/* Step 1 */}
              <div className="flex items-center gap-3.5">
                <div className={`grid h-8 w-8 shrink-0 place-items-center rounded-xl font-black text-xs transition ${
                  otpSent ? 'bg-emerald-500 text-white' : 'bg-coral/10 text-coral dark:bg-coral/20'
                }`}>
                  {otpSent ? '✓' : '1'}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-xs sm:text-sm font-bold text-ink dark:text-white">Enter Account Details</h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                    Matched against your verified database credentials.
                  </p>
                </div>
              </div>

              {/* Step 2 */}
              <div className="flex items-center gap-3.5">
                <div className={`grid h-8 w-8 shrink-0 place-items-center rounded-xl font-black text-xs transition ${
                  otpVerified ? 'bg-emerald-500 text-white' : otpSent ? 'bg-coral text-white animate-pulse' : 'bg-stone-100 text-slate-400 dark:bg-slate-800'
                }`}>
                  {otpVerified ? '✓' : '2'}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-xs sm:text-sm font-bold text-ink dark:text-white">Gmail OTP Verification</h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                    Instant 6-digit code delivered securely to your inbox.
                  </p>
                </div>
              </div>

              {/* Step 3 */}
              <div className="flex items-center gap-3.5">
                <div className={`grid h-8 w-8 shrink-0 place-items-center rounded-xl font-black text-xs transition ${
                  otpVerified ? 'bg-coral text-white shadow-md shadow-coral/30' : 'bg-stone-100 text-slate-400 dark:bg-slate-800'
                }`}>
                  3
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-xs sm:text-sm font-bold text-ink dark:text-white">Set New Strong Password</h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                    Encrypted with salted bcrypt hash for full protection.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Security Features Grid */}
          <div className="grid grid-cols-2 gap-3 max-w-lg">
            <div className="flex items-start gap-3 rounded-2xl border border-stone-200/70 bg-white/60 p-3 shadow-xs dark:border-slate-800 dark:bg-[#1c2733]/60">
              <span className="text-lg">🛡️</span>
              <div>
                <h5 className="text-xs font-bold text-ink dark:text-white">Zero Ticket Loss</h5>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">All bookings stay active</p>
              </div>
            </div>

            <div className="flex items-start gap-3 rounded-2xl border border-stone-200/70 bg-white/60 p-3 shadow-xs dark:border-slate-800 dark:bg-[#1c2733]/60">
              <span className="text-lg">🔒</span>
              <div>
                <h5 className="text-xs font-bold text-ink dark:text-white">Session Security</h5>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">Old sessions auto-cleared</p>
              </div>
            </div>
          </div>

          {/* Direct Support Redirect to Gmail Compose */}
          <div className="flex items-center justify-between gap-3 rounded-2xl bg-coral/10 dark:bg-slate-800/80 p-3.5 border border-coral/20 dark:border-slate-700 max-w-lg">
            <div className="flex items-center gap-2.5">
              <span className="text-base">💬</span>
              <span className="text-xs font-bold text-ink dark:text-white">
                Need extra assistance?
              </span>
            </div>
            <a
              href="https://mail.google.com/mail/?view=cm&fs=1&to=official.maxshow@gmail.com&su=MAXSHOW%20Account%20Recovery%20Assistance"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-bold text-coral hover:text-[#df503c] transition flex items-center gap-1 underline underline-offset-2"
              title="Open Gmail compose window"
            >
              <span>Contact Support</span>
              <span>→</span>
            </a>
          </div>
        </section>

        {/* Right Side Form Card */}
        <section className="mx-auto w-full max-w-md rounded-[2.5rem] bg-white p-6 sm:p-8 shadow-xl shadow-stone-300/30 dark:bg-[#1c2733] dark:border dark:border-slate-700">
          <p className="text-xs font-bold uppercase tracking-[.16em] text-coral">Security</p>
          <h2 className="mt-1 text-2xl sm:text-3xl font-black text-ink dark:text-white">Forgot password</h2>
          <p className="mt-1 text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            Follow the steps below to reset your account password.
          </p>

          {errorMessage && (
            <div className="mt-4 rounded-xl bg-red-50 p-3 text-xs font-bold text-red-600 dark:bg-red-950/50 dark:text-red-300 animate-fade-in border border-red-200 dark:border-red-800">
              ⚠️ {errorMessage}
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
            {/* Username Input */}
            <div>
              <label className="mb-1.5 block text-xs sm:text-sm font-bold text-ink dark:text-slate-200" htmlFor="username">
                Username *
              </label>
              <input
                id="username"
                type="text"
                disabled={otpVerified}
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                placeholder="e.g. maxlash"
                className="w-full rounded-xl border border-stone-300 px-4 py-2.5 sm:py-3 text-sm font-semibold outline-none transition focus:border-coral focus:ring-4 focus:ring-coral/20 dark:border-slate-700 dark:bg-[#101820] dark:text-white disabled:opacity-60"
                required
              />
            </div>

            {/* Email Address + Send OTP Button */}
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label className="text-xs sm:text-sm font-bold text-ink dark:text-slate-200" htmlFor="email">
                  Registered Email Address *
                </label>
                {otpVerified && (
                  <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                    ✓ Email Verified
                  </span>
                )}
              </div>
              <div className="flex gap-2">
                <input
                  id="email"
                  type="email"
                  disabled={otpVerified}
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="you@example.com"
                  className="flex-1 rounded-xl border border-stone-300 px-4 py-2.5 sm:py-3 text-sm font-semibold outline-none transition focus:border-coral focus:ring-4 focus:ring-coral/20 dark:border-slate-700 dark:bg-[#101820] dark:text-white disabled:opacity-60"
                  required
                />
                {!otpVerified && (
                  <button
                    type="button"
                    disabled={otpSending || countdown > 0 || !formData.email.trim() || !formData.username.trim()}
                    onClick={handleSendOtp}
                    className="rounded-xl bg-gradient-to-r from-coral to-orange-500 px-4 py-2.5 text-xs sm:text-sm font-black text-white shadow-md shadow-coral/20 hover:from-[#df503c] hover:to-orange-600 transition disabled:opacity-50 flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
                  >
                    {otpSending ? (
                      <>
                        <span className="h-3.5 w-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                        <span>Sending...</span>
                      </>
                    ) : countdown > 0 ? (
                      <span>Resend ({countdown}s)</span>
                    ) : otpSent ? (
                      <span>Resend OTP</span>
                    ) : (
                      <span>Send OTP</span>
                    )}
                  </button>
                )}
              </div>

              {/* Dynamic Domain Suggestions when typing @, @g, @y, @ou */}
              {matchingDomains.length > 0 && !otpVerified && (
                <div className="mt-2 flex items-center gap-1.5 flex-nowrap overflow-x-auto no-scrollbar animate-fade-in">
                  <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 shrink-0">Suggestions:</span>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {matchingDomains.map((domain) => (
                      <button
                        key={domain}
                        type="button"
                        onClick={() => handleDomainSelect(domain)}
                        className="rounded-lg bg-coral/10 hover:bg-coral text-coral hover:text-white border border-coral/30 px-2 py-1 text-[11px] font-bold transition-all shadow-sm active:scale-95 cursor-pointer whitespace-nowrap"
                      >
                        {domain}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* OTP Verification Card */}
            {otpSent && !otpVerified && (
              <div className="rounded-2xl border-2 border-coral/40 bg-gradient-to-br from-coral/5 to-orange-500/5 p-4 dark:border-coral/30 dark:bg-[#151f2b] space-y-3 animate-fade-in shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black uppercase tracking-wider text-coral">
                    Enter 6-Digit Code
                  </span>
                  <span className="text-[11px] text-slate-400 font-semibold">
                    Sent to Gmail
                  </span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-300">
                  Enter the verification code sent to <strong className="text-ink dark:text-white">{formData.email}</strong>.
                </p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    maxLength={6}
                    value={formData.otp}
                    onChange={(e) => setFormData({ ...formData, otp: e.target.value.replace(/\D/g, '') })}
                    placeholder="• • • • • •"
                    className="flex-1 rounded-xl border border-stone-300 dark:border-slate-700 bg-white dark:bg-[#101820] py-2.5 px-3 text-center font-mono text-lg font-black tracking-[0.3em] outline-none focus:border-coral focus:ring-4 focus:ring-coral/20 text-ink dark:text-white"
                    autoFocus
                  />
                  <button
                    type="button"
                    disabled={otpVerifying || formData.otp.length !== 6}
                    onClick={handleVerifyOtp}
                    className="rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-black text-white hover:bg-emerald-700 transition disabled:opacity-50 flex items-center gap-1.5 shadow-sm whitespace-nowrap cursor-pointer"
                  >
                    {otpVerifying ? 'Verifying...' : 'Verify OTP ✓'}
                  </button>
                </div>
              </div>
            )}

            {/* Step 2: New Password & Confirm Password (Unlocked after OTP) */}
            {otpVerified && (
              <div className="space-y-4 pt-1 animate-fade-in">
                {/* New Password */}
                <div>
                  <label className="mb-1.5 block text-xs sm:text-sm font-bold text-ink dark:text-slate-200" htmlFor="password">
                    New Password *
                  </label>
                  <div className="relative">
                    <input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      placeholder="Create strong password"
                      className="w-full rounded-xl border border-stone-300 px-4 py-2.5 sm:py-3 pr-11 text-sm font-semibold outline-none transition focus:border-coral focus:ring-4 focus:ring-coral/20 dark:border-slate-700 dark:bg-[#101820] dark:text-white"
                      required
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-ink dark:hover:text-white text-sm"
                      tabIndex={-1}
                    >
                      {showPassword ? '🙈' : '👁️'}
                    </button>
                  </div>
                </div>

                {/* Password Strength Checklist */}
                {formData.password && (
                  <div className="rounded-xl bg-stone-50 p-3 dark:bg-[#151f2b] border border-stone-200 dark:border-slate-800 text-[11px] space-y-1.5 animate-fade-in">
                    <p className="font-bold text-slate-500 dark:text-slate-400 text-[10px] uppercase tracking-wider">
                      Password Requirements:
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 font-medium">
                      <span className={reqLength ? 'text-emerald-600 font-bold' : 'text-slate-400'}>
                        {reqLength ? '✓' : '○'} 8+ characters
                      </span>
                      <span className={reqUpper ? 'text-emerald-600 font-bold' : 'text-slate-400'}>
                        {reqUpper ? '✓' : '○'} Uppercase letter (A-Z)
                      </span>
                      <span className={reqLower ? 'text-emerald-600 font-bold' : 'text-slate-400'}>
                        {reqLower ? '✓' : '○'} Lowercase letter (a-z)
                      </span>
                      <span className={reqNumber ? 'text-emerald-600 font-bold' : 'text-slate-400'}>
                        {reqNumber ? '✓' : '○'} Number (0-9)
                      </span>
                      <span className={reqSpecial ? 'text-emerald-600 font-bold sm:col-span-2' : 'text-slate-400 sm:col-span-2'}>
                        {reqSpecial ? '✓' : '○'} Special character (!@#$%^&*)
                      </span>
                    </div>
                  </div>
                )}

                {/* Confirm Password */}
                <div>
                  <label className="mb-1.5 block text-xs sm:text-sm font-bold text-ink dark:text-slate-200" htmlFor="confirm_password">
                    Confirm New Password *
                  </label>
                  <div className="relative">
                    <input
                      id="confirm_password"
                      type={showConfirmPassword ? 'text' : 'password'}
                      value={formData.confirm_password}
                      onChange={(e) => setFormData({ ...formData, confirm_password: e.target.value })}
                      placeholder="Re-enter new password"
                      className="w-full rounded-xl border border-stone-300 px-4 py-2.5 sm:py-3 pr-11 text-sm font-semibold outline-none transition focus:border-coral focus:ring-4 focus:ring-coral/20 dark:border-slate-700 dark:bg-[#101820] dark:text-white"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-ink dark:hover:text-white text-sm"
                      tabIndex={-1}
                    >
                      {showConfirmPassword ? '🙈' : '👁️'}
                    </button>
                  </div>
                  {formData.confirm_password && (
                    <p className={`mt-1 text-xs font-bold ${formData.password === formData.confirm_password ? 'text-emerald-600' : 'text-red-500'}`}>
                      {formData.password === formData.confirm_password ? '✓ Passwords match' : '✗ Passwords do not match'}
                    </p>
                  )}
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={submitting || !allReqsMet || formData.password !== formData.confirm_password}
                  className="w-full rounded-2xl bg-coral py-3 px-4 font-black text-white shadow-lg shadow-coral/25 hover:bg-[#df503c] transition disabled:opacity-50 cursor-pointer text-sm sm:text-base mt-2"
                >
                  {submitting ? 'Updating Password...' : 'Update Password →'}
                </button>
              </div>
            )}
          </form>

          {/* Bottom Help & Sign in links */}
          <div className="mt-6 border-t border-stone-200 pt-5 space-y-2 text-center text-xs sm:text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
            <div>
              Remembered your password?{' '}
              <Link to="/user" className="font-bold text-coral hover:underline">
                Sign in
              </Link>
            </div>
            <div>
              <a
                href="https://mail.google.com/mail/?view=cm&fs=1&to=official.maxshow@gmail.com&su=MAXSHOW%20Account%20Recovery%20Assistance"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-semibold text-slate-400 hover:text-coral transition underline underline-offset-2"
              >
                Having trouble? Contact Support
              </a>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-stone-200/80 bg-white/50 py-6 text-center text-xs font-semibold text-slate-400 dark:border-slate-800 dark:bg-[#101820]">
        MAXSHOW © 2026 · Secure Password Reset
      </footer>
    </div>
  );
};
