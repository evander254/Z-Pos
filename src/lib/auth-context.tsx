import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

interface AuthCtx {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signOut: () => Promise<void>;
  setMockSession?: (user: any) => void;
}

const Ctx = createContext<AuthCtx>({ user: null, session: null, loading: true, signOut: async () => {} });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [mockUser, setMockUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check localStorage for mock user on mount
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem("zpos-mock-user");
      if (stored) {
        try {
          setMockUser(JSON.parse(stored));
        } catch (e) {
          console.error("Failed to parse mock user", e);
        }
      }
    }

    const { data: sub } = supabase.auth.onAuthStateChange((_evt, s) => {
      setSession(s);
      setLoading(false);
    });
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  return (
    <Ctx.Provider value={{
      user: mockUser ?? session?.user ?? null,
      session: mockUser ? { user: mockUser } as any : session,
      loading,
      signOut: async () => {
        if (typeof window !== 'undefined') {
          const sessionId = localStorage.getItem("zpos-employee-login-session-id");
          if (sessionId) {
            try {
              await supabase.rpc("end_employee_login_session" as any, { p_session_id: sessionId });
            } catch (err) {
              console.warn("Failed to end employee login session:", err);
            }
          }
          localStorage.removeItem("zpos-mock-user");
          localStorage.removeItem("zpos-mock-employee");
          localStorage.removeItem("zpos-employee-login-session-id");
        }
        setMockUser(null);
        await supabase.auth.signOut();
      },
      setMockSession: (user: any) => {
        if (typeof window !== 'undefined') {
          if (user) {
            localStorage.setItem("zpos-mock-user", JSON.stringify(user));
          } else {
            localStorage.removeItem("zpos-mock-user");
          }
        }
        setMockUser(user);
      }
    }}>
      {children}
    </Ctx.Provider>
  );
}

export const useAuth = () => useContext(Ctx);
