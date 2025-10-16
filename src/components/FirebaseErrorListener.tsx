"use client";

import { useEffect } from 'react';
import { errorEmitter } from '@/firebase/error-emitter';
import { useToast } from '@/hooks/use-toast';
import { FirestorePermissionError } from '@/firebase/errors';

// This component is designed to be used within a client-side context
// where hooks like useToast are available.
export function FirebaseErrorListener() {
  const { toast } = useToast();

  useEffect(() => {
    const handlePermissionError = (error: FirestorePermissionError) => {
      console.error("Caught Firestore Permission Error:", error.toString());
      
      // We are throwing the error here to make it visible in the Next.js
      // development overlay. This provides the best developer experience
      // for debugging security rules. In a production build, this would
      // fail silently, but you could adapt it to show a toast or a modal.
      throw error;
    };

    errorEmitter.on('permission-error', handlePermissionError);

    return () => {
      errorEmitter.off('permission-error', handlePermissionError);
    };
  }, [toast]);

  // This component does not render anything itself.
  return null;
}
