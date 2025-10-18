"use client";

import { useState } from "react";
import { Task } from "@/lib/types";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Calendar as CalendarIcon, Trash2, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TaskPriority } from "@/lib/types";
import { format, isToday, isTomorrow, isPast } from "date-fns";
import RescheduleDialog from "./RescheduleDialog";
import { Timestamp } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";

interface TaskListViewProps {
    tasks: Task[];
    onTaskUpdate: (id: string, updates: Partial<Task>) => void;
    onTaskDelete: (task: Task) => void;
    onTaskEdit: (task: Task) => void;
}

interface UndoState {
    previousDates: Record<string, Timestamp | null>;
    newDate: Timestamp | null;
}

const priorityStyles: Record<TaskPriority, string> = {
    high: "border-l-4 border-l-priority-high",
    medium: "border-l-4 border-l-priority-medium",
    low: "border-l-4 border-l-priority-low",
};

const priorityColors: Record<TaskPriority, string> = {
    high: "text-priority-high",
    medium: "text-priority-medium",
    low: "text-priority-low",
};

export default function TaskListView({ tasks, onTaskUpdate, onTaskDelete, onTaskEdit }: TaskListViewProps) {
    const { toast } = useToast();
    const [isRescheduleOpen, setIsRescheduleOpen] = useState(false);
    const [rescheduleGroup, setRescheduleGroup] = useState<Task[] | null>(null);
    const [undoState, setUndoState] = useState<UndoState | null>(null);

    const handleToggleComplete = (task: Task) => {
        onTaskUpdate(task.id, { completed: !task.completed });
    };

    const formatDateForDisplay = (date: Date | null): string => {
        if (!date) return "No Date";
        if (isToday(date)) return "Today";
        if (isTomorrow(date)) return "Tomorrow";
        return format(date, "MMM d");
    };

    const handleReschedule = (taskIds: string[], newDate: Date | null, hasTime?: boolean) => {
        // Store previous dates for undo
        const previousDates: Record<string, Timestamp | null> = {};
        taskIds.forEach(id => {
            const task = tasks.find(t => t.id === id);
            if (task) {
                previousDates[id] = task.dueDate;
            }
        });

        // Update tasks with new date
        taskIds.forEach(id => {
            onTaskUpdate(id, {
                dueDate: newDate ? Timestamp.fromDate(newDate) : null,
                hasTime: hasTime || false,
                notificationSent: false, // Reset notification status
            });
        });

        // Create display text for undo notification
        const displayText = `Date updated to ${formatDateForDisplay(newDate)}`;

        // Store undo state
        const undoData: UndoState = {
            previousDates,
            newDate: newDate ? Timestamp.fromDate(newDate) : null,
        };

        setUndoState(undoData);

        // Show toast with undo action
        toast({
            description: displayText,
            action: (
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleUndo(undoData)}
                    className="h-8"
                >
                    Undo
                </Button>
            ),
        });

        setIsRescheduleOpen(false);
        setRescheduleGroup(null);
    };

    const handleUndo = (undoData: UndoState) => {
        // Restore previous dates
        Object.entries(undoData.previousDates).forEach(([taskId, previousDate]) => {
            onTaskUpdate(taskId, {
                dueDate: previousDate,
                notificationSent: false,
            });
        });

        setUndoState(null);
    };

    const formatDueDate = (task: Task) => {
        if (!task.dueDate) return null;

        const date = task.dueDate.toDate();
        const isPastDue = isPast(date) && !isToday(date);

        const timeText = format(date, "h:mm a");

        return {
            timeText,
            isPastDue,
        };
    };

    // Group tasks by date
    const groupedTasks = tasks.reduce((acc, task) => {
        if (!task.dueDate) {
            if (!acc["No Date"]) acc["No Date"] = [];
            acc["No Date"].push(task);
            return acc;
        }

        const date = task.dueDate.toDate();
        let groupKey = "";

        if (isToday(date)) {
            groupKey = "Today";
        } else if (isTomorrow(date)) {
            groupKey = "Tomorrow";
        } else if (isPast(date) && !task.completed) {
            groupKey = "Overdue";
        } else {
            groupKey = format(date, "MMM d, yyyy");
        }

        if (!acc[groupKey]) acc[groupKey] = [];
        acc[groupKey].push(task);
        return acc;
    }, {} as Record<string, Task[]>);

    const sortedGroups = Object.keys(groupedTasks).sort((a, b) => {
        const order = ["Overdue", "Today", "Tomorrow"];
        const aIndex = order.indexOf(a);
        const bIndex = order.indexOf(b);

        if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
        if (aIndex !== -1) return -1;
        if (bIndex !== -1) return 1;
        if (a === "No Date") return 1;
        if (b === "No Date") return -1;
        return a.localeCompare(b);
    });

    return (
        <div className="max-w-5xl mx-auto">
            <div className="space-y-6">
                {sortedGroups.map((groupKey) => {
                    const groupTasks = groupedTasks[groupKey];
                    const completedCount = groupTasks.filter(t => t.completed).length;
                    const totalCount = groupTasks.length;

                    return (
                        <div key={groupKey} className="space-y-2">
                            {/* Group Header */}
                            <div className="flex items-center justify-between py-2">
                                <h2 className="font-bold text-xl flex items-center gap-2">
                                    {groupKey === "Overdue" && (
                                        <span className="text-priority-high">{groupKey}</span>
                                    )}
                                    {groupKey !== "Overdue" && groupKey}
                                    <span className="text-sm text-muted-foreground font-normal">
                                        {completedCount}/{totalCount}
                                    </span>
                                </h2>
                                {groupKey === "Overdue" && (
                                    <RescheduleDialog
                                        trigger={
                                            <Button
                                                variant="default"
                                                size="sm"
                                                className="bg-link hover:bg-link-hover text-white font-bold"
                                                onClick={() => {
                                                    setRescheduleGroup(groupTasks.filter(t => !t.completed));
                                                    setIsRescheduleOpen(true);
                                                }}
                                            >
                                                Reschedule
                                            </Button>
                                        }
                                        tasks={rescheduleGroup || []}
                                        isOpen={isRescheduleOpen}
                                        onOpenChange={setIsRescheduleOpen}
                                        onReschedule={handleReschedule}
                                    />
                                )}
                            </div>

                            {/* Tasks */}
                            <div className="space-y-1">
                                {groupTasks.map((task) => {
                                    const dueDateInfo = formatDueDate(task);

                                    return (
                                        <div
                                            key={task.id}
                                            className={cn(
                                                "group flex items-center gap-3 p-3 rounded-lg bg-white/55 hover:bg-accent/30 transition-colors border border-border cursor-pointer",
                                                task.completed && "bg-orange-50/50",
                                                priorityStyles[task.priority]
                                            )}
                                            onClick={() => onTaskEdit(task)}
                                        >
                                            {/* Checkbox */}
                                            <Checkbox
                                                checked={task.completed}
                                                onCheckedChange={() => handleToggleComplete(task)}
                                                className="flex-shrink-0"
                                                onClick={(e) => e.stopPropagation()}
                                            />

                                            {/* Task Content */}
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <span
                                                        className={cn(
                                                            "font-bold text-base",
                                                            task.completed && "line-through text-muted-foreground"
                                                        )}
                                                    >
                                                        {task.title}
                                                    </span>
                                                </div>
                                                {task.description && (
                                                    <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                                                        {task.description}
                                                    </p>
                                                )}
                                            </div>

                                            {/* Due Time */}
                                            {dueDateInfo && (
                                                <div className="flex-shrink-0 hidden sm:flex items-center gap-1">
                                                    <span
                                                        className={cn(
                                                            "text-sm font-semibold",
                                                            dueDateInfo.isPastDue ? "text-priority-high" : "text-foreground"
                                                        )}
                                                    >
                                                        {dueDateInfo.timeText}
                                                    </span>
                                                </div>
                                            )}

                                            {/* Actions */}
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                                                        onClick={(e) => e.stopPropagation()}
                                                    >
                                                        <MoreHorizontal className="h-4 w-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuItem onClick={(e) => {
                                                        e.stopPropagation();
                                                        onTaskEdit(task);
                                                    }}>
                                                        <Pencil className="mr-2 h-4 w-4" />
                                                        Edit
                                                    </DropdownMenuItem>
                                                    <DropdownMenuSeparator />
                                                    <DropdownMenuItem
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            onTaskDelete(task);
                                                        }}
                                                        className="text-destructive"
                                                    >
                                                        <Trash2 className="mr-2 h-4 w-4" />
                                                        Delete
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
