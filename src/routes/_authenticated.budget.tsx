import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2, Pencil, Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { settingsQuery, paymentsQuery, expensesQuery, type Expense } from "@/lib/data";
import { SEED_EXPENSES, CATEGORIES } from "@/lib/seed";
import { formatUSD, formatFC, fcToUsd } from "@/lib/format";
import { localDate, inMonth, expenseUsd, monthlyIncome, displayDate } from "@/lib/monthly";
import { useMonth } from "@/components/month-picker";
import { BudgetRing } from "@/components/budget-ring";
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
  date: string;
};
const EMPTY: FormState = { category: "Alimentation", label: "", usd: "", fc: "", note: "", date: localDate() };

function num(v: string) {
  const n = Number(v.replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

function BudgetPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { month } = useMonth();
  const { data: allExpenses } = useSuspenseQuery(expensesQuery);
  const { data: payments } = useSuspenseQuery(paymentsQuery);
  const expenses = useMemo(() => allExpenses.filter(e => inMonth(e.expense_date, month)), [allExpenses, month]);
  const { data: settings } = useSuspenseQuery(settingsQuery);
  const rate = settings?.usd_fc_rate ?? 2300;

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [busy, setBusy] = useState(false);

  const refresh = () => qc.invalidateQueries({ queryKey: ["expenses"] });
  const costUsd = (e: Expense) => expenseUsd(e, rate);

  const income = monthlyIncome(payments, month);
  const total = expenses.reduce((s, e) => s + costUsd(e), 0);
  const paidTotal = expenses.filter((e) => e.paid).reduce((s, e) => s + costUsd(e), 0);
  const balance = income - total;

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
    setForm({ ...EMPTY, date: localDate().startsWith(month) ? localDate() : `${month}-01` });
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
      date: e.expense_date,
    });
    setOpen(true);
  }

  async function save() {
    if (!user || !form.label.trim()) {
      toast.error("Indiquez le nom de la dépense.");
      return;
    }
    if (!form.date || num(form.usd) < 0 || num(form.fc) < 0) { toast.error("Indiquez une date et un montant positif."); return; }
    setBusy(true);
    const payload = {
      category: form.category,
      label: form.label.trim(),
      amount_usd: num(form.usd),
      amount_fc: num(form.fc),
      note: form.note.trim() || null,
      expense_date: form.date,
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
      .insert(SEED_EXPENSES.map((e) => ({ ...e, expense_date: `${month}-01`, user_id: user.id })));
    if (error) { toast.error(error.message); return; }
    refresh();
    toast.success("Dépenses de votre fichier importées");
  }

  return (
    <div className="space-y-6 page-enter">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="section-kicker">MES DÉPENSES</p><h1 className="mt-2 text-3xl font-semibold">Budget de la maison</h1>

        </div>
        <Button onClick={openNew}>
          <Plus className="mr-1 h-4 w-4" /> Ajouter une dépense
        </Button>
      </div>

      <section className="flex flex-wrap items-center justify-between gap-6 border-y border-border py-6">
        <BudgetRing income={income} expenses={total} />
        <div className="grid flex-1 grid-cols-2 gap-6 min-w-60">
          {[{ label: "Revenus reçus", value: income }, { label: "Total des dépenses", value: total }, { label: "Déjà payé", value: paidTotal }, { label: "Solde du mois", value: balance }].map(v => <div key={v.label}><p className="text-xs text-muted-foreground">{v.label}</p><p className={`mt-1 text-2xl font-semibold ${v.value < 0 ? "text-destructive" : "text-primary"}`}>{formatUSD(v.value)}</p><p className="mt-1 text-xs text-muted-foreground">{formatFC(v.value * rate)}</p></div>)}
        </div>
      </section>

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
                  <span className="text-right text-sm font-medium">{formatUSD(sub)}<span className="block text-xs text-muted-foreground">{formatFC(sub * rate)}</span></span>
                </div>
                <Card>
                  <CardContent className="divide-y divide-border p-0">
                    {items.map((e) => (
                      <div key={e.id} className="flex flex-wrap items-center gap-2 px-4 py-4">
                        <Checkbox checked={e.paid} onCheckedChange={() => togglePaid(e)} title="Payé" aria-label={`Marquer ${e.label} payé`} />
                        <div className="min-w-28 flex-1">
                          <p className={`truncate text-sm ${e.paid ? "text-muted-foreground line-through" : ""}`}>
                            {e.label}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">{displayDate(e.expense_date)}{e.note ? ` · ${e.note}` : ""}</p>
                        </div>
                        <div className="text-right text-sm">
                          <p className="font-semibold">{formatUSD(costUsd(e))}</p>
                          <p className="mt-1 text-xs text-muted-foreground">{formatFC(costUsd(e) * rate)}</p>
                        </div>
                        <Button size="icon" variant="ghost" className="h-8 w-8" title="Modifier la dépense" onClick={() => openEdit(e)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-8 w-8" title="Supprimer la dépense" onClick={() => remove(e)}>
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
            <div className="space-y-2"><Label htmlFor="expense-date">Date de la dépense</Label><Input id="expense-date" type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="expense-usd">Prix en $</Label>
                <Input id="expense-usd" inputMode="decimal" value={form.usd} onChange={(e) => setForm({ ...form, usd: e.target.value, fc: "" })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="expense-fc">ou en FC</Label>
                <Input id="expense-fc" inputMode="decimal" value={form.fc} onChange={(e) => setForm({ ...form, fc: e.target.value, usd: "" })} />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              {formatUSD(num(form.usd) + fcToUsd(num(form.fc), rate))} = {formatFC((num(form.usd) + fcToUsd(num(form.fc), rate)) * rate)}
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
