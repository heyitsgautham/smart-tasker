"use client";

import { useState, useEffect, useMemo, useCallback } from 'react';
import { collection, query, where, onSnapshot, doc, updateDoc, deleteDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import Header from '@/components/dashboard/Header';
import TaskList from '@/components/dashboard/TaskList';
import AddTaskDialog from '@/components/dashboard/AddTaskDialog';
import EditTaskDialog from '@/components/dashboard/EditTaskDialog';
import type { Task, TaskPriority } from '@/lib/types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { LayoutGrid, List } from 'lucide-react';
import DeleteConfirmationDialog from '@/components/dashboard/DeleteConfirmationDialog';
import { scheduleTaskNotification, deleteCalendarEventAction } from './actions';
import { useToast } from '@/hooks/use-toast';

type StatusFilter = "all" | "pending" | "completed";
type PriorityFilter = "all" | TaskPriority;
type SortOption = "createdAt" | "dueDate" | "priority";
type ViewMode = "grid" | "list";

export default function Home() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>("all");
  const [sortOption, setSortOption] = useState<SortOption>("createdAt");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");

  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [deletingTask, setDeletingTask] = useState<Task | null>(null);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    };

    setLoading(true);
    const q = query(collection(db, "tasks"), where("userId", "==", user.uid));

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const tasksData: Task[] = [];
      querySnapshot.forEach((doc) => {
        tasksData.push({ id: doc.id, ...doc.data() } as Task);
      });
      setTasks(tasksData);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  // Effect for checking reminders with optimized timing
  useEffect(() => {
    if (!user) return;

    // Track which tasks have already had notifications sent in this session
    const notifiedTaskIds = new Set<string>();
    let intervalId: NodeJS.Timeout | null = null;
    let timeoutId: NodeJS.Timeout | null = null;

    const checkReminders = async () => {
      // First check if user is subscribed to notifications
      if ('serviceWorker' in navigator) {
        try {
          const registration = await navigator.serviceWorker.ready;
          const subscription = await registration.pushManager.getSubscription();
          if (!subscription) {
            // User is not subscribed, skip notification checks
            return;
          }
        } catch (error) {
          console.error("Error checking subscription status:", error);
          return;
        }
      } else {
        // Service workers not supported, can't send notifications
        return;
      }

      const now = new Date();
      const pendingTasks = tasks.filter(t =>
        !t.completed &&
        t.dueDate &&
        !t.notificationSent &&
        !notifiedTaskIds.has(t.id) // Don't re-send if already sent in this session
      );

      for (const task of pendingTasks) {
        if (!task.dueDate) continue;

        const dueDate = task.dueDate.toDate();
        let reminderTime = null;

        switch (task.reminder) {
          case 'on-time':
            reminderTime = dueDate;
            break;
          case '10-min-before':
            reminderTime = new Date(dueDate.getTime() - 10 * 60 * 1000);
            break;
          case '1-hour-before':
            reminderTime = new Date(dueDate.getTime() - 60 * 60 * 1000);
            break;
          default:
            continue; // No reminder for this task
        }

        // Calculate how much time until the reminder
        const timeUntilReminder = reminderTime.getTime() - now.getTime();

        // Send notification if we're within 30 seconds before the reminder time
        // This gives us a buffer to send early, but not too early
        // The notification will arrive right at or slightly before the scheduled time
        const shouldSend = timeUntilReminder <= 30000 && timeUntilReminder >= -5000; // -5s to +30s window

        // Mark as missed if we're more than 5 minutes past
        const isMissed = timeUntilReminder < -5 * 60 * 1000;

        if (shouldSend) {
          console.log(`⏰ Sending reminder for task: ${task.title}`);
          console.log(`📅 Due time: ${reminderTime.toLocaleString()}`);
          console.log(`🕐 Current time: ${now.toLocaleString()}`);
          console.log(`⏱️  Time to due: ${(timeUntilReminder / 1000).toFixed(1)}s`);

          // Mark as notified immediately to prevent duplicate sends
          notifiedTaskIds.add(task.id);

          const { success, error } = await scheduleTaskNotification({
            ...task,
            dueDate: task.dueDate.toDate().toISOString(),
            createdAt: task.createdAt.toDate().toISOString(),
          }, user.uid);

          if (success) {
            console.log(`✅ Notification sent successfully for task: ${task.title}`);
            // Mark notification as sent in Firestore
            const taskDoc = doc(db, "tasks", task.id);
            await updateDoc(taskDoc, { notificationSent: true });
          } else if (error) {
            console.error(`❌ Failed to send reminder for task "${task.title}":`, error);
            // Remove from notified set if sending failed, so it can be retried
            notifiedTaskIds.delete(task.id);
          }
        } else if (isMissed) {
          // If we're more than 5 minutes past the reminder time, mark it as missed
          console.log(`⏭️  Missed notification window for task: ${task.title}`);
          const taskDoc = doc(db, "tasks", task.id);
          await updateDoc(taskDoc, { notificationSent: true });
          notifiedTaskIds.add(task.id);
        }
      }
    };

    // Smart scheduling: align checks to the start of each minute
    const scheduleNextCheck = () => {
      const now = new Date();
      const seconds = now.getSeconds();
      const milliseconds = now.getMilliseconds();

      // Calculate milliseconds until the next minute starts
      const msUntilNextMinute = (60 - seconds) * 1000 - milliseconds;

      console.log(`⏲️  Next reminder check in ${(msUntilNextMinute / 1000).toFixed(1)}s (at ${new Date(now.getTime() + msUntilNextMinute).toLocaleTimeString()})`);

      // Schedule check at the start of the next minute
      timeoutId = setTimeout(() => {
        checkReminders();

        // After first aligned check, set up interval for every minute
        intervalId = setInterval(checkReminders, 60000);
      }, msUntilNextMinute);
    };

    // Check immediately on mount (might catch tasks due right now)
    checkReminders();

    // Schedule aligned checks
    scheduleNextCheck();

    return () => {
      if (intervalId) clearInterval(intervalId);
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [tasks, user]);


  const filteredAndSortedTasks = useMemo(() => {
    let filtered = [...tasks];

    // Filter by status
    if (statusFilter !== "all") {
      filtered = filtered.filter(task =>
        statusFilter === "pending" ? !task.completed : task.completed
      );
    }

    // Filter by priority
    if (priorityFilter !== "all") {
      filtered = filtered.filter(task => task.priority === priorityFilter);
    }

    const priorityOrder: Record<TaskPriority, number> = { high: 2, medium: 1, low: 0 };

    // Sort
    filtered.sort((a, b) => {
      if (sortOption === "priority") {
        return priorityOrder[b.priority] - priorityOrder[a.priority];
      }
      if (sortOption === "createdAt") {
        return b.createdAt.toMillis() - a.createdAt.toMillis();
      }
      if (sortOption === "dueDate") {
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return a.dueDate.toMillis() - b.dueDate.toMillis();
      }
      return 0;
    });

    return filtered;
  }, [tasks, statusFilter, priorityFilter, sortOption]);

  const handleTaskUpdate = async (id: string, updates: Partial<Task>) => {
    // Optimistic UI update: Update state immediately
    setTasks(prevTasks => 
      prevTasks.map(task => 
        task.id === id ? { ...task, ...updates } : task
      )
    );

    // Background operation: Update Firestore
    try {
      const taskDoc = doc(db, "tasks", id);
      await updateDoc(taskDoc, updates);
    } catch (error) {
      console.error("Failed to update task:", error);
      // Revert on error - Firestore snapshot listener will restore correct state
      toast({
        variant: "destructive",
        title: "Update Failed",
        description: "Failed to update task. Please try again.",
      });
    }
  };

  const confirmTaskDelete = async () => {
    if (!deletingTask || !user) return;

    const taskToDelete = deletingTask;
    
    // Optimistic UI update: Remove from state immediately
    setTasks(prevTasks => prevTasks.filter(t => t.id !== taskToDelete.id));
    setDeletingTask(null);

    // Show immediate feedback
    toast({
      title: "Task Deleted",
      description: `"${taskToDelete.title}" has been successfully deleted.`,
    });

    // Background operations: Delete from Firestore and calendar
    try {
      // Delete task from Firestore
      const taskDoc = doc(db, "tasks", taskToDelete.id);
      await deleteDoc(taskDoc);

      // Delete calendar event if it exists (in background)
      if (taskToDelete.calendarEventId) {
        deleteCalendarEventAction(taskToDelete.calendarEventId, user.uid).catch(error => {
          console.error("Failed to delete calendar event:", error);
        });
      }
    } catch (error) {
      console.error("Failed to delete task:", error);
      // Revert optimistic update on error
      setTasks(prevTasks => [...prevTasks, taskToDelete]);
      toast({
        variant: "destructive",
        title: "Deletion Failed",
        description: "Failed to delete task. Please try again.",
      });
    }
  };

  const handleEdit = (task: Task) => {
    setEditingTask(task);
  };

  const handleDeleteRequest = (task: Task) => {
    setDeletingTask(task);
  };

  const incompleteTasks = tasks.filter(task => !task.completed).length;

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <Header />
      <main className="flex-1 p-4 sm:p-6 lg:p-8">
        <div className="container mx-auto">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-4">
            <div className="flex items-baseline gap-4">
              <h1 className="text-2xl md:text-3xl font-headline font-bold tracking-tight">
                My Tasks
              </h1>
              {!loading && tasks.length > 0 && (
                <span className="bg-primary/20 text-primary-foreground font-bold px-3 py-1 rounded-full text-sm">
                  {incompleteTasks > 0 ? `${incompleteTasks} remaining` : 'All done!'}
                </span>
              )}
            </div>
            <AddTaskDialog />
          </div>

          <div className="flex items-center justify-between gap-4 mb-8 flex-wrap">
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-muted-foreground">Status:</span>
                <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as StatusFilter)}>
                  <SelectTrigger className="w-[120px]">
                    <SelectValue placeholder="Filter status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-muted-foreground">Priority:</span>
                <Select value={priorityFilter} onValueChange={(value) => setPriorityFilter(value as PriorityFilter)}>
                  <SelectTrigger className="w-[120px]">
                    <SelectValue placeholder="Filter priority" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Separator orientation="vertical" className="h-6" />

              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-muted-foreground">Sort by:</span>
                <Select value={sortOption} onValueChange={(value) => setSortOption(value as SortOption)}>
                  <SelectTrigger className="w-[150px]">
                    <SelectValue placeholder="Sort by" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="priority">Priority</SelectItem>
                    <SelectItem value="createdAt">Created Date</SelectItem>
                    <SelectItem value="dueDate">Due Date</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* View Switcher */}
            <div className="flex items-center gap-1 border rounded-lg p-1">
              <Button
                variant={viewMode === "grid" ? "secondary" : "ghost"}
                size="sm"
                className="h-8 w-8 p-0"
                onClick={() => setViewMode("grid")}
              >
                <LayoutGrid className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === "list" ? "secondary" : "ghost"}
                size="sm"
                className="h-8 w-8 p-0"
                onClick={() => setViewMode("list")}
              >
                <List className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <TaskList
            tasks={filteredAndSortedTasks}
            loading={loading}
            onTaskUpdate={handleTaskUpdate}
            onTaskDelete={handleDeleteRequest}
            onTaskEdit={handleEdit}
            viewMode={viewMode}
          />

          {editingTask && (
            <EditTaskDialog
              task={editingTask}
              isOpen={!!editingTask}
              onClose={() => setEditingTask(null)}
              onUpdate={handleTaskUpdate}
            />
          )}
          {deletingTask && (
            <DeleteConfirmationDialog
              isOpen={!!deletingTask}
              onClose={() => setDeletingTask(null)}
              onConfirm={confirmTaskDelete}
              taskName={deletingTask.title}
            />
          )}
        </div>
      </main>
    </div>
  );
}
