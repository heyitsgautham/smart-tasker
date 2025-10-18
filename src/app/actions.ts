
"use server";

import { suggestPriority } from "@/ai/flows/ai-suggested-priority";
import { sendNotification } from "@/ai/flows/send-notification";
import { addGoogleCalendarEvent } from "@/ai/flows/add-google-calendar-event";
import { updateGoogleCalendarEvent } from "@/ai/flows/update-google-calendar-event";
import { deleteGoogleCalendarEvent } from "@/ai/flows/delete-google-calendar-event";
import { getGoogleCalendarEvent } from "@/ai/flows/get-google-calendar-event";
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
    const db = await getDb();
    const subRef = db.collection('subscriptions').doc(userId);
    const subDoc = await subRef.get();

    if (subDoc.exists) {
      const subscription = subDoc.data() as PushSubscription;

      try {
        await sendNotification({
          subscription: {
            endpoint: subscription.endpoint,
            keys: subscription.keys,
            expirationTime: subscription.expirationTime ?? null,
          },
          payload: {
            title: `Task Reminder: ${task.title}`,
            body: `Your task "${task.title}" is due now.`,
          },
        });
        return { success: true };
      } catch (notificationError: any) {
        // If subscription has expired (410 error), remove it from database
        if (notificationError?.statusCode === 410 || notificationError?.message === 'SUBSCRIPTION_EXPIRED') {
          console.log(`Removing expired push subscription for user: ${userId}`);
          await subRef.delete();
          return { success: false, error: "Push subscription has expired. Please re-subscribe to notifications." };
        }
        // Re-throw other errors
        throw notificationError;
      }
    } else {
      console.log("No push subscription found for user:", userId);
      return { success: false, error: "No push subscription found." };
    }
  } catch (error) {
    console.error("Error scheduling notification:", error);
    if (error instanceof Error) {
      return { success: false, error: error.message };
    }
    return { success: false, error: 'Failed to schedule notification.' };
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


export async function addCalendarEventAction(task: SerializableTask, userId: string): Promise<{ success: boolean; eventId?: string; error?: string }> {
  try {
    if (!userId) {
      throw new Error("User not authenticated.");
    }
    if (!task.dueDate) {
      return { success: false, error: "Task has no due date." };
    }

    console.log(`Adding calendar event for task ${task.id}`);

    const result = await addGoogleCalendarEvent({
      userId,
      task: {
        title: task.title,
        description: task.description || "",
        dueDate: task.dueDate,
        priority: task.priority,
        hasTime: task.hasTime,
      },
    });

    console.log(`Calendar event created with ID: ${result.eventId}`);
    return { success: true, eventId: result.eventId };
  } catch (error: any) {
    console.error("Error adding calendar event:", error);
    return { success: false, error: error.message || "Failed to add task to Google Calendar." };
  }
}

export async function updateCalendarEventAction(task: SerializableTask, userId: string): Promise<{ success: boolean; error?: string }> {
  try {
    if (!userId) {
      throw new Error("User not authenticated.");
    }
    if (!task.dueDate) {
      return { success: false, error: "Task has no due date." };
    }
    if (!task.calendarEventId) {
      console.error("Update calendar event called but task has no calendarEventId:", task.id);
      return { success: false, error: "Task has no calendar event ID." };
    }

    console.log(`Updating calendar event ${task.calendarEventId} for task ${task.id}`);

    await updateGoogleCalendarEvent({
      userId,
      eventId: task.calendarEventId,
      task: {
        title: task.title,
        description: task.description || "",
        dueDate: task.dueDate,
        priority: task.priority,
        hasTime: task.hasTime,
      },
    });
    return { success: true };
  } catch (error: any) {
    console.error("Error updating calendar event:", error);
    return { success: false, error: error.message || "Failed to update task in Google Calendar." };
  }
}

export async function deleteCalendarEventAction(eventId: string, userId: string): Promise<{ success: boolean; error?: string }> {
  try {
    if (!userId) {
      throw new Error("User not authenticated.");
    }
    if (!eventId) {
      return { success: false, error: "No calendar event ID provided." };
    }

    console.log(`Deleting calendar event ${eventId} for user ${userId}`);

    await deleteGoogleCalendarEvent({
      userId,
      eventId,
    });

    return { success: true };
  } catch (error: any) {
    console.error("Error deleting calendar event:", error);
    return { success: false, error: error.message || "Failed to delete event from Google Calendar." };
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
        added: 0,
        verified: 0,
        skipped: 0,
        failed: 0,
        message: "No pending tasks found to sync."
      };
    }

    let added = 0;
    let verified = 0;
    let skipped = 0;
    let failed = 0;
    const errors: string[] = [];

    // Process each task
    for (const docSnap of tasksSnapshot.docs) {
      const taskData = docSnap.data();

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

        let eventExistsInCalendar = false;
        let needsUpdate = false;

        // Check if task has a calendar event ID
        if (taskData.calendarEventId) {
          // Verify the event still exists in Google Calendar
          try {
            const eventCheck = await getGoogleCalendarEvent({
              userId,
              eventId: taskData.calendarEventId,
            });

            if (eventCheck.exists) {
              eventExistsInCalendar = true;
              // Event exists, verify it has correct details
              const event = eventCheck.event;
              needsUpdate =
                event.summary !== taskData.title ||
                event.description !== (taskData.description || "");

              if (needsUpdate) {
                // Update the event with correct details
                await updateGoogleCalendarEvent({
                  userId,
                  eventId: taskData.calendarEventId,
                  task: {
                    title: taskData.title,
                    description: taskData.description || "",
                    dueDate: dueDate,
                    priority: taskData.priority || "medium",
                    hasTime: taskData.hasTime,
                  },
                });
                console.log(`Updated calendar event for task: ${taskData.title}`);
              }
              verified++;
            }
          } catch (error: any) {
            // If we can't verify, treat as if it doesn't exist
            console.log(`Could not verify calendar event for task: ${taskData.title}. Will recreate.`);
            eventExistsInCalendar = false;
          }
        }

        // If event doesn't exist in calendar (either no ID or deleted), create a new one
        if (!eventExistsInCalendar) {
          console.log(`Creating calendar event for task: ${taskData.title}`);
          const result = await addGoogleCalendarEvent({
            userId,
            task: {
              title: taskData.title,
              description: taskData.description || "",
              dueDate: dueDate,
              priority: taskData.priority || "medium",
              hasTime: taskData.hasTime,
            },
          });

          // Update/Store the calendar event ID in Firestore
          if (result.eventId) {
            await docSnap.ref.update({ calendarEventId: result.eventId });
          }
          added++;
        }
      } catch (error: any) {
        failed++;
        errors.push(`${taskData.title}: ${error.message}`);
        console.error(`Failed to sync task "${taskData.title}":`, error);
      }
    }

    const resultParts = [];
    if (added > 0) resultParts.push(`${added} task(s) added to calendar`);
    if (verified > 0) resultParts.push(`${verified} task(s) verified`);
    if (skipped > 0) resultParts.push(`${skipped} task(s) skipped (no due date)`);
    if (failed > 0) resultParts.push(`${failed} task(s) failed`);

    return {
      success: true,
      added,
      verified,
      skipped,
      failed,
      errors: failed > 0 ? errors : undefined,
      message: resultParts.length > 0 ? resultParts.join(', ') + '.' : 'Sync completed.'
    };

  } catch (error: any) {
    console.error("Error syncing tasks to calendar:", error);
    return {
      success: false,
      error: error.message || "Failed to sync tasks to Google Calendar."
    };
  }
}
