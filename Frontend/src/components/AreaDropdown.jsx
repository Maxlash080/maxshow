import React, { useState, useRef, useEffect, useMemo } from 'react';
import { getAllAreaOptions, saveCustomArea, formatLocationWithPune } from '../utils/constants';
import { useToast } from '../context/ToastContext';

export const AreaDropdown = ({
  value,
  onChange,
  placeholder = 'Select or enter city / area...',
  className = '',
  required = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [isAddingMode, setIsAddingMode] = useState(false);
  const [newLocationInput, setNewLocationInput] = useState('');
  const [customList, setCustomList] = useState([]);
  
  const dropdownRef = useRef(null);
  const searchInputRef = useRef(null);
  const addInputRef = useRef(null);
  const { showToast } = useToast();

  useEffect(() => {
    setCustomList(getAllAreaOptions());
  }, [isOpen]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
        setSearch('');
        setIsAddingMode(false);
        setNewLocationInput('');
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

  const allAreas = useMemo(() => {
    const combined = new Set([...customList, ...getAllAreaOptions()]);
    return Array.from(combined);
  }, [customList]);

  const filteredAreas = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return allAreas;
    return allAreas.filter((area) => area.toLowerCase().includes(q));
  }, [allAreas, search]);

  const formattedSearchCandidate = useMemo(() => {
    return formatLocationWithPune(search);
  }, [search]);

  const formattedNewInputCandidate = useMemo(() => {
    return formatLocationWithPune(newLocationInput);
  }, [newLocationInput]);

  const exactMatch = useMemo(() => {
    if (!search.trim()) return null;
    const cleanSearch = search.toLowerCase().replace(/,\s*pune$/i, '').trim();
    return allAreas.find((area) => {
      const cleanArea = area.toLowerCase().replace(/,\s*pune$/i, '').trim();
      return cleanArea === cleanSearch;
    });
  }, [allAreas, search]);

  const handleSelectArea = (area) => {
    onChange(area);
    setSearch('');
    setIsAddingMode(false);
    setNewLocationInput('');
    setIsOpen(false);
  };

  const submitNewLocation = (rawInput) => {
    const raw = (rawInput || '').trim();
    if (!raw) {
      showToast('Please enter a location name.');
      return;
    }

    const cleanCheck = raw.toLowerCase().replace(/,\s*pune$/i, '').trim();
    if (!cleanCheck || cleanCheck === 'pune') {
      showToast('Please enter a specific area name (e.g. Lonavala) rather than just Pune.');
      return;
    }

    const formatted = formatLocationWithPune(raw);
    if (!formatted) {
      showToast('Please enter a valid area name.');
      return;
    }

    // Check if location already exists in list (case-insensitive)
    const existing = allAreas.find((area) => {
      const cleanA = area.toLowerCase().replace(/,\s*pune$/i, '').trim();
      const cleanB = formatted.toLowerCase().replace(/,\s*pune$/i, '').trim();
      return cleanA === cleanB;
    });

    if (existing) {
      showToast(`⚠️ Location "${existing}" already exists in the list!`);
      handleSelectArea(existing);
      return;
    }

    // Save and select new location
    saveCustomArea(formatted);
    setCustomList((prev) => Array.from(new Set([...prev, formatted])));
    onChange(formatted);
    showToast(`✨ Added "${formatted}" to location list!`);
    setSearch('');
    setIsAddingMode(false);
    setNewLocationInput('');
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
          setIsAddingMode(false);
          setNewLocationInput('');
        }}
        className="flex w-full items-center justify-between gap-2 rounded-xl border border-stone-300 bg-white px-3.5 py-2.5 text-left text-xs sm:text-sm font-semibold outline-none transition hover:border-coral focus:border-coral dark:border-slate-700 dark:bg-[#101820] dark:text-white shadow-sm"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <span className="flex items-center gap-2 truncate">
          <span className="text-coral">📍</span>
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
        <div
          onWheel={(e) => e.stopPropagation()}
          data-dropdown-popover
          className="absolute left-0 right-0 top-full mt-1.5 max-h-96 overflow-hidden overscroll-contain rounded-2xl border border-stone-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-[#1c2733] animate-in fade-in zoom-in-95 duration-150 flex flex-col"
        >
          
          {/* ADD NEW LOCATION INLINE FORM MODE */}
          {isAddingMode ? (
            <div className="p-3 bg-stone-50 dark:bg-[#151f2b] border-b border-stone-200 dark:border-slate-700 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-ink dark:text-white flex items-center gap-1.5">
                  <span>➕</span>
                  <span>Add New Location</span>
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setIsAddingMode(false);
                    setNewLocationInput('');
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
                  value={newLocationInput}
                  onChange={(e) => setNewLocationInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      submitNewLocation(newLocationInput);
                    }
                  }}
                  placeholder="e.g. Lonavala, Wakad..."
                  className="w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-xs sm:text-sm font-semibold outline-none focus:border-coral dark:border-slate-700 dark:bg-[#101820] dark:text-white"
                />
                <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                  {newLocationInput.trim() ? (
                    <span>
                      Will be saved as: <strong className="text-coral">{formattedNewInputCandidate || `${newLocationInput.trim()}, Pune`}</strong>
                    </span>
                  ) : (
                    <span>(Pune is automatically appended)</span>
                  )}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => submitNewLocation(newLocationInput)}
                  className="flex-1 rounded-xl bg-coral px-3 py-2 text-xs font-bold text-white shadow-sm hover:bg-[#df503c] transition"
                >
                  Add &amp; Select
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsAddingMode(false);
                    setNewLocationInput('');
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
                          handleSelectArea(exactMatch);
                        } else {
                          submitNewLocation(search);
                        }
                      }
                    }
                  }}
                  placeholder="Search or enter custom area..."
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

              {/* ALWAYS-VISIBLE TOP "➕ Add New Location" BUTTON */}
              {!search.trim() ? (
                <button
                  type="button"
                  onClick={() => {
                    setIsAddingMode(true);
                    setNewLocationInput('');
                  }}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-coral/10 hover:bg-coral px-3 py-2 text-xs font-bold text-coral hover:text-white transition shadow-sm border border-coral/25"
                >
                  <span>➕</span>
                  <span>Add New Location</span>
                </button>
              ) : (
                /* Dynamic Add Button when user has typed something */
                !exactMatch && (
                  <div>
                    <button
                      type="button"
                      onClick={() => submitNewLocation(search)}
                      className="flex w-full items-center justify-between gap-2 rounded-xl bg-coral/10 hover:bg-coral px-3 py-2 text-left text-xs sm:text-sm font-bold text-coral hover:text-white transition border border-coral/20 hover:border-coral shadow-sm group"
                    >
                      <span className="flex items-center gap-2 truncate">
                        <span className="text-base group-hover:scale-110 transition-transform">➕</span>
                        <span className="truncate">Add new: <strong>{formattedSearchCandidate || `${search.trim()}, Pune`}</strong></span>
                      </span>
                      <span className="text-[10px] bg-coral text-white group-hover:bg-white group-hover:text-coral rounded-md px-1.5 py-0.5 font-black uppercase">
                        Add
                      </span>
                    </button>
                    {formattedSearchCandidate && (
                      <p className="mt-1 text-[11px] font-semibold text-slate-500 dark:text-slate-400 pl-1">
                        Will be added as: <span className="font-bold text-coral">{formattedSearchCandidate}</span>
                      </p>
                    )}
                  </div>
                )
              )}
            </div>
          )}

          {/* Area Options List */}
          <div
            onWheel={(e) => e.stopPropagation()}
            className="overflow-y-auto overscroll-contain p-1.5 max-h-56 space-y-0.5"
          >
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
