import React, { useState, useRef, useEffect } from 'react';

export const CustomDatePicker = ({
  value,
  onChange,
  placeholder = 'Select event date',
  required = false,
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  // Normalize today at start of day (00:00:00)
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Maximum allowed date: exactly 1 year from today (23:59:59)
  const maxDate = new Date(today);
  maxDate.setFullYear(today.getFullYear() + 1);
  maxDate.setHours(23, 59, 59, 999);

  // Parse current value (YYYY-MM-DD) or default to today
  const selectedDate = value ? new Date(value + 'T00:00:00') : null;

  const getInitialYear = () => {
    if (selectedDate && !isNaN(selectedDate.getTime())) {
      if (selectedDate > maxDate) return maxDate.getFullYear();
      if (selectedDate < today) return today.getFullYear();
      return selectedDate.getFullYear();
    }
    return today.getFullYear();
  };

  const getInitialMonth = () => {
    if (selectedDate && !isNaN(selectedDate.getTime())) {
      if (selectedDate > maxDate) return maxDate.getMonth();
      if (selectedDate < today) return today.getMonth();
      return selectedDate.getMonth();
    }
    return today.getMonth();
  };

  const [viewYear, setViewYear] = useState(getInitialYear);
  const [viewMonth, setViewMonth] = useState(getInitialMonth);

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Update view when value changes from outside
  useEffect(() => {
    if (value) {
      const d = new Date(value + 'T00:00:00');
      if (!isNaN(d.getTime())) {
        if (d > maxDate) {
          setViewYear(maxDate.getFullYear());
          setViewMonth(maxDate.getMonth());
        } else if (d < today) {
          setViewYear(today.getFullYear());
          setViewMonth(today.getMonth());
        } else {
          setViewYear(d.getFullYear());
          setViewMonth(d.getMonth());
        }
      }
    }
  }, [value]);

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const canGoPrev = viewYear > today.getFullYear() || (viewYear === today.getFullYear() && viewMonth > today.getMonth());
  const canGoNext = viewYear < maxDate.getFullYear() || (viewYear === maxDate.getFullYear() && viewMonth < maxDate.getMonth());

  const handlePrevMonth = (e) => {
    e.stopPropagation();
    if (!canGoPrev) return;
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear(viewYear - 1);
    } else {
      setViewMonth(viewMonth - 1);
    }
  };

  const handleNextMonth = (e) => {
    e.stopPropagation();
    if (!canGoNext) return;
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear(viewYear + 1);
    } else {
      setViewMonth(viewMonth + 1);
    }
  };

  const formatDateToString = (year, month, day) => {
    const m = String(month + 1).padStart(2, '0');
    const d = String(day).padStart(2, '0');
    return `${year}-${m}-${d}`;
  };

  const handleSelectDay = (day) => {
    const cellDate = new Date(viewYear, viewMonth, day);
    cellDate.setHours(0, 0, 0, 0);

    // Prevent selecting any past dates or dates beyond 1 year
    if (cellDate < today || cellDate > maxDate) return;

    const formatted = formatDateToString(viewYear, viewMonth, day);
    onChange(formatted);
  };

  const handleQuickSelect = (daysOffset) => {
    const target = new Date();
    target.setHours(0, 0, 0, 0);
    target.setDate(target.getDate() + daysOffset);
    if (target > maxDate) return;
    const formatted = formatDateToString(target.getFullYear(), target.getMonth(), target.getDate());
    onChange(formatted);
    setViewYear(target.getFullYear());
    setViewMonth(target.getMonth());
  };

  const handleDone = () => {
    if (!value) {
      // Default to today if no date was chosen
      const formatted = formatDateToString(today.getFullYear(), today.getMonth(), today.getDate());
      onChange(formatted);
    }
    setIsOpen(false);
  };

  // Build calendar matrix for current viewMonth
  const firstDayOfMonth = new Date(viewYear, viewMonth, 1).getDay(); // 0 is Sunday
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const adjustedFirstDay = (firstDayOfMonth + 6) % 7; // Make Monday = 0

  // Format readable trigger text
  const displayString = selectedDate && !isNaN(selectedDate.getTime())
    ? selectedDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    : '';

  return (
    <div className={`relative ${isOpen ? 'z-50' : 'z-10'} ${className}`} ref={containerRef}>
      {/* Trigger Input Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between rounded-xl border border-stone-300 dark:border-slate-600/80 bg-white dark:bg-[#0d141e] px-3.5 py-2.5 text-left text-xs sm:text-sm font-semibold outline-none transition hover:border-slate-400 dark:hover:border-slate-400 focus:border-coral dark:text-white shadow-inner"
        aria-haspopup="dialog"
        aria-expanded={isOpen}
      >
        <span className={displayString ? 'font-bold text-ink dark:text-white' : 'text-slate-400'}>
          {displayString || placeholder}
        </span>
        <div className="flex items-center gap-1.5 text-coral">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-coral/10 dark:bg-coral/20 text-coral text-sm transition-transform group-hover:scale-110 shadow-xs">
            📅
          </span>
        </div>
      </button>

      {/* Hidden input for form requirements */}
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

      {/* Dropdown Calendar Popover */}
      {isOpen && (
        <div
          onWheel={(e) => e.stopPropagation()}
          data-dropdown-popover
          className="absolute left-0 top-full mt-2 w-72 sm:w-80 rounded-2xl border border-stone-200 bg-white p-4 shadow-2xl dark:border-white/10 dark:bg-[#182330] z-[100] animate-in fade-in zoom-in-95 duration-150 select-none overscroll-contain"
        >
          {/* Month & Year Navigation Header */}
          <div className="flex items-center justify-between mb-3">
            <button
              type="button"
              onClick={handlePrevMonth}
              disabled={!canGoPrev}
              className={`grid h-8 w-8 place-items-center rounded-xl transition ${
                canGoPrev
                  ? 'bg-stone-100 dark:bg-slate-800 text-slate-600 dark:text-slate-200 hover:bg-coral hover:text-white dark:hover:bg-coral cursor-pointer'
                  : 'bg-stone-50 dark:bg-slate-900 text-stone-300 dark:text-slate-700 opacity-40 cursor-not-allowed pointer-events-none'
              }`}
              title={canGoPrev ? 'Previous Month' : 'Cannot select past months'}
            >
              ‹
            </button>
            <span className="font-black text-sm text-ink dark:text-white">
              {monthNames[viewMonth]} {viewYear}
            </span>
            <button
              type="button"
              onClick={handleNextMonth}
              disabled={!canGoNext}
              className={`grid h-8 w-8 place-items-center rounded-xl transition ${
                canGoNext
                  ? 'bg-stone-100 dark:bg-slate-800 text-slate-600 dark:text-slate-200 hover:bg-coral hover:text-white dark:hover:bg-coral cursor-pointer'
                  : 'bg-stone-50 dark:bg-slate-900 text-stone-300 dark:text-slate-700 opacity-40 cursor-not-allowed pointer-events-none'
              }`}
              title={canGoNext ? 'Next Month' : 'Limit: 1 year from today'}
            >
              ›
            </button>
          </div>

          {/* Weekday Labels */}
          <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-bold text-slate-400 mb-1">
            <span>Mo</span>
            <span>Tu</span>
            <span>We</span>
            <span>Th</span>
            <span>Fr</span>
            <span>Sa</span>
            <span>Su</span>
          </div>

          {/* Days Grid */}
          <div className="grid grid-cols-7 gap-1">
            {/* Blank padding days */}
            {Array.from({ length: adjustedFirstDay }).map((_, i) => (
              <div key={`blank-${i}`} className="h-8 w-8" />
            ))}

            {/* Days of Month */}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const dayNum = i + 1;
              const cellDate = new Date(viewYear, viewMonth, dayNum);
              cellDate.setHours(0, 0, 0, 0);

              const isPast = cellDate < today;
              const isFutureLimit = cellDate > maxDate;
              const isDisabled = isPast || isFutureLimit;

              const isSelected =
                selectedDate &&
                selectedDate.getFullYear() === viewYear &&
                selectedDate.getMonth() === viewMonth &&
                selectedDate.getDate() === dayNum;

              const isToday =
                today.getFullYear() === viewYear &&
                today.getMonth() === viewMonth &&
                today.getDate() === dayNum;

              if (isDisabled) {
                return (
                  <button
                    key={`day-${dayNum}`}
                    type="button"
                    disabled
                    title={isPast ? 'Past dates not allowed' : 'Max 1 year from today'}
                    className="grid h-8 w-8 place-items-center rounded-xl text-xs font-semibold text-stone-300 dark:text-slate-600 cursor-not-allowed opacity-35 select-none pointer-events-none"
                  >
                    {dayNum}
                  </button>
                );
              }

              return (
                <button
                  key={`day-${dayNum}`}
                  type="button"
                  onClick={() => handleSelectDay(dayNum)}
                  className={`grid h-8 w-8 place-items-center rounded-xl text-xs font-bold transition ${
                    isSelected
                      ? 'bg-coral text-white font-black shadow-md shadow-coral/30 scale-105'
                      : isToday
                      ? 'border-2 border-coral text-coral hover:bg-coral/10 font-black'
                      : 'text-slate-700 hover:bg-coral/10 hover:text-coral dark:text-slate-200 dark:hover:bg-slate-800'
                  }`}
                >
                  {dayNum}
                </button>
              );
            })}
          </div>

          {/* Quick Presets */}
          <div className="mt-3.5 pt-3 border-t border-stone-100 dark:border-slate-800 flex items-center justify-between gap-1.5 text-[11px] font-bold">
            {[
              { label: 'Today', offset: 0 },
              { label: 'Tomorrow', offset: 1 },
              { label: '+7 Days', offset: 7 },
            ].map((p) => {
              const target = new Date();
              target.setHours(0, 0, 0, 0);
              target.setDate(target.getDate() + p.offset);
              const targetStr = formatDateToString(target.getFullYear(), target.getMonth(), target.getDate());
              const isPresetSelected = value === targetStr;

              return (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => handleQuickSelect(p.offset)}
                  className={`flex-1 py-1.5 rounded-xl transition text-center text-[11px] font-bold cursor-pointer ${
                    isPresetSelected
                      ? 'bg-coral text-white font-black shadow-md shadow-coral/30 border border-coral scale-[1.02]'
                      : 'bg-stone-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-coral hover:text-white hover:border-coral hover:shadow-md hover:shadow-coral/30 border border-stone-200/60 dark:border-slate-700 active:scale-95'
                  }`}
                >
                  {p.label}
                </button>
              );
            })}
          </div>

          {/* Done Button */}
          <div className="mt-3">
            <button
              type="button"
              onClick={handleDone}
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
