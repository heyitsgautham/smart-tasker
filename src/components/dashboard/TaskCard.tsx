"use client";

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
import { MoreVertical, Calendar as CalendarIcon, Trash2, Pencil } from "lucide-react";
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
    low: "bg-priority-low text-foreground",
};


export default function TaskCard({ task, onUpdate, onDelete, onEdit }: TaskCardProps) {
  const handleToggleComplete = () => {
    onUpdate(task.id, { completed: !task.completed });
  };
  
  const dueDate = task.dueDate ? task.dueDate.toDate() : null;

  return (
    <Card
      className={cn(
        "flex flex-col transition-all duration-300 hover:shadow-lg hover:-translate-y-1",
        task.completed && "bg-card/50"
      )}
    >
      <CardHeader className="flex flex-row items-start gap-4 space-y-0 pb-4">
        <Checkbox
          checked={task.completed}
          onCheckedChange={handleToggleComplete}
          aria-label="Mark task as complete"
          className="mt-1"
        />
        <div className="flex-1">
          <CardTitle
            className={cn(
              "text-lg font-semibold font-headline",
              task.completed && "line-through text-muted-foreground"
            )}
          >
            {task.title}
          </CardTitle>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onEdit(task)}>
              <Pencil className="mr-2 h-4 w-4" />
              Edit
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => onDelete(task)} className="text-destructive">
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </CardHeader>
      <CardContent className="flex-grow">
        {task.description && (
          <CardDescription
            className={cn(task.completed && "line-through text-muted-foreground/80")}
          >
            {task.description}
          </CardDescription>
        )}
      </CardContent>
      <CardFooter className="flex justify-between items-center text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
            {dueDate && (
                <div className="flex items-center gap-2">
                    <CalendarIcon className="h-4 w-4" />
                    <span>{formatDate(dueDate)}</span>
                </div>
            )}
        </div>
        <Badge className={cn("capitalize", priorityStyles[task.priority])}>
          {task.priority}
        </Badge>
      </CardFooter>
    </Card>
  );
}
