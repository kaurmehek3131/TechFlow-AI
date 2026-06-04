import { useTheme } from "@/hooks/use-theme";
import { useLanguage } from "@/hooks/use-language";
import { Button } from "@/components/ui/button";
import { Sun, Moon } from "lucide-react";

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const { t } = useLanguage();

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={toggleTheme}
      className="flex items-center gap-2 px-3 py-1.5 h-9 rounded-lg border border-border bg-card/65 text-card-foreground shadow-sm backdrop-blur hover:bg-accent hover:text-accent-foreground transition-all duration-200"
      title={theme === "light" ? t("darkMode") : t("lightMode")}
    >
      {theme === "light" ? (
        <>
          <Sun className="h-4 w-4 text-amber-500 animate-pulse" />
          <span className="text-xs font-medium tracking-wide hidden md:inline">
            {t("lightMode")}
          </span>
        </>
      ) : (
        <>
          <Moon className="h-4 w-4 text-indigo-400" />
          <span className="text-xs font-medium tracking-wide hidden md:inline">
            {t("darkMode")}
          </span>
        </>
      )}
    </Button>
  );
}
