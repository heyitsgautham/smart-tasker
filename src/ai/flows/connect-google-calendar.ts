
'use server';
/**
 * @fileOverview A Genkit flow for connecting to Google Calendar.
 */
import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { google } from 'googleapis';


const ConnectGoogleCalendarInputSchema = z.object({
    state: z.string(),
});
export type ConnectGoogleCalendarInput = z.infer<typeof ConnectGoogleCalendarInputSchema>;

const ConnectGoogleCalendarOutputSchema = z.object({
  authUrl: z.string(),
});
export type ConnectGoogleCalendarOutput = z.infer<typeof ConnectGoogleCalendarOutputSchema>;


export async function getGoogleCalendarAuthUrl(input: ConnectGoogleCalendarInput): Promise<ConnectGoogleCalendarOutput> {
    return connectGoogleCalendarFlow(input);
}


const connectGoogleCalendarFlow = ai.defineFlow(
  {
    name: 'connectGoogleCalendarFlow',
    inputSchema: ConnectGoogleCalendarInputSchema,
    outputSchema: ConnectGoogleCalendarOutputSchema,
  },
  async ({ state }) => {
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET || !process.env.GOOGLE_REDIRECT_URI) {
      throw new Error("Google Calendar API credentials are not configured on the server.");
    }
    
    // This needs to be configured in your Google Cloud project.
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );

    const scopes = [
      'https://www.googleapis.com/auth/calendar.events'
    ];

    const url = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      state: state, // Pass state to the auth URL
      prompt: 'consent', // Force consent screen to get a refresh token every time
    });

    return { authUrl: url };
  }
);
