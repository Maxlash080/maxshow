import React, { useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { parseLocationStateAndCity } from '../utils/constants';
import { formatPrice, formatEventTime } from '../utils/formatters';

export const PopularEvents = ({
  events = [],
  currentLocation = 'All',
  onLocationChange,
  title,
}) => {
  const navigate = useNavigate();
  const carouselRef = useRef(null);

  // Filter and sort events by highest rating and popularity for the selected location
  const popularLocationEvents = useMemo(() => {
    if (!Array.isArray(events) || events.length === 0) return [];

    const cleanCurrent = (currentLocation || '').toLowerCase().trim();
    let matches = [];

    if (!currentLocation || cleanCurrent === 'all' || cleanCurrent === 'all cities') {
      matches = [...events];
    } else {
      const { state: selState, city: selCity } = parseLocationStateAndCity(currentLocation);
      const targetCity = (selCity || '').toLowerCase().trim();
      const targetState = (selState || '').toLowerCase().trim();

      if (targetCity) {
        matches = events.filter((e) => {
          const c = (e.city || '').toLowerCase().trim();
          const loc = (e.location || '').toLowerCase();
          const ven = (e.venue || '').toLowerCase();
          const { city: evCity } = parseLocationStateAndCity(e.location || '');
          const cleanEvCity = (evCity || '').toLowerCase().trim();

          return (
            c === targetCity ||
            cleanEvCity === targetCity ||
            loc.includes(targetCity) ||
            ven.includes(targetCity)
          );
        });
      } else if (targetState) {
        matches = events.filter((e) => {
          const s = (e.state || '').toLowerCase().trim();
          const loc = (e.location || '').toLowerCase();
          const { state: evState } = parseLocationStateAndCity(e.location || '');
          const cleanEvState = (evState || '').toLowerCase().trim();

          return s === targetState || cleanEvState === targetState || loc.includes(targetState);
        });
      } else {
        matches = events.filter((e) => {
          const loc = (e.location || '').toLowerCase();
          const ven = (e.venue || '').toLowerCase();
          return loc.includes(cleanCurrent) || ven.includes(cleanCurrent);
        });
      }
    }

    // Sort by rating (high to low) then by rating count / popularity
    return matches.sort((a, b) => {
      const ratingA = Number(a.rating) || 4.5;
      const ratingB = Number(b.rating) || 4.5;
      if (ratingB !== ratingA) return ratingB - ratingA;
      return (Number(b.rating_count) || 0) - (Number(a.rating_count) || 0);
    });
  }, [events, currentLocation]);

  const scrollLeft = () => {
    if (carouselRef.current) {
      const card = carouselRef.current.querySelector('article');
      const step = card ? card.offsetWidth + 24 : 360;
      carouselRef.current.scrollBy({ left: -step, behavior: 'smooth' });
    }
  };

  const scrollRight = () => {
    if (carouselRef.current) {
      const card = carouselRef.current.querySelector('article');
      const step = card ? card.offsetWidth + 24 : 360;
      carouselRef.current.scrollBy({ left: step, behavior: 'smooth' });
    }
  };

  const displayLocation = currentLocation === 'All' || currentLocation === 'All Cities' ? 'India' : currentLocation;

  return (
    <section id="city-picks" className="scroll-mt-20 sm:scroll-mt-24" aria-label="Popular high-rated events">
      <div id="location-picks" className="rounded-[2.5rem] bg-stone-900 p-6 sm:p-10 text-white shadow-soft">
        {/* Section Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-coral flex items-center gap-1.5">
              <span>✨ SAVE THE DATE</span>
              <span>·</span>
              <span className="text-white font-black">{currentLocation.toUpperCase()}</span>
            </p>
            <h2 className="mt-1 text-2xl sm:text-4xl font-black text-white">
              {title || `Top picks in ${displayLocation}`}
            </h2>
          </div>

          {/* Carousel Navigation Buttons */}
          <div className="flex items-center justify-between sm:justify-end gap-4">
            {popularLocationEvents.length > 3 && (
              <div className="flex items-center gap-2">
                <button
                  onClick={scrollLeft}
                  type="button"
                  aria-label="Previous popular events"
                  className="grid h-10 w-10 place-items-center rounded-full bg-white/10 text-white hover:bg-coral hover:text-white transition shadow-sm active:scale-95 cursor-pointer backdrop-blur-md border border-white/10"
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
                  </svg>
                </button>
                <button
                  onClick={scrollRight}
                  type="button"
                  aria-label="Next popular events"
                  className="grid h-10 w-10 place-items-center rounded-full bg-white/10 text-white hover:bg-coral hover:text-white transition shadow-sm active:scale-95 cursor-pointer backdrop-blur-md border border-white/10"
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                  </svg>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Empty State */}
        {popularLocationEvents.length === 0 ? (
          <div className="rounded-3xl border border-white/10 bg-white/5 p-10 text-center backdrop-blur-md space-y-4">
            <span className="text-4xl block">📍</span>
            <h3 className="text-xl font-bold text-white">
              No popular events listed in {currentLocation} right now
            </h3>
            <p className="text-xs sm:text-sm text-slate-400 max-w-md mx-auto">
              We are expanding quickly! Switch to another trending city to discover top-rated concerts, stand-up comedy, and festivals.
            </p>
            {onLocationChange && (
              <div className="flex flex-wrap justify-center gap-2 pt-2">
                <button
                  onClick={() => onLocationChange('Maharashtra, Mumbai')}
                  className="rounded-full bg-white/10 px-4 py-2 text-xs font-bold text-white hover:bg-coral transition cursor-pointer"
                >
                  Mumbai
                </button>
                <button
                  onClick={() => onLocationChange('Karnataka, Bengaluru')}
                  className="rounded-full bg-white/10 px-4 py-2 text-xs font-bold text-white hover:bg-coral transition cursor-pointer"
                >
                  Bengaluru
                </button>
                <button
                  onClick={() => onLocationChange('Delhi (NCT), Delhi')}
                  className="rounded-full bg-white/10 px-4 py-2 text-xs font-bold text-white hover:bg-coral transition cursor-pointer"
                >
                  Delhi NCR
                </button>
                <button
                  onClick={() => onLocationChange('Maharashtra, Pune')}
                  className="rounded-full bg-white/10 px-4 py-2 text-xs font-bold text-white hover:bg-coral transition cursor-pointer"
                >
                  Pune
                </button>
                <button
                  onClick={() => onLocationChange('All')}
                  className="rounded-full bg-coral px-4 py-2 text-xs font-bold text-white hover:bg-[#e24a36] transition cursor-pointer"
                >
                  Browse All India
                </button>
              </div>
            )}
          </div>
        ) : (
          /* Event Cards Carousel / Grid */
          <div
            ref={carouselRef}
            className={
              popularLocationEvents.length > 3
                ? "flex gap-6 overflow-x-auto scroll-smooth no-scrollbar pb-2 snap-x snap-mandatory"
                : "grid gap-6 sm:grid-cols-2 lg:grid-cols-3"
            }
          >
            {popularLocationEvents.map((pick) => {
              const slug = pick.slug || pick.id;
              const time = formatEventTime(pick.time || '', pick.day);
              const priceText = formatPrice(pick.price);
              const type = pick.type || pick.event_type || pick.category || 'Experience';
              const ratingVal = (Number(pick.rating) || 4.8).toFixed(1);

              return (
                <article
                  key={slug}
                  onClick={() => navigate(`/event/${encodeURIComponent(slug)}`)}
                  className={`cursor-pointer group overflow-hidden rounded-3xl bg-white text-ink dark:bg-[#1c2733] dark:text-white dark:border-slate-700 shadow-soft transition-all duration-300 hover:-translate-y-1.5 hover:shadow-2xl border border-stone-200/80 ${
                    popularLocationEvents.length > 3
                      ? 'flex-none w-[85%] sm:w-[calc(50%-12px)] lg:w-[calc(33.333%-16px)] snap-start'
                      : ''
                  }`}
                >
                  {/* Event Thumbnail */}
                  <div className="relative h-52 w-full overflow-hidden bg-stone-100 dark:bg-stone-800">
                    <img
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                      src={pick.image || 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=800&q=80'}
                      alt={pick.title}
                      loading="lazy"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20" />

                    {/* Star Rating Badge */}
                    <span className="absolute top-3 right-3 rounded-full bg-black/60 backdrop-blur-md px-2.5 py-1 text-xs font-black text-amber-300 border border-white/10 flex items-center gap-1 shadow-sm">
                      <span>★</span>
                      <span>{ratingVal}</span>
                    </span>
                  </div>

                  {/* Event Details */}
                  <div className="p-5 flex flex-col justify-between">
                    <div>
                      <p className="text-[11px] font-black uppercase tracking-wider text-coral truncate">
                        {type} · {time}
                      </p>
                      <h3 className="mt-1 text-base sm:text-lg font-black text-ink dark:text-white group-hover:text-coral transition-colors line-clamp-1">
                        {pick.title}
                      </h3>
                    </div>

                    <div className="mt-4 flex items-center justify-between border-t border-stone-100 pt-3 dark:border-slate-700/60 text-xs text-slate-500 dark:text-slate-400">
                      <span className="truncate pr-2 flex items-center gap-1 font-semibold">
                        <span>📍</span>
                        <span className="truncate">
                          {pick.state && pick.city ? `${pick.state}, ${pick.city}` : pick.location || pick.venue || 'India'}
                        </span>
                      </span>
                      <span className="text-ink dark:text-white font-black text-sm shrink-0">
                        {priceText}
                      </span>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
};

export default PopularEvents;
