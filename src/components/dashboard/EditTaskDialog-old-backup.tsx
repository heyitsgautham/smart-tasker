
"use client";

import { useState, useEffect } from "react";
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
import { getPrioritySuggestion, addCalendarEventAction, updateCalendarEventAction } from "@/app/actions";
import type { Task, ReminderOption } from "@/lib/types";
import { useAuth } from "@/context/AuthContext";

const formSchema = z.object({
  title: z.string().min(1, { message: "Title is required." }).max(50, { message: "Title must be 50 characters or less." }),
  description: z.string().optional(),
  dueDate: z.date().optional(),
  dueTime: z.string().optional().refine((time) => {
    if (!time) return true;
    return /^([01]\d|2[0-3]):([0-5]\d)$/.test(time);
  }, { message: "Invalid time format (HH:MM)." }),
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
  const [manuallySetTime, setManuallySetTime] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [hasDueDate, setHasDueDate] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  const form = useForm<EditTaskFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: "",
      description: "",
      priority: "medium",
      reminder: "10-min-before",
    },
  });

  useEffect(() => {
    if (task && isOpen) {
      const dueDate = task.dueDate ? task.dueDate.toDate() : undefined;
      setHasDueDate(!!dueDate);
      
      form.reset({
        title: task.title,
        description: task.description,
        priority: task.priority,
        reminder: task.reminder || '10-min-before',
        dueDate: dueDate,
        dueTime: task.hasTime && task.dueDate ? format(task.dueDate.toDate(), 'HH:mm') : ""
      });
      // If task has a due date/time, mark it as manually set to prevent auto-override
      setManuallySetTime(!!task.hasTime);
      setIsInitialLoad(true);

      // After a short delay, allow auto-detection for new edits
      setTimeout(() => {
        setIsInitialLoad(false);
      }, 100);
    }
  }, [task, isOpen, form]);

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
    const result = await getPrioritySuggestion(description);
    if (result.priority) {
      form.setValue("priority", result.priority);
      toast({
        title: "AI Suggestion",
        description: `Priority automatically set to "${result.priority}".`,
      });
    } else if (result.error) {
      toast({
        variant: "destructive",
        title: "AI Suggestion Failed",
        description: result.error,
      });
    }
    setIsSuggesting(false);
  };

  async function onSubmit(values: EditTaskFormValues) {
    if (!user) {
      toast({ variant: "destructive", title: "You must be logged in." });
      return;
    }
    setIsSubmitting(true);
    try {
      let dueDateWithTime: Date | null = null;
      const hasExplicitTime = !!(values.dueTime && values.dueTime.trim() !== '');
      
      if (values.dueDate) {
        dueDateWithTime = values.dueDate;
        if (hasExplicitTime && values.dueTime) {
          const [hours, minutes] = values.dueTime.split(':').map(Number);
          dueDateWithTime = setMinutes(setHours(dueDateWithTime, hours), minutes);
        }
      }

      const updatedTaskData = {
        title: values.title,
        description: values.description || "",
        priority: values.priority,
        reminder: values.reminder as ReminderOption,
        dueDate: dueDateWithTime ? Timestamp.fromDate(dueDateWithTime) : null,
        hasTime: hasExplicitTime,
        notificationSent: false, // Reset notification status on edit
      };

      const taskDoc = doc(db, "tasks", task.id);
      await updateDoc(taskDoc, updatedTaskData);

      // Handle calendar event synchronization
      if (dueDateWithTime) {
        const serializableTask = {
          ...task,
          ...updatedTaskData,
          dueDate: dueDateWithTime.toISOString(),
          createdAt: task.createdAt.toDate().toISOString(),
        };

        console.log('EditTaskDialog - Task has calendarEventId:', task.calendarEventId);
        console.log('EditTaskDialog - Serializable task:', serializableTask);

        if (task.calendarEventId) {
          // Update existing calendar event
          console.log('EditTaskDialog - Updating existing calendar event');
          updateCalendarEventAction(serializableTask, user.uid).then(result => {
            if (result?.error) {
              console.error("Failed to update Google Calendar event:", result.error);
            } else {
              console.log("Successfully updated calendar event");
            }
          });
        } else {
          // Add new calendar event
          console.log('EditTaskDialog - Adding new calendar event');
          addCalendarEventAction(serializableTask, user.uid).then(async (result) => {
            if (result?.success && result.eventId) {
              // Update the task with the calendar event ID
              console.log('EditTaskDialog - Storing calendar event ID:', result.eventId);
              await updateDoc(taskDoc, { calendarEventId: result.eventId });
            } else if (result?.error) {
              console.error("Failed to add to Google Calendar:", result.error);
            }
          });
        }
      } else if (!dueDateWithTime && task.calendarEventId) {
        // Due date was removed, but we don't delete the calendar event
        // Just remove the calendarEventId from the task
        await updateDoc(taskDoc, { calendarEventId: null });
      }

      toast({
        title: "Task Updated",
        description: `"${values.title}" has been updated.`,
      });
      onClose();
    } catch (error) {
      console.error("Failed to update task:", error);
      toast({ variant: "destructive", title: "Failed to update task." });
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
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Title (max 50 characters)</FormLabel>
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
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description (try typing dates like "tomorrow at 3pm")</FormLabel>
                  <FormControl>
                    <SmartTextarea
                      placeholder="Add more details about your task..."
                      {...field}
                      onChange={(e) => {
                        // When user types in description, allow auto-detection again
                        if (!isInitialLoad) {
                          setManuallySetTime(false);
                        }
                        field.onChange(e);
                      }}
                      onDateDetected={(date) => {
                        // Don't auto-update during initial load or if user manually set time via time field
                        if (date && !isInitialLoad && !manuallySetTime) {
                          form.setValue("dueDate", date);
                          form.setValue("dueTime", format(date, 'HH:mm'));
                        }
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="dueDate"
                render={({ field }) => (
                  <FormItem className="flex flex-col justify-end">
                    <FormLabel>Due Date</FormLabel>
                    <div className="relative">
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant={"outline"}
                              className={cn(
                                "w-full pl-3 text-left font-normal",
                                !field.value && "text-muted-foreground"
                              )}
                            >
                              {field.value ? formatDate(field.value, 'PPP') : <span>Pick a date</span>}
                              {field.value ? (
                                <span
                                  className="ml-auto inline-flex h-5 w-5 items-center justify-center rounded-sm hover:bg-destructive/10 cursor-pointer shrink-0"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    field.onChange(undefined);
                                    form.setValue("dueTime", "");
                                    setHasDueDate(false);
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
                            selected={field.value}
                            onSelect={(date) => {
                              field.onChange(date);
                              setHasDueDate(!!date);
                            }}
                            disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="dueTime"
                render={({ field }) => {
                  return (
                    <FormItem className="flex flex-col justify-end">
                      <FormLabel>Due Time (Optional)</FormLabel>
                      <div className="relative">
                        <FormControl>
                          <Input
                            type="time"
                            value={field.value || ''}
                            className="h-10"
                            disabled={!hasDueDate}
                            onChange={(e) => {
                              // Mark that user manually set the time
                              setManuallySetTime(true);
                              field.onChange(e.target.value);
                            }}
                          />
                        </FormControl>
                        {field.value && hasDueDate && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="absolute right-0 top-0 h-10 w-8 p-0 hover:bg-destructive/10"
                            onClick={() => {
                              form.setValue("dueTime", "");
                              setManuallySetTime(false);
                            }}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                      <FormMessage />
                    </FormItem>
                  );
                }}
              />
            </div>
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
                      <SelectItem value="on-time">At time of due date</SelectItem>
                      <SelectItem value="10-min-before">10 minutes before</SelectItem>
                      <SelectItem value="1-hour-before">1 hour before</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="priority"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Priority</FormLabel>
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
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="button" variant="outline" size="sm" className="w-full gap-2 hover:bg-orange-500 hover:text-white hover:border-orange-500 transition-colors group" onClick={handleSuggestPriority} disabled={isSuggesting}>
              {isSuggesting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4 text-orange-500 group-hover:text-white transition-colors" />}
              Suggest Priority with AI
            </Button>
            <DialogFooter>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="animate-spin" /> : "Save Changes"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
