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
      
      await webpush.sendNotification(
        subscription,
        JSON.stringify(payload)
      );
    } catch (error) {
      console.error("Error sending push notification inside flow:", error);
      // Re-throw the error to be caught by the calling action
      throw error;
    }
  }
);
