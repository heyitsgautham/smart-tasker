
"use server";

import { suggestPriority } from "@/ai/flows/ai-suggested-priority";
import { sendNotification } from "@/ai/flows/send-notification";
import { addGoogleCalendarEvent } from "@/ai/flows/add-google-calendar-event";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { getDb } from "@/lib/firebase-admin";
import type { PushSubscription } from "web-push";
import type { Task } from "@/lib/types";
import { google } from 'googleapis';
import { getGoogleCalendarAuthUrl } from "@/ai/flows/connect-google-calendar";

export async function getPrioritySuggestion(description: string): Promise<{ priority?: 'low' | 'medium' | 'high'; error?: string; }> {
  if (!description?.trim()) {
    return { error: 'Description is required to suggest a priority.' };
  }
  try {
    const result = await suggestPriority({ description });
    return { priority: result.priority };
  } catch (error) {
    console.error("Error suggesting priority:", error);
    return { error: 'Failed to get priority suggestion from AI.' };
  }
}

type SerializableTask = Omit<Task, 'dueDate' | 'createdAt'> & {
  dueDate: string | null;
  createdAt: string;
};

export async function scheduleTaskNotification(task: SerializableTask, userId: string): Promise<{ success: boolean; error?: string }> {
  if (!userId) {
    return { success: false, error: "User not authenticated." };
  }

  if (!task.dueDate) {
    return { success: false, error: "Task has no due date." };
  }

  try {
    const subRef = doc(db, `subscriptions/${userId}`);
    const subDoc = await getDoc(subRef);

    if (subDoc.exists()) {
      const subscription = subDoc.data() as PushSubscription;

      await sendNotification({
        subscription,
        payload: {
          title: `Task Reminder: ${task.title}`,
          body: `Your task "${task.title}" is due now.`,
        },
      });
      return { success: true };
    } else {
      console.log("No push subscription found for user:", userId);
      return { success: false, error: "No push subscription found." };
    }
  } catch (error) {
    console.error("Error scheduling notification:", error);
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Failed to schedule notification.');
  }
}

export async function exchangeCodeForTokens(userId: string, code: string): Promise<{ success: boolean; error?: string; }> {
  if (!userId) {
    return { success: false, error: "User not authenticated." };
  }

  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET || !process.env.GOOGLE_REDIRECT_URI) {
    console.error("Google OAuth credentials are not configured on the server.");
    return { success: false, error: "Server is not configured for Google authentication." };
  }

  console.log('Attempting to exchange auth code for tokens...');
  console.log('Using redirect URI:', process.env.GOOGLE_REDIRECT_URI);
  console.log('Client ID:', process.env.GOOGLE_CLIENT_ID);
  console.log('User ID:', userId);

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );

  try {
    const { tokens } = await oauth2Client.getToken(code);

    console.log('Successfully received tokens from Google');

    // Use firebase-admin for server-side operations
    const db = getDb();
    await db.collection('googleCalendarTokens').doc(userId).set({
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiryDate: tokens.expiry_date,
      scope: tokens.scope,
      updatedAt: new Date().toISOString(),
    });

    console.log('Successfully stored Google Calendar tokens for user:', userId);
    return { success: true };
  } catch (error: any) {
    console.error('Error exchanging auth code for tokens:', error);

    // Provide more detailed error information
    if (error?.response?.data) {
      console.error('Google API Error Response:', JSON.stringify(error.response.data, null, 2));
    }

    if (error?.message) {
      console.error('Error message:', error.message);
    }

    // Check for common error types
    if (error?.response?.data?.error === 'redirect_uri_mismatch') {
      return {
        success: false,
        error: 'Redirect URI mismatch. Please ensure the redirect URI in Google Cloud Console matches: ' + process.env.GOOGLE_REDIRECT_URI
      };
    }

    if (error?.response?.data?.error === 'invalid_grant') {
      return {
        success: false,
        error: 'Authorization code expired or already used. Please try connecting again.'
      };
    }

    return { success: false, error: 'Failed to exchange authorization code for tokens.' };
  }
}


export async function addCalendarEventAction(task: SerializableTask, userId: string) {
  try {
    if (!userId) {
      throw new Error("User not authenticated.");
    }
    if (!task.dueDate) {
      return { error: "Task has no due date." };
    }

    await addGoogleCalendarEvent({
      userId,
      task: {
        title: task.title,
        description: task.description || "",
        dueDate: task.dueDate,
      },
    });
    return { success: true };
  } catch (error: any) {
    console.error("Error adding calendar event:", error);
    return { error: error.message || "Failed to add task to Google Calendar." };
  }
}


export async function getGoogleCalendarAuthUrlAction(userId: string) {
  try {
    if (!userId) {
      throw new Error("User not authenticated.");
    }
    const { authUrl } = await getGoogleCalendarAuthUrl({ state: userId });
    return { authUrl };
  } catch (error: any) {
    console.error("Error getting calendar auth URL:", error);
    return { error: error.message || "Failed to connect to Google Calendar." };
  }
}


export async function syncAllTasksToCalendar(userId: string) {
  try {
    if (!userId) {
      throw new Error("User not authenticated.");
    }

    // Get all tasks for this user from Firestore
    const db = getDb();
    const tasksSnapshot = await db.collection('tasks')
      .where('userId', '==', userId)
      .where('completed', '==', false)
      .get();

    if (tasksSnapshot.empty) {
      return {
        success: true,
        synced: 0,
        skipped: 0,
        failed: 0,
        message: "No pending tasks found to sync."
      };
    }

    let synced = 0;
    let skipped = 0;
    let failed = 0;
    const errors: string[] = [];

    // Process each task
    for (const doc of tasksSnapshot.docs) {
      const taskData = doc.data();

      // Skip tasks without due dates
      if (!taskData.dueDate) {
        skipped++;
        continue;
      }

      try {
        // Convert Firestore Timestamp to ISO string
        const dueDate = taskData.dueDate.toDate ?
          taskData.dueDate.toDate().toISOString() :
          taskData.dueDate;

        await addGoogleCalendarEvent({
          userId,
          task: {
            title: taskData.title,
            description: taskData.description || "",
            dueDate: dueDate,
          },
        });

        synced++;
      } catch (error: any) {
        failed++;
        errors.push(`${taskData.title}: ${error.message}`);
        console.error(`Failed to sync task "${taskData.title}":`, error);
      }
    }

    return {
      success: true,
      synced,
      skipped,
      failed,
      errors: failed > 0 ? errors : undefined,
      message: `Synced ${synced} task(s) to Google Calendar. ${skipped} task(s) skipped (no due date). ${failed > 0 ? `${failed} task(s) failed.` : ''}`
    };

  } catch (error: any) {
    console.error("Error syncing tasks to calendar:", error);
    return {
      success: false,
      error: error.message || "Failed to sync tasks to Google Calendar."
    };
  }
}
