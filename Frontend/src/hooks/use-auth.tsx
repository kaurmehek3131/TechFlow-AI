import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type UserRole = "teacher" | "student";

type AuthCtx = {
  user: User | null;
  session: Session | null;
  role: UserRole | null;
  loading: boolean;
  signOut: () => Promise<void>;
};

const Ctx = createContext<AuthCtx>({ user: null, session: null, role: null, loading: true, signOut: async () => {} });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      setLoading(false);
    });
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const uid = session?.user?.id;
    if (!uid) { setRole(null); return; }
    (async () => {
      const { data, error } = await supabase.from("profiles").select("role").eq("id", uid).maybeSingle();
      if (error) {
        console.error("Error fetching user profile:", error);
        return;
      }
      if (data) {
        setRole(((data?.role as UserRole) ?? "teacher"));
      } else {
        // Profile is missing — auto-create it to prevent foreign key violations
        const meta = session?.user?.user_metadata;
        const name = meta?.full_name || meta?.name || session?.user?.email?.split("@")[0] || "User";
        const metadataRole = meta?.role;
        const assignedRole: UserRole = (metadataRole === "student" || metadataRole === "teacher") ? metadataRole : "teacher";
        
        console.log("Profile row missing. Auto-creating profile for:", name, "with role:", assignedRole);
        
        const { error: insertError } = await supabase.from("profiles").insert({
          id: uid,
          full_name: name,
          role: assignedRole,
          email: session?.user?.email
        });
        
        if (insertError) {
          console.error("Failed to auto-create missing profile:", insertError);
        } else {
          setRole(assignedRole);
        }
      }
    })();
  }, [session?.user?.id]);

  return (
    <Ctx.Provider value={{ user: session?.user ?? null, session, role, loading, signOut: async () => { await supabase.auth.signOut(); } }}>
      {children}
    </Ctx.Provider>
  );
}

export const useAuth = () => useContext(Ctx);
