import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2, Pencil, Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { settingsQuery, tenantsQuery, expensesQuery, type Expense } from "@/lib/data";
import { SEED_EXPENSES, CATEGORIES } from "@/lib/seed";
import { formatUSD, formatFC, fcToUsd } from "@/lib/format";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/budget")({
  head: () => ({
    meta: [
      { title: "Budget de la maison — Mon Carnet" },
      {
        name: "description",
        content:
          "Dépenses de la maison par catégorie, chaque chose avec son prix, et solde qui bouge selon vos revenus.",
      },
      { property: "og:title", content: "Budget de la maison — Mon Carnet" },
      {
        property: "og:description",
        content: "Dépenses par catégorie et solde recalculé automatiquement.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: BudgetPage,
});

type FormState = {
  id?: string;
  category: string;
  label: string;
  usd: string;
  fc: string;
  note: string;
};
const EMPTY: FormState = { category: "Alimentation", label: "", usd: "", fc: "", note: "" };

function num(v: string) {
  const n = Number(v.replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

function BudgetPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data: expenses } = useSuspenseQuery(expensesQuery);
  const { data: tenants } = useSuspenseQuery(tenantsQuery);
  const { data: settings } = useSuspenseQuery(settingsQuery);
  const rate = settings?.usd_fc_rate ?? 2300;

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [busy, setBusy] = useState(false);

  const refresh = () => qc.invalidateQueries({ queryKey: ["expenses"] });
  const costUsd = (e: Expense) => e.amount_usd + fcToUsd(e.amount_fc, rate);

  const income = tenants.reduce((s, t) => s + t.received_usd, 0);
  const total = expenses.reduce((s, e) => s + costUsd(e), 0);
  const paidTotal = expenses.filter((e) => e.paid).reduce((s, e) => s + costUsd(e), 0);
  const balance = income - total;
  const used = income > 0 ? Math.min((total / income) * 100, 100) : 0;

  const grouped = useMemo(() => {
    const map = new Map<string, Expense[]>();
    for (const e of expenses) {
      const list = map.get(e.category) ?? [];
      list.push(e);
      map.set(e.category, list);
    }
    return [...map.entries()];
  }, [expenses]);

  function openNew() {
    setForm(EMPTY);
    setOpen(true);
  }
  function openEdit(e: Expense) {
    setForm({
      id: e.id,
      category: e.category,
      label: e.label,
      usd: e.amount_usd ? String(e.amount_usd) : "",
      fc: e.amount_fc ? String(e.amount_fc) : "",
      note: e.note ?? "",
    });
    setOpen(true);
  }

  async function save() {
    if (!user || !form.label.trim()) {
      toast.error("Indiquez le nom de la dépense.");
      return;
    }
    setBusy(true);
    const payload = {
      category: form.category,
      label: form.label.trim(),
      amount_usd: num(form.usd),
      amount_fc: num(form.fc),
      note: form.note.trim() || null,
    };
    const { error } = form.id
      ? await supabase.from("expenses").update(payload).eq("id", form.id)
      : await supabase.from("expenses").insert({ ...payload, user_id: user.id });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    setOpen(false);
    refresh();
    toast.success(form.id ? "Dépense modifiée" : "Dépense ajoutée");
  }

  async function togglePaid(e: Expense) {
    const { error } = await supabase.from("expenses").update({ paid: !e.paid }).eq("id", e.id);
    if (error) { toast.error(error.message); return; }
    refresh();
  }

  async function remove(e: Expense) {
    if (!confirm(`Supprimer « ${e.label} » ?`)) return;
    const { error } = await supabase.from("expenses").delete().eq("id", e.id);
    if (error) { toast.error(error.message); return; }
    refresh();
  }

  async function importSeed() {
    if (!user) return;
    const { error } = await supabase
      .from("expenses")
      .insert(SEED_EXPENSES.map((e) => ({ ...e, user_id: user.id })));
    if (error) { toast.error(error.message); return; }
    refresh();
    toast.success("Dépenses de votre fichier importées");
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold">Budget de la maison</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Chaque chose avec son prix — le solde bouge à chaque dépense.
          </p>
        </div>
        <Button onClick={openNew}>
          <Plus className="mr-1 h-4 w-4" /> Ajouter une dépense
        </Button>
      </div>

      <Card className="border-primary/30">
        <CardContent className="space-y-4 px-5 py-5">
          <div className="grid gap-4 text-sm sm:grid-cols-4">
            <div>
              <p className="text-xs text-muted-foreground">Revenus (loyers reçus)</p>
              <p className="font-display text-xl font-semibold text-success">{formatUSD(income)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total des dépenses</p>
              <p className="font-display text-xl font-semibold text-destructive">{formatUSD(total)}</p>
              <p className="text-[11px] text-muted-foreground">{formatFC(total * rate)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Déjà payé</p>
              <p className="font-display text-xl font-semibold">{formatUSD(paidTotal)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Solde</p>
              <p className={`font-display text-xl font-semibold ${balance >= 0 ? "text-primary" : "text-destructive"}`}>
                {formatUSD(balance)}
              </p>
              <p className="text-[11px] text-muted-foreground">{formatFC(balance * rate)}</p>
            </div>
          </div>
          <div>
            <div className="h-2.5 overflow-hidden rounded-full bg-muted">
              <div
                className={`h-full rounded-full transition-all ${used >= 100 ? "bg-destructive" : "bg-primary"}`}
                style={{ width: `${used}%` }}
              />
            </div>
            <p className="mt-1.5 text-xs text-muted-foreground">
              {income > 0 ? `${Math.round((total / income) * 100)} % des revenus dépensés` : "Ajoutez vos loyers pour voir la part dépensée"}
            </p>
          </div>
        </CardContent>
      </Card>

      {expenses.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
            <p className="text-muted-foreground">Aucune dépense pour l'instant.</p>
            <Button variant="outline" onClick={importSeed}>
              <Download className="mr-1 h-4 w-4" /> Reprendre les dépenses de mon fichier Excel
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-5">
          {grouped.map(([cat, items]) => {
            const sub = items.reduce((s, e) => s + costUsd(e), 0);
            return (
              <div key={cat}>
                <div className="mb-2 flex items-baseline justify-between px-1">
                  <h2 className="text-lg font-semibold">{cat}</h2>
                  <span className="text-sm font-medium text-muted-foreground">{formatUSD(sub)}</span>
                </div>
                <Card>
                  <CardContent className="divide-y divide-border p-0">
                    {items.map((e) => (
                      <div key={e.id} className="flex items-center gap-3 px-4 py-2.5">
                        <Checkbox checked={e.paid} onCheckedChange={() => togglePaid(e)} title="Payé" />
                        <div className="min-w-0 flex-1">
                          <p className={`truncate text-sm ${e.paid ? "text-muted-foreground line-through" : ""}`}>
                            {e.label}
                          </p>
                          {e.note && <p className="truncate text-xs text-muted-foreground">{e.note}</p>}
                        </div>
                        <div className="text-right text-sm">
                          {e.amount_usd > 0 && <p className="font-medium">{formatUSD(e.amount_usd)}</p>}
                          {e.amount_fc > 0 && <p className="text-xs text-muted-foreground">{formatFC(e.amount_fc)}</p>}
                          {e.amount_usd === 0 && e.amount_fc === 0 && <p className="text-xs text-muted-foreground">—</p>}
                        </div>
                        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEdit(e)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => remove(e)}>
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{form.id ? "Modifier la dépense" : "Nouvelle dépense"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Catégorie</Label>
              <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Dépense</Label>
              <Input value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} placeholder="ex. Makala" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Prix en $</Label>
                <Input inputMode="decimal" value={form.usd} onChange={(e) => setForm({ ...form, usd: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>ou en FC</Label>
                <Input inputMode="decimal" value={form.fc} onChange={(e) => setForm({ ...form, fc: e.target.value })} />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Remplissez l'un ou l'autre : les FC sont convertis au taux de {rate} FC pour 1 $.
            </p>
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
