import React, { useState, useEffect, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { Navbar } from '../components/Navbar';
import { Footer } from '../components/Footer';
import { EventCard } from '../components/EventCard';
import { apiRequest } from '../utils/api';
import { FALLBACK_EVENTS, parseLocationStateAndCity } from '../utils/constants';

const FILTER_CATEGORIES = [
  { id: 'all', label: 'All Experiences' },
  { id: 'music', label: 'Music & Concerts' },
  { id: 'move', label: 'Esports & Gaming' },
  { id: 'nightlife', label: 'Dance & Nightlife' },
  { id: 'comedy', label: 'Stand-up Comedy' },
  { id: 'fests', label: 'Fests & Expos' },
  { id: 'outdoors', label: 'Outdoors' },
  { id: 'food', label: 'Food & Drinks' },
];

const getStoredEvents = () => {
  try {
    const raw = sessionStorage.getItem('MAXSHOW_EVENTS_CACHE');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length >= 20) return parsed;
    }
  } catch (_) {}
  return Object.values(FALLBACK_EVENTS);
};

export const AllEventsPage = () => {
  const routeLocation = useLocation();
  const [events, setEvents] = useState(getStoredEvents);
  const [activeFilter, setActiveFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  // Always default to 'All' so clicking 'All events' shows all events across India
  const [currentLocation, setCurrentLocation] = useState('All');

  useEffect(() => {
    // Reset location to All when navigating to All Events page
    setCurrentLocation('All');
  }, [routeLocation.key, routeLocation.pathname]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    let isMounted = true;
    let eventSource = null;

    apiRequest('/api/events')
      .then((data) => {
        if (isMounted && data && Array.isArray(data.events) && data.events.length > 0) {
          setEvents(data.events);
          try {
            sessionStorage.setItem('MAXSHOW_EVENTS_CACHE', JSON.stringify(data.events));
          } catch (_) {}
        }
      })
      .catch(() => {});

    try {
      eventSource = new EventSource('/api/events/live-stream');
      eventSource.addEventListener('events_updated', (e) => {
        if (!isMounted) return;
        try {
          const payload = JSON.parse(e.data);
          const action = payload.action;
          const ev = payload.event;
          if (action === 'create' && ev) {
            setEvents((prev) => [ev, ...prev.filter((item) => item.id !== ev.id && item.slug !== ev.slug)]);
          } else if (action === 'update' && ev) {
            setEvents((prev) => {
              const next = prev.map((item) => (item.id === ev.id || item.slug === ev.slug ? { ...item, ...ev } : item));
              try {
                sessionStorage.setItem('MAXSHOW_EVENTS_CACHE', JSON.stringify(next));
              } catch (_) {}
              return next;
            });
          } else if (action === 'delete' && ev) {
            setEvents((prev) => {
              const next = prev.filter((item) => item.id !== ev.id && item.slug !== ev.slug);
              try {
                sessionStorage.setItem('MAXSHOW_EVENTS_CACHE', JSON.stringify(next));
              } catch (_) {}
              return next;
            });
          }
        } catch (_) {}
      });
    } catch (_) {}

    return () => {
      isMounted = false;
      if (eventSource) eventSource.close();
    };
  }, []);

  const handleLocationChange = (newLoc) => {
    setCurrentLocation(newLoc);
    try {
      localStorage.setItem('MAXSHOW_USER_LOCATION', newLoc);
    } catch (_) {}
  };

  const availableLocations = useMemo(() => {
    const locSet = new Set();
    events.forEach((e) => {
      const locParsed = parseLocationStateAndCity(e.location || '');
      const cleanState = (e.state || locParsed.state || '').trim();
      const cleanCity = (e.city || locParsed.city || '').trim();
      if (cleanState && cleanCity) {
        locSet.add(`${cleanState}, ${cleanCity}`);
      } else if (cleanCity) {
        locSet.add(cleanCity);
      }
    });
    return Array.from(locSet).sort((a, b) => a.localeCompare(b));
  }, [events]);

  const filtered = useMemo(() => {
    let list = events;

    // Location Filter
    if (currentLocation && currentLocation !== 'All' && currentLocation !== 'All Cities') {
      const cleanLoc = currentLocation.toLowerCase().trim();
      list = list.filter((e) => {
        const c = (e.city || '').toLowerCase().trim();
        const s = (e.state || '').toLowerCase().trim();
        const loc = (e.location || '').toLowerCase();
        const ven = (e.venue || '').toLowerCase();
        const { state, city } = parseLocationStateAndCity(e.location || '');
        const altC = (city || '').toLowerCase().trim();
        const altS = (state || '').toLowerCase().trim();
        return (
          c === cleanLoc ||
          altC === cleanLoc ||
          s === cleanLoc ||
          altS === cleanLoc ||
          loc.includes(cleanLoc) ||
          ven.includes(cleanLoc)
        );
      });
    }

    // Category Filter
    if (activeFilter !== 'all') {
      list = list.filter(
        (e) => (e.category || '').toLowerCase() === activeFilter.toLowerCase()
      );
    }

    // Search Query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (e) =>
          (e.title || '').toLowerCase().includes(q) ||
          (e.city || '').toLowerCase().includes(q) ||
          (e.state || '').toLowerCase().includes(q) ||
          (e.location || '').toLowerCase().includes(q) ||
          (e.venue || '').toLowerCase().includes(q) ||
          (e.category || '').toLowerCase().includes(q) ||
          (e.type || '').toLowerCase().includes(q) ||
          (e.description || '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [events, activeFilter, searchQuery, currentLocation]);

  return (
    <div className="min-h-screen bg-cream text-ink dark:bg-[#101820] dark:text-white flex flex-col">
      <Navbar
        currentLocation={currentLocation === 'All' ? 'All Cities' : currentLocation}
        onLocationChange={handleLocationChange}
        availableLocations={availableLocations}
      />

      <main className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-8 space-y-8 flex-1">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-3xl sm:text-4xl font-black text-ink dark:text-white">All Experiences</h1>
              {currentLocation && currentLocation !== 'All' && (
                <span className="inline-flex items-center gap-1 text-xs font-bold bg-coral/10 text-coral px-3 py-1 rounded-full border border-coral/20">
                  📍 {currentLocation}
                  <button
                    type="button"
                    onClick={() => handleLocationChange('All')}
                    className="ml-1 hover:text-ink dark:hover:text-white"
                  >
                    ✕
                  </button>
                </span>
              )}
            </div>
            <p className="mt-1 text-xs sm:text-sm font-semibold text-slate-500 dark:text-slate-400">
              {filtered.length} upcoming experience{filtered.length === 1 ? '' : 's'} across India
            </p>
          </div>

          {/* Search Bar with Icon */}
          <div className="relative w-full sm:w-80">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm pointer-events-none">🔍</span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search artists, esports, cities..."
              className="w-full rounded-full border border-stone-300 bg-white px-4 py-2.5 pl-10 pr-8 text-xs sm:text-sm font-semibold outline-none transition focus:border-coral focus:ring-2 focus:ring-coral/20 dark:border-slate-700 dark:bg-[#1c2733] dark:text-white shadow-sm"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-ink dark:hover:text-white text-xs"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Category Pills */}
        <div className="flex gap-2.5 overflow-x-auto pb-2 no-scrollbar">
          {FILTER_CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveFilter(cat.id)}
              className={`rounded-full px-5 py-2 text-xs sm:text-sm font-bold transition whitespace-nowrap cursor-pointer ${
                activeFilter === cat.id
                  ? 'bg-coral text-white shadow-sm shadow-coral/25'
                  : 'border border-stone-300 bg-white text-slate-700 hover:border-coral hover:text-coral dark:border-slate-700 dark:bg-[#1c2733] dark:text-slate-300'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Events Grid */}
        {filtered.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-stone-300 p-12 text-center dark:border-slate-700 space-y-3">
            <span className="text-5xl block">🎪</span>
            <h3 className="text-xl font-black text-ink dark:text-white">No experiences found</h3>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto">
              {currentLocation && currentLocation !== 'All'
                ? `No events currently listed in ${currentLocation}. Try switching locations or selecting 'All Cities'.`
                : 'Try adjusting your search query or category filter.'}
            </p>
            {currentLocation && currentLocation !== 'All' && (
              <button
                type="button"
                onClick={() => handleLocationChange('All')}
                className="inline-flex items-center gap-2 rounded-xl bg-coral px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-[#e24a36] transition cursor-pointer"
              >
                Show All Cities Events
              </button>
            )}
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((event) => (
              <EventCard key={event.slug || event.id} event={event} />
            ))}
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
};
