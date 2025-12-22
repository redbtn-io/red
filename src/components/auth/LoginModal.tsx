'use client';

import { useState, useEffect, useRef } from 'react';
import { X, Mail, Loader2, CheckCircle2 } from 'lucide-react';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (isNewUser: boolean, profileComplete: boolean) => void;
  canDismiss?: boolean; // Optional: allow dismissing the modal (default: true)
}

export function LoginModal({ isOpen, onClose, onSuccess, canDismiss = true }: LoginModalProps) {
  const [step, setStep] = useState<'email' | 'waiting'>('email');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sessionId, setSessionId] = useState('');
  const pollingInterval = useRef<NodeJS.Timeout | null>(null);

  // Generate session ID on mount
  useEffect(() => {
    if (!sessionId) {
      // Generate a unique session ID for this browser tab
      const id = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      setSessionId(id);
    }
  }, [sessionId]);

  // Poll for authentication when waiting
  useEffect(() => {
    if (step === 'waiting' && sessionId) {
      console.log('[Login] Starting session polling for:', sessionId);
      
      const poll = async () => {
        try {
          const response = await fetch('/api/auth/check-session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionId }),
          });

          if (response.ok) {
            const data = await response.json();
            
            if (data.authenticated) {
              console.log('[Login] Session authenticated!', data);
              // Stop polling
              if (pollingInterval.current) {
                clearInterval(pollingInterval.current);
                pollingInterval.current = null;
              }
              
              // Trigger success callback
              onSuccess(data.isNewUser, data.profileComplete);
            }
          }
        } catch (err) {
          console.error('[Login] Polling error:', err);
        }
      };

      // Poll immediately, then every 2 seconds
      poll();
      pollingInterval.current = setInterval(poll, 2000);

      // Cleanup on unmount or step change
      return () => {
        if (pollingInterval.current) {
          clearInterval(pollingInterval.current);
          pollingInterval.current = null;
        }
      };
    }
  }, [step, sessionId, onSuccess]);

  if (!isOpen) return null;

  const handleRequestMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch('/api/auth/request-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, sessionId }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to send sign in link');
      }

      setStep('waiting');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send sign in link');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    // Clear polling
    if (pollingInterval.current) {
      clearInterval(pollingInterval.current);
      pollingInterval.current = null;
    }
    
    setStep('email');
    setEmail('');
    setError('');
    onClose();
  };

  const handleResend = async () => {
    setError('');
    setLoading(true);

    try {
      const response = await fetch('/api/auth/request-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, sessionId }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to send sign in link');
      }

      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to resend sign in link');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-[#1a1a1a] border border-red-500/30 rounded-2xl shadow-2xl max-w-md w-full p-8 relative">
        {/* Close button - only show if modal can be dismissed */}
        {canDismiss && (
          <button
            onClick={handleClose}
            className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
          >
            <X size={24} />
          </button>
        )}

        {/* Logo/Title */}
        <div className="text-center mb-8">
          <div className="text-4xl mb-2">🔴</div>
          <h2 className="text-2xl font-bold text-white mb-2">Welcome to redbtn</h2>
          <p className="text-gray-400 text-sm">
            {step === 'email'
              ? 'Enter your email to get started'
              : 'Check your email for the sign in link'}
          </p>
        </div>

        {/* Email Step */}
        {step === 'email' && (
          <form onSubmit={handleRequestMagicLink} className="space-y-6">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-2">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={20} />
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full bg-black/30 border border-gray-700 rounded-lg px-10 py-3 text-white placeholder-gray-500 focus:border-red-500 focus:outline-none transition-colors"
                  required
                  disabled={loading}
                  autoFocus
                />
              </div>
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-red-400 text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-red-500 hover:bg-red-600 disabled:bg-red-500/50 text-white font-semibold py-3 rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 size={20} className="animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Mail size={20} />
                  Send Sign In Link
                </>
              )}
            </button>
          </form>
        )}

        {/* Waiting Step */}
        {step === 'waiting' && (
          <div className="space-y-6">
            {/* Success Icon */}
            <div className="flex justify-center">
              <div className="bg-green-500/10 border-2 border-green-500 rounded-full p-4">
                <CheckCircle2 size={48} className="text-green-500" />
              </div>
            </div>

            {/* Instructions */}
            <div className="text-center space-y-4">
              <p className="text-white font-medium">Sign in link sent!</p>
              <p className="text-gray-400 text-sm">
                We&apos;ve sent a sign in link to <strong className="text-white">{email}</strong>
              </p>
              <p className="text-gray-400 text-sm">
                Click the link in your email to sign in. You can open it on any device.
              </p>
            </div>

            {/* Waiting Animation */}
            <div className="flex justify-center py-4">
              <Loader2 size={32} className="animate-spin text-red-500" />
            </div>

            <p className="text-center text-gray-500 text-xs">
              Waiting for you to click the link...
            </p>

            {error && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-red-400 text-sm">
                {error}
              </div>
            )}

            {/* Resend Button */}
            <div className="border-t border-gray-700 pt-4">
              <button
                onClick={handleResend}
                disabled={loading}
                className="w-full text-gray-400 hover:text-white text-sm transition-colors disabled:opacity-50"
              >
                {loading ? 'Sending...' : "Didn't receive the email? Resend link"}
              </button>
            </div>

            {/* Change Email */}
            <button
              onClick={() => setStep('email')}
              className="w-full text-gray-500 hover:text-gray-400 text-xs transition-colors"
            >
              Use a different email address
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
