'use server';
/**
 * @fileOverview A Genkit flow for deleting an event from Google Calendar.
 */
import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { google } from 'googleapis';
import { getDb } from '@/lib/firebase-admin';

const DeleteGoogleCalendarEventInputSchema = z.object({
    userId: z.string(),
    eventId: z.string(),
});

export type DeleteGoogleCalendarEventInput = z.infer<typeof DeleteGoogleCalendarEventInputSchema>;

const deleteGoogleCalendarEventFlow = ai.defineFlow(
    {
        name: 'deleteGoogleCalendarEventFlow',
        inputSchema: DeleteGoogleCalendarEventInputSchema,
        outputSchema: z.object({
            success: z.boolean(),
        }),
    },
    async ({ userId, eventId }) => {
        if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET || !process.env.GOOGLE_REDIRECT_URI) {
            throw new Error("Google Calendar API credentials are not configured on the server.");
        }

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
            await calendar.events.delete({
                calendarId: 'primary',
                eventId: eventId,
            });

            console.log(`Successfully deleted calendar event: ${eventId}`);
            return { success: true };
        } catch (error: any) {
            console.error('Error deleting calendar event:', error);

            // If event doesn't exist (404), consider it a success
            if (error.code === 404) {
                console.log(`Calendar event ${eventId} not found, considering it already deleted`);
                return { success: true };
            }

            throw new Error(`Failed to delete calendar event: ${error.message}`);
        }
    }
);

export async function deleteGoogleCalendarEvent(input: DeleteGoogleCalendarEventInput) {
    return await deleteGoogleCalendarEventFlow(input);
}
