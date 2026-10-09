import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { BookOpenText } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Mon Carnet — Loyers & Budget familial" },
      {
        name: "description",
        content:
          "Carnet personnel de loyers et budget familial : locataires, revenus, dépenses de la maison et solde en USD et francs congolais.",
      },
      { property: "og:title", content: "Mon Carnet — Loyers & Budget familial" },
      {
        property: "og:description",
        content:
          "Suivez vos locataires, vos revenus et vos dépenses de la maison, avec conversion USD/FC automatique.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Index,
});

function Index() {
  const { session, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;
    navigate({ to: session ? "/tableau" : "/connexion", replace: true });
  }, [loading, session, navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-3 text-muted-foreground">
        <BookOpenText className="h-10 w-10 animate-pulse text-primary" />
        <p className="text-sm">Ouverture de votre carnet…</p>
      </div>
    </div>
  );
}
