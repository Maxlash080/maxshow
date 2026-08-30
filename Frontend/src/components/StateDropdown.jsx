import React, { useState, useRef, useEffect, useMemo } from 'react';
import { INDIAN_STATES } from '../utils/constants';

export const StateDropdown = ({
  value = 'Maharashtra',
  onChange,
  className = '',
  placeholder = 'Select State...',
  required = false,
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

  const filteredStates = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return INDIAN_STATES;
    return INDIAN_STATES.filter((st) => st.toLowerCase().includes(q));
  }, [search]);

  const handleSelectState = (st) => {
    onChange(st);
    setSearch('');
    setIsOpen(false);
  };

  return (
    <div className={`relative ${isOpen ? 'z-50' : 'z-10'} ${className}`} ref={dropdownRef}>
      <button
        type="button"
        onClick={() => {
          setIsOpen((prev) => !prev);
          setSearch('');
        }}
        className="flex w-full items-center justify-between gap-2 rounded-xl border border-stone-300 dark:border-slate-700 bg-white dark:bg-[#101820] px-3.5 py-2.5 text-left text-xs sm:text-sm font-semibold outline-none transition hover:border-coral focus:border-coral focus:ring-4 focus:ring-coral/20 dark:text-white shadow-xs"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <span className="flex items-center gap-2 truncate">
          <span className="text-base shrink-0">🏛️</span>
          <span className="truncate font-bold text-ink dark:text-white">
            {value || placeholder}
          </span>
        </span>
        <svg
          className={`h-4 w-4 text-slate-400 transition-transform duration-200 shrink-0 ${
            isOpen ? 'rotate-180 text-coral' : ''
          }`}
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="m19 9-7 7-7-7" />
        </svg>
      </button>

      {required && (
        <input
          type="text"
          value={value || ''}
          onChange={() => {}}
          required
          className="sr-only"
          tabIndex={-1}
        />
      )}

      {isOpen && (
        <div
          onWheel={(e) => e.stopPropagation()}
          data-dropdown-popover
          className="absolute left-0 right-0 top-full mt-1.5 z-50 max-h-72 w-full overflow-hidden rounded-2xl border border-stone-200 bg-white p-2 shadow-2xl dark:border-slate-700 dark:bg-[#1c2733] animate-in fade-in zoom-in-95 duration-150 flex flex-col"
        >
          {/* Header Info */}
          <div className="px-2 pt-1 pb-1.5 text-[11px] font-bold text-slate-400 dark:text-slate-500 flex items-center justify-between border-b border-stone-100 dark:border-slate-800 mb-1.5">
            <span>States &amp; UTs of India ({INDIAN_STATES.length})</span>
            <span className="text-[10px] text-coral font-bold uppercase tracking-wider">Searchable</span>
          </div>

          {/* Search Box */}
          <div className="relative mb-2 shrink-0">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 pointer-events-none">🔍</span>
            <input
              ref={searchInputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search Indian states..."
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

          {/* States List */}
          <div
            onWheel={(e) => e.stopPropagation()}
            className="overflow-y-auto overscroll-contain max-h-52 space-y-0.5 no-scrollbar pr-0.5"
          >
            {filteredStates.length === 0 ? (
              <div className="py-4 text-center text-xs font-semibold text-slate-400">
                No state found matching "{search}"
              </div>
            ) : (
              filteredStates.map((st) => {
                const isSelected = (value || '').toLowerCase() === st.toLowerCase();
                return (
                  <button
                    key={st}
                    type="button"
                    onClick={() => handleSelectState(st)}
                    className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-xs sm:text-sm font-semibold transition cursor-pointer ${
                      isSelected
                        ? 'bg-coral text-white font-bold shadow-xs'
                        : 'text-slate-700 hover:bg-coral/10 hover:text-coral dark:text-slate-200 dark:hover:bg-[#283747]'
                    }`}
                  >
                    <span className="flex items-center gap-2 truncate">
                      <span className="text-xs opacity-75">🏛️</span>
                      <span className="truncate">{st}</span>
                    </span>
                    {isSelected && (
                      <svg className="h-4 w-4 shrink-0 text-white" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
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
