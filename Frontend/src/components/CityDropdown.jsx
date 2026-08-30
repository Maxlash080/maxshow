import React, { useState, useRef, useEffect, useMemo } from 'react';
import { getCitiesForState, saveCustomCityForState } from '../utils/constants';
import { useToast } from '../context/ToastContext';

export const CityDropdown = ({
  state = 'Maharashtra',
  value = 'Pune',
  onChange,
  className = '',
  placeholder = 'Select or search city...',
  required = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [isAddingMode, setIsAddingMode] = useState(false);
  const [newCityInput, setNewCityInput] = useState('');
  const [customVersion, setCustomVersion] = useState(0);

  const dropdownRef = useRef(null);
  const searchInputRef = useRef(null);
  const addInputRef = useRef(null);
  const { showToast } = useToast();

  // Reset search and adding state whenever selected state changes
  useEffect(() => {
    setSearch('');
    setIsAddingMode(false);
    setNewCityInput('');
  }, [state]);

  // Synchronously compute the complete cities list for the currently selected state
  const cityList = useMemo(() => {
    return getCitiesForState(state);
  }, [state, customVersion]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
        setSearch('');
        setIsAddingMode(false);
        setNewCityInput('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (isOpen) {
      if (isAddingMode && addInputRef.current) {
        setTimeout(() => addInputRef.current?.focus(), 50);
      } else if (!isAddingMode && searchInputRef.current) {
        setTimeout(() => searchInputRef.current?.focus(), 50);
      }
    }
  }, [isOpen, isAddingMode]);

  const filteredCities = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return cityList;
    return cityList.filter((city) => city.toLowerCase().includes(q));
  }, [cityList, search]);

  const exactMatch = useMemo(() => {
    if (!search.trim()) return null;
    const cleanSearch = search.toLowerCase().trim();
    return cityList.find((city) => city.toLowerCase().trim() === cleanSearch);
  }, [cityList, search]);

  const handleSelectCity = (city) => {
    onChange(city);
    setSearch('');
    setIsAddingMode(false);
    setNewCityInput('');
    setIsOpen(false);
  };

  const submitNewCity = (rawInput) => {
    const raw = (rawInput || '').trim();
    if (!raw) {
      showToast('Please enter a city name.');
      return;
    }

    const clean = raw
      .replace(/^[,\s-]+|[,\s-]+$/g, '')
      .split(/\s+/)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');

    if (!clean) {
      showToast('Please enter a valid city name.');
      return;
    }

    // Check if city already exists in current state's list
    const existing = cityList.find(
      (c) => c.toLowerCase().trim() === clean.toLowerCase().trim()
    );

    if (existing) {
      showToast(`⚠️ City "${existing}" already exists in ${state}!`);
      handleSelectCity(existing);
      return;
    }

    saveCustomCityForState(state, clean);
    setCustomVersion((v) => v + 1);
    onChange(clean);
    showToast(`✨ Added "${clean}" to ${state} cities list!`);
    setSearch('');
    setIsAddingMode(false);
    setNewCityInput('');
    setIsOpen(false);
  };

  return (
    <div className={`relative ${isOpen ? 'z-50' : 'z-10'} ${className}`} ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => {
          setIsOpen((prev) => !prev);
          setSearch('');
          setIsAddingMode(false);
          setNewCityInput('');
        }}
        className="flex w-full items-center justify-between gap-2 rounded-xl border border-stone-300 dark:border-slate-700 bg-white dark:bg-[#101820] px-3.5 py-2.5 text-left text-xs sm:text-sm font-semibold outline-none transition hover:border-coral focus:border-coral focus:ring-4 focus:ring-coral/20 dark:text-white shadow-xs"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <span className="flex items-center gap-2 truncate">
          <span className="text-coral shrink-0">🏙️</span>
          <span className={`truncate ${value ? 'text-ink dark:text-white font-bold' : 'text-slate-400'}`}>
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
        <div
          onWheel={(e) => e.stopPropagation()}
          data-dropdown-popover
          className="absolute left-0 right-0 top-full mt-1.5 z-50 max-h-80 overflow-hidden overscroll-contain rounded-2xl border border-stone-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-[#1c2733] animate-in fade-in zoom-in-95 duration-150 flex flex-col"
        >
          {/* Header Info */}
          <div className="px-3 pt-2 pb-1 text-[11px] font-bold text-slate-400 dark:text-slate-500 flex items-center justify-between border-b border-stone-100 dark:border-slate-800">
            <span>Cities in {state} ({cityList.length})</span>
            <span className="text-[10px] text-coral font-bold uppercase tracking-wider">A-Z</span>
          </div>

          {/* ADD NEW CITY INLINE FORM MODE */}
          {isAddingMode ? (
            <div className="p-3 bg-stone-50 dark:bg-[#151f2b] border-b border-stone-200 dark:border-slate-700 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-ink dark:text-white flex items-center gap-1.5">
                  <span>➕</span>
                  <span>Add New City in {state}</span>
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setIsAddingMode(false);
                    setNewCityInput('');
                  }}
                  className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  ✕ Cancel
                </button>
              </div>

              <div>
                <input
                  ref={addInputRef}
                  type="text"
                  value={newCityInput}
                  onChange={(e) => setNewCityInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      submitNewCity(newCityInput);
                    }
                  }}
                  placeholder={`e.g. New City, ${state}...`}
                  className="w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-xs sm:text-sm font-semibold outline-none focus:border-coral dark:border-slate-700 dark:bg-[#101820] dark:text-white"
                />
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => submitNewCity(newCityInput)}
                  className="flex-1 rounded-xl bg-coral px-3 py-2 text-xs font-bold text-white shadow-sm hover:bg-[#df503c] transition cursor-pointer"
                >
                  Add &amp; Select
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsAddingMode(false);
                    setNewCityInput('');
                  }}
                  className="rounded-xl border border-stone-300 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-stone-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-[#283747]"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            /* SEARCH & TOP ACTION BAR */
            <div className="p-2.5 border-b border-stone-100 dark:border-slate-700 bg-stone-50/90 dark:bg-[#151f2b] space-y-2">
              {/* Search Bar */}
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 pointer-events-none">🔍</span>
                <input
                  ref={searchInputRef}
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      if (search.trim()) {
                        if (exactMatch) {
                          handleSelectCity(exactMatch);
                        } else {
                          submitNewCity(search);
                        }
                      }
                    }
                  }}
                  placeholder={`Search ${state} cities...`}
                  className="w-full rounded-xl border border-stone-300 bg-white py-2 pl-8 pr-7 text-xs sm:text-sm font-semibold outline-none focus:border-coral dark:border-slate-700 dark:bg-[#101820] dark:text-white"
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-ink dark:hover:text-white"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Dynamic Add Button when searching */}
              {search.trim() && !exactMatch ? (
                <button
                  type="button"
                  onClick={() => submitNewCity(search)}
                  className="flex w-full items-center justify-between gap-2 rounded-xl bg-coral/10 hover:bg-coral px-3 py-2 text-left text-xs sm:text-sm font-bold text-coral hover:text-white transition border border-coral/20 hover:border-coral shadow-sm group cursor-pointer"
                >
                  <span className="flex items-center gap-2 truncate">
                    <span className="text-base group-hover:scale-110 transition-transform">➕</span>
                    <span className="truncate">Add "{search.trim()}" in {state}</span>
                  </span>
                  <span className="text-[10px] bg-coral text-white group-hover:bg-white group-hover:text-coral rounded-md px-1.5 py-0.5 font-black uppercase">
                    Add
                  </span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setIsAddingMode(true);
                    setNewCityInput('');
                  }}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-coral/10 hover:bg-coral px-3 py-1.5 text-xs font-bold text-coral hover:text-white transition shadow-sm border border-coral/25 cursor-pointer"
                >
                  <span>➕</span>
                  <span>Add Custom City in {state}</span>
                </button>
              )}
            </div>
          )}

          {/* City Options List (Sorted Alphabetically) */}
          <div
            onWheel={(e) => e.stopPropagation()}
            className="overflow-y-auto overscroll-contain p-1.5 max-h-56 space-y-0.5 no-scrollbar"
          >
            {filteredCities.map((city) => {
              const isSelected = (value || '').toLowerCase() === city.toLowerCase();
              return (
                <button
                  key={city}
                  type="button"
                  onClick={() => handleSelectCity(city)}
                  className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-xs sm:text-sm font-semibold transition cursor-pointer ${
                    isSelected
                      ? 'bg-coral text-white font-bold shadow-sm'
                      : 'text-slate-700 hover:bg-coral/10 hover:text-coral dark:text-slate-200 dark:hover:bg-[#283747]'
                  }`}
                >
                  <span className="flex items-center gap-2 truncate">
                    <span className="text-xs opacity-75">🏙️</span>
                    <span className="truncate">{city}</span>
                  </span>
                  {isSelected && (
                    <svg className="h-4 w-4 shrink-0 text-white" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                    </svg>
                  )}
                </button>
              );
            })}

            {filteredCities.length === 0 && !search.trim() && (
              <div className="py-4 text-center text-xs text-slate-400 font-semibold">
                No cities found for {state}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
