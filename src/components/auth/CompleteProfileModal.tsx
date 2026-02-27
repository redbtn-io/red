'use client';

import { useState } from 'react';
import { User, Calendar, CheckSquare, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

interface CompleteProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function CompleteProfileModal({ isOpen, onClose, onSuccess }: CompleteProfileModalProps) {
  const { completeProfile } = useAuth();
  const [name, setName] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!agreedToTerms) {
      setError('You must agree to the terms and conditions');
      return;
    }

    setLoading(true);

    try {
      await completeProfile({
        name,
        dateOfBirth,
        agreedToTerms,
      });
      onSuccess();
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to complete profile');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setName('');
    setDateOfBirth('');
    setAgreedToTerms(false);
    setError('');
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-bg-secondary border border-red-500/30 rounded-2xl shadow-2xl max-w-md w-full p-8">
        {/* Logo/Title */}
        <div className="text-center mb-8">
          <div className="text-4xl mb-2">�</div>
          <h2 className="text-2xl font-bold text-text-primary mb-2">Complete Your Profile</h2>
          <p className="text-text-secondary text-sm">
            Just a few more details to get started
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Name */}
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-text-secondary mb-2">
              Full Name
            </label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" size={20} />
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="John Doe"
                className="w-full bg-black/30 border border-gray-700 rounded-lg px-10 py-3 text-text-primary placeholder-text-muted focus:border-red-500 focus:outline-none transition-colors"
                required
                disabled={loading}
              />
            </div>
          </div>

          {/* Date of Birth */}
          <div>
            <label htmlFor="dob" className="block text-sm font-medium text-text-secondary mb-2">
              Date of Birth
            </label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" size={20} />
              <input
                id="dob"
                type="date"
                value={dateOfBirth}
                onChange={(e) => setDateOfBirth(e.target.value)}
                max={new Date().toISOString().split('T')[0]} // Can't select future dates
                className="w-full bg-black/30 border border-gray-700 rounded-lg px-10 py-3 text-text-primary placeholder-text-muted focus:border-red-500 focus:outline-none transition-colors [color-scheme:dark]"
                required
                disabled={loading}
              />
            </div>
          </div>

          {/* Terms Agreement */}
          <div>
            <label className="flex items-start gap-3 cursor-pointer group">
              <div className="relative flex items-center justify-center mt-0.5">
                <input
                  type="checkbox"
                  checked={agreedToTerms}
                  onChange={(e) => setAgreedToTerms(e.target.checked)}
                  className="peer sr-only"
                  disabled={loading}
                />
                <div className="w-5 h-5 border-2 border-gray-700 rounded bg-black/30 peer-checked:bg-red-500 peer-checked:border-red-500 transition-colors flex items-center justify-center">
                  {agreedToTerms && <CheckSquare size={16} className="text-text-primary" />}
                </div>
              </div>
              <span className="text-sm text-text-secondary group-hover:text-text-secondary transition-colors">
                I agree to the{' '}
                <a href="/terms" target="_blank" className="text-red-400 hover:text-red-300 underline">
                  Terms and Conditions
                </a>{' '}
                and{' '}
                <a href="/privacy" target="_blank" className="text-red-400 hover:text-red-300 underline">
                  Privacy Policy
                </a>
              </span>
            </label>
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-red-400 text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !agreedToTerms}
            className="w-full bg-red-500 hover:bg-red-600 text-white disabled:bg-red-500/50 text-white font-semibold py-3 rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 size={20} className="animate-spin" />
                Completing...
              </>
            ) : (
              'Complete Profile'
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
