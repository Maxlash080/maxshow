import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { apiRequest } from '../utils/api';
import { useToast } from './ToastContext';

const INACTIVITY_TIMEOUT_MS = 2 * 60 * 1000; // 2 minutes (120,000 ms)
const HEARTBEAT_INTERVAL_MS = 35 * 1000; // 35 seconds

const AuthContext = createContext({
  user: null,
  isAuthenticated: false,
  isAdmin: false,
  bookmarkedIds: [],
  userRatings: {},
  setUserRating: () => {},
  toggleBookmark: async () => {},
  refreshAuth: async () => {},
  logout: async () => {},
  recordActivity: () => {},
});

const getStoredBookmarks = () => {
  try {
    const raw = localStorage.getItem('MAXSHOW_BOOKMARKS');
    return raw ? JSON.parse(raw) : [];
  } catch (_) {
    return [];
  }
};

const setStoredBookmarks = (ids) => {
  try {
    localStorage.setItem('MAXSHOW_BOOKMARKS', JSON.stringify(ids));
  } catch (_) {}
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [bookmarkedIds, setBookmarkedIds] = useState(getStoredBookmarks());
  const [userRatings, setUserRatings] = useState({});
  const [loading, setLoading] = useState(true);
  const { showToast } = useToast();

  const lastActivityRef = useRef(Date.now());
  const userRef = useRef(null);
  userRef.current = user;

  const recordActivity = useCallback(() => {
    lastActivityRef.current = Date.now();
  }, []);

  const setUserRating = useCallback((eventId, eventSlug, rating) => {
    setUserRatings((prev) => {
      const next = { ...prev };
      if (rating === null || rating === undefined) {
        if (eventId) delete next[eventId];
        if (eventSlug) delete next[eventSlug];
      } else {
        if (eventId) next[eventId] = Number(rating);
        if (eventSlug) next[eventSlug] = Number(rating);
      }
      return next;
    });
  }, []);

  const refreshAuth = useCallback(async () => {
    let currentAdmin = false;
    try {
      const adminData = await apiRequest('/api/admin/me');
      if (adminData && adminData.admin) {
        currentAdmin = true;
      }
    } catch (_) {}

    try {
      const authData = await apiRequest('/api/auth/me');
      if (authData && authData.user) {
        setUser(authData.user);
        setIsAdmin(Boolean(authData.user.is_admin || authData.user.username === 'admin'));
        lastActivityRef.current = Date.now();
      } else {
        setUser(null);
        setIsAdmin(currentAdmin);
        setUserRatings({});
      }
    } catch (_) {
      setUser(null);
      setIsAdmin(currentAdmin);
      setUserRatings({});
    }

    try {
      const state = await apiRequest('/api/user/state');
      if (state) {
        if (Array.isArray(state.bookmarked_event_ids)) {
          const combined = Array.from(new Set([...getStoredBookmarks(), ...state.bookmarked_event_ids]));
          setBookmarkedIds(combined);
          setStoredBookmarks(combined);
        }
        const ratingsMap = {};
        if (state.user_ratings && typeof state.user_ratings === 'object') {
          Object.assign(ratingsMap, state.user_ratings);
        }
        if (state.user_ratings_by_slug && typeof state.user_ratings_by_slug === 'object') {
          Object.assign(ratingsMap, state.user_ratings_by_slug);
        }
        setUserRatings(ratingsMap);
      }
    } catch (_) {}

    setLoading(false);
  }, []);

  useEffect(() => {
    refreshAuth();
  }, [refreshAuth]);

  const toggleBookmark = useCallback(async (eventId, eventSlug) => {
    recordActivity();
    if (!eventId && !eventSlug) return;
    const targetId = eventId && !isNaN(Number(eventId)) ? Number(eventId) : null;
    const targetSlug = eventSlug ? String(eventSlug).trim() : null;

    let stored = getStoredBookmarks();
    const isCurrentlyIn = (targetId && stored.includes(targetId)) || (targetSlug && stored.includes(targetSlug));

    // Optimistic toggle
    let newStored;
    if (isCurrentlyIn) {
      newStored = stored.filter((x) => x !== targetId && x !== targetSlug);
      showToast('Removed from bookmarks.');
    } else {
      newStored = [...stored];
      if (targetId && !newStored.includes(targetId)) newStored.push(targetId);
      if (targetSlug && !newStored.includes(targetSlug)) newStored.push(targetSlug);
      showToast('Saved to your bookmarks! 🔖');
    }
    setStoredBookmarks(newStored);
    setBookmarkedIds(newStored);

    try {
      const payload = {};
      if (targetId) payload.event_id = targetId;
      if (targetSlug) payload.event_slug = targetSlug;

      const res = await apiRequest('/api/bookmarks/toggle', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      const actualId = Number(res.event_id || targetId);
      if (res.bookmarked) {
        if (actualId && !newStored.includes(actualId)) {
          newStored.push(actualId);
          setStoredBookmarks(newStored);
          setBookmarkedIds([...newStored]);
        }
      } else {
        if (actualId) {
          newStored = newStored.filter((x) => x !== actualId && x !== targetSlug);
          setStoredBookmarks(newStored);
          setBookmarkedIds([...newStored]);
        }
      }
    } catch (err) {
      const errMsg = err.message ? err.message.toLowerCase() : '';
      if (errMsg.includes('sign in') || errMsg.includes('authenticated') || errMsg.includes('unauthorized') || errMsg.includes('401')) {
        showToast(isCurrentlyIn ? 'Removed from bookmarks.' : 'Bookmarked! Sign in to sync with your account 🔖');
      }
    }
  }, [showToast, recordActivity]);

  const logout = useCallback(async (reason = '') => {
    try {
      await apiRequest('/api/auth/logout', { method: 'POST' });
    } catch (_) {}
    try {
      await apiRequest('/api/admin/logout', { method: 'POST' });
    } catch (_) {}
    setUser(null);
    setIsAdmin(false);
    if (reason === 'inactivity') {
      showToast('You have been logged out due to 2 minutes of inactivity.');
    } else {
      showToast('You have been signed out.');
    }
  }, [showToast]);

  // Global Inactivity & Movement Detection for Logged-In User
  useEffect(() => {
    if (!user) return;

    let lastThrottledTime = 0;
    const handleUserInteraction = () => {
      const now = Date.now();
      if (now - lastThrottledTime > 1000) {
        lastThrottledTime = now;
        lastActivityRef.current = now;
      }
    };

    const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'click', 'wheel'];
    events.forEach((evt) => {
      window.addEventListener(evt, handleUserInteraction, { passive: true });
    });

    // Inactivity Checker Loop (Runs every 2.5 seconds)
    const inactivityInterval = setInterval(() => {
      if (Date.now() - lastActivityRef.current >= INACTIVITY_TIMEOUT_MS) {
        console.log('[Inactivity] 2 minutes without user movement detected. Logging out...');
        logout('inactivity');
      }
    }, 2500);

    // Heartbeat Ping (Refreshes server session every 35s while user is active)
    const heartbeatInterval = setInterval(() => {
      if (Date.now() - lastActivityRef.current < INACTIVITY_TIMEOUT_MS - 10000) {
        apiRequest('/api/auth/heartbeat', { method: 'POST' }).catch(() => {});
      }
    }, HEARTBEAT_INTERVAL_MS);

    return () => {
      events.forEach((evt) => {
        window.removeEventListener(evt, handleUserInteraction);
      });
      clearInterval(inactivityInterval);
      clearInterval(heartbeatInterval);
    };
  }, [user, logout]);

  // Handle Tab/Browser Exit - Send instant beacon to update admin dashboard to Offline immediately
  useEffect(() => {
    const handleTabExit = () => {
      if (userRef.current) {
        try {
          if (navigator.sendBeacon) {
            navigator.sendBeacon('/api/auth/logout');
          } else {
            fetch('/api/auth/logout', { method: 'POST', keepalive: true, credentials: 'include' }).catch(() => {});
          }
        } catch (_) {}
      }
    };

    window.addEventListener('beforeunload', handleTabExit);
    window.addEventListener('pagehide', handleTabExit);

    return () => {
      window.removeEventListener('beforeunload', handleTabExit);
      window.removeEventListener('pagehide', handleTabExit);
    };
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: Boolean(user),
        isAdmin,
        bookmarkedIds,
        userRatings,
        setUserRating,
        toggleBookmark,
        refreshAuth,
        logout,
        recordActivity,
        loading,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
