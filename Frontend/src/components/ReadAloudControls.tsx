import { useSpeech } from "@/hooks/use-speech";
import { useLanguage } from "@/hooks/use-language";
import { Button } from "@/components/ui/button";
import { Volume2, Pause, Play, Square } from "lucide-react";

type ReadAloudControlsProps = {
  text: string;
};

export function ReadAloudControls({ text }: ReadAloudControlsProps) {
  const { speak, pause, resume, stop, speechStatus, activeText } = useSpeech();
  const { language, t } = useLanguage();

  const isCurrentText = activeText === text;
  const isPlaying = speechStatus === "playing" && isCurrentText;
  const isPaused = speechStatus === "paused" && isCurrentText;

  const handlePlayClick = () => {
    if (isPaused) {
      resume();
    } else {
      speak(text, language);
    }
  };

  return (
    <div className="flex items-center gap-1 bg-muted/40 p-1 rounded-lg border border-border/40 select-none">
      {!isPlaying && !isPaused ? (
        <Button
          variant="ghost"
          size="sm"
          onClick={handlePlayClick}
          className="h-7 px-2.5 text-xs text-foreground/80 hover:text-primary gap-1.5 rounded-md transition"
        >
          <Volume2 className="h-3.5 w-3.5 text-primary" />
          <span className="text-[10px] font-semibold">{t("readAloud")}</span>
        </Button>
      ) : (
        <>
          {isPlaying ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={pause}
              className="h-7 px-2.5 text-xs text-foreground/85 hover:text-amber-500 gap-1.5 rounded-md"
              title={t("pause")}
            >
              <Pause className="h-3.5 w-3.5" />
              <span className="text-[10px] hidden xs:inline">{t("pause")}</span>
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              onClick={resume}
              className="h-7 px-2.5 text-xs text-foreground/85 hover:text-green-500 gap-1.5 rounded-md"
              title={t("resume")}
            >
              <Play className="h-3.5 w-3.5" />
              <span className="text-[10px] hidden xs:inline">{t("resume")}</span>
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={stop}
            className="h-7 px-2 text-xs text-red-500 hover:text-red-600 gap-1.5 rounded-md"
            title={t("stop")}
          >
            <Square className="h-3 w-3 fill-red-500 stroke-none" />
            <span className="text-[10px] hidden xs:inline">{t("stop")}</span>
          </Button>
        </>
      )}
    </div>
  );
}
