
"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { CalendarIcon, Loader2, Sparkles } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { cn, formatDate } from "@/lib/utils";
import { db } from "@/lib/firebase";
import { getPrioritySuggestion, addCalendarEventAction } from "@/app/actions";
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
    if (task) {
      form.reset({
        title: task.title,
        description: task.description,
        priority: task.priority,
        reminder: task.reminder || '10-min-before',
        dueDate: task.dueDate ? task.dueDate.toDate() : undefined,
        dueTime: task.dueDate ? format(task.dueDate.toDate(), 'HH:mm') : undefined
      });
    }
  }, [task, form]);

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
      if (values.dueDate) {
        dueDateWithTime = values.dueDate;
        if (values.dueTime) {
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
        notificationSent: false, // Reset notification status on edit
      };

      const taskDoc = doc(db, "tasks", task.id);
      await updateDoc(taskDoc, updatedTaskData);

      if (dueDateWithTime) {
        const serializableTask = {
          ...task,
          ...updatedTaskData,
          dueDate: dueDateWithTime.toISOString(),
          createdAt: task.createdAt.toDate().toISOString(),
        };
        addCalendarEventAction(serializableTask, user.uid).then(result => {
          if (result?.error) {
            console.error("Failed to update Google Calendar event:", result.error);
          }
        });
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
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Add more details about your task..." className="resize-none" {...field} />
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
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant={"outline"}
                            className={cn(
                              "pl-3 text-left font-normal",
                              !field.value && "text-muted-foreground"
                            )}
                          >
                            {field.value ? formatDate(field.value, 'PPP') : <span>Pick a date</span>}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value}
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
              <FormField
                control={form.control}
                name="dueTime"
                render={({ field }) => (
                  <FormItem className="flex flex-col justify-end">
                    <FormLabel>Due Time</FormLabel>
                    <FormControl>
                      <Input type="time" {...field} value={field.value || ''} className="h-10" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
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
            <Button type="button" variant="outline" size="sm" className="w-full gap-2" onClick={handleSuggestPriority} disabled={isSuggesting}>
              {isSuggesting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4 text-accent" />}
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
