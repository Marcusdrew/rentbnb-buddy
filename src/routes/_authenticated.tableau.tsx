import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowDownLeft, ArrowUpRight, Pencil, Check, ArrowRight, Wallet, CalendarClock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { settingsQuery, tenantsQuery, expensesQuery, paymentsQuery, ensureSettings } from "@/lib/data";
import { formatUSD, formatFC } from "@/lib/format";
import { inMonth, expenseUsd, monthlyIncome, displayDate, dueDate, generalBalance, previousMonth } from "@/lib/monthly";
import { useMonth } from "@/components/month-picker";
import { BudgetRing } from "@/components/budget-ring";
import { Card, CardContent } from "@/components/ui/card";
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
  const { month } = useMonth();
  const qc = useQueryClient();
  const { data: settings } = useSuspenseQuery(settingsQuery);
  const { data: tenants } = useSuspenseQuery(tenantsQuery);
  const { data: allExpenses } = useSuspenseQuery(expensesQuery);
  const { data: payments } = useSuspenseQuery(paymentsQuery);
  const [editingRate, setEditingRate] = useState(false);
  const [rateInput, setRateInput] = useState("");
  const rate = settings?.usd_fc_rate ?? 2300;
  const expenses = allExpenses.filter(e => inMonth(e.expense_date, month));
  const expected = tenants.reduce((s, t) => s + t.expected_usd, 0);
  const received = monthlyIncome(payments, month);
  const spent = expenses.reduce((s, e) => s + expenseUsd(e, rate), 0);
  const balance = received - spent;
  const carry = generalBalance(payments, allExpenses, rate, previousMonth(month));
  const general = carry + balance;
  const monthName = new Intl.DateTimeFormat("fr", { month: "long" }).format(new Date(`${month}-15T12:00:00`));
  const totalIn = payments.filter(p => p.received_date.slice(0, 7) <= month).reduce((s, p) => s + Number(p.amount_usd), 0);
  const totalOut = allExpenses.filter(e => e.expense_date.slice(0, 7) <= month).reduce((s, e) => s + expenseUsd(e, rate), 0);
  const waiting = tenants.map(t => ({ ...t, remaining: Math.max(0, t.expected_usd - payments.filter(p => p.tenant_id === t.id && inMonth(p.received_date, month)).reduce((s, p) => s + p.amount_usd, 0)) })).filter(t => t.remaining > 0).sort((a, b) => a.due_day - b.due_day);
  const movements = [
    ...payments.filter(p => inMonth(p.received_date, month)).map(p => ({ id: p.id, label: tenants.find(t => t.id === p.tenant_id)?.name ?? "Loyer", date: p.received_date, amount: p.amount_usd, income: true })),
    ...expenses.map(e => ({ id: e.id, label: e.label, date: e.expense_date, amount: expenseUsd(e, rate), income: false })),
  ].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);
  async function saveRate() {
    if (!user) return;
    const value = Number(rateInput.replace(/\s/g, "").replace(",", "."));
    if (!Number.isFinite(value) || value <= 0) { toast.error("Entrez un taux valide."); return; }
    try {
      const current = await ensureSettings(user.id);
      const { error } = await supabase.from("settings").update({ usd_fc_rate: value, updated_at: new Date().toISOString() }).eq("id", current.id);
      if (error) throw error;
      await qc.invalidateQueries({ queryKey: ["settings"] }); setEditingRate(false); toast.success("Taux mis à jour");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Impossible de modifier le taux."); }
  }
  return <div className="space-y-8 page-enter">
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div><p className="section-kicker">VOTRE CARNET PERSONNEL</p><h1 className="mt-2 text-3xl font-semibold">Tout commence par un bon équilibre.</h1></div>
      <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground"><span>1 $ =</span>{editingRate ? <><Input aria-label="Taux de change" className="w-24" value={rateInput} onChange={e => setRateInput(e.target.value)} /><Button size="icon" title="Enregistrer le taux" onClick={saveRate}><Check /></Button></> : <><span className="font-semibold text-foreground">{formatFC(rate)}</span><Button size="icon" variant="ghost" title="Modifier le taux" onClick={() => { setRateInput(String(rate)); setEditingRate(true); }}><Pencil /></Button></>}</div>
    </div>
    <section className="balance-section grid items-center gap-6 border-y border-border py-8 md:grid-cols-[1fr_auto_1fr]">
      <div><span className="mb-4 inline-flex items-center gap-2 text-sm text-primary"><Wallet className="h-4 w-4" /> SOLDE GÉNÉRAL · EN CAISSE</span><p className={`font-display text-5xl font-semibold break-words ${general < 0 ? "text-destructive" : "text-primary"}`}>{formatUSD(general)}</p><p className="mt-3 text-lg text-muted-foreground">{formatFC(general * rate)}</p><div className="mt-4 space-y-1 text-sm text-muted-foreground"><p>Total des loyers encaissés : <span className="font-semibold text-success">+{formatUSD(totalIn)}</span> · {formatFC(totalIn * rate)}</p><p>Total des dépenses : <span className="font-semibold text-destructive">−{formatUSD(totalOut)}</span> · {formatFC(totalOut * rate)}</p><p>Report des mois précédents : <span className="font-semibold text-foreground">{formatUSD(carry)}</span> · {formatFC(carry * rate)}</p><p>Mouvement de ce mois : <span className={`font-semibold ${balance < 0 ? "text-destructive" : "text-success"}`}>{balance >= 0 ? "+" : ""}{formatUSD(balance)}</span> · {formatFC(balance * rate)}</p></div><div className="mt-6 flex flex-wrap gap-2"><Button asChild><Link to="/budget">Mon budget <ArrowRight /></Link></Button><Button asChild variant="outline"><Link to="/loyers">Mes loyers</Link></Button></div></div>
      <BudgetRing income={received} expenses={spent} />
      <div className="space-y-6 md:pl-8"><div className="flex items-start gap-3"><span className="stat-icon bg-success/10 text-success"><ArrowDownLeft /></span><div><p className="text-sm text-muted-foreground">Loyers encaissés en {monthName}</p><p className="mt-1 text-2xl font-semibold text-success">{formatUSD(received)}</p><p className="text-sm text-muted-foreground">{formatFC(received * rate)}</p></div></div><div className="flex items-start gap-3"><span className="stat-icon bg-destructive/10 text-destructive"><ArrowUpRight /></span><div><p className="text-sm text-muted-foreground">Dépenses de {monthName}</p><p className="mt-1 text-2xl font-semibold">{formatUSD(spent)}</p><p className="text-sm text-muted-foreground">{formatFC(spent * rate)}</p></div></div></div>
    </section>
    <div className="grid gap-4 sm:grid-cols-3">{[
      { label: `Loyers attendus pour ${monthName}`, value: expected, sub: `${tenants.length} locataires`, icon: CalendarClock },
      { label: `Reste à encaisser pour ${monthName}`, value: waiting.reduce((s,t) => s+t.remaining,0), sub: `${waiting.length} en attente`, icon: ArrowDownLeft },
      { label: `Dépenses payées en ${monthName}`, value: expenses.filter(e => e.paid).reduce((s,e) => s+expenseUsd(e,rate),0), sub: `${expenses.filter(e=>e.paid).length} sur ${expenses.length} dépenses`, icon: Check },
    ].map(({ label,value,sub,icon: Icon }) => <Card key={label} className="summary-card"><CardContent className="p-5"><div className="flex items-center justify-between text-muted-foreground"><span className="text-sm">{label}</span><Icon className="h-4 w-4" /></div><p className="mt-3 text-2xl font-semibold">{formatUSD(value)}</p><p className="mt-1 text-xs text-muted-foreground">{formatFC(value*rate)} · {sub}</p></CardContent></Card>)}</div>
    <div className="grid gap-8 md:grid-cols-2"><section><div className="mb-4 flex items-center justify-between"><h2 className="text-xl font-semibold">Derniers mouvements</h2><span className="text-xs text-muted-foreground">Ce mois-ci</span></div>{movements.length === 0 ? <p className="empty-note">Aucun mouvement ce mois-ci.</p> : <div className="divide-y divide-border">{movements.map(m => <div key={m.id} className="flex items-center gap-3 py-4"><span className={`stat-icon ${m.income ? "bg-success/10 text-success" : "bg-secondary text-muted-foreground"}`}>{m.income ? <ArrowDownLeft /> : <ArrowUpRight />}</span><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{m.label}</p><p className="mt-1 text-xs text-muted-foreground">{displayDate(m.date)} · {m.income ? "Loyer reçu" : "Dépense"}</p></div><div className="shrink-0 text-right"><p className={`text-sm font-semibold ${m.income ? "text-success" : ""}`}>{m.income ? "+" : "−"}{formatUSD(m.amount)}</p><p className="mt-1 text-xs text-muted-foreground">{formatFC(m.amount*rate)}</p></div></div>)}</div>}</section>
    <section><div className="mb-4 flex items-center justify-between"><h2 className="text-xl font-semibold">Loyers de {monthName} à encaisser</h2><Button asChild variant="ghost" size="sm"><Link to="/loyers">Voir tout <ArrowRight /></Link></Button></div>{waiting.length === 0 ? <p className="empty-note">Aucun loyer en attente.</p> : <div className="divide-y divide-border">{waiting.slice(0,5).map(t => <div key={t.id} className="flex items-center justify-between gap-3 py-4"><div><p className="text-sm font-medium">{t.name}</p><p className="mt-1 text-xs text-muted-foreground">Échéance : {displayDate(dueDate(month,t.due_day))}</p></div><div className="text-right"><p className="text-sm font-semibold">{formatUSD(t.remaining)}</p><p className="mt-1 text-xs text-muted-foreground">{formatFC(t.remaining*rate)}</p></div></div>)}</div>}</section></div>
  </div>;
}
