import React, { useState, useRef, useEffect, useMemo } from 'react';
import { LOCATIONS, getCustomAreas } from '../utils/constants';

export const LocationFilterDropdown = ({
  value,
  onChange,
  locations = [],
  className = '',
  includeAll = true,
  allLabel = 'All Locations',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const dropdownRef = useRef(null);
  const searchInputRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  const displayList = useMemo(() => {
    const locSet = new Set();
    (locations || []).forEach((l) => {
      if (!l) return;
      const clean = String(l).replace(/,\s*pune$/i, '').trim();
      if (clean && clean.toLowerCase() !== 'pune' && clean.toLowerCase() !== 'all') {
        locSet.add(clean);
      }
    });
    return Array.from(locSet).sort((a, b) => a.localeCompare(b));
  }, [locations]);

  const filteredList = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return displayList;
    return displayList.filter((loc) => loc.toLowerCase().includes(q));
  }, [displayList, search]);

  return (
    <div className={`relative ${isOpen ? 'z-50' : 'z-10'} ${className}`} ref={dropdownRef}>
      <button
        type="button"
        onClick={() => {
          setIsOpen((prev) => !prev);
          setSearch('');
        }}
        className="flex w-full items-center justify-between gap-2 rounded-xl border border-stone-300 bg-white px-3.5 py-2.5 text-left text-xs sm:text-sm font-semibold outline-none transition hover:border-coral focus:border-coral dark:border-slate-700 dark:bg-[#101820] dark:text-white shadow-sm"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <span className="flex items-center gap-2 truncate">
          <span className="text-base shrink-0">📍</span>
          <span className="truncate">
            {value === 'all' || !value
              ? allLabel
              : value}
          </span>
        </span>
        <svg
          className={`h-4 w-4 text-slate-400 transition-transform duration-200 shrink-0 ${
            isOpen ? 'rotate-180 text-coral' : ''
          }`}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="m19 9-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div
          onWheel={(e) => e.stopPropagation()}
          data-dropdown-popover
          className="absolute left-0 top-full mt-1.5 z-50 min-w-full sm:min-w-[280px] max-w-[360px] overflow-hidden rounded-2xl border border-stone-200 bg-white p-2 shadow-2xl dark:border-slate-700 dark:bg-[#1c2733] animate-in fade-in zoom-in-95 duration-150 flex flex-col"
        >
          {/* Search Box */}
          <div className="relative mb-2 shrink-0">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">🔍</span>
            <input
              ref={searchInputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search locations..."
              className="w-full rounded-xl border border-stone-200 dark:border-slate-600 bg-stone-50 dark:bg-[#101820] pl-8 pr-7 py-1.5 text-xs font-semibold text-ink dark:text-white outline-none focus:border-coral focus:ring-2 focus:ring-coral/20"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600 dark:hover:text-white"
              >
                ✕
              </button>
            )}
          </div>

          <div className="overflow-y-auto overscroll-contain max-h-60 space-y-0.5 no-scrollbar pr-0.5">
            {includeAll && !search && (
              <button
                type="button"
                onClick={() => {
                  onChange('all');
                  setIsOpen(false);
                }}
                className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-xs sm:text-sm font-semibold transition cursor-pointer ${
                  value === 'all' || !value
                    ? 'bg-coral text-white font-bold shadow-sm'
                    : 'text-slate-700 hover:bg-coral/10 hover:text-coral dark:text-slate-200 dark:hover:bg-[#283747]'
                }`}
              >
                <span className="flex items-center gap-2.5">
                  <span className="text-base shrink-0">📍</span>
                  <span className="font-bold">{allLabel}</span>
                </span>
                {(value === 'all' || !value) && (
                  <svg className="h-4 w-4 shrink-0 text-white" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                  </svg>
                )}
              </button>
            )}

            {filteredList.length === 0 ? (
              <div className="py-4 text-center text-xs font-semibold text-slate-400">
                No location found matching "{search}"
              </div>
            ) : (
              filteredList.map((loc) => {
                const isSelected = (value || '').toLowerCase() === loc.toLowerCase();
                return (
                  <button
                    key={loc}
                    type="button"
                    onClick={() => {
                      onChange(loc);
                      setIsOpen(false);
                    }}
                    className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-xs sm:text-sm font-semibold transition cursor-pointer ${
                      isSelected
                        ? 'bg-coral text-white font-bold shadow-sm'
                        : 'text-slate-700 hover:bg-coral/10 hover:text-coral dark:text-slate-200 dark:hover:bg-[#283747]'
                    }`}
                  >
                    <span className="flex items-center gap-2.5">
                      <span className="text-base shrink-0">🏙️</span>
                      <span className="font-semibold break-words text-left">{loc}</span>
                    </span>
                    {isSelected && (
                      <svg className="h-4 w-4 shrink-0 text-white ml-2" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                      </svg>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};
