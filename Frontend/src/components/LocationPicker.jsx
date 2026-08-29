import React, { useState, useRef, useEffect } from 'react';
import { LOCATIONS } from '../utils/constants';
import { useToast } from '../context/ToastContext';

export const LocationPicker = ({
  currentLocation,
  onLocationChange,
  availableLocations = [],
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);
  const { showToast } = useToast();

  // Filter out "Pune" from both available locations and fallback LOCATIONS
  const isInvalidLocation = (loc) => {
    if (!loc || typeof loc !== 'string') return true;
    const clean = loc.trim().toLowerCase();
    return clean === 'pune' || clean === 'pune, pune' || clean === 'pune city' || clean === '';
  };

  const filteredAvailableLocations = availableLocations.filter((loc) => !isInvalidLocation(loc));
  const filteredLocations = LOCATIONS.filter((loc) => !isInvalidLocation(loc));
  const locationsList = filteredAvailableLocations.length > 0 ? filteredAvailableLocations : filteredLocations;

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  const handleSelect = (loc) => {
    // Prevent selecting "Pune" even if it somehow gets through
    if (isInvalidLocation(loc)) {
      showToast('Please select a specific area instead of Pune');
      return;
    }
    onLocationChange(loc);
    setIsOpen(false);
    showToast(`Showing events near ${loc}`);
  };

  return (
    <div className="relative hidden sm:block" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex items-center gap-1.5 rounded-full border border-stone-200/90 dark:border-white/10 bg-white/90 dark:bg-white/5 px-3.5 py-1.5 text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-200 hover:border-coral hover:text-coral transition-all shadow-xs backdrop-blur-sm active:scale-95 cursor-pointer"
        type="button"
        aria-expanded={isOpen}
      >
        <svg className="h-3.5 w-3.5 text-coral shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 21s7-5.5 7-12A7 7 0 1 0 5 9c0 6.5 7 12 7 12Z" />
          <circle cx="12" cy="9" r="2.5" />
        </svg>
        <span className="truncate max-w-[110px]">{currentLocation}</span>
        <svg className={`h-3 w-3 text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180 text-coral' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div
          onWheel={(e) => e.stopPropagation()}
          data-dropdown-popover
          className="absolute right-0 mt-2 z-50 w-56 rounded-2xl border border-stone-200/80 bg-white/95 p-1.5 shadow-xl dark:border-white/10 dark:bg-[#1c2733]/95 backdrop-blur-xl animate-in fade-in zoom-in-95 duration-150 max-h-60 overflow-y-auto overscroll-contain"
        >
          {locationsList.map((loc) => (
            <button
              key={loc}
              onClick={() => handleSelect(loc)}
              className={`w-full rounded-xl px-3 py-2 text-left text-xs font-bold transition flex items-center justify-between cursor-pointer ${
                currentLocation === loc
                  ? 'bg-coral text-white font-black shadow-xs'
                  : 'text-slate-700 dark:text-slate-200 hover:bg-stone-100 dark:hover:bg-white/10'
              }`}
              type="button"
            >
              <span>{loc}</span>
              {currentLocation === loc && (
                <span className="text-xs">✓</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
