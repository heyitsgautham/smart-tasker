
"use client";

import React, { useEffect, useState, type ReactNode } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { AuthContext } from '@/context/AuthContext';
import { usePathname, useRouter } from 'next/navigation';
import { Progress } from "@/components/ui/progress";
import { Logo } from '../icons';
import { FirebaseErrorListener } from '../FirebaseErrorListener';

const AUTH_ROUTES = ['/login', '/signup'];

function AuthLoader() {
  const [progress, setProgress] = React.useState(13);

  React.useEffect(() => {
    const timer = setTimeout(() => setProgress(66), 500);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background">
      <div className="w-[350px] p-8">
        <div className="flex flex-col items-center justify-center space-y-6">
          <div className="flex items-center space-x-2">
            <Logo className="h-8 w-8 text-primary" />
            <span className="text-xl font-headline font-semibold">SmartTasker</span>
          </div>
          <Progress value={progress} className="w-full" />
        </div>
      </div>
    </div>
  );
}


export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js')
        .then(registration => {
          console.log('Service Worker registered successfully with scope:', registration.scope);
        })
        .catch(error => {
          console.error('Service Worker registration failed:', error);
          console.error('Make sure /public/sw.js exists in your project');
        });
    } else {
      console.warn('Service Workers are not supported in this browser');
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const idToken = await user.getIdToken();
        // Here we can store the token if needed, e.g., in a cookie or context for server-side actions.
        // For simplicity, we are passing it in headers from client components where needed.
      }
      setUser(user);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);


  useEffect(() => {
    if (loading) return;

    const isAuthRoute = AUTH_ROUTES.includes(pathname);

    if (!user && !isAuthRoute) {
      router.push('/login');
    } else if (user && isAuthRoute) {
      router.push('/');
    }
  }, [user, loading, pathname, router]);

  if (loading) {
    return <AuthLoader />;
  }

  const isAuthRoute = AUTH_ROUTES.includes(pathname);
  if ((!user && !isAuthRoute) || (user && isAuthRoute)) {
    return <AuthLoader />;
  }

  const getAuthHeader = async (): Promise<Record<string, string>> => {
    if (!user) return {};
    const token = await user.getIdToken();
    return { Authorization: `Bearer ${token}` };
  };

  const getIdToken = async (): Promise<string | null> => {
    if (!user) return null;
    return await user.getIdToken();
  };

  return (
    <AuthContext.Provider value={{ user, loading, getAuthHeader, getIdToken }}>
      <FirebaseErrorListener />
      {children}
    </AuthContext.Provider>
  );
};
