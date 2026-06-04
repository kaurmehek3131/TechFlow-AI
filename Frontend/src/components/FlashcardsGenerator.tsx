import { useState, useEffect } from "react";
import { useLanguage } from "@/hooks/use-language";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sparkles, ArrowLeft, ArrowRight, RotateCw, Shuffle, Download, Volume2 } from "lucide-react";
import { ReadAloudControls } from "@/components/ReadAloudControls";
import { toast } from "sonner";

type Flashcard = {
  front: string;
  back: string;
};

type FlashcardsGeneratorProps = {
  defaultSubject?: string;
  defaultTopic?: string;
};

// High quality multilingual mock flashcards for fallback/demo
const MOCK_FLASHCARDS_BY_LANG: Record<string, Record<string, Flashcard[]>> = {
  English: {
    default: [
      { front: "What is the primary function of DNA?", back: "DNA stores genetic information that directs all cellular activities and protein synthesis." },
      { front: "Define Photosynthesis.", back: "The process by which green plants use sunlight to synthesize nutrients from carbon dioxide and water." },
      { front: "State Newton's First Law of Motion.", back: "An object at rest stays at rest, and an object in motion stays in motion, unless acted upon by a net external force." },
      { front: "What is Machine Learning?", back: "A branch of AI that enables systems to learn from data and improve without being explicitly programmed." },
      { front: "What is the capital of France?", back: "Paris." }
    ]
  },
  Hindi: {
    default: [
      { front: "डीएनए (DNA) का मुख्य कार्य क्या है?", back: "डीएनए अनुवांशिक जानकारी संग्रहीत करता है जो सभी कोशिकीय गतिविधियों और प्रोटीन संश्लेषण को निर्देशित करता है।" },
      { front: "प्रकाश संश्लेषण (Photosynthesis) को परिभाषित करें।", back: "वह प्रक्रिया जिसके द्वारा हरे पौधे सूर्य के प्रकाश का उपयोग करके कार्बन डाइऑक्साइड और पानी से पोषक तत्वों का संश्लेषण करते हैं।" },
      { front: "न्यूटन की गति का पहला नियम बताएं।", back: "एक वस्तु जो स्थिर है वह स्थिर रहेगी, और एक वस्तु जो गति में है वह गति में रहेगी, जब तक कि उस पर कोई बाहरी बल कार्य न करे।" },
      { front: "मशीन लर्निंग (Machine Learning) क्या है?", back: "एआई की एक शाखा जो प्रणालियों को डेटा से सीखने और स्पष्ट रूप से प्रोग्राम किए बिना सुधार करने में सक्षम बनाती है।" },
      { front: "फ्रांस की राजधानी क्या है?", back: "पेरिस।" }
    ]
  },
  French: {
    default: [
      { front: "Quelle est la fonction principale de l'ADN?", back: "L'ADN stocke les informations génétiques qui dirigent toutes les activités cellulaires et la synthèse des protéines." },
      { front: "Définissez la Photosynthèse.", back: "Le processus par lequel les plantes vertes utilisent la lumière du soleil pour synthétiser des nutriments à partir de dioxyde de carbone et d'eau." },
      { front: "Énoncez la première loi du mouvement de Newton.", back: "Un objet au repos reste au repos, et un objet en mouvement reste en mouvement, à moins d'être soumis à une force externe nette." },
      { front: "Qu'est-ce que le Machine Learning?", back: "Une branche de l'IA qui permet aux systèmes d'apprendre des données et de s'améliorer sans être explicitement programmés." },
      { front: "Quelle est la capitale de la France?", back: "Paris." }
    ]
  },
  Spanish: {
    default: [
      { front: "¿Cuál es la función principal del ADN?", back: "El ADN almacena información genética que dirige todas las actividades celulares y la síntesis de proteínas." },
      { front: "Defina Fotosíntesis.", back: "El proceso mediante el cual las plantas verdes utilizan la luz solar para sintetizar nutrientes a partir de dióxido de carbono y agua." },
      { front: "Escriba la primera ley del movimiento de Newton.", back: "Un objeto en reposo permanece en reposo, y un objeto en movimiento permanece en movimiento, a menos que sobre él actúe una fuerza externa neta." },
      { front: "¿Qué es el Aprendizaje Automático (Machine Learning)?", back: "Una rama de la IA que permite a los sistemas aprender de los datos y mejorar sin ser programados explícitamente." },
      { front: "¿Cuál es la capital de Francia?", back: "París." }
    ]
  },
  German: {
    default: [
      { front: "Was ist die Hauptfunktion der DNA?", back: "DNA speichert genetische Informationen, die alle zellulären Aktivitäten und die Proteinsynthese steuern." },
      { front: "Definieren Sie Photosynthese.", back: "Der Prozess, bei dem grüne Pflanzen Sonnenlicht nutzen, um Nährstoffe aus Kohlendioxid und Wasser zu synthetisieren." },
      { front: "Nennen Sie Newtons erstes Bewegungsgesetz.", back: "Ein ruhendes Objekt bleibt in Ruhe, und ein sich bewegendes Objekt bleibt in Bewegung, sofern keine äußere Kraft auf es einwirkt." },
      { front: "Was ist Maschinelles Lernen?", back: "Ein Teilbereich der KI, der es Systemen ermöglicht, aus Daten zu lernen und sich ohne explizite Programmierung zu verbessern." },
      { front: "Was ist die Hauptstadt von Frankreich?", back: "Paris." }
    ]
  },
  Japanese: {
    default: [
      { front: "DNAの主な機能は何ですか？", back: "DNAは、すべての細胞活動とタンパク質合成を指示する遺伝情報を保存しています。" },
      { front: "光合成を定義してください。", back: "緑色植物が日光を利用して、二酸化炭素と水から栄養素を合成するプロセス。" },
      { front: "ニュートンの運動の第1法則を述べてください。", back: "静止している物体は静止し続け、運動している物体は、外力が働かない限り、等速直線運動を続けます。" },
      { front: "機械学習（Machine Learning）とは何ですか？", back: "システムがデータから学習し、明示的にプログラムされることなく向上することを可能にするAIの分野。" },
      { front: "フランスの首都はどこですか？", back: "パリです。" }
    ]
  },
  Chinese: {
    default: [
      { front: "DNA的主要功能是什么？", back: "DNA储存遗传信息，指导所有细胞活动和蛋白质合成。" },
      { front: "定义光合作用。", back: "绿色植物利用阳光将二氧化碳和水合成为营养物质的过程。" },
      { front: "陈述牛顿第一运动定律。", back: "孤立质点保持静止或做匀速直线运动的状态，直到外力迫使它改变这种状态为止。" },
      { front: "什么是机器学习？", back: "人工智能的一个分支，使系统能够从数据中学习并改进，而无需进行显式编程。" },
      { front: "法国的首都是哪里？", back: "巴黎。" }
    ]
  }
};

