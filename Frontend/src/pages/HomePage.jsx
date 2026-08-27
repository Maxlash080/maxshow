import React, { useState, useEffect, useMemo } from 'react';
import { Navbar } from '../components/Navbar';
import { Footer } from '../components/Footer';
import { HeroShowcase } from '../components/HeroShowcase';
import { EventCard } from '../components/EventCard';
import { FilterModal } from '../components/FilterModal';
import { apiRequest } from '../utils/api';
import { FALLBACK_EVENTS, LOCATIONS } from '../utils/constants';
import { formatPrice, formatEventTime } from '../utils/formatters';
import { useNavigate } from 'react-router-dom';

const CATEGORIES = [
  { id: 'music', name: 'Music', icon: '🎵', bg: 'from-amber-500/20 to-orange-500/20' },
  { id: 'nightlife', name: 'Nightlife', icon: '🍸', bg: 'from-purple-500/20 to-pink-500/20' },
  { id: 'comedy', name: 'Comedy', icon: '🎭', bg: 'from-yellow-500/20 to-amber-500/20' },
  { id: 'move', name: 'Sports & Move', icon: '🏃', bg: 'from-emerald-500/20 to-teal-500/20' },
  { id: 'performances', name: 'Performances', icon: '🎪', bg: 'from-red-500/20 to-rose-500/20' },
  { id: 'food', name: 'Food & Drinks', icon: '🍜', bg: 'from-orange-500/20 to-red-500/20' },
  { id: 'fests', name: 'Fests & Fairs', icon: '🎡', bg: 'from-indigo-500/20 to-violet-500/20' },
  { id: 'social', name: 'Social Mixers', icon: '✨', bg: 'from-pink-500/20 to-purple-500/20' },
  { id: 'outdoors', name: 'Outdoors', icon: '🏕️', bg: 'from-cyan-500/20 to-blue-500/20' },
  { id: 'create', name: 'Workshops', icon: '🎨', bg: 'from-teal-500/20 to-emerald-500/20' },
  { id: 'screenings', name: 'Screenings', icon: '🎬', bg: 'from-blue-500/20 to-indigo-500/20' },
  { id: 'pets', name: 'Pets', icon: '🐾', bg: 'from-amber-500/20 to-yellow-500/20' },
];

const QUICK_FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'today', label: 'Today' },
  { id: 'tomorrow', label: 'Tomorrow' },
  { id: 'weekend', label: 'This Weekend' },
  { id: 'free', label: 'Free' },
  { id: 'under500', label: 'Under ₹500' },
];

