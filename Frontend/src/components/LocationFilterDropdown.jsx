import React, { useState, useRef, useEffect, useMemo } from 'react';
import { parseLocationStateAndCity } from '../utils/constants';

const getStateIcon = (state) => {
  const s = (state || '').toLowerCase();
  if (s.includes('maharashtra')) return '🏛️';
  if (s.includes('goa')) return '🌴';
  if (s.includes('karnataka')) return '🌆';
  if (s.includes('delhi')) return '🕌';
  if (s.includes('gujarat')) return '🌅';
  if (s.includes('kerala')) return '⛵';
  if (s.includes('rajasthan')) return '🏰';
  if (s.includes('tamil nadu')) return '🛕';
  if (s.includes('telangana')) return '💎';
  if (s.includes('west bengal')) return '🎨';
  if (s.includes('chandigarh') || s.includes('punjab')) return '🌾';
  if (s.includes('meghalaya') || s.includes('assam')) return '⛰️';
  return '📍';
};

export const LocationFilterDropdown = ({
  value,
  onChange,
  locations = [],
  events = [],
  className = '',
  includeAll = true,
  allLabel = 'All Locations',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState('grouped'); // 'grouped' | 'list'
  const [expandedState, setExpandedState] = useState(null);
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

  // Compute Structured Hierarchy: State -> Cities (with counts if events provided)
  const { stateGroups, allCitiesList, totalCount } = useMemo(() => {
    const stateMap = new Map();
    const cityList = [];
    let count = 0;

    // Use events if available for exact counts, otherwise parse from locations list
    if (events && events.length > 0) {
      count = events.length;
      events.forEach((ev) => {
        const locParsed = parseLocationStateAndCity(ev.location || '');
        const st = (ev.state || locParsed.state || 'Maharashtra').trim();
        const ct = (ev.city || locParsed.city || 'Pune').trim();

        if (!stateMap.has(st)) {
          stateMap.set(st, { state: st, totalEvents: 0, cities: new Map() });
        }
        const stObj = stateMap.get(st);
        stObj.totalEvents += 1;
        stObj.cities.set(ct, (stObj.cities.get(ct) || 0) + 1);
      });
    } else {
      (locations || []).forEach((l) => {
        if (!l || l === 'all' || l === 'All' || l === 'All Cities') return;
        count++;
        const { state: st, city: ct } = parseLocationStateAndCity(String(l));
        const cleanState = st || 'Maharashtra';
        const cleanCity = ct || 'Pune';

        if (!stateMap.has(cleanState)) {
          stateMap.set(cleanState, { state: cleanState, totalEvents: 0, cities: new Map() });
        }
        const stObj = stateMap.get(cleanState);
        stObj.totalEvents += 1;
        stObj.cities.set(cleanCity, (stObj.cities.get(cleanCity) || 0) + 1);
      });
    }

    const groups = Array.from(stateMap.values())
      .map((stObj) => ({
        state: stObj.state,
        totalEvents: stObj.totalEvents,
        cities: Array.from(stObj.cities.entries()).map(([cityName, cityCount]) => ({
          name: cityName,
          count: cityCount,
          formatted: `${stObj.state}, ${cityName}`,
        })).sort((a, b) => a.name.localeCompare(b.name)),
      }))
      .sort((a, b) => a.state.localeCompare(b.state));

    groups.forEach((g) => {
      g.cities.forEach((c) => {
        cityList.push({
          state: g.state,
          city: c.name,
          count: c.count,
          formatted: c.formatted,
        });
      });
    });

    cityList.sort((a, b) => a.formatted.localeCompare(b.formatted));

    return { stateGroups: groups, allCitiesList: cityList, totalCount: count };
  }, [locations, events]);

  // Filtered by live search query
  const searchResults = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return null;

    const matchedStates = [];
    const matchedCities = [];

    stateGroups.forEach((g) => {
      const stateMatches = g.state.toLowerCase().includes(q);
      const matchingCities = g.cities.filter(
        (c) => c.name.toLowerCase().includes(q) || c.formatted.toLowerCase().includes(q)
      );

      if (stateMatches) {
        matchedStates.push(g);
      } else if (matchingCities.length > 0) {
        matchedCities.push({
          ...g,
          cities: matchingCities,
        });
      }
    });

    return { matchedStates, matchedCities };
  }, [stateGroups, search]);

  const handleSelect = (locVal) => {
    onChange(locVal);
    setIsOpen(false);
    setSearch('');
  };

  // Determine current active display label
  const displayLabel = useMemo(() => {
    if (!value || value === 'all' || value === 'All' || value === 'All Cities') {
      return allLabel;
    }
    const { state, city } = parseLocationStateAndCity(value);
    if (state && city) {
      return `${state}, ${city}`;
    }
    return value;
  }, [value, allLabel]);

  const isAllActive = !value || value === 'all' || value === 'All' || value === 'All Cities';

  return (
    <div className={`relative ${isOpen ? 'z-50' : 'z-10'} ${className}`} ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => {
          setIsOpen((prev) => !prev);
          setSearch('');
        }}
        className={`flex w-full min-w-[180px] items-center justify-between gap-2 rounded-2xl border px-3.5 py-2.5 text-left text-xs sm:text-sm font-bold outline-none transition-all shadow-xs cursor-pointer ${
          isOpen
            ? 'border-coral ring-2 ring-coral/20 bg-white dark:bg-[#1c2733]'
            : 'border-stone-300 dark:border-slate-700 bg-white dark:bg-[#1c2733] hover:border-coral text-slate-800 dark:text-slate-100'
        }`}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <div className="flex items-center gap-2 truncate min-w-0">
          <span className="text-base shrink-0">
            {isAllActive ? '📍' : getStateIcon(parseLocationStateAndCity(value).state)}
          </span>
          <span className="truncate font-extrabold text-ink dark:text-white">
            {displayLabel}
          </span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {!isAllActive && (
            <span className="rounded-full bg-coral/15 dark:bg-coral/25 px-2 py-0.5 text-[10px] font-black text-coral">
              Active
            </span>
          )}
          <svg
            className={`h-4 w-4 text-slate-400 transition-transform duration-200 ${
              isOpen ? 'rotate-180 text-coral' : ''
            }`}
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="m19 9-7 7-7-7" />
          </svg>
        </div>
      </button>

      {/* Dropdown Popover */}
      {isOpen && (
        <div
          onWheel={(e) => e.stopPropagation()}
          data-dropdown-popover
          className="absolute left-0 top-full mt-2 z-50 w-[320px] sm:w-[380px] overflow-hidden rounded-3xl border border-stone-300 bg-white p-3.5 shadow-2xl dark:border-slate-700 dark:bg-[#1c2733] animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[480px]"
        >
          {/* Header & Tabs */}
          <div className="space-y-2.5 pb-2.5 border-b border-stone-200 dark:border-slate-700">
            {/* Search Input */}
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">🔍</span>
              <input
                ref={searchInputRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search state or city..."
                className="w-full rounded-xl border border-stone-300 dark:border-slate-600 bg-stone-100 dark:bg-[#101820] pl-8 pr-7 py-2 text-xs font-bold text-ink dark:text-white outline-none focus:border-coral focus:ring-2 focus:ring-coral/20 placeholder:text-slate-400"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer"
                >
                  ✕
                </button>
              )}
            </div>

            {/* View Mode Tabs (when not searching) */}
            {!search && (
              <div className="flex items-center gap-1 rounded-xl bg-stone-100 dark:bg-[#101820] p-1 text-[11px] font-bold border border-stone-200/60 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setActiveTab('grouped')}
                  className={`flex-1 rounded-lg py-1.5 transition cursor-pointer text-center ${
                    activeTab === 'grouped'
                      ? 'bg-white dark:bg-[#253342] text-coral shadow-xs font-black'
                      : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'
                  }`}
                >
                  🏛️ By State ({stateGroups.length})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('list')}
                  className={`flex-1 rounded-lg py-1.5 transition cursor-pointer text-center ${
                    activeTab === 'list'
                      ? 'bg-white dark:bg-[#253342] text-coral shadow-xs font-black'
                      : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'
                  }`}
                >
                  🏙️ All Cities ({allCitiesList.length})
                </button>
              </div>
            )}
          </div>

          {/* List Area */}
          <div className="overflow-y-auto overscroll-contain flex-1 py-2.5 space-y-2 no-scrollbar pr-0.5 max-h-[340px]">
            {/* Master Option: All Locations */}
            {includeAll && !search && (
              <button
                type="button"
                onClick={() => handleSelect('all')}
                className={`flex w-full items-center justify-between rounded-2xl px-4 py-3 text-left text-xs font-bold transition-all cursor-pointer ${
                  isAllActive
                    ? 'bg-coral text-white shadow-md shadow-coral/30'
                    : 'bg-stone-100 hover:bg-coral/10 hover:text-coral text-slate-800 dark:bg-[#253342] dark:text-slate-100 dark:hover:bg-white/15'
                }`}
              >
                <span className="flex items-center gap-2.5">
                  <span className="text-base">📍</span>
                  <span className="font-extrabold">{allLabel}</span>
                </span>
                <div className="flex items-center gap-2">
                  <span className={`text-[11px] font-black px-2 py-0.5 rounded-full ${
                    isAllActive ? 'bg-white/25 text-white' : 'bg-stone-200 dark:bg-[#1c2733] text-slate-600 dark:text-slate-300'
                  }`}>
                    {totalCount > 0 ? `${totalCount} events` : 'All'}
                  </span>
                  {isAllActive && <span className="text-sm font-black">✓</span>}
                </div>
              </button>
            )}

            {/* SEARCH RESULTS VIEW */}
            {search && searchResults && (
              <div className="space-y-2">
                {searchResults.matchedStates.length === 0 && searchResults.matchedCities.length === 0 ? (
                  <div className="py-8 text-center text-xs font-bold text-slate-400">
                    No locations matching "{search}"
                  </div>
                ) : (
                  <>
                    {searchResults.matchedStates.map((st) => (
                      <div key={st.state} className="rounded-2xl border border-stone-200 dark:border-slate-700 p-2.5 bg-stone-50 dark:bg-[#253342]">
                        <div className="flex items-center justify-between px-1 py-1">
                          <span className="font-black text-xs text-ink dark:text-white flex items-center gap-1.5">
                            <span>{getStateIcon(st.state)}</span>
                            <span>{st.state}</span>
                          </span>
                          <span className="text-[10px] font-semibold text-slate-400">
                            {st.totalEvents} {st.totalEvents === 1 ? 'event' : 'events'}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-1.5 mt-1.5">
                          {st.cities.map((ct) => (
                            <button
                              key={ct.formatted}
                              type="button"
                              onClick={() => handleSelect(ct.formatted)}
                              className="rounded-xl px-2.5 py-1.5 text-left text-xs font-bold bg-white dark:bg-[#1c2733] hover:bg-coral hover:text-white text-slate-800 dark:text-slate-100 transition flex items-center justify-between border border-stone-200 dark:border-slate-700 cursor-pointer"
                            >
                              <span className="truncate">{ct.name}</span>
                              <span className="text-[10px] opacity-70">({ct.count})</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}

                    {searchResults.matchedCities.map((st) => (
                      <div key={st.state} className="rounded-2xl border border-stone-200 dark:border-slate-700 p-2.5 bg-stone-50 dark:bg-[#253342]">
                        <p className="px-1 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          {getStateIcon(st.state)} {st.state}
                        </p>
                        <div className="grid grid-cols-2 gap-1.5 mt-1.5">
                          {st.cities.map((ct) => (
                            <button
                              key={ct.formatted}
                              type="button"
                              onClick={() => handleSelect(ct.formatted)}
                              className="rounded-xl px-2.5 py-1.5 text-left text-xs font-bold bg-white dark:bg-[#1c2733] hover:bg-coral hover:text-white text-slate-800 dark:text-slate-100 transition flex items-center justify-between border border-stone-200 dark:border-slate-700 cursor-pointer"
                            >
                              <span className="truncate">{ct.name}</span>
                              <span className="text-[10px] opacity-70">({ct.count})</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </>
                )}
              </div>
            )}

            {/* TAB 1: GROUPED BY STATE */}
            {!search && activeTab === 'grouped' && (
              <div className="space-y-2">
                {stateGroups.map((group) => {
                  const isExpanded = expandedState === group.state;

                  return (
                    <div
                      key={group.state}
                      className="overflow-hidden rounded-2xl border border-stone-200 dark:border-slate-700 bg-stone-50 dark:bg-[#253342] transition-colors"
                    >
                      {/* State Header Card */}
                      <button
                        type="button"
                        onClick={() => setExpandedState(isExpanded ? null : group.state)}
                        className="flex w-full items-center justify-between p-3 text-left cursor-pointer transition hover:bg-stone-100/80 dark:hover:bg-white/5"
                      >
                        <div className="flex items-center gap-2.5 truncate flex-1 min-w-0">
                          <span className="text-xl shrink-0">{getStateIcon(group.state)}</span>
                          <div className="truncate">
                            <p className="text-xs font-black text-ink dark:text-white truncate">
                              {group.state}
                            </p>
                            <p className="text-[10px] font-semibold text-slate-400">
                              {group.cities.length} {group.cities.length === 1 ? 'City' : 'Cities'} · {group.totalEvents} {group.totalEvents === 1 ? 'Event' : 'Events'}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <span className="rounded-full bg-stone-200 dark:bg-white/10 px-2 py-0.5 text-[10px] font-bold text-slate-600 dark:text-slate-300">
                            {group.cities.length} {group.cities.length === 1 ? 'city' : 'cities'}
                          </span>
                          <svg
                            className={`h-4 w-4 text-slate-400 transition-transform duration-200 ${
                              isExpanded ? 'rotate-180 text-coral' : ''
                            }`}
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.5"
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" d="m19 9-7 7-7-7" />
                          </svg>
                        </div>
                      </button>

                      {/* Cities Sub-Grid */}
                      {isExpanded && (
                        <div className="p-2.5 pt-2 border-t border-stone-200 dark:border-slate-700 bg-stone-100 dark:bg-[#16202c]">
                          <div className="grid grid-cols-2 gap-1.5">
                            {group.cities.map((city) => {
                              const isCitySelected = (value || '').toLowerCase() === city.formatted.toLowerCase();
                              return (
                                <button
                                  key={city.formatted}
                                  type="button"
                                  onClick={() => handleSelect(city.formatted)}
                                  className={`flex items-center justify-between rounded-xl px-2.5 py-2 text-left text-xs font-bold transition-all cursor-pointer border ${
                                    isCitySelected
                                      ? 'bg-coral text-white border-coral shadow-xs font-black'
                                      : 'bg-white dark:bg-[#253342] hover:border-coral hover:text-coral text-slate-800 dark:text-slate-100 border-stone-200 dark:border-slate-700'
                                  }`}
                                >
                                  <span className="truncate">{city.name}</span>
                                  <span className={`text-[10px] ml-1 shrink-0 ${isCitySelected ? 'text-white/90' : 'text-slate-400'}`}>
                                    ({city.count})
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* TAB 2: ALL CITIES (ALPHABETICAL) */}
            {!search && activeTab === 'list' && (
              <div className="space-y-1.5">
                {allCitiesList.map((item) => {
                  const isCitySelected = (value || '').toLowerCase() === item.formatted.toLowerCase();
                  return (
                    <button
                      key={item.formatted}
                      type="button"
                      onClick={() => handleSelect(item.formatted)}
                      className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-xs font-bold transition-all cursor-pointer border ${
                        isCitySelected
                          ? 'bg-coral text-white border-coral font-black shadow-xs'
                          : 'bg-stone-50 dark:bg-[#253342] hover:border-coral/50 hover:text-coral text-slate-800 dark:text-slate-100 border-stone-200/80 dark:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <span className="text-sm shrink-0">{getStateIcon(item.state)}</span>
                        <span className="truncate">
                          <span className="font-black">{item.state}</span>, {item.city}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0 ml-2">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-semibold ${
                          isCitySelected ? 'bg-white/20 text-white' : 'bg-stone-200 dark:bg-[#1c2733] text-slate-600 dark:text-slate-300'
                        }`}>
                          {item.count} {item.count === 1 ? 'ev' : 'evs'}
                        </span>
                        {isCitySelected && <span className="text-xs font-black">✓</span>}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

