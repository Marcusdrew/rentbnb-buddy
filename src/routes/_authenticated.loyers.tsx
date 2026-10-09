import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2, Pencil, Download, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { settingsQuery, tenantsQuery, type Tenant } from "@/lib/data";
import { SEED_TENANTS } from "@/lib/seed";
import { formatUSD, formatFC } from "@/lib/format";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/loyers")({
  head: () => ({
    meta: [
      { title: "Carnet de loyers — Mon Carnet" },
      {
        name: "description",
        content:
          "Liste de vos locataires, loyers attendus, montants reçus et restes à encaisser.",
      },
      { property: "og:title", content: "Carnet de loyers — Mon Carnet" },
      {
        property: "og:description",
        content: "Chaque locataire et ce qu'il rapporte, en USD et en FC.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: LoyersPage,
});

type FormState = { id?: string; name: string; expected: string; received: string; note: string };
const EMPTY: FormState = { name: "", expected: "", received: "", note: "" };

function num(v: string) {
  const n = Number(v.replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

function LoyersPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data: tenants } = useSuspenseQuery(tenantsQuery);
  const { data: settings } = useSuspenseQuery(settingsQuery);
  const rate = settings?.usd_fc_rate ?? 2300;

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [busy, setBusy] = useState(false);

  const refresh = () => qc.invalidateQueries({ queryKey: ["tenants"] });

  function openNew() {
    setForm(EMPTY);
    setOpen(true);
  }
  function openEdit(t: Tenant) {
    setForm({
      id: t.id,
      name: t.name,
      expected: String(t.expected_usd),
      received: String(t.received_usd),
      note: t.note ?? "",
    });
    setOpen(true);
  }

  async function save() {
    if (!user || !form.name.trim()) {
      toast.error("Indiquez le nom du locataire.");
      return;
    }
    setBusy(true);
    const payload = {
      name: form.name.trim(),
      expected_usd: num(form.expected),
      received_usd: num(form.received),
      note: form.note.trim() || null,
    };
    const { error } = form.id
      ? await supabase.from("tenants").update(payload).eq("id", form.id)
      : await supabase.from("tenants").insert({ ...payload, user_id: user.id });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    setOpen(false);
    refresh();
    toast.success(form.id ? "Locataire modifié" : "Locataire ajouté");
  }

  async function remove(t: Tenant) {
    if (!confirm(`Supprimer ${t.name} ?`)) return;
    const { error } = await supabase.from("tenants").delete().eq("id", t.id);
    if (error) { toast.error(error.message); return; }
    refresh();
  }

  async function markPaid(t: Tenant) {
    const { error } = await supabase
      .from("tenants")
      .update({ received_usd: t.expected_usd })
      .eq("id", t.id);
    if (error) { toast.error(error.message); return; }
    refresh();
    toast.success(`${t.name} : loyer encaissé`);
  }

  async function importSeed() {
    if (!user) return;
    const { error } = await supabase
      .from("tenants")
      .insert(SEED_TENANTS.map((t) => ({ ...t, user_id: user.id })));
    if (error) { toast.error(error.message); return; }
    refresh();
    toast.success("Locataires de votre fichier importés");
  }

  const totalExpected = tenants.reduce((s, t) => s + t.expected_usd, 0);
  const totalReceived = tenants.reduce((s, t) => s + t.received_usd, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold">Carnet de loyers</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Chacun de vos locataires et ce qu'il rapporte.
          </p>
        </div>
        <Button onClick={openNew}>
          <Plus className="mr-1 h-4 w-4" /> Ajouter un locataire
        </Button>
      </div>

      {tenants.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
            <p className="text-muted-foreground">
              Aucun locataire pour l'instant.
            </p>
            <Button variant="outline" onClick={importSeed}>
              <Download className="mr-1 h-4 w-4" /> Reprendre les loyers de mon
              fichier Excel
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {tenants.map((t) => {
            const rest = t.expected_usd - t.received_usd;
            const paid = rest <= 0;
            return (
              <Card key={t.id}>
                <CardContent className="flex flex-wrap items-center gap-4 px-5 py-4">
                  <div className="min-w-40 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold">{t.name}</p>
                      <Badge
                        variant={paid ? "default" : "outline"}
                        className={paid ? "bg-success text-success-foreground" : "border-gold text-foreground"}
                      >
                        {paid ? "Encaissé" : "En attente"}
                      </Badge>
                    </div>
                    {t.note && (
                      <p className="mt-0.5 text-xs text-muted-foreground">{t.note}</p>
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-6 text-right text-sm">
                    <div>
                      <p className="text-xs text-muted-foreground">Attendu</p>
                      <p className="font-medium">{formatUSD(t.expected_usd)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Reçu</p>
                      <p className="font-medium text-success">{formatUSD(t.received_usd)}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {formatFC(t.received_usd * rate)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Reste</p>
                      <p className={`font-medium ${rest > 0 ? "text-destructive" : ""}`}>
                        {formatUSD(Math.max(rest, 0))}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    {!paid && (
                      <Button size="icon" variant="ghost" title="Marquer encaissé" onClick={() => markPaid(t)}>
                        <CheckCircle2 className="h-4 w-4 text-success" />
                      </Button>
                    )}
                    <Button size="icon" variant="ghost" onClick={() => openEdit(t)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => remove(t)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}

          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="flex flex-wrap items-center justify-between gap-4 px-5 py-4">
              <p className="font-display text-lg font-semibold">Total</p>
              <div className="flex gap-8 text-right text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Attendu</p>
                  <p className="font-semibold">{formatUSD(totalExpected)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Reçu</p>
                  <p className="font-semibold text-success">{formatUSD(totalReceived)}</p>
                  <p className="text-[11px] text-muted-foreground">{formatFC(totalReceived * rate)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Reste</p>
                  <p className="font-semibold">{formatUSD(totalExpected - totalReceived)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{form.id ? "Modifier le locataire" : "Nouveau locataire"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nom / bien loué</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="ex. Mimosa" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Loyer attendu ($)</Label>
                <Input inputMode="decimal" value={form.expected} onChange={(e) => setForm({ ...form, expected: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Montant reçu ($)</Label>
                <Input inputMode="decimal" value={form.received} onChange={(e) => setForm({ ...form, received: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Note (facultatif)</Label>
              <Input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={save} disabled={busy}>Enregistrer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
