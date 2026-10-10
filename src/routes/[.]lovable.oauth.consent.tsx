import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type OAuthResult = { data: any; error: { message: string } | null };
const oauth = (supabase.auth as unknown as {
  oauth: {
    getAuthorizationDetails: (id: string) => Promise<OAuthResult>;
    approveAuthorization: (id: string) => Promise<OAuthResult>;
    denyAuthorization: (id: string) => Promise<OAuthResult>;
  };
}).oauth;

export const Route = createFileRoute("/.lovable/oauth/consent")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Autoriser une connexion — Mon Carnet" },
      { name: "description", content: "Autorisez un assistant à accéder à votre carnet." },
      { property: "og:title", content: "Autoriser une connexion — Mon Carnet" },
      { property: "og:description", content: "Autorisez un assistant à accéder à votre carnet." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  validateSearch: (s: Record<string, unknown>) => ({
    authorization_id: typeof s["authorization_id"] === "string" ? s["authorization_id"] : "",
  }),
  beforeLoad: async ({ search, location }) => {
    if (!search.authorization_id) throw new Error("Demande d'autorisation invalide.");
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw redirect({ to: "/connexion", search: { next: location.href } });
  },
  loaderDeps: ({ search }) => ({ id: search.authorization_id }),
  loader: async ({ deps: { id } }) => {
    const { data, error } = await oauth.getAuthorizationDetails(id);
    if (error) throw new Error(error.message);
    const immediate = data?.redirect_url ?? data?.redirect_to;
    if (immediate && !data?.client) throw redirect({ href: immediate });
    const { data: u } = await supabase.auth.getUser();
    return { details: data, email: u.user?.email ?? "" };
  },
  component: Consent,
  errorComponent: ({ error }) => (
    <main className="flex min-h-screen items-center justify-center p-4 text-center text-sm text-muted-foreground">
      Impossible de charger cette demande : {String((error as Error)?.message ?? error)}
    </main>
  ),
});

function Consent() {
  const { details, email } = Route.useLoaderData();
  const { authorization_id } = Route.useSearch();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const client = details?.client?.name ?? "Une application";

  async function decide(approve: boolean) {
    setBusy(true);
    setError(null);
    const { data, error } = approve
      ? await oauth.approveAuthorization(authorization_id)
      : await oauth.denyAuthorization(authorization_id);
    if (error) { setBusy(false); setError(error.message); return; }
    const target = data?.redirect_url ?? data?.redirect_to;
    if (!target) { setBusy(false); setError("Aucune redirection reçue."); return; }
    window.location.href = target;
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader>
          <CardTitle>Connecter {client} à Mon Carnet</CardTitle>
          <CardDescription>Connectée en tant que {email}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <p>{client} pourra consulter vos locataires et le résumé de vos mois, ajouter des dépenses et enregistrer des loyers reçus, en votre nom.</p>
          {details?.redirect_uri && <p className="text-muted-foreground">Adresse de retour : {details.redirect_uri}</p>}
          <p className="text-muted-foreground">Vos règles d'accès restent appliquées : seules vos propres données sont visibles.</p>
          {error && <p role="alert" className="text-destructive">{error}</p>}
          <div className="flex gap-2">
            <Button className="flex-1" disabled={busy} onClick={() => decide(true)}>Autoriser</Button>
            <Button className="flex-1" variant="outline" disabled={busy} onClick={() => decide(false)}>Annuler la connexion</Button>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
