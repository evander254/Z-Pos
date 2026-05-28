import React, { createContext, useContext, useEffect, useState } from "react";

export type ThemeMode = "light" | "dark";
export type ThemeColor = "violet" | "blue" | "emerald" | "amber" | "rose";

interface ThemeContextType {
  mode: ThemeMode;
  color: ThemeColor;
  setMode: (mode: ThemeMode) => void;
  setColor: (color: ThemeColor) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<ThemeMode>(() => {
    if (typeof window !== "undefined") {
      return (localStorage.getItem("zpos-mode") as ThemeMode) || "light";
    }
    return "light";
  });

  const [color, setColor] = useState<ThemeColor>(() => {
    if (typeof window !== "undefined") {
      return (localStorage.getItem("zpos-color") as ThemeColor) || "violet";
    }
    return "violet";
  });

  useEffect(() => {
    const root = window.document.documentElement;
    if (mode === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
    localStorage.setItem("zpos-mode", mode);
  }, [mode]);

  useEffect(() => {
    const root = window.document.documentElement;
    const colors: ThemeColor[] = ["violet", "blue", "emerald", "amber", "rose"];
    colors.forEach((c) => root.classList.remove(`theme-${c}`));
    root.classList.add(`theme-${color}`);
    localStorage.setItem("zpos-color", color);
  }, [color]);

  return (
    <ThemeContext.Provider value={{ mode, color, setMode, setColor }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
