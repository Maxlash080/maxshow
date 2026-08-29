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

  // Parse current value (YYYY-MM-DD) or default to today
  const selectedDate = value ? new Date(value + 'T00:00:00') : null;

  const [viewYear, setViewYear] = useState(selectedDate ? selectedDate.getFullYear() : today.getFullYear());
  const [viewMonth, setViewMonth] = useState(selectedDate ? selectedDate.getMonth() : today.getMonth());

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
        setViewYear(d.getFullYear());
        setViewMonth(d.getMonth());
      }
    }
  }, [value]);

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const handlePrevMonth = (e) => {
    e.stopPropagation();
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear(viewYear - 1);
    } else {
      setViewMonth(viewMonth - 1);
    }
  };

  const handleNextMonth = (e) => {
    e.stopPropagation();
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

    // Prevent selecting any past dates before today
    if (cellDate < today) return;

    const formatted = formatDateToString(viewYear, viewMonth, day);
    onChange(formatted);
    // Keep popover open so user can see selection and confirm with "Done"
  };

  const handleQuickSelect = (daysOffset) => {
    const target = new Date();
    target.setHours(0, 0, 0, 0);
    target.setDate(target.getDate() + daysOffset);
    const formatted = formatDateToString(target.getFullYear(), target.getMonth(), target.getDate());
    onChange(formatted);
    setViewYear(target.getFullYear());
    setViewMonth(target.getMonth());
    // Keep popover open so user can see selection and confirm with "Done"
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
    <div className={`relative ${isOpen ? 'z-30' : 'z-10'} ${className}`} ref={containerRef}>
      {/* Trigger Input Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between rounded-xl border border-stone-300 bg-white px-3.5 py-2.5 text-left text-xs sm:text-sm font-semibold outline-none transition hover:border-coral focus:border-coral dark:border-slate-700 dark:bg-[#101820] dark:text-white shadow-sm"
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
          className="absolute left-0 top-full mt-2 w-72 sm:w-80 rounded-2xl border border-stone-200 bg-white p-4 shadow-2xl dark:border-slate-700 dark:bg-[#1c2733] animate-in fade-in zoom-in-95 duration-150 select-none overscroll-contain"
        >
          {/* Month & Year Navigation Header */}
          <div className="flex items-center justify-between mb-3">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="grid h-8 w-8 place-items-center rounded-xl bg-stone-100 dark:bg-slate-800 text-slate-600 dark:text-slate-200 hover:bg-coral hover:text-white dark:hover:bg-coral transition"
              title="Previous Month"
            >
              ‹
            </button>
            <span className="font-black text-sm text-ink dark:text-white">
              {monthNames[viewMonth]} {viewYear}
            </span>
            <button
              type="button"
              onClick={handleNextMonth}
              className="grid h-8 w-8 place-items-center rounded-xl bg-stone-100 dark:bg-slate-800 text-slate-600 dark:text-slate-200 hover:bg-coral hover:text-white dark:hover:bg-coral transition"
              title="Next Month"
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

              const isSelected =
                selectedDate &&
                selectedDate.getFullYear() === viewYear &&
                selectedDate.getMonth() === viewMonth &&
                selectedDate.getDate() === dayNum;

              const isToday =
                today.getFullYear() === viewYear &&
                today.getMonth() === viewMonth &&
                today.getDate() === dayNum;

              if (isPast) {
                return (
                  <button
                    key={`day-${dayNum}`}
                    type="button"
                    disabled
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
            <button
              type="button"
              onClick={() => handleQuickSelect(0)}
              className="flex-1 py-1.5 rounded-lg bg-stone-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-coral hover:text-white transition text-center"
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => handleQuickSelect(1)}
              className="flex-1 py-1.5 rounded-lg bg-stone-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-coral hover:text-white transition text-center"
            >
              Tomorrow
            </button>
            <button
              type="button"
              onClick={() => handleQuickSelect(7)}
              className="flex-1 py-1.5 rounded-lg bg-stone-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-coral hover:text-white transition text-center"
            >
              +7 Days
            </button>
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
