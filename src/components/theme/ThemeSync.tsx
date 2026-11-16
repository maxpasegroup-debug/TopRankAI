"use client";

import { useEffect } from "react";

export type ThemeMode = "light" | "dark" | "system";
export const themeStorageKey = "toprank_theme";

export function applyTheme(mode: ThemeMode) {
  document.documentElement.dataset.theme = mode;
  localStorage.setItem(themeStorageKey, mode);
  document.cookie = `${themeStorageKey}=${mode}; path=/; max-age=31536000; samesite=lax`;
}

export function ThemeSync() {
  useEffect(() => {
    const stored = localStorage.getItem(themeStorageKey);
    const mode: ThemeMode = stored === "dark" || stored === "light" || stored === "system" ? stored : "system";
    document.documentElement.dataset.theme = mode;
  }, []);
  return null;
}
