"use client";

import { useState } from "react";
import { format, addDays, startOfWeek, addWeeks } from "date-fns";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import {
    Calendar as CalendarIcon,
    Sun,
    CalendarDays,
    Bed,
    Ban,
    Clock
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Task } from "@/lib/types";

interface RescheduleDialogProps {
    trigger: React.ReactNode;
    tasks: Task[];
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    onReschedule: (taskIds: string[], newDate: Date | null) => void;
}

export default function RescheduleDialog({ trigger, tasks, isOpen, onOpenChange, onReschedule }: RescheduleDialogProps) {
    const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
    const [customDateInput, setCustomDateInput] = useState("");
    const [selectedTime, setSelectedTime] = useState<string>("09:00");

    const today = new Date();
    const tomorrow = addDays(today, 1);
    const nextWeek = addDays(startOfWeek(addWeeks(today, 1), { weekStartsOn: 1 }), 0); // Monday next week
    const nextWeekend = addDays(startOfWeek(today, { weekStartsOn: 0 }), 6); // Next Saturday

    const quickOptions = [
        {
            label: "Today",
            sublabel: format(today, "EEE"),
            date: today,
            icon: CalendarIcon,
            color: "text-green-600",
        },
        {
            label: "Tomorrow",
            sublabel: format(tomorrow, "EEE"),
            date: tomorrow,
            icon: Sun,
            color: "text-orange-600",
        },
        {
            label: "Next week",
            sublabel: format(nextWeek, "EEE d MMM"),
            date: nextWeek,
            icon: CalendarDays,
            color: "text-purple-600",
        },
        {
            label: "Next weekend",
            sublabel: format(nextWeekend, "EEE d MMM"),
            date: nextWeekend,
            icon: Bed,
            color: "text-blue-600",
        },
        {
            label: "No Date",
            sublabel: "",
            date: null,
            icon: Ban,
            color: "text-gray-600",
        },
    ];

    const applyTimeToDate = (date: Date | null): Date | null => {
        if (!date) return null;

        const [hours, minutes] = selectedTime.split(':').map(Number);
        const newDate = new Date(date);
        newDate.setHours(hours, minutes, 0, 0);
        return newDate;
    };

    const handleQuickSelect = (date: Date | null) => {
        const taskIds = tasks.map(t => t.id);
        const dateWithTime = applyTimeToDate(date);
        onReschedule(taskIds, dateWithTime);
        onOpenChange(false);
    };

    const handleCalendarSelect = (date: Date | undefined) => {
        if (date) {
            setSelectedDate(date);
            const taskIds = tasks.map(t => t.id);
            const dateWithTime = applyTimeToDate(date);
            onReschedule(taskIds, dateWithTime);
            onOpenChange(false);
        }
    };

    return (
        <Popover open={isOpen} onOpenChange={onOpenChange}>
            <PopoverTrigger asChild>
                {trigger}
            </PopoverTrigger>
            <PopoverContent className="w-[320px] p-0" align="start" side="right">
                <div className="px-4 pt-4 pb-4 space-y-2">
                    {/* Custom Date Input */}
                    <div className="relative">
                        <Input
                            placeholder="Type a date"
                            value={customDateInput}
                            onChange={(e) => setCustomDateInput(e.target.value)}
                            className="pl-4 h-9 text-sm"
                        />
                    </div>

                    {/* Quick Options */}
                    <div className="space-y-0.5">
                        {quickOptions.map((option) => {
                            const Icon = option.icon;
                            return (
                                <button
                                    key={option.label}
                                    onClick={() => handleQuickSelect(option.date)}
                                    className="w-full flex items-center gap-3 px-3 py-2 rounded-md hover:bg-accent transition-colors text-left"
                                >
                                    <Icon className={cn("h-4 w-4 flex-shrink-0", option.color)} />
                                    <div className="flex-1 min-w-0">
                                        <span className="font-normal text-sm">{option.label}</span>
                                    </div>
                                    {option.sublabel && (
                                        <span className="text-xs text-muted-foreground">
                                            {option.sublabel}
                                        </span>
                                    )}
                                </button>
                            );
                        })}
                    </div>

                    {/* Calendar */}
                    <div className="pt-2">
                        <Calendar
                            mode="single"
                            selected={selectedDate}
                            onSelect={handleCalendarSelect}
                            className="w-full rounded-md border p-3"
                            disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                        />
                    </div>

                    {/* Time Input */}
                    <div className="flex items-center gap-3 pt-2 px-1">
                        <Clock className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        <div className="flex-1">
                            <label htmlFor="time-input" className="text-xs text-muted-foreground block mb-1">
                                Time
                            </label>
                            <Input
                                id="time-input"
                                type="time"
                                value={selectedTime}
                                onChange={(e) => setSelectedTime(e.target.value)}
                                className="h-8 text-sm"
                            />
                        </div>
                    </div>
                </div>
            </PopoverContent>
        </Popover>
    );
}
