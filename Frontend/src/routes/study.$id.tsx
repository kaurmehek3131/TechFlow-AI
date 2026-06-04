import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useLanguage } from "@/hooks/use-language";
import { LanguageSelector } from "@/components/LanguageSelector";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { LessonSection } from "@/components/LessonSection";
import { ArrowLeft, GraduationCap, Sparkles, Bot, CheckCircle2, Loader2, Lock, AlertCircle } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { checkAndAwardBadges } from "@/lib/achievements";
import { toast } from "sonner";

type QuizQuestion = {
  question: string;
  options: string[];
  answer: string;
};

export const Route = createFileRoute("/study/$id")({
  component: PublicLesson,
  notFoundComponent: () => (
    <div className="p-10 text-center text-muted-foreground">
      Lesson not found or no longer public. <Link to="/explore" className="text-primary underline">Back to library</Link>
    </div>
  ),
});

type Lesson = {
  id: string;
  title: string;
  subject: string | null;
  grade: string | null;
  topic: string | null;
  duration: string | null;
  language: string | null;
  objectives: string | null;
  lesson_plan: string | null;
  worksheet: string | null;
  quiz: string | null;
  answer_key: string | null;
  rubric: string | null;
  homework: string | null;
  is_published: boolean;
  views_count?: number | null;
  short_summary?: string | null;
  revision_notes?: string | null;
  exam_notes?: string | null;
  one_minute_review?: string | null;
};

