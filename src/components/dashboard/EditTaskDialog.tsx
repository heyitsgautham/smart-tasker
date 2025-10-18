"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { CalendarIcon, Loader2, Sparkles, X } from "lucide-react";
import { doc, updateDoc, Timestamp } from "firebase/firestore";
import { setHours, setMinutes, format } from "date-fns";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SmartTextarea } from "@/components/ui/smart-textarea";
import { useToast } from "@/hooks/use-toast";
import { cn, formatDate } from "@/lib/utils";
import { db } from "@/lib/firebase";
import {
  getPrioritySuggestion,
  addCalendarEventAction,
  updateCalendarEventAction,
  deleteCalendarEventAction
} from "@/app/actions";
import type { Task, ReminderOption } from "@/lib/types";
import { useAuth } from "@/context/AuthContext";

const formSchema = z.object({
  title: z.string().min(1, { message: "Title is required." }).max(50, { message: "Title must be 50 characters or less." }),
  description: z.string().optional(),
  dueDate: z.date().optional().nullable(),
  dueTime: z.string().optional(),
  priority: z.enum(["low", "medium", "high"]),
  reminder: z.enum(["none", "on-time", "10-min-before", "1-hour-before"]),
});

type EditTaskFormValues = z.infer<typeof formSchema>;

interface EditTaskDialogProps {
  task: Task;
  isOpen: boolean;
  onClose: () => void;
}

