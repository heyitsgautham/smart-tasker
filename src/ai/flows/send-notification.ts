'use server';
/**
 * @fileOverview A Genkit flow for sending web push notifications.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import * as webpush from 'web-push';

const PushSubscriptionSchema = z.object({
  endpoint: z.string(),
  expirationTime: z.number().nullable(),
  keys: z.object({
    p256dh: z.string(),
    auth: z.string(),
  }),
});

const NotificationPayloadSchema = z.object({
  title: z.string(),
  body: z.string(),
});

const SendNotificationInputSchema = z.object({
  subscription: PushSubscriptionSchema,
  payload: NotificationPayloadSchema,
});

export type SendNotificationInput = z.infer<typeof SendNotificationInputSchema>;

export async function sendNotification(input: SendNotificationInput): Promise<void> {
  return sendNotificationFlow(input);
}

const sendNotificationFlow = ai.defineFlow(
  {
    name: 'sendNotificationFlow',
    inputSchema: SendNotificationInputSchema,
    outputSchema: z.void(),
  },
  async ({ subscription, payload }) => {
    // Retrieve VAPID keys inside the flow to ensure they are loaded correctly.
    const vapidSubject = process.env.VAPID_SUBJECT;
    const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_KEY;
    const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;

    if (!vapidPublicKey || !vapidPrivateKey || !vapidSubject) {
      const errorMessage = 'VAPID keys are not configured on the server. Please check your .env file.';
      console.error(errorMessage, {
        hasPublicKey: !!vapidPublicKey,
        hasPrivateKey: !!vapidPrivateKey,
        hasSubject: !!vapidSubject,
      });
      throw new Error(errorMessage);
    }

    try {
      webpush.setVapidDetails(
        vapidSubject,
        vapidPublicKey,
        vapidPrivateKey
      );

      console.log('Sending push notification with payload:', payload);
      
      const result = await webpush.sendNotification(
        subscription,
        JSON.stringify(payload)
      );
      
      console.log('Push notification sent successfully:', result);
    } catch (error: any) {
      console.error("Error sending push notification inside flow:", error);

      // Check if subscription has expired (410 status code)
      if (error?.statusCode === 410) {
        console.log("Push subscription has expired or been unsubscribed. Subscription should be removed from database.");
        // Create a custom error to signal subscription cleanup
        const expiredError = new Error('SUBSCRIPTION_EXPIRED');
        (expiredError as any).statusCode = 410;
        (expiredError as any).endpoint = subscription.endpoint;
        throw expiredError;
      }

      // Re-throw other errors to be caught by the calling action
      throw error;
    }
  }
);
