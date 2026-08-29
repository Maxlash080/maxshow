import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { apiRequest } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useConfirmModal } from '../context/ModalContext';
import { formatPrice, formatEventTime } from '../utils/formatters';
import { useLockBodyScroll } from '../utils/useLockBodyScroll';
import { CategoryDropdown } from '../components/CategoryDropdown';
import { LocationFilterDropdown } from '../components/LocationFilterDropdown';
import { AreaDropdown } from '../components/AreaDropdown';
import { CustomDatePicker } from '../components/CustomDatePicker';
import { CustomTimePicker } from '../components/CustomTimePicker';
import { LOCATIONS } from '../utils/constants';

const getCachedAdminData = () => {
  try {
    const raw = sessionStorage.getItem('MAXSHOW_ADMIN_OVERVIEW');
    return raw ? JSON.parse(raw) : null;
  } catch (_) {
    return null;
  }
};

const setCachedAdminData = (data) => {
  try {
    sessionStorage.setItem('MAXSHOW_ADMIN_OVERVIEW', JSON.stringify(data));
  } catch (_) {}
};

export const AdminDashboard = () => {
  const navigate = useNavigate();
  const { user, isAdmin, logout, refreshAuth } = useAuth();
  const { showToast } = useToast();
  const { showConfirmModal } = useConfirmModal();

  const cached = getCachedAdminData();
  const [activeTab, setActiveTab] = useState('events'); // 'events' | 'users' | 'bookings'
  const [loading, setLoading] = useState(!cached);

  // Live SSE Sync States
  const [liveStatus, setLiveStatus] = useState('connecting'); // 'connected' | 'connecting' | 'offline'
  const [liveBanner, setLiveBanner] = useState(null); // { id, type, title, subtitle, user, timestamp }
  const [isBannerFading, setIsBannerFading] = useState(false);
  const [newlyRegisteredUserIds, setNewlyRegisteredUserIds] = useState(new Set());
  const [testingLive, setTestingLive] = useState(false);

  // Auto-dismiss liveBanner after 7 seconds with smooth fade-out animation
  useEffect(() => {
    if (!liveBanner) {
      setIsBannerFading(false);
      return;
    }

    setIsBannerFading(false);

    // Start graceful fade-out at 6.3s
    const fadeTimer = setTimeout(() => {
      setIsBannerFading(true);
    }, 6300);

    // Fully dismiss at 7s
    const dismissTimer = setTimeout(() => {
      setLiveBanner(null);
      setIsBannerFading(false);
    }, 7000);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(dismissTimer);
    };
  }, [liveBanner]);

  const [stats, setStats] = useState(
    cached?.stats || {
      users_count: cached?.users?.length || 0,
      online_users: 0,
      offline_users: cached?.users?.length || 0,
      events_count: cached?.events?.length || 0,
      bookings_count: cached?.bookings?.length || 0,
      tickets_count: cached?.tickets_count || 0,
      total_revenue: cached?.total_revenue || 0,
      paid_count: 0,
      free_count: 0,
    }
  );

  const [users, setUsers] = useState(cached?.users || []);
  const [events, setEvents] = useState(cached?.events || []);
  const [bookings, setBookings] = useState(cached?.bookings || []);

  // Search & Filter states
  const [userSearch, setUserSearch] = useState('');
  const [userStatusFilter, setUserStatusFilter] = useState('all'); // 'all' | 'online' | 'offline'
  const [eventSearch, setEventSearch] = useState('');
  const [eventCategoryFilter, setEventCategoryFilter] = useState('all');
  const [eventLocationFilter, setEventLocationFilter] = useState('all');
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

  const fetchAdminData = useCallback(async (isSilent = false) => {
    try {
      if (!isSilent && !getCachedAdminData()) setLoading(true);
      const data = await apiRequest('/api/admin/overview');
      if (data) {
        const s = data.stats || {};
        const uList = data.users || [];
        const evList = data.events || [];
        const bList = data.all_bookings || data.bookings || [];
        const newStats = {
          users_count: s.users ?? data.users_count ?? uList.length,
          online_users: s.online_users ?? s.active_users ?? (uList.filter((u) => u.is_online || u.is_active).length || 0),
          offline_users: s.offline_users ?? s.inactive_users ?? (uList.filter((u) => !u.is_online && !u.is_active).length || 0),
          events_count: s.events ?? data.events_count ?? evList.length,
          bookings_count: s.bookings ?? data.bookings_count ?? bList.length,
          tickets_count: s.tickets ?? data.tickets_count ?? 0,
          total_revenue: s.revenue ?? data.total_revenue ?? 0,
          paid_count: s.paid_bookings ?? data.paid_count ?? 0,
          free_count: s.free_bookings ?? data.free_count ?? 0,
        };
        setStats(newStats);
        setUsers(uList);
        setEvents(evList);
        setBookings(bList);
        setCachedAdminData({ stats: newStats, users: uList, events: evList, bookings: bList });
      }
    } catch (err) {
      if (err.message.includes('401') || err.message.includes('403') || err.message.includes('unauthorized')) {
        showToast('Admin session expired. Please sign in again.');
        navigate('/admin');
      } else if (!isSilent) {
        showToast(err.message || 'Failed to load dashboard metrics');
      }
    } finally {
      setLoading(false);
    }
  }, [navigate, showToast]);

  const handleTestLiveAlert = async () => {
    setTestingLive(true);
    try {
      await apiRequest('/api/admin/test-live-notification', { method: 'POST' });
    } catch (err) {
      showToast(err.message || 'Failed to trigger test live notification');
    } finally {
      setTestingLive(false);
    }
  };

  // Initial Data Load
  useEffect(() => {
    fetchAdminData();
  }, [fetchAdminData]);

  // Live SSE Real-Time Stream Engine
  useEffect(() => {
    let es = null;
    let reconnectTimer = null;
    let isComponentMounted = true;

    const connectLiveStream = () => {
      if (!isComponentMounted) return;
      try {
        setLiveStatus('connecting');
        es = new EventSource('/api/admin/live-stream', { withCredentials: true });

        es.addEventListener('connected', () => {
          if (isComponentMounted) setLiveStatus('connected');
        });

        // LIVE REGISTRATION LISTENER
        es.addEventListener('user_registered', (event) => {
          if (!isComponentMounted) return;
          try {
            const payload = JSON.parse(event.data);
            const userObj = payload.data || payload;
            if (!userObj || !userObj.id) return;

            // Ensure is_online is set
            userObj.is_online = true;
            userObj.is_active = true;
            userObj.status = 'Online';

            // 1. Increment stats count immediately
            setStats((prev) => ({
              ...prev,
              users_count: (prev.users_count || 0) + 1,
              online_users: (prev.online_users || 0) + 1,
            }));

            // 2. Prepend user to live table
            setUsers((prev) => {
              const exists = prev.some((u) => u.id === userObj.id || (userObj.user_id && u.user_id === userObj.user_id));
              if (exists) return prev;
              return [userObj, ...prev];
            });

            // 3. Mark as newly registered for temporary visual glow
            setNewlyRegisteredUserIds((prev) => new Set(prev).add(userObj.id));
            setTimeout(() => {
              if (isComponentMounted) {
                setNewlyRegisteredUserIds((prev) => {
                  const updated = new Set(prev);
                  updated.delete(userObj.id);
                  return updated;
                });
              }
            }, 60000);

            // 4. Popup high-visibility live alert banner
            setLiveBanner({
              id: Date.now(),
              type: 'register',
              title: '🎉 New User Registered (Online)!',
              subtitle: `${userObj.name || userObj.username} (@${userObj.username}) just signed up and is Online!`,
              user: userObj,
              timestamp: new Date(),
            });

            showToast(`🎉 New user registered: ${userObj.name} (@${userObj.username})`);
          } catch (err) {
            console.error('[LiveSync] Error processing user_registered event:', err);
          }
        });

        // LIVE USER STATUS LISTENER (LOGIN / LOGOUT / ONLINE / OFFLINE)
        es.addEventListener('user_status_changed', (event) => {
          if (!isComponentMounted) return;
          try {
            const payload = JSON.parse(event.data);
            const statusData = payload.data || payload;
            if (!statusData || !statusData.user_id) return;

            const isNowOnline = Boolean(statusData.is_online !== undefined ? statusData.is_online : statusData.is_active);
            const statusLabel = isNowOnline ? 'Online' : 'Offline';

            // Update user in users array
            setUsers((prev) =>
              prev.map((u) => {
                if (u.id === statusData.user_id) {
                  return {
                    ...u,
                    is_online: isNowOnline,
                    is_active: isNowOnline,
                    status: statusLabel,
                  };
                }
                return u;
              })
            );

            // Update selected user modal if currently open
            setSelectedUser((prev) => {
              if (prev && prev.id === statusData.user_id) {
                return {
                  ...prev,
                  is_online: isNowOnline,
                  is_active: isNowOnline,
                  status: statusLabel,
                };
              }
              return prev;
            });

            // Update live stats online count
            setStats((prev) => {
              const onlineCount = isNowOnline
                ? Math.min(prev.users_count || 1, (prev.online_users || 0) + 1)
                : Math.max(0, (prev.online_users || 1) - 1);
              return {
                ...prev,
                online_users: onlineCount,
                offline_users: Math.max(0, (prev.users_count || 0) - onlineCount),
              };
            });

            showToast(
              isNowOnline
                ? `🟢 ${statusData.name || statusData.username} logged in (Online)`
                : `⚪ ${statusData.name || statusData.username} logged out (Offline)`
            );
          } catch (err) {
            console.error('[LiveSync] Error processing user_status_changed event:', err);
          }
        });

        // LIVE BOOKING LISTENER
        es.addEventListener('booking_created', (event) => {
          if (!isComponentMounted) return;
          try {
            const payload = JSON.parse(event.data);
            const bookingObj = payload.data || payload;
            if (!bookingObj) return;

            const ticketCount = Number(bookingObj.tickets || bookingObj.ticket_count) || 1;
            const totalAmt = Number(bookingObj.total || bookingObj.total_amount) || 0;

            setStats((prev) => ({
              ...prev,
              bookings_count: (prev.bookings_count || 0) + 1,
              tickets_count: (prev.tickets_count || 0) + ticketCount,
              total_revenue: (prev.total_revenue || 0) + totalAmt,
              paid_count: totalAmt > 0 ? (prev.paid_count || 0) + 1 : prev.paid_count,
              free_count: totalAmt === 0 ? (prev.free_count || 0) + 1 : prev.free_count,
            }));

            fetchAdminData(true);
          } catch (err) {
            console.error('[LiveSync] Error processing booking_created event:', err);
          }
        });

        // LIVE EVENT / USER UPDATES
        es.addEventListener('events_updated', () => {
          if (isComponentMounted) fetchAdminData(true);
        });

        es.addEventListener('user_deleted', (event) => {
          if (!isComponentMounted) return;
          try {
            const payload = JSON.parse(event.data);
            const uId = payload.data?.user_id || payload.user_id;
            if (uId) {
              setUsers((prev) => prev.filter((u) => u.id !== uId));
              setStats((prev) => ({ ...prev, users_count: Math.max(0, (prev.users_count || 1) - 1) }));
            }
          } catch (_) {
            fetchAdminData(true);
          }
        });

        es.onerror = () => {
          if (!isComponentMounted) return;
          setLiveStatus('connecting');
          if (es) {
            es.close();
            es = null;
          }
          reconnectTimer = setTimeout(connectLiveStream, 4000);
        };
      } catch (_) {
        if (isComponentMounted) {
          setLiveStatus('offline');
          reconnectTimer = setTimeout(connectLiveStream, 6000);
        }
      }
    };

    connectLiveStream();

    // Fallback periodic sync every 15s to guarantee fresh state
    const fallbackInterval = setInterval(() => {
      if (isComponentMounted) {
        fetchAdminData(true);
      }
    }, 15000);

    return () => {
      isComponentMounted = false;
      if (es) es.close();
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (fallbackInterval) clearInterval(fallbackInterval);
    };
  }, [fetchAdminData, showToast]);

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
      location: ev.location || 'Hinjawadi, Pune',
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
      const cleanTitle = eventFormData.title.trim();
      const generatedSlug = cleanTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
      const rawSlug = eventFormData.slug.trim() ? eventFormData.slug.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') : generatedSlug;

      const payload = {
        title: cleanTitle,
        slug: rawSlug || `event-${Date.now().toString(36)}`,
        type: eventFormData.type,
        event_type: eventFormData.type,
        category: eventFormData.category,
        venue: eventFormData.venue.trim(),
        location: eventFormData.location.trim(),
        time: `${eventFormData.date} ${eventFormData.clock}`,
        price: Number(eventFormData.price) || 0,
        image: eventFormData.image.trim(),
        description: eventFormData.description.trim(),
        day: 'weekend',
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
    let result = [...users];
    if (userStatusFilter === 'online') {
      result = result.filter((u) => Boolean(u.is_online || u.is_active));
    } else if (userStatusFilter === 'offline') {
      result = result.filter((u) => !u.is_online && !u.is_active);
    }
    if (userSearch.trim()) {
      const q = userSearch.toLowerCase().trim();
      result = result.filter(
        (u) =>
          (u.name || '').toLowerCase().includes(q) ||
          (u.username || '').toLowerCase().includes(q) ||
          (u.email || '').toLowerCase().includes(q) ||
          (u.custom_id || '').toLowerCase().includes(q)
      );
    }
    return result;
  }, [users, userSearch, userStatusFilter]);

  const availableEventLocations = useMemo(() => {
    const locSet = new Set();
    events.forEach((ev) => {
      const loc = (ev.location || '').trim();
      if (loc) {
        const clean = loc.replace(/,\s*pune$/i, '').trim();
        if (clean && clean.toLowerCase() !== 'pune') {
          locSet.add(clean);
        }
      }
    });
    LOCATIONS.forEach((l) => {
      if (l.toLowerCase() !== 'pune') {
        locSet.add(l);
      }
    });
    return Array.from(locSet);
  }, [events]);

  const filteredEvents = useMemo(() => {
    let result = [...events];
    if (eventCategoryFilter !== 'all') {
      result = result.filter((e) => (e.category || '').toLowerCase() === eventCategoryFilter.toLowerCase());
    }
    if (eventLocationFilter !== 'all') {
      const targetLoc = eventLocationFilter.toLowerCase().trim();
      result = result.filter((e) => {
        const loc = (e.location || '').toLowerCase();
        const ven = (e.venue || '').toLowerCase();
        return loc.includes(targetLoc) || ven.includes(targetLoc);
      });
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
  }, [events, eventSearch, eventCategoryFilter, eventLocationFilter]);

  const filteredBookings = useMemo(() => {
    let result = [...bookings];
    if (bookingTypeFilter === 'paid') {
      result = result.filter((b) => Number(b.total ?? b.total_amount ?? 0) > 0 && b.payment_status !== 'Free Entry');
    } else if (bookingTypeFilter === 'free') {
      result = result.filter((b) => Number(b.total ?? b.total_amount ?? 0) === 0 || b.payment_status === 'Free Entry');
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
      {/* Real-time Floating Live Alert Popup with 7s auto fade-away */}
      {liveBanner && (
        <div
          className={`fixed top-24 right-4 sm:right-6 z-50 max-w-md w-[calc(100vw-2rem)] sm:w-96 rounded-3xl bg-white/95 dark:bg-[#1c2733]/95 border-2 border-emerald-500 shadow-2xl backdrop-blur p-4 sm:p-5 transition-all duration-700 ${
            isBannerFading
              ? 'opacity-0 -translate-y-3 scale-95 pointer-events-none'
              : 'opacity-100 translate-y-0 scale-100 animate-in slide-in-from-top-4 duration-300'
          }`}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="relative">
                <div className="grid h-11 w-11 place-items-center rounded-2xl bg-emerald-500 text-white font-black text-lg shadow-md shadow-emerald-500/30">
                  🎉
                </div>
                <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-500"></span>
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="rounded-full bg-emerald-100 dark:bg-emerald-950/60 px-2 py-0.5 text-[10px] font-black uppercase text-emerald-700 dark:text-emerald-300">
                    Live Registration
                  </span>
                  <span className="text-[10px] font-semibold text-slate-400">Auto-close in 7s</span>
                </div>
                <h4 className="mt-1 font-black text-sm text-ink dark:text-white truncate">
                  {liveBanner.title}
                </h4>
                <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-300 line-clamp-2">
                  {liveBanner.subtitle}
                </p>
              </div>
            </div>
            <button
              onClick={() => setLiveBanner(null)}
              className="grid h-7 w-7 place-items-center rounded-full text-slate-400 hover:bg-stone-100 hover:text-ink dark:hover:bg-slate-800 transition"
              title="Dismiss alert"
            >
              ✕
            </button>
          </div>

          {/* 7-Second Animated Countdown Bar */}
          <div className="mt-3.5 h-1 w-full overflow-hidden rounded-full bg-stone-100 dark:bg-slate-800">
            <div
              className="h-full bg-emerald-500 rounded-full origin-left"
              style={{
                animation: 'pulse 2s infinite, shrinkWidth 7s linear forwards',
              }}
            />
          </div>

          {liveBanner.user && (
            <div className="mt-3 pt-2.5 border-t border-stone-100 dark:border-slate-800 flex items-center justify-between gap-2">
              <button
                onClick={() => {
                  handleOpenUserDetails(liveBanner.user);
                  setLiveBanner(null);
                }}
                className="w-full rounded-xl bg-ink dark:bg-slate-700 py-2 text-xs font-bold text-white hover:bg-coral dark:hover:bg-coral transition"
              >
                View User Profile →
              </button>
            </div>
          )}
        </div>
      )}

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

          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            {/* Live SSE Sync Status Badge */}
            <div
              className={`flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs font-bold shadow-sm backdrop-blur transition ${
                liveStatus === 'connected'
                  ? 'border-emerald-200 bg-emerald-50/90 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300'
                  : liveStatus === 'connecting'
                  ? 'border-amber-200 bg-amber-50/90 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300'
                  : 'border-slate-200 bg-white/90 text-slate-600 dark:border-slate-700 dark:bg-[#101820] dark:text-slate-300'
              }`}
              title={
                liveStatus === 'connected'
                  ? 'Real-Time SSE Sync is Active. Live registrations appear instantly.'
                  : liveStatus === 'connecting'
                  ? 'Connecting live stream...'
                  : 'Offline (Fallback Polling Active)'
              }
            >
              {liveStatus === 'connected' ? (
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                </span>
              ) : liveStatus === 'connecting' ? (
                <span className="h-2.5 w-2.5 rounded-full bg-amber-500 animate-pulse"></span>
              ) : (
                <span className="h-2.5 w-2.5 rounded-full bg-slate-400"></span>
              )}
              <span className="whitespace-nowrap">
                {liveStatus === 'connected'
                  ? 'Live Sync Active'
                  : liveStatus === 'connecting'
                  ? 'Connecting...'
                  : 'Live Polling'}
              </span>
            </div>

            {/* Website Option */}
            <Link
              to="/"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 rounded-full border border-stone-300 bg-white px-3.5 py-1.5 text-xs font-bold text-slate-700 hover:border-coral hover:text-coral transition shadow-sm dark:border-slate-700 dark:bg-[#101820] dark:text-slate-200 dark:hover:border-coral dark:hover:text-coral"
              title="Open MAXSHOW Website Home Page to check live events"
            >
              <span>🌐</span>
              <span>Website</span>
            </Link>

            {/* Test Live Trigger Button */}
            <button
              onClick={handleTestLiveAlert}
              disabled={testingLive}
              className="flex items-center gap-1.5 rounded-full border border-purple-300 bg-purple-50 px-3.5 py-1.5 text-xs font-bold text-purple-700 hover:bg-purple-100 transition dark:border-purple-800/60 dark:bg-purple-950/40 dark:text-purple-300 disabled:opacity-50"
              title="Trigger a simulated real-time user registration to preview the live experience"
            >
              <span>🧪</span>
              <span className="hidden sm:inline">{testingLive ? 'Simulating...' : 'Test Live Alert'}</span>
            </button>

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
            <div className="mt-1 flex items-center gap-2 text-xs font-semibold">
              <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
                {stats.online_users || 0} online
              </span>
              <span className="text-slate-400">·</span>
              <span className="text-slate-500 dark:text-slate-400">
                {stats.offline_users || Math.max(0, (stats.users_count || 0) - (stats.online_users || 0))} offline
              </span>
            </div>
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
                <div className="relative flex items-center w-full sm:w-72">
                  <span className="absolute left-3 text-slate-400 dark:text-slate-500 text-sm pointer-events-none">🔍</span>
                  <input
                    type="text"
                    value={eventSearch}
                    onChange={(e) => setEventSearch(e.target.value)}
                    placeholder="Search events by title, venue..."
                    className="w-full rounded-xl border border-stone-300 bg-white pl-9 pr-8 py-2 text-xs sm:text-sm font-semibold outline-none focus:border-coral dark:border-slate-700 dark:bg-[#1c2733] dark:text-white shadow-sm"
                  />
                  {eventSearch && (
                    <button
                      type="button"
                      onClick={() => setEventSearch('')}
                      className="absolute right-2.5 text-xs text-slate-400 hover:text-ink dark:hover:text-white"
                    >
                      ✕
                    </button>
                  )}
                </div>
                <div className="w-40 sm:w-48">
                  <CategoryDropdown
                    value={eventCategoryFilter}
                    onChange={(val) => setEventCategoryFilter(val)}
                    includeAll={true}
                    allLabel="All Categories"
                  />
                </div>
                <div className="w-40 sm:w-48">
                  <LocationFilterDropdown
                    value={eventLocationFilter}
                    onChange={(val) => setEventLocationFilter(val)}
                    locations={availableEventLocations}
                    includeAll={true}
                    allLabel="All Locations"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleOpenAddEvent}
                  className="flex items-center gap-2 rounded-2xl bg-coral px-5 py-2.5 text-xs sm:text-sm font-bold text-white shadow-md hover:bg-[#df503c] transition"
                >
                  <span>＋</span>
                  <span>Add New Event</span>
                </button>
              </div>
            </div>

            {/* Events Grid */}
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {loading && events.length === 0 ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <div
                    key={`skeleton-event-${i}`}
                    className="overflow-hidden rounded-3xl border border-stone-200/80 bg-white p-4 shadow-sm dark:border-slate-700/80 dark:bg-[#1c2733] animate-pulse space-y-4"
                  >
                    <div className="h-44 w-full rounded-2xl bg-stone-200 dark:bg-slate-700" />
                    <div className="space-y-2">
                      <div className="h-4 w-3/4 rounded bg-stone-200 dark:bg-slate-700" />
                      <div className="h-3 w-1/2 rounded bg-stone-200 dark:bg-slate-700" />
                    </div>
                  </div>
                ))
              ) : filteredEvents.length === 0 ? (
                <div className="sm:col-span-2 lg:col-span-3 rounded-3xl border border-dashed border-stone-300 dark:border-slate-700 p-10 text-center space-y-3 bg-white/50 dark:bg-[#1c2733]/50">
                  <span className="text-4xl">🎪</span>
                  <h4 className="font-black text-ink dark:text-white text-base">No published events found</h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                    {eventSearch || eventCategoryFilter !== 'all' || eventLocationFilter !== 'all'
                      ? 'No events match your current search and filter criteria.'
                      : 'No events have been created yet.'}
                  </p>
                  {(eventSearch || eventCategoryFilter !== 'all' || eventLocationFilter !== 'all') && (
                    <button
                      type="button"
                      onClick={() => {
                        setEventSearch('');
                        setEventCategoryFilter('all');
                        setEventLocationFilter('all');
                      }}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-coral px-4 py-2 text-xs font-bold text-white hover:bg-[#df503c] transition shadow-sm"
                    >
                      Clear All Filters
                    </button>
                  )}
                </div>
              ) : (
                filteredEvents.map((ev) => (
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
                ))
              )}
            </div>
          </section>
        )}

        {/* TAB 2: Users Management */}
        {activeTab === 'users' && (
          <section className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative flex items-center w-full sm:w-72">
                  <span className="absolute left-3 text-slate-400 dark:text-slate-500 text-sm pointer-events-none">🔍</span>
                  <input
                    type="text"
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    placeholder="Search users by name, username, email..."
                    className="w-full rounded-xl border border-stone-300 bg-white pl-9 pr-8 py-2 text-xs sm:text-sm font-semibold outline-none focus:border-coral dark:border-slate-700 dark:bg-[#1c2733] dark:text-white shadow-sm"
                  />
                  {userSearch && (
                    <button
                      type="button"
                      onClick={() => setUserSearch('')}
                      className="absolute right-2.5 text-xs text-slate-400 hover:text-ink dark:hover:text-white"
                    >
                      ✕
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-1.5">
                  {[
                    { id: 'all', label: `All (${users.length})` },
                    { id: 'online', label: `🟢 Online (${stats.online_users || 0})` },
                    { id: 'offline', label: `⚪ Offline (${stats.offline_users || 0})` },
                  ].map((f) => (
                    <button
                      key={f.id}
                      onClick={() => setUserStatusFilter(f.id)}
                      className={`rounded-xl px-3 py-1.5 text-xs font-bold transition whitespace-nowrap ${
                        userStatusFilter === f.id
                          ? 'bg-ink text-white dark:bg-coral'
                          : 'border border-stone-300 bg-white text-slate-600 hover:border-coral dark:border-slate-700 dark:bg-[#1c2733] dark:text-slate-300'
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>
              <span className="text-xs font-bold text-slate-400">
                {filteredUsers.length} user{filteredUsers.length === 1 ? '' : 's'}
              </span>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filteredUsers.length === 0 ? (
                <div className="sm:col-span-2 lg:col-span-3 rounded-3xl border border-dashed border-stone-300 dark:border-slate-700 p-10 text-center space-y-2 bg-white/50 dark:bg-[#1c2733]/50">
                  <span className="text-4xl">👥</span>
                  <h4 className="font-black text-ink dark:text-white text-base">
                    {userStatusFilter === 'online'
                      ? 'No users currently online'
                      : userStatusFilter === 'offline'
                      ? 'No offline users found'
                      : 'No users found matching your search'}
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                    {userStatusFilter === 'online'
                      ? 'When a user logs into MAXSHOW, they will automatically appear here as Online with a live green indicator.'
                      : 'Try changing your search terms or filter.'}
                  </p>
                  {userStatusFilter !== 'all' && (
                    <button
                      onClick={() => setUserStatusFilter('all')}
                      className="mt-2 rounded-xl bg-ink dark:bg-slate-700 px-4 py-2 text-xs font-bold text-white hover:bg-coral transition"
                    >
                      Show All Users ({users.length})
                    </button>
                  )}
                </div>
              ) : (
                filteredUsers.map((u) => {
                  const initial = u.name?.charAt(0)?.toUpperCase() || 'U';
                  const isJustRegistered = newlyRegisteredUserIds.has(u.id);
                  const isOnline = Boolean(u.is_online || u.is_active);
                  return (
                    <div
                      key={u.id}
                      className={`flex flex-col justify-between rounded-3xl border p-5 shadow-sm transition-all duration-300 ${
                        isJustRegistered
                          ? 'border-emerald-500 ring-2 ring-emerald-400/40 bg-emerald-50/20 dark:bg-emerald-950/20 shadow-md animate-in zoom-in-95'
                          : isOnline
                          ? 'border-emerald-200/80 bg-white dark:border-emerald-900/40 dark:bg-[#1c2733]'
                          : 'border-stone-200/80 bg-white dark:border-slate-700/80 dark:bg-[#1c2733]'
                      }`}
                    >
                      <div>
                        <div className="flex items-start gap-3.5">
                          <div
                            className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl text-base font-black transition-all ${
                              isJustRegistered
                                ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/30 animate-pulse'
                                : isOnline
                                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300'
                                : 'bg-stone-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                            }`}
                          >
                            {initial}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <h4 className="font-black text-ink dark:text-white truncate">{u.name}</h4>
                              {isJustRegistered ? (
                                <span className="rounded-full bg-emerald-500 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-white shadow-sm animate-pulse">
                                  ✨ Live New
                                </span>
                              ) : isOnline ? (
                                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 dark:bg-emerald-950/60 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-300">
                                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                                  Online
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 rounded-full bg-stone-100 dark:bg-slate-800 px-2 py-0.5 text-[10px] font-semibold text-slate-500 dark:text-slate-400">
                                  <span className="h-1.5 w-1.5 rounded-full bg-slate-400"></span>
                                  Offline
                                </span>
                              )}
                            </div>
                            <p className="text-xs font-bold text-coral truncate">@{u.username}</p>
                            <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{u.email}</p>
                            <p className="mt-1 text-[11px] font-semibold text-slate-400">ID: {u.custom_id || `USR-${u.id}`}</p>
                          </div>
                        </div>
                      </div>

                      <div className="mt-4 flex items-center justify-between border-t border-stone-100 pt-3 dark:border-slate-700">
                        <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                          {u.bookings_count || 0} booking{(u.bookings_count || 0) === 1 ? '' : 's'}
                        </span>
                        <div className="flex items-center gap-1.5">
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
                })
              )}
            </div>
          </section>
        )}

        {/* TAB 3: Transactions Ledger */}
        {activeTab === 'bookings' && (
          <section className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative flex items-center w-full sm:w-72">
                  <span className="absolute left-3 text-slate-400 dark:text-slate-500 text-sm pointer-events-none">🔍</span>
                  <input
                    type="text"
                    value={bookingSearch}
                    onChange={(e) => setBookingSearch(e.target.value)}
                    placeholder="Search by code, user, event..."
                    className="w-full rounded-xl border border-stone-300 bg-white pl-9 pr-8 py-2 text-xs sm:text-sm font-semibold outline-none focus:border-coral dark:border-slate-700 dark:bg-[#1c2733] dark:text-white shadow-sm"
                  />
                  {bookingSearch && (
                    <button
                      type="button"
                      onClick={() => setBookingSearch('')}
                      className="absolute right-2.5 text-xs text-slate-400 hover:text-ink dark:hover:text-white"
                    >
                      ✕
                    </button>
                  )}
                </div>
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
                    const isFree = Number(b.total ?? b.total_amount ?? 0) === 0 || b.payment_status === 'Free Entry';
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
                          {isFree ? 'Free entry' : formatPrice(b.total ?? b.total_amount ?? 0)}
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
          <div className="w-full max-w-xl max-h-[90vh] overflow-y-auto overscroll-contain modal-scroll-contain rounded-[2.5rem] bg-white shadow-2xl dark:bg-[#1c2733] border border-stone-200 dark:border-slate-700 animate-in zoom-in-95 duration-150 p-6 sm:p-8 space-y-6 no-scrollbar">
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
                <p className="text-slate-400 font-bold uppercase text-[10px] tracking-wider">Account Status</p>
                <div className="mt-1 flex items-center gap-1.5">
                  {(selectedUser.is_online || selectedUser.is_active) ? (
                    <span className="inline-flex items-center gap-1 text-xs font-black text-emerald-600 dark:text-emerald-400">
                      <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
                      Online
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs font-bold text-slate-500 dark:text-slate-400">
                      <span className="h-2 w-2 rounded-full bg-slate-400"></span>
                      Offline
                    </span>
                  )}
                </div>
                <span className="text-[10px] text-slate-400 font-semibold">Live Session</span>
              </div>

              <div className="rounded-2xl bg-stone-50 p-3.5 dark:bg-[#151f2b] border border-stone-100 dark:border-slate-800">
                <p className="text-slate-400 font-bold uppercase text-[10px] tracking-wider">Total Spent</p>
                <p className="font-black text-coral text-base mt-0.5">
                  {formatPrice(
                    userBookings.reduce((sum, b) => sum + (Number(b.total ?? b.total_amount ?? 0) || 0), 0) || selectedUser.total_spent || 0
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
                <div className="max-h-56 overflow-y-auto overscroll-contain space-y-2.5 no-scrollbar pr-1">
                  {userBookings.map((b) => {
                    const isFreeBooking = Number(b.total ?? b.total_amount ?? 0) === 0 || b.payment_status === 'Free Entry';
                    return (
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
                              isFreeBooking
                                ? 'bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300'
                                : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                            }`}
                          >
                            {isFreeBooking ? 'Free Entry' : b.payment_status || 'Paid'}
                          </span>
                        </div>

                        <div className="flex items-center justify-between border-t border-stone-100 pt-2 dark:border-slate-800 text-[11px]">
                          <div className="flex items-center gap-3">
                            <span className="font-mono font-bold text-coral">#{b.booking_code || b.booking_id || `BKG-${b.id}`}</span>
                            <span className="font-bold text-slate-600 dark:text-slate-300">
                              {b.tickets || b.quantity || 1} pass{b.tickets > 1 ? 'es' : ''} · {isFreeBooking ? 'Free' : formatPrice(b.total ?? b.total_amount ?? 0)}
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
                    );
                  })}
                </div>
              )}
            </div>

            {/* Footer Actions */}
            <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
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
          <div className="w-full max-w-xl max-h-[90vh] overflow-y-auto overscroll-contain modal-scroll-contain rounded-[2.5rem] bg-white shadow-2xl dark:bg-[#1c2733] border border-stone-200 dark:border-slate-700 animate-in zoom-in-95 duration-150 p-6 sm:p-8 space-y-5">
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
                <CategoryDropdown
                  value={eventFormData.category}
                  onChange={(val) => setEventFormData({ ...eventFormData, category: val })}
                />
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
                <AreaDropdown
                  value={eventFormData.location}
                  onChange={(val) => setEventFormData({ ...eventFormData, location: val })}
                  placeholder="e.g. Hinjawadi, Pune"
                  required
                />
              </div>

              <div>
                <label className="mb-1 block font-bold text-ink dark:text-slate-200">Date</label>
                <CustomDatePicker
                  value={eventFormData.date}
                  onChange={(val) => setEventFormData({ ...eventFormData, date: val })}
                  placeholder="Select event date"
                  required
                />
              </div>

              <div>
                <label className="mb-1 block font-bold text-ink dark:text-slate-200">Time</label>
                <CustomTimePicker
                  value={eventFormData.clock}
                  onChange={(val) => setEventFormData({ ...eventFormData, clock: val })}
                  placeholder="Select event time"
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