export default function EditTaskDialog({ task, isOpen, onClose }: EditTaskDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [autoDetectedDate, setAutoDetectedDate] = useState(false);
  const [manuallySetTime, setManuallySetTime] = useState(false);
  const isInitializing = useRef(false);
  const { toast } = useToast();
  const { user } = useAuth();

  const form = useForm<EditTaskFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: "",
      description: "",
      dueDate: null,
      dueTime: "",
      priority: "medium",
      reminder: "10-min-before",
    },
  });

  // Watch dueDate to control time field
  const watchedDueDate = form.watch("dueDate");

  // Initialize form when dialog opens
  useEffect(() => {
    if (task && isOpen) {
      isInitializing.current = true;

      const dueDate = task.dueDate ? task.dueDate.toDate() : null;
      const dueTime = (task.hasTime && task.dueDate)
        ? format(task.dueDate.toDate(), 'HH:mm')
        : "";

      form.reset({
        title: task.title,
        description: task.description || "",
        dueDate: dueDate,
        dueTime: dueTime,
        priority: task.priority,
        reminder: task.reminder || '10-min-before',
      });

      // Set manuallySetTime based on whether task has time
      setManuallySetTime(!!task.hasTime);

      // Allow auto-clear after a short delay
      setTimeout(() => {
        isInitializing.current = false;
      }, 100);
    }
  }, [task, isOpen, form]);

  // Clear time when date is removed (but not during initialization)
  useEffect(() => {
    if (!isInitializing.current && !watchedDueDate && form.getValues("dueTime")) {
      form.setValue("dueTime", "");
    }
  }, [watchedDueDate, form]);

  const handleSuggestPriority = async () => {
    const description = form.getValues("description");
    if (!description) {
      toast({
        variant: "destructive",
        title: "Cannot Suggest Priority",
        description: "Please enter a description for the task first.",
      });
      return;
    }

    setIsSuggesting(true);
    try {
      const result = await getPrioritySuggestion(description);
      if (result.priority) {
        form.setValue("priority", result.priority);
        toast({
          title: "AI Suggestion",
          description: `Priority set to "${result.priority}".`,
        });
      } else if (result.error) {
        toast({
          variant: "destructive",
          title: "AI Suggestion Failed",
          description: result.error,
        });
      }
    } finally {
      setIsSuggesting(false);
    }
  };

  const handleClearDate = useCallback(() => {
    form.setValue("dueDate", null);
    form.setValue("dueTime", "");
    setAutoDetectedDate(false);
    setManuallySetTime(false);
  }, [form]);

  const handleClearTime = useCallback(() => {
    form.setValue("dueTime", "");
    setManuallySetTime(false);
  }, [form]);

  const handleDateDetected = useCallback((date: Date | null) => {
    // Don't auto-update during initial load or if user manually set time via time field
    if (date && !isInitializing.current && !manuallySetTime) {
      form.setValue("dueDate", date);
      form.setValue("dueTime", format(date, 'HH:mm'));
    }
  }, [manuallySetTime, form]);

  async function onSubmit(values: EditTaskFormValues) {
    if (!user) {
      toast({ variant: "destructive", title: "You must be logged in." });
      return;
    }

    setIsSubmitting(true);
    try {
      // Build the due date with optional time
      let dueDateTimestamp: Timestamp | null = null;
      const hasExplicitTime = Boolean(values.dueTime?.trim());

      if (values.dueDate) {
        let dateWithTime = new Date(values.dueDate);

        if (hasExplicitTime && values.dueTime) {
          const [hours, minutes] = values.dueTime.split(':').map(Number);
          dateWithTime = setMinutes(setHours(dateWithTime, hours), minutes);
        } else {
          // If no time specified, set to start of day
          dateWithTime.setHours(0, 0, 0, 0);
        }

        dueDateTimestamp = Timestamp.fromDate(dateWithTime);
      }

      // Prepare task data update
      const updatedTaskData: Partial<Task> = {
        title: values.title,
        description: values.description || "",
        priority: values.priority,
        reminder: values.reminder as ReminderOption,
        dueDate: dueDateTimestamp,
        hasTime: hasExplicitTime,
        notificationSent: false,
      };

      const taskDoc = doc(db, "tasks", task.id);

      // Handle calendar event synchronization
      const hadCalendarEvent = Boolean(task.calendarEventId);
      const willHaveDate = Boolean(dueDateTimestamp);
      const hadDate = Boolean(task.dueDate);

      if (willHaveDate) {
        // Task has/will have a due date
        const serializableTask = {
          id: task.id,
          userId: task.userId,
          title: values.title,
          description: values.description || "",
          priority: values.priority,
          reminder: values.reminder as ReminderOption,
          dueDate: dueDateTimestamp!.toDate().toISOString(),
          hasTime: hasExplicitTime,
          completed: task.completed,
          createdAt: task.createdAt.toDate().toISOString(),
          notificationSent: false,
          calendarEventId: task.calendarEventId,
        };

        if (hadCalendarEvent) {
          // Update existing calendar event
          const result = await updateCalendarEventAction(serializableTask, user.uid);
          if (result?.error) {
            console.error("Failed to update calendar event:", result.error);
            toast({
              variant: "destructive",
              title: "Calendar sync failed",
              description: "Task updated but calendar event sync failed.",
            });
          }
        } else {
          // Create new calendar event
          const result = await addCalendarEventAction(serializableTask, user.uid);
          if (result?.success && result.eventId) {
            updatedTaskData.calendarEventId = result.eventId;
          } else if (result?.error) {
            console.error("Failed to add calendar event:", result.error);
          }
        }
      } else if (hadCalendarEvent) {
        // Date was removed - delete the calendar event
        const result = await deleteCalendarEventAction(task.calendarEventId!, user.uid);
        if (result?.success) {
          (updatedTaskData as any).calendarEventId = null;
        } else if (result?.error) {
          console.error("Failed to delete calendar event:", result.error);
        }
      }

      // Update task in Firestore
      await updateDoc(taskDoc, updatedTaskData as any);

      toast({
        title: "Task Updated",
        description: `"${values.title}" has been updated.`,
      });

      onClose();
    } catch (error) {
      console.error("Failed to update task:", error);
      toast({
        variant: "destructive",
        title: "Failed to update task.",
        description: error instanceof Error ? error.message : "Unknown error"
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="font-headline">Edit Task</DialogTitle>
          <DialogDescription>
            Update the details of your task below.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
            {/* Title Field */}
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Title</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="e.g., Finalize project report"
                      maxLength={50}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Description Field */}
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description (try typing dates like "tomorrow at 3pm")</FormLabel>
                  <FormControl>
                    <SmartTextarea
                      placeholder="Add more details..."
                      {...field}
                      value={field.value || ""}
                      onChange={(e) => {
                        // When user types in description, allow auto-detection again
                        if (!isInitializing.current) {
                          setManuallySetTime(false);
                        }
                        field.onChange(e);
                      }}
                      onDateDetected={handleDateDetected}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Due Date and Time */}
            <div className="grid grid-cols-2 gap-4">
              {/* Due Date */}
              <FormField
                control={form.control}
                name="dueDate"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Due Date</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-full pl-3 text-left font-normal",
                              !field.value && "text-muted-foreground"
                            )}
                          >
                            {field.value ? (
                              formatDate(field.value, 'PPP')
                            ) : (
                              <span>Pick a date</span>
                            )}
                            {field.value ? (
                              <span
                                className="ml-auto inline-flex h-5 w-5 items-center justify-center rounded-sm hover:bg-destructive/10 cursor-pointer shrink-0"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  handleClearDate();
                                }}
                              >
                                <X className="h-4 w-4" />
                              </span>
                            ) : (
                              <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            )}
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value || undefined}
                          onSelect={field.onChange}
                          disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Due Time */}
              <FormField
                control={form.control}
                name="dueTime"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Time (optional)</FormLabel>
                    <div className="relative">
                      <FormControl>
                        <Input
                          type="time"
                          disabled={!watchedDueDate}
                          {...field}
                          value={field.value || ""}
                          className="h-10"
                          onChange={(e) => {
                            // Mark that user manually set the time
                            setManuallySetTime(true);
                            field.onChange(e.target.value);
                          }}
                        />
                      </FormControl>
                      {field.value && watchedDueDate && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="absolute right-0 top-0 h-10 w-8 p-0 hover:bg-destructive/10"
                          onClick={handleClearTime}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Priority Field */}
            <FormField
              control={form.control}
              name="priority"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Priority</FormLabel>
                  <div className="flex gap-2">
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select priority" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={handleSuggestPriority}
                      disabled={isSuggesting}
                    >
                      {isSuggesting ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Sparkles className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Reminder Field */}
            <FormField
              control={form.control}
              name="reminder"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Reminder</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Set a reminder" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      <SelectItem value="on-time">On time</SelectItem>
                      <SelectItem value="10-min-before">10 minutes before</SelectItem>
                      <SelectItem value="1-hour-before">1 hour before</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Submit Button */}
            <DialogFooter>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Changes
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
