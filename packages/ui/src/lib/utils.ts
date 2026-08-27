import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Merge Tailwind/layout class names. Prefer StyleX styles on cssinjs components. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
