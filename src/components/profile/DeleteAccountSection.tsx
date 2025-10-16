
'use client';

import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { EmailAuthProvider, reauthenticateWithCredential, deleteUser } from 'firebase/auth';
import { useToast } from '@/hooks/use-toast';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const reauthFormSchema = z.object({
  currentPassword: z.string().min(1, { message: 'Current password is required.' }),
});

type ReauthFormValues = z.infer<typeof reauthFormSchema>;

export default function DeleteAccountSection() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isConfirming, setIsConfirming] = useState(false);
  const [isReauthenticating, setIsReauthenticating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const reauthForm = useForm<ReauthFormValues>({
    resolver: zodResolver(reauthFormSchema),
    defaultValues: { currentPassword: '' },
  });

  const isGoogleSignIn = user?.providerData.some(
    (provider) => provider.providerId === 'google.com'
  );

  const handleDelete = async () => {
    if (!user) return;
    
    // For social auth, re-authentication is not required with this method.
    if (isGoogleSignIn) {
      await performDelete();
    } else {
      // For email/password, we need to re-authenticate.
      setIsReauthenticating(true);
    }
  };
  
  const performDelete = async () => {
    if (!user) return;
    try {
        await deleteUser(user);
        toast({
          title: 'Account deleted',
          description: 'Your account has been permanently deleted.',
        });
        // The AuthProvider will handle redirecting the user to the login page.
      } catch (error: any) {
        toast({
          variant: 'destructive',
          title: 'Deletion failed',
          description: error.message,
        });
      } finally {
        setIsConfirming(false);
        setIsReauthenticating(false);
      }
  }

  const handleReauthentication = async (values: ReauthFormValues) => {
    if (!user || !user.email) return;
    setIsSubmitting(true);
    try {
      const credential = EmailAuthProvider.credential(user.email, values.currentPassword);
      await reauthenticateWithCredential(user, credential);
      await performDelete();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Authentication Failed',
        description: 'The password you entered is incorrect. Please try again.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };
  
  return (
    <Card className="border-destructive">
      <CardHeader>
        <CardTitle className="text-destructive">Delete Account</CardTitle>
        <CardDescription>
          Permanently delete your account and all associated data. This action cannot be undone.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button variant="destructive" onClick={() => setIsConfirming(true)}>
          Delete My Account
        </Button>
      </CardContent>

      <AlertDialog open={isConfirming} onOpenChange={setIsConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This is a permanent action. All your tasks and data will be deleted.
              This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setIsConfirming(false);
                handleDelete();
              }}
              className={cn(buttonVariants({ variant: "destructive" }))}
            >
              Confirm Deletion
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={isReauthenticating} onOpenChange={setIsReauthenticating}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Confirm Your Identity</DialogTitle>
                <DialogDescription>
                    For your security, please enter your password to permanently delete your account.
                </DialogDescription>
            </DialogHeader>
            <Form {...reauthForm}>
                <form onSubmit={reauthForm.handleSubmit(handleReauthentication)} className="space-y-4">
                <FormField
                    control={reauthForm.control}
                    name="currentPassword"
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel>Current Password</FormLabel>
                        <FormControl>
                        <Input type="password" placeholder="••••••••" {...field} />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                    )}
                />
                <Button type="submit" variant="destructive" disabled={isSubmitting} className="w-full">
                    {isSubmitting ? <Loader2 className="animate-spin" /> : 'Confirm and Delete Account'}
                </Button>
                </form>
            </Form>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
