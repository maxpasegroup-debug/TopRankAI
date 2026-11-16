"use client";

import { useEffect, useState } from "react";
import { applyTheme, type ThemeMode, themeStorageKey } from "./ThemeSync";

export function ThemeToggle() {
  const [mode, setMode] = useState<ThemeMode>("system");
  useEffect(() => {
    const stored = localStorage.getItem(themeStorageKey);
    if (stored === "dark" || stored === "light" || stored === "system") setMode(stored);
  }, []);
  return <label className="theme-control">
    <span className="sr-only">Color theme</span>
    <select aria-label="Color theme" value={mode} onChange={(event) => { const next = event.target.value as ThemeMode; setMode(next); applyTheme(next); }}>
      <option value="system">System</option>
      <option value="light">Light</option>
      <option value="dark">Dark</option>
    </select>
  </label>;
}
