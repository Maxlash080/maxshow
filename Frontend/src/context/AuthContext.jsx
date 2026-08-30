import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { apiRequest } from '../utils/api';
import { useToast } from './ToastContext';

const INACTIVITY_TIMEOUT_MS = 60 * 1000; // 1 minute (60,000 ms)
const HEARTBEAT_INTERVAL_MS = 15 * 1000; // 15 seconds

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
    const now = Date.now();
    lastActivityRef.current = now;
    try {
      localStorage.setItem('MAXSHOW_LAST_ACTIVITY', String(now));
    } catch (_) {}
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
        recordActivity();
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
  }, [recordActivity]);

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

  const logout = useCallback(async (isAutoLogout = false) => {
    try {
      await apiRequest('/api/auth/logout', { method: 'POST' });
    } catch (_) {}
    try {
      await apiRequest('/api/admin/logout', { method: 'POST' });
    } catch (_) {}
    setUser(null);
    setIsAdmin(false);
    setUserRatings({});
    if (isAutoLogout) {
      showToast('You have been logged out due to 1 minute of inactivity.');
    } else {
      showToast('You have been signed out.');
    }
  }, [showToast]);

  // Movement & Inactivity Detector (Auto-logs out user if no movement/interaction or tab minimized/hidden for 1 minute)
  useEffect(() => {
    if (!user) return;

    recordActivity();

    let lastThrottledTime = 0;
    const handleUserInteraction = () => {
      // Only record activity if the tab is visible to prevent background activity simulations
      if (document.visibilityState === 'visible') {
        const now = Date.now();
        if (now - lastThrottledTime > 300) {
          lastThrottledTime = now;
          recordActivity();
        }
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        let lastAct = lastActivityRef.current;
        try {
          const stored = Number(localStorage.getItem('MAXSHOW_LAST_ACTIVITY'));
          if (stored && !isNaN(stored)) {
            lastAct = Math.max(lastAct, stored);
          }
        } catch (_) {}

        if (Date.now() - lastAct >= INACTIVITY_TIMEOUT_MS) {
          logout(true);
        } else {
          recordActivity();
          // Send an immediate heartbeat to refresh presence on backend
          apiRequest('/api/auth/heartbeat', { method: 'POST' }).catch(() => {});
        }
      }
    };

    const handlePageHide = () => {
      // Send quick logout beacon on page unload/close if supported
      try {
        if (navigator.sendBeacon) {
          navigator.sendBeacon('/api/auth/logout');
        }
      } catch (_) {}
    };

    const events = [
      'mousemove',
      'mousedown',
      'mouseup',
      'keydown',
      'keyup',
      'touchstart',
      'touchmove',
      'touchend',
      'scroll',
      'click',
      'wheel',
      'pointermove',
      'pointerdown',
      'focus',
    ];

    events.forEach((evt) => {
      window.addEventListener(evt, handleUserInteraction, { passive: true });
    });
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pagehide', handlePageHide);

    // Check inactivity every second
    const inactivityInterval = setInterval(() => {
      if (!userRef.current) return;

      let lastAct = lastActivityRef.current;
      try {
        const stored = Number(localStorage.getItem('MAXSHOW_LAST_ACTIVITY'));
        if (stored && !isNaN(stored) && stored > lastAct) {
          lastAct = stored;
          lastActivityRef.current = stored;
        }
      } catch (_) {}

      const elapsed = Date.now() - lastAct;
      if (elapsed >= INACTIVITY_TIMEOUT_MS) {
        logout(true);
      }
    }, 1000);

    // Periodic Heartbeat (Every 15 seconds ONLY when tab is visible & user is active within 1 minute)
    const heartbeatInterval = setInterval(() => {
      if (!userRef.current) return;
      if (document.visibilityState !== 'visible') return;

      const elapsed = Date.now() - lastActivityRef.current;
      if (elapsed < INACTIVITY_TIMEOUT_MS) {
        apiRequest('/api/auth/heartbeat', { method: 'POST' }).catch(() => {});
      }
    }, HEARTBEAT_INTERVAL_MS);

    return () => {
      events.forEach((evt) => {
        window.removeEventListener(evt, handleUserInteraction);
      });
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pagehide', handlePageHide);
      clearInterval(inactivityInterval);
      clearInterval(heartbeatInterval);
    };
  }, [user, logout, recordActivity]);

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
