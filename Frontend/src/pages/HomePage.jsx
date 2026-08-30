import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Navbar } from '../components/Navbar';
import { Footer } from '../components/Footer';
import { HeroShowcase } from '../components/HeroShowcase';
import { EventCard } from '../components/EventCard';
import { PopularEvents } from '../components/popular_events';
import { Categories, CATEGORIES } from '../components/categories';
import { FilterModal } from '../components/FilterModal';
import { apiRequest } from '../utils/api';
import { FALLBACK_EVENTS, parseLocationStateAndCity } from '../utils/constants';
import { formatPrice, formatEventTime } from '../utils/formatters';
import { useNavigate } from 'react-router-dom';

const QUICK_FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'today', label: 'Today' },
  { id: 'tomorrow', label: 'Tomorrow' },
  { id: 'weekend', label: 'This Weekend' },
  { id: 'free', label: 'Free' },
  { id: 'under500', label: 'Under ₹500' },
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

export const HomePage = () => {
  const navigate = useNavigate();
  const [events, setEvents] = useState(getStoredEvents);
  const [currentLocation, setCurrentLocation] = useState(() => {
    const saved = localStorage.getItem('MAXSHOW_USER_LOCATION');
    if (!saved || saved === 'All' || saved === 'All Cities') return 'Maharashtra, Mumbai';
    const { state, city } = parseLocationStateAndCity(saved);
    return state && city ? `${state}, ${city}` : saved;
  });
  const [activeQuickFilter, setActiveQuickFilter] = useState('all');
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [advancedFilters, setAdvancedFilters] = useState({ sort: 'popularity', genre: 'All Genres' });
  const [visibleCount, setVisibleCount] = useState(6);

  const handleLocationChange = (newLoc) => {
    setCurrentLocation(newLoc);
    try {
      localStorage.setItem('MAXSHOW_USER_LOCATION', newLoc);
    } catch (_) {}
  };

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

  // Ensure scroll is unlocked and visible count reset on filter change
  useEffect(() => {
    setVisibleCount(6);
    document.body.style.overflow = '';
    document.body.style.paddingRight = '';
    document.documentElement.style.overflow = '';
  }, [selectedCategory, activeQuickFilter, searchQuery, advancedFilters]);

  // Ensure body scroll is unlocked when filter modal closes
  useEffect(() => {
    if (!isFilterModalOpen) {
      document.body.style.overflow = '';
      document.body.style.paddingRight = '';
      document.documentElement.style.overflow = '';
    }
  }, [isFilterModalOpen]);

  // Handle hash scrolling on landing (e.g. /#city-picks or /#categories)
  useEffect(() => {
    if (window.location.hash) {
      const id = window.location.hash.replace('#', '');
      const timer = setTimeout(() => {
        const el = document.getElementById(id);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 300);
      return () => clearTimeout(timer);
    }
  }, []);

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
          try {
            sessionStorage.setItem('MAXSHOW_EVENTS_CACHE', JSON.stringify(data.events));
          } catch (_) {}
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
              setEvents((prev) => [
                ev,
                ...prev.filter((item) => item.id !== ev.id && item.slug !== ev.slug),
              ]);

              setNewlyAddedEventIds((prev) => {
                const next = new Set(prev);
                next.add(ev.id);
                next.add(ev.slug);
                return next;
              });

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

              setLiveBanner({
                id: Date.now(),
                title: '✨ New Experience Just Added!',
                subtitle: `${ev.title} is now live and open for bookings!`,
                event: ev,
              });
            } else if (action === 'update' && ev) {
              setEvents((prev) => {
                const next = prev.map((item) =>
                  item.id === ev.id || item.slug === ev.slug ? { ...item, ...ev } : item
                );
                try {
                  sessionStorage.setItem('MAXSHOW_EVENTS_CACHE', JSON.stringify(next));
                } catch (_) {}
                return next;
              });
            } else if (action === 'delete' && payload.id) {
              setEvents((prev) => {
                const next = prev.filter((item) => item.id !== payload.id);
                try {
                  sessionStorage.setItem('MAXSHOW_EVENTS_CACHE', JSON.stringify(next));
                } catch (_) {}
                return next;
              });
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

  const activeLocations = useMemo(() => {
    const locMap = new Map();

    events.forEach((e) => {
      const locParsed = parseLocationStateAndCity(e.location || '');
      const cleanState = (e.state || locParsed.state || '').trim();
      const cleanCity = (e.city || locParsed.city || '').trim();

      if (cleanState && cleanCity) {
        const label = `${cleanState}, ${cleanCity}`;
        locMap.set(label.toLowerCase(), label);
      } else if (cleanCity) {
        locMap.set(cleanCity.toLowerCase(), cleanCity);
      }
    });

    return Array.from(locMap.values()).sort((a, b) => a.localeCompare(b));
  }, [events]);

  const filteredEvents = useMemo(() => {
    let result = [...events];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (e) =>
          (e.title || '').toLowerCase().includes(q) ||
          (e.city || '').toLowerCase().includes(q) ||
          (e.state || '').toLowerCase().includes(q) ||
          (e.location || '').toLowerCase().includes(q) ||
          (e.venue || '').toLowerCase().includes(q) ||
          (e.category || '').toLowerCase().includes(q) ||
          (e.description || '').toLowerCase().includes(q)
      );
    }

    if (selectedCategory) {
      const cat = selectedCategory.toLowerCase();
      result = result.filter((e) => {
        const c = (e.category || '').toLowerCase();
        const t = (e.type || e.event_type || '').toLowerCase();
        const title = (e.title || '').toLowerCase();
        const desc = (e.description || '').toLowerCase();
        const allText = `${c} ${t} ${title} ${desc}`;

        if (cat === 'music') return c === 'music' || allText.includes('music') || allText.includes('concert') || allText.includes('dj') || allText.includes('live');
        if (cat === 'nightlife') return c === 'nightlife' || allText.includes('nightlife') || allText.includes('club') || allText.includes('dj') || allText.includes('party');
        if (cat === 'comedy') return c === 'comedy' || allText.includes('comedy') || allText.includes('stand-up') || allText.includes('standup');
        if (cat === 'move') return c === 'move' || allText.includes('sport') || allText.includes('esport') || allText.includes('gaming') || allText.includes('fitness');
        if (cat === 'performances') return c === 'performances' || allText.includes('theatre') || allText.includes('performance') || allText.includes('play') || allText.includes('show');
        if (cat === 'food') return c === 'food' || allText.includes('food') || allText.includes('drinks') || allText.includes('dining') || allText.includes('culinary');
        if (cat === 'fests') return c === 'fests' || allText.includes('fest') || allText.includes('expo') || allText.includes('fair') || allText.includes('carnival');
        if (cat === 'social') return c === 'social' || allText.includes('social') || allText.includes('mixer') || allText.includes('meetup') || allText.includes('networking');
        if (cat === 'outdoors') return c === 'outdoors' || allText.includes('outdoor') || allText.includes('trek') || allText.includes('camp') || allText.includes('trip');
        if (cat === 'workshops') return c === 'create' || c === 'workshops' || allText.includes('workshop') || allText.includes('class') || allText.includes('craft');
        if (cat === 'screenings') return allText.includes('screening') || allText.includes('cinema') || allText.includes('movie') || allText.includes('film');
        if (cat === 'pets') return allText.includes('pet') || allText.includes('dog') || allText.includes('animal');
        return c === cat || allText.includes(cat);
      });
    }

    // Quick filter pills
    if (activeQuickFilter === 'today') {
      result = result.filter(
        (e) =>
          e.day === 'today' ||
          (e.time || '').toLowerCase().includes('today') ||
          (e.time || '').toLowerCase().includes('tonight')
      );
    } else if (activeQuickFilter === 'tomorrow') {
      result = result.filter(
        (e) => e.day === 'tomorrow' || (e.time || '').toLowerCase().includes('tomorrow')
      );
    } else if (activeQuickFilter === 'weekend') {
      result = result.filter(
        (e) =>
          e.day === 'weekend' ||
          (e.time || '').toLowerCase().includes('saturday') ||
          (e.time || '').toLowerCase().includes('sunday')
      );
    } else if (activeQuickFilter === 'free') {
      result = result.filter((e) => Number(e.price) === 0);
    } else if (activeQuickFilter === 'under500') {
      result = result.filter((e) => Number(e.price) > 0 && Number(e.price) <= 500);
    }

    // Genre filter from FilterModal
    if (advancedFilters.genre && advancedFilters.genre !== 'All Genres') {
      const g = advancedFilters.genre.toLowerCase();
      result = result.filter((e) => {
        const combined = `${e.type || ''} ${e.event_type || ''} ${e.category || ''} ${e.title || ''} ${e.description || ''}`.toLowerCase();
        if (g.includes('comedy')) return combined.includes('comedy') || combined.includes('stand-up') || combined.includes('standup');
        if (g.includes('electronic') || g.includes('dj')) return combined.includes('electronic') || combined.includes('dj') || combined.includes('nightlife') || combined.includes('dance') || combined.includes('club');
        if (g.includes('acoustic')) return combined.includes('acoustic') || combined.includes('unplugged') || combined.includes('live') || combined.includes('music');
        if (g.includes('rock') || g.includes('indie')) return combined.includes('rock') || combined.includes('indie') || combined.includes('band') || combined.includes('music');
        if (g.includes('workshop') || g.includes('craft')) return combined.includes('workshop') || combined.includes('craft') || combined.includes('class') || combined.includes('create');
        if (g.includes('cinema') || g.includes('screening')) return combined.includes('screening') || combined.includes('cinema') || combined.includes('movie') || combined.includes('film');
        if (g.includes('culinary') || g.includes('dining')) return combined.includes('food') || combined.includes('drinks') || combined.includes('dining') || combined.includes('culinary') || combined.includes('bar');
        if (g.includes('fitness') || g.includes('yoga')) return combined.includes('fitness') || combined.includes('yoga') || combined.includes('workout') || combined.includes('marathon') || combined.includes('sport');
        if (g.includes('music') || g.includes('concert')) return combined.includes('music') || combined.includes('singing') || combined.includes('concert');
        if (g.includes('esports') || g.includes('game')) return combined.includes('esports') || combined.includes('gaming') || combined.includes('tournament');
        return combined.includes(g);
      });
    }

    // Sort order
    if (advancedFilters.sort === 'price_low_high') {
      result.sort((a, b) => (Number(a.price) || 0) - (Number(b.price) || 0));
    } else if (advancedFilters.sort === 'price_high_low') {
      result.sort((a, b) => (Number(b.price) || 0) - (Number(a.price) || 0));
    } else if (advancedFilters.sort === 'popularity') {
      result.sort((a, b) => (Number(b.rating_count) || 0) - (Number(a.rating_count) || 0));
    } else if (advancedFilters.sort === 'date') {
      result.sort((a, b) => {
        const dateA = a.date || a.time || '';
        const dateB = b.date || b.time || '';
        return dateA.localeCompare(dateB);
      });
    }

    return result;
  }, [events, searchQuery, selectedCategory, activeQuickFilter, advancedFilters]);

  return (
    <div className="min-h-screen bg-cream text-ink dark:bg-[#101820] dark:text-white flex flex-col font-sans transition-colors duration-200">
      {/* Live New Event Banner Toast Notification */}
      {liveBanner && (
        <div
          className={`fixed bottom-6 right-6 z-50 max-w-sm rounded-2xl bg-white dark:bg-[#1e293b] p-4 shadow-2xl border border-coral/30 dark:border-coral/40 backdrop-blur-xl transition-all duration-700 ease-in-out ${
            isBannerFading
              ? 'opacity-0 translate-y-4 pointer-events-none'
              : 'opacity-100 translate-y-0 animate-in slide-in-from-bottom-5'
          }`}
          role="alert"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="flex h-2.5 w-2.5 rounded-full bg-coral animate-ping" />
              <p className="text-xs font-black uppercase tracking-wider text-coral">
                {liveBanner.title}
              </p>
            </div>
            <button
              onClick={() => setLiveBanner(null)}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-white text-xs font-bold"
            >
              ✕
            </button>
          </div>
          <p className="mt-1 text-sm font-bold text-ink dark:text-white line-clamp-1">
            {liveBanner.subtitle}
          </p>
          {liveBanner.event && (
            <div className="mt-2 flex items-center justify-between gap-2 border-t border-slate-100 dark:border-slate-700/60 pt-2">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                {liveBanner.event.location || liveBanner.event.venue}
              </span>
              <button
                onClick={() => {
                  navigate(`/event/${encodeURIComponent(liveBanner.event.slug || liveBanner.event.id)}`);
                  setLiveBanner(null);
                }}
                className="rounded-xl bg-coral px-3 py-1 text-xs font-bold text-white hover:bg-[#e24a36] transition cursor-pointer"
              >
                Book Now →
              </button>
            </div>
          )}
        </div>
      )}

      <Navbar
        currentLocation={currentLocation === 'All' ? 'All Cities' : currentLocation}
        onLocationChange={handleLocationChange}
        availableLocations={activeLocations}
      />

      <main className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-6 space-y-10 flex-1">
        {/* Hero Section */}
        <section aria-label="Hero showcase">
          <HeroShowcase events={events} />
        </section>

        {/* Popular High-Rating Events Section */}
        <PopularEvents
          events={events}
          currentLocation={currentLocation}
          onLocationChange={handleLocationChange}
        />

        {/* Explore Categories Section */}
        <Categories
          selectedCategory={selectedCategory}
          onSelectCategory={setSelectedCategory}
        />

        {/* Discovery Feed Section */}
        <section id="discovery" aria-label="Discover experiences" className="space-y-4 pt-4">
          {/* Top Row: Title + Subtitle on Left, Search Bar on Right */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-2xl sm:text-3xl font-black text-ink dark:text-white">
                Discover Everything
              </h2>
              <p className="text-xs sm:text-sm font-semibold text-slate-400 mt-0.5">
                Showing {filteredEvents.length} experience{filteredEvents.length === 1 ? '' : 's'}
              </p>
            </div>

            {/* Search Input Box with Focus Glow & Hover animations */}
            <div className="group relative w-full sm:w-72 md:w-80 transition-all duration-300">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-slate-400 transition-transform duration-200 group-focus-within:scale-110 group-focus-within:text-coral">
                🔍
              </span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search events, artists, venues..."
                className="w-full rounded-full border border-stone-200/90 dark:border-white/10 bg-white dark:bg-[#182330] pl-10 pr-8 py-2 text-xs sm:text-sm font-semibold text-ink dark:text-white placeholder:text-slate-400 outline-none transition-all duration-200 hover:border-coral/50 focus:border-coral focus:ring-2 focus:ring-coral/25 focus:shadow-lg focus:shadow-coral/10 shadow-xs"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-ink dark:hover:text-white cursor-pointer hover:rotate-90 transition-transform duration-200"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* Quick Filters Row with Interactive Pill Animations */}
          <div className="flex flex-wrap items-center justify-between gap-2.5 pt-1">
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5">
              {QUICK_FILTERS.map((qf) => {
                const isActive = activeQuickFilter === qf.id;
                return (
                  <button
                    key={qf.id}
                    onClick={() => setActiveQuickFilter(qf.id)}
                    type="button"
                    className={`rounded-full px-4 py-1.5 text-xs sm:text-sm font-bold transition-all duration-200 cursor-pointer whitespace-nowrap select-none ${
                      isActive
                        ? 'bg-coral text-white font-black shadow-md shadow-coral/30 scale-[1.02] ring-2 ring-coral/30 ring-offset-1 dark:ring-offset-[#101820]'
                        : 'border border-stone-200/90 dark:border-white/10 bg-white dark:bg-[#182330] text-slate-700 dark:text-slate-300 hover:border-coral/50 hover:text-coral hover:-translate-y-0.5 hover:shadow-xs active:scale-95'
                    }`}
                  >
                    {qf.label}
                  </button>
                );
              })}
            </div>

            {/* Filter Modal Trigger with Spin Animation & Active Badge */}
            <button
              type="button"
              onClick={() => setIsFilterModalOpen(true)}
              className={`group flex items-center gap-1.5 rounded-full border px-4 py-1.5 text-xs sm:text-sm font-bold transition-all duration-200 cursor-pointer shadow-xs active:scale-95 ${
                (advancedFilters.genre && advancedFilters.genre !== 'All Genres') ||
                (advancedFilters.sort && advancedFilters.sort !== 'popularity')
                  ? 'border-coral bg-coral/15 text-coral dark:bg-coral/25 ring-1 ring-coral/40 font-black'
                  : 'border-stone-200/90 dark:border-white/10 bg-white dark:bg-[#182330] text-slate-700 dark:text-slate-200 hover:border-coral hover:text-coral hover:-translate-y-0.5 hover:shadow-md'
              }`}
            >
              <span className="transition-transform duration-500 group-hover:rotate-90">⚙️</span>
              <span>Filters</span>
              {((advancedFilters.genre && advancedFilters.genre !== 'All Genres') ||
                (advancedFilters.sort && advancedFilters.sort !== 'popularity')) && (
                <span className="ml-0.5 inline-block h-2 w-2 rounded-full bg-coral animate-pulse" />
              )}
            </button>
          </div>

          {/* Events Grid */}
          {filteredEvents.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-stone-300 p-12 text-center dark:border-slate-700 space-y-3">
              <span className="text-4xl block">🔍</span>
              <h3 className="text-lg font-black text-ink dark:text-white">No experiences found</h3>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                Try selecting a different category or clearing filters.
              </p>
              <button
                onClick={() => {
                  setSelectedCategory(null);
                  setActiveQuickFilter('all');
                  setSearchQuery('');
                  setAdvancedFilters({ sort: 'popularity', genre: 'All Genres' });
                }}
                className="rounded-xl bg-coral px-4 py-2 text-xs font-bold text-white hover:bg-[#e24a36] transition cursor-pointer"
              >
                Reset All Filters
              </button>
            </div>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {filteredEvents.slice(0, visibleCount).map((event) => (
                <EventCard
                  key={event.slug || event.id}
                  event={event}
                  isNewlyAdded={newlyAddedEventIds.has(event.id) || newlyAddedEventIds.has(event.slug)}
                />
              ))}
            </div>
          )}

          {/* Show More Button */}
          {visibleCount < filteredEvents.length && (
            <div className="text-center pt-4">
              <button
                onClick={() => setVisibleCount((prev) => prev + 6)}
                type="button"
                className="rounded-2xl border-2 border-stone-300 dark:border-slate-700 px-8 py-3 text-sm font-bold text-ink dark:text-white hover:border-coral hover:text-coral transition shadow-sm hover:shadow-md cursor-pointer"
              >
                Show More Experiences ({filteredEvents.length - visibleCount} remaining)
              </button>
            </div>
          )}
        </section>
      </main>

      <Footer />

      {isFilterModalOpen && (
        <FilterModal
          isOpen={isFilterModalOpen}
          filters={advancedFilters}
          onApply={(updated) => {
            setAdvancedFilters(updated);
            setIsFilterModalOpen(false);
          }}
          onApplyFilters={(updated) => {
            setAdvancedFilters(updated);
            setIsFilterModalOpen(false);
          }}
          onClose={() => setIsFilterModalOpen(false)}
        />
      )}
    </div>
  );
};
