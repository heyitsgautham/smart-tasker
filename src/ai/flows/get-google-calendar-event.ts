'use server';
/**
 * @fileOverview A Genkit flow for getting a calendar event from Google Calendar.
 */
import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { google } from 'googleapis';
import { getDb } from '@/lib/firebase-admin';

const GetGoogleCalendarEventInputSchema = z.object({
    userId: z.string(),
    eventId: z.string(),
});
export type GetGoogleCalendarEventInput = z.infer<typeof GetGoogleCalendarEventInputSchema>;

const getGoogleCalendarEventFlow = ai.defineFlow(
    {
        name: 'getGoogleCalendarEventFlow',
        inputSchema: GetGoogleCalendarEventInputSchema,
        outputSchema: z.object({
            exists: z.boolean(),
            event: z.any().optional(),
        }),
    },
    async ({ userId, eventId }) => {
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
                throw new Error('Could not refresh Google authentication token. Please reconnect your calendar.');
            }
        }

        const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

        try {
            const response = await calendar.events.get({
                calendarId: 'primary',
                eventId: eventId,
            });
            return { exists: true, event: response.data };
        } catch (error: any) {
            // If error is 404, event doesn't exist
            if (error?.code === 404 || error?.response?.status === 404) {
                return { exists: false };
            }
            // For other errors, throw them
            console.error('Error getting calendar event:', error);
            throw new Error('Failed to check event in Google Calendar.');
        }
    }
);

export async function getGoogleCalendarEvent(input: GetGoogleCalendarEventInput): Promise<{ exists: boolean; event?: any }> {
    return getGoogleCalendarEventFlow(input);
}
