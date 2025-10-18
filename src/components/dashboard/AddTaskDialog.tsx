"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { CalendarIcon, Loader2, Sparkles, X } from "lucide-react";
import { addDoc, collection, Timestamp, updateDoc } from "firebase/firestore";
import { setHours, setMinutes } from "date-fns";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SmartTextarea } from "@/components/ui/smart-textarea";
import { useToast } from "@/hooks/use-toast";
import { cn, formatDate } from "@/lib/utils";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { getPrioritySuggestion, addCalendarEventAction } from "@/app/actions";
import type { ReminderOption } from "@/lib/types";

const formSchema = z.object({
  title: z.string().min(1, { message: "Title is required." }).max(50, { message: "Title must be 50 characters or less." }),
  description: z.string().optional(),
  dueDate: z.date().optional().nullable(),
  dueTime: z.string().optional(),
  priority: z.enum(["low", "medium", "high"]),
  reminder: z.enum(["none", "on-time", "10-min-before", "1-hour-before"]),
});

type AddTaskFormValues = z.infer<typeof formSchema>;

export default function AddTaskDialog() {
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [autoDetectedDate, setAutoDetectedDate] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  const form = useForm<AddTaskFormValues>({
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

  // Clear time when date is removed
  useEffect(() => {
    if (!watchedDueDate && form.getValues("dueTime")) {
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

  const handleClearDate = () => {
    form.setValue("dueDate", null);
    form.setValue("dueTime", "");
    setAutoDetectedDate(false);
  };

  const handleClearTime = () => {
    form.setValue("dueTime", "");
  };

  const handleDateDetected = (date: Date | null) => {
    // Only auto-fill if user hasn't manually set a date
    if (date && !autoDetectedDate && !form.getValues("dueDate")) {
      form.setValue("dueDate", date);
      const timeStr = date.toTimeString().slice(0, 5); // HH:MM format
      if (timeStr !== "00:00") {
        form.setValue("dueTime", timeStr);
      }
      setAutoDetectedDate(true);
    }
  };

  async function onSubmit(values: AddTaskFormValues) {
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

      // Create new task
      const newTask = {
        userId: user.uid,
        title: values.title,
        description: values.description || "",
        priority: values.priority,
        reminder: values.reminder as ReminderOption,
        dueDate: dueDateTimestamp,
        hasTime: hasExplicitTime,
        completed: false,
        createdAt: Timestamp.now(),
        notificationSent: false,
      };

      const docRef = await addDoc(collection(db, "tasks"), newTask);

      // Add to calendar if has due date
      if (dueDateTimestamp) {
        const serializableTask = {
          id: docRef.id,
          ...newTask,
          dueDate: dueDateTimestamp.toDate().toISOString(),
          createdAt: newTask.createdAt.toDate().toISOString(),
        };

        const result = await addCalendarEventAction(serializableTask, user.uid);
        if (result?.success && result.eventId) {
          // Store calendar event ID
          await updateDoc(docRef, { calendarEventId: result.eventId });
        } else if (result?.error) {
          console.error("Failed to add to Google Calendar:", result.error);
          // Don't show error to user - task is still created
        }
      }

      toast({
        title: "Task Added",
        description: `"${values.title}" has been added to your list.`,
      });

      form.reset();
      setAutoDetectedDate(false);
      setOpen(false);
    } catch (error) {
      console.error("Failed to add task:", error);
      toast({
        variant: "destructive",
        title: "Failed to add task.",
        description: error instanceof Error ? error.message : "Unknown error"
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Add Task</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="font-headline">Add a New Task</DialogTitle>
          <DialogDescription>
            Fill in the details below to add a new task to your list.
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
                          onSelect={(date) => {
                            field.onChange(date);
                            setAutoDetectedDate(false); // User manually selected
                          }}
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
                Add Task
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
