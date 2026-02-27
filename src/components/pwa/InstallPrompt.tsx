'use client';

import { useState, useEffect, useRef } from 'react';
import { X, Download, Share, Plus } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

// Module-level flag to prevent showing prompt multiple times across navigations
let hasShownThisSession = false;

export default function InstallPrompt() {
  const [showPrompt, setShowPrompt] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(true); // Default to true to prevent flash
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Early exit if already shown this session
    if (hasShownThisSession) return;

    // Check if already running as PWA
    const standalone = window.matchMedia('(display-mode: standalone)').matches
      || (window.navigator as Navigator & { standalone?: boolean }).standalone === true
      || document.referrer.includes('android-app://');
    
    setIsStandalone(standalone);
    if (standalone) return;

    // Check if user dismissed the prompt before (with 7-day cooldown)
    const dismissedAt = localStorage.getItem('pwa-install-dismissed');
    if (dismissedAt) {
      const dismissedTime = parseInt(dismissedAt, 10);
      const sevenDays = 7 * 24 * 60 * 60 * 1000;
      if (Date.now() - dismissedTime < sevenDays) {
        hasShownThisSession = true; // Mark as handled
        return;
      }
    }

    // Check if iOS
    const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as Window & { MSStream?: unknown }).MSStream;
    setIsIOS(iOS);

    // Listen for the beforeinstallprompt event (Chrome, Edge, etc.)
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      
      // Only show if not already shown this session
      if (!hasShownThisSession) {
        hasShownThisSession = true;
        timerRef.current = setTimeout(() => setShowPrompt(true), 3000);
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);

    // For iOS, show the prompt after a delay since there's no beforeinstallprompt
    if (iOS && !hasShownThisSession) {
      hasShownThisSession = true;
      timerRef.current = setTimeout(() => setShowPrompt(true), 5000);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  const handleInstall = async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setShowPrompt(false);
      }
      setDeferredPrompt(null);
    }
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    localStorage.setItem('pwa-install-dismissed', Date.now().toString());
  };

  if (isStandalone || !showPrompt) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 50 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 50 }}
        className="fixed bottom-safe left-4 right-4 md:left-auto md:right-4 md:w-80 z-[60]"
      >
        <div className="bg-bg-secondary border border-border rounded-xl shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between p-3 border-b border-border">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-red-500 rounded-lg flex items-center justify-center">
                <Download size={16} className="text-white" />
              </div>
              <span className="font-semibold text-text-primary text-sm">Install redbtn</span>
            </div>
            <button
              onClick={handleDismiss}
              className="p-1 hover:bg-bg-tertiary rounded-lg transition-colors"
              aria-label="Dismiss"
            >
              <X size={18} className="text-text-secondary" />
            </button>
          </div>

          {/* Content */}
          <div className="p-3">
            {isIOS ? (
              // iOS instructions
              <div className="space-y-3">
                <p className="text-text-secondary text-sm">
                  Install this app on your device for quick access:
                </p>
                <div className="space-y-2">
                  <div className="flex items-center gap-3 text-sm text-text-secondary">
                    <div className="w-6 h-6 bg-bg-tertiary rounded flex items-center justify-center shrink-0">
                      <Share size={14} className="text-blue-400" />
                    </div>
                    <span>Tap the <strong className="text-text-primary">Share</strong> button</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm text-text-secondary">
                    <div className="w-6 h-6 bg-bg-tertiary rounded flex items-center justify-center shrink-0">
                      <Plus size={14} className="text-blue-400" />
                    </div>
                    <span>Select <strong className="text-text-primary">Add to Home Screen</strong></span>
                  </div>
                </div>
              </div>
            ) : deferredPrompt ? (
              // Chrome/Edge with native install
              <div className="space-y-3">
                <p className="text-text-secondary text-sm">
                  Get quick access with offline support
                </p>
                <button
                  onClick={handleInstall}
                  className="w-full py-2 px-4 bg-red-500 hover:bg-red-600 text-white text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  <Download size={16} />
                  Install App
                </button>
              </div>
            ) : (
              // Generic browser instructions
              <div className="space-y-2">
                <p className="text-text-secondary text-sm">
                  Install this app for a better experience:
                </p>
                <p className="text-text-secondary text-xs">
                  Look for the install icon in your browser&apos;s address bar or menu.
                </p>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
