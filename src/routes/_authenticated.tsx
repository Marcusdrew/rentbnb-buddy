import {
  createFileRoute,
  Outlet,
  Link,
  useNavigate,
} from "@tanstack/react-router";
import { useEffect } from "react";
import { BookOpenText, LayoutDashboard, Users, Wallet, LogOut } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated")({
  component: AuthenticatedLayout,
});

const NAV = [
  { to: "/tableau", label: "Tableau de bord", icon: LayoutDashboard },
  { to: "/loyers", label: "Loyers", icon: Users },
  { to: "/budget", label: "Budget", icon: Wallet },
] as const;

function AuthenticatedLayout() {
  const { session, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !session) navigate({ to: "/connexion", replace: true });
  }, [loading, session, navigate]);

  if (loading || !session) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <BookOpenText className="h-10 w-10 animate-pulse text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-20 border-b border-border bg-card/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-2 px-4 py-3">
          <Link to="/tableau" className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <BookOpenText className="h-5 w-5" />
            </div>
            <span className="font-display text-lg font-semibold">
              Mon Carnet
            </span>
          </Link>
          <nav className="flex items-center gap-1">
            {NAV.map(({ to, label, icon: Icon }) => (
              <Link
                key={to}
                to={to}
                activeProps={{
                  className: "bg-primary text-primary-foreground",
                }}
                className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
              >
                <Icon className="h-4 w-4" />
                <span className="hidden sm:inline">{label}</span>
              </Link>
            ))}
            <Button
              variant="ghost"
              size="icon"
              title="Se déconnecter"
              onClick={async () => {
                await supabase.auth.signOut();
                navigate({ to: "/connexion" });
              }}
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8">
        <Outlet />
      </main>
    </div>
  );
}