export const HomePage = () => {
  const navigate = useNavigate();
  const [events, setEvents] = useState(Object.values(FALLBACK_EVENTS));
  const [currentLocation, setCurrentLocation] = useState('Pimpri-Chinchwad');
  const [activeQuickFilter, setActiveQuickFilter] = useState('all');
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [advancedFilters, setAdvancedFilters] = useState({ sort: 'popularity', genre: 'All Genres' });
  const [visibleCount, setVisibleCount] = useState(6);

  // Live real-time event updates state
  const [newlyAddedEventIds, setNewlyAddedEventIds] = useState(new Set());
  const [liveBanner, setLiveBanner] = useState(null);
  const [isBannerFading, setIsBannerFading] = useState(false);

  // Auto-dismiss live event banner after 7s with smooth fade
  useEffect(() => {
    if (!liveBanner) {
      setIsBannerFading(false);
      return;
    }
    setIsBannerFading(false);
    const fadeTimer = setTimeout(() => setIsBannerFading(true), 6300);
    const dismissTimer = setTimeout(() => {
      setLiveBanner(null);
      setIsBannerFading(false);
    }, 7000);
    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(dismissTimer);
    };
  }, [liveBanner]);

  // Initial events fetch + Live SSE real-time listener
  useEffect(() => {
    let isMounted = true;
    let eventSource = null;
    let reconnectTimeout = null;

    const fetchEvents = async () => {
      try {
        const data = await apiRequest('/api/events');
        if (isMounted && data && Array.isArray(data.events) && data.events.length > 0) {
          setEvents(data.events);
        }
      } catch (e) {
        console.error('[Home] Error fetching initial events:', e);
      }
    };

    fetchEvents();

    const connectLiveEvents = () => {
      if (!isMounted) return;
      try {
        eventSource = new EventSource('/api/events/live-stream');

        eventSource.addEventListener('connected', () => {
          console.log('[HomeLive] Connected to real-time events stream');
        });

        eventSource.addEventListener('events_updated', (e) => {
          if (!isMounted) return;
          try {
            const payload = JSON.parse(e.data);
            const action = payload.action;
            const ev = payload.event;

            if (action === 'create' && ev) {
              // 1. Instantly prepend new event so it shows at the very top of discovery & showcase
              setEvents((prev) => [
                ev,
                ...prev.filter((item) => item.id !== ev.id && item.slug !== ev.slug),
              ]);

              // 2. Mark as newly added for highlight
              setNewlyAddedEventIds((prev) => {
                const next = new Set(prev);
                next.add(ev.id);
                next.add(ev.slug);
                return next;
              });

              // Clear highlight badge after 30s
              setTimeout(() => {
                if (isMounted) {
                  setNewlyAddedEventIds((prev) => {
                    const next = new Set(prev);
                    next.delete(ev.id);
                    next.delete(ev.slug);
                    return next;
                  });
                }
              }, 30000);

              // 3. Show live banner notification
              setLiveBanner({
                id: Date.now(),
                title: '✨ New Experience Just Added!',
                subtitle: `${ev.title} is now live and open for bookings!`,
                event: ev,
              });
            } else if (action === 'update' && ev) {
              setEvents((prev) =>
                prev.map((item) =>
                  item.id === ev.id || item.slug === ev.slug ? { ...item, ...ev } : item
                )
              );
            } else if (action === 'delete' && payload.id) {
              setEvents((prev) => prev.filter((item) => item.id !== payload.id));
            } else {
              fetchEvents();
            }
          } catch (err) {
            console.error('[HomeLive] Error parsing events_updated payload:', err);
            fetchEvents();
          }
        });

        eventSource.onerror = () => {
          if (eventSource) {
            eventSource.close();
            eventSource = null;
          }
          if (isMounted) {
            reconnectTimeout = setTimeout(connectLiveEvents, 5000);
          }
        };
      } catch (err) {
        console.error('[HomeLive] Error setting up EventSource:', err);
        if (isMounted) {
          reconnectTimeout = setTimeout(connectLiveEvents, 5000);
        }
      }
    };

    connectLiveEvents();

    return () => {
      isMounted = false;
      if (eventSource) {
        eventSource.close();
      }
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
      }
    };
  }, []);

  // Filtered Events for "Location Picks" section
  const locationPicks = useMemo(() => {
    const clean = currentLocation.toLowerCase().trim();
    let matched = events.filter((e) => {
      const loc = (e.location || '').toLowerCase();
      const ven = (e.venue || '').toLowerCase();
      const tit = (e.title || '').toLowerCase();
      return loc.includes(clean) || ven.includes(clean) || tit.includes(clean);
    });

    if (matched.length < 3) {
      const seen = new Set(matched.map((e) => e.slug || e.id || e.title));
      for (const e of events) {
        const key = e.slug || e.id || e.title;
        if (!seen.has(key)) {
          matched.push(e);
          seen.add(key);
          if (matched.length >= 3) break;
        }
      }
    }
    return matched.slice(0, 3);
  }, [events, currentLocation]);

  // Filtered Events for Discovery Grid
  const filteredEvents = useMemo(() => {
    let result = [...events];

    // Search query filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (e) =>
          (e.title || '').toLowerCase().includes(q) ||
          (e.location || '').toLowerCase().includes(q) ||
          (e.venue || '').toLowerCase().includes(q) ||
          (e.category || '').toLowerCase().includes(q)
      );
    }

    // Category card filter
    if (selectedCategory) {
      result = result.filter(
        (e) => (e.category || '').toLowerCase() === selectedCategory.toLowerCase()
      );
    }

    // Quick filter pills
    if (activeQuickFilter === 'today') {
      result = result.filter((e) => e.day === 'today' || (e.time || '').toLowerCase().includes('today') || (e.time || '').toLowerCase().includes('tonight'));
    } else if (activeQuickFilter === 'tomorrow') {
      result = result.filter((e) => e.day === 'tomorrow' || (e.time || '').toLowerCase().includes('tomorrow'));
    } else if (activeQuickFilter === 'weekend') {
      result = result.filter((e) => e.day === 'weekend' || (e.time || '').toLowerCase().includes('saturday') || (e.time || '').toLowerCase().includes('sunday'));
    } else if (activeQuickFilter === 'free') {
      result = result.filter((e) => Number(e.price) === 0);
    } else if (activeQuickFilter === 'under500') {
      result = result.filter((e) => Number(e.price) > 0 && Number(e.price) <= 500);
    }

    // Sort order
    if (advancedFilters.sort === 'price_low_high') {
      result.sort((a, b) => (Number(a.price) || 0) - (Number(b.price) || 0));
    } else if (advancedFilters.sort === 'price_high_low') {
      result.sort((a, b) => (Number(b.price) || 0) - (Number(a.price) || 0));
    } else if (advancedFilters.sort === 'popularity') {
      result.sort((a, b) => (Number(b.rating_count) || 0) - (Number(a.rating_count) || 0));
    }

    return result;
  }, [events, searchQuery, selectedCategory, activeQuickFilter, advancedFilters]);

  const displayedEvents = filteredEvents.slice(0, visibleCount);

  return (
    <div className="min-h-screen bg-cream text-ink dark:bg-[#101820] dark:text-white flex flex-col">
      {/* Real-time Floating Live Event Added Banner with 7s auto fade-away */}
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
                  🎪
                </div>
                <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-500"></span>
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="rounded-full bg-emerald-100 dark:bg-emerald-950/60 px-2 py-0.5 text-[10px] font-black uppercase text-emerald-700 dark:text-emerald-300">
                    Live Event Added
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

          {liveBanner.event && (
            <div className="mt-3 pt-2.5 border-t border-stone-100 dark:border-slate-800 flex items-center justify-between gap-2">
              <button
                onClick={() => {
                  const slug = liveBanner.event.slug || liveBanner.event.id;
                  navigate(`/event/${encodeURIComponent(slug)}`);
                  setLiveBanner(null);
                }}
                className="w-full rounded-xl bg-ink dark:bg-slate-700 py-2 text-xs font-bold text-white hover:bg-coral dark:hover:bg-coral transition"
              >
                View Experience →
              </button>
            </div>
          )}
        </div>
      )}

      <Navbar currentLocation={currentLocation} onLocationChange={setCurrentLocation} />

      <main className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-6 space-y-12 flex-1">
        {/* Hero Section */}
        <section aria-label="Hero showcase">
          <HeroShowcase events={events} />
        </section>

        {/* Location Picks Section */}
        <section id="location-picks" aria-label="Top picks in your area">
          <div className="rounded-[2.5rem] bg-stone-900 p-6 sm:p-10 text-white shadow-soft">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-coral">
                  Save the date · {currentLocation}
                </p>
                <h2 className="mt-1 text-2xl sm:text-4xl font-black text-white">
                  Top picks in {currentLocation}
                </h2>
              </div>
              <p className="text-sm font-semibold text-slate-400">
                Curated happenings around {currentLocation}
              </p>
            </div>

            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {locationPicks.map((pick) => {
                const slug = pick.slug || pick.id;
                const time = formatEventTime(pick.time || '', pick.day);
                const priceText = formatPrice(pick.price);
                const type = pick.type || pick.event_type || 'Experience';
                return (
                  <article
                    key={slug}
                    onClick={() => navigate(`/event/${encodeURIComponent(slug)}`)}
                    className="cursor-pointer group overflow-hidden rounded-3xl bg-white text-ink dark:bg-[#1c2733] dark:text-white dark:border-slate-700 shadow-soft transition-all duration-300 hover:-translate-y-1.5 hover:shadow-2xl border border-stone-200/80"
                  >
                    <div className="relative h-52 w-full overflow-hidden bg-stone-100 dark:bg-stone-800">
                      <img
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                        src={pick.image}
                        alt={pick.title}
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent pointer-events-none" />
                      <div className="rating-badge absolute top-3.5 right-3.5 z-10 flex items-center gap-1 rounded-full bg-ink/80 backdrop-blur-md px-2.5 py-1 text-xs font-black text-amber-300 shadow-md ring-1 ring-white/15 dark:bg-black/80 pointer-events-none">
                        <span className="text-amber-400">★</span>
                        <span>{(Number(pick.rating) || 4.8).toFixed(1)}</span>
                      </div>
                    </div>
                    <div className="p-5">
                      <p className="text-xs font-bold uppercase tracking-wider text-coral">
                        {type} {time ? `· ${time}` : ''}
                      </p>
                      <h3 className="mt-2 text-xl font-black text-ink dark:text-white line-clamp-1 group-hover:text-coral transition-colors">
                        {pick.title}
                      </h3>
                      <p className="mt-2 text-sm text-slate-500 dark:text-slate-400 font-semibold">
                        {pick.location || pick.venue} · <span className="text-ink dark:text-white font-bold">{priceText}</span>
                      </p>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        {/* Categories Bar */}
        <section id="categories" aria-label="Categories">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl sm:text-2xl font-black text-ink dark:text-white">Explore Categories</h2>
            {selectedCategory && (
              <button
                onClick={() => setSelectedCategory(null)}
                className="text-xs font-bold text-coral hover:underline"
              >
                Reset category
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(selectedCategory === cat.id ? null : cat.id)}
                type="button"
                className={`flex items-center justify-center gap-2.5 rounded-2xl px-4 py-3 text-sm font-bold transition-all duration-200 border ${
                  selectedCategory === cat.id
                    ? 'bg-coral text-white border-coral shadow-md scale-[1.02]'
                    : 'bg-white text-ink border-stone-200/80 hover:border-coral/40 dark:bg-[#1c2733] dark:text-white dark:border-slate-700 hover:shadow-sm hover:-translate-y-0.5'
                }`}
              >
                <span className="text-lg">{cat.icon}</span>
                <span className="truncate">{cat.name}</span>
              </button>
            ))}
          </div>
        </section>

        {/* All Events Discovery Section */}
        <section id="discover" aria-label="Discover all events" className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl sm:text-3xl font-black text-ink dark:text-white">Discover Everything</h2>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-semibold mt-0.5">
                Showing {filteredEvents.length} experience{filteredEvents.length === 1 ? '' : 's'}
              </p>
            </div>

            {/* Search Input */}
            <div className="relative w-full sm:w-72">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search events, artists, venues..."
                className="w-full rounded-full border border-stone-300 bg-white px-4 py-2.5 pl-10 text-xs sm:text-sm font-semibold outline-none transition focus:border-coral focus:ring-2 focus:ring-coral/20 dark:border-slate-700 dark:bg-[#1c2733] dark:text-white"
              />
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm">🔍</span>
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-ink dark:hover:text-white text-xs"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* Quick Filters Row + District Filter Button */}
          <div className="flex items-center justify-between gap-3 overflow-x-auto pb-2 no-scrollbar">
            <div className="flex items-center gap-2">
              {QUICK_FILTERS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setActiveQuickFilter(f.id)}
                  className={`rounded-full px-4 py-2 text-xs sm:text-sm font-bold transition whitespace-nowrap ${
                    activeQuickFilter === f.id
                      ? 'bg-ink text-white dark:bg-coral'
                      : 'border border-stone-300 bg-white text-slate-700 hover:border-coral dark:border-slate-700 dark:bg-[#1c2733] dark:text-slate-300'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {/* Filter Modal Button */}
            <button
              onClick={() => setIsFilterModalOpen(true)}
              type="button"
              className="flex items-center gap-1.5 shrink-0 rounded-full border border-stone-300 bg-white px-4 py-2 text-xs sm:text-sm font-bold shadow-sm hover:border-coral hover:text-coral transition dark:border-slate-700 dark:bg-[#1c2733] dark:text-white"
            >
              <span>⚙️</span>
              <span>Filters</span>
              {(advancedFilters.sort !== 'popularity' || advancedFilters.genre !== 'All Genres') && (
                <span className="h-2 w-2 rounded-full bg-coral"></span>
              )}
            </button>
          </div>

          {/* Events Grid */}
          {displayedEvents.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-stone-300 p-12 text-center dark:border-slate-700">
              <span className="text-4xl">🎭</span>
              <h3 className="mt-3 text-lg font-black text-ink dark:text-white">No experiences found</h3>
              <p className="mt-1 text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                Try selecting a different filter or search term.
              </p>
              <button
                onClick={() => {
                  setSearchQuery('');
                  setActiveQuickFilter('all');
                  setSelectedCategory(null);
                  setAdvancedFilters({ sort: 'popularity', genre: 'All Genres' });
                }}
                className="mt-4 rounded-full bg-coral px-5 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-[#df503c] transition"
              >
                Clear all filters
              </button>
            </div>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {displayedEvents.map((event) => (
                <EventCard
                  key={event.slug || event.id}
                  event={event}
                  isNewLive={newlyAddedEventIds.has(event.id) || newlyAddedEventIds.has(event.slug)}
                />
              ))}
            </div>
          )}

          {/* Load More Button */}
          {visibleCount < filteredEvents.length && (
            <div className="text-center pt-4">
              <button
                onClick={() => setVisibleCount((prev) => prev + 6)}
                type="button"
                className="rounded-2xl border border-stone-300 bg-white px-6 py-3 text-sm font-bold text-slate-700 shadow-sm transition hover:border-coral hover:bg-stone-50 dark:border-slate-700 dark:bg-[#1c2733] dark:text-slate-300 dark:hover:bg-slate-800"
              >
                Load more experiences ({filteredEvents.length - visibleCount} remaining)
              </button>
            </div>
          )}
        </section>
      </main>

      <Footer />

      <FilterModal
        isOpen={isFilterModalOpen}
        onClose={() => setIsFilterModalOpen(false)}
        filters={advancedFilters}
        onApply={(newFilters) => setAdvancedFilters(newFilters)}
      />
    </div>
  );
};