function PublicLesson() {
  const { id } = Route.useParams();
  const { user, role } = useAuth();
  const { t } = useLanguage();
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [loading, setLoading] = useState(true);
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>([]);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, string>>({});
  const [completed, setCompleted] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [quizScore, setQuizScore] = useState<number | null>(null);
  const [correctCount, setCorrectCount] = useState(0);
  const [quizError, setQuizError] = useState<string | null>(null);

  // Load lesson
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("lessons")
        .select("*")
        .eq("id", id)
        .eq("is_published", true)
        .maybeSingle();
      
      const lessonData = data as Lesson | null;
      setLesson(lessonData);
      
      if (lessonData?.quiz) {
        try {
          const parsed = JSON.parse(lessonData.quiz);
          if (Array.isArray(parsed)) {
            setQuizQuestions(parsed);
          }
        } catch (err) {
          console.warn("Failed to parse lesson quiz JSON:", err);
        }
      }
      setLoading(false);
    })();
  }, [id]);

  // Check if lesson is completed by student
  useEffect(() => {
    if (!user || !lesson) return;
    (async () => {
      try {
        const { data, error } = await supabase
          .from("student_progress")
          .select("id, quiz_score, quiz_total")
          .eq("student_id", user.id)
          .eq("lesson_id", lesson.id)
          .maybeSingle();
        
        if (data) {
          setCompleted(true);
          if (data.quiz_score !== null && data.quiz_total !== null) {
            setQuizScore(Math.round((data.quiz_score / data.quiz_total) * 100));
            setCorrectCount(data.quiz_score);
          }
        }
      } catch (err) {
        console.warn("Error checking lesson completion status:", err);
      }
    })();
  }, [user, lesson]);

  // Track page view
  useEffect(() => {
    if (!lesson) return;
    (async () => {
      try {
        await supabase
          .from("lessons")
          .update({ views_count: (lesson.views_count as any || 0) + 1 })
          .eq("id", id);
      } catch (err) {
        console.warn("Failed to increment views count:", err);
      }
    })();
  }, [lesson, id]);

  useEffect(() => {
    if (lesson) {
      localStorage.setItem("active_lesson_title", lesson.title);
      localStorage.setItem("active_lesson_plan", lesson.lesson_plan ?? "");
      localStorage.setItem("active_lesson_worksheet", lesson.worksheet ?? "");
      localStorage.setItem("active_lesson_objectives", lesson.objectives ?? "");
      localStorage.setItem("active_lesson_subject", lesson.subject ?? "");
    }
    return () => {
      localStorage.removeItem("active_lesson_title");
      localStorage.removeItem("active_lesson_plan");
      localStorage.removeItem("active_lesson_worksheet");
      localStorage.removeItem("active_lesson_objectives");
      localStorage.removeItem("active_lesson_subject");
    };
  }, [lesson]);

  const handleSelectOption = (questionIndex: number, option: string) => {
    if (completed) return;
    setSelectedAnswers(prev => ({
      ...prev,
      [questionIndex]: option
    }));
  };

  const handleCompleteLesson = async () => {
    if (!user || !lesson || completing || completed) return;
    
    // If there is a quiz, validate that all questions are answered
    if (quizQuestions.length > 0 && Object.keys(selectedAnswers).length < quizQuestions.length) {
      setQuizError("Please answer all quiz questions before submitting.");
      return;
    }

    setCompleting(true);
    setQuizError(null);
    try {
      let correct = 0;
      const totalQs = quizQuestions.length;

      if (totalQs > 0) {
        quizQuestions.forEach((q, index) => {
          const chosen = selectedAnswers[index];
          const correctLetter = q.answer?.trim() ?? "";
          
          // Case 1: correctLetter is A, B, C, D
          const optionIndexMap: Record<string, number> = { "A": 0, "B": 1, "C": 2, "D": 3 };
          const correctOptionIndex = optionIndexMap[correctLetter];
          
          let isCorrect = false;
          if (correctOptionIndex !== undefined) {
            const correctOptionText = q.options[correctOptionIndex];
            isCorrect = (chosen === correctOptionText);
          } else {
            // Case 2: correctLetter is the option text itself or letter is lowercase or index number
            if (chosen === correctLetter) {
              isCorrect = true;
            } else {
              // Check if correctLetter is lowercase a, b, c, d
              const correctOptionIndexLower = optionIndexMap[correctLetter.toUpperCase()];
              if (correctOptionIndexLower !== undefined) {
                isCorrect = (chosen === q.options[correctOptionIndexLower]);
              } else {
                // Check if it matches one of the options by index if it is a number
                const isNumeric = /^\d+$/.test(correctLetter);
                if (isNumeric) {
                  const idxNum = parseInt(correctLetter, 10);
                  if (idxNum >= 0 && idxNum < q.options.length) {
                    isCorrect = (chosen === q.options[idxNum]);
                  }
                }
              }
            }
          }

          if (isCorrect) {
            correct++;
          }
        });
      }

      // 1. Insert progress record
      const { error } = await supabase
        .from("student_progress")
        .insert({
          student_id: user.id,
          lesson_id: lesson.id,
          quiz_score: totalQs > 0 ? correct : null,
          quiz_total: totalQs > 0 ? totalQs : null
        });

      if (error) throw error;

      // 2. Award badges
      await checkAndAwardBadges(user.id);

      setCompleted(true);
      if (totalQs > 0) {
        const score = Math.round((correct / totalQs) * 100);
        setQuizScore(score);
        setCorrectCount(correct);
        toast.success(`Quiz submitted successfully! Score: ${score}%`);
      } else {
        toast.success("Lesson marked as completed! Earned +10 XP!");
      }
    } catch (err: any) {
      console.error("Error completing lesson:", err);
      toast.error("Failed to submit lesson completion: " + err.message);
    } finally {
      setCompleting(false);
    }
  };

  if (loading) return <div className="p-10 text-muted-foreground">Loading…</div>;
  if (!lesson) {
    return (
      <div className="p-10 text-center text-muted-foreground">
        This lesson isn't public. <Link to="/explore" className="text-primary underline">Browse the library</Link>.
      </div>
    );
  }

  const showAnswerKey = user && role === "teacher";

  return (
    <div className="relative min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-card/80 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <Link to={user ? "/dashboard" : "/"} className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <GraduationCap className="h-5 w-5" />
            </div>
            <span className="font-semibold tracking-tight">TechFlow AI</span>
          </Link>
          <div className="flex items-center gap-4">
            <LanguageSelector />
            {user ? (
              <Link to="/dashboard"><Button size="sm" variant="outline">Dashboard</Button></Link>
            ) : (
              <Link to="/login" search={{ redirect: `/study/${id}` } as any}>
                <Button size="sm">Sign in</Button>
              </Link>
            )}
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-4xl space-y-6 px-6 py-10">
        <Link to="/explore" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" /> {t("backToLibrary")}
        </Link>
        <div>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{lesson.title}</h1>
          <p className="mt-1 text-muted-foreground">
            {lesson.subject ?? "—"} · Grade {lesson.grade ?? "—"}
            {lesson.duration ? ` · ${lesson.duration}` : ""}
            {lesson.language ? ` · ${lesson.language}` : ""}
          </p>
          {lesson.objectives && (
            <p className="mt-3 rounded-lg border border-border bg-card/60 p-4 text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{t("learningObjectives")}:</span> {lesson.objectives}
            </p>
          )}
        </div>

        {/* AI Tutor doubt solver callout */}
        {user && (
          <Card className="border-primary/20 bg-gradient-to-r from-primary/10 via-accent/5 to-background hover:border-primary/30 transition-all duration-300 shadow-md">
            <CardContent className="p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center text-primary shrink-0 animate-pulse">
                  <Bot className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-foreground flex items-center gap-1.5">
                    {t("aiTutor")} Doubt Solver
                    <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary ring-1 ring-inset ring-primary/20">Active</span>
                  </h4>
                  <p className="text-xs text-muted-foreground mt-0.5">Have doubts about this lesson? Ask our interactive AI Tutor for explanations, practice questions, or simple breakdowns.</p>
                </div>
              </div>
              <Link to="/tutor" search={{ lessonId: lesson.id }}>
                <Button className="gap-2 shrink-0 bg-primary hover:bg-primary/90 text-primary-foreground font-medium shadow-sm transition-all hover:scale-[1.02] active:scale-[0.98]">
                  <Sparkles className="h-4 w-4" />
                  {t("askAiTutor")}
                </Button>
              </Link>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader><CardTitle>{t("studyMaterial")}</CardTitle></CardHeader>
          <CardContent>
            <Accordion type="multiple" defaultValue={["plan", "ws"]} className="w-full">
              {/* Lesson Plan */}
              <AccordionItem value="plan"><AccordionTrigger>{t("lessonPlan")}</AccordionTrigger>
                <AccordionContent><LessonSection title={t("lessonPlan")} content={lesson.lesson_plan ?? ""} subject={lesson.subject ?? undefined} topic={lesson.topic ?? undefined} lessonMetadata={lesson} /></AccordionContent>
              </AccordionItem>
              
              {/* Worksheet */}
              <AccordionItem value="ws"><AccordionTrigger>{t("worksheet")}</AccordionTrigger>
                <AccordionContent><LessonSection title={t("worksheet")} content={lesson.worksheet ?? ""} subject={lesson.subject ?? undefined} topic={lesson.topic ?? undefined} lessonMetadata={lesson} /></AccordionContent>
              </AccordionItem>
              
              {/* Quiz */}
              <AccordionItem value="quiz">
                <AccordionTrigger>
                  {t("quiz")} {completed && quizScore !== null && `(Score: ${quizScore}%)`}
                </AccordionTrigger>
                <AccordionContent>
                  {quizQuestions.length > 0 ? (
                    <div className="space-y-6 pt-2">
                      {quizQuestions.map((q, qIndex) => (
                        <Card key={qIndex} className="border-border/80 bg-card/10">
                          <CardContent className="pt-4 space-y-3">
                            <h4 className="text-sm font-bold leading-normal flex gap-2">
                              <span className="text-primary font-bold">Q{qIndex + 1}.</span>
                              {q.question}
                            </h4>
                            <div className="grid gap-2.5 sm:grid-cols-2">
                              {q.options.map((option, oIndex) => {
                                const isSelected = selectedAnswers[qIndex] === option;
                                return (
                                  <button
                                    key={oIndex}
                                    onClick={() => handleSelectOption(qIndex, option)}
                                    disabled={completed}
                                    className={`text-left p-3.5 rounded-lg border text-sm transition-all flex items-center gap-3 ${
                                      isSelected 
                                        ? "border-primary bg-primary/5 text-primary font-medium"
                                        : "border-border hover:bg-secondary/40 hover:border-border/80 bg-card/25"
                                    }`}
                                  >
                                    <span className={`h-5 w-5 rounded-full border flex items-center justify-center text-xs font-bold ${
                                      isSelected 
                                        ? "border-primary bg-primary text-primary-foreground" 
                                        : "border-border text-muted-foreground"
                                    }`}>
                                      {String.fromCharCode(65 + oIndex)}
                                    </span>
                                    <span className="flex-1 leading-normal">{option}</span>
                                  </button>
                                );
                              })}
                            </div>
                          </CardContent>
                        </Card>
                      ))}

                      {quizError && (
                        <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-3 text-xs text-red-500 flex items-center gap-1.5">
                          <AlertCircle className="h-4 w-4 shrink-0" />
                          <span>{quizError}</span>
                        </div>
                      )}

                      {completed && quizScore !== null && (
                        <div className="rounded-xl bg-green-500/10 border border-green-500/20 p-4 text-center space-y-1">
                          <p className="text-sm font-bold text-green-500">Quiz Completed!</p>
                          <p className="text-xs text-muted-foreground">You scored {correctCount} of {quizQuestions.length} correct ({quizScore}%).</p>
                        </div>
                      )}

                      {!completed && user && (
                        <div className="flex justify-end pt-2">
                          <Button onClick={handleCompleteLesson} disabled={completing} className="gap-1.5">
                            {completing ? (
                              <>
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Submitting...
                              </>
                            ) : (
                              <>
                                <CheckCircle2 className="h-4 w-4" />
                                Submit Quiz
                              </>
                            )}
                          </Button>
                        </div>
                      )}

                      {!completed && !user && (
                        <div className="flex justify-end pt-2">
                          <Link to="/login" search={{ redirect: `/study/${id}` } as any}>
                            <Button className="gap-1.5" variant="outline">
                              <CheckCircle2 className="h-4 w-4" />
                              Sign in to Submit Quiz
                            </Button>
                          </Link>
                        </div>
                      )}
                    </div>
                  ) : (
                    <LessonSection title={t("quiz")} content={lesson.quiz ?? ""} subject={lesson.subject ?? undefined} topic={lesson.topic ?? undefined} lessonMetadata={lesson} />
                  )}
                </AccordionContent>
              </AccordionItem>
              
              {/* Answer Key */}
              {showAnswerKey && (
                <AccordionItem value="ans"><AccordionTrigger>{t("answerKey")}</AccordionTrigger>
                  <AccordionContent><LessonSection title={t("answerKey")} content={lesson.answer_key ?? ""} subject={lesson.subject ?? undefined} topic={lesson.topic ?? undefined} lessonMetadata={lesson} /></AccordionContent>
                </AccordionItem>
              )}

              {/* Rubric */}
              {showAnswerKey && lesson.rubric && (
                <AccordionItem value="rubric"><AccordionTrigger>{t("rubric")}</AccordionTrigger>
                  <AccordionContent><LessonSection title={t("rubric")} content={lesson.rubric} subject={lesson.subject ?? undefined} topic={lesson.topic ?? undefined} lessonMetadata={lesson} /></AccordionContent>
                </AccordionItem>
              )}

              {/* Homework */}
              {lesson.homework && (
                <AccordionItem value="homework"><AccordionTrigger>{t("homework")}</AccordionTrigger>
                  <AccordionContent>
                    <LessonSection
                      title={t("homework")}
                      content={lesson.homework}
                      subject={lesson.subject ?? undefined}
                      topic={lesson.topic ?? undefined}
                      lessonMetadata={lesson}
                      showAnswerKey={showAnswerKey}
                    />
                  </AccordionContent>
                </AccordionItem>
              )}

              {/* Completion Submit Section */}
              <div className="flex justify-center pt-4">
                {user ? (
                  completed ? (
                    <div className="flex items-center gap-2 bg-green-500/10 text-green-500 border border-green-500/20 px-6 py-3 rounded-xl font-semibold shadow-sm">
                      <CheckCircle2 className="h-5 w-5 fill-green-500/5 animate-pulse" />
                      {quizQuestions.length > 0 
                        ? `Quiz Submitted! Score: ${quizScore}% (+10 XP Earned)` 
                        : "Lesson Completed! (+10 XP Earned)"
                      }
                    </div>
                  ) : (
                    quizQuestions.length === 0 && (
                      <Button 
                        onClick={handleCompleteLesson} 
                        disabled={completing} 
                        size="lg" 
                        className="gap-2 px-8 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-md transition-all hover:scale-[1.02] active:scale-[0.98]"
                      >
                        {completing ? (
                          <>
                            <Loader2 className="h-5 w-5 animate-spin" />
                            Submitting Completion...
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="h-5 w-5" />
                            Mark Lesson as Completed & Earn +10 XP
                          </>
                        )}
                      </Button>
                    )
                  )
                ) : (
                  quizQuestions.length === 0 && (
                    <Link to="/login" search={{ redirect: `/study/${id}` } as any}>
                      <Button 
                        size="lg" 
                        className="gap-2 px-8 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-md transition-all hover:scale-[1.02] active:scale-[0.98]"
                      >
                        <CheckCircle2 className="h-5 w-5" />
                        Sign in to Complete Lesson
                      </Button>
                    </Link>
                  )
                )}
              </div>

              {/* Study Guides & Summaries */}
              {lesson.short_summary && (
                <AccordionItem value="study_summaries">
                  <AccordionTrigger className="hover:no-underline">
                    <span className="flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-primary animate-pulse shrink-0" />
                      {t("studyGuides")}
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="pt-4">
                    <Tabs defaultValue="short" className="w-full">
                    <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 h-auto gap-1 max-w-lg mb-4">
                        <TabsTrigger value="short">{t("shortSummary")}</TabsTrigger>
                        <TabsTrigger value="revision">{t("revisionNotes")}</TabsTrigger>
                        <TabsTrigger value="exam">{t("examNotes")}</TabsTrigger>
                        <TabsTrigger value="review">{t("oneMinuteReview")}</TabsTrigger>
                      </TabsList>
                      <TabsContent value="short" className="space-y-2">
                        <LessonSection title={t("shortSummary")} content={lesson.short_summary || ""} subject={lesson.subject ?? undefined} topic={lesson.topic ?? undefined} lessonMetadata={lesson} />
                      </TabsContent>
                      <TabsContent value="revision" className="space-y-2">
                        <LessonSection title={t("revisionNotes")} content={lesson.revision_notes || ""} subject={lesson.subject ?? undefined} topic={lesson.topic ?? undefined} lessonMetadata={lesson} />
                      </TabsContent>
                      <TabsContent value="exam" className="space-y-2">
                        <LessonSection title={t("examNotes")} content={lesson.exam_notes || ""} subject={lesson.subject ?? undefined} topic={lesson.topic ?? undefined} lessonMetadata={lesson} />
                      </TabsContent>
                      <TabsContent value="review" className="space-y-2">
                        <LessonSection title={t("oneMinuteReview")} content={lesson.one_minute_review || ""} subject={lesson.subject ?? undefined} topic={lesson.topic ?? undefined} lessonMetadata={lesson} />
                      </TabsContent>
                    </Tabs>
                  </AccordionContent>
                </AccordionItem>
              )}
            </Accordion>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