export function FlashcardsGenerator({ defaultSubject = "", defaultTopic = "" }: FlashcardsGeneratorProps) {
  const { language, t } = useLanguage();
  
  const [subject, setSubject] = useState(defaultSubject);
  const [topic, setTopic] = useState(defaultTopic);
  const [difficulty, setDifficulty] = useState("Medium");
  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [loading, setLoading] = useState(false);

  // Load initial mock or trigger default generate
  useEffect(() => {
    // Generate default flashcards on mount if topic exists
    if (defaultTopic) {
      generateCards(true);
    } else {
      loadFallbackCards();
    }
  }, [language]);

  const loadFallbackCards = () => {
    const list = MOCK_FLASHCARDS_BY_LANG[language] || MOCK_FLASHCARDS_BY_LANG.English;
    const cards = list.default.map((c) => {
      // replace placeholders if matching defaults are searched
      let front = c.front;
      let back = c.back;
      if (topic) {
        front = front.replace("DNA", topic).replace("Photosynthesis", topic).replace("Machine Learning", topic);
        back = back.replace("DNA", topic).replace("Photosynthesis", topic).replace("Machine Learning", topic);
      }
      return { front, back };
    });
    setFlashcards(cards);
    setCurrentIndex(0);
    setIsFlipped(false);
  };

  const generateCards = async (useDefault = false) => {
    const activeSubject = useDefault ? defaultSubject : subject;
    const activeTopic = useDefault ? defaultTopic : topic;

    if (!activeTopic) {
      toast.error("Please fill in a topic name.");
      return;
    }

    setLoading(true);
    setIsFlipped(false);

    const apiKey = localStorage.getItem("gemini_api_key") || (import.meta.env.VITE_GEMINI_API_KEY as string);

    if (apiKey) {
      try {
        const prompt = `You are a professional educational assistant. Generate exactly 5 premium quality flashcards for study/revision:
Subject: ${activeSubject || "General Education"}
Topic: ${activeTopic}
Difficulty Level: ${difficulty}
Language: ${language}

Return ONLY a JSON array of objects, containing exactly 5 elements. Do not wrap in markdown tags.
JSON schema structure:
[
  {
    "front": "Clear question or core concept in ${language}",
    "back": "Clear concise answer or explanation in ${language}"
  }
]`;

        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { responseMimeType: "application/json" }
          })
        });

        if (!res.ok) throw new Error("Gemini response error");
        
        const data = await res.json();
        const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!rawText) throw new Error("Empty response");

        let cleaned = rawText.trim();
        if (cleaned.startsWith("```")) {
          cleaned = cleaned.replace(/^```json\s*/i, "").replace(/```$/, "").trim();
        }

        const parsed = JSON.parse(cleaned);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setFlashcards(parsed);
          setCurrentIndex(0);
          toast.success("AI Flashcards Generated!");
        } else {
          throw new Error("Invalid structure");
        }
      } catch (err) {
        console.error("Flashcard generation error, falling back:", err);
        loadFallbackCards();
        toast.info("Generated fallback demonstration flashcards.");
      } finally {
        setLoading(false);
      }
    } else {
      // Simulate slow generation
      setTimeout(() => {
        loadFallbackCards();
        setLoading(false);
        toast.info("Generated fallback demonstration flashcards. Put Gemini Key in Profile for real AI generation.");
      }, 1200);
    }
  };

  const handleNext = () => {
    if (currentIndex < flashcards.length - 1) {
      setIsFlipped(false);
      setTimeout(() => {
        setCurrentIndex((prev) => prev + 1);
      }, 150);
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setIsFlipped(false);
      setTimeout(() => {
        setCurrentIndex((prev) => prev - 1);
      }, 150);
    }
  };

  const handleShuffle = () => {
    setIsFlipped(false);
    setTimeout(() => {
      const shuffled = [...flashcards].sort(() => Math.random() - 0.5);
      setFlashcards(shuffled);
      setCurrentIndex(0);
      toast.success(t("shuffle") + "d!");
    }, 150);
  };

  const handleDownload = () => {
    const textContent = flashcards
      .map((c, i) => `Card ${i + 1}\nFront: ${c.front}\nBack: ${c.back}\n\n======================\n`)
      .join("\n");

    const element = document.createElement("a");
    const file = new Blob([textContent], { type: "text/plain" });
    element.href = URL.createObjectURL(file);
    element.download = `${topic || "flashcards"}_study_cards.txt`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
    toast.success("Downloaded successfully!");
  };

  const currentCard = flashcards[currentIndex];

  return (
    <div className="space-y-6">
      {/* Self-contained CSS injection for premium 3D card flip effects */}
      <style dangerouslySetInnerHTML={{ __html: `
        .perspective-container {
          perspective: 1200px;
        }
        .card-inner {
          transform-style: preserve-3d;
          transition: transform 0.6s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .backface-hidden {
          backface-visibility: hidden;
          -webkit-backface-visibility: hidden;
        }
        .rotated-back {
          transform: rotateY(180deg);
        }
      `}} />

      {/* Generator settings panel */}
      <Card className="border border-border/80 shadow-[var(--shadow-soft)]">
        <CardContent className="p-4 sm:p-6 space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-foreground/80">{t("subject")}</Label>
              <Input
                placeholder="e.g. Science"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="h-9 text-xs bg-muted/20"
                disabled={loading}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-foreground/80">{t("topic")} *</Label>
              <Input
                placeholder="e.g. Photosynthesis"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                className="h-9 text-xs bg-muted/20"
                disabled={loading}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-foreground/80">{t("difficulty")}</Label>
              <Select value={difficulty} onValueChange={setDifficulty} disabled={loading}>
                <SelectTrigger className="h-9 text-xs bg-muted/20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="text-xs">
                  <SelectItem value="Easy">{t("easy")}</SelectItem>
                  <SelectItem value="Medium">{t("medium")}</SelectItem>
                  <SelectItem value="Hard">{t("hard")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button
            onClick={() => generateCards(false)}
            className="w-full h-9 gap-2 text-xs font-semibold"
            disabled={loading || !topic}
          >
            <Sparkles className="h-4 w-4" />
            {loading ? t("generating") : t("regenerateFlashcards")}
          </Button>
        </CardContent>
      </Card>

      {/* Card viewing and flip area */}
      {flashcards.length > 0 && currentCard ? (
        <div className="flex flex-col items-center space-y-6 select-none">
          {/* Card counter */}
          <span className="text-xs font-semibold text-muted-foreground bg-muted/65 px-3 py-1 rounded-full border border-border/40">
            {t("cardIndex")
              .replace("{current}", String(currentIndex + 1))
              .replace("{total}", String(flashcards.length))}
          </span>

          {/* Interactive Card Body */}
          <div
            onClick={() => setIsFlipped(!isFlipped)}
            className="perspective-container w-full max-w-[480px] h-[260px] cursor-pointer"
          >
            <div
              className={`card-inner relative w-full h-full rounded-2xl shadow-lg border border-border bg-card transition-transform duration-500 ${
                isFlipped ? "rotated-back" : ""
              }`}
              style={{ transform: isFlipped ? "rotateY(180deg)" : "rotateY(0deg)" }}
            >
              {/* Front Side */}
              <div className="backface-hidden absolute inset-0 flex flex-col p-6 items-center justify-center text-center">
                <span className="text-[10px] uppercase font-bold tracking-widest text-primary mb-2">Question / Concept</span>
                <p className="text-sm sm:text-base font-semibold leading-relaxed text-foreground px-4">
                  {currentCard.front}
                </p>
                <div className="absolute bottom-4 right-4 flex items-center gap-1.5 opacity-65 text-[10px] font-semibold text-muted-foreground">
                  <RotateCw className="h-3 w-3 animate-spin-slow" />
                  <span>Click to Flip</span>
                </div>
              </div>

              {/* Back Side */}
              <div className="backface-hidden rotated-back absolute inset-0 flex flex-col p-6 items-center justify-center text-center bg-muted/15 rounded-2xl">
                <span className="text-[10px] uppercase font-bold tracking-widest text-accent mb-2">Answer / Explanation</span>
                <p className="text-xs sm:text-sm font-medium leading-relaxed text-foreground/90 px-4">
                  {currentCard.back}
                </p>
                <div className="absolute bottom-4 right-4 flex items-center gap-1.5 opacity-65 text-[10px] font-semibold text-muted-foreground">
                  <RotateCw className="h-3 w-3" />
                  <span>Click to Flip</span>
                </div>
              </div>
            </div>
          </div>

          {/* Read Aloud controls for active card side */}
          <ReadAloudControls text={isFlipped ? currentCard.back : currentCard.front} />

          {/* Interactive controls */}
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handlePrev}
              disabled={currentIndex === 0}
              className="h-9 px-3 rounded-lg border border-border text-xs gap-1 hover:bg-muted"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>{t("previous")}</span>
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={handleShuffle}
              className="h-9 px-3 rounded-lg border border-border text-xs gap-1.5 hover:bg-muted"
              title={t("shuffle")}
            >
              <Shuffle className="h-3.5 w-3.5 text-primary" />
              <span>{t("shuffle")}</span>
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={handleDownload}
              className="h-9 px-3 rounded-lg border border-border text-xs gap-1.5 hover:bg-muted"
              title={t("download")}
            >
              <Download className="h-3.5 w-3.5 text-accent" />
              <span>{t("download")}</span>
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={handleNext}
              disabled={currentIndex === flashcards.length - 1}
              className="h-9 px-3 rounded-lg border border-border text-xs gap-1 hover:bg-muted"
            >
              <span>{t("next")}</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      ) : (
        <div className="py-12 text-center text-muted-foreground">No flashcards loaded.</div>
      )}
    </div>
  );
}
