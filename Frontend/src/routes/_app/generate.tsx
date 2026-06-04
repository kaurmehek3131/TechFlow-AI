import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useLanguage } from "@/hooks/use-language";
import { callMakeWebhook } from "@/lib/webhook";
import { createVersionSnapshot } from "@/lib/versions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/generate")({ component: Generate });

const SUBJECTS = ["Math", "Science", "English", "History", "Geography", "Art", "Music", "Computer Science", "Physical Education"];
const GRADES = ["K", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"];
const DURATIONS = ["20 min", "30 min", "45 min", "60 min", "90 min"];
const LANGUAGES = ["English", "Hindi", "French", "Spanish", "German", "Japanese", "Chinese"];

function Generate() {
  const { user, role, loading } = useAuth();
  const { language, setLanguage, t } = useLanguage();
  const navigate = useNavigate();
  const [form, setForm] = useState({ subject: "", grade: "", topic: "", duration: "", objectives: "", language });
  const [busy, setBusy] = useState(false);
  const [hasGeminiKey, setHasGeminiKey] = useState(false);
  const [hasDifyKey, setHasDifyKey] = useState(false);

  useEffect(() => {
    if (!loading && role === "student") {
      toast.error("Access denied: Students cannot generate lessons.");
      navigate({ to: "/dashboard" });
      return;
    }
    if (!user) return;
    setHasGeminiKey(!!localStorage.getItem("gemini_api_key") || !!import.meta.env.VITE_GEMINI_API_KEY);
    setHasDifyKey(!!localStorage.getItem("dify_api_key") || !!import.meta.env.VITE_DIFY_API_KEY);
  }, [user, role, loading]);

  useEffect(() => {
    setForm((f) => ({ ...f, language }));
  }, [language]);

  const set = (k: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!form.subject || !form.grade || !form.topic || !form.duration) {
      toast.error("Please fill out all required fields.");
      return;
    }
    setBusy(true);
    try {
      const { data: profile } = await supabase.from("profiles").select("webhook_url").eq("id", user.id).maybeSingle();
      const out = await callMakeWebhook(profile?.webhook_url ?? "", form);
      const { data, error } = await supabase.from("lessons").insert({
        user_id: user.id,
        title: `${form.topic} (${form.subject}, Grade ${form.grade})`,
        ...form,
        ...out,
      }).select("id").single();
      if (error) throw error;
      
      // Create version 1 snapshot for the initial state
      await createVersionSnapshot(data.id, user.id);

      toast.success("Lesson generated!");
      navigate({ to: "/lessons/$id", params: { id: data.id } });
    } catch (e: any) {
      toast.error(e.message ?? "Failed to generate");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">{t("generateLesson")}</h1>
        <p className="text-muted-foreground">Tell us the basics, we'll build the kit.</p>
        <div className="mt-3 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs bg-muted/30">
          <span className={`h-2 w-2 rounded-full ${hasDifyKey || hasGeminiKey ? "bg-green-500" : "bg-yellow-500 animate-pulse"}`} />
          {hasDifyKey ? (
            <span>Connected: Dify Workflow</span>
          ) : hasGeminiKey ? (
            <span>{t("connectedGemini")}</span>
          ) : (
            <span>{t("builtInDemo")}</span>
          )}
        </div>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>{t("lessonDetails")}</CardTitle>
          <CardDescription>Fields marked are required.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={`${t("subject")} *`}>
                <Select value={form.subject} onValueChange={set("subject")}>
                  <SelectTrigger><SelectValue placeholder="Choose a subject" /></SelectTrigger>
                  <SelectContent>{SUBJECTS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <Field label={`${t("grade")} *`}>
                <Select value={form.grade} onValueChange={set("grade")}>
                  <SelectTrigger><SelectValue placeholder="Choose a grade" /></SelectTrigger>
                  <SelectContent>{GRADES.map((g) => <SelectItem key={g} value={g}>Grade {g}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
            </div>
            <Field label={`${t("topic")} *`}>
              <Input value={form.topic} onChange={(e) => set("topic")(e.target.value)} placeholder="e.g. Photosynthesis" />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={`${t("duration")} *`}>
                <Select value={form.duration} onValueChange={set("duration")}>
                  <SelectTrigger><SelectValue placeholder="Choose duration" /></SelectTrigger>
                  <SelectContent>{DURATIONS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <Field label={t("language")}>
                <Select value={form.language} onValueChange={(val) => { set("language")(val); setLanguage(val as any); }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{LANGUAGES.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
            </div>
            <Field label={t("learningObjectives")}>
              <Textarea rows={4} value={form.objectives} onChange={(e) => set("objectives")(e.target.value)} placeholder="Students will be able to…" />
            </Field>
            <Button type="submit" className="w-full gap-2" disabled={busy}>
              <Sparkles className="h-4 w-4" /> {busy ? t("generating") : t("generate")}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-2"><Label>{label}</Label>{children}</div>;
}
