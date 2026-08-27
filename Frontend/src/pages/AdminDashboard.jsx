import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { apiRequest } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useConfirmModal } from '../context/ModalContext';
import { formatPrice, formatEventTime } from '../utils/formatters';
import { useLockBodyScroll } from '../utils/useLockBodyScroll';

export const AdminDashboard = () => {
  const navigate = useNavigate();
  const { user, isAdmin, logout, refreshAuth } = useAuth();
  const { showToast } = useToast();
  const { showConfirmModal } = useConfirmModal();

  const [activeTab, setActiveTab] = useState('events'); // 'events' | 'users' | 'bookings'
  const [loading, setLoading] = useState(true);

  const [stats, setStats] = useState({
    users_count: 0,
    events_count: 0,
    bookings_count: 0,
    tickets_count: 0,
    total_revenue: 0,
    paid_count: 0,
    free_count: 0,
  });

  const [users, setUsers] = useState([]);
  const [events, setEvents] = useState([]);
  const [bookings, setBookings] = useState([]);

  // Search & Filter states
  const [userSearch, setUserSearch] = useState('');
  const [eventSearch, setEventSearch] = useState('');
  const [eventCategoryFilter, setEventCategoryFilter] = useState('all');
  const [bookingSearch, setBookingSearch] = useState('');
  const [bookingTypeFilter, setBookingTypeFilter] = useState('all'); // 'all' | 'paid' | 'free'

  // Selected User Modal
  const [selectedUser, setSelectedUser] = useState(null);
  const [userBookings, setUserBookings] = useState([]);
  const [loadingUserBookings, setLoadingUserBookings] = useState(false);

  // Add / Edit Event Modal & Image Upload
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = useRef(null);

  // Lock background scroll when any modal is open
  useLockBodyScroll(Boolean(selectedUser || isEventModalOpen));

  const [eventFormData, setEventFormData] = useState({
    title: '',
    slug: '',
    type: 'Live music',
    category: 'music',
    venue: '',
    location: '',
    date: '',
    clock: '20:00',
    price: 499,
    image: '',
    description: '',
  });
  const [savingEvent, setSavingEvent] = useState(false);

  const handleImageFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      showToast('Please select a valid image file (JPG, PNG, WEBP, GIF).');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      showToast('Image size must be 5 MB or smaller.');
      return;
    }

    setUploadingImage(true);
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const base64Data = String(reader.result).split(',')[1];
          const res = await apiRequest('/api/admin/upload-image', {
            method: 'POST',
            body: JSON.stringify({
              content_type: file.type,
              data: base64Data,
            }),
          });
          setEventFormData((prev) => ({ ...prev, image: res.url }));
          showToast('Image uploaded successfully! 📸');
        } catch (err) {
          showToast(err.message || 'Failed to upload image');
        } finally {
          setUploadingImage(false);
        }
      };
      reader.onerror = () => {
        showToast('Error reading image file');
        setUploadingImage(false);
      };
      reader.readAsDataURL(file);
    } catch (err) {
      showToast(err.message || 'Failed to process file');
      setUploadingImage(false);
    }
  };

  const fetchAdminData = useCallback(async () => {
    try {
      setLoading(true);
      const data = await apiRequest('/api/admin/overview');
      if (data) {
        const s = data.stats || {};
        setStats({
          users_count: s.users ?? data.users_count ?? (data.users?.length || 0),
          events_count: s.events ?? data.events_count ?? (data.events?.length || 0),
          bookings_count: s.bookings ?? data.bookings_count ?? (data.all_bookings?.length || 0),
          tickets_count: s.tickets ?? data.tickets_count ?? 0,
          total_revenue: s.revenue ?? data.total_revenue ?? 0,
          paid_count: s.paid_bookings ?? data.paid_count ?? 0,
          free_count: s.free_bookings ?? data.free_count ?? 0,
        });
        setUsers(data.users || []);
        setEvents(data.events || []);
        setBookings(data.all_bookings || data.bookings || []);
      }
    } catch (err) {
      if (err.message.includes('401') || err.message.includes('403') || err.message.includes('unauthorized')) {
        showToast('Admin session expired. Please sign in again.');
        navigate('/admin');
      } else {
        showToast(err.message || 'Failed to load dashboard metrics');
      }
    } finally {
      setLoading(false);
    }
  }, [navigate, showToast]);

  useEffect(() => {
    fetchAdminData();
  }, [fetchAdminData]);

  // Open User Details Modal
  const handleOpenUserDetails = async (u) => {
    setSelectedUser(u);
    setLoadingUserBookings(true);
    try {
      const data = await apiRequest(`/api/admin/users/${u.id}/bookings`);
      setUserBookings(data.bookings || []);
    } catch (_) {
      setUserBookings([]);
    } finally {
      setLoadingUserBookings(false);
    }
  };

  // Delete User
  const handleDeleteUser = async (u) => {
    const confirmed = await showConfirmModal({
      title: 'Delete User Account?',
      message: `Are you sure you want to permanently delete user "${u.name}" (@${u.username})? All their bookings will be cancelled.`,
      icon: '🗑️',
      confirmText: 'Delete User',
      type: 'danger',
    });
    if (!confirmed) return;

    try {
      await apiRequest(`/api/admin/users/${u.id}`, { method: 'DELETE' });
      showToast(`User ${u.name} deleted successfully.`);
      if (selectedUser?.id === u.id) setSelectedUser(null);
      fetchAdminData();
    } catch (err) {
      showToast(err.message || 'Failed to delete user');
    }
  };

  // Delete Event
  const handleDeleteEvent = async (ev) => {
    const confirmed = await showConfirmModal({
      title: 'Delete Event Listing?',
      message: `Are you sure you want to remove "${ev.title}"? This cannot be undone.`,
      icon: '🗑️',
      confirmText: 'Delete Event',
      type: 'danger',
    });
    if (!confirmed) return;

    try {
      await apiRequest(`/api/admin/events/${ev.id || ev.slug}`, { method: 'DELETE' });
      showToast(`Event "${ev.title}" deleted.`);
      fetchAdminData();
    } catch (err) {
      showToast(err.message || 'Failed to delete event');
    }
  };

  // Open Add/Edit Event Modal
  const handleOpenAddEvent = () => {
    setEditingEvent(null);
    setEventFormData({
      title: '',
      slug: '',
      type: 'Live music',
      category: 'music',
      venue: '',
      location: 'Hinjawadi, Pune',
      date: new Date().toISOString().split('T')[0],
      clock: '20:00',
      price: 499,
      image: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=800&q=80',
      description: '',
    });
    setIsEventModalOpen(true);
  };

  const handleOpenEditEvent = (ev) => {
    setEditingEvent(ev);
    setEventFormData({
      title: ev.title || '',
      slug: ev.slug || '',
      type: ev.type || ev.event_type || 'Live music',
      category: ev.category || 'music',
      venue: ev.venue || '',
      location: ev.location || 'Pune',
      date: ev.date || (ev.time?.split(' ')[0] || new Date().toISOString().split('T')[0]),
      clock: ev.clock || (ev.time?.split(' ')[1] || '20:00'),
      price: ev.price !== undefined ? ev.price : 499,
      image: ev.image || '',
      description: ev.description || '',
    });
    setIsEventModalOpen(true);
  };

  // Save Event (Add or Edit)
  const handleSaveEvent = async (e) => {
    e.preventDefault();
    if (!eventFormData.title.trim()) {
      showToast('Please enter an event title.');
      return;
    }

    setSavingEvent(true);
    try {
      const payload = {
        title: eventFormData.title.trim(),
        slug: eventFormData.slug.trim() || eventFormData.title.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        type: eventFormData.type,
        category: eventFormData.category,
        venue: eventFormData.venue.trim(),
        location: eventFormData.location.trim(),
        time: `${eventFormData.date} ${eventFormData.clock}`,
        price: Number(eventFormData.price) || 0,
        image: eventFormData.image.trim(),
        description: eventFormData.description.trim(),
      };

      if (editingEvent) {
        await apiRequest(`/api/admin/events/${editingEvent.id || editingEvent.slug}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
        showToast('Event updated successfully! ✨');
      } else {
        await apiRequest('/api/admin/events', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        showToast('New event created and published! 🎉');
      }

      setIsEventModalOpen(false);
      fetchAdminData();
    } catch (err) {
      showToast(err.message || 'Failed to save event');
    } finally {
      setSavingEvent(false);
    }
  };

  // Cancel Booking
  const handleCancelBooking = async (b) => {
    const confirmed = await showConfirmModal({
      title: 'Cancel Booking?',
      message: `Are you sure you want to cancel booking #${b.booking_code || b.id}?`,
      icon: '⚠️',
      confirmText: 'Cancel Booking',
      type: 'danger',
    });
    if (!confirmed) return;

    try {
      await apiRequest(`/api/admin/bookings/${b.id || b.booking_code}/cancel`, { method: 'POST' });
      showToast('Booking cancelled.');
      fetchAdminData();
      if (selectedUser) handleOpenUserDetails(selectedUser);
    } catch (err) {
      showToast(err.message || 'Failed to cancel booking');
    }
  };

  // Admin Sign Out with confirmation
  const handleAdminSignOut = async () => {
    const confirmed = await showConfirmModal({
      title: 'Sign Out of Admin Centre?',
      message: 'Are you sure you want to sign out from the Admin Control Centre?',
      icon: '🚪',
      confirmText: 'Sign Out',
      cancelText: 'Cancel',
      type: 'danger',
    });
    if (!confirmed) return;

    try {
      await apiRequest('/api/admin/logout', { method: 'POST' });
    } catch (_) {}
    await refreshAuth();
    showToast('Signed out from Admin Control Centre.');
    navigate('/admin');
  };

  // Filtered lists
  const filteredUsers = useMemo(() => {
    if (!userSearch.trim()) return users;
    const q = userSearch.toLowerCase().trim();
    return users.filter(
      (u) =>
        (u.name || '').toLowerCase().includes(q) ||
        (u.username || '').toLowerCase().includes(q) ||
        (u.email || '').toLowerCase().includes(q)
    );
  }, [users, userSearch]);

  const filteredEvents = useMemo(() => {
    let result = [...events];
    if (eventCategoryFilter !== 'all') {
      result = result.filter((e) => (e.category || '').toLowerCase() === eventCategoryFilter.toLowerCase());
    }
    if (eventSearch.trim()) {
      const q = eventSearch.toLowerCase().trim();
      result = result.filter(
        (e) =>
          (e.title || '').toLowerCase().includes(q) ||
          (e.venue || '').toLowerCase().includes(q) ||
          (e.location || '').toLowerCase().includes(q)
      );
    }
    return result;
  }, [events, eventSearch, eventCategoryFilter]);

  const filteredBookings = useMemo(() => {
    let result = [...bookings];
    if (bookingTypeFilter === 'paid') {
      result = result.filter((b) => Number(b.total || b.total_amount) > 0);
    } else if (bookingTypeFilter === 'free') {
      result = result.filter((b) => Number(b.total || b.total_amount) === 0);
    }
    if (bookingSearch.trim()) {
      const q = bookingSearch.toLowerCase().trim();
      result = result.filter(
        (b) =>
          (b.booking_code || '').toLowerCase().includes(q) ||
          (b.user_name || '').toLowerCase().includes(q) ||
          (b.user_email || '').toLowerCase().includes(q) ||
          (b.event_title || '').toLowerCase().includes(q)
      );
    }
    return result;
  }, [bookings, bookingSearch, bookingTypeFilter]);

  return (
    <div className="min-h-screen bg-cream text-ink dark:bg-[#101820] dark:text-white flex flex-col">
      {/* Admin Navbar */}
      <header className="sticky top-0 z-30 border-b border-stone-200/80 bg-cream/95 backdrop-blur dark:bg-[#1c2733]/95 dark:border-slate-800">
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <Link to="/" className="flex items-center gap-2.5 group">
              <img
                src="/logo.png"
                alt="MAXSHOW Logo"
                className="h-10 w-10 rounded-2xl object-cover shadow-sm ring-1 ring-black/5 dark:ring-white/10 transition-transform group-hover:scale-105"
              />
              <span className="text-xl font-black tracking-tight text-ink dark:text-white">MAXSHOW</span>
            </Link>
            <span className="rounded-full bg-coral px-3 py-0.5 text-xs font-black uppercase tracking-wider text-white">
              ADMIN CENTRE
            </span>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 rounded-full border border-stone-200 bg-white/90 px-3.5 py-1.5 text-xs font-bold shadow-sm backdrop-blur dark:border-slate-700 dark:bg-[#101820]">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="text-slate-600 dark:text-slate-300">Live Sync</span>
            </div>
            <button
              onClick={handleAdminSignOut}
              className="rounded-full bg-ink px-4 py-2 text-xs font-bold text-white hover:bg-red-600 transition dark:bg-slate-700 dark:hover:bg-red-600"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-6 space-y-8 flex-1">
        {/* Metric Cards Grid acting as Tab Selectors */}
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* 1. Registered Users */}
          <div
            onClick={() => setActiveTab('users')}
            className={`cursor-pointer rounded-3xl border p-6 transition-all hover:-translate-y-1 hover:shadow-md ${
              activeTab === 'users'
                ? 'border-coral ring-2 ring-coral/40 bg-stone-50/80 dark:border-coral dark:bg-[#1f2c3b] shadow-md'
                : 'border-stone-200/80 bg-white dark:border-slate-700/80 dark:bg-[#1c2733]'
            }`}
          >
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Registered Users</p>
              <span className="grid h-8 w-8 place-items-center rounded-xl bg-purple-50 text-purple-600 dark:bg-purple-950/50">
                👥
              </span>
            </div>
            <p className="mt-3 text-3xl font-black text-ink dark:text-white">{stats.users_count}</p>
            <p className="mt-1 text-xs font-semibold text-slate-400">Tap to manage accounts</p>
          </div>

          {/* 2. Published Events */}
          <div
            onClick={() => setActiveTab('events')}
            className={`cursor-pointer rounded-3xl border p-6 transition-all hover:-translate-y-1 hover:shadow-md ${
              activeTab === 'events'
                ? 'border-coral ring-2 ring-coral/40 bg-stone-50/80 dark:border-coral dark:bg-[#1f2c3b] shadow-md'
                : 'border-stone-200/80 bg-white dark:border-slate-700/80 dark:bg-[#1c2733]'
            }`}
          >
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Published Events</p>
              <span className="grid h-8 w-8 place-items-center rounded-xl bg-orange-50 text-coral dark:bg-orange-950/50">
                🎪
              </span>
            </div>
            <p className="mt-3 text-3xl font-black text-ink dark:text-white">{stats.events_count}</p>
            <p className="mt-1 text-xs font-semibold text-slate-400">Active catalogue items</p>
          </div>

          {/* 3. Total Bookings */}
          <div
            onClick={() => setActiveTab('bookings')}
            className={`cursor-pointer rounded-3xl border p-6 transition-all hover:-translate-y-1 hover:shadow-md ${
              activeTab === 'bookings'
                ? 'border-coral ring-2 ring-coral/40 bg-stone-50/80 dark:border-coral dark:bg-[#1f2c3b] shadow-md'
                : 'border-stone-200/80 bg-white dark:border-slate-700/80 dark:bg-[#1c2733]'
            }`}
          >
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Total Bookings</p>
              <span className="grid h-8 w-8 place-items-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50">
                🎟️
              </span>
            </div>
            <p className="mt-3 text-3xl font-black text-ink dark:text-white">{stats.bookings_count}</p>
            <p className="mt-1 text-xs font-semibold text-slate-400">{stats.tickets_count} tickets reserved</p>
          </div>

          {/* 4. Total Revenue (Display-only Metric) */}
          <div className="rounded-3xl border border-stone-200/80 bg-white p-6 shadow-sm dark:border-slate-700/80 dark:bg-[#1c2733]">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Total Revenue</p>
              <span className="grid h-8 w-8 place-items-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/50">
                💰
              </span>
            </div>
            <p className="mt-3 text-3xl font-black text-ink dark:text-white">{formatPrice(stats.total_revenue)}</p>
            <p className="mt-1 text-xs font-semibold text-slate-400">
              {stats.paid_count} paid · {stats.free_count} free passes
            </p>
          </div>
        </section>

        {/* TAB 1: Events Catalogue */}
        {activeTab === 'events' && (
          <section className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="text"
                  value={eventSearch}
                  onChange={(e) => setEventSearch(e.target.value)}
                  placeholder="Search events by title, venue..."
                  className="rounded-xl border border-stone-300 bg-white px-4 py-2 text-xs sm:text-sm font-semibold outline-none focus:border-coral dark:border-slate-700 dark:bg-[#1c2733] dark:text-white"
                />
                <select
                  value={eventCategoryFilter}
                  onChange={(e) => setEventCategoryFilter(e.target.value)}
                  className="rounded-xl border border-stone-300 bg-white px-3 py-2 text-xs sm:text-sm font-semibold outline-none focus:border-coral dark:border-slate-700 dark:bg-[#1c2733] dark:text-white"
                >
                  <option value="all">All Categories</option>
                  <option value="music">Music</option>
                  <option value="comedy">Comedy</option>
                  <option value="outdoors">Outdoors</option>
                  <option value="food">Food & Drinks</option>
                  <option value="create">Workshops</option>
                  <option value="move">Sports & Move</option>
                </select>
              </div>

              <button
                onClick={handleOpenAddEvent}
                className="flex items-center gap-2 rounded-2xl bg-coral px-5 py-2.5 text-xs sm:text-sm font-bold text-white shadow-md hover:bg-[#df503c] transition"
              >
                <span>＋</span>
                <span>Add New Event</span>
              </button>
            </div>

            {/* Events Grid */}
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {filteredEvents.map((ev) => (
                <div
                  key={ev.id || ev.slug}
                  className="group flex flex-col justify-between overflow-hidden rounded-3xl border border-stone-200/80 bg-white shadow-sm transition hover:shadow-md dark:border-slate-700/80 dark:bg-[#1c2733]"
                >
                  <div>
                    <div className="relative h-48 w-full overflow-hidden bg-stone-100 dark:bg-stone-800">
                      <img src={ev.image} alt={ev.title} className="h-full w-full object-cover" />
                      <div className="absolute top-3 left-3 rounded-full bg-black/70 px-2.5 py-1 text-[11px] font-bold text-white backdrop-blur">
                        {ev.type || ev.event_type || 'Event'}
                      </div>
                      <div className="absolute top-3 right-3 rounded-full bg-coral px-2.5 py-1 text-[11px] font-bold text-white">
                        {formatPrice(ev.price)}
                      </div>
                    </div>
                    <div className="p-5">
                      <h3 className="text-base font-black text-ink dark:text-white line-clamp-1">{ev.title}</h3>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">📍 {ev.venue || ev.location}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        🕒 {formatEventTime(ev.time, ev.day)}
                      </p>
                      <p className="mt-2 text-xs text-slate-600 dark:text-slate-300 line-clamp-2">{ev.description}</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between border-t border-stone-100 bg-stone-50/60 p-4 dark:border-slate-700/60 dark:bg-[#101820]">
                    <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                      {ev.tickets_sold || 0} tickets sold
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleOpenEditEvent(ev)}
                        className="rounded-xl border border-stone-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:border-coral hover:text-coral transition dark:border-slate-700 dark:bg-[#1c2733] dark:text-slate-300"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeleteEvent(ev)}
                        className="rounded-xl border border-stone-300 bg-white px-3 py-1.5 text-xs font-bold text-red-600 hover:border-red-400 hover:bg-red-50 transition dark:border-slate-700 dark:bg-[#1c2733]"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* TAB 2: Users Management */}
        {activeTab === 'users' && (
          <section className="space-y-6">
            <div className="flex items-center justify-between">
              <input
                type="text"
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                placeholder="Search users by name, username, email..."
                className="w-full max-w-md rounded-xl border border-stone-300 bg-white px-4 py-2 text-xs sm:text-sm font-semibold outline-none focus:border-coral dark:border-slate-700 dark:bg-[#1c2733] dark:text-white"
              />
              <span className="text-xs font-bold text-slate-400">
                {filteredUsers.length} user{filteredUsers.length === 1 ? '' : 's'}
              </span>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filteredUsers.map((u) => {
                const initial = u.name?.charAt(0)?.toUpperCase() || 'U';
                return (
                  <div
                    key={u.id}
                    className="flex flex-col justify-between rounded-3xl border border-stone-200/80 bg-white p-5 shadow-sm dark:border-slate-700/80 dark:bg-[#1c2733]"
                  >
                    <div className="flex items-start gap-3.5">
                      <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-coral/10 text-base font-black text-coral dark:bg-coral/20">
                        {initial}
                      </div>
                      <div className="min-w-0 flex-1">
                        <h4 className="font-black text-ink dark:text-white truncate">{u.name}</h4>
                        <p className="text-xs font-bold text-coral truncate">@{u.username}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{u.email}</p>
                        <p className="mt-1 text-[11px] font-semibold text-slate-400">ID: {u.custom_id || `USR-${u.id}`}</p>
                      </div>
                    </div>

                    <div className="mt-4 flex items-center justify-between border-t border-stone-100 pt-3 dark:border-slate-700">
                      <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                        {u.bookings_count || 0} booking{(u.bookings_count || 0) === 1 ? '' : 's'}
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleOpenUserDetails(u)}
                          className="rounded-xl border border-stone-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:border-coral hover:text-coral transition dark:border-slate-700 dark:bg-[#101820] dark:text-slate-300"
                        >
                          Details
                        </button>
                        <button
                          onClick={() => handleDeleteUser(u)}
                          className="rounded-xl border border-stone-300 bg-white px-3 py-1.5 text-xs font-bold text-red-600 hover:border-red-400 hover:bg-red-50 transition dark:border-slate-700 dark:bg-[#101820]"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* TAB 3: Transactions Ledger */}
        {activeTab === 'bookings' && (
          <section className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="text"
                  value={bookingSearch}
                  onChange={(e) => setBookingSearch(e.target.value)}
                  placeholder="Search by code, user, event..."
                  className="rounded-xl border border-stone-300 bg-white px-4 py-2 text-xs sm:text-sm font-semibold outline-none focus:border-coral dark:border-slate-700 dark:bg-[#1c2733] dark:text-white"
                />
                <div className="flex items-center gap-1.5">
                  {['all', 'paid', 'free'].map((t) => (
                    <button
                      key={t}
                      onClick={() => setBookingTypeFilter(t)}
                      className={`rounded-xl px-3 py-1.5 text-xs font-bold capitalize transition ${
                        bookingTypeFilter === t
                          ? 'bg-ink text-white dark:bg-coral'
                          : 'border border-stone-300 bg-white text-slate-600 dark:border-slate-700 dark:bg-[#1c2733] dark:text-slate-300'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
              <span className="text-xs font-bold text-slate-400">{filteredBookings.length} records</span>
            </div>

            <div className="overflow-x-auto rounded-3xl border border-stone-200/80 bg-white shadow-sm dark:border-slate-700/80 dark:bg-[#1c2733]">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead className="border-b border-stone-200 bg-stone-50 dark:border-slate-700 dark:bg-[#151f2b] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="px-5 py-3.5">Booking ID</th>
                    <th className="px-5 py-3.5">User</th>
                    <th className="px-5 py-3.5">Event</th>
                    <th className="px-5 py-3.5">Tickets</th>
                    <th className="px-5 py-3.5">Amount</th>
                    <th className="px-5 py-3.5">Status</th>
                    <th className="px-5 py-3.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100 dark:divide-slate-700">
                  {filteredBookings.map((b) => {
                    const isFree = Number(b.total || b.total_amount) === 0;
                    return (
                      <tr key={b.id || b.booking_code} className="hover:bg-stone-50/50 dark:hover:bg-slate-800/50 transition">
                        <td className="px-5 py-4 font-mono font-bold text-coral">{b.booking_code || `BKG-${b.id}`}</td>
                        <td className="px-5 py-4">
                          <p className="font-bold text-ink dark:text-white">{b.user_name || 'Guest'}</p>
                          <p className="text-xs text-slate-400">{b.user_email || '—'}</p>
                        </td>
                        <td className="px-5 py-4 font-semibold text-ink dark:text-white max-w-[200px] truncate">
                          {b.event_title || 'Event'}
                        </td>
                        <td className="px-5 py-4 font-bold">{b.quantity || b.tickets || 1}</td>
                        <td className="px-5 py-4 font-bold text-ink dark:text-white">
                          {isFree ? 'Free entry' : formatPrice(b.total || b.total_amount)}
                        </td>
                        <td className="px-5 py-4">
                          <span
                            className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                              isFree
                                ? 'bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300'
                                : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                            }`}
                          >
                            {isFree ? 'Free Pass' : 'Paid (Razorpay)'}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-right">
                          <button
                            onClick={() => handleCancelBooking(b)}
                            className="text-xs font-bold text-red-600 hover:underline"
                          >
                            Cancel
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </main>

      {/* MODAL 1: Enriched User Details Modal */}
      {selectedUser && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-200"
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedUser(null);
          }}
        >
          <div className="w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-[2.5rem] bg-white shadow-2xl dark:bg-[#1c2733] border border-stone-200 dark:border-slate-700 animate-in zoom-in-95 duration-150 p-6 sm:p-8 space-y-6 no-scrollbar">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-stone-100 pb-4 dark:border-slate-700">
              <div className="flex items-center gap-3.5">
                <div className="grid h-14 w-14 place-items-center rounded-2xl bg-coral text-xl font-black text-white shadow-md">
                  {selectedUser.name?.charAt(0)?.toUpperCase()}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-xl sm:text-2xl font-black text-ink dark:text-white">{selectedUser.name}</h3>
                    <span className="rounded-full bg-coral/10 px-2.5 py-0.5 text-[10px] font-black uppercase text-coral dark:bg-coral/20">
                      Member
                    </span>
                  </div>
                  <p className="text-xs font-bold text-coral">@{selectedUser.username}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedUser(null)}
                className="grid h-9 w-9 place-items-center rounded-full text-slate-400 hover:bg-stone-100 hover:text-ink dark:hover:bg-slate-800 dark:hover:text-white transition"
              >
                ✕
              </button>
            </div>

            {/* Comprehensive Meta Cards Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
              <div className="rounded-2xl bg-stone-50 p-3.5 dark:bg-[#151f2b] border border-stone-100 dark:border-slate-800">
                <p className="text-slate-400 font-bold uppercase text-[10px] tracking-wider">Email Address</p>
                <p className="font-bold text-ink dark:text-white mt-1 truncate" title={selectedUser.email}>
                  {selectedUser.email}
                </p>
                <span className="text-[10px] text-emerald-600 font-bold dark:text-emerald-400">✓ Verified</span>
              </div>

              <div className="rounded-2xl bg-stone-50 p-3.5 dark:bg-[#151f2b] border border-stone-100 dark:border-slate-800">
                <p className="text-slate-400 font-bold uppercase text-[10px] tracking-wider">Mobile Number</p>
                <p className="font-bold text-ink dark:text-white mt-1 truncate">
                  {selectedUser.phone || selectedUser.phone_number || selectedUser.mobile || 'Not provided'}
                </p>
                <span className="text-[10px] text-slate-400 font-semibold">Contact</span>
              </div>

              <div className="rounded-2xl bg-stone-50 p-3.5 dark:bg-[#151f2b] border border-stone-100 dark:border-slate-800">
                <p className="text-slate-400 font-bold uppercase text-[10px] tracking-wider">Account ID</p>
                <p className="font-mono font-bold text-coral mt-1 truncate">
                  #{selectedUser.user_id || selectedUser.custom_id || `USR-${selectedUser.id}`}
                </p>
                <span className="text-[10px] text-slate-400 font-semibold">Unique User Ref</span>
              </div>

              <div className="rounded-2xl bg-stone-50 p-3.5 dark:bg-[#151f2b] border border-stone-100 dark:border-slate-800">
                <p className="text-slate-400 font-bold uppercase text-[10px] tracking-wider">Total Bookings</p>
                <p className="font-black text-ink dark:text-white text-base mt-0.5">
                  {userBookings.length || selectedUser.bookings_count || 0}
                </p>
                <span className="text-[10px] text-slate-400">Reservations</span>
              </div>

              <div className="rounded-2xl bg-stone-50 p-3.5 dark:bg-[#151f2b] border border-stone-100 dark:border-slate-800">
                <p className="text-slate-400 font-bold uppercase text-[10px] tracking-wider">Total Tickets</p>
                <p className="font-black text-ink dark:text-white text-base mt-0.5">
                  {userBookings.reduce((sum, b) => sum + (Number(b.tickets || b.quantity) || 0), 0) || selectedUser.ticket_count || 0}
                </p>
                <span className="text-[10px] text-slate-400">Passes Issued</span>
              </div>

              <div className="rounded-2xl bg-stone-50 p-3.5 dark:bg-[#151f2b] border border-stone-100 dark:border-slate-800">
                <p className="text-slate-400 font-bold uppercase text-[10px] tracking-wider">Total Spent</p>
                <p className="font-black text-coral text-base mt-0.5">
                  {formatPrice(
                    userBookings.reduce((sum, b) => sum + (Number(b.total || b.total_amount) || 0), 0) || selectedUser.total_spent || 0
                  )}
                </p>
                <span className="text-[10px] text-slate-400">Cumulative spend</span>
              </div>
            </div>

            {/* Bookings History Section */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Bookings History ({userBookings.length})
                </h4>
                {selectedUser.created_at && (
                  <span className="text-[11px] text-slate-400 font-semibold">
                    Joined: {new Date(selectedUser.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </span>
                )}
              </div>

              {loadingUserBookings ? (
                <div className="rounded-2xl bg-stone-50 dark:bg-[#151f2b] p-6 text-center text-xs text-slate-400">
                  Loading bookings history...
                </div>
              ) : userBookings.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-stone-200 dark:border-slate-700 p-6 text-center space-y-1">
                  <span className="text-2xl">🎟️</span>
                  <p className="text-xs font-bold text-slate-500 dark:text-slate-400">No bookings recorded for this user yet.</p>
                  <p className="text-[11px] text-slate-400">When the user books passes, their orders will appear here.</p>
                </div>
              ) : (
                <div className="max-h-56 overflow-y-auto space-y-2.5 no-scrollbar pr-1">
                  {userBookings.map((b) => (
                    <div
                      key={b.id || b.booking_code}
                      className="rounded-2xl border border-stone-200/90 p-3.5 text-xs dark:border-slate-700/80 dark:bg-[#151f2b] shadow-sm space-y-2"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-black text-sm text-ink dark:text-white">{b.title || b.event_title || 'Experience'}</p>
                          <p className="text-[11px] font-semibold text-slate-400 mt-0.5">
                            📍 {b.location || 'MAXSHOW Venue'} {b.time ? `· 🕒 ${b.time}` : ''}
                          </p>
                        </div>
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase whitespace-nowrap ${
                            b.payment_status === 'Free Entry'
                              ? 'bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300'
                              : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                          }`}
                        >
                          {b.payment_status || (b.total === 0 ? 'Free Entry' : 'Paid')}
                        </span>
                      </div>

                      <div className="flex items-center justify-between border-t border-stone-100 pt-2 dark:border-slate-800 text-[11px]">
                        <div className="flex items-center gap-3">
                          <span className="font-mono font-bold text-coral">#{b.booking_code || b.booking_id || `BKG-${b.id}`}</span>
                          <span className="font-bold text-slate-600 dark:text-slate-300">
                            {b.tickets || b.quantity || 1} pass{b.tickets > 1 ? 'es' : ''} · {b.total === 0 ? 'Free' : formatPrice(b.total || b.total_amount)}
                          </span>
                        </div>
                        <button
                          onClick={() => handleCancelBooking(b)}
                          className="font-bold text-red-500 hover:text-red-700 dark:hover:text-red-400 transition"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer Actions */}
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => handleDeleteUser(selectedUser)}
                className="w-full rounded-2xl border border-red-300 bg-red-50 py-3 text-xs sm:text-sm font-bold text-red-600 hover:bg-red-100 transition dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300"
              >
                Delete User
              </button>
              <button
                onClick={() => setSelectedUser(null)}
                className="w-full rounded-2xl bg-ink py-3 text-xs sm:text-sm font-bold text-white hover:bg-slate-800 transition dark:bg-slate-700"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: Add / Edit Event Modal */}
      {isEventModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsEventModalOpen(false);
          }}
        >
          <div className="w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-[2.5rem] bg-white shadow-2xl dark:bg-[#1c2733] border border-stone-200 dark:border-slate-700 animate-in zoom-in-95 duration-150 p-6 sm:p-8 space-y-5">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3 dark:border-slate-700">
              <h3 className="text-xl font-black text-ink dark:text-white">
                {editingEvent ? 'Edit Event Listing' : 'Create New Event Listing'}
              </h3>
              <button
                onClick={() => setIsEventModalOpen(false)}
                className="grid h-8 w-8 place-items-center rounded-full text-slate-400 hover:bg-stone-100 hover:text-ink dark:hover:bg-slate-800 dark:hover:text-white transition"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveEvent} className="grid gap-3.5 sm:grid-cols-2 text-xs sm:text-sm">
              <div className="sm:col-span-2">
                <label className="mb-1 block font-bold text-ink dark:text-slate-200">Event Title *</label>
                <input
                  type="text"
                  value={eventFormData.title}
                  onChange={(e) => setEventFormData({ ...eventFormData, title: e.target.value })}
                  placeholder="e.g. Moonlight Picnic & Vinyl"
                  className="w-full rounded-xl border border-stone-300 px-3.5 py-2.5 font-semibold outline-none focus:border-coral dark:border-slate-700 dark:bg-[#101820] dark:text-white"
                  required
                />
              </div>

              <div>
                <label className="mb-1 block font-bold text-ink dark:text-slate-200">Event Type Label</label>
                <input
                  type="text"
                  value={eventFormData.type}
                  onChange={(e) => setEventFormData({ ...eventFormData, type: e.target.value })}
                  placeholder="e.g. Live music, Comedy"
                  className="w-full rounded-xl border border-stone-300 px-3.5 py-2.5 font-semibold outline-none focus:border-coral dark:border-slate-700 dark:bg-[#101820] dark:text-white"
                />
              </div>

              <div>
                <label className="mb-1 block font-bold text-ink dark:text-slate-200">Category</label>
                <select
                  value={eventFormData.category}
                  onChange={(e) => setEventFormData({ ...eventFormData, category: e.target.value })}
                  className="w-full rounded-xl border border-stone-300 px-3.5 py-2.5 font-semibold outline-none focus:border-coral dark:border-slate-700 dark:bg-[#101820] dark:text-white"
                >
                  <option value="music">Music</option>
                  <option value="comedy">Comedy</option>
                  <option value="outdoors">Outdoors</option>
                  <option value="food">Food & Drinks</option>
                  <option value="create">Workshops</option>
                  <option value="move">Sports & Move</option>
                  <option value="fests">Fests & Fairs</option>
                  <option value="screenings">Screenings</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block font-bold text-ink dark:text-slate-200">Venue / Location Name</label>
                <input
                  type="text"
                  value={eventFormData.venue}
                  onChange={(e) => setEventFormData({ ...eventFormData, venue: e.target.value })}
                  placeholder="e.g. Skyline Terrace · Hinjawadi"
                  className="w-full rounded-xl border border-stone-300 px-3.5 py-2.5 font-semibold outline-none focus:border-coral dark:border-slate-700 dark:bg-[#101820] dark:text-white"
                  required
                />
              </div>

              <div>
                <label className="mb-1 block font-bold text-ink dark:text-slate-200">City / Area</label>
                <input
                  type="text"
                  value={eventFormData.location}
                  onChange={(e) => setEventFormData({ ...eventFormData, location: e.target.value })}
                  placeholder="e.g. Hinjawadi, Pune"
                  className="w-full rounded-xl border border-stone-300 px-3.5 py-2.5 font-semibold outline-none focus:border-coral dark:border-slate-700 dark:bg-[#101820] dark:text-white"
                  required
                />
              </div>

              <div>
                <label className="mb-1 block font-bold text-ink dark:text-slate-200">Date</label>
                <input
                  type="date"
                  value={eventFormData.date}
                  onChange={(e) => setEventFormData({ ...eventFormData, date: e.target.value })}
                  className="w-full rounded-xl border border-stone-300 px-3.5 py-2.5 font-semibold outline-none focus:border-coral dark:border-slate-700 dark:bg-[#101820] dark:text-white"
                  required
                />
              </div>

              <div>
                <label className="mb-1 block font-bold text-ink dark:text-slate-200">Time</label>
                <input
                  type="time"
                  value={eventFormData.clock}
                  onChange={(e) => setEventFormData({ ...eventFormData, clock: e.target.value })}
                  className="w-full rounded-xl border border-stone-300 px-3.5 py-2.5 font-semibold outline-none focus:border-coral dark:border-slate-700 dark:bg-[#101820] dark:text-white"
                  required
                />
              </div>

              <div className="sm:col-span-2">
                <label className="mb-1 block font-bold text-ink dark:text-slate-200">Price (INR, 0 for Free)</label>
                <input
                  type="number"
                  min="0"
                  value={eventFormData.price}
                  onChange={(e) => setEventFormData({ ...eventFormData, price: Number(e.target.value) })}
                  className="w-full rounded-xl border border-stone-300 px-3.5 py-2.5 font-semibold outline-none focus:border-coral dark:border-slate-700 dark:bg-[#101820] dark:text-white"
                />
              </div>

              {/* Cover Image Upload & Live Preview */}
              <div className="sm:col-span-2 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block font-bold text-ink dark:text-slate-200">Event Cover Image *</label>
                  {uploadingImage && (
                    <span className="text-xs font-bold text-coral animate-pulse">Uploading image... 📸</span>
                  )}
                </div>

                {/* Preview Banner or Dropzone */}
                {eventFormData.image ? (
                  <div className="relative h-44 w-full overflow-hidden rounded-2xl border border-stone-200 dark:border-slate-700 bg-stone-900 group shadow-sm">
                    <img
                      src={eventFormData.image}
                      alt="Event Cover Preview"
                      className="h-full w-full object-cover"
                      onError={(e) => {
                        e.currentTarget.src = 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=800&q=80';
                      }}
                    />
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="rounded-xl bg-white px-3.5 py-1.5 text-xs font-bold text-ink shadow-sm hover:bg-stone-100 transition"
                      >
                        Change Photo
                      </button>
                      <button
                        type="button"
                        onClick={() => setEventFormData((prev) => ({ ...prev, image: '' }))}
                        className="rounded-xl bg-red-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-red-700 transition"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ) : (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="cursor-pointer rounded-2xl border-2 border-dashed border-stone-300 dark:border-slate-700 p-6 text-center hover:border-coral transition dark:bg-[#101820]"
                  >
                    <span className="text-3xl">📷</span>
                    <p className="mt-2 text-xs sm:text-sm font-bold text-ink dark:text-white">
                      {uploadingImage ? 'Uploading photo...' : 'Click to choose event image from your device'}
                    </p>
                    <p className="text-[11px] text-slate-400 mt-0.5">Supports JPG, PNG, WEBP, GIF up to 5 MB</p>
                  </div>
                )}

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  onChange={handleImageFileChange}
                  className="hidden"
                />

                {/* Upload Action or URL Paste */}
                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingImage}
                    className="rounded-xl border border-stone-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:border-coral hover:text-coral transition dark:border-slate-700 dark:bg-[#101820] dark:text-slate-300 disabled:opacity-50"
                  >
                    {uploadingImage ? 'Uploading...' : '📁 Upload from Device'}
                  </button>
                  <input
                    type="text"
                    value={eventFormData.image}
                    onChange={(e) => setEventFormData({ ...eventFormData, image: e.target.value })}
                    placeholder="Or paste direct image URL (https://...)"
                    className="flex-1 rounded-xl border border-stone-300 px-3 py-1.5 text-xs font-semibold outline-none focus:border-coral dark:border-slate-700 dark:bg-[#101820] dark:text-white"
                  />
                </div>
              </div>

              <div className="sm:col-span-2">
                <label className="mb-1 block font-bold text-ink dark:text-slate-200">Description</label>
                <textarea
                  rows="3"
                  value={eventFormData.description}
                  onChange={(e) => setEventFormData({ ...eventFormData, description: e.target.value })}
                  placeholder="Tell people what to expect..."
                  className="w-full rounded-xl border border-stone-300 px-3.5 py-2.5 font-semibold outline-none focus:border-coral dark:border-slate-700 dark:bg-[#101820] dark:text-white"
                ></textarea>
              </div>

              <div className="sm:col-span-2 flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsEventModalOpen(false)}
                  className="w-full rounded-2xl border border-stone-300 bg-white py-3 font-bold text-slate-700 hover:bg-stone-50 transition dark:border-slate-700 dark:bg-[#101820] dark:text-slate-300"
                >
                  Cancel
                </button>
                <button
                  disabled={savingEvent}
                  type="submit"
                  className="w-full rounded-2xl bg-coral py-3 font-bold text-white shadow-md hover:bg-[#df503c] transition disabled:opacity-50"
                >
                  {savingEvent ? 'Saving...' : editingEvent ? 'Update Event' : 'Publish Event'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
