import React from 'react';

export const CATEGORIES = [
  { id: 'music', name: 'Music', icon: '🎵' },
  { id: 'nightlife', name: 'Nightlife', icon: '🍸' },
  { id: 'comedy', name: 'Comedy', icon: '🎭' },
  { id: 'move', name: 'Sports & Move', icon: '🏃' },
  { id: 'performances', name: 'Performances', icon: '🎪' },
  { id: 'food', name: 'Food & Drinks', icon: '🍜' },
  { id: 'fests', name: 'Fests & Fairs', icon: '🎡' },
  { id: 'social', name: 'Social Mixers', icon: '✨' },
  { id: 'outdoors', name: 'Outdoors', icon: '🏕️' },
  { id: 'workshops', name: 'Workshops', icon: '🎨' },
  { id: 'screenings', name: 'Screenings', icon: '🎬' },
  { id: 'pets', name: 'Pets', icon: '🐾' },
];

export const Categories = ({
  selectedCategory = null,
  onSelectCategory,
  onClearCategory,
  title = 'Explore Categories',
  categories = CATEGORIES,
}) => {
  const handleToggle = (catId) => {
    if (onSelectCategory) {
      onSelectCategory(selectedCategory === catId ? null : catId);
    }
  };

  const handleClear = () => {
    if (onClearCategory) {
      onClearCategory();
    } else if (onSelectCategory) {
      onSelectCategory(null);
    }
  };

  return (
    <section id="categories" aria-label="Explore Categories" className="scroll-mt-20 sm:scroll-mt-24 space-y-3.5">
      {/* Section Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl sm:text-2xl font-black text-ink dark:text-white flex items-center gap-2">
          <span>{title}</span>
        </h2>
        {selectedCategory && (
          <button
            onClick={handleClear}
            className="text-xs font-bold text-coral hover:underline cursor-pointer flex items-center gap-1 animate-in fade-in zoom-in-95 duration-150"
            type="button"
          >
            <span>✕ Clear filter</span>
          </button>
        )}
      </div>

      {/* 2-Row x 6-Column Category Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2.5 sm:gap-3">
        {categories.map((cat) => {
          const isSelected = selectedCategory === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => handleToggle(cat.id)}
              type="button"
              className={`group relative overflow-hidden flex items-center justify-center gap-2 px-3.5 py-2.5 sm:py-3 rounded-2xl font-bold text-xs sm:text-sm transition-all duration-200 cursor-pointer border select-none ${
                isSelected
                  ? 'border-coral bg-coral text-white shadow-lg shadow-coral/30 font-black -translate-y-0.5 scale-[1.02] ring-2 ring-coral/40 ring-offset-2 dark:ring-offset-[#101820]'
                  : 'border-stone-200/90 dark:border-white/10 bg-white dark:bg-[#182330] text-slate-800 dark:text-slate-200 hover:border-coral/60 hover:bg-stone-50 dark:hover:bg-[#202e3f] hover:-translate-y-1 hover:shadow-md hover:shadow-coral/10 active:scale-95'
              }`}
            >
              {/* Subtle sheen shimmer sweep on hover */}
              <span className="pointer-events-none absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 bg-gradient-to-r from-transparent via-white/15 to-transparent" />

              {/* Animated Emoji */}
              <span className="text-base sm:text-lg shrink-0 transition-transform duration-300 group-hover:scale-125 group-hover:rotate-12">
                {cat.icon}
              </span>
              <span className="truncate">{cat.name}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
};

export default Categories;
