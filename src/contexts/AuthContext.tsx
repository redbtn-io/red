'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export interface User {
  id: string;
  email: string;
  name?: string;
  dateOfBirth?: string;
  profileComplete: boolean;
  accountLevel: number;
  createdAt?: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isAdmin: boolean;
  logout: () => Promise<void>;
  completeProfile: (data: { name: string; dateOfBirth: string; agreedToTerms: boolean }) => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Computed property for admin check
  const isAdmin = user?.accountLevel === 0;

  // Check authentication status on mount
  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const response = await fetch('/api/auth/me');
      if (response.ok) {
        const data = await response.json();
        setUser(data.user);
      } else {
        setUser(null);
      }
    } catch (error) {
      console.error('[Auth] Check auth error:', error);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const completeProfile = async (profileData: {
    name: string;
    dateOfBirth: string;
    agreedToTerms: boolean;
  }) => {
    const response = await fetch('/api/auth/complete-profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(profileData),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to complete profile');
    }

    const data = await response.json();
    setUser(data.user);
  };

  const logout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      
      // Clear all user-specific data from localStorage
      if (typeof window !== 'undefined') {
        localStorage.removeItem('red_conversations');
        localStorage.removeItem('red_active_conversation');
        localStorage.removeItem('red_last_conversation');
        sessionStorage.clear();
      }
      
      setUser(null);
    } catch (error) {
      console.error('[Auth] Logout error:', error);
      throw error;
    }
  };

  const refreshUser = async () => {
    await checkAuth();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isAdmin,
        logout,
        completeProfile,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
