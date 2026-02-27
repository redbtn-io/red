'use client';

import { useEffect } from 'react';

export default function SetVh() {
  useEffect(() => {
    const setVh = () => {
      // 1% of the viewport height. Using this avoids issues with mobile browser chrome.
      const vh = window.innerHeight * 0.01;
      document.documentElement.style.setProperty('--vh', `${vh}px`);
      
      // Also set the full viewport height for convenience
      document.documentElement.style.setProperty('--app-height', `${window.innerHeight}px`);
    };

    setVh();
    window.addEventListener('resize', setVh);
    window.addEventListener('orientationchange', setVh);
    
    // Also listen to visualViewport for more accurate mobile handling
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', setVh);
    }

    return () => {
      window.removeEventListener('resize', setVh);
      window.removeEventListener('orientationchange', setVh);
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', setVh);
      }
    };
  }, []);

  return null;
}
