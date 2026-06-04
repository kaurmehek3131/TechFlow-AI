import { Copy, Check, CheckCircle2, XCircle, HelpCircle, BookOpen, Layers, Download, Clock, Star, HelpCircle as HelpIcon } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { ReadAloudControls } from "@/components/ReadAloudControls";
import { FlashcardsGenerator } from "./FlashcardsGenerator";
import { useLanguage } from "@/hooks/use-language";
import { exportSectionToPDF } from "@/lib/pdf-export";

type QuizQuestion = {
  question: string;
  options: string[];
  answer: string;
};

type QuestionPanelData = {
  short: string[];
  medium: string[];
  long: string[];
};

export function LessonSection({
  title,
  content,
  subject,
  topic,
  showAnswerKey = true,
  lessonMetadata
}: {
  title: string;
  content: string;
  subject?: string;
  topic?: string;
  showAnswerKey?: boolean;
  lessonMetadata?: {
    title: string;
    subject?: string;
    grade?: string;
    duration?: string;
    language?: string;
    topic?: string;
  };
}) {
  const { t } = useLanguage();
  const [copied, setCopied] = useState(false);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, number>>({});
  const [activeTab, setActiveTab] = useState<"short" | "medium" | "long">("short");
  const [subTab, setSubTab] = useState<"quiz" | "flashcards">("quiz");

  // Helper to parse plain-text or JSON quiz content
  const parseQuizContent = (contentStr: string): QuizQuestion[] => {
    try {
      const parsed = JSON.parse(contentStr);
      if (Array.isArray(parsed)) {
        return parsed.map((q: any) => ({
          question: q.question || "",
          options: Array.isArray(q.options) ? q.options : [],
          answer: String(q.answer || "").trim().toUpperCase()
        }));
      }
    } catch (e) {
      // Fallback manual parser for plain-text quizzes
    }

    const questions: QuizQuestion[] = [];
    const sections = contentStr.split(/(?=\b\d+[\.\)\s])/g);

    for (const sec of sections) {
      if (!sec.trim()) continue;

      const lines = sec.split("\n").map(l => l.trim()).filter(Boolean);
      let questionText = "";
      const options: string[] = [];
      let answer = "";

      // Look for the question title (first line)
      if (lines[0]) {
        questionText = lines[0].replace(/^\d+[\.\)\s-]+\s*/, "");
      }

      for (const line of lines) {
        if (line.match(/^[A-D][\)\.\s\-]/i)) {
          options.push(line.replace(/^[A-D][\)\.\s\-]\s*/i, ""));
        } else if (line.toLowerCase().includes("answer:") || line.toLowerCase().includes("correct:")) {
          const match = line.match(/(?:answer|correct):\s*([A-D])/i);
          if (match) answer = match[1].toUpperCase();
        }
      }

      if (questionText && options.length > 0) {
        questions.push({
          question: questionText,
          options,
          answer: answer || "A"
        });
      }
    }

    return questions;
  };

  // Helper to parse question panel data from worksheet
  const getWorksheetData = (contentStr: string): { worksheetText: string; questionPanel: QuestionPanelData | null } => {
    let worksheetText = contentStr;
    let questionPanel: QuestionPanelData | null = null;

    if (contentStr.includes("---QUESTION_PANEL---")) {
      const parts = contentStr.split("---QUESTION_PANEL---");
      worksheetText = parts[0].trim();
      try {
        questionPanel = JSON.parse(parts[1].trim());
      } catch (e) {
        console.error("Failed to parse question panel JSON:", e);
      }
    }

    // Default premium fallback if no question panel was provided
    if (!questionPanel && title === "Worksheet") {
      questionPanel = {
        short: [
          "State the primary concept or definition presented in this worksheet.",
          "Identify two crucial keywords or components mentioned in the text.",
          "Write down one quick takeaway that you found most interesting."
        ],
        medium: [
          "Explain the overall mechanism or process described in this worksheet.",
          "How does this topic relate to other areas of study in this subject?",
          "Give a concrete scenario illustrating the application of this concept."
        ],
        long: [
          "Compare and contrast the ideas in this worksheet with a practical real-world alternative.",
          "Summarize the main learnings of this worksheet in a structured paragraph.",
          "Propose an experiment or analytical question based on today's worksheet topic."
        ]
      };
    }

    return { worksheetText, questionPanel };
  };

  const { worksheetText, questionPanel } = getWorksheetData(content);
  const isQuiz = title.toLowerCase().includes("quiz");
  const isRubric = title.toLowerCase().includes("rubric");
  const isHomework = title.toLowerCase().includes("homework");

  let rubricObj: any = null;
  if (isRubric && content) {
    try {
      rubricObj = JSON.parse(content);
    } catch (e) {
      console.warn("Failed to parse rubric JSON:", e);
    }
  }

  let homeworkObj: any = null;
  if (isHomework && content) {
    try {
      homeworkObj = JSON.parse(content);
    } catch (e) {
      console.warn("Failed to parse homework JSON:", e);
    }
  }

  const quizQuestions = isQuiz ? parseQuizContent(content) : [];

  const getQuizSpeechText = () => {
    return quizQuestions.map((q, idx) => `Question ${idx + 1}: ${q.question}. Options: ${q.options.join(", ")}`).join(". ");
  };

  const textToRead = isQuiz 
    ? getQuizSpeechText() 
    : (title.toLowerCase().includes("worksheet") ? worksheetText : content);

  const copy = async () => {
    let textToCopy = content;
    
    if (isQuiz && quizQuestions.length > 0) {
      textToCopy = quizQuestions.map((q, idx) => {
        return `Question ${idx + 1}: ${q.question}\n` +
          q.options.map((opt, oIdx) => `  ${String.fromCharCode(65 + oIdx)}) ${opt}`).join("\n") +
          `\nCorrect Answer: ${q.answer}\n`;
      }).join("\n");
    } else if (content.includes("---QUESTION_PANEL---")) {
      const parts = content.split("---QUESTION_PANEL---");
      textToCopy = parts[0].trim();
      if (questionPanel) {
        textToCopy += "\n\n=== QUESTION PANEL ===\n\n" +
          "Short Length Questions:\n" + questionPanel.short.map(q => `- ${q}`).join("\n") + "\n\n" +
          "Medium Length Questions:\n" + questionPanel.medium.map(q => `- ${q}`).join("\n") + "\n\n" +
          "Short Length Questions (Set 2):\n" + questionPanel.long.map(q => `- ${q}`).join("\n");
      }
    }

    await navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    toast.success(`${title} copied to clipboard`);
    setTimeout(() => setCopied(false), 1500);
  };

  // Helper to parse inline bold styles
  const parseInlineStyles = (text: string) => {
    const parts = text.split(/\*\*([^*]+)\*\*/g);
    return parts.map((part, index) => {
      if (index % 2 === 1) {
        return <strong key={index} className="font-semibold text-foreground">{part}</strong>;
      }
      return part;
    });
  };

  // Beautiful parsed renderer replacing raw markdown characters
  const renderStudyFormattedContent = (text: string) => {
    const lines = text.split("\n");
    return (
      <div className="space-y-3.5">
        {lines.map((line, idx) => {
          let trimmed = line.trim();
          if (!trimmed) return <div key={idx} className="h-1.5" />;

          // Header 1 (e.g. # or 🎓)
          if (trimmed.startsWith("#") || trimmed.startsWith("🎓")) {
            const val = trimmed.replace(/^[#\s🎓\s—]+/, "").trim();
            return (
              <h3 key={idx} className="text-xl font-bold tracking-tight text-primary mt-4 mb-2 flex items-center gap-2 border-b border-border/40 pb-2">
                🎓 {parseInlineStyles(val)}
              </h3>
            );
          }

          // Header 2 (e.g. ## or section emojis)
          if (trimmed.startsWith("##") || trimmed.match(/^(📖|🎯|⏱️|🏫|🤝|✏️|✅)/)) {
            const firstEmoji = trimmed.match(/^(📖|🎯|⏱️|🏫|🤝|✏️|✅)/)?.[0];
            const val = trimmed.replace(/^(##|📖|🎯|⏱️|🏫|🤝|✏️|✅)+/, "").replace(/^[\s—\-\*]+/, "").trim();
            const emoji = firstEmoji || "📚";
            return (
              <h4 key={idx} className="text-md font-semibold tracking-tight text-foreground/90 mt-4 mb-2 flex items-center gap-2">
                <span className="text-lg">{emoji}</span> {parseInlineStyles(val)}
              </h4>
            );
          }

          // Bullet points (- or * or •)
          if (trimmed.startsWith("-") || trimmed.startsWith("*") || trimmed.startsWith("•")) {
            const val = trimmed.replace(/^[\-\*\•\s]+/, "").trim();
            return (
              <div key={idx} className="flex items-start gap-2.5 pl-4 py-0.5">
                <span className="text-primary mt-1 text-xs select-none">✏️</span>
                <span className="text-sm text-foreground/80 leading-relaxed">{parseInlineStyles(val)}</span>
              </div>
            );
          }

          // Plain text
          return (
            <p key={idx} className="text-sm text-foreground/80 leading-relaxed">
              {parseInlineStyles(trimmed)}
            </p>
          );
        })}
      </div>
    );
  };

  const handleOptionClick = (questionIdx: number, optionIdx: number) => {
    if (selectedAnswers[questionIdx] !== undefined) return; // Prevent changing answer
    setSelectedAnswers(prev => ({ ...prev, [questionIdx]: optionIdx }));
  };

  const checkIsCorrect = (q: QuizQuestion, optIndex: number) => {
    const letters = ["A", "B", "C", "D"];
    const normalizedAns = q.answer.trim().toUpperCase();
    if (letters[optIndex] === normalizedAns) return true;
    if (q.options[optIndex] === q.answer) return true;
    return false;
  };

  // Count score
  const answeredCount = Object.keys(selectedAnswers).length;
  const correctCount = quizQuestions.reduce((acc, q, idx) => {
    const selIdx = selectedAnswers[idx];
    if (selIdx !== undefined && checkIsCorrect(q, selIdx)) {
      return acc + 1;
    }
    return acc;
  }, 0);

  const downloadPDF = () => {
    exportSectionToPDF(title, content, {
      title: lessonMetadata?.title || "Lesson Section",
      subject: lessonMetadata?.subject || subject,
      grade: lessonMetadata?.grade,
      duration: lessonMetadata?.duration,
      language: lessonMetadata?.language || "English",
      topic: lessonMetadata?.topic || topic
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg">📘</span>
          <h3 className="text-lg font-semibold tracking-tight">{title}</h3>
        </div>
        <div className="flex items-center gap-2">
          <ReadAloudControls text={textToRead} />
          <Button variant="outline" size="sm" onClick={copy} className="hover:bg-muted">
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            <span className="ml-2">Copy</span>
          </Button>
          <Button variant="outline" size="sm" onClick={downloadPDF} className="hover:bg-muted">
            <Download className="h-4 w-4" />
            <span className="ml-2">{t("downloadPdf")}</span>
          </Button>
        </div>
      </div>

      {isQuiz && (
        <div className="flex flex-wrap gap-1.5 p-1 bg-muted/65 rounded-lg max-w-[280px] border border-border/30">
          <button
            onClick={() => setSubTab("quiz")}
            className={`flex-1 px-3 py-1.5 text-xs font-semibold rounded-md transition-all flex items-center justify-center gap-1.5 ${
              subTab === "quiz"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
            }`}
          >
            <HelpCircle className="h-3.5 w-3.5" />
            {t("quizGenerator")}
          </button>
          <button
            onClick={() => setSubTab("flashcards")}
            className={`flex-1 px-3 py-1.5 text-xs font-semibold rounded-md transition-all flex items-center justify-center gap-1.5 ${
              subTab === "flashcards"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
            }`}
          >
            <BookOpen className="h-3.5 w-3.5" />
            {t("flashcards")}
          </button>
        </div>
      )}

      <div className="rounded-xl border border-border bg-card/45 p-6 shadow-sm">
        {/* INTERACTIVE QUIZ SECTION */}
        {isQuiz && subTab === "flashcards" ? (
          <FlashcardsGenerator defaultSubject={subject} defaultTopic={topic} />
        ) : isQuiz && quizQuestions.length > 0 ? (
          <div className="space-y-6">
            {quizQuestions.map((q, qIdx) => {
              const selectedOptIdx = selectedAnswers[qIdx];
              const isAnswered = selectedOptIdx !== undefined;

              return (
                <div key={qIdx} className="space-y-3 pb-6 border-b border-border/30 last:border-b-0 last:pb-0">
                  <div className="flex items-start gap-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                      {qIdx + 1}
                    </span>
                    <h4 className="text-sm font-medium leading-relaxed text-foreground/90">{q.question}</h4>
                  </div>

                  <div className="grid gap-2 pl-9 sm:grid-cols-2">
                    {q.options.map((opt, optIdx) => {
                      const letters = ["A", "B", "C", "D"];
                      const isOptionSelected = selectedOptIdx === optIdx;
                      const isOptionCorrect = checkIsCorrect(q, optIdx);

                      let buttonStyle = "border-border/60 hover:bg-muted/40 text-foreground/80";
                      let indicatorIcon = null;

                      if (isAnswered) {
                        if (isOptionCorrect) {
                          buttonStyle = "border-green-500 bg-green-500/10 text-green-700 dark:text-green-400 font-medium";
                          indicatorIcon = <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400 shrink-0" />;
                        } else if (isOptionSelected) {
                          buttonStyle = "border-red-500 bg-red-500/10 text-red-700 dark:text-red-400";
                          indicatorIcon = <XCircle className="h-4 w-4 text-red-600 dark:text-red-400 shrink-0" />;
                        } else {
                          buttonStyle = "opacity-60 border-border/30 bg-muted/10 text-muted-foreground cursor-not-allowed";
                        }
                      }

                      return (
                        <button
                          key={optIdx}
                          onClick={() => handleOptionClick(qIdx, optIdx)}
                          disabled={isAnswered}
                          className={`flex items-center justify-between text-left p-3 rounded-lg border text-xs transition-all duration-200 outline-none ${buttonStyle}`}
                        >
                          <span className="flex items-center gap-2">
                            <span className="font-semibold text-muted-foreground select-none">
                              {letters[optIdx]}.
                            </span>
                            {opt}
                          </span>
                          {indicatorIcon}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            {/* Scorecard */}
            {answeredCount === quizQuestions.length && (
              <div className="mt-4 flex flex-col items-center justify-center p-4 rounded-xl border border-primary/20 bg-primary/5 text-center animate-fade-in">
                <span className="text-2xl mb-1">🎉</span>
                <h5 className="text-sm font-semibold text-foreground">Quiz Completed!</h5>
                <p className="text-xs text-muted-foreground mt-1">
                  You scored <strong className="text-primary">{correctCount}</strong> out of <strong className="text-foreground">{quizQuestions.length}</strong> correct.
                </p>
              </div>
            )}
          </div>
        ) : (
          /* STANDARD OR UPGRADED FORMATTED CONTENT (LESSON PLAN, WORKSHEET, ANSWER KEY, RUBRIC, HOMEWORK) */
          <div>
            {isRubric && rubricObj ? (
              <div className="space-y-6">
                <div className="overflow-x-auto rounded-xl border border-border bg-card/50 shadow-sm">
                  <table className="min-w-full divide-y divide-border text-xs">
                    <thead className="bg-muted/70">
                      <tr>
                        <th className="px-4 py-3 text-left font-bold text-muted-foreground w-1/5">Criteria</th>
                        <th className="px-4 py-3 text-left font-bold text-muted-foreground w-1/5">Excellent (4 pts)</th>
                        <th className="px-4 py-3 text-left font-bold text-muted-foreground w-1/5">Good (3 pts)</th>
                        <th className="px-4 py-3 text-left font-bold text-muted-foreground w-1/5">Developing (2 pts)</th>
                        <th className="px-4 py-3 text-left font-bold text-muted-foreground w-1/5">Beginning (1 pt)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border bg-card/30">
                      {rubricObj.criteria?.map((crit: any, idx: number) => (
                        <tr key={idx} className="hover:bg-muted/10 transition border-b border-border/40 last:border-0">
                          <td className="px-4 py-3 font-semibold text-foreground">{crit.name}</td>
                          <td className="px-4 py-3 text-muted-foreground leading-relaxed">{crit.levels?.Excellent || crit.Excellent}</td>
                          <td className="px-4 py-3 text-muted-foreground leading-relaxed">{crit.levels?.Good || crit.Good}</td>
                          <td className="px-4 py-3 text-muted-foreground leading-relaxed">{crit.levels?.Developing || crit.Developing}</td>
                          <td className="px-4 py-3 text-muted-foreground leading-relaxed">{crit.levels?.Beginning || crit.Beginning}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {rubricObj.teacher_guidance && (
                  <div className="p-4 rounded-xl border border-primary/20 bg-primary/5 text-xs">
                    <h4 className="font-bold text-primary mb-1">Grading Guidance</h4>
                    <p className="text-muted-foreground leading-relaxed">{rubricObj.teacher_guidance}</p>
                  </div>
                )}
              </div>
            ) : isHomework && homeworkObj ? (
              <div className="space-y-6">
                <div className="flex flex-wrap gap-2.5">
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border bg-muted/40 text-xs font-medium text-muted-foreground">
                    <Clock className="h-3.5 w-3.5 text-primary" />
                    <span>Estimated Time: <strong>{homeworkObj.estimated_time || "30 mins"}</strong></span>
                  </div>
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border bg-muted/40 text-xs font-medium text-muted-foreground">
                    <Star className="h-3.5 w-3.5 text-yellow-500" />
                    <span>Difficulty: <strong>{homeworkObj.difficulty_level || "Medium"}</strong></span>
                  </div>
                </div>

                <div className="space-y-4 border-t border-border/50 pt-4">
                  <h4 className="text-sm font-semibold flex items-center gap-2">
                    <Layers className="h-4 w-4 text-primary" /> Homework Tasks
                  </h4>
                  <div className="space-y-3">
                    {homeworkObj.tasks?.map((task: any, idx: number) => (
                      <div key={idx} className="flex gap-3 bg-muted/15 p-4 rounded-xl border border-border/30">
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">
                          {idx + 1}
                        </span>
                        <p className="text-xs text-foreground/80 leading-relaxed">{task.question}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {showAnswerKey && homeworkObj.answer_key && (
                  <div className="p-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 text-xs mt-4">
                    <h4 className="font-bold text-emerald-600 dark:text-emerald-400 mb-1">Homework Answer Key</h4>
                    <p className="text-muted-foreground whitespace-pre-wrap leading-relaxed">{homeworkObj.answer_key}</p>
                  </div>
                )}
              </div>
            ) : (
              <div>
                {renderStudyFormattedContent(isQuiz ? content : worksheetText)}

                {/* QUESTION PANEL (ONLY UNDER WORKSHEET) */}
                {!isQuiz && title === "Worksheet" && questionPanel && (
                  <div className="mt-8 pt-8 border-t border-border/60">
                    <div className="flex items-center gap-2.5 mb-4">
                      <Layers className="h-5 w-5 text-primary" />
                      <h4 className="text-md font-bold tracking-tight text-foreground">🧠 Question Panel</h4>
                    </div>
                    <p className="text-xs text-muted-foreground mb-4">
                      AI-generated practice questions corresponding directly to the worksheet topic, split into 3 difficulty segments:
                    </p>

                    {/* custom tabs selector */}
                    <div className="flex flex-wrap gap-1.5 p-1 bg-muted/60 rounded-lg max-w-md mb-4 border border-border/30">
                      <button
                        onClick={() => setActiveTab("short")}
                        className={`flex-1 px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                          activeTab === "short"
                            ? "bg-background text-foreground shadow-sm"
                            : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
                        }`}
                      >
                        Short length
                      </button>
                      <button
                        onClick={() => setActiveTab("medium")}
                        className={`flex-1 px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                          activeTab === "medium"
                            ? "bg-background text-foreground shadow-sm"
                            : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
                        }`}
                      >
                        Medium length
                      </button>
                      <button
                        onClick={() => setActiveTab("long")}
                        className={`flex-1 px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                          activeTab === "long"
                            ? "bg-background text-foreground shadow-sm"
                            : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
                        }`}
                      >
                        Short length (Set 2)
                      </button>
                    </div>

                    {/* Tab content panel */}
                    <div className="space-y-2.5 bg-muted/20 p-4 rounded-xl border border-border/30">
                      {activeTab === "short" &&
                        questionPanel.short.map((q, idx) => (
                          <div key={idx} className="flex gap-2 text-xs text-foreground/80 pl-2">
                            <span className="text-primary font-bold">{idx + 1}.</span>
                            <p className="leading-relaxed">{q}</p>
                          </div>
                        ))}
                      {activeTab === "medium" &&
                        questionPanel.medium.map((q, idx) => (
                          <div key={idx} className="flex gap-2 text-xs text-foreground/80 pl-2">
                            <span className="text-primary font-bold">{idx + 1}.</span>
                            <p className="leading-relaxed">{q}</p>
                          </div>
                        ))}
                      {activeTab === "long" &&
                        questionPanel.long.map((q, idx) => (
                          <div key={idx} className="flex gap-2 text-xs text-foreground/80 pl-2">
                            <span className="text-primary font-bold">{idx + 1}.</span>
                            <p className="leading-relaxed">{q}</p>
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
