
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { format } from "date-fns"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date: Date | string | number | null | undefined, formatString: string = "PPP p"): string {
  if (!date) return "";
  try {
    return format(new Date(date), formatString);
  } catch (error) {
    return "";
  }
}
