import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { apiRequest } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { validateIndianMobile, validateEmail } from '../utils/formatters';

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

  // Email SMTP OTP states
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

  // Email OTP Countdown timer
  useEffect(() => {
    if (otpTimer > 0) {
      timerRef.current = setTimeout(() => {
        setOtpTimer((prev) => prev - 1);
      }, 1000);
    }
    return () => clearTimeout(timerRef.current);
  }, [otpTimer]);

  // Email validation state
  const emailValidation = validateEmail(formData.email);
  const isEmailValid = emailValidation.isValid;

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

  // Password requirements calculation
  const p = formData.password;
  const reqLength = p.length >= 8;
  const reqUpper = /[A-Z]/.test(p);
  const reqLower = /[a-z]/.test(p);
  const reqNum = /[0-9]/.test(p);
  const reqSpec = /[^A-Za-z0-9]/.test(p);
  const metCount = [reqLength, reqUpper, reqLower, reqNum, reqSpec].filter(Boolean).length;
  const allReqsMet = metCount === 5;

  // Send Email OTP via Gmail SMTP
  const handleSendOtp = async () => {
    if (!formData.email.trim()) {
      setOtpStatusMsg('Please enter your email address first.');
      setOtpStatusType('error');
      showToast('Please enter your email address');
      return;
    }

    const emailCheck = validateEmail(formData.email);
    if (!emailCheck.isValid) {
      setOtpStatusMsg(`⚠️ ${emailCheck.error}`);
      setOtpStatusType('error');
      showToast(emailCheck.error);
      return;
    }

    setSendingOtp(true);
    setOtpStatusMsg('Sending verification code via Gmail...');
    setOtpStatusType('info');

    try {
      const res = await apiRequest('/api/auth/send-otp', {
        method: 'POST',
        body: JSON.stringify({ email: formData.email.trim() }),
      });

      setOtpSent(true);
      setOtpTimer(60); // 60 seconds countdown
      setOtpStatusMsg(`✓ Verification code sent to ${formData.email.trim()}. Please check your inbox (and Spam folder).`);
      setOtpStatusType('success');
      showToast('Verification code sent to your email!');
    } catch (err) {
      setOtpStatusMsg(`⚠️ ${err.message || 'Failed to send verification code. Please try again.'}`);
      setOtpStatusType('error');
      showToast(err.message || 'Failed to send OTP');
    } finally {
      setSendingOtp(false);
    }
  };

  // Verify Email OTP
  const handleVerifyOtp = async () => {
    if (!formData.otp || formData.otp.trim().length !== 6) {
      setOtpStatusMsg('Please enter the 6-digit OTP code.');
      setOtpStatusType('error');
      return;
    }

    setVerifyingOtp(true);
    setOtpStatusMsg('Verifying code...');
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
      setOtpStatusMsg('✓ Email verified successfully!');
      setOtpStatusType('success');
      showToast('Email verified successfully! 🎉');
    } catch (err) {
      setOtpStatusMsg(`⚠️ ${err.message || 'Invalid or expired OTP code.'}`);
      setOtpStatusType('error');
      showToast(err.message || 'Invalid OTP code');
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
      setErrorMessage('Please enter your email address.');
      return;
    }
    const emailCheck = validateEmail(formData.email);
    if (!emailCheck.isValid) {
      setErrorMessage(emailCheck.error);
      showToast(emailCheck.error);
      return;
    }
    if (!otpVerified) {
      setErrorMessage('Please verify your email address with the OTP code first.');
      showToast('Please verify your email with OTP first');
      return;
    }
    if (!formData.phone.trim()) {
      setErrorMessage('Please enter your 10-digit mobile number.');
      return;
    }
    const phoneValidation = validateIndianMobile(formData.phone);
    if (!phoneValidation.isValid) {
      setErrorMessage(phoneValidation.error);
      showToast(phoneValidation.error);
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
          mobile: formData.phone.trim(),
          phone: formData.phone.trim(),
          otp: formData.otp.trim(),
          password: formData.password,
          confirm_password: formData.confirm_password,
        }),
      });

      showToast('Account created successfully! Please sign in to continue. 🎉');
      navigate('/user', {
        state: {
          email: formData.email.trim(),
          successMessage: 'Account created successfully! Please enter your password to sign in.',
        },
      });
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
                🛡️
              </div>
              <div>
                <h2 className="text-xs sm:text-sm font-black text-ink dark:text-white">Verified &amp; Secure Accounts</h2>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  Instant email OTP verification ensures 100% spam-free ticket deliveries and real bookings.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Right Side Registration Form */}
        <section className="mx-auto w-full max-w-xl rounded-[2rem] bg-white p-6 sm:p-7 shadow-xl shadow-stone-300/30 dark:bg-[#1c2733] dark:border dark:border-slate-700">
          <p className="text-xs font-bold uppercase tracking-[.16em] text-coral">Start exploring</p>
          <h2 className="mt-1 text-2xl sm:text-3xl font-black text-ink dark:text-white">Create your account</h2>
          <p className="mt-1 text-xs sm:text-sm text-slate-500 dark:text-slate-400">A few quick details and you’re ready to book.</p>

          {errorMessage && (
            <div className="mt-4 rounded-xl bg-red-50 p-3 text-xs font-bold text-red-600 dark:bg-red-950/50 dark:text-red-300">
              ⚠️ {errorMessage}
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-5 grid gap-4 sm:grid-cols-2">
            {/* Full Name */}
            <div>
              <label className="mb-1 block text-xs font-bold text-ink dark:text-slate-200" htmlFor="full_name">
                Full name *
              </label>
              <input
                id="full_name"
                type="text"
                value={formData.full_name}
                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                placeholder="e.g. Rahul Sharma"
                className="w-full rounded-xl border border-stone-300 bg-white px-3.5 py-2.5 text-sm font-semibold outline-none transition focus:border-coral focus:ring-4 focus:ring-coral/20 dark:border-slate-700 dark:bg-[#101820] dark:text-white"
                required
              />
            </div>

            {/* Username */}
            <div>
              <label className="mb-1 block text-xs font-bold text-ink dark:text-slate-200" htmlFor="username">
                Username *
              </label>
              <input
                id="username"
                type="text"
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                placeholder="e.g. rahul_99"
                maxLength={30}
                className="w-full rounded-xl border border-stone-300 bg-white px-3.5 py-2.5 text-sm font-semibold outline-none transition focus:border-coral focus:ring-4 focus:ring-coral/20 dark:border-slate-700 dark:bg-[#101820] dark:text-white"
                required
              />
            </div>

            {/* Email Address with Send OTP */}
            <div className="sm:col-span-2 space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold text-ink dark:text-slate-200" htmlFor="email">
                  Email address *
                </label>
                {otpVerified ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 px-3 py-1 text-xs font-bold text-emerald-600 dark:text-emerald-400 shadow-sm animate-fade-in">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                    ✓ Email Verified
                  </span>
                ) : formData.email ? (
                  <span className="text-[11px] font-semibold text-slate-400">
                    {emailValidation.localPart ? `${emailValidation.localPart.length}/30 username chars` : `${formData.email.length} chars`}
                  </span>
                ) : null}
              </div>

              <div className="relative flex items-stretch gap-2">
                <div className="relative flex-1">
                  <input
                    id="email"
                    type="email"
                    value={formData.email}
                    disabled={otpVerified}
                    onChange={(e) => {
                      setFormData({ ...formData, email: e.target.value });
                      if (otpVerified) setOtpVerified(false);
                      if (otpSent) setOtpSent(false);
                    }}
                    placeholder="you@example.com"
                    className={`w-full rounded-2xl border px-4 py-3 text-sm font-semibold outline-none transition focus:ring-4 bg-white dark:bg-[#101820] dark:text-white ${
                      otpVerified
                        ? 'border-emerald-500/50 bg-emerald-500/5 text-emerald-950 dark:border-emerald-500/40 dark:bg-emerald-950/20 dark:text-emerald-200 cursor-not-allowed'
                        : formData.email.length > 0
                        ? isEmailValid
                          ? 'border-emerald-500 focus:border-emerald-500 focus:ring-emerald-500/20'
                          : 'border-red-500 focus:border-red-500 focus:ring-red-500/20'
                        : 'border-stone-300 focus:border-coral focus:ring-coral/20 dark:border-slate-700'
                    }`}
                    required
                  />
                  {otpVerified ? (
                    <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-emerald-500 font-bold text-base">
                      ✓
                    </span>
                  ) : formData.email.length > 0 && isEmailValid ? (
                    <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-emerald-500 font-bold text-base">
                      ✓
                    </span>
                  ) : null}
                </div>

                {!otpVerified && (
                  <button
                    type="button"
                    onClick={handleSendOtp}
                    disabled={sendingOtp || otpTimer > 0 || !formData.email || !isEmailValid}
                    className={`shrink-0 rounded-2xl px-5 py-3 text-xs sm:text-sm font-bold transition-all flex items-center gap-1.5 select-none ${
                      sendingOtp || otpTimer > 0 || !formData.email || !isEmailValid
                        ? 'bg-stone-200 dark:bg-slate-800 text-stone-400 dark:text-slate-500 border border-stone-300 dark:border-slate-700 cursor-not-allowed'
                        : 'bg-gradient-to-r from-coral to-[#ff6b57] hover:from-[#e04f3b] hover:to-[#ff523d] text-white shadow-md shadow-coral/25 hover:shadow-lg hover:shadow-coral/35 active:scale-95 cursor-pointer'
                    }`}
                  >
                    {sendingOtp ? (
                      <>
                        <span className="h-3.5 w-3.5 rounded-full border-2 border-white/40 border-t-white animate-spin"></span>
                        <span>Sending...</span>
                      </>
                    ) : otpTimer > 0 ? (
                      <>
                        <span>⏳</span>
                        <span>Resend ({otpTimer}s)</span>
                      </>
                    ) : otpSent ? (
                      <>
                        <span>🔄</span>
                        <span>Resend OTP</span>
                      </>
                    ) : (
                      <>
                        <span>✉️</span>
                        <span>Send OTP</span>
                      </>
                    )}
                  </button>
                )}
              </div>

              {/* Dynamic Domain Suggestions when typing @, @g, @y, @ou */}
              {matchingDomains.length > 0 && !otpVerified && (
                <div className="flex items-center gap-1.5 flex-nowrap overflow-x-auto no-scrollbar pt-0.5 animate-fade-in">
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

              {formData.email.length > 0 && !otpVerified && (
                <p
                  className={`text-xs font-semibold ${
                    isEmailValid ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'
                  }`}
                >
                  {isEmailValid ? '✓ Valid email address' : `⚠️ ${emailValidation.error}`}
                </p>
              )}

              {/* Status Message */}
              <div
                className={`flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium transition-all ${
                  otpStatusType === 'success'
                    ? 'bg-emerald-500/10 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-500/20'
                    : otpStatusType === 'error'
                    ? 'bg-red-500/10 text-red-600 dark:bg-red-950/40 dark:text-red-300 border border-red-500/20 font-semibold'
                    : 'bg-stone-100 text-slate-600 dark:bg-slate-800/60 dark:text-slate-400'
                }`}
              >
                <span>{otpStatusType === 'success' ? '✓' : otpStatusType === 'error' ? '⚠️' : '💡'}</span>
                <span className="leading-snug">{otpStatusMsg}</span>
              </div>

              {/* Email OTP Verification Input Box */}
              {otpSent && !otpVerified && (
                <div className="mt-2.5 rounded-2xl border border-coral/30 bg-gradient-to-br from-coral/10 via-amber-500/5 to-transparent p-4 dark:border-coral/40 dark:from-[#2c1d22] dark:to-[#1a232e] shadow-md shadow-coral/5 backdrop-blur-sm animate-fade-in">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-coral animate-ping"></span>
                      <label className="text-xs font-black uppercase tracking-wider text-coral">
                        Enter 6-Digit Email OTP
                      </label>
                    </div>
                    <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                      Check Gmail inbox &amp; Spam
                    </span>
                  </div>

                  <div className="flex items-center gap-2.5">
                    <div className="relative flex-1">
                      <input
                        type="text"
                        inputMode="numeric"
                        maxLength={6}
                        value={formData.otp}
                        onChange={(e) => {
                          const digitsOnly = e.target.value.replace(/\D/g, '').slice(0, 6);
                          setFormData({ ...formData, otp: digitsOnly });
                        }}
                        placeholder="••••••"
                        className="w-full rounded-xl border-2 border-coral/40 bg-white px-4 py-2.5 text-center text-lg font-mono font-black tracking-[0.5em] text-ink outline-none transition focus:border-coral focus:ring-4 focus:ring-coral/20 dark:bg-[#101820] dark:text-white dark:border-coral/50 shadow-inner"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={handleVerifyOtp}
                      disabled={verifyingOtp || formData.otp.length !== 6}
                      className="shrink-0 rounded-xl bg-gradient-to-r from-coral to-[#ff6b57] px-5 py-2.5 text-xs sm:text-sm font-bold text-white transition-all hover:from-[#e04f3b] hover:to-[#ff523d] shadow-md shadow-coral/25 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {verifyingOtp ? 'Verifying...' : '✓ Verify Code'}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Mobile Number */}
            <div className="sm:col-span-2 space-y-1">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold text-ink dark:text-slate-200" htmlFor="phone">
                  Mobile number *
                </label>
                {formData.phone ? (
                  <span className="text-[11px] font-semibold text-slate-400">
                    {formData.phone.length}/10 digits
                  </span>
                ) : null}
              </div>

              <div className="relative">
                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 select-none">
                  +91
                </div>
                <input
                  id="phone"
                  type="tel"
                  inputMode="numeric"
                  required
                  value={formData.phone}
                  onChange={(e) => {
                    const digitsOnly = e.target.value.replace(/\D/g, '').slice(0, 10);
                    setFormData({ ...formData, phone: digitsOnly });
                  }}
                  placeholder="10-digit mobile number (e.g. 9876543210)"
                  maxLength={10}
                  className={`w-full rounded-xl border pl-12 pr-3.5 py-2.5 text-sm font-semibold outline-none transition focus:ring-4 bg-white dark:bg-[#101820] dark:text-white ${
                    formData.phone.length === 10
                      ? validateIndianMobile(formData.phone).isValid
                        ? 'border-emerald-500 focus:border-emerald-500 focus:ring-emerald-500/20'
                        : 'border-red-500 focus:border-red-500 focus:ring-red-500/20'
                      : formData.phone.length > 0 && !/^[6-9]/.test(formData.phone)
                      ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20'
                      : 'border-stone-300 focus:border-coral focus:ring-coral/20 dark:border-slate-700'
                  }`}
                />
                {formData.phone.length === 10 && validateIndianMobile(formData.phone).isValid && (
                  <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-emerald-500 font-bold text-base">
                    ✓
                  </span>
                )}
              </div>

              {formData.phone.length > 0 && (
                <p
                  className={`text-xs font-semibold mt-1 ${
                    formData.phone.length === 10 && validateIndianMobile(formData.phone).isValid
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-red-500'
                  }`}
                >
                  {formData.phone.length === 10
                    ? validateIndianMobile(formData.phone).isValid
                      ? '✓ Valid 10-digit mobile number'
                      : validateIndianMobile(formData.phone).error
                    : !/^[6-9]/.test(formData.phone)
                    ? '⚠️ Mobile number must start with 6, 7, 8, or 9.'
                    : `Please enter all 10 digits (${formData.phone.length}/10 entered)`}
                </p>
              )}
            </div>

            {/* Password */}
            <div>
              <label className="mb-1 block text-xs font-bold text-ink dark:text-slate-200" htmlFor="password">
                Password *
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder="Create password"
                  className="w-full rounded-xl border border-stone-300 bg-white px-3.5 py-2.5 pr-10 text-sm font-semibold outline-none transition focus:border-coral focus:ring-4 focus:ring-coral/20 dark:border-slate-700 dark:bg-[#101820] dark:text-white"
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
                Confirm password *
              </label>
              <div className="relative">
                <input
                  id="confirm_password"
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={formData.confirm_password}
                  onChange={(e) => setFormData({ ...formData, confirm_password: e.target.value })}
                  placeholder="Confirm password"
                  className="w-full rounded-xl border border-stone-300 bg-white px-3.5 py-2.5 pr-10 text-sm font-semibold outline-none transition focus:border-coral focus:ring-4 focus:ring-coral/20 dark:border-slate-700 dark:bg-[#101820] dark:text-white"
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
            <div className="sm:col-span-2 rounded-2xl bg-stone-50 dark:bg-[#151f2b] p-3.5 border border-stone-200 dark:border-slate-700 text-xs">
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
                disabled={submitting || !otpVerified}
                type="submit"
                className="w-full rounded-2xl bg-coral px-5 py-3 text-sm sm:text-base font-bold text-white transition hover:bg-[#df503c] shadow-lg shadow-coral/25 disabled:opacity-50"
              >
                {submitting ? 'Creating account...' : !otpVerified ? 'Verify Email with OTP to continue' : 'Create account & explore'}
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
