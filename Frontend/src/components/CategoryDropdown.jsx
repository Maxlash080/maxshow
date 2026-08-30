import React, { useState, useRef, useEffect } from 'react';
import { EVENT_CATEGORIES } from '../utils/constants';

export const CategoryDropdown = ({
  value,
  onChange,
  className = '',
  includeAll = false,
  allLabel = 'All Categories',
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

  const selectedCat = EVENT_CATEGORIES.find(
    (c) => c.id.toLowerCase() === (value || '').toLowerCase()
  );

  return (
    <div className={`relative ${isOpen ? 'z-50' : 'z-10'} ${className}`} ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex w-full items-center justify-between gap-2 rounded-xl border border-stone-300 dark:border-slate-600/80 bg-white dark:bg-[#0d141e] px-3.5 py-2.5 text-left text-xs sm:text-sm font-semibold outline-none transition hover:border-slate-400 dark:hover:border-slate-400 focus:border-coral dark:text-white shadow-inner"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <span className="flex items-center gap-2 truncate">
          {value === 'all' && <span className="text-base">🌐</span>}
          {selectedCat && value !== 'all' && <span className="text-base">{selectedCat.icon}</span>}
          <span className="truncate">
            {value === 'all'
              ? allLabel
              : selectedCat
              ? selectedCat.name
              : value || 'Select Category'}
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
          className="absolute left-0 top-full mt-1.5 z-50 min-w-full sm:min-w-[220px] max-h-64 overflow-y-auto overscroll-contain rounded-2xl border border-stone-200 bg-white p-1.5 shadow-2xl dark:border-slate-700 dark:bg-[#1c2733] animate-in fade-in zoom-in-95 duration-150"
        >
          {includeAll && (
            <button
              type="button"
              onClick={() => {
                onChange('all');
                setIsOpen(false);
              }}
              className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-xs sm:text-sm font-semibold transition ${
                value === 'all'
                  ? 'bg-coral text-white font-bold shadow-sm'
                  : 'text-slate-700 hover:bg-coral/10 hover:text-coral dark:text-slate-200 dark:hover:bg-[#283747]'
              }`}
            >
              <span className="flex items-center gap-2.5 truncate">
                <span className="text-base">🌐</span>
                <span>{allLabel}</span>
              </span>
              {value === 'all' && (
                <svg className="h-4 w-4 shrink-0 text-white" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                </svg>
              )}
            </button>
          )}

          {EVENT_CATEGORIES.map((cat) => {
            const isSelected = (value || '').toLowerCase() === cat.id.toLowerCase();
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => {
                  onChange(cat.id);
                  setIsOpen(false);
                }}
                className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-xs sm:text-sm font-semibold transition ${
                  isSelected
                    ? 'bg-coral text-white font-bold shadow-sm'
                    : 'text-slate-700 hover:bg-coral/10 hover:text-coral dark:text-slate-200 dark:hover:bg-[#283747]'
                }`}
              >
                <span className="flex items-center gap-2.5 truncate">
                  <span className="text-base">{cat.icon}</span>
                  <span className="truncate">{cat.name}</span>
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
