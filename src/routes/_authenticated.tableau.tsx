import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import {
  ArrowDownRight,
  ArrowUpRight,
  Scale,
  Users,
  Wallet,
  Pencil,
  Check,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import {
  settingsQuery,
  tenantsQuery,
  expensesQuery,
  ensureSettings,
} from "@/lib/data";
import { formatUSD, formatFC, fcToUsd } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_authenticated/tableau")({
  head: () => ({
    meta: [
      { title: "Tableau de bord — Mon Carnet" },
      {
        name: "description",
        content:
          "Vue d'ensemble : loyers encaissés, dépenses de la maison et solde, en USD et francs congolais.",
      },
      { property: "og:title", content: "Tableau de bord — Mon Carnet" },
      {
        property: "og:description",
        content: "Loyers, dépenses et solde, recalculés automatiquement.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TableauPage,
});

function TableauPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: settings } = useSuspenseQuery(settingsQuery);
  const { data: tenants } = useSuspenseQuery(tenantsQuery);
  const { data: expenses } = useSuspenseQuery(expensesQuery);

  const [editingRate, setEditingRate] = useState(false);
  const [rateInput, setRateInput] = useState("");

  const rate = settings?.usd_fc_rate ?? 2300;

  const totalExpected = tenants.reduce((s, t) => s + t.expected_usd, 0);
  const totalReceived = tenants.reduce((s, t) => s + t.received_usd, 0);
  const totalRemaining = totalExpected - totalReceived;

  const expensesUsd = expenses.reduce((s, e) => s + e.amount_usd, 0);
  const expensesFc = expenses.reduce((s, e) => s + e.amount_fc, 0);
  const totalExpensesUsd = expensesUsd + fcToUsd(expensesFc, rate);

  const balanceUsd = totalReceived - totalExpensesUsd;
  const balanceFc = balanceUsd * rate;

  async function saveRate() {
    if (!user) return;
    const value = Number(rateInput.replace(/\s/g, "").replace(",", "."));
    if (!value || value <= 0) {
      toast.error("Entrez un taux valide, par exemple 2300.");
      return;
    }
    try {
      const current = await ensureSettings(user.id);
      const { error } = await supabase
        .from("settings")
        .update({ usd_fc_rate: value, updated_at: new Date().toISOString() })
        .eq("id", current.id);
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: ["settings"] });
      setEditingRate(false);
      toast.success(`Taux mis à jour : 1 $ = ${value} FC`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur de sauvegarde.");
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold">Tableau de bord</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Votre situation du mois, recalculée à chaque mouvement.
          </p>
        </div>
        <Card className="border-gold/40 bg-accent/50">
          <CardContent className="flex items-center gap-3 px-4 py-3">
            <span className="text-sm font-medium">Taux : 1 $ =</span>
            {editingRate ? (
              <>
                <Input
                  className="h-8 w-28"
                  value={rateInput}
                  onChange={(e) => setRateInput(e.target.value)}
                  autoFocus
                  onKeyDown={(e) => e.key === "Enter" && saveRate()}
                />
                <Button size="icon" className="h-8 w-8" onClick={saveRate}>
                  <Check className="h-4 w-4" />
                </Button>
              </>
            ) : (
              <>
                <span className="font-display text-lg font-semibold">
                  {new Intl.NumberFormat("fr-CD").format(rate)} FC
                </span>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8"
                  onClick={() => {
                    setRateInput(String(rate));
                    setEditingRate(true);
                  }}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Loyers encaissés
            </CardTitle>
            <ArrowUpRight className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            <p className="font-display text-2xl font-semibold text-success">
              {formatUSD(totalReceived)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              soit {formatFC(totalReceived * rate)} · sur{" "}
              {formatUSD(totalExpected)} attendus
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Dépenses de la maison
            </CardTitle>
            <ArrowDownRight className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <p className="font-display text-2xl font-semibold text-destructive">
              {formatUSD(totalExpensesUsd)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {formatUSD(expensesUsd)} + {formatFC(expensesFc)} notés en FC
            </p>
          </CardContent>
        </Card>

        <Card className="border-primary/30 bg-primary/5">
          <CardHeader className="flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Solde restant
            </CardTitle>
            <Scale className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <p
              className={`font-display text-2xl font-semibold ${
                balanceUsd >= 0 ? "text-primary" : "text-destructive"
              }`}
            >
              {formatUSD(balanceUsd)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              soit {formatFC(balanceFc)}
            </p>
          </CardContent>
        </Card>
      </div>

      {totalRemaining > 0 && (
        <Card className="border-gold/50 bg-accent/40">
          <CardContent className="px-4 py-3 text-sm">
            <strong>{formatUSD(totalRemaining)}</strong> de loyers restent à
            encaisser ce mois-ci.
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Link to="/loyers">
          <Card className="h-full transition-shadow hover:shadow-md">
            <CardContent className="flex items-center gap-4 px-5 py-5">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Users className="h-5 w-5" />
              </div>
              <div>
                <p className="font-semibold">Carnet de loyers</p>
                <p className="text-sm text-muted-foreground">
                  {tenants.length} locataire{tenants.length > 1 ? "s" : ""} —
                  gérez les encaissements
                </p>
              </div>
            </CardContent>
          </Card>
        </Link>
        <Link to="/budget">
          <Card className="h-full transition-shadow hover:shadow-md">
            <CardContent className="flex items-center gap-4 px-5 py-5">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gold/20 text-gold-foreground">
                <Wallet className="h-5 w-5" />
              </div>
              <div>
                <p className="font-semibold">Budget de la maison</p>
                <p className="text-sm text-muted-foreground">
                  {expenses.length} dépense{expenses.length > 1 ? "s" : ""} —
                  chaque chose a son prix
                </p>
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  );
}
