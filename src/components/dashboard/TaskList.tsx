"use client";

import { Task } from "@/lib/types";
import TaskCard from "./TaskCard";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ListTodo } from "lucide-react";
import AddTaskDialog from "./AddTaskDialog";

interface TaskListProps {
  tasks: Task[];
  loading: boolean;
  onTaskUpdate: (id: string, updates: Partial<Task>) => void;
  onTaskDelete: (task: Task) => void;
  onTaskEdit: (task: Task) => void;
}

export default function TaskList({ tasks, loading, onTaskUpdate, onTaskDelete, onTaskEdit }: TaskListProps) {

  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="flex flex-col space-y-3">
            <Skeleton className="h-[150px] w-full rounded-xl" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-2/3" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (tasks.length === 0) {
    return (
      <div className="flex justify-center items-center h-full min-h-[40vh]">
        <Alert className="max-w-md text-center">
            <ListTodo className="h-4 w-4" />
            <AlertTitle className="font-headline">No matching tasks!</AlertTitle>
            <AlertDescription>
                Your current filter settings didn't return any tasks. Try adjusting your filters.
            </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {tasks.map((task) => (
        <TaskCard
          key={task.id}
          task={task}
          onUpdate={onTaskUpdate}
          onDelete={onTaskDelete}
          onEdit={onTaskEdit}
        />
      ))}
    </div>
  );
}
