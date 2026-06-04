import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useLanguage } from "@/hooks/use-language";
import { LanguageSelector } from "@/components/LanguageSelector";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LessonSection } from "@/components/LessonSection";
import { checkAndAwardBadges } from "@/lib/achievements";
import { 
  ArrowLeft, GraduationCap, Calendar, Clock, Award, 
  Loader2, CheckCircle2, AlertCircle, AlertTriangle
} from "lucide-react";

export const Route = createFileRoute("/assignment/$id")({
  component: StudentAssignmentPortal,
});

type AssignmentData = {
  id: string;
  title: string;
  due_date: string | null;
  lesson_id: string;
  lessons: {
    id: string;
    title: string;
    subject: string | null;
    grade: string | null;
    duration: string | null;
    language: string | null;
    objectives: string | null;
    lesson_plan: string | null;
    worksheet: string | null;
    quiz: string | null;
    homework: string | null;
  } | null;
};

type QuizQuestion = {
  question: string;
  options: string[];
  answer: string;
};

function StudentAssignmentPortal() {
  const { id } = Route.useParams();
  const { user, loading: authLoading } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();

  const [assignment, setAssignment] = useState<AssignmentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>([]);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, string>>({});
  
  // Submission flow states
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submissionScore, setSubmissionScore] = useState<number | null>(null);
  const [correctAnswersCount, setCorrectAnswersCount] = useState(0);
  const [submissionError, setSubmissionError] = useState<string | null>(null);

  // Load assignment data
  useEffect(() => {
    (async () => {
      try {
        const { data, error } = await supabase
          .from("assignments")
          .select(`
            id,
            title,
            due_date,
            lesson_id,
            lessons (
              id,
              title,
              subject,
              grade,
              duration,
              language,
              objectives,
              lesson_plan,
              worksheet,
              quiz,
              homework
            )
          `)
          .eq("id", id)
          .maybeSingle();

        if (error) throw error;
        
        if (data) {
          const formatted = {
            id: data.id,
            title: data.title,
            due_date: data.due_date,
            lesson_id: data.lesson_id,
            lessons: Array.isArray(data.lessons) ? data.lessons[0] : data.lessons
          } as AssignmentData;

          setAssignment(formatted);

          // Parse Quiz Questions
          if (formatted.lessons?.quiz) {
            try {
              const parsed = JSON.parse(formatted.lessons.quiz);
              if (Array.isArray(parsed)) {
                setQuizQuestions(parsed);
              }
            } catch (err) {
              console.warn("Failed to parse lesson quiz JSON:", err);
            }
          }
        }
      } catch (err) {
        console.error("Error loading assignment:", err);
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const handleSelectOption = (questionIndex: number, option: string) => {
    if (submitted) return;
    setSelectedAnswers(prev => ({
      ...prev,
      [questionIndex]: option
    }));
  };

  const handleSubmit = async () => {
    if (!user) return;
    if (quizQuestions.length > 0 && Object.keys(selectedAnswers).length < quizQuestions.length) {
      setSubmissionError("Please answer all quiz questions before submitting your assignment.");
      return;
    }

    setSubmitting(true);
    setSubmissionError(null);

    try {
      // Grade quiz questions
      let correct = 0;
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

      const totalQs = quizQuestions.length || 1;
      const pctScore = Math.round((correct / totalQs) * 100);

      setSubmissionScore(pctScore);
      setCorrectAnswersCount(correct);

      // 1. Write to submissions table
      const { error: subErr } = await supabase
        .from("submissions")
        .insert({
          assignment_id: id,
          student_id: user.id,
          answers: JSON.stringify(selectedAnswers),
          score: pctScore,
          status: "completed"
        });

      if (subErr) throw subErr;

      // 2. Write to student_progress table
      const { error: progErr } = await supabase
        .from("student_progress")
        .insert({
          student_id: user.id,
          lesson_id: assignment?.lesson_id!,
          quiz_score: correct,
          quiz_total: totalQs
        });

      if (progErr) throw progErr;

      // 3. Award badges
      await checkAndAwardBadges(user.id);

      setSubmitted(true);
    } catch (err: any) {
      console.error("Error submitting assignment:", err);
      setSubmissionError(err.message || "Failed to submit assignment. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading assignment materials...</p>
        </div>
      </div>
    );
  }

  // Not Logged In screen
  if (!user) {
    return (
      <div className="relative min-h-screen bg-background">
        <header className="sticky top-0 z-40 border-b border-border bg-card/85 backdrop-blur">
          <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
            <Link to="/" className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <GraduationCap className="h-5 w-5" />
              </div>
              <span className="font-semibold tracking-tight">TechFlow AI</span>
            </Link>
            <div className="flex items-center gap-4">
              <ThemeToggle />
              <LanguageSelector />
            </div>
          </div>
        </header>

        <div className="mx-auto max-w-md px-6 py-20">
          <Card className="border-border bg-card/50 backdrop-blur">
            <CardHeader className="text-center">
              <AlertCircle className="h-10 w-10 text-amber-500 mx-auto mb-2" />
              <CardTitle>Sign In Required</CardTitle>
              <CardDescription>
                You must be logged in as a student to complete assignments, save scores, and earn badges.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              <Button onClick={() => navigate({ to: `/login`, search: { redirect: `/assignment/${id}` } as any })}>
                Sign in to TechFlow AI
              </Button>
              <Button variant="ghost" asChild>
                <Link to="/explore">Explore Public Library</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (!assignment) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 bg-background">
        <AlertTriangle className="h-12 w-12 text-red-500" />
        <h2 className="text-xl font-bold">Assignment Not Found</h2>
        <p className="text-muted-foreground">The assignment link may be broken or expired.</p>
        <Button asChild><Link to="/dashboard">Go to Dashboard</Link></Button>
      </div>
    );
  }

  const lesson = assignment.lessons;

  // Render Post-submission Report Card
  if (submitted) {
    return (
      <div className="relative min-h-screen bg-background">
        <header className="sticky top-0 z-40 border-b border-border bg-card/85 backdrop-blur">
          <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
            <Link to="/dashboard" className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <GraduationCap className="h-5 w-5" />
              </div>
              <span className="font-semibold tracking-tight">TechFlow AI</span>
            </Link>
            <div className="flex items-center gap-4">
              <ThemeToggle />
              <LanguageSelector />
            </div>
          </div>
        </header>

        <div className="mx-auto max-w-xl px-6 py-16">
          <Card className="border-border bg-card/45 backdrop-blur-sm relative overflow-hidden">
            <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-green-500 via-primary to-blue-500" />
            <CardHeader className="text-center pb-2">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-green-500/10 text-green-500 mb-4 animate-bounce">
                <CheckCircle2 className="h-8 w-8" />
              </div>
              <CardTitle className="text-2xl font-bold text-foreground">Assignment Submitted!</CardTitle>
              <CardDescription>Excellent work completing your assigned coursework.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 text-center">
              <div className="rounded-xl bg-secondary/40 border p-6 max-w-xs mx-auto">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">Quiz Score</span>
                <span className="text-4xl font-extrabold text-primary my-1.5 block">{submissionScore}%</span>
                <span className="text-xs text-muted-foreground flex items-center justify-center gap-1"><Award className="h-3.5 w-3.5 text-amber-500" /> {correctAnswersCount} of {quizQuestions.length} correct</span>
              </div>

              <div className="space-y-2 text-sm text-muted-foreground max-w-md mx-auto leading-relaxed">
                <p>Your performance has been recorded. Check your profile to view updated streak metrics, accumulated XP, and any newly unlocked study badges!</p>
              </div>
            </CardContent>
            <div className="p-6 pt-0 flex flex-col gap-2">
              <Button asChild className="w-full">
                <Link to="/progress">View My Progress Dashboard</Link>
              </Button>
              <Button variant="ghost" asChild className="w-full">
                <Link to="/dashboard">Return to Main Dashboard</Link>
              </Button>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-card/85 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <Link to="/dashboard" className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <GraduationCap className="h-5 w-5" />
            </div>
            <span className="font-semibold tracking-tight">TechFlow AI</span>
          </Link>
          <div className="flex items-center gap-4">
            <ThemeToggle />
            <LanguageSelector />
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-6 py-8 space-y-6">
        {/* Back Link */}
        <Link to="/dashboard" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Dashboard
        </Link>

        {/* Info header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b pb-6">
          <div>
            <span className="text-xs font-semibold bg-primary/10 text-primary px-2.5 py-1 rounded-full uppercase tracking-wider">Student Assignment</span>
            <h1 className="text-2xl font-bold tracking-tight mt-2 sm:text-3xl">{assignment.title}</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Subject: {lesson?.subject ?? "General"} · Grade: {lesson?.grade ?? "—"}
            </p>
          </div>
          {assignment.due_date && (
            <div className="flex items-center gap-2 rounded-lg border border-border/80 bg-card p-3 text-xs sm:self-start">
              <Clock className="h-4 w-4 text-primary animate-pulse" />
              <div className="leading-tight">
                <span className="font-bold text-foreground block">Due Date</span>
                <span className="text-muted-foreground">{new Date(assignment.due_date).toLocaleDateString()}</span>
              </div>
            </div>
          )}
        </div>

        {/* Main Content Layout */}
        <Tabs defaultValue="lesson" className="w-full space-y-6">
          <TabsList className="grid w-full grid-cols-2 max-w-md">
            <TabsTrigger value="lesson">Lesson Content</TabsTrigger>
            <TabsTrigger value="quiz" disabled={quizQuestions.length === 0}>
              Practice Quiz ({quizQuestions.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="lesson" className="space-y-6 outline-none">
            <Card>
              <CardContent className="pt-6">
                {lesson ? (
                  <div className="space-y-6">
                    {/* Objectives */}
                    {lesson.objectives && (
                      <div className="rounded-xl border bg-secondary/15 p-4 text-sm text-muted-foreground leading-relaxed">
                        <span className="font-semibold text-foreground">Objectives:</span> {lesson.objectives}
                      </div>
                    )}

                    {/* Tabs / Accordion for study components */}
                    <div className="space-y-6">
                      <div>
                        <h3 className="text-lg font-bold border-b pb-2 mb-4 text-foreground">{t("lessonPlan")}</h3>
                        <LessonSection 
                          title={t("lessonPlan")} 
                          content={lesson.lesson_plan ?? ""} 
                          subject={lesson.subject ?? undefined} 
                          topic={lesson.title} 
                          lessonMetadata={lesson} 
                        />
                      </div>
                      
                      {lesson.worksheet && (
                        <div>
                          <h3 className="text-lg font-bold border-b pb-2 mb-4 text-foreground">{t("worksheet")}</h3>
                          <LessonSection 
                            title={t("worksheet")} 
                            content={lesson.worksheet} 
                            subject={lesson.subject ?? undefined} 
                            topic={lesson.title} 
                            lessonMetadata={lesson} 
                          />
                        </div>
                      )}
                      
                      {lesson.homework && (
                        <div>
                          <h3 className="text-lg font-bold border-b pb-2 mb-4 text-foreground">{t("homework")}</h3>
                          <LessonSection 
                            title={t("homework")} 
                            content={lesson.homework} 
                            subject={lesson.subject ?? undefined} 
                            topic={lesson.title} 
                            lessonMetadata={lesson} 
                            showAnswerKey={false}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="text-center text-muted-foreground py-10">No content available for this lesson.</div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="quiz" className="space-y-6 outline-none">
            <div className="grid gap-6">
              {quizQuestions.map((q, qIndex) => (
                <Card key={qIndex} className="border-border bg-card/45 backdrop-blur-sm">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base font-semibold leading-relaxed flex gap-2">
                      <span className="text-primary font-bold">Q{qIndex + 1}.</span>
                      {q.question}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-2.5 sm:grid-cols-2">
                      {q.options.map((option, oIndex) => {
                        const isSelected = selectedAnswers[qIndex] === option;
                        return (
                          <button
                            key={oIndex}
                            onClick={() => handleSelectOption(qIndex, option)}
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

              {submissionError && (
                <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-4 text-sm text-red-500 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{submissionError}</span>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-4 border-t border-border">
                <Button size="lg" className="min-w-[160px] gap-1.5" onClick={handleSubmit} disabled={submitting}>
                  {submitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-5 w-5" />
                      Submit Assignment
                    </>
                  )}
                </Button>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
