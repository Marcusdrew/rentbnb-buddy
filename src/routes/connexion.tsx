import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { BookOpenText, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const Route = createFileRoute("/connexion")({
  head: () => ({
    meta: [
      { title: "Connexion — Mon Carnet" },
      {
        name: "description",
        content: "Connectez-vous à votre carnet de loyers et budget familial.",
      },
      { property: "og:title", content: "Connexion — Mon Carnet" },
      {
        property: "og:description",
        content: "Connectez-vous à votre carnet de loyers et budget familial.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ConnexionPage,
});

function ConnexionPage() {
  const { session, loading } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && session) navigate({ to: "/tableau", replace: true });
  }, [loading, session, navigate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        toast.success("Bon retour !");
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        toast.success(
          "Compte créé ! Vérifiez votre email pour confirmer, puis connectez-vous.",
        );
      }
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Une erreur est survenue.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg">
            <BookOpenText className="h-7 w-7" />
          </div>
          <h1 className="text-3xl font-semibold text-foreground">Mon Carnet</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Loyers, revenus et budget de la maison — en un seul endroit.
          </p>
        </div>

        <Card className="shadow-xl">
          <CardHeader>
            <CardTitle>
              {mode === "login" ? "Connexion" : "Créer mon compte"}
            </CardTitle>
            <CardDescription>
              {mode === "login"
                ? "Accédez à votre carnet personnel."
                : "Un seul compte, rien que pour vous."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="vous@exemple.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Mot de passe</Label>
                <Input
                  id="password"
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                />
              </div>
              <Button type="submit" className="w-full" disabled={busy}>
                {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {mode === "login" ? "Se connecter" : "Créer le compte"}
              </Button>
            </form>
            <button
              type="button"
              onClick={() => setMode(mode === "login" ? "signup" : "login")}
              className="mt-4 w-full text-center text-sm text-primary underline-offset-4 hover:underline"
            >
              {mode === "login"
                ? "Pas encore de compte ? Créez-le ici"
                : "Déjà un compte ? Connectez-vous"}
            </button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
