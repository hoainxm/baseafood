// ============================================================
// Tên file: src/lib/utils.ts
// Tên tiếng Việt tương đương: Tiện ích Hợp nhất Class CSS (cn)
// Description: Tailwind CSS class merger utility using clsx and tailwind-merge
// ============================================================
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
