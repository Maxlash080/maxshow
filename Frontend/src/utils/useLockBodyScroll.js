import { useEffect } from 'react';

// Track count of active modal locks for nested/stacked modals
let activeLocksCount = 0;

export const useLockBodyScroll = (isLocked = true) => {
  useEffect(() => {
    if (!isLocked) {
      if (activeLocksCount <= 0) {
        activeLocksCount = 0;
        document.body.style.overflow = '';
        document.body.style.paddingRight = '';
        document.documentElement.style.overflow = '';
      }
      return;
    }

    if (activeLocksCount === 0) {
      const scrollBarWidth = window.innerWidth - document.documentElement.clientWidth;
      if (scrollBarWidth > 0) {
        document.body.style.paddingRight = `${scrollBarWidth}px`;
      }
      document.body.style.overflow = 'hidden';
    }

    activeLocksCount++;

    return () => {
      activeLocksCount = Math.max(0, activeLocksCount - 1);
      if (activeLocksCount === 0) {
        document.body.style.overflow = '';
        document.body.style.paddingRight = '';
        document.documentElement.style.overflow = '';
      }
    };
  }, [isLocked]);
};
