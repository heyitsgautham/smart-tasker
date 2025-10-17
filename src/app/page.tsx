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
import { scheduleTaskNotification } from './actions';
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

  // Effect for checking reminders
  useEffect(() => {
    if (!user) return;

    const checkReminders = async () => {
      const now = new Date();
      const pendingTasks = tasks.filter(t => !t.completed && t.dueDate && !t.notificationSent);

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

        if (now >= reminderTime) {
          console.log(`Sending reminder for task: ${task.title}`);
          const { success, error } = await scheduleTaskNotification({
            ...task,
            dueDate: task.dueDate.toDate().toISOString(),
            createdAt: task.createdAt.toDate().toISOString(),
          }, user.uid);

          if (success) {
            // Mark notification as sent
            const taskDoc = doc(db, "tasks", task.id);
            await updateDoc(taskDoc, { notificationSent: true });
          } else if (error) {
            console.error(`Failed to send reminder for task "${task.title}":`, error);
          }
        }
      }
    };

    const intervalId = setInterval(checkReminders, 1000); // Check every second

    return () => clearInterval(intervalId);
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
    const taskDoc = doc(db, "tasks", id);
    await updateDoc(taskDoc, updates);
  };

  const confirmTaskDelete = async () => {
    if (!deletingTask) return;
    const taskDoc = doc(db, "tasks", deletingTask.id);
    await deleteDoc(taskDoc);
    toast({
      title: "Task Deleted",
      description: `"${deletingTask.title}" has been successfully deleted.`,
    });
    setDeletingTask(null);
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
