import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const generateSlug = (text: string) => {
  if (!text) return '';
  return text
    .normalize("NFD")                   // Decompose combined graphemes
    .replace(/[\u0300-\u036f]/g, "")    // Remove diacritics/accents
    .toLowerCase()                      // Convert to lowercase
    .replace(/[^a-z0-9]+/g, '-')        // Replace spaces and special chars with hyphens
    .replace(/(^-|-$)+/g, '');          // Remove leading or trailing hyphens
};