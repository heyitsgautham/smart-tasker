import type { Timestamp } from 'firebase/firestore';

export type TaskPriority = 'low' | 'medium' | 'high';
export type ReminderOption = 'none' | 'on-time' | '10-min-before' | '1-hour-before';

export interface Task {
  id: string;
  userId: string;
  title: string;
  description: string;
  dueDate: Timestamp | null;
  hasTime?: boolean; // Track if a specific time was set (not just a date)
  priority: TaskPriority;
  reminder: ReminderOption;
  completed: boolean;
  createdAt: Timestamp;
  notificationSent?: boolean;
  calendarEventId?: string;
}
