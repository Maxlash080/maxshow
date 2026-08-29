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
  const [searchQuery, setSearchQuery] = useState('');

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
    let list = events;
    if (activeFilter !== 'all') {
      list = list.filter(
        (e) => (e.category || '').toLowerCase() === activeFilter.toLowerCase()
      );
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (e) =>
          (e.title || '').toLowerCase().includes(q) ||
          (e.location || '').toLowerCase().includes(q) ||
          (e.venue || '').toLowerCase().includes(q) ||
          (e.category || '').toLowerCase().includes(q) ||
          (e.type || '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [events, activeFilter, searchQuery]);

  return (
    <div className="min-h-screen bg-cream text-ink dark:bg-[#101820] dark:text-white flex flex-col">
      <Navbar />

      <main className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-8 space-y-8 flex-1">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl sm:text-4xl font-black text-ink dark:text-white">All Experiences</h1>
            <p className="mt-1 text-xs sm:text-sm font-semibold text-slate-500 dark:text-slate-400">
              {filtered.length} experience{filtered.length === 1 ? '' : 's'} to explore
            </p>
          </div>

          {/* Search Bar with Icon */}
          <div className="relative w-full sm:w-72">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm pointer-events-none">🔍</span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search experiences, venues..."
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
