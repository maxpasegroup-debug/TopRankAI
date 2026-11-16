"use client";

import { useEffect, useState } from "react";
import { Icon, type IconName } from "./Icon";

type ThemeMode = "light" | "dark" | "system";

const themeStorageKey = "toprank_theme";
const themeCookieKey = "toprank_theme";
const order: ThemeMode[] = ["system", "light", "dark"];
const iconByMode: Record<ThemeMode, IconName> = { system: "monitor", light: "sun", dark: "moon" };
const labelByMode: Record<ThemeMode, string> = {
  system: "System theme — click for light",
  light: "Light theme — click for dark",
  dark: "Dark theme — click for system",
};

function isThemeMode(value: string | null | undefined): value is ThemeMode {
  return value === "light" || value === "dark" || value === "system";
}

function writeThemeCookie(mode: ThemeMode) {
  if (typeof document === "undefined") return;
  document.cookie = `${themeCookieKey}=${mode}; path=/; max-age=31536000; samesite=lax`;
}

export function applyTheme(mode: ThemeMode) {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.theme = mode;
  try {
    localStorage.setItem(themeStorageKey, mode);
  } catch {
    /* storage can be unavailable in private modes */
  }
  writeThemeCookie(mode);
}

export function ThemeCycle({ className = "tp-theme" }: { className?: string }) {
  const [mode, setMode] = useState<ThemeMode>("system");

  useEffect(() => {
    let stored: string | null = null;
    try {
      stored = localStorage.getItem(themeStorageKey);
    } catch {
      stored = null;
    }
    const current = document.documentElement.dataset.theme;
    const resolved = isThemeMode(stored) ? stored : isThemeMode(current) ? current : "system";
    setMode(resolved);
    if (resolved !== current) document.documentElement.dataset.theme = resolved;
    writeThemeCookie(resolved);
  }, []);

  function cycle() {
    const next = order[(order.indexOf(mode) + 1) % order.length];
    setMode(next);
    applyTheme(next);
  }

  return (
    <button
      type="button"
      className={className}
      onClick={cycle}
      aria-label={labelByMode[mode]}
      title={labelByMode[mode]}
    >
      <Icon name={iconByMode[mode]} />
    </button>
  );
}
