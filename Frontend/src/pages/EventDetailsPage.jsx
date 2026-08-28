import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams, useNavigate, Link } from 'react-router-dom';
import { Navbar } from '../components/Navbar';
import { Footer } from '../components/Footer';
import { RatingStars } from '../components/RatingStars';
import { apiRequest } from '../utils/api';
import { FALLBACK_EVENTS } from '../utils/constants';
import { formatPrice, formatEventTime } from '../utils/formatters';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

export const EventDetailsPage = () => {
  const { slug: routeSlug } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { isAuthenticated, bookmarkedIds, toggleBookmark } = useAuth();
  const { showToast } = useToast();

  const slug = routeSlug || searchParams.get('event') || 'moonlight-picnic';

  const [event, setEvent] = useState(() => FALLBACK_EVENTS[slug] || Object.values(FALLBACK_EVENTS)[0]);
  const [loading, setLoading] = useState(true);
  const [quantity, setQuantity] = useState(1);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    apiRequest(`/api/events/${encodeURIComponent(slug)}`)
      .then((data) => {
        if (data && data.event) {
          setEvent(data.event);
        }
      })
      .catch(() => {
        if (FALLBACK_EVENTS[slug]) {
          setEvent(FALLBACK_EVENTS[slug]);
        }
      })
      .finally(() => setLoading(false));
  }, [slug]);

  const eventId = Number(event.id);
  const isBookmarked = Boolean(
    (eventId && bookmarkedIds.includes(eventId)) ||
    (slug && bookmarkedIds.includes(String(slug)))
  );

  const price = Number(event.price) || 0;
  const totalPrice = price * quantity;
  const timeFormatted = formatEventTime(event.time || '', event.day);
  const type = event.type || event.event_type || 'Experience';

  const handleProceedBooking = () => {
    const bookingUrl = `/booking?event=${encodeURIComponent(slug)}&quantity=${quantity}`;
    if (!isAuthenticated) {
      showToast('Please sign in to book tickets.');
      navigate(`/user?redirect=${encodeURIComponent(bookingUrl)}`);
      return;
    }
    navigate(bookingUrl);
  };

  return (
    <div className="min-h-screen bg-cream text-ink dark:bg-[#101820] dark:text-white flex flex-col">
      <Navbar />

      <main className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-6 space-y-8 flex-1">
        {/* Breadcrumb Navigation */}
        <div className="flex items-center gap-2 text-xs sm:text-sm font-semibold text-slate-500 dark:text-slate-400">
          <Link to="/" className="hover:text-coral transition">Home</Link>
          <span>/</span>
          <Link to="/all-events" className="hover:text-coral transition">Events</Link>
          <span>/</span>
          <span className="text-ink dark:text-white truncate max-w-xs">{event.title}</span>
        </div>

        {/* Hero Showcase Banner */}
        <div className="relative h-80 sm:h-96 md:h-[420px] w-full overflow-hidden rounded-[2.5rem] bg-stone-900 shadow-soft">
          <img
            src={event.image || 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=1200&q=85'}
            alt={event.title}
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

          {/* Bookmark Button */}
          <button
            type="button"
            onClick={() => toggleBookmark(eventId, slug)}
            className={`absolute top-4 left-4 z-20 grid h-10 w-10 place-items-center rounded-full shadow-md backdrop-blur-md transition hover:scale-110 ${
              isBookmarked
                ? 'bg-coral text-white ring-2 ring-coral/40'
                : 'bg-black/60 text-white ring-1 ring-white/20 hover:bg-black/80'
            }`}
            title={isBookmarked ? 'Remove bookmark' : 'Bookmark event'}
          >
            <svg className="h-5 w-5 fill-white" viewBox="0 0 24 24">
              <path d="M5 3a2 2 0 0 0-2 2v16l9-4 9 4V5a2 2 0 0 0-2-2H5z" />
            </svg>
          </button>

          {/* Header Info Inside Image Banner */}
          <div className="absolute bottom-0 left-0 right-0 p-6 sm:p-10 text-white">
            <span className="inline-block rounded-full bg-coral px-3.5 py-1 text-xs font-black uppercase tracking-wider text-white shadow-sm">
              {type}
            </span>
            <h1 className="mt-2 text-2xl sm:text-4xl md:text-5xl font-black text-white leading-tight">
              {event.title}
            </h1>
            <p className="mt-2 text-sm sm:text-base font-semibold text-slate-200">
              📍 {event.venue || event.location} {timeFormatted ? `· 🕒 ${timeFormatted}` : ''}
            </p>
          </div>
        </div>

        {/* Content Layout Grid */}
        <div className="grid gap-8 lg:grid-cols-[1.8fr_1.2fr]">
          {/* Left Column: Details & Ratings */}
          <div className="space-y-6">
            {/* Quick Meta Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5">
              <div className="rounded-3xl border border-stone-200/80 bg-white p-4 dark:border-slate-700/80 dark:bg-[#1c2733] shadow-sm">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Date &amp; Time</p>
                <p className="mt-1 text-sm font-black text-ink dark:text-white truncate">{timeFormatted || 'TBA'}</p>
              </div>
              <div className="rounded-3xl border border-stone-200/80 bg-white p-4 dark:border-slate-700/80 dark:bg-[#1c2733] shadow-sm">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Location</p>
                <p className="mt-1 text-sm font-black text-ink dark:text-white truncate">{event.location || event.venue}</p>
              </div>
              <div className="rounded-3xl border border-stone-200/80 bg-white p-4 dark:border-slate-700/80 dark:bg-[#1c2733] shadow-sm col-span-2 sm:col-span-1">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Entry Price</p>
                <p className="mt-1 text-sm font-black text-coral">{formatPrice(price)}</p>
              </div>
            </div>

            {/* Description */}
            <div className="rounded-[2.5rem] border border-stone-200/80 bg-white p-6 sm:p-8 dark:border-slate-700/80 dark:bg-[#1c2733] shadow-sm space-y-3">
              <h2 className="text-xl font-black text-ink dark:text-white">About this experience</h2>
              <p className="text-sm sm:text-base leading-relaxed text-slate-600 dark:text-slate-300">
                {event.description ||
                  'An intimate evening curated for great memories. Arrive on time to settle in, grab a seat, and enjoy the experience.'}
              </p>
            </div>

            {/* Interactive 5-Star Ratings */}
            <RatingStars
              eventSlug={slug}
              eventId={event.id || eventId}
              initialRating={event.rating}
              initialCount={event.rating_count}
              userRating={event.user_rating}
              onRatingSuccess={(res) => {
                setEvent((prev) => ({
                  ...prev,
                  rating: res.avg_rating !== undefined ? res.avg_rating : (res.rating !== undefined ? res.rating : prev.rating),
                  rating_count: res.rating_count !== undefined ? res.rating_count : prev.rating_count,
                  user_rating: res.user_rating !== undefined ? res.user_rating : prev.user_rating,
                }));
              }}
            />
          </div>

          {/* Right Column: Ticket Counter & Booking CTA */}
          <div className="space-y-6">
            <div className="sticky top-28 rounded-[2.5rem] border border-stone-200/80 bg-white p-6 sm:p-8 shadow-soft dark:border-slate-700/80 dark:bg-[#1c2733] space-y-6">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-coral">Secure your spot</p>
                <h3 className="mt-1 text-2xl font-black text-ink dark:text-white">Reserve Tickets</h3>
              </div>

              {/* Quantity Counter */}
              <div className="rounded-2xl bg-stone-50 p-4 dark:bg-[#151f2b] border border-stone-200 dark:border-slate-700">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-bold text-ink dark:text-white">Quantity</p>
                    <p className="text-xs text-slate-400">Select number of passes</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setQuantity((prev) => Math.max(1, prev - 1))}
                      className="grid h-9 w-9 place-items-center rounded-xl bg-white border border-stone-300 font-black text-base text-slate-700 transition hover:border-coral hover:text-coral dark:border-slate-600 dark:bg-[#1c2733] dark:text-white"
                    >
                      −
                    </button>
                    <span className="font-mono text-lg font-black text-ink dark:text-white w-6 text-center">
                      {quantity}
                    </span>
                    <button
                      type="button"
                      onClick={() => setQuantity((prev) => Math.min(10, prev + 1))}
                      className="grid h-9 w-9 place-items-center rounded-xl bg-white border border-stone-300 font-black text-base text-slate-700 transition hover:border-coral hover:text-coral dark:border-slate-600 dark:bg-[#1c2733] dark:text-white"
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>

              {/* Price Breakdown */}
              <div className="space-y-2 border-t border-stone-100 pt-4 dark:border-slate-700 text-xs sm:text-sm">
                <div className="flex justify-between text-slate-500 dark:text-slate-400 font-semibold">
                  <span>Price per ticket</span>
                  <span>{formatPrice(price)}</span>
                </div>
                <div className="flex justify-between text-slate-500 dark:text-slate-400 font-semibold">
                  <span>Tickets</span>
                  <span>× {quantity}</span>
                </div>
                <div className="flex justify-between text-base font-black text-ink dark:text-white pt-2 border-t border-stone-100 dark:border-slate-700">
                  <span>Total Amount</span>
                  <span className="text-coral">{price === 0 ? 'Free entry' : formatPrice(totalPrice)}</span>
                </div>
              </div>

              {/* CTA Buttons */}
              <button
                onClick={handleProceedBooking}
                className="w-full rounded-2xl bg-coral py-3.5 text-base font-bold text-white shadow-lg shadow-coral/25 transition hover:bg-[#df503c] active:scale-[0.98]"
              >
                Proceed to Booking →
              </button>

              <div className="text-center">
                <button
                  onClick={() => toggleBookmark(eventId, slug)}
                  className="text-xs font-bold text-slate-500 hover:text-coral transition dark:text-slate-400"
                >
                  {isBookmarked ? '🔖 Saved in your bookmarks' : '🔖 Save to bookmarks'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};
