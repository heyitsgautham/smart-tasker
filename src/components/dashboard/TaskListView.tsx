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

interface TaskListViewProps {
    tasks: Task[];
    onTaskUpdate: (id: string, updates: Partial<Task>) => void;
    onTaskDelete: (task: Task) => void;
    onTaskEdit: (task: Task) => void;
}

const priorityStyles: Record<TaskPriority, string> = {
    high: "border-l-4 border-l-red-500",
    medium: "border-l-4 border-l-orange-500",
    low: "border-l-4 border-l-yellow-500",
};

const priorityColors: Record<TaskPriority, string> = {
    high: "text-red-600",
    medium: "text-orange-600",
    low: "text-yellow-600",
};

export default function TaskListView({ tasks, onTaskUpdate, onTaskDelete, onTaskEdit }: TaskListViewProps) {
    const [isRescheduleOpen, setIsRescheduleOpen] = useState(false);
    const [rescheduleGroup, setRescheduleGroup] = useState<Task[] | null>(null);

    const handleToggleComplete = (task: Task) => {
        onTaskUpdate(task.id, { completed: !task.completed });
    };

    const handleReschedule = (taskIds: string[], newDate: Date | null) => {
        taskIds.forEach(id => {
            onTaskUpdate(id, {
                dueDate: newDate ? Timestamp.fromDate(newDate) : null,
                notificationSent: false, // Reset notification status
            });
        });
        setIsRescheduleOpen(false);
        setRescheduleGroup(null);
    };

    const formatDueDate = (task: Task) => {
        if (!task.dueDate) return null;

        const date = task.dueDate.toDate();
        const isPastDue = isPast(date) && !isToday(date);

        let dateText = "";
        if (isToday(date)) {
            dateText = "Today";
        } else if (isTomorrow(date)) {
            dateText = "Tomorrow";
        } else {
            dateText = format(date, "MMM d");
        }

        const timeText = format(date, "h:mm a");

        return {
            text: `${dateText} ${timeText}`,
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
        <div className="space-y-6">
            {sortedGroups.map((groupKey) => {
                const groupTasks = groupedTasks[groupKey];
                const completedCount = groupTasks.filter(t => t.completed).length;
                const totalCount = groupTasks.length;

                return (
                    <div key={groupKey} className="space-y-2">
                        {/* Group Header */}
                        <div className="flex items-center justify-between py-2">
                            <h2 className="font-semibold text-sm flex items-center gap-2">
                                {groupKey === "Overdue" && (
                                    <span className="text-red-600">{groupKey}</span>
                                )}
                                {groupKey !== "Overdue" && groupKey}
                                <span className="text-xs text-muted-foreground font-normal">
                                    {completedCount}/{totalCount}
                                </span>
                            </h2>
                            {groupKey === "Overdue" && (
                                <RescheduleDialog
                                    trigger={
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
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
                                            "group flex items-center gap-3 p-3 rounded-lg hover:bg-accent/50 transition-colors",
                                            task.completed && "bg-orange-50/50",
                                            priorityStyles[task.priority]
                                        )}
                                    >
                                        {/* Checkbox */}
                                        <Checkbox
                                            checked={task.completed}
                                            onCheckedChange={() => handleToggleComplete(task)}
                                            className="flex-shrink-0"
                                        />

                                        {/* Task Content */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span
                                                    className={cn(
                                                        "font-medium text-sm",
                                                        task.completed && "line-through text-muted-foreground"
                                                    )}
                                                >
                                                    {task.title}
                                                </span>
                                                {task.priority !== "low" && (
                                                    <span className={cn("text-xs", priorityColors[task.priority])}>
                                                        •
                                                    </span>
                                                )}
                                            </div>
                                            {task.description && (
                                                <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                                                    {task.description}
                                                </p>
                                            )}
                                        </div>

                                        {/* Due Date */}
                                        {dueDateInfo && (
                                            <div className="flex-shrink-0 hidden sm:flex items-center gap-1">
                                                <CalendarIcon className="h-3 w-3 text-muted-foreground" />
                                                <span
                                                    className={cn(
                                                        "text-xs",
                                                        dueDateInfo.isPastDue ? "text-red-600" : "text-muted-foreground"
                                                    )}
                                                >
                                                    {dueDateInfo.text}
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
                                                >
                                                    <MoreHorizontal className="h-4 w-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuItem onClick={() => onTaskEdit(task)}>
                                                    <Pencil className="mr-2 h-4 w-4" />
                                                    Edit
                                                </DropdownMenuItem>
                                                <DropdownMenuSeparator />
                                                <DropdownMenuItem
                                                    onClick={() => onTaskDelete(task)}
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
    );
}
