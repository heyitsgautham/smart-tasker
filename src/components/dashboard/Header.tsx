
"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Logo } from "@/components/icons";
import { UserNav } from "@/components/dashboard/UserNav";
import { useAuth } from "@/context/AuthContext";
import { Button } from '@/components/ui/button';
import { BellRing, BellOff } from 'lucide-react';
import { doc, setDoc, deleteDoc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useToast } from '@/hooks/use-toast';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import type { PushSubscription } from 'web-push';

async function getVapidKey() {
  // This is your PUBLIC VAPID key.
  return process.env.NEXT_PUBLIC_VAPID_KEY;
}

export default function Header() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isSubscribed, setIsSubscribed] = useState(false);

  useEffect(() => {
    if (!user) return;
    const checkSubscription = async () => {
      if ('serviceWorker' in navigator) {
        try {
          const registration = await navigator.serviceWorker.ready;
          const sub = await registration.pushManager.getSubscription();
          if (sub) {
            // Also check if subscription is stored in Firestore
            const subRef = doc(db, `subscriptions/${user.uid}`);
            const subDoc = await getDoc(subRef);
            if (subDoc.exists()) {
              setIsSubscribed(true);
            } else {
              // Mismatch, unsubscribe from push manager
              await sub.unsubscribe();
              setIsSubscribed(false);
            }
          } else {
            setIsSubscribed(false);
          }
        } catch (error) {
          console.error("Error checking subscription status:", error)
          setIsSubscribed(false);
        }
      }
    };
    checkSubscription();
  }, [user]);

  const handleSubscription = async () => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      toast({ variant: 'destructive', title: 'Push notifications are not supported in this browser.' });
      return;
    }

    if (Notification.permission === 'denied') {
      toast({ variant: 'destructive', title: 'Notification permission denied. Please enable it in your browser settings.' });
      return;
    }

    if (isSubscribed) {
      // Already subscribed, let's unsubscribe
      try {
        const registration = await navigator.serviceWorker.ready;
        const existingSubscription = await registration.pushManager.getSubscription();

        if (existingSubscription) {
          await existingSubscription.unsubscribe();
        }

        if (user) {
          const subRef = doc(db, `subscriptions/${user.uid}`);
          await deleteDoc(subRef).catch(async (serverError) => {
            const permissionError = new FirestorePermissionError({
              path: subRef.path,
              operation: 'delete',
            });
            errorEmitter.emit('permission-error', permissionError);
          });
        }
        setIsSubscribed(false);
        toast({ title: 'Unsubscribed from notifications.' });
      } catch (error) {
        console.error("Error unsubscribing:", error);
        toast({ variant: 'destructive', title: 'Failed to unsubscribe from notifications.' });
      }
    } else {
      // Not subscribed, let's subscribe
      try {
        // Request notification permission first
        const permission = await Notification.requestPermission();

        if (permission !== 'granted') {
          toast({
            variant: 'destructive',
            title: 'Permission denied',
            description: 'You need to grant notification permissions to subscribe.'
          });
          return;
        }

        const vapidKey = await getVapidKey();
        if (!vapidKey) {
          toast({ variant: 'destructive', title: 'VAPID key is not configured.' });
          return;
        }

        // Wait for service worker to be ready
        const registration = await navigator.serviceWorker.ready;
        console.log('Service Worker is ready, subscribing to push...');

        const newSubscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: vapidKey,
        });

        const subscriptionData = newSubscription.toJSON();

        if (user) {
          const subRef = doc(db, `subscriptions/${user.uid}`);

          await setDoc(subRef, subscriptionData)
            .catch(async (serverError) => {
              await newSubscription.unsubscribe(); // Rollback subscription on DB error
              const permissionError = new FirestorePermissionError({
                path: subRef.path,
                operation: 'create',
                requestResourceData: subscriptionData,
              });
              errorEmitter.emit('permission-error', permissionError);
              throw serverError; // Prevent success toast
            });
        }

        setIsSubscribed(true);
        toast({ title: 'Subscribed to notifications!' });

      } catch (error) {
        console.error("Error subscribing to push notifications:", error);
        if ((error as any).name === 'NotAllowedError') {
          toast({ variant: 'destructive', title: 'Subscription failed', description: 'You denied the notification permission request.' });
        } else {
          toast({ variant: 'destructive', title: 'Subscription failed', description: 'An unexpected error occurred. Check console for details.' });
        }
      }
    }
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b bg-card">
      <div className="container mx-auto flex h-16 items-center space-x-4 sm:justify-between sm:space-x-0">
        <Link href="/" className="flex gap-4 items-center">
          <Logo className="h-7 w-7 text-primary" />
          <h1 className="font-headline text-xl font-semibold tracking-tight">
            SmartTasker
          </h1>
        </Link>
        <div className="flex flex-1 items-center justify-end space-x-4">
          <Button variant="ghost" size="icon" onClick={handleSubscription} title={isSubscribed ? "Unsubscribe from notifications" : "Subscribe to notifications"}>
            {isSubscribed ? <BellRing className="h-5 w-5" /> : <BellOff className="h-5 w-5" />}
          </Button>
          <nav className="flex items-center space-x-1">
            {user && <UserNav />}
          </nav>
        </div>
      </div>
    </header>
  );
}
