import React, { useState, useEffect } from 'react';
import { apiRequest } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

export const RatingStars = ({
  eventSlug,
  eventId,
  initialRating = 4.8,
  initialCount = 12,
  userRating: initialUserRating = null,
  onRatingSuccess,
}) => {
  const { userRatings, setUserRating: setContextUserRating, isAuthenticated } = useAuth();
  const { showToast } = useToast();

  const [hoverRating, setHoverRating] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  // Derive initial/synced user rating from context or props
  const contextRating =
    (eventId && userRatings?.[eventId] !== undefined ? userRatings[eventId] : null) ??
    (eventSlug && userRatings?.[eventSlug] !== undefined ? userRatings[eventSlug] : null);

  const effectiveRating =
    contextRating !== null && contextRating !== undefined
      ? Number(contextRating)
      : initialUserRating !== null && initialUserRating !== undefined
      ? Number(initialUserRating)
      : null;

  const [userRating, setUserRating] = useState(effectiveRating);
  const [avgRating, setAvgRating] = useState(Number(initialRating) || 4.8);
  const [count, setCount] = useState(Number(initialCount) ?? 12);

  // Sync state when props or AuthContext change
  useEffect(() => {
    setUserRating(effectiveRating);
  }, [effectiveRating]);

  useEffect(() => {
    if (initialRating !== undefined && initialRating !== null) {
      setAvgRating(Number(initialRating) || 4.8);
    }
  }, [initialRating]);

  useEffect(() => {
    if (initialCount !== undefined && initialCount !== null) {
      setCount(Number(initialCount) || 0);
    }
  }, [initialCount]);

  const identifier = eventId || eventSlug;

  const handleRate = async (star) => {
    if (submitting || !identifier) return;

    // If user clicked the same rating they currently have -> remove rating
    if (userRating === star) {
      await handleRemoveRating();
      return;
    }

    setSubmitting(true);
    setUserRating(star);
    if (setContextUserRating) {
      setContextUserRating(eventId, eventSlug, star);
    }

    try {
      const res = await apiRequest(`/api/events/${encodeURIComponent(identifier)}/rate`, {
        method: 'POST',
        body: JSON.stringify({ rating: star }),
      });

      if (res.avg_rating !== undefined) setAvgRating(Number(res.avg_rating));
      else if (res.rating !== undefined) setAvgRating(Number(res.rating));
      if (res.rating_count !== undefined) setCount(Number(res.rating_count));

      showToast(res.message || `Rated ${star} stars! ⭐`);
      if (typeof onRatingSuccess === 'function') {
        onRatingSuccess({ ...res, user_rating: star });
      }
    } catch (err) {
      // Revert state if failed
      setUserRating(effectiveRating);
      if (setContextUserRating) {
        setContextUserRating(eventId, eventSlug, effectiveRating);
      }
      if (err.message && (err.message.includes('sign in') || err.message.includes('sign-in') || err.message.includes('401'))) {
        showToast('Please sign in to rate this event ⭐');
      } else {
        showToast(err.message || 'Failed to submit rating');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemoveRating = async () => {
    if (submitting || !identifier) return;

    setSubmitting(true);
    const prevRating = userRating;
    setUserRating(null);
    if (setContextUserRating) {
      setContextUserRating(eventId, eventSlug, null);
    }

    try {
      const res = await apiRequest(`/api/events/${encodeURIComponent(identifier)}/rate`, {
        method: 'DELETE',
      });

      if (res.avg_rating !== undefined) setAvgRating(Number(res.avg_rating));
      else if (res.rating !== undefined) setAvgRating(Number(res.rating));
      if (res.rating_count !== undefined) setCount(Number(res.rating_count));

      showToast(res.message || 'Rating removed.');
      if (typeof onRatingSuccess === 'function') {
        onRatingSuccess({ ...res, user_rating: null });
      }
    } catch (err) {
      // Revert state if failed
      setUserRating(prevRating);
      if (setContextUserRating) {
        setContextUserRating(eventId, eventSlug, prevRating);
      }
      if (err.message && (err.message.includes('sign in') || err.message.includes('sign-in') || err.message.includes('401'))) {
        showToast('Please sign in to modify rating ⭐');
      } else {
        showToast(err.message || 'Failed to remove rating');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="rounded-3xl border border-stone-200/80 bg-white p-6 dark:border-slate-700/80 dark:bg-[#1c2733] shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-black text-ink dark:text-white">Community Rating</h3>
          <div className="mt-1 flex items-center gap-2">
            <span className="text-2xl font-black text-ink dark:text-white">{avgRating.toFixed(1)}</span>
            <div className="flex text-amber-400 text-base select-none">
              {'★'.repeat(Math.min(5, Math.max(0, Math.round(avgRating))))}
              {'☆'.repeat(Math.max(0, 5 - Math.min(5, Math.max(0, Math.round(avgRating)))))}
            </div>
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              ({count} {count === 1 ? 'review' : 'reviews'})
            </span>
          </div>
        </div>

        <div className="flex flex-col sm:items-end">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              {userRating ? `Your Rating: ${userRating}/5 ⭐` : 'Tap to rate'}
            </span>
            {userRating && (
              <button
                type="button"
                onClick={handleRemoveRating}
                disabled={submitting}
                className="text-[11px] font-bold text-rose-500 hover:text-rose-600 hover:underline dark:text-rose-400 transition cursor-pointer disabled:opacity-50"
                title="Remove your rating"
              >
                (Remove)
              </button>
            )}
          </div>
          <div className="flex items-center gap-1.5" onMouseLeave={() => setHoverRating(0)}>
            {[1, 2, 3, 4, 5].map((star) => {
              const filled = hoverRating ? star <= hoverRating : userRating ? star <= userRating : false;
              const isCurrentSelection = userRating === star;
              return (
                <button
                  key={star}
                  type="button"
                  disabled={submitting}
                  onMouseEnter={() => setHoverRating(star)}
                  onClick={() => handleRate(star)}
                  className={`text-2xl transition hover:scale-125 focus:outline-none cursor-pointer disabled:cursor-not-allowed ${
                    filled ? 'text-amber-400' : 'text-stone-300 dark:text-slate-600'
                  }`}
                  aria-label={
                    isCurrentSelection
                      ? `Remove your rating of ${star} stars`
                      : `Rate ${star} star${star > 1 ? 's' : ''}`
                  }
                  title={
                    isCurrentSelection
                      ? `Click to remove your ${star}-star rating`
                      : `Rate ${star} star${star > 1 ? 's' : ''}`
                  }
                >
                  ★
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
