"use client";

import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { MoreVertical, Calendar as CalendarIcon, Clock, Trash2, Pencil } from "lucide-react";
import { cn, formatDate } from "@/lib/utils";
import type { Task, TaskPriority } from "@/lib/types";

interface TaskCardProps {
  task: Task;
  onUpdate: (id: string, updates: Partial<Task>) => void;
  onDelete: (task: Task) => void;
  onEdit: (task: Task) => void;
}

const priorityStyles: Record<TaskPriority, string> = {
  high: "bg-priority-high text-white",
  medium: "bg-priority-medium text-white",
  low: "bg-priority-low text-white",
};

export default function TaskCard({ task, onUpdate, onDelete, onEdit }: TaskCardProps) {
  const [summarizedDescription, setSummarizedDescription] = useState<string>("");
  const [isLoadingSummary, setIsLoadingSummary] = useState(false);

  useEffect(() => {
    const summarizeDescription = async () => {
      if (!task.description || task.description.length <= 100) {
        setSummarizedDescription(task.description || "");
        return;
      }

      setIsLoadingSummary(true);
      try {
        const response = await fetch('/api/summarize', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: task.description }),
        });

        if (response.ok) {
          const data = await response.json();
          // Ensure the summary doesn't exceed 100 characters
          const summary = data.summary.length > 100
            ? data.summary.substring(0, 97) + '...'
            : data.summary;
          setSummarizedDescription(summary);
        } else {
          // Fallback: truncate to 100 characters
          setSummarizedDescription(task.description.substring(0, 97) + '...');
        }
      } catch (error) {
        console.error('Error summarizing description:', error);
        // Fallback: truncate to 100 characters
        setSummarizedDescription(task.description.substring(0, 97) + '...');
      } finally {
        setIsLoadingSummary(false);
      }
    };

    summarizeDescription();
  }, [task.description]);

  const handleToggleComplete = () => {
    onUpdate(task.id, { completed: !task.completed });
  };

  const dueDate = task.dueDate ? task.dueDate.toDate() : null;
  const formattedDate = dueDate ? dueDate.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  }) : null;
  const formattedTime = dueDate ? dueDate.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit'
  }) : null;

  return (
    <Card
      className={cn(
        "flex flex-col transition-all duration-300 hover:shadow-lg hover:-translate-y-1 h-full cursor-pointer",
        task.completed && "bg-orange-100 border-2 border-orange-400 shadow-orange-200 shadow-md"
      )}
      onClick={() => onEdit(task)}
    >
      <CardHeader className="flex flex-row items-start gap-4 space-y-0 pb-4">
        <Checkbox
          checked={task.completed}
          onCheckedChange={handleToggleComplete}
          aria-label="Mark task as complete"
          className="mt-1 flex-shrink-0"
          onClick={(e) => e.stopPropagation()}
        />
        <div className="flex-1 min-w-0">
          <CardTitle
            className={cn(
              "text-xl font-bold font-headline break-words",
              task.completed && "line-through text-muted-foreground"
            )}
            style={{
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
              wordBreak: 'break-word',
              hyphens: 'auto',
              minHeight: '3.5rem',
              maxHeight: '3.5rem'
            }}
          >
            {task.title}
          </CardTitle>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 flex-shrink-0"
              onClick={(e) => e.stopPropagation()}
            >
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={(e) => {
              e.stopPropagation();
              onEdit(task);
            }}>
              <Pencil className="mr-2 h-4 w-4" />
              Edit
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={(e) => {
              e.stopPropagation();
              onDelete(task);
            }} className="text-destructive">
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </CardHeader>
      <CardContent className="flex-grow pb-4">
        <CardDescription
          className={cn(
            "text-sm text-muted-foreground break-words",
            task.completed && "line-through text-muted-foreground/70"
          )}
          style={{
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            wordBreak: 'break-word',
            minHeight: '2.5rem',
            maxHeight: '2.5rem'
          }}
        >
          {isLoadingSummary ? "Loading..." : (summarizedDescription || "No description")}
        </CardDescription>
      </CardContent>
      <CardFooter className="flex justify-between items-start text-sm text-muted-foreground pt-4 border-t mt-auto">
        <div className="flex flex-col gap-1 flex-1 min-w-0" style={{ minHeight: '3rem' }}>
          {dueDate ? (
            <>
              <div className="flex items-center gap-2">
                <CalendarIcon className="h-4 w-4 flex-shrink-0" />
                <span className="truncate">{formattedDate}</span>
              </div>
              {task.hasTime && (
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 flex-shrink-0" />
                  <span className="truncate">{formattedTime}</span>
                </div>
              )}
            </>
          ) : (
            <div className="flex items-center gap-2">
              <CalendarIcon className="h-4 w-4 flex-shrink-0" />
              <span className="text-xs">No due date</span>
            </div>
          )}
        </div>
        <Badge className={cn("capitalize flex-shrink-0 ml-2", priorityStyles[task.priority])}>
          {task.priority}
        </Badge>
      </CardFooter>
    </Card>
  );
}
