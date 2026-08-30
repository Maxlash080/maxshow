import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { HERO_TAGLINES } from '../utils/constants';
import { formatPrice, formatEventTime } from '../utils/formatters';

export const HeroShowcase = ({ events = [] }) => {
  const navigate = useNavigate();
  const [eventIndex, setEventIndex] = useState(() => (events.length > 0 ? Math.floor(Math.random() * events.length) : 0));
  const [taglineIndex, setTaglineIndex] = useState(() => Math.floor(Math.random() * HERO_TAGLINES.length));
  
  // Dual-layer crossfade state
  const [activeLayer, setActiveLayer] = useState(1); // 1 or 2
  const [imgSrc1, setImgSrc1] = useState(events[eventIndex]?.image || 'https://images.unsplash.com/photo-1527529482837-4698179dc6ce?auto=format&fit=crop&w=1000&q=85');
  const [imgSrc2, setImgSrc2] = useState('');
  const [isFadingText, setIsFadingText] = useState(false);

  const currentEvent = events[eventIndex] || events[0] || {};

  useEffect(() => {
    if (events.length > 0 && !imgSrc1) {
      setImgSrc1(events[0]?.image || '');
    }
  }, [events, imgSrc1]);

  useEffect(() => {
    if (!events.length) return;
    const interval = setInterval(() => {
      advanceSlide();
    }, 4800);
    return () => clearInterval(interval);
  }, [events, eventIndex, taglineIndex, activeLayer]);

  const advanceSlide = () => {
    if (!events.length) return;
    const nextEventIdx = (eventIndex + 1) % events.length;
    const nextTaglineIdx = (taglineIndex + 1) % HERO_TAGLINES.length;
    const nextEvent = events[nextEventIdx];

    setIsFadingText(true);

    if (activeLayer === 1) {
      setImgSrc2(nextEvent.image);
      setActiveLayer(2);
    } else {
      setImgSrc1(nextEvent.image);
      setActiveLayer(1);
    }

    setTimeout(() => {
      setEventIndex(nextEventIdx);
      setTaglineIndex(nextTaglineIdx);
      setIsFadingText(false);
    }, 220);
  };

  const handleHeroClick = () => {
    const slug = currentEvent.slug || currentEvent.id;
    if (slug) {
      navigate(`/event/${encodeURIComponent(slug)}`);
    }
  };

  const badgeText = currentEvent.day === 'today' ? 'TONIGHT' : (currentEvent.type || currentEvent.event_type || 'FEATURED').toUpperCase();
  const timeFormatted = formatEventTime(currentEvent.time || '', currentEvent.day);
  const locationText = currentEvent.location || (currentEvent.venue ? currentEvent.venue.split('·')[0].trim() : 'India');
  const priceText = formatPrice(currentEvent.price);

  return (
    <div
      onClick={handleHeroClick}
      className="group relative h-96 w-full cursor-pointer overflow-hidden rounded-[2.5rem] bg-stone-900 shadow-soft select-none"
      role="button"
      tabIndex={0}
      title="Click to view event details"
    >
      {/* Dual Layer Crossfading Images with smooth zoom and crossfade */}
      <img
        src={imgSrc1 || 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=1200&q=85'}
        alt="Featured experience"
        onError={(e) => {
          e.currentTarget.src = 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=1200&q=85';
        }}
        className={`absolute inset-0 h-full w-full object-cover transition-all duration-700 ease-out group-hover:scale-105 will-change-transform ${
          activeLayer === 1 ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      />
      <img
        src={imgSrc2 || 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=1200&q=85'}
        alt="Featured experience"
        onError={(e) => {
          e.currentTarget.src = 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=1200&q=85';
        }}
        className={`absolute inset-0 h-full w-full object-cover transition-all duration-700 ease-out group-hover:scale-105 will-change-transform ${
          activeLayer === 2 ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      />

      <div className="absolute inset-0 bg-gradient-to-t from-ink/90 via-ink/30 to-transparent"></div>

      {/* Hero Content Overlay */}
      <div
        className={`absolute bottom-0 left-0 right-0 p-6 sm:p-8 text-white transition-opacity duration-200 ${
          isFadingText ? 'opacity-0' : 'opacity-100'
        }`}
      >
        <p className="text-xs font-bold uppercase tracking-widest text-coral">
          {badgeText} {timeFormatted ? `· ${timeFormatted}` : ''}
        </p>
        <h2 className="mt-1 text-2xl sm:text-3xl font-black text-white group-hover:text-coral transition-colors line-clamp-1">
          {HERO_TAGLINES[taglineIndex]}
        </h2>
        <p className="mt-1 text-sm font-semibold text-slate-300">
          {currentEvent.title} · {locationText} · {priceText}
        </p>
      </div>

      {/* Manual Next Button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          advanceSlide();
        }}
        className="absolute top-4 right-4 z-20 grid h-10 w-10 place-items-center rounded-full bg-white/20 text-white backdrop-blur transition hover:scale-110 hover:bg-white/40 active:scale-95"
        title="Next experience"
        aria-label="Next experience"
        type="button"
      >
        →
      </button>
    </div>
  );
};
