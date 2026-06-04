import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Trash2, Plus } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/library")({ component: Library });

type Row = { id: string; title: string; subject: string | null; grade: string | null; created_at: string };

function Library() {
  const { user, role, loading } = useAuth();
  const navigate = useNavigate();
  const [rows, setRows] = useState<Row[]>([]);
  const [q, setQ] = useState("");

  const load = async () => {
    if (!user) return;
    const { data } = await supabase.from("lessons").select("id, title, subject, grade, created_at").eq("user_id", user.id).order("created_at", { ascending: false });
    setRows(data ?? []);
  };

  useEffect(() => {
    if (!loading && role === "student") {
      toast.error("Access denied: Students cannot access libraries.");
      navigate({ to: "/dashboard" });
      return;
    }
    load();
  }, [user, role, loading]);

  const remove = async (id: string) => {
    const { error } = await supabase.from("lessons").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Deleted"); load(); }
  };

  const filtered = rows.filter((r) => {
    const queryWords = q.toLowerCase().split(/\s+/).filter(Boolean);
    if (queryWords.length === 0) return true;
    
    return queryWords.every(word => {
      return (
        r.title.toLowerCase().includes(word) ||
        (r.subject ?? "").toLowerCase().includes(word) ||
        (r.grade ?? "").toLowerCase().includes(word) ||
        `grade ${r.grade ?? ""}`.toLowerCase().includes(word)
      );
    });
  });

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">My Library</h1>
          <p className="text-muted-foreground">All your generated lesson kits.</p>
        </div>
        <Link to="/generate"><Button className="gap-2"><Plus className="h-4 w-4" /> New lesson</Button></Link>
      </div>
      <Input placeholder="Search by title…" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-sm" />
      {filtered.length === 0 ? (
        <Card><CardContent className="py-16 text-center text-muted-foreground">No lessons match.</CardContent></Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {filtered.map((r) => (
            <Card key={r.id} className="transition hover:shadow-md">
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <Link to="/lessons/$id" params={{ id: r.id }} className="flex-1">
                    <h3 className="font-semibold leading-tight hover:text-primary">{r.title}</h3>
                    <p className="mt-1 text-xs text-muted-foreground">{r.subject ?? "—"} · Grade {r.grade ?? "—"} · {new Date(r.created_at).toLocaleDateString()}</p>
                  </Link>
                  <Button variant="ghost" size="icon" onClick={() => remove(r.id)}><Trash2 className="h-4 w-4" /></Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
