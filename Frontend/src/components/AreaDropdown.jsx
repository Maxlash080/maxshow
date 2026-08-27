import React, { useState, useRef, useEffect } from 'react';
import { AREA_OPTIONS } from '../utils/constants';

export const AreaDropdown = ({
  value,
  onChange,
  placeholder = 'Select or enter city / area...',
  className = '',
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

  const filteredAreas = AREA_OPTIONS.filter((area) =>
    area.toLowerCase().includes(search.toLowerCase().trim())
  );

  const exactMatch = AREA_OPTIONS.some(
    (area) => area.toLowerCase() === (search.trim() || value || '').toLowerCase()
  );

  const handleSelectArea = (area) => {
    onChange(area);
    setSearch('');
    setIsOpen(false);
  };

  return (
    <div className={`relative ${isOpen ? 'z-30' : 'z-10'} ${className}`} ref={dropdownRef}>
      {/* Trigger Button */}
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
          <span className="text-coral">📍</span>
          <span className={`truncate ${value ? 'text-ink dark:text-white' : 'text-slate-400'}`}>
            {value || placeholder}
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

      {/* Hidden input to ensure native form validation if required */}
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

      {/* Dropdown Menu Popover */}
      {isOpen && (
        <div className="absolute left-0 right-0 top-full mt-1.5 max-h-72 overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-[#1c2733] animate-in fade-in zoom-in-95 duration-150 flex flex-col">
          {/* Quick Search & Custom Input Bar */}
          <div className="p-2 border-b border-stone-100 dark:border-slate-700 bg-stone-50/70 dark:bg-[#151f2b]">
            <div className="relative">
              <input
                ref={searchInputRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    if (search.trim()) {
                      handleSelectArea(search.trim());
                    }
                  }
                }}
                placeholder="Search or enter custom area..."
                className="w-full rounded-xl border border-stone-300 bg-white py-1.5 pl-8 pr-3 text-xs font-semibold outline-none focus:border-coral dark:border-slate-700 dark:bg-[#101820] dark:text-white"
              />
              <span className="absolute left-2.5 top-2 text-xs text-slate-400">🔍</span>
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute right-2 top-1.5 text-xs text-slate-400 hover:text-ink dark:hover:text-white"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* Area Options List */}
          <div className="overflow-y-auto p-1.5 max-h-56 space-y-0.5">
            {/* Custom entry button if user typed something not matching exactly */}
            {search.trim() && !exactMatch && (
              <button
                type="button"
                onClick={() => handleSelectArea(search.trim())}
                className="flex w-full items-center gap-2 rounded-xl bg-coral/10 px-3 py-2 text-left text-xs font-bold text-coral hover:bg-coral hover:text-white transition mb-1"
              >
                <span>➕</span>
                <span className="truncate">Use custom: "{search.trim()}"</span>
              </button>
            )}

            {filteredAreas.map((area) => {
              const isSelected = (value || '').toLowerCase() === area.toLowerCase();
              return (
                <button
                  key={area}
                  type="button"
                  onClick={() => handleSelectArea(area)}
                  className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-xs sm:text-sm font-semibold transition ${
                    isSelected
                      ? 'bg-coral text-white font-bold shadow-sm'
                      : 'text-slate-700 hover:bg-coral/10 hover:text-coral dark:text-slate-200 dark:hover:bg-[#283747]'
                  }`}
                >
                  <span className="flex items-center gap-2 truncate">
                    <span className="text-xs opacity-75">📍</span>
                    <span className="truncate">{area}</span>
                  </span>
                  {isSelected && (
                    <svg className="h-4 w-4 shrink-0 text-white" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                    </svg>
                  )}
                </button>
              );
            })}

            {filteredAreas.length === 0 && !search.trim() && (
              <div className="py-4 text-center text-xs text-slate-400 font-semibold">
                No areas found
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
