import { useEffect } from 'react';

// Track count of active modal locks for nested/stacked modals
let activeLocksCount = 0;
let originalOverflow = '';
let originalPaddingRight = '';

export const useLockBodyScroll = (isLocked = true) => {
  useEffect(() => {
    if (!isLocked) return;

    if (activeLocksCount === 0) {
      originalOverflow = document.body.style.overflow;
      originalPaddingRight = document.body.style.paddingRight;

      const scrollBarWidth = window.innerWidth - document.documentElement.clientWidth;
      if (scrollBarWidth > 0) {
        document.body.style.paddingRight = `${scrollBarWidth}px`;
      }
      document.body.style.overflow = 'hidden';
    }

    activeLocksCount++;

    return () => {
      activeLocksCount--;
      if (activeLocksCount <= 0) {
        activeLocksCount = 0;
        document.body.style.overflow = originalOverflow;
        document.body.style.paddingRight = originalPaddingRight;
      }
    };
  }, [isLocked]);
};
