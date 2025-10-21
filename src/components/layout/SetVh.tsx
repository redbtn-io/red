'use client';

import { useEffect } from 'react';

export default function SetVh() {
  useEffect(() => {
    const setVh = () => {
      // 1% of the viewport height. Using this avoids issues with mobile browser chrome.
      document.documentElement.style.setProperty('--vh', `${window.innerHeight * 0.01}px`);
    };

    setVh();
    window.addEventListener('resize', setVh);
    window.addEventListener('orientationchange', setVh);

    return () => {
      window.removeEventListener('resize', setVh);
      window.removeEventListener('orientationchange', setVh);
    };
  }, []);

  return null;
}
