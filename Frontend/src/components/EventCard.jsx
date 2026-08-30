import React from 'react';
import { useNavigate } from 'react-router-dom';
import { formatPrice, formatEventTime, escapeHtml } from '../utils/formatters';
import { useAuth } from '../context/AuthContext';

export const EventCard = ({ event, isNewLive = false }) => {
  const navigate = useNavigate();
  const { isAuthenticated, bookmarkedIds, toggleBookmark } = useAuth();

  const slug = event.slug || event.id;
  const eventId = Number(event.id);
  const isBookmarked = Boolean(
    isAuthenticated &&
    ((eventId && bookmarkedIds.includes(eventId)) ||
    (slug && bookmarkedIds.includes(String(slug))))
  );

  const price = Number(event.price) || 0;
  const priceText = formatPrice(price);
  const time = formatEventTime(event.time || '', event.day);
  const type = event.type || event.event_type || 'Experience';
  const rating = Number(event.rating) || 4.8;
  const ratingCount = Number(event.rating_count) || 0;

  const handleCardClick = () => {
    navigate(`/event/${encodeURIComponent(slug)}`);
  };

  const handleBookmarkClick = (e) => {
    e.stopPropagation();
    toggleBookmark(eventId, slug);
  };

  return (
    <article
      onClick={handleCardClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleCardClick();
        }
      }}
      tabIndex={0}
      role="link"
      className={`event-card group relative cursor-pointer rounded-3xl transition duration-300 hover:-translate-y-1 hover:shadow-soft bg-white border dark:bg-[#1c2733] overflow-hidden select-none ${
        isNewLive
          ? 'border-emerald-500 ring-2 ring-emerald-400 shadow-lg shadow-emerald-500/20 animate-in fade-in zoom-in-95 duration-500'
          : 'border-stone-200/80 dark:border-slate-700/80'
      }`}
    >
      <div className="relative h-60 w-full overflow-hidden bg-stone-100 dark:bg-stone-800">
        <img
          className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-108 will-change-transform"
          src={event.image || 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=800&q=80'}
          alt={event.title}
          onError={(e) => {
            e.currentTarget.src = 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=800&q=80';
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent pointer-events-none" />

        {/* Live Just Added Tag */}
        {(isNewLive || event.is_new_live) && (
          <span className="absolute bottom-3 left-3 z-10 inline-flex items-center gap-1.5 rounded-full bg-emerald-500/90 backdrop-blur-md px-3 py-1 text-[10px] font-black uppercase tracking-wider text-white shadow-md">
            <span className="h-2 w-2 rounded-full bg-white animate-ping"></span>
            Live Just Added
          </span>
        )}

        {/* Bookmark Button */}
        <button
          type="button"
          onClick={handleBookmarkClick}
          className={`absolute top-3.5 left-3.5 z-20 grid h-8 w-8 place-items-center rounded-full shadow-md backdrop-blur-md transition-all duration-200 hover:scale-110 ${
            isBookmarked
              ? 'bg-coral text-white ring-2 ring-coral/40'
              : 'bg-black/60 text-white ring-1 ring-white/20 hover:bg-black/80'
          }`}
          title={isBookmarked ? 'Remove bookmark' : 'Bookmark event'}
          aria-label={isBookmarked ? 'Remove bookmark' : 'Bookmark event'}
        >
          <svg className="h-4 w-4 fill-white pointer-events-none" viewBox="0 0 24 24">
            <path d="M5 3a2 2 0 0 0-2 2v16l9-4 9 4V5a2 2 0 0 0-2-2H5z" />
          </svg>
        </button>

        {/* Rating Badge */}
        <div className="rating-badge absolute top-3.5 right-3.5 z-10 flex items-center gap-1 rounded-full bg-ink/80 backdrop-blur-md px-2.5 py-1 text-xs font-black text-amber-300 shadow-md ring-1 ring-white/15 dark:bg-black/80 pointer-events-none">
          <span className="text-amber-400">★</span>
          <span>{rating.toFixed(1)}</span>
          {ratingCount > 0 && <span className="text-[10px] font-bold text-slate-300">({ratingCount})</span>}
        </div>
      </div>

      <div className="p-4">
        <p className="text-xs font-bold uppercase tracking-wider text-coral">
          {type} {time ? `· ${time}` : ''}
        </p>
        <h3 className="mt-1 font-black text-ink dark:text-white group-hover:text-coral transition-colors line-clamp-1">
          {event.title}
        </h3>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400 font-medium">
          {event.city ? `${event.venue ? `${event.venue}, ` : ''}${event.city}` : (event.location || event.venue)} · <span className="text-ink dark:text-white font-bold">{priceText}</span>
        </p>
      </div>
    </article>
  );
};
