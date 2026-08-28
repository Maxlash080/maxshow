import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Navbar } from '../components/Navbar';
import { Footer } from '../components/Footer';
import { apiRequest } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useConfirmModal } from '../context/ModalContext';
import { formatPrice, formatEventTime, validateIndianMobile } from '../utils/formatters';
import { useLockBodyScroll } from '../utils/useLockBodyScroll';

export const UserDashboard = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isAuthenticated, loading: authLoading, refreshAuth, logout, toggleBookmark } = useAuth();
  const { showToast } = useToast();
  const { showConfirmModal } = useConfirmModal();

  const tabParam = new URLSearchParams(location.search).get('tab');
  const [activeTab, setActiveTab] = useState(tabParam === 'bookmarks' ? 'bookmarks' : 'bookings');

  const [bookings, setBookings] = useState([]);
  const [bookmarks, setBookmarks] = useState([]);
  const [loadingData, setLoadingData] = useState(true);

  // Selected Booking for QR Modal
  const [selectedBooking, setSelectedBooking] = useState(null);

  // Edit Profile Modal
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);

  // Lock background scrolling when any modal is open
  useLockBodyScroll(Boolean(selectedBooking || isEditProfileOpen));
  const [profileForm, setProfileForm] = useState({
    name: '',
    username: '',
    phone: '',
    password: '',
  });
  const [savingProfile, setSavingProfile] = useState(false);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigate('/user');
    }
  }, [authLoading, isAuthenticated, navigate]);

  const loadUserData = useCallback(async () => {
    try {
      setLoadingData(true);
      try {
        const data = await apiRequest('/api/user/dashboard');
        if (data && (data.bookings || data.bookmarks)) {
          setBookings(data.bookings || []);
          setBookmarks(data.bookmarks || []);
          return;
        }
      } catch (_) {}

      // Fallback to direct endpoints
      const [bookingsRes, bookmarksRes] = await Promise.all([
        apiRequest('/api/bookings').catch(() => ({ bookings: [] })),
        apiRequest('/api/bookmarks').catch(() => ({ bookmarks: [] })),
      ]);
      setBookings(bookingsRes?.bookings || []);
      setBookmarks(bookmarksRes?.bookmarks || []);
    } catch (_) {
    } finally {
      setLoadingData(false);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      loadUserData();
    }
  }, [isAuthenticated, loadUserData]);

  useEffect(() => {
    if (user) {
      setProfileForm({
        name: user.name || '',
        username: user.username || '',
        phone: user.phone || '',
        password: '',
      });
    }
  }, [user]);

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    if (profileForm.phone.trim()) {
      const phoneValidation = validateIndianMobile(profileForm.phone);
      if (!phoneValidation.isValid) {
        showToast(phoneValidation.error);
        return;
      }
    }
    setSavingProfile(true);
    try {
      const payload = {
        name: profileForm.name.trim(),
        username: profileForm.username.trim(),
        phone: profileForm.phone.trim(),
      };
      if (profileForm.password) payload.password = profileForm.password;

      await apiRequest('/api/user/profile', {
        method: 'PUT',
        body: JSON.stringify(payload),
      });

      showToast('Profile updated successfully! ✨');
      setIsEditProfileOpen(false);
      await refreshAuth();
    } catch (err) {
      showToast(err.message || 'Failed to update profile');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleDeleteAccount = async () => {
    const confirmed = await showConfirmModal({
      title: 'Delete Your Account?',
      message: 'Are you sure you want to permanently delete your MAXSHOW account? All your digital tickets and reservations will be cancelled.',
      icon: '⚠️',
      confirmText: 'Delete Account',
      type: 'danger',
    });
    if (!confirmed) return;

    try {
      await apiRequest('/api/user/account', { method: 'DELETE' });
      showToast('Account deleted. We are sorry to see you go.');
      await logout();
      navigate('/');
    } catch (err) {
      showToast(err.message || 'Failed to delete account');
    }
  };

  const handleLogout = async () => {
    const confirmed = await showConfirmModal({
      title: 'Log Out of MAXSHOW?',
      message: 'Are you sure you want to sign out of your account?',
      icon: '🚪',
      confirmText: 'Log Out',
      cancelText: 'Cancel',
      type: 'danger',
    });
    if (!confirmed) return;

    await logout();
    navigate('/');
  };

  const handleShareTicket = async (booking) => {
    if (!booking) return;
    const code = booking.booking_code || `BKG-${booking.id}`;
    const title = booking.title || booking.event_title || 'Event';
    const loc = booking.location || booking.venue || '';
    const time = formatEventTime(booking.time || '', booking.day);
    const ticketsCount = booking.tickets || booking.quantity || 1;
    const isFree = Number(booking.total ?? booking.total_amount ?? 0) === 0 || booking.payment_status === 'Free Entry';
    const totalText = isFree ? 'Free entry' : formatPrice(booking.total ?? booking.total_amount ?? 0);
    const eventUrl = window.location.origin + `/event/${encodeURIComponent(booking.event_slug || booking.slug || '')}`;

    const shareText = `🎟️ MAXSHOW Digital Ticket\n\n🎪 Event: ${title}\n🎫 Booking Ref: #${code}\n📍 Location: ${loc}\n🕒 Date/Time: ${time}\n👥 Reserved: ${ticketsCount} Ticket${ticketsCount > 1 ? 's' : ''}\n💰 Total: ${totalText}\n\n👉 View Experience: ${eventUrl}`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: `🎟️ Ticket for ${title} - MAXSHOW`,
          text: shareText,
          url: eventUrl,
        });
        showToast('Ticket shared successfully! 🚀');
        return;
      } catch (err) {
        if (err.name === 'AbortError') return;
      }
    }

    // Fallback: Copy to clipboard
    try {
      await navigator.clipboard.writeText(shareText);
      showToast('Ticket details copied to clipboard! 📋');
    } catch (_) {
      showToast('Could not copy ticket details.');
    }
  };

  const handleWhatsAppShare = (booking) => {
    if (!booking) return;
    const code = booking.booking_code || `BKG-${booking.id}`;
    const title = booking.title || booking.event_title || 'Event';
    const loc = booking.location || booking.venue || '';
    const time = formatEventTime(booking.time || '', booking.day);
    const ticketsCount = booking.tickets || booking.quantity || 1;
    const isFree = Number(booking.total ?? booking.total_amount ?? 0) === 0 || booking.payment_status === 'Free Entry';
    const totalText = isFree ? 'Free entry' : formatPrice(booking.total ?? booking.total_amount ?? 0);
    const eventUrl = window.location.origin + `/event/${encodeURIComponent(booking.event_slug || booking.slug || '')}`;

    const text = `🎟️ *MAXSHOW Digital Ticket*\n\n🎪 *Event:* ${title}\n🎫 *Booking Code:* #${code}\n📍 *Venue:* ${loc}\n🕒 *Time:* ${time}\n👥 *Tickets:* ${ticketsCount} Ticket${ticketsCount > 1 ? 's' : ''}\n💰 *Total:* ${totalText}\n\n👉 *View on MAXSHOW:* ${eventUrl}`;

    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank');
  };

  const handleCopyCode = (code) => {
    navigator.clipboard.writeText(code).then(
      () => showToast(`Booking code #${code} copied! 📋`),
      () => showToast('Failed to copy code')
    );
  };

  const initial = user?.name?.trim()?.charAt(0)?.toUpperCase() || 'U';
  const fullName = user?.name?.trim() || 'User';

  const getTimeGreeting = () => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return { text: 'Good morning', icon: '🌅' };
    if (hour >= 12 && hour < 17) return { text: 'Good afternoon', icon: '☀️' };
    if (hour >= 17 && hour < 22) return { text: 'Good evening', icon: '🌆' };
    return { text: 'Good evening', icon: '🌙' };
  };

  const timeGreeting = getTimeGreeting();

  return (
    <div className="min-h-screen bg-cream text-ink dark:bg-[#101820] dark:text-white flex flex-col">
      <Navbar />

      <main className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-8 space-y-8 flex-1">
        {/* Welcome & Profile Card */}
        <section className="rounded-3xl bg-white p-6 sm:p-8 shadow-soft dark:bg-[#1c2733] border border-stone-200/80 dark:border-slate-700/80">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            {/* User Info & Greeting */}
            <div className="flex items-start sm:items-center gap-4 sm:gap-5">
              <div className="relative grid h-16 w-16 sm:h-20 sm:w-20 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-coral to-amber-500 text-2xl sm:text-3xl font-black text-white shadow-md shadow-coral/20 ring-4 ring-coral/10">
                {initial}
              </div>

              <div className="space-y-1">
                {/* Eyebrow: Greeting */}
                <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-coral">
                  <span className="text-sm">{timeGreeting.icon}</span>
                  <span>{timeGreeting.text}</span>
                </div>

                {/* Full Name */}
                <h1 className="text-2xl sm:text-3xl font-black text-ink dark:text-white tracking-tight">
                  Hello, {fullName}
                </h1>

                {/* Structured Metadata Pills */}
                <div className="flex flex-wrap items-center gap-2 pt-0.5 text-xs font-medium text-slate-500 dark:text-slate-400">
                  {user?.username && (
                    <span className="inline-flex items-center gap-1 rounded-lg bg-stone-100 dark:bg-[#101820] px-2.5 py-1 text-slate-700 dark:text-slate-300 font-semibold">
                      <span className="text-coral">@</span>
                      <span>{user.username}</span>
                    </span>
                  )}
                  {user?.email && (
                    <span className="inline-flex items-center gap-1.5 rounded-lg bg-stone-100 dark:bg-[#101820] px-2.5 py-1 text-slate-700 dark:text-slate-300">
                      <span>✉️</span>
                      <span>{user.email}</span>
                    </span>
                  )}
                  {user?.phone && (
                    <span className="inline-flex items-center gap-1.5 rounded-lg bg-stone-100 dark:bg-[#101820] px-2.5 py-1 text-slate-700 dark:text-slate-300">
                      <span>📞</span>
                      <span>{user.phone}</span>
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center gap-2.5 shrink-0 pt-2 lg:pt-0 border-t lg:border-t-0 border-stone-100 dark:border-slate-700/50">
              <button
                onClick={() => setIsEditProfileOpen(true)}
                type="button"
                className="flex items-center gap-1.5 rounded-xl border border-stone-300 bg-white px-4 py-2.5 text-xs sm:text-sm font-bold text-ink transition-all hover:border-coral hover:text-coral hover:shadow-sm dark:border-slate-700 dark:bg-[#101820] dark:text-white dark:hover:border-coral"
              >
                <span>✏️</span>
                <span>Edit Profile</span>
              </button>
              <button
                onClick={handleLogout}
                type="button"
                className="flex items-center gap-1.5 rounded-xl border border-stone-300 bg-white px-4 py-2.5 text-xs sm:text-sm font-bold text-slate-600 transition-all hover:border-stone-400 hover:text-ink dark:border-slate-700 dark:bg-[#101820] dark:text-slate-300 dark:hover:text-white"
              >
                <span>🚪</span>
                <span>Log out</span>
              </button>
              <button
                onClick={handleDeleteAccount}
                type="button"
                className="flex items-center gap-1 rounded-xl px-3 py-2.5 text-xs sm:text-sm font-bold text-red-500 transition-all hover:bg-red-500/10 hover:text-red-600 dark:text-red-400 dark:hover:bg-red-950/30"
                title="Delete Account"
              >
                <span>🗑️</span>
                <span>Delete Account</span>
              </button>
            </div>
          </div>
        </section>

        {/* Tab Navigation */}
        <div className="flex items-center gap-3 border-b border-stone-200 dark:border-slate-700 pb-3">
          <button
            onClick={() => setActiveTab('bookings')}
            className={`rounded-2xl px-5 py-2.5 text-xs sm:text-sm font-bold transition flex items-center gap-2 ${
              activeTab === 'bookings'
                ? 'bg-coral text-white shadow-md'
                : 'bg-white text-slate-600 hover:bg-stone-100 dark:bg-[#1c2733] dark:text-slate-300 dark:hover:bg-slate-800'
            }`}
          >
            <span>🎟️</span>
            <span>My Bookings ({bookings.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('bookmarks')}
            className={`rounded-2xl px-5 py-2.5 text-xs sm:text-sm font-bold transition flex items-center gap-2 ${
              activeTab === 'bookmarks'
                ? 'bg-coral text-white shadow-md'
                : 'bg-white text-slate-600 hover:bg-stone-100 dark:bg-[#1c2733] dark:text-slate-300 dark:hover:bg-slate-800'
            }`}
          >
            <span>🔖</span>
            <span>Saved Bookmarks ({bookmarks.length})</span>
          </button>
        </div>

        {/* TAB 1: My Bookings */}
        {activeTab === 'bookings' && (
          <section className="space-y-4">
            {bookings.length === 0 ? (
              <div className="rounded-[2.5rem] bg-white p-12 text-center shadow-soft dark:bg-[#1c2733] border border-stone-200/80 dark:border-slate-700">
                <span className="text-4xl">🎟️</span>
                <h3 className="mt-3 text-lg font-black text-ink dark:text-white">No upcoming reservations yet</h3>
                <p className="mt-1 text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                  Ready for your next good plan? Explore experiences happening around you.
                </p>
                <Link
                  to="/"
                  className="mt-5 inline-block rounded-2xl bg-coral px-6 py-3 text-xs sm:text-sm font-bold text-white shadow-md hover:bg-[#df503c] transition"
                >
                  Explore Top Picks →
                </Link>
              </div>
            ) : (
              <div className="space-y-4">
                {bookings.map((b) => {
                  const isFree = Number(b.total ?? b.total_amount ?? 0) === 0 || b.payment_status === 'Free Entry';
                  const timeFormatted = formatEventTime(b.time || '');
                  return (
                    <article
                      key={b.id || b.booking_code}
                      onClick={() => setSelectedBooking(b)}
                      className="group cursor-pointer overflow-hidden rounded-3xl bg-white p-5 shadow-sm hover:shadow-md transition-all duration-200 hover:border-coral/50 dark:bg-[#1c2733] border border-stone-200 dark:border-slate-700"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                          {b.event_image && (
                            <img
                              src={b.event_image}
                              alt="Event cover"
                              className="h-16 w-16 rounded-2xl object-cover shrink-0 group-hover:scale-105 transition duration-200"
                            />
                          )}
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 px-2.5 py-0.5 text-xs font-black">
                                Confirmed
                              </span>
                              <span className="font-mono text-xs font-bold text-coral">
                                #{b.booking_code || `BKG-${b.id}`}
                              </span>
                            </div>
                            <h3 className="mt-1 text-lg font-black text-ink dark:text-white group-hover:text-coral transition">
                              {b.title || b.event_title || 'Event'}
                            </h3>
                            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-300">
                              📍 {b.location || ''} {timeFormatted ? `· 🕒 ${timeFormatted}` : ''}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center justify-between sm:justify-end gap-3 sm:gap-4 border-t sm:border-t-0 pt-3 sm:pt-0 border-stone-100 dark:border-slate-700">
                          <div className="text-left sm:text-right">
                            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Reserved</p>
                            <p className="font-black text-ink dark:text-white text-base">
                              {b.tickets || b.quantity || 1} ticket{(b.tickets || b.quantity || 1) === 1 ? '' : 's'}
                            </p>
                            <p className="text-sm font-black text-coral">
                              {isFree ? 'Free entry' : formatPrice(b.total ?? b.total_amount ?? 0)}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleShareTicket(b);
                              }}
                              type="button"
                              className="grid h-9 w-9 place-items-center rounded-xl bg-stone-100 text-slate-600 hover:bg-coral hover:text-white transition dark:bg-slate-800 dark:text-slate-300 shadow-sm"
                              title="Share Ticket"
                            >
                              <span className="text-sm">📤</span>
                            </button>
                            <div className="grid h-9 w-9 place-items-center rounded-xl bg-stone-100 text-slate-500 group-hover:bg-coral group-hover:text-white transition dark:bg-slate-800 dark:text-slate-300">
                              →
                            </div>
                          </div>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {/* TAB 2: Saved Bookmarks */}
        {activeTab === 'bookmarks' && (
          <section className="space-y-4">
            {bookmarks.length === 0 ? (
              <div className="rounded-[2.5rem] bg-white p-12 text-center shadow-soft dark:bg-[#1c2733] border border-stone-200/80 dark:border-slate-700">
                <span className="text-4xl">🔖</span>
                <h3 className="mt-3 text-lg font-black text-ink dark:text-white">No bookmarks saved yet</h3>
                <p className="mt-1 text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                  Tap the bookmark icon on any event card to save it for later.
                </p>
                <Link
                  to="/"
                  className="mt-5 inline-block rounded-2xl bg-coral px-6 py-3 text-xs sm:text-sm font-bold text-white shadow-md hover:bg-[#df503c] transition"
                >
                  Browse Experiences →
                </Link>
              </div>
            ) : (
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {bookmarks.map((bmk) => {
                  const ev = bmk.event || {};
                  const slug = ev.slug || ev.id;
                  const time = formatEventTime(ev.time || '', ev.day);
                  const priceText = formatPrice(ev.price);
                  return (
                    <article
                      key={bmk.id || slug}
                      className="group relative flex flex-col justify-between overflow-hidden rounded-3xl bg-white shadow-sm hover:shadow-md transition-all duration-200 border border-stone-200 dark:bg-[#1c2733] dark:border-slate-700"
                    >
                      <div className="relative h-48 w-full overflow-hidden bg-stone-100 dark:bg-slate-800">
                        <img
                          src={ev.image || 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=800&q=80'}
                          alt={ev.title}
                          className="h-full w-full object-cover group-hover:scale-105 transition duration-300"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent pointer-events-none" />
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleBookmark(ev.id, slug);
                            setBookmarks((prev) => prev.filter((x) => x.id !== bmk.id));
                          }}
                          className="absolute top-3.5 left-3.5 z-20 grid h-8 w-8 place-items-center rounded-full bg-coral text-white shadow-md ring-2 ring-coral/40 backdrop-blur-md"
                          title="Remove bookmark"
                        >
                          <svg className="h-4 w-4 fill-white" viewBox="0 0 24 24">
                            <path d="M5 3a2 2 0 0 0-2 2v16l9-4 9 4V5a2 2 0 0 0-2-2H5z" />
                          </svg>
                        </button>
                      </div>

                      <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                        <div>
                          <p className="text-xs font-bold uppercase tracking-wider text-coral">
                            {ev.type || 'Experience'} {time ? `· ${time}` : ''}
                          </p>
                          <h3 className="mt-1 text-lg font-black text-ink dark:text-white line-clamp-1 group-hover:text-coral transition-colors">
                            {ev.title}
                          </h3>
                          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 font-medium">📍 {ev.venue || ev.location}</p>
                          <p className="mt-2 text-sm font-black text-ink dark:text-white">{priceText}</p>
                        </div>

                        <div className="flex items-center gap-2.5 pt-2 border-t border-stone-100 dark:border-slate-800">
                          <Link
                            to={`/event/${encodeURIComponent(slug)}`}
                            className="flex-1 text-center rounded-2xl bg-coral px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-[#df503c] transition"
                          >
                            Book Tickets →
                          </Link>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        )}
      </main>

      {/* Redesigned QR Code / Digital Ticket Pass Modal */}
      {selectedBooking && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-in fade-in duration-200"
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedBooking(null);
          }}
        >
          <div className="relative w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl dark:bg-[#1c2733] border border-stone-200 dark:border-slate-700 animate-in zoom-in-95 duration-200">
            {/* Header Ticket Section */}
            <div className="bg-stone-900 text-white p-5 sm:p-6 pb-5">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-black text-emerald-400 ring-1 ring-emerald-500/30">
                  <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                  Verified Digital Ticket
                </span>
                <button
                  onClick={() => setSelectedBooking(null)}
                  className="grid h-8 w-8 place-items-center rounded-full bg-white/10 text-white hover:bg-white/25 transition"
                  aria-label="Close pass"
                >
                  ✕
                </button>
              </div>

              <div className="mt-3.5">
                <h3 className="text-xl sm:text-2xl font-black text-white leading-tight">
                  {selectedBooking.title || selectedBooking.event_title || 'Event Pass'}
                </h3>
                <p className="mt-1 text-xs sm:text-sm text-slate-300 font-medium">
                  📍 {selectedBooking.location || 'Venue details inside'}
                </p>
                {selectedBooking.time && (
                  <p className="text-xs sm:text-sm text-coral font-bold mt-0.5">
                    🕒 {formatEventTime(selectedBooking.time, selectedBooking.day)}
                  </p>
                )}
              </div>
            </div>

            {/* Perforated Tear Divider */}
            <div className="relative flex items-center justify-between bg-stone-900 py-1">
              <div className="h-5 w-5 -ml-2.5 rounded-full bg-black/80" />
              <div className="w-full border-t-2 border-dashed border-stone-700/80 mx-2" />
              <div className="h-5 w-5 -mr-2.5 rounded-full bg-black/80" />
            </div>

            {/* Ticket Body: QR Code & Booking Details */}
            <div className="p-5 sm:p-6 space-y-4 bg-white dark:bg-[#1c2733]">
              {/* QR Container */}
              <div className="flex flex-col items-center justify-center">
                <div className="p-3.5 bg-white rounded-2xl shadow-md border border-stone-200">
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(
                      selectedBooking.booking_code || `BKG-${selectedBooking.id}`
                    )}`}
                    alt="Ticket QR Code"
                    className="h-36 w-36 sm:h-44 sm:w-44 mx-auto object-contain"
                  />
                </div>
                <p className="mt-2 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                  Present this QR code at the venue gate for check-in
                </p>
              </div>

              {/* Booking Reference with Copy */}
              <div className="flex items-center justify-between rounded-2xl bg-stone-100 dark:bg-[#101820] p-3 border border-stone-200/80 dark:border-slate-800">
                <div className="text-left">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Booking Reference</p>
                  <p className="font-mono text-sm font-black text-coral">
                    #{selectedBooking.booking_code || `BKG-${selectedBooking.id}`}
                  </p>
                </div>
                <button
                  onClick={() => handleCopyCode(selectedBooking.booking_code || `BKG-${selectedBooking.id}`)}
                  type="button"
                  className="flex items-center gap-1 rounded-xl bg-white dark:bg-[#1c2733] px-3 py-1.5 text-xs font-bold text-ink dark:text-white shadow-sm hover:text-coral transition border border-stone-200 dark:border-slate-700"
                >
                  <span>📋</span>
                  <span>Copy</span>
                </button>
              </div>

              {/* Summary Breakdown Grid */}
              <div className="grid grid-cols-3 gap-2 text-center rounded-2xl bg-stone-50 dark:bg-[#101820]/60 p-3 border border-stone-100 dark:border-slate-800">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Attendee</p>
                  <p className="mt-0.5 text-xs font-bold text-ink dark:text-white truncate">
                    {user?.name?.split(' ')[0] || 'Guest'}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Reserved</p>
                  <p className="mt-0.5 text-xs font-black text-ink dark:text-white">
                    {selectedBooking.tickets || selectedBooking.quantity || 1} Ticket{(selectedBooking.tickets || selectedBooking.quantity || 1) === 1 ? '' : 's'}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Paid</p>
                  <p className="mt-0.5 text-xs font-black text-coral">
                    {Number(selectedBooking.total ?? selectedBooking.total_amount ?? 0) === 0 || selectedBooking.payment_status === 'Free Entry'
                      ? 'Free'
                      : formatPrice(selectedBooking.total ?? selectedBooking.total_amount ?? 0)}
                  </p>
                </div>
              </div>

              {/* Share & Actions */}
              <div className="space-y-2 pt-1">
                <div className="flex gap-2">
                  <button
                    onClick={() => handleShareTicket(selectedBooking)}
                    type="button"
                    className="flex-1 flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-coral to-orange-500 py-3 px-4 text-xs sm:text-sm font-bold text-white shadow-md hover:from-[#df503c] hover:to-orange-600 transition active:scale-[0.98]"
                  >
                    <span>📤</span>
                    <span>Share Pass</span>
                  </button>
                  <button
                    onClick={() => handleWhatsAppShare(selectedBooking)}
                    type="button"
                    className="flex items-center justify-center gap-1.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 py-3 px-4 text-xs sm:text-sm font-bold text-white shadow-md transition active:scale-[0.98]"
                    title="Share on WhatsApp"
                  >
                    <span>💬</span>
                    <span>WhatsApp</span>
                  </button>
                </div>

                <button
                  onClick={() => setSelectedBooking(null)}
                  type="button"
                  className="w-full rounded-2xl bg-stone-100 dark:bg-slate-800 py-2.5 text-xs sm:text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-stone-200 dark:hover:bg-slate-700 transition"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Profile Modal */}
      {isEditProfileOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsEditProfileOpen(false);
          }}
        >
          <div className="w-full max-w-md rounded-[2.5rem] bg-white p-6 sm:p-8 shadow-2xl dark:bg-[#1c2733] border border-stone-200 dark:border-slate-700 animate-in zoom-in-95 duration-150 space-y-4">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3 dark:border-slate-700">
              <h3 className="text-xl font-black text-ink dark:text-white">Edit Profile</h3>
              <button
                onClick={() => setIsEditProfileOpen(false)}
                className="grid h-8 w-8 place-items-center rounded-full text-slate-400 hover:bg-stone-100 hover:text-ink dark:hover:bg-slate-800 dark:hover:text-white transition"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleUpdateProfile} className="space-y-3 text-xs sm:text-sm">
              <div>
                <label className="mb-1 block font-bold text-ink dark:text-slate-200">Full Name</label>
                <input
                  type="text"
                  value={profileForm.name}
                  onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
                  className="w-full rounded-xl border border-stone-300 px-3.5 py-2.5 font-semibold outline-none focus:border-coral dark:border-slate-700 dark:bg-[#101820] dark:text-white"
                  required
                />
              </div>

              <div>
                <label className="mb-1 block font-bold text-ink dark:text-slate-200">Username</label>
                <input
                  type="text"
                  value={profileForm.username}
                  onChange={(e) => setProfileForm({ ...profileForm, username: e.target.value })}
                  className="w-full rounded-xl border border-stone-300 px-3.5 py-2.5 font-semibold outline-none focus:border-coral dark:border-slate-700 dark:bg-[#101820] dark:text-white"
                  required
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block font-bold text-ink dark:text-slate-200">Phone</label>
                  {profileForm.phone && (
                    <span className="text-[11px] font-semibold text-slate-400">
                      {profileForm.phone.length}/10 digits
                    </span>
                  )}
                </div>
                <input
                  type="tel"
                  inputMode="numeric"
                  value={profileForm.phone}
                  onChange={(e) => {
                    const digitsOnly = e.target.value.replace(/\D/g, '').slice(0, 10);
                    setProfileForm({ ...profileForm, phone: digitsOnly });
                  }}
                  placeholder="10-digit mobile (e.g. 9876543210)"
                  maxLength={10}
                  className={`w-full rounded-xl border px-3.5 py-2.5 font-semibold outline-none transition focus:ring-4 ${
                    profileForm.phone.length === 10
                      ? validateIndianMobile(profileForm.phone).isValid
                        ? 'border-emerald-500 focus:border-emerald-500 focus:ring-emerald-500/20'
                        : 'border-red-500 focus:border-red-500 focus:ring-red-500/20'
                      : profileForm.phone.length > 0 && !/^[6-9]/.test(profileForm.phone)
                      ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20'
                      : 'border-stone-300 focus:border-coral focus:ring-coral/20 dark:border-slate-700'
                  } dark:bg-[#101820] dark:text-white`}
                />
                {profileForm.phone.length > 0 && (
                  <p
                    className={`mt-1 text-xs font-semibold ${
                      profileForm.phone.length === 10 && validateIndianMobile(profileForm.phone).isValid
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-red-500'
                    }`}
                  >
                    {profileForm.phone.length === 10
                      ? validateIndianMobile(profileForm.phone).isValid
                        ? '✓ Valid 10-digit mobile number'
                        : validateIndianMobile(profileForm.phone).error
                      : !/^[6-9]/.test(profileForm.phone)
                      ? '⚠️ Mobile number must start with 6, 7, 8, or 9.'
                      : `Please enter all 10 digits (${profileForm.phone.length}/10 entered)`}
                  </p>
                )}
              </div>

              <div>
                <label className="mb-1 block font-bold text-ink dark:text-slate-200">New Password (leave blank to keep current)</label>
                <input
                  type="password"
                  value={profileForm.password}
                  onChange={(e) => setProfileForm({ ...profileForm, password: e.target.value })}
                  placeholder="••••••••"
                  className="w-full rounded-xl border border-stone-300 px-3.5 py-2.5 font-semibold outline-none focus:border-coral dark:border-slate-700 dark:bg-[#101820] dark:text-white"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsEditProfileOpen(false)}
                  className="w-full rounded-2xl border border-stone-300 bg-white py-3 font-bold text-slate-700 hover:bg-stone-50 transition dark:border-slate-700 dark:bg-[#101820] dark:text-slate-300"
                >
                  Cancel
                </button>
                <button
                  disabled={savingProfile}
                  type="submit"
                  className="w-full rounded-2xl bg-coral py-3 font-bold text-white shadow-md hover:bg-[#df503c] transition disabled:opacity-50"
                >
                  {savingProfile ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
};
