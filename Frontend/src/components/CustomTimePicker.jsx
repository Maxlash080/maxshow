import React, { useState, useRef, useEffect } from 'react';

export const CustomTimePicker = ({
  value = '20:00',
  onChange,
  placeholder = 'Select event time',
  required = false,
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  // Parse initial 24h string into 12h representation
  const parseTime = (val) => {
    if (!val || !val.includes(':')) {
      return { hour12: 8, minute: 0, period: 'PM' };
    }
    const [hStr, mStr] = val.split(':');
    let h = parseInt(hStr, 10) || 0;
    const m = parseInt(mStr, 10) || 0;
    const period = h >= 12 ? 'PM' : 'AM';
    let hour12 = h % 12;
    if (hour12 === 0) hour12 = 12;
    return { hour12, minute: m, period };
  };

  const parsed = parseTime(value);
  const [hour12, setHour12] = useState(parsed.hour12);
  const [minute, setMinute] = useState(parsed.minute);
  const [period, setPeriod] = useState(parsed.period);

  useEffect(() => {
    const p = parseTime(value);
    setHour12(p.hour12);
    setMinute(p.minute);
    setPeriod(p.period);
  }, [value]);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const emitTime = (h12, m, p) => {
    let h24 = h12 % 12;
    if (p === 'PM') h24 += 12;
    const formatted = `${String(h24).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    onChange(formatted);
  };

  const handleHourChange = (newH) => {
    setHour12(newH);
    emitTime(newH, minute, period);
  };

  const handleMinuteChange = (newM) => {
    setMinute(newM);
    emitTime(hour12, newM, period);
  };

  const handlePeriodChange = (newP) => {
    setPeriod(newP);
    emitTime(hour12, minute, newP);
  };

  const handlePresetSelect = (h24, m) => {
    const p = h24 >= 12 ? 'PM' : 'AM';
    let h12 = h24 % 12;
    if (h12 === 0) h12 = 12;
    setHour12(h12);
    setMinute(m);
    setPeriod(p);
    emitTime(h12, m, p);
  };

  // Formatted display string e.g. "08:00 PM"
  const displayString = value
    ? `${String(hour12).padStart(2, '0')}:${String(minute).padStart(2, '0')} ${period}`
    : '';

  const quickPresets = [
    { time: '06:00 AM', tag: 'Morning', h: 6, m: 0 },
    { time: '11:00 AM', tag: 'Brunch', h: 11, m: 0 },
    { time: '05:00 PM', tag: 'Sunset', h: 17, m: 0 },
    { time: '07:30 PM', tag: 'Show', h: 19, m: 30 },
    { time: '08:00 PM', tag: 'Prime', h: 20, m: 0 },
    { time: '09:30 PM', tag: 'Night', h: 21, m: 30 },
  ];

  return (
    <div className={`relative ${isOpen ? 'z-30' : 'z-10'} ${className}`} ref={containerRef}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between rounded-xl border border-stone-300 dark:border-slate-600/80 bg-white dark:bg-[#0d141e] px-3.5 py-2.5 text-left text-xs sm:text-sm font-semibold outline-none transition hover:border-slate-400 dark:hover:border-slate-400 focus:border-coral dark:text-white shadow-inner"
        aria-haspopup="dialog"
        aria-expanded={isOpen}
      >
        <span className={displayString ? 'font-bold text-ink dark:text-white font-mono' : 'text-slate-400'}>
          {displayString || placeholder}
        </span>
        <div className="flex items-center gap-1.5 text-coral">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-coral/10 dark:bg-coral/20 text-coral text-sm transition-transform group-hover:scale-110 shadow-xs">
            🕒
          </span>
        </div>
      </button>

      {/* Hidden input */}
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

      {/* Dropdown Popover (Positioned Right-0 so it never overflows modal container) */}
      {isOpen && (
        <div
          onWheel={(e) => e.stopPropagation()}
          data-dropdown-popover
          className="absolute right-0 left-auto top-full mt-2 w-72 sm:w-80 rounded-2xl border border-stone-200 bg-white p-4 shadow-2xl dark:border-white/10 dark:bg-[#182330] z-[100] animate-in fade-in zoom-in-95 duration-150 select-none overscroll-contain"
        >
          {/* Time Picker Header */}
          <div className="flex items-center justify-between mb-3 px-1">
            <span className="font-black text-xs uppercase tracking-wider text-slate-400">
              Select Time
            </span>
            <span className="font-mono font-black text-sm text-coral">
              {displayString}
            </span>
          </div>

          {/* Interactive Selectors Card */}
          <div className="flex items-center justify-center gap-2.5 bg-stone-50 dark:bg-[#151f2b] p-3 rounded-2xl border border-stone-100 dark:border-slate-800">
            {/* Hour Selector */}
            <div className="flex flex-col items-center">
              <span className="text-[10px] font-bold text-slate-400 mb-1">Hour</span>
              <select
                value={hour12}
                onChange={(e) => handleHourChange(parseInt(e.target.value, 10))}
                className="rounded-xl border border-stone-200 dark:border-slate-700 bg-white dark:bg-[#1c2733] px-2.5 py-1.5 font-mono font-black text-sm text-ink dark:text-white outline-none focus:border-coral cursor-pointer shadow-xs"
              >
                {Array.from({ length: 12 }, (_, i) => i + 1).map((h) => (
                  <option key={h} value={h}>
                    {String(h).padStart(2, '0')}
                  </option>
                ))}
              </select>
            </div>

            <span className="font-mono text-lg font-black text-coral mt-4">:</span>

            {/* Minute Selector */}
            <div className="flex flex-col items-center">
              <span className="text-[10px] font-bold text-slate-400 mb-1">Min</span>
              <select
                value={minute}
                onChange={(e) => handleMinuteChange(parseInt(e.target.value, 10))}
                className="rounded-xl border border-stone-200 dark:border-slate-700 bg-white dark:bg-[#1c2733] px-2.5 py-1.5 font-mono font-black text-sm text-ink dark:text-white outline-none focus:border-coral cursor-pointer shadow-xs"
              >
                {[0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55].map((m) => (
                  <option key={m} value={m}>
                    {String(m).padStart(2, '0')}
                  </option>
                ))}
              </select>
            </div>

            {/* AM / PM Toggle */}
            <div className="flex flex-col items-center">
              <span className="text-[10px] font-bold text-slate-400 mb-1">Period</span>
              <div className="flex rounded-xl bg-stone-200/80 dark:bg-slate-800 p-0.5 font-bold text-xs">
                <button
                  type="button"
                  onClick={() => handlePeriodChange('AM')}
                  className={`px-2.5 py-1.5 rounded-lg transition ${
                    period === 'AM'
                      ? 'bg-coral text-white font-black shadow-xs'
                      : 'text-slate-600 dark:text-slate-300 hover:text-ink'
                  }`}
                >
                  AM
                </button>
                <button
                  type="button"
                  onClick={() => handlePeriodChange('PM')}
                  className={`px-2.5 py-1.5 rounded-lg transition ${
                    period === 'PM'
                      ? 'bg-coral text-white font-black shadow-xs'
                      : 'text-slate-600 dark:text-slate-300 hover:text-ink'
                  }`}
                >
                  PM
                </button>
              </div>
            </div>
          </div>

          {/* Quick Popular Presets */}
          <div className="mt-3.5 pt-3 border-t border-stone-100 dark:border-slate-800">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-1 mb-2">
              Popular Event Times
            </p>
            <div className="grid grid-cols-3 gap-2">
              {quickPresets.map((preset, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handlePresetSelect(preset.h, preset.m);
                  }}
                  className="group/slot relative flex flex-col items-center justify-center py-2 px-1.5 rounded-xl text-[11px] font-bold transition-all duration-150 cursor-pointer select-none border border-stone-200/80 bg-stone-50 text-slate-700 hover:bg-coral hover:text-white hover:border-coral hover:shadow-lg hover:shadow-coral/30 hover:scale-105 dark:border-slate-700 dark:bg-[#151f2b] dark:text-slate-200 dark:hover:bg-coral dark:hover:text-white dark:hover:border-coral active:scale-95 shadow-2xs"
                >
                  <span className="font-mono text-xs">{preset.time}</span>
                  <span className="text-[9px] mt-0.5 text-slate-400 group-hover/slot:text-white/90 font-medium transition-colors">
                    {preset.tag}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Done Button */}
          <div className="mt-3">
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="w-full py-2 rounded-xl bg-coral text-white text-xs font-bold shadow-md hover:bg-[#df503c] transition active:scale-98"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
