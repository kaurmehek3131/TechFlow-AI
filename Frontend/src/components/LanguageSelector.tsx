import { useLanguage, SUPPORTED_LANGUAGES, Language } from "@/hooks/use-language";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Globe, Check } from "lucide-react";

export function LanguageSelector() {
  const { language, setLanguage } = useLanguage();

  const currentLangObj = SUPPORTED_LANGUAGES.find((l) => l.name === language) || SUPPORTED_LANGUAGES[0];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="flex items-center gap-2 px-3 py-1.5 h-9 rounded-lg border border-border bg-card/65 text-card-foreground shadow-sm backdrop-blur hover:bg-accent hover:text-accent-foreground transition-all duration-200"
        >
          <Globe className="h-4 w-4 text-primary animate-pulse-slow" />
          <span className="text-xs font-medium tracking-wide">
            {currentLangObj.emoji} {currentLangObj.label}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48 p-1.5 rounded-xl border border-border/80 bg-card shadow-lg animate-in fade-in-80 slide-in-from-top-5 duration-200">
        {SUPPORTED_LANGUAGES.map((lang) => {
          const isSelected = lang.name === language;
          return (
            <DropdownMenuItem
              key={lang.name}
              onClick={async () => {
                await setLanguage(lang.name);
              }}
              className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs cursor-pointer select-none transition-colors duration-150 ${
                isSelected
                  ? "bg-primary/10 text-primary font-semibold"
                  : "text-foreground/80 hover:bg-muted hover:text-foreground"
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="text-sm select-none">🌐</span>
                <span className="text-sm select-none">{lang.emoji}</span>
                <span>{lang.label}</span>
              </div>
              {isSelected && <Check className="h-3.5 w-3.5 text-primary stroke-[2.5]" />}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
