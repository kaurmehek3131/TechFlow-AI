import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useLanguage } from "@/hooks/use-language";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles, BookMarked, FileText, Plus } from "lucide-react";

export const Route = createFileRoute("/_app/dashboard")({
  component: Dashboard,
});

function Dashboard() {
  const { user, role } = useAuth();
  const { t } = useLanguage();
  const [count, setCount] = useState<number>(0);
  const [recent, setRecent] = useState<{ id: string; title: string; subject: string | null; created_at: string }[]>([]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      if (role === "student") {
        const { count } = await supabase.from("lessons").select("*", { count: "exact", head: true }).eq("is_published", true);
        setCount(count ?? 0);
        const { data } = await supabase.from("lessons").select("id, title, subject, created_at").eq("is_published", true).order("created_at", { ascending: false }).limit(5);
        setRecent(data ?? []);
      } else {
        const { count } = await supabase.from("lessons").select("*", { count: "exact", head: true }).eq("user_id", user.id);
        setCount(count ?? 0);
        const { data } = await supabase.from("lessons").select("id, title, subject, created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(5);
        setRecent(data ?? []);
      }
    })();
  }, [user, role]);

  const isStudent = role === "student";

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t("dashboard")}</h1>
          <p className="text-muted-foreground">
            {isStudent ? t("welcomeStudentText") : t("welcomeText")}
          </p>
        </div>
        {!isStudent && (
          <Link to="/generate">
            <Button className="gap-2">
              <Plus className="h-4 w-4" /> {t("newLesson")}
            </Button>
          </Link>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard icon={BookMarked} label={isStudent ? t("availableMaterials") : t("totalLessons")} value={String(count)} />
        <StatCard icon={Sparkles} label={isStudent ? t("studentAccount") : t("teacherAccount")} value={user?.email ?? ""} />
        <StatCard icon={FileText} label={t("last7Days")} value={String(recent.filter(r => Date.now() - new Date(r.created_at).getTime() < 7*864e5).length)} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{isStudent ? t("availableMaterials") : t("recentLessons")}</CardTitle>
        </CardHeader>
        <CardContent>
          {recent.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              <p>{isStudent ? t("noLessonsPublished") : t("noLessonsYet")}</p>
              {!isStudent && (
                <Link to="/generate">
                  <Button className="mt-4">{t("createFirstLesson")}</Button>
                </Link>
              )}
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {recent.map((l) => (
                <li key={l.id} className="py-3">
                  <Link 
                    to={isStudent ? "/study/$id" : "/lessons/$id"} 
                    params={{ id: l.id }} 
                    className="flex justify-between hover:text-primary"
                  >
                    <span className="font-medium">{l.title}</span>
                    <span className="text-sm text-muted-foreground">{l.subject ?? "—"}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-6">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary text-secondary-foreground"><Icon className="h-5 w-5" /></div>
        <div className="min-w-0">
          <div className="text-xs text-muted-foreground">{label}</div>
          <div className="truncate text-lg font-semibold">{value}</div>
        </div>
      </CardContent>
    </Card>
  );
}
