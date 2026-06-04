import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

export type Theme = "light" | "dark";

type ThemeContextProps = {
  theme: Theme;
  setTheme: (theme: Theme) => Promise<void>;
  toggleTheme: () => Promise<void>;
};

const ThemeContext = createContext<ThemeContextProps>({
  theme: "dark",
  setTheme: async () => {},
  toggleTheme: async () => {}
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [theme, setThemeState] = useState<Theme>("dark");

  // Load theme preference initially
  useEffect(() => {
    // 1. Check local storage
    const stored = localStorage.getItem("preferred_theme") as Theme | null;
    if (stored === "light" || stored === "dark") {
      setThemeState(stored);
    }

    // 2. If logged in, fetch from DB
    if (!user) return;
    (async () => {
      try {
        const { data } = await supabase
          .from("profiles")
          .select("preferred_theme")
          .eq("id", user.id)
          .maybeSingle();

        if (data?.preferred_theme && (data.preferred_theme === "light" || data.preferred_theme === "dark")) {
          const dbTheme = data.preferred_theme as Theme;
          setThemeState(dbTheme);
          localStorage.setItem("preferred_theme", dbTheme);
        }
      } catch (err) {
        console.error("Error loading theme from profiles database:", err);
      }
    })();
  }, [user]);

  // Apply theme to document class
  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove("light", "dark");
    root.classList.add(theme);
  }, [theme]);

  const setTheme = async (newTheme: Theme) => {
    setThemeState(newTheme);
    localStorage.setItem("preferred_theme", newTheme);

    if (user) {
      try {
        const { error } = await supabase
          .from("profiles")
          .update({ preferred_theme: newTheme })
          .eq("id", user.id);

        if (error) {
          console.warn("Failed to sync theme to database profiles:", error.message);
        }
      } catch (err) {
        console.error("Error syncing theme to database profiles:", err);
      }
    }
  };

  const toggleTheme = async () => {
    const nextTheme = theme === "dark" ? "light" : "dark";
    await setTheme(nextTheme);
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
