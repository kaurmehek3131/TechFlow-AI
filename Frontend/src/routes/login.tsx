import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GraduationCap } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "Sign in — TechFlow AI" }] }),
  validateSearch: (search: Record<string, unknown>) => {
    return {
      redirect: (search.redirect as string) || undefined,
    };
  },
  component: LoginPage,
});

function LoginPage() {
  const { redirect } = Route.useSearch();
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [activePortal, setActivePortal] = useState<"teacher" | "student">("teacher");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && user) navigate({ to: (redirect || "/dashboard") as any });
  }, [user, loading, navigate, redirect]);

  const signIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) toast.error(error.message);
    else navigate({ to: (redirect || "/dashboard") as any });
  };

  const signUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signUp({
      email, password,
      options: { 
        emailRedirectTo: `${window.location.origin}${redirect || "/dashboard"}`, 
        data: { full_name: name, role: activePortal } 
      },
    });
    setBusy(false);
    if (error) toast.error(error.message);
    else toast.success("Check your email to confirm your account.");
  };

  const google = async () => {
    try {
      console.log("Initiating Google OAuth with role:", activePortal);
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}${redirect || "/dashboard"}`,
          queryParams: {
            role: activePortal
          },
          data: {
            role: activePortal
          }
        },
      });
      console.log("Google OAuth response:", { data, error });
      if (error) {
        toast.error(error.message ?? "Google sign-in failed");
      } else if (data?.url) {
        console.log("Redirecting to URL:", data.url);
        window.location.href = data.url;
      } else {
        console.log("OAuth flow initiated, awaiting redirect...");
      }
    } catch (err: any) {
      console.error("Uncaught Google OAuth error:", err);
      toast.error(err.message ?? "An unexpected error occurred during Google sign-in.");
    }
  };


  return (
    <div className="flex min-h-screen items-center justify-center px-4" style={{ background: "var(--gradient-hero)" }}>
      <div className="w-full max-w-md">
        <Link to="/" className="mb-6 flex items-center justify-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <GraduationCap className="h-5 w-5" />
          </div>
          <span className="font-semibold tracking-tight">TechFlow AI</span>
        </Link>

        {/* Separate sections for Teacher and Student portals */}
        <div className="mb-4 grid grid-cols-2 gap-2 bg-muted/60 p-1.5 rounded-xl border border-border/40">
          <button
            type="button"
            onClick={() => setActivePortal("teacher")}
            className={`py-2 text-xs font-semibold rounded-lg flex flex-col items-center gap-1 transition-all ${
              activePortal === "teacher"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
            }`}
          >
            <span className="text-lg">👨‍🏫</span>
            Teacher Portal
          </button>
          <button
            type="button"
            onClick={() => setActivePortal("student")}
            className={`py-2 text-xs font-semibold rounded-lg flex flex-col items-center gap-1 transition-all ${
              activePortal === "student"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
            }`}
          >
            <span className="text-lg">🎓</span>
            Student Portal
          </button>
        </div>

        <Card className="shadow-lg border-border/60">
          <CardHeader>
            <CardTitle>{activePortal === "teacher" ? "Teacher Login" : "Student Login"}</CardTitle>
            <CardDescription>
              {activePortal === "teacher" 
                ? "Sign in or create an account to start crafting lesson plans, worksheets, and quizzes." 
                : "Sign in or create an account to view and study lessons shared by teachers."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="signin">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="signin">Sign in</TabsTrigger>
                <TabsTrigger value="signup">Sign up</TabsTrigger>
              </TabsList>
              
              <TabsContent value="signin" className="space-y-4 pt-4">
                <form onSubmit={signIn} className="space-y-3">
                  <div><Label>Email</Label><Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
                  <div><Label>Password</Label><Input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} /></div>
                  <Button type="submit" className="w-full" disabled={busy}>Sign in</Button>
                </form>
              </TabsContent>

              <TabsContent value="signup" className="space-y-4 pt-4">
                <form onSubmit={signUp} className="space-y-3">
                  <div><Label>Full name</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Enter your full name" /></div>
                  <div><Label>Email</Label><Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@school.com" /></div>
                  <div><Label>Password</Label><Input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Minimum 6 characters" /></div>
                  <Button type="submit" className="w-full" disabled={busy}>Create account</Button>
                </form>
              </TabsContent>
            </Tabs>

            <div className="my-4 flex items-center gap-3">
              <div className="h-px flex-1 bg-border" />
              <span className="text-xs text-muted-foreground">OR</span>
              <div className="h-px flex-1 bg-border" />
            </div>
            <Button type="button" variant="outline" className="w-full" onClick={google}>
              Continue with Google ({activePortal === "teacher" ? "Teacher" : "Student"})
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
