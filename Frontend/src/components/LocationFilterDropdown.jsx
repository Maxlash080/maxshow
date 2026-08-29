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
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const displayList = useMemo(() => {
    const locSet = new Set();
    locations.forEach((l) => {
      const clean = (l || '').replace(/,\s*pune$/i, '').trim();
      if (clean && clean.toLowerCase() !== 'pune') {
        locSet.add(clean);
      }
    });
    const custom = getCustomAreas();
    custom.forEach((c) => {
      const clean = (c || '').replace(/,\s*pune$/i, '').trim();
      if (clean && clean.toLowerCase() !== 'pune') {
        locSet.add(clean);
      }
    });
    LOCATIONS.forEach((l) => {
      if (l.toLowerCase() !== 'pune') {
        locSet.add(l);
      }
    });
    return Array.from(locSet);
  }, [locations, isOpen]);

  return (
    <div className={`relative ${isOpen ? 'z-30' : 'z-10'} ${className}`} ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex w-full items-center justify-between gap-2 rounded-xl border border-stone-300 bg-white px-3.5 py-2.5 text-left text-xs sm:text-sm font-semibold outline-none transition hover:border-coral focus:border-coral dark:border-slate-700 dark:bg-[#101820] dark:text-white shadow-sm"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <span className="flex items-center gap-2 truncate">
          <span className="text-base">📍</span>
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
          className="absolute left-0 right-0 top-full mt-1.5 max-h-64 overflow-y-auto overscroll-contain rounded-2xl border border-stone-200 bg-white p-1.5 shadow-2xl dark:border-slate-700 dark:bg-[#1c2733] animate-in fade-in zoom-in-95 duration-150"
        >
          {includeAll && (
            <button
              type="button"
              onClick={() => {
                onChange('all');
                setIsOpen(false);
              }}
              className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-xs sm:text-sm font-semibold transition ${
                value === 'all' || !value
                  ? 'bg-coral text-white font-bold shadow-sm'
                  : 'text-slate-700 hover:bg-coral/10 hover:text-coral dark:text-slate-200 dark:hover:bg-[#283747]'
              }`}
            >
              <span className="flex items-center gap-2.5 truncate">
                <span className="text-base">📍</span>
                <span>{allLabel}</span>
              </span>
              {(value === 'all' || !value) && (
                <svg className="h-4 w-4 shrink-0 text-white" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                </svg>
              )}
            </button>
          )}

          {displayList.map((loc) => {
            const isSelected = (value || '').toLowerCase() === loc.toLowerCase();
            return (
              <button
                key={loc}
                type="button"
                onClick={() => {
                  onChange(loc);
                  setIsOpen(false);
                }}
                className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-xs sm:text-sm font-semibold transition ${
                  isSelected
                    ? 'bg-coral text-white font-bold shadow-sm'
                    : 'text-slate-700 hover:bg-coral/10 hover:text-coral dark:text-slate-200 dark:hover:bg-[#283747]'
                }`}
              >
                <span className="flex items-center gap-2.5 truncate">
                  <span className="text-base">🏙️</span>
                  <span className="truncate">{loc}</span>
                </span>
                {isSelected && (
                  <svg className="h-4 w-4 shrink-0 text-white" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                  </svg>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
