import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useLanguage } from "@/hooks/use-language";
import { useTheme } from "@/hooks/use-theme";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/profile")({ component: Profile });

const LANGUAGES = ["English", "Hindi", "French", "Spanish", "German", "Japanese", "Chinese"];

function Profile() {
  const { user } = useAuth();
  const { setLanguage, t } = useLanguage();
  const { setTheme } = useTheme();
  const [form, setForm] = useState({ 
    full_name: "", 
    school: "", 
    subject_specialty: "", 
    preferred_language: "English",
    preferred_theme: "dark"
  });
  const [busy, setBusy] = useState(false);
  const [geminiKey, setGeminiKey] = useState("");
  const [difyApiKey, setDifyApiKey] = useState("");
  const [difyApiUrl, setDifyApiUrl] = useState("https://api.dify.ai/v1");

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
      if (data) {
        const dbLang = data.preferred_language ?? "English";
        const dbTheme = data.preferred_theme ?? "dark";
        setForm({
          full_name: data.full_name ?? "", 
          school: data.school ?? "",
          subject_specialty: data.subject_specialty ?? "", 
          preferred_language: dbLang,
          preferred_theme: dbTheme
        });
        // Also keep global language/theme context in sync
        setLanguage(dbLang as any);
        setTheme(dbTheme as any);
      }
    })();
    setGeminiKey(localStorage.getItem("gemini_api_key") ?? "");
    setDifyApiKey(localStorage.getItem("dify_api_key") ?? "");
    setDifyApiUrl(localStorage.getItem("dify_api_url") ?? "https://api.dify.ai/v1");
  }, [user]);

  const saveDifyConfig = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem("dify_api_key", difyApiKey);
    localStorage.setItem("dify_api_url", difyApiUrl);
    toast.success("Dify configuration saved locally");
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setBusy(true);
    const { error } = await supabase.from("profiles").upsert({ id: user.id, ...form });
    setBusy(false);
    if (error) {
      toast.error(error.message);
    } else {
      // Sync global preferences immediately
      await setLanguage(form.preferred_language as any);
      await setTheme(form.preferred_theme as any);
      toast.success("Profile saved");
    }
  };

  const saveGeminiKey = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem("gemini_api_key", geminiKey);
    toast.success("Gemini API key saved locally");
  };

  const set = (k: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t("profile")}</h1>
        <p className="text-muted-foreground">Manage your account and integrations.</p>
      </div>
      <Card>
        <CardHeader><CardTitle>{t("teacherDetails")}</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={save} className="space-y-4">
            <div><Label>Email</Label><Input value={user?.email ?? ""} disabled /></div>
            <div><Label>Full name</Label><Input value={form.full_name} onChange={(e) => set("full_name")(e.target.value)} /></div>
            <div><Label>{t("school")}</Label><Input value={form.school} onChange={(e) => set("school")(e.target.value)} /></div>
            <div><Label>{t("subjectSpecialty")}</Label><Input value={form.subject_specialty} onChange={(e) => set("subject_specialty")(e.target.value)} /></div>
            <div>
              <Label>{t("language")}</Label>
              <Select value={form.preferred_language} onValueChange={set("preferred_language")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {LANGUAGES.map((l) => (
                    <SelectItem key={l} value={l}>
                      {l}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Theme Preference</Label>
              <Select value={form.preferred_theme} onValueChange={set("preferred_theme")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="light">{t("lightMode")}</SelectItem>
                  <SelectItem value="dark">{t("darkMode")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" disabled={busy}>{t("saveProfile")}</Button>
          </form>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>{t("geminiApiIntegration")}</CardTitle>
          <CardDescription>Enter your Gemini API key to enable direct, high-quality client-side AI lesson generation. Your key is stored securely in your browser's local storage.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={saveGeminiKey} className="space-y-4">
            <div><Label>{t("geminiApiKey")}</Label><Input type="password" placeholder={t("apiPlaceholder")} value={geminiKey} onChange={(e) => setGeminiKey(e.target.value)} /></div>
            <Button type="submit">{t("saveApiKey")}</Button>
          </form>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Dify Workflow Integration</CardTitle>
          <CardDescription>Enter your Dify API Key and Base URL to trigger your custom Dify lesson generation workflow. Your settings are stored securely in your browser's local storage.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={saveDifyConfig} className="space-y-4">
            <div>
              <Label>Dify API Base URL</Label>
              <Input placeholder="https://api.dify.ai/v1" value={difyApiUrl} onChange={(e) => setDifyApiUrl(e.target.value)} />
            </div>
            <div>
              <Label>Dify API Key</Label>
              <Input type="password" placeholder="app-..." value={difyApiKey} onChange={(e) => setDifyApiKey(e.target.value)} />
            </div>
            <Button type="submit">Save Dify Configuration</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
