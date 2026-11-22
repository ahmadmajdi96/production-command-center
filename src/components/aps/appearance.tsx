import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";

type Theme = "light" | "dark";

const storageKey = "aps-theme";
const Appearance = createContext<{ theme?: Theme; toggle: () => void }>({ toggle: () => {} });

export const apsThemeBootstrap = `try {
  document.documentElement.classList.toggle("dark", localStorage.getItem(${JSON.stringify(storageKey)}) === "dark");
} catch {}`;

export function ApsAppearance({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>();

  useEffect(() => {
    let dark = document.documentElement.classList.contains("dark");
    try {
      dark = localStorage.getItem(storageKey) === "dark";
    } catch {
      // Keep the current document appearance when storage is unavailable.
    }
    document.documentElement.classList.toggle("dark", dark);
    setTheme(dark ? "dark" : "light");
  }, []);

  function toggle() {
    const dark = document.documentElement.classList.toggle("dark");
    const next = dark ? "dark" : "light";
    setTheme(next);
    try {
      localStorage.setItem(storageKey, next);
    } catch {
      // The selected appearance still applies to this page.
    }
  }

  return <Appearance.Provider value={{ theme, toggle }}>{children}</Appearance.Provider>;
}

export function useApsAppearance() {
  return useContext(Appearance);
}

export function ApsThemeToggle() {
  const { theme, toggle } = useApsAppearance();
  return (
    <Button
      type="button"
      size="icon"
      variant="outline"
      className="size-10 shrink-0 border-border bg-card"
      aria-label="Dark appearance"
      aria-pressed={theme === undefined ? undefined : theme === "dark"}
      onClick={toggle}
    >
      <Moon aria-hidden className="dark:hidden" />
      <Sun aria-hidden className="hidden dark:block" />
    </Button>
  );
}
