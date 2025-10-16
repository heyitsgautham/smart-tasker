
'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import Header from '@/components/dashboard/Header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import UpdateProfileForm from '@/components/profile/UpdateProfileForm';
import UpdatePasswordForm from '@/components/profile/UpdatePasswordForm';
import DeleteAccountSection from '@/components/profile/DeleteAccountSection';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Loader2, RefreshCw } from 'lucide-react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { getGoogleCalendarAuthUrlAction, syncAllTasksToCalendar } from '../actions';
import { useSearchParams } from 'next/navigation';


function GoogleCalendarIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" {...props}>
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z" fill="#4285F4" />
      <path d="M12.5 7H11v6l5.25 3.15.75-1.23-4.5-2.67z" fill="#4285F4" />
    </svg>
  );
}


export default function ProfilePage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const [isConnecting, setIsConnecting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isCalendarConnected, setIsCalendarConnected] = useState(false);

  // Check for OAuth callback results
  useEffect(() => {
    const calendarConnected = searchParams.get('calendar_connected');
    const error = searchParams.get('error');

    if (calendarConnected === 'true') {
      toast({
        title: "Google Calendar Connected",
        description: "Your Google Calendar has been successfully connected!",
      });
      // Clear the URL parameters
      window.history.replaceState({}, '', '/profile');
    } else if (error) {
      toast({
        variant: "destructive",
        title: "Connection Failed",
        description: decodeURIComponent(error),
      });
      // Clear the URL parameters
      window.history.replaceState({}, '', '/profile');
    }
  }, [searchParams, toast]);

  useEffect(() => {
    if (!user) return;
    const tokenRef = doc(db, 'googleCalendarTokens', user.uid);
    const unsubscribe = onSnapshot(tokenRef, (doc) => {
      setIsCalendarConnected(doc.exists());
    });
    return () => unsubscribe();
  }, [user]);


  const handleConnectGoogleCalendar = async () => {
    if (!user) {
      toast({
        variant: "destructive",
        title: "Authentication Error",
        description: "You must be logged in to connect your calendar.",
      });
      return;
    }
    setIsConnecting(true);

    try {
      const result = await getGoogleCalendarAuthUrlAction(user.uid);
      if (result.authUrl) {
        window.location.href = result.authUrl;
      } else {
        throw new Error(result.error || 'Failed to get authentication URL.');
      }
    } catch (error: any) {
      console.error("Error getting calendar auth", error);
      toast({
        variant: "destructive",
        title: "Failed to connect to Google Calendar",
        description: error.message,
      });
    } finally {
      setIsConnecting(false);
    }
  }

  const handleSyncAllTasks = async () => {
    if (!user) {
      toast({
        variant: "destructive",
        title: "Authentication Error",
        description: "You must be logged in to sync tasks.",
      });
      return;
    }

    setIsSyncing(true);

    try {
      const result = await syncAllTasksToCalendar(user.uid);

      if (result.success) {
        toast({
          title: "Sync Complete",
          description: result.message,
        });

        // Show details if there were errors
        if (result.errors && result.errors.length > 0) {
          console.error("Sync errors:", result.errors);
        }
      } else {
        throw new Error(result.error || 'Failed to sync tasks.');
      }
    } catch (error: any) {
      console.error("Error syncing tasks:", error);
      toast({
        variant: "destructive",
        title: "Sync Failed",
        description: error.message || "Failed to sync tasks to Google Calendar.",
      });
    } finally {
      setIsSyncing(false);
    }
  }

  if (!user) {
    return null; // Or a loading spinner, AuthProvider should redirect
  }

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <Header />
      <main className="flex-1 p-4 sm:p-6 lg:p-8 container mx-auto">
        <div className="max-w-4xl mx-auto space-y-8">
          <div>
            <h1 className="text-3xl md:text-4xl font-headline font-bold tracking-tight">
              Profile Settings
            </h1>
            <p className="text-muted-foreground mt-1">
              Manage your account settings and preferences.
            </p>
          </div>

          <UpdateProfileForm />

          <Separator />

          <Card>
            <CardHeader>
              <CardTitle>Integrations</CardTitle>
              <CardDescription>
                Connect your SmartTasker account to other services.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                {isCalendarConnected ? (
                  <div className="space-y-3">
                    <p className="text-sm text-green-600 font-medium">✓ Google Calendar Connected</p>
                    <Button
                      onClick={handleSyncAllTasks}
                      disabled={isSyncing}
                      variant="outline"
                      className="w-full sm:w-auto"
                    >
                      {isSyncing ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Syncing Tasks...
                        </>
                      ) : (
                        <>
                          <RefreshCw className="mr-2 h-4 w-4" />
                          Sync All Tasks to Calendar
                        </>
                      )}
                    </Button>
                    <p className="text-xs text-muted-foreground">
                      This will add all your pending tasks with due dates to Google Calendar.
                    </p>
                  </div>
                ) : (
                  <Button onClick={handleConnectGoogleCalendar} disabled={isConnecting}>
                    {isConnecting ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <GoogleCalendarIcon className="mr-2 h-5 w-5" />}
                    Connect to Google Calendar
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          <Separator />

          <UpdatePasswordForm />

          <Separator />

          <DeleteAccountSection />
        </div>
      </main>
    </div>
  );
}
