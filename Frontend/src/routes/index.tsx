import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { LanguageSelector } from "@/components/LanguageSelector";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useLanguage } from "@/hooks/use-language";
import { GraduationCap, Sparkles, FileText, ClipboardCheck, BookOpen, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "TechFlow AI — Lesson kits & study material" },
      { name: "description", content: "Generate complete lesson plans, worksheets, quizzes, and answer keys. Free study library for students." },
    ],
  }),
  component: Landing,
});

function Landing() {
  const { t } = useLanguage();

  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      {/* Decorative background blobs */}
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-32 -left-32 h-96 w-96 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute top-1/3 right-0 h-80 w-80 rounded-full bg-accent/20 blur-3xl" />
        <div className="absolute -bottom-20 left-1/3 h-72 w-72 rounded-full bg-primary/10 blur-3xl" />
      </div>

      <header className="sticky top-0 z-40 border-b border-border bg-card/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link to="/" className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <GraduationCap className="h-5 w-5" />
            </div>
            <span className="font-semibold tracking-tight">TechFlow AI</span>
          </Link>
          <nav className="flex items-center gap-2">
            <ThemeToggle />
            <LanguageSelector />
            <Link to="/explore"><Button variant="ghost">{t("explore")}</Button></Link>
            <Link to="/login"><Button variant="ghost">Sign in</Button></Link>
            <Link to="/login"><Button>Get started</Button></Link>
          </nav>
        </div>
      </header>

      <section className="relative">
        <div style={{ background: "var(--gradient-hero)" }} className="relative overflow-hidden">
          <div className="pointer-events-none absolute inset-0 -z-0 overflow-hidden">
            <div className="absolute top-10 left-1/4 h-64 w-64 rounded-full bg-cyan-400/10 blur-2xl" />
            <div className="absolute -bottom-10 right-1/4 h-56 w-56 rounded-full bg-primary/15 blur-2xl" />
          </div>
          <div className="relative mx-auto max-w-6xl px-6 py-24 text-center sm:py-32">
            <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-4 py-1.5 text-xs font-medium text-muted-foreground shadow-sm backdrop-blur">
              <Sparkles className="h-3.5 w-3.5 text-primary" /> For teachers & students
            </span>
            <h1 className="mt-6 text-4xl font-bold tracking-tight sm:text-6xl">
              Lesson kits & study material,<br />in seconds
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-lg text-muted-foreground">
              Teachers generate complete lesson plans, worksheets, quizzes, and answer keys. Students browse and study from a free, public library — no signup required.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link to="/login"><Button size="lg" className="gap-2 shadow-lg shadow-primary/20">Start creating <ArrowRight className="h-4 w-4" /></Button></Link>
              <Link to="/explore"><Button size="lg" variant="outline" className="gap-2">Browse study material</Button></Link>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-20">
        <h2 className="text-center text-3xl font-bold tracking-tight">Everything you need in one kit</h2>
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { icon: BookOpen, title: "Lesson Plans", desc: "Structured, objective-aligned plans with timing." },
            { icon: FileText, title: "Worksheets", desc: "Practice activities students can do in class or at home." },
            { icon: ClipboardCheck, title: "Quizzes", desc: "Assessment-ready questions across cognitive levels." },
            { icon: Sparkles, title: "Answer Keys", desc: "Detailed solutions to grade with confidence." },
          ].map((f) => (
            <div key={f.title} className="group rounded-xl border border-border bg-card p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-[var(--shadow-soft)]">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-secondary to-accent text-secondary-foreground transition-colors group-hover:from-primary group-hover:to-primary/70 group-hover:text-primary-foreground">
                <f.icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 font-semibold">{f.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-border bg-card/50 py-8 text-center text-sm text-muted-foreground">
        © {new Date().getFullYear()} TechFlow AI
      </footer>
    </div>
  );
}
