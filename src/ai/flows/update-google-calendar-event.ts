'use server';
/**
 * @fileOverview A Genkit flow for updating an event in Google Calendar.
 */
import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { google } from 'googleapis';
import { getDb } from '@/lib/firebase-admin';

const UpdateGoogleCalendarEventInputSchema = z.object({
    userId: z.string(),
    eventId: z.string(),
    task: z.object({
        title: z.string(),
        description: z.string(),
        dueDate: z.string(), // ISO string
        priority: z.enum(["low", "medium", "high"]),
    }),
});
export type UpdateGoogleCalendarEventInput = z.infer<typeof UpdateGoogleCalendarEventInputSchema>;

const updateGoogleCalendarEventFlow = ai.defineFlow(
    {
        name: 'updateGoogleCalendarEventFlow',
        inputSchema: UpdateGoogleCalendarEventInputSchema,
        outputSchema: z.void(),
    },
    async ({ userId, eventId, task }) => {
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

        // Map priority to Google Calendar color ID
        const colorIdMap = {
            low: '2', // sage (green)
            medium: '5', // banana (yellow)
            high: '11', // tomato (red)
        };

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
            colorId: colorIdMap[task.priority],
        };

        try {
            await calendar.events.update({
                calendarId: 'primary',
                eventId,
                requestBody: event,
            });
        } catch (error) {
            console.error('Error updating calendar event:', error);
            throw new Error('Failed to update event in Google Calendar.');
        }
    }
);

export async function updateGoogleCalendarEvent(input: UpdateGoogleCalendarEventInput): Promise<void> {
    return updateGoogleCalendarEventFlow(input);
}