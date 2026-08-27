import React, { useState, useEffect, useMemo } from 'react';
import { Navbar } from '../components/Navbar';
import { Footer } from '../components/Footer';
import { EventCard } from '../components/EventCard';
import { apiRequest } from '../utils/api';
import { FALLBACK_EVENTS } from '../utils/constants';

const FILTER_CATEGORIES = [
  { id: 'all', label: 'All' },
  { id: 'music', label: 'Music' },
  { id: 'comedy', label: 'Comedy' },
  { id: 'outdoors', label: 'Outdoors' },
  { id: 'create', label: 'Workshops' },
  { id: 'food', label: 'Food & Drinks' },
  { id: 'move', label: 'Move & Sports' },
];

export const AllEventsPage = () => {
  const [events, setEvents] = useState(Object.values(FALLBACK_EVENTS));
  const [activeFilter, setActiveFilter] = useState('all');

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    apiRequest('/api/events')
      .then((data) => {
        if (data && Array.isArray(data.events) && data.events.length > 0) {
          setEvents(data.events);
        }
      })
      .catch(() => {});
  }, []);

  const filtered = useMemo(() => {
    if (activeFilter === 'all') return events;
    return events.filter(
      (e) => (e.category || '').toLowerCase() === activeFilter.toLowerCase()
    );
  }, [events, activeFilter]);

  return (
    <div className="min-h-screen bg-cream text-ink dark:bg-[#101820] dark:text-white flex flex-col">
      <Navbar />

      <main className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-8 space-y-8 flex-1">
        <div>
          <h1 className="text-3xl sm:text-4xl font-black text-ink dark:text-white">All Experiences</h1>
          <p className="mt-1 text-xs sm:text-sm font-semibold text-slate-500 dark:text-slate-400">
            {filtered.length} experience{filtered.length === 1 ? '' : 's'} to explore
          </p>
        </div>

        {/* Category Pills */}
        <div className="flex gap-2.5 overflow-x-auto pb-2 no-scrollbar">
          {FILTER_CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveFilter(cat.id)}
              className={`rounded-full px-5 py-2 text-xs sm:text-sm font-bold transition whitespace-nowrap ${
                activeFilter === cat.id
                  ? 'bg-ink text-white dark:bg-coral shadow-sm'
                  : 'border border-stone-300 bg-white text-slate-700 hover:border-coral dark:border-slate-700 dark:bg-[#1c2733] dark:text-slate-300'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Events Grid */}
        {filtered.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-stone-300 p-12 text-center dark:border-slate-700">
            <span className="text-4xl">🎭</span>
            <h3 className="mt-3 text-lg font-black text-ink dark:text-white">No experiences found</h3>
            <p className="mt-1 text-xs sm:text-sm text-slate-500 dark:text-slate-400">
              Try selecting a different category.
            </p>
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
