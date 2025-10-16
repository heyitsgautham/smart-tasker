
'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useAuth } from '@/context/AuthContext';
import { EmailAuthProvider, reauthenticateWithCredential, updatePassword } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

const passwordFormSchema = z.object({
    newPassword: z.string().min(6, { message: 'Password must be at least 6 characters.' }),
    confirmPassword: z.string(),
  }).refine(data => data.newPassword === data.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'],
  });
  
const reauthFormSchema = z.object({
  currentPassword: z.string().min(1, { message: 'Current password is required.' }),
});

type PasswordFormValues = z.infer<typeof passwordFormSchema>;
type ReauthFormValues = z.infer<typeof reauthFormSchema>;

export default function UpdatePasswordForm() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isReauthDialogOpen, setIsReauthDialogOpen] = useState(false);
  const [newPassword, setNewPassword] = useState("");

  const passwordForm = useForm<PasswordFormValues>({
    resolver: zodResolver(passwordFormSchema),
    defaultValues: { newPassword: '', confirmPassword: '' },
  });

  const reauthForm = useForm<ReauthFormValues>({
    resolver: zodResolver(reauthFormSchema),
    defaultValues: { currentPassword: '' },
  });
  
  const isGoogleSignIn = user?.providerData.some(
    (provider) => provider.providerId === 'google.com'
  );

  if (isGoogleSignIn) {
    return (
        <Card>
            <CardHeader>
                <CardTitle>Change Password</CardTitle>
                <CardDescription>You are signed in with Google and cannot change your password here.</CardDescription>
            </CardHeader>
        </Card>
    )
  }

  const handlePasswordUpdate = (values: PasswordFormValues) => {
    setNewPassword(values.newPassword);
    setIsReauthDialogOpen(true);
  };

  const handleReauthentication = async (values: ReauthFormValues) => {
    if (!user || !user.email) return;

    setIsSubmitting(true);
    try {
      const credential = EmailAuthProvider.credential(user.email, values.currentPassword);
      await reauthenticateWithCredential(user, credential);
      await updatePassword(user, newPassword);

      toast({
        title: 'Password updated',
        description: 'Your password has been successfully changed.',
      });
      setIsReauthDialogOpen(false);
      passwordForm.reset();
      reauthForm.reset();

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
    <Card>
        <CardHeader>
            <CardTitle>Change Password</CardTitle>
            <CardDescription>
                Enter a new password for your account. You will be asked to confirm your current password.
            </CardDescription>
        </CardHeader>
        <CardContent>
            <Form {...passwordForm}>
            <form onSubmit={passwordForm.handleSubmit(handlePasswordUpdate)} className="space-y-4">
                <FormField
                control={passwordForm.control}
                name="newPassword"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>New Password</FormLabel>
                    <FormControl>
                        <Input type="password" placeholder="••••••••" {...field} />
                    </FormControl>
                    <FormMessage />
                    </FormItem>
                )}
                />
                <FormField
                control={passwordForm.control}
                name="confirmPassword"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>Confirm New Password</FormLabel>
                    <FormControl>
                        <Input type="password" placeholder="••••••••" {...field} />
                    </FormControl>
                    <FormMessage />
                    </FormItem>
                )}
                />
                <Button type="submit">
                    Change Password
                </Button>
            </form>
            </Form>
        </CardContent>

        <Dialog open={isReauthDialogOpen} onOpenChange={setIsReauthDialogOpen}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Confirm Your Identity</DialogTitle>
                    <DialogDescription>
                        For your security, please enter your current password to continue.
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
                    <Button type="submit" disabled={isSubmitting} className="w-full">
                        {isSubmitting ? <Loader2 className="animate-spin" /> : 'Confirm and Update Password'}
                    </Button>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    </Card>
  );
}
