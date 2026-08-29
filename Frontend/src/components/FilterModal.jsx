import React, { useState } from 'react';
import { useLockBodyScroll } from '../utils/useLockBodyScroll';

const SORT_OPTIONS = [
  { id: 'popularity', label: 'Popularity' },
  { id: 'price_low_high', label: 'Price: Low to High' },
  { id: 'price_high_low', label: 'Price: High to Low' },
  { id: 'date', label: 'Date' },
];

const GENRE_OPTIONS = [
  'All Genres',
  'Acoustic',
  'Stand-up Comedy',
  'Electronic / DJ',
  'Rock & Indie',
  'Workshops & Craft',
  'Cinema & Screenings',
  'Culinary & Dining',
  'Fitness & Yoga',
];

export const FilterModal = ({ isOpen, onClose, filters, onApply }) => {
  const [activeTab, setActiveTab] = useState('sort'); // 'sort' | 'genre'
  const [tempSort, setTempSort] = useState(filters.sort || 'popularity');
  const [tempGenre, setTempGenre] = useState(filters.genre || 'All Genres');

  useLockBodyScroll(isOpen);

  if (!isOpen) return null;

  const handleApply = () => {
    onApply({
      sort: tempSort,
      genre: tempGenre,
    });
    onClose();
  };

  const handleClear = () => {
    setTempSort('popularity');
    setTempGenre('All Genres');
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex flex-col h-[520px] max-h-[90vh] w-full max-w-lg overflow-hidden rounded-[2.5rem] bg-white shadow-2xl dark:bg-[#1c2733] border border-stone-200 dark:border-slate-700 animate-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-stone-200 px-6 py-4 dark:border-slate-700">
          <h2 className="text-xl font-black text-ink dark:text-white">Filters</h2>
          <button
            onClick={onClose}
            type="button"
            className="grid h-8 w-8 place-items-center rounded-full text-slate-400 hover:bg-stone-100 hover:text-ink dark:hover:bg-slate-800 dark:hover:text-white transition"
          >
            ✕
          </button>
        </div>

        {/* Modal Body: Left Tab Sidebar + Right Content */}
        <div className="flex flex-1 overflow-hidden">
          <div className="w-1/3 border-r border-stone-200 bg-stone-50 dark:border-slate-700 dark:bg-[#151f2b] p-3 space-y-1.5">
            <button
              onClick={() => setActiveTab('sort')}
              type="button"
              className={`w-full rounded-2xl px-4 py-3 text-left text-sm font-bold transition ${
                activeTab === 'sort'
                  ? 'bg-white text-coral shadow-sm dark:bg-[#1c2733]'
                  : 'text-slate-600 hover:bg-stone-200/50 dark:text-slate-400 dark:hover:bg-slate-800'
              }`}
            >
              Sort By
            </button>
            <button
              onClick={() => setActiveTab('genre')}
              type="button"
              className={`w-full rounded-2xl px-4 py-3 text-left text-sm font-bold transition ${
                activeTab === 'genre'
                  ? 'bg-white text-coral shadow-sm dark:bg-[#1c2733]'
                  : 'text-slate-600 hover:bg-stone-200/50 dark:text-slate-400 dark:hover:bg-slate-800'
              }`}
            >
              Genre
            </button>
          </div>

          <div
            onWheel={(e) => e.stopPropagation()}
            className="flex-1 overflow-y-auto overscroll-contain p-5 space-y-2"
          >
            {activeTab === 'sort' && (
              <div>
                <p className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-400">Select sorting order</p>
                <div className="space-y-2">
                  {SORT_OPTIONS.map((opt) => (
                    <label
                      key={opt.id}
                      onClick={() => setTempSort(opt.id)}
                      className={`flex items-center justify-between rounded-2xl p-3 cursor-pointer border transition ${
                        tempSort === opt.id
                          ? 'border-coral bg-coral/5 dark:bg-coral/10 text-coral font-bold'
                          : 'border-stone-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-coral/50'
                      }`}
                    >
                      <span className="text-sm font-bold">{opt.label}</span>
                      <input
                        type="radio"
                        name="sort-option"
                        value={opt.id}
                        checked={tempSort === opt.id}
                        onChange={() => setTempSort(opt.id)}
                        className="accent-coral"
                      />
                    </label>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'genre' && (
              <div>
                <p className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-400">Filter by genre</p>
                <div className="space-y-2">
                  {GENRE_OPTIONS.map((g) => (
                    <label
                      key={g}
                      onClick={() => setTempGenre(g)}
                      className={`flex items-center justify-between rounded-2xl p-3 cursor-pointer border transition ${
                        tempGenre === g
                          ? 'border-coral bg-coral/5 dark:bg-coral/10 text-coral font-bold'
                          : 'border-stone-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-coral/50'
                      }`}
                    >
                      <span className="text-sm font-bold">{g}</span>
                      <input
                        type="radio"
                        name="genre-option"
                        value={g}
                        checked={tempGenre === g}
                        onChange={() => setTempGenre(g)}
                        className="accent-coral"
                      />
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between border-t border-stone-200 bg-stone-50 px-6 py-4 dark:border-slate-700 dark:bg-[#151f2b]">
          <button
            onClick={handleClear}
            type="button"
            className="text-sm font-bold text-slate-500 hover:text-coral transition dark:text-slate-400"
          >
            Clear all
          </button>
          <button
            onClick={handleApply}
            type="button"
            className="rounded-2xl bg-coral px-6 py-2.5 text-sm font-bold text-white shadow-md hover:bg-[#df503c] transition"
          >
            Apply filters
          </button>
        </div>
      </div>
    </div>
  );
};
