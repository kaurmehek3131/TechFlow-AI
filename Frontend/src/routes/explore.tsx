import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LanguageSelector } from "@/components/LanguageSelector";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useLanguage } from "@/hooks/use-language";
import { useAuth } from "@/hooks/use-auth";
import { GraduationCap, BookOpen, ArrowLeft, Loader2, Sparkles } from "lucide-react";
import { callMakeWebhook } from "@/lib/webhook";
import { toast } from "sonner";

export const Route = createFileRoute("/explore")({
  head: () => ({
    meta: [
      { title: "Explore study material — TechFlow AI" },
      { name: "description", content: "Browse free lesson plans, worksheets, quizzes, and study notes shared by teachers." },
    ],
  }),
  component: Explore,
});

type Row = { id: string; title: string; subject: string | null; grade: string | null; topic: string | null; created_at: string };

function Explore() {
  const { user, role } = useAuth();
  const { language, t } = useLanguage();
  const navigate = useNavigate();
  const [rows, setRows] = useState<Row[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("lessons")
        .select("id, title, subject, grade, topic, created_at")
        .eq("is_published", true)
        .order("created_at", { ascending: false })
        .limit(200);
      setRows(data ?? []);
      setLoading(false);
    })();
  }, []);

  const handleGenerateOnTheFly = async () => {
    if (!user) {
      toast.error("Please sign in to generate this study kit.");
      navigate({ to: "/login", search: { redirect: `/explore` } as any });
      return;
    }
    if (!q.trim()) return;

    setGenerating(true);
    const loadingToast = toast.loading(`AI is generating a complete study kit on "${q}"...`);
    try {
      // 1. Fetch webhook url
      const { data: profile } = await supabase.from("profiles").select("webhook_url").eq("id", user.id).maybeSingle();
      
      // 2. Call make webhook / Gemini fallback
      const out = await callMakeWebhook(profile?.webhook_url ?? "", {
        subject: "General",
        grade: "All Grades",
        topic: q,
        duration: "45 min",
        language: language || "English",
        objectives: `Complete study guide and quiz for ${q}.`
      });

      // 3. Insert into lessons
      const { data, error } = await supabase
        .from("lessons")
        .insert({
          user_id: user.id,
          title: `${q} (Study Kit)`,
          subject: "General",
          grade: "All Grades",
          topic: q,
          duration: "45 min",
          language: language || "English",
          objectives: `Complete study guide and quiz for ${q}.`,
          lesson_plan: out.lesson_plan,
          worksheet: out.worksheet,
          quiz: out.quiz,
          answer_key: out.answer_key,
          rubric: out.rubric,
          homework: out.homework,
          is_published: true
        })
        .select("id")
        .single();

      if (error) throw error;

      toast.dismiss(loadingToast);
      toast.success(`Successfully generated Study Kit for "${q}"!`);
      
      // 4. Redirect based on role
      if (role === "student") {
        navigate({ to: "/study/$id", params: { id: data.id } });
      } else {
        navigate({ to: "/lessons/$id", params: { id: data.id } });
      }
    } catch (err: any) {
      toast.dismiss(loadingToast);
      console.error("On-the-fly generation failed:", err);
      toast.error(err.message || "Failed to generate study kit. Please try again.");
    } finally {
      setGenerating(false);
    }
  };

  const filtered = rows.filter((r) => {
    const queryWords = q.toLowerCase().split(/\s+/).filter(Boolean);
    if (queryWords.length === 0) return true;
    
    return queryWords.every(word => {
      return (
        r.title.toLowerCase().includes(word) ||
        (r.subject ?? "").toLowerCase().includes(word) ||
        (r.topic ?? "").toLowerCase().includes(word) ||
        (r.grade ?? "").toLowerCase().includes(word) ||
        `grade ${r.grade ?? ""}`.toLowerCase().includes(word)
      );
    });
  });

  return (
    <div className="relative min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-card/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link to={user ? "/dashboard" : "/"} className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <GraduationCap className="h-5 w-5" />
            </div>
            <span className="font-semibold tracking-tight">TechFlow AI</span>
          </Link>
          <nav className="flex items-center gap-2">
            <ThemeToggle />
            <LanguageSelector />
            {!user && (
              <>
                <Link to="/login"><Button variant="ghost">Sign in</Button></Link>
                <Link to="/login"><Button>Get started</Button></Link>
              </>
            )}
          </nav>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-6 py-12">
        <Link to={user ? "/dashboard" : "/"} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" /> {t("backHome")}
        </Link>
        <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">{t("studyMaterialLibrary")}</h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          Free lesson plans, worksheets, quizzes, and answer keys published by teachers. Anyone can read them — no account required.
        </p>

        <div className="mt-6 max-w-md">
          <Input placeholder={t("searchPlaceholder")} value={q} onChange={(e) => setQ(e.target.value)} />
        </div>

        <div className="mt-8">
          {loading ? (
            <p className="text-muted-foreground">Loading…</p>
          ) : filtered.length === 0 ? (
            q.trim() ? (
              <Card className="border-primary/30 bg-gradient-to-r from-primary/10 via-accent/5 to-background hover:border-primary/45 transition-all duration-300 shadow-md">
                <CardContent className="py-10 px-6 text-center space-y-4">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/20 text-primary animate-pulse">
                    <Sparkles className="h-6 w-6" />
                  </div>
                  <div className="space-y-1.5 max-w-lg mx-auto">
                    <h3 className="text-xl font-bold text-foreground">
                      Create AI Study Kit for "{q}"
                    </h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      We couldn't find any existing public lessons matching your search. Would you like our AI assistant to instantly craft a complete lesson plan, worksheet, homework, and quiz on this topic?
                    </p>
                  </div>
                  <div className="pt-2">
                    {user ? (
                      <Button 
                        onClick={handleGenerateOnTheFly} 
                        disabled={generating} 
                        className="gap-2 px-8 font-semibold bg-primary hover:bg-primary/95 text-primary-foreground shadow-md transition-all hover:scale-[1.02] active:scale-[0.98]"
                      >
                        {generating ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Generating study kit...
                          </>
                        ) : (
                          <>
                            <Sparkles className="h-4 w-4" />
                            Generate Study Kit for "{q}"
                          </>
                        )}
                      </Button>
                    ) : (
                      <Link to="/login" search={{ redirect: `/explore` } as any}>
                        <Button className="gap-2 px-8 font-semibold bg-primary hover:bg-primary/95 text-primary-foreground shadow-md">
                          <Sparkles className="h-4 w-4" />
                          Sign in to Generate AI Study Kit
                        </Button>
                      </Link>
                    )}
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="py-16 text-center text-muted-foreground">
                  No published lessons yet. Check back soon!
                </CardContent>
              </Card>
            )
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((r) => (
                <Link key={r.id} to="/study/$id" params={{ id: r.id }}>
                  <Card className="h-full transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-soft)]">
                    <CardContent className="p-5">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary text-secondary-foreground">
                        <BookOpen className="h-5 w-5" />
                      </div>
                      <h3 className="mt-3 font-semibold leading-tight">{r.title}</h3>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {r.subject ?? "—"} · Grade {r.grade ?? "—"}
                      </p>
                      {r.topic && <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{r.topic}</p>}
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
