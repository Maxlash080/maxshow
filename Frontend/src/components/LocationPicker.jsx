import React, { useState, useRef, useEffect } from 'react';
import { LOCATIONS } from '../utils/constants';
import { useToast } from '../context/ToastContext';

export const LocationPicker = ({ currentLocation, onLocationChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);
  const { showToast } = useToast();

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
    onLocationChange(loc);
    setIsOpen(false);
    showToast(`Showing events near ${loc}`);
  };

  return (
    <div className="relative hidden sm:block" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex items-center gap-2 rounded-full border border-stone-300 bg-white px-4 py-2 text-sm font-semibold dark:border-slate-700 dark:bg-[#1c2733] dark:text-white hover:border-coral transition"
        type="button"
        aria-expanded={isOpen}
      >
        <svg className="h-4 w-4 text-coral" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 21s7-5.5 7-12A7 7 0 1 0 5 9c0 6.5 7 12 7 12Z" />
          <circle cx="12" cy="9" r="2.5" />
        </svg>
        <span>{currentLocation}</span>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 z-50 w-48 rounded-2xl border border-stone-200 bg-white p-2 shadow-soft dark:border-slate-700 dark:bg-[#1c2733] animate-in fade-in duration-150">
          {LOCATIONS.map((loc) => (
            <button
              key={loc}
              onClick={() => handleSelect(loc)}
              className={`w-full rounded-xl px-3 py-2 text-left text-sm font-semibold transition ${
                currentLocation === loc
                  ? 'bg-coral text-white'
                  : 'hover:bg-cream dark:text-white dark:hover:bg-[#283747]'
              }`}
              type="button"
            >
              {loc}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
