import { useState, useEffect, useRef } from "react";

export type SpeechStatus = "playing" | "paused" | "stopped";

// Maps selected global language to corresponding BCP 47 code
const BCP47_MAP: Record<string, string> = {
  English: "en-US",
  Hindi: "hi-IN",
  French: "fr-FR",
  Spanish: "es-ES",
  German: "de-DE",
  Japanese: "ja-JP",
  Chinese: "zh-CN"
};

// Cleans markdown characters (like *, #, emojis, etc.) for a cleaner voice read-aloud
function cleanTextForSpeech(raw: string): string {
  return raw
    .replace(/[\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD00-\uDFFF]/g, "") // remove emojis
    .replace(/\*\*([^*]+)\*\*/g, "$1") // replace bold markdown
    .replace(/\*([^*]+)\*/g, "$1") // replace italics
    .replace(/#{1,6}\s+/g, "") // remove headers
    .replace(/-{2,}/g, "") // remove dividers
    .replace(/---\w+---/g, "") // remove delimiters like ---QUESTION_PANEL---
    .replace(/•\s+/g, "") // remove list bullets
    .trim();
}

export function useSpeech() {
  const [speechStatus, setSpeechStatus] = useState<SpeechStatus>("stopped");
  const [activeText, setActiveText] = useState<string | null>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  // Stop reading if component unmounts
  useEffect(() => {
    return () => {
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  // Listen to speech synthesis events to update status in sync with browser
  useEffect(() => {
    if (!window.speechSynthesis) return;

    const checkInterval = setInterval(() => {
      if (window.speechSynthesis.speaking) {
        if (window.speechSynthesis.paused) {
          setSpeechStatus("paused");
        } else {
          setSpeechStatus("playing");
        }
      } else {
        setSpeechStatus("stopped");
        setActiveText(null);
      }
    }, 250);

    return () => clearInterval(checkInterval);
  }, []);

  const speak = (rawText: string, languageName: string) => {
    if (!window.speechSynthesis) {
      alert("Text-to-speech is not supported on this browser.");
      return;
    }

    // Cancel current reading first
    window.speechSynthesis.cancel();

    const clean = cleanTextForSpeech(rawText);
    const utterance = new SpeechSynthesisUtterance(clean);
    
    // Set language
    const langCode = BCP47_MAP[languageName] || "en-US";
    utterance.lang = langCode;

    // Pick matching voice if available
    const voices = window.speechSynthesis.getVoices();
    const voice = voices.find((v) => v.lang.startsWith(langCode) || v.lang.includes(langCode.replace("-", "_")));
    if (voice) {
      utterance.voice = voice;
    }

    utterance.onend = () => {
      setSpeechStatus("stopped");
      setActiveText(null);
    };

    utterance.onerror = () => {
      setSpeechStatus("stopped");
      setActiveText(null);
    };

    utteranceRef.current = utterance;
    setActiveText(rawText);
    setSpeechStatus("playing");
    
    window.speechSynthesis.speak(utterance);
  };

  const pause = () => {
    if (window.speechSynthesis && speechStatus === "playing") {
      window.speechSynthesis.pause();
      setSpeechStatus("paused");
    }
  };

  const resume = () => {
    if (window.speechSynthesis && speechStatus === "paused") {
      window.speechSynthesis.resume();
      setSpeechStatus("playing");
    }
  };

  const stop = () => {
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
      setSpeechStatus("stopped");
      setActiveText(null);
    }
  };

  return {
    speak,
    pause,
    resume,
    stop,
    speechStatus,
    activeText
  };
}
