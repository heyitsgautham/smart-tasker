
'use server';
/**
 * @fileOverview A Genkit flow for adding an event to Google Calendar.
 */
import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { google } from 'googleapis';
import { getDb } from '@/lib/firebase-admin';

const AddGoogleCalendarEventInputSchema = z.object({
  userId: z.string(),
  task: z.object({
    title: z.string(),
    description: z.string(),
    dueDate: z.string(), // ISO string
  }),
});
export type AddGoogleCalendarEventInput = z.infer<typeof AddGoogleCalendarEventInputSchema>;


const addGoogleCalendarEventFlow = ai.defineFlow(
  {
    name: 'addGoogleCalendarEventFlow',
    inputSchema: AddGoogleCalendarEventInputSchema,
    outputSchema: z.void(),
  },
  async ({ userId, task }) => {
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET || !process.env.GOOGLE_REDIRECT_URI) {
      throw new Error("Google Calendar API credentials are not configured on the server.");
    }

    // Create a new OAuth client for this specific user/request
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );

    const db = getDb();
    const tokenDoc = await db.collection('googleCalendarTokens').doc(userId).get();

    if (!tokenDoc.exists) {
      throw new Error('User has not connected their Google Calendar.');
    }

    const tokens = tokenDoc.data();

    console.log('Retrieved tokens from Firestore:', JSON.stringify(tokens, null, 2));

    // Map the stored token field names to what OAuth2 client expects
    oauth2Client.setCredentials({
      access_token: tokens?.accessToken,
      refresh_token: tokens?.refreshToken,
      expiry_date: tokens?.expiryDate,
      scope: tokens?.scope,
      token_type: 'Bearer',
    });

    // Handle token refresh if necessary
    const isTokenExpired = tokens?.expiryDate && tokens.expiryDate < Date.now();
    if (isTokenExpired && tokens?.refreshToken) {
      try {
        const { credentials } = await oauth2Client.refreshAccessToken();
        oauth2Client.setCredentials(credentials);
        // Save the new tokens back to Firestore
        await db.collection('googleCalendarTokens').doc(userId).set({
          accessToken: credentials.access_token,
          refreshToken: credentials.refresh_token,
          expiryDate: credentials.expiry_date,
          scope: credentials.scope,
          updatedAt: new Date().toISOString(),
        }, { merge: true });
      } catch (error) {
        console.error('Error refreshing access token:', error);
        // If refresh fails, we may need to prompt the user to re-authenticate
        throw new Error('Could not refresh Google authentication token. Please reconnect your calendar.');
      }
    }


    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

    const event = {
      summary: task.title,
      description: task.description,
      start: {
        dateTime: task.dueDate,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
      end: {
        dateTime: task.dueDate, // For tasks, start and end can be the same
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
    };

    try {
      await calendar.events.insert({
        calendarId: 'primary',
        requestBody: event,
      });
    } catch (error) {
      console.error('Error creating calendar event:', error);
      throw new Error('Failed to create event in Google Calendar.');
    }
  }
);


export async function addGoogleCalendarEvent(input: AddGoogleCalendarEventInput): Promise<void> {
  return addGoogleCalendarEventFlow(input);
}
