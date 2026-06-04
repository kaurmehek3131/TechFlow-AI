import { useState, useRef, useEffect } from "react";
import { useLocation } from "@tanstack/react-router";
import { useLanguage } from "@/hooks/use-language";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ReadAloudControls } from "@/components/ReadAloudControls";
import { MessageSquare, X, Sparkles, Send, Bot, Volume2 } from "lucide-react";
import { toast } from "sonner";

type Message = {
  sender: "user" | "assistant";
  text: string;
};

type StudyAssistantProps = {
  lessonTitle?: string;
  lessonContent?: {
    plan?: string;
    worksheet?: string;
    quiz?: string;
    objectives?: string;
    subject?: string;
  };
};

export function StudyAssistant({ lessonTitle, lessonContent }: StudyAssistantProps) {
  const { language, t } = useLanguage();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const [activeLesson, setActiveLesson] = useState<{ title: string; plan?: string; worksheet?: string; objectives?: string; subject?: string } | null>(null);

  // Sync with props or local storage context when opened
  useEffect(() => {
    if (lessonTitle && lessonTitle !== "TechFlow AI Assistant") {
      setActiveLesson({
        title: lessonTitle,
        plan: lessonContent?.plan,
        worksheet: lessonContent?.worksheet,
        objectives: lessonContent?.objectives,
        subject: lessonContent?.subject
      });
    } else {
      const title = localStorage.getItem("active_lesson_title");
      if (title) {
        setActiveLesson({
          title,
          plan: localStorage.getItem("active_lesson_plan") || undefined,
          worksheet: localStorage.getItem("active_lesson_worksheet") || undefined,
          objectives: localStorage.getItem("active_lesson_objectives") || undefined,
          subject: localStorage.getItem("active_lesson_subject") || undefined
        });
      } else {
        setActiveLesson(null);
      }
    }
  }, [lessonTitle, lessonContent, open, location.pathname]);

  // Set initial welcome message when language changes
  useEffect(() => {
    setMessages([
      {
        sender: "assistant",
        text: t("assistantWelcome")
      }
    ]);
  }, [language]);

  // Scroll to bottom on new message
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading, open]);

  const handleSend = async (textToSend: string) => {
    if (!textToSend.trim()) return;

    const userMsg: Message = { sender: "user", text: textToSend };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    const apiKey = localStorage.getItem("gemini_api_key") || (import.meta.env.VITE_GEMINI_API_KEY as string);

    if (apiKey) {
      try {
        let systemPrompt = "";
        if (activeLesson) {
          systemPrompt = `You are a helpful educational AI Study Assistant helper.
The current active lesson context details are:
Lesson Title: ${activeLesson.title}
Subject: ${activeLesson.subject || "General"}
Objectives: ${activeLesson.objectives || "General"}
Lesson Plan Details:
${activeLesson.plan || "Not specified"}
Worksheet Details:
${activeLesson.worksheet || "Not specified"}

The user's preferred language is ${language}.
CRITICAL: You must write your response entirely in ${language}. Use clean paragraphs.
Keep your answer clear, helpful, engaging, and suitable for the student's grade level.

Answer the following user question: ${textToSend}`;
        } else {
          systemPrompt = `You are a helpful educational AI Study Assistant helper.
The user is asking a general learning, teaching, or revision question.
The user's preferred language is ${language}.
CRITICAL: You must write your response entirely in ${language}.
Keep your answer clear, helpful, engaging, and suitable for the student's grade level.

Answer the following user question: ${textToSend}`;
        }

        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: systemPrompt }] }]
          })
        });

        if (!res.ok) throw new Error("Gemini API error");

        const data = await res.json();
        const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text;

        if (responseText) {
          setMessages((prev) => [...prev, { sender: "assistant", text: responseText }]);
        } else {
          throw new Error("Empty response");
        }
      } catch (err) {
        console.error("Gemini Assistant Error:", err);
        provideMockResponse(textToSend);
      } finally {
        setLoading(false);
      }
    } else {
      // Simulate reply after 1s
      setTimeout(() => {
        provideMockResponse(textToSend);
        setLoading(false);
      }, 1000);
    }
  };

  const provideMockResponse = (userInput: string) => {
    const topic = activeLesson ? activeLesson.title : "General Study Guide";
    let reply = "";

    const lower = userInput.toLowerCase();
    const isSummary = lower.includes("summary") || lower.includes("summarize") || lower.includes("सारांश") || lower.includes("résume") || lower.includes("resum") || lower.includes("zusammen") || lower.includes("要約") || lower.includes("要") || lower.includes("归纳") || lower.includes("总结");
    const isSimplify = lower.includes("simplify") || lower.includes("simple") || lower.includes("सरल") || lower.includes("simpli") || lower.includes("einfach") || lower.includes("簡単") || lower.includes("通俗") || lower.includes("易懂");

    if (language === "Hindi") {
      if (isSummary) {
        reply = `यहाँ पाठ "**${topic}**" का एक संक्षिप्त सारांश दिया गया है:
1. **मूल सिद्धांत**: यह विषय-वस्तु और उसके मुख्य उपयोगों पर केंद्रित है।
2. **मुख्य बिंदु**: पाठ में व्यावहारिक उदाहरणों, वर्कशीट अभ्यास और मूल्यांकन प्रश्नोत्तरी के माध्यम से विस्तृत शिक्षण शामिल है।
3. **उद्देश्य**: छात्रों को विषय-वस्तु की स्पष्ट वैचारिक समझ प्रदान करना।

*(नोट: यह एक पूर्व-निर्धारित डेमो उत्तर है। लाइव एआई उत्तरों के लिए अपनी प्रोफ़ाइल में जेमिनी कुंजी सहेजें)*`;
      } else if (isSimplify) {
        reply = `चलो इसे बिल्कुल सरल शब्दों में समझते हैं:
यह पाठ "**${topic}**" हमें यह सिखाता है कि चीजें कैसे व्यवस्थित होती हैं और एक दूसरे के साथ मिलकर कैसे कार्य करती हैं। इसे आप अपने आस-पास के उदाहरणों से जोड़कर आसानी से समझ सकते हैं!

*(नोट: यह एक पूर्व-निर्धारित डेमो उत्तर है। लाइव एआई उत्तरों के लिए अपनी प्रोफ़ाइल में जेमिनी कुंजी सहेजें)*`;
      } else {
        reply = `आपका प्रश्न पाठ "**${topic}**" से संबंधित है। 

इस विषय को बेहतर ढंग से समझने के लिए, आप पाठ योजना की समीक्षा कर सकते हैं या अभ्यास प्रश्नोत्तरी का प्रयास कर सकते हैं। 

*(नोट: पूर्ण चैट क्षमता और लाइव एआई उत्तरों के लिए, कृपया अपनी प्रोफ़ाइल में एक वैध **जेमिनी एआई कुंजी** जोड़ें।)*`;
      }
    } else if (language === "French") {
      if (isSummary) {
        reply = `Voici un résumé rapide de la leçon "**${topic}**" :
1. **Concept clé** : Se concentre sur le sujet principal et ses applications.
2. **Méthode** : Étude guidée avec des exercices pratiques de feuille de route et des quiz.
3. **But** : Obtenir une maîtrise théorique et pratique du sujet.

*(Remarque : Ceci est une démo. Ajoutez votre clé Gemini pour une vraie IA)*`;
      } else if (isSimplify) {
        reply = `Expliquons cela simplement :
La leçon "**${topic}**" explique comment les éléments fondamentaux de ce sujet interagissent. C'est comme assembler des pièces de puzzle de manière ordonnée pour comprendre le tableau complet !

*(Remarque : Ceci est une démo. Ajoutez votre clé Gemini pour une vraie IA)*`;
      } else {
        reply = `Votre question concerne la leçon "**${topic}**".

Pour en savoir plus, veuillez consulter la fiche de travail ou le quiz d'entraînement. 

*(Remarque : Pour des réponses en direct par IA, veuillez configurer votre **clé API Gemini** dans votre Profil.)*`;
      }
    } else if (language === "Spanish") {
      if (isSummary) {
        reply = `Aquí tienes un resumen rápido de la lección "**${topic}**":
1. **Principio clave**: Se centra en la idea central y sus usos prácticos.
2. **Estructura**: Incluye plan de lección paso a paso, hoja de trabajo y quiz interactivo.
3. **Meta**: Asegurar una comprensión clara y habilidades aplicadas.

*(Nota: Esta es una respuesta de demostración. Configura tu clave Gemini en el perfil para IA en vivo)*`;
      } else if (isSimplify) {
        reply = `Expliquémoslo de forma sencilla:
La lección "**${topic}**" nos enseña cómo se conectan las bases de este tema en la vida cotidiana. ¡Es muy sencillo si lo visualizas como piezas de un engranaje!

*(Nota: Esta es una respuesta de demostración. Configura tu clave Gemini en el perfil para IA en vivo)*`;
      } else {
        reply = `Tu pregunta es sobre la lección "**${topic}**".

Te sugerimos revisar la hoja de ejercicios o realizar el quiz de práctica.

*(Nota: Para respuestas de IA en tiempo real, agrega tu **clave API de Gemini** en la configuración de Perfil.)*`;
      }
    } else if (language === "German") {
      if (isSummary) {
        reply = `Hier ist eine kurze Zusammenfassung der Lektion "**${topic}**":
1. **Kernkonzept**: Konzentriert sich auf das Hauptthema und seine Relevanz.
2. **Inhalt**: Enthält Verlaufsplan, praktische Übungsaufgaben und Quiz.
3. **Lernziel**: Tiefes Verständnis und Anwendungskompetenz erlangen.

*(Hinweis: Dies ist eine Demo-Antwort. API-Schlüssel im Profil hinterlegen für echte KI)*`;
      } else if (isSimplify) {
        reply = `Erklären wir es ganz einfach:
In der Lektion "**${topic}**" geht es darum, wie die Grundbausteine dieses Themas zusammenhängen. Stell es dir wie ein einfaches Rezept vor, bei dem jeder Schritt zählt!

*(Hinweis: Dies ist eine Demo-Antwort. API-Schlüssel im Profil hinterlegen für echte KI)*`;
      } else {
        reply = `Ihre Frage betrifft die Lektion "**${topic}**".

Sehen Sie sich gerne das Arbeitsblatt oder das Quiz an.

*(Hinweis: Für echte KI-Antworten fügen Sie bitte Ihren **Gemini API-Schlüssel** in den Profileinstellungen hinzu.)*`;
      }
    } else if (language === "Japanese") {
      if (isSummary) {
        reply = `レッスン「**${topic}**」の要約です：
1. **中心概念**：このテーマの最も重要な基礎と応用について。
2. **構成**：指導案、ワークシート、練習クイズ。
3. **ゴール**：コンセプトの深い理解と、実践的な活用力を養う。

*(※この回答はデモです。プロフィール画面でGemini APIキーを設定すると本物のAIとチャットできます)*`;
      } else if (isSimplify) {
        reply = `とても簡単に説明しますね：
「**${topic}**」とは、物事がどのように組み立てられ、動いているかを学ぶレッスンです。身の回りにある具体例をイメージすると分かりやすいですよ！

*(※この回答はデモです。プロフィール画面でGemini APIキーを設定すると本物のAIとチャットできます)*`;
      } else {
        reply = `ご質問はレッスン「**${topic}**」に関するものですね。

理解を深めるために、ワークシートや練習クイズを見直してみましょう。

*(※リアルタイムのAI回答を有効にするには、プロフィール画面で **Gemini API キー** を保存してください)*`;
      }
    } else if (language === "Chinese") {
      if (isSummary) {
        reply = `以下是关于“**${topic}**”的要点归纳：
1. **核心概念**：聚焦本课的核心主题及其主要应用。
2. **教学结构**：提供系统的课时计划、随堂练习卷和交互式练习测验。
3. **教学目标**：建立牢固的概念理解和实际应用能力。

*(提示：当前为演示回复。在“个人资料”配置 Gemini API 密钥可激活实时AI对话)*`;
      } else if (isSimplify) {
        reply = `我们用通俗易懂的话来解释：
这门课“**${topic}**”主要告诉我们这些基础原理是如何在日常生活中发生作用的。就像拼图一样，把这些小概念拼起来，就能看到完整的图景！

*(提示：当前为演示回复。在“个人资料”配置 Gemini API 密钥可激活实时AI对话)*`;
      } else {
        reply = `您的问题是关于教案“**${topic}**”的。

建议您查看配套的随堂练习卷或完成练习测验。

*(提示：为了获取实时的 AI 智能解答，请在“个人资料”设置中配置您的 **Gemini API 密钥**。)*`;
      }
    } else {
      // English Default
      if (isSummary) {
        reply = `Here is a quick summary of the "**${topic}**" lesson:
1. **Key Concept**: Focuses on the core subject matter and its real-world relevance.
2. **Structure**: Comprehensive lesson plan, practice worksheet, and diagnostic quiz.
3. **Goal**: Ensure clear conceptual understanding and confident application.

*(Note: This is a demo answer. Save your Gemini API key in Profile settings for live AI replies)*`;
      } else if (isSimplify) {
        reply = `Let's explain this simply:
The lesson "**${topic}**" teaches us how the core ideas of this subject link together. Think of it like steps in a staircase; each one helps you climb higher to see the big picture!

*(Note: This is a demo answer. Save your Gemini API key in Profile settings for live AI replies)*`;
      } else {
        reply = `Your question is related to the lesson "**${topic}**".

We recommend reviewing the worksheet or checking the practice quiz questions to test your knowledge.

*(Note: For real-time AI replies, please save a valid **Gemini API key** in your Profile settings.)*`;
      }
    }

    setMessages((prev) => [...prev, { sender: "assistant", text: reply }]);
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end">
      {/* Expanded Chat Window */}
      {open && (
        <Card className="mb-4 w-[360px] sm:w-[380px] h-[500px] flex flex-col rounded-2xl border border-border bg-card/95 backdrop-blur-md shadow-2xl animate-in fade-in slide-in-from-bottom-6 duration-300">
          <CardHeader className="flex flex-row items-center justify-between border-b border-border/40 p-4 pb-3">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Bot className="h-4.5 w-4.5" />
              </div>
              <div>
                <CardTitle className="text-sm font-semibold tracking-tight">{t("assistantTitle")}</CardTitle>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
                  <span className="text-[10px] text-muted-foreground font-medium">
                    {activeLesson ? activeLesson.title : "Active"}
                  </span>
                </div>
              </div>
            </div>
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full hover:bg-muted" onClick={() => setOpen(false)}>
              <X className="h-4 w-4" />
            </Button>
          </CardHeader>

          {/* Chat Messages */}
          <CardContent className="flex-1 overflow-y-auto p-4 space-y-4" ref={scrollRef}>
            {messages.map((msg, idx) => (
              <div key={idx} className={`flex items-start gap-2.5 ${msg.sender === "user" ? "flex-row-reverse" : "flex-row"}`}>
                {msg.sender === "assistant" && (
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary border border-primary/15 text-xs font-semibold select-none">
                    AI
                  </div>
                )}
                <div className="flex flex-col gap-1 max-w-[80%]">
                  <div
                    className={`rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed whitespace-pre-wrap ${
                      msg.sender === "user"
                        ? "bg-primary text-primary-foreground font-medium rounded-tr-none shadow-sm shadow-primary/10"
                        : "bg-muted text-foreground rounded-tl-none border border-border/30"
                    }`}
                  >
                    {msg.text}
                  </div>
                  {/* Read aloud option for AI responses */}
                  {msg.sender === "assistant" && msg.text !== t("assistantWelcome") && (
                    <div className="self-start mt-0.5">
                      <ReadAloudControls text={msg.text} />
                    </div>
                  )}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex items-center gap-2 text-muted-foreground text-xs pl-9">
                <Sparkles className="h-3.5 w-3.5 animate-spin text-primary" />
                <span>{t("generating")}</span>
              </div>
            )}
          </CardContent>

          {/* Prompt Chips */}
          <div className="px-4 py-2 flex flex-wrap gap-1.5 border-t border-border/20 bg-muted/20">
            <button
              onClick={() => handleSend(t("quickSummary"))}
              className="text-[10px] font-semibold text-primary bg-primary/10 px-2.5 py-1 rounded-full border border-primary/15 hover:bg-primary/20 transition"
              disabled={loading}
            >
              📝 {t("quickSummary")}
            </button>
            <button
              onClick={() => handleSend(t("quickSimplify"))}
              className="text-[10px] font-semibold text-foreground/80 bg-muted px-2.5 py-1 rounded-full border border-border hover:bg-muted/80 transition"
              disabled={loading}
            >
              💡 {t("quickSimplify")}
            </button>
          </div>

          {/* Chat Input */}
          <CardFooter className="border-t border-border/40 p-3 bg-card/45 rounded-b-2xl">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSend(input);
              }}
              className="flex w-full items-center gap-2"
            >
              <Input
                placeholder={t("chatPlaceholder")}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                disabled={loading}
                className="flex-1 h-9 text-xs rounded-xl bg-muted/40 border-border/60 focus-visible:ring-1 focus-visible:ring-primary focus-visible:ring-offset-0"
              />
              <Button type="submit" size="icon" className="h-9 w-9 shrink-0 rounded-xl" disabled={loading || !input.trim()}>
                <Send className="h-3.5 w-3.5" />
              </Button>
            </form>
          </CardFooter>
        </Card>
      )}

      {/* Floating Toggle Button */}
      <Button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2.5 h-12 px-4 rounded-full shadow-xl shadow-primary/20 hover:scale-105 transition-all duration-300 animate-fade-in group border border-primary/20"
      >
        <Sparkles className="h-5 w-5 text-primary-foreground group-hover:rotate-12 transition-transform duration-300" />
        <span className="text-xs font-semibold tracking-wide">{t("assistantTitle")}</span>
        {messages.length > 1 && !open && (
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold">
            {messages.length - 1}
          </span>
        )}
      </Button>
    </div>
  );
}
