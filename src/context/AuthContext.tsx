
"use client";

import { createContext, useContext } from 'react';
import type { User } from 'firebase/auth';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  getAuthHeader: () => Promise<Record<string, string>>;
  getIdToken: () => Promise<string | null>;
}

export const AuthContext = createContext<AuthContextType>({ 
    user: null, 
    loading: true, 
    getAuthHeader: async () => ({}),
    getIdToken: async () => null,
});

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }

  const getAuthHeader = async (): Promise<Record<string, string>> => {
    if (!context.user) return {};
    const token = await context.user.getIdToken();
    return { Authorization: `Bearer ${token}` };
  };

  const getIdToken = async (): Promise<string | null> => {
    if (!context.user) return null;
    return await context.user.getIdToken();
  };

  return { ...context, getAuthHeader, getIdToken };
};
