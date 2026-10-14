import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2, Pencil, Download, ArrowDownLeft, Home } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { settingsQuery, tenantsQuery, paymentsQuery, type Tenant, type RentalPayment } from "@/lib/data";
import { SEED_TENANTS } from "@/lib/seed";
import { formatUSD, formatFC } from "@/lib/format";
import { localDate, inMonth, displayDate, coveredMonths } from "@/lib/monthly";
function shiftMonth(m:string,d:number){const [y,mo]=m.split("-").map(Number);const x=new Date(y!,mo!-1+d,1);return `${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,"0")}`;}
function monthLabel(m:string){return new Intl.DateTimeFormat("fr",{month:"short",year:"2-digit"}).format(new Date(`${m}-15T12:00:00`));}
import { useMonth } from "@/components/month-picker";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/loyers")({
  head: () => ({
    meta: [
      { title: "Carnet de loyers — Mon Carnet" },
      {
        name: "description",
        content:
          "Liste de vos locataires et de chaque loyer encaissé, mois par mois.",
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

type TenantForm = { id?: string; name: string; note: string; amount: string; date: string; months: string[] };
type Share = { p: RentalPayment; m: string };
function num(v: string) { return Number(v.replace(/\s/g, "").replace(",", ".")); }
function MonthGrid({ month, value, onChange }: { month: string; value: string[]; onChange: (v: string[]) => void }) {
  return <div className="mt-2 grid grid-cols-4 gap-2">{Array.from({length:12},(_,i)=>shiftMonth(month,i-9)).map(m=>{const on=value.includes(m);return <Button key={m} type="button" size="sm" variant={on?"default":"outline"} onClick={()=>onChange(on?value.filter(x=>x!==m):[...value,m])}>{monthLabel(m)}</Button>;})}</div>;
}
function LoyersPage() {
  const { user } = useAuth(); const { month } = useMonth(); const qc = useQueryClient();
  const { data: tenants } = useSuspenseQuery(tenantsQuery);
  const { data: settings } = useSuspenseQuery(settingsQuery);
  const { data: allPayments } = useSuspenseQuery(paymentsQuery);
  const rate = settings?.usd_fc_rate ?? 2300;
  const defaultDate = localDate().startsWith(month) ? localDate() : `${month}-01`;
  const [open,setOpen] = useState(false); const [busy,setBusy] = useState(false);
  const [form,setForm] = useState<TenantForm>({ name: "", note: "", amount: "", date: defaultDate, months: [month] });
  const [paymentOpen,setPaymentOpen] = useState(false);
  const [payment,setPayment] = useState({ id: "", tenantId: "", amount: "", date: localDate(), note: "", months: [] as string[] });
  const [histTenant,setHistTenant] = useState<Tenant|null>(null); const [sel,setSel] = useState<Set<string>>(new Set());
  const sharesOf = (ps: RentalPayment[]): Share[] => ps.flatMap(p => coveredMonths(p).map(m => ({ p, m }))).sort((a,b)=>b.m.localeCompare(a.m));
  const shareAmount = (s: Share) => Number(s.p.amount_usd) / coveredMonths(s.p).length;
  const keyOf = (s: Share) => `${s.p.id}|${s.m}`;
  const tenantHistory = histTenant ? sharesOf(allPayments.filter(p=>p.tenant_id===histTenant.id)) : [];
  const refresh = async () => { await Promise.all([qc.invalidateQueries({ queryKey:["tenants"] }),qc.invalidateQueries({ queryKey:["rental_payments"] })]); };
  /** Retire uniquement les mois choisis ; l'encaissement est supprimé seulement si plus aucun mois ne reste. */
  async function removeShares(shares: Share[]) {
    const byPayment = new Map<string, { p: RentalPayment; months: Set<string> }>();
    for (const s of shares) { const g = byPayment.get(s.p.id) ?? { p: s.p, months: new Set<string>() }; g.months.add(s.m); byPayment.set(s.p.id, g); }
    for (const { p, months } of byPayment.values()) {
      const all = coveredMonths(p); const rest = all.filter(m => !months.has(m));
      const { error } = rest.length === 0
        ? await supabase.from("rental_payments").delete().eq("id", p.id)
        : await supabase.from("rental_payments").update({ covered_months: rest, amount_usd: Math.round(Number(p.amount_usd) * rest.length / all.length * 100) / 100 }).eq("id", p.id);
      if (error) { toast.error(error.message); return false; }
    }
    await refresh(); return true;
  }
  async function removeSelected(){ const chosen=tenantHistory.filter(s=>sel.has(keyOf(s))); if(chosen.length===0||!confirm(`Supprimer ${chosen.length} mois ?`))return; if(await removeShares(chosen)){setSel(new Set());toast.success("Mois supprimés");} }
  async function removeShare(s: Share){ if(!confirm(`Supprimer le paiement de ${monthLabel(s.m)} ?`))return; if(await removeShares([s])) toast.success("Paiement supprimé"); }
  function edit(t?: Tenant) { setForm(t ? { id:t.id,name:t.name,note:t.note??"",amount:"",date:defaultDate,months:[month] } : { name:"",note:"",amount:"",date:defaultDate,months:[month] }); setOpen(true); }
  function receive(t: Tenant, p?: RentalPayment) { setPayment({ id:p?.id??"",tenantId:t.id,amount:String(p?.amount_usd??""),date:p?.received_date??defaultDate,note:p?.note??"",months:p?coveredMonths(p):[month] });setPaymentOpen(true); }
  async function save() {
    if (!user) return;
    if (!form.name.trim()) { toast.error("Indiquez le nom du locataire.");return; }
    const amount = form.amount.trim() ? num(form.amount) : 0;
    if (!form.id && (!Number.isFinite(amount) || amount<0 || (amount>0 && (form.months.length===0 || !form.date)))) { toast.error("Indiquez un montant positif, la date et au moins un mois.");return; }
    setBusy(true);
    if (form.id) {
      const {error} = await supabase.from("tenants").update({ name:form.name.trim(),note:form.note.trim()||null }).eq("id",form.id);
      setBusy(false); if(error){toast.error(error.message);return;}
    } else {
      const months=[...form.months].sort();
      const {data,error} = await supabase.from("tenants").insert({ name:form.name.trim(),note:form.note.trim()||null,expected_usd:months.length?amount/months.length:0,user_id:user.id }).select("id").single();
      if(error||!data){setBusy(false);toast.error(error?.message??"Erreur");return;}
      if(amount>0){const r=await supabase.from("rental_payments").insert({ tenant_id:data.id,user_id:user.id,amount_usd:amount,received_date:form.date,covered_months:months });if(r.error){setBusy(false);toast.error(r.error.message);return;}}
      setBusy(false);
    }
    setOpen(false);await refresh();toast.success(form.id ? "Locataire modifié" : amount>0 ? "Locataire ajouté et loyer encaissé" : "Locataire ajouté");
  }
  async function savePayment() {
    if(!user)return;
    if(!Number.isFinite(num(payment.amount)) || num(payment.amount)<=0 || !payment.date || payment.months.length===0){toast.error("Indiquez un montant positif, la date de réception et au moins un mois concerné.");return;}
    setBusy(true);const payload={tenant_id:payment.tenantId,amount_usd:num(payment.amount),received_date:payment.date,note:payment.note.trim()||null,user_id:user.id,covered_months:[...payment.months].sort()};
    const {error}= payment.id ? await supabase.from("rental_payments").update(payload).eq("id",payment.id) : await supabase.from("rental_payments").insert(payload);
    setBusy(false);if(error){toast.error(error.message);return;}setPaymentOpen(false);await refresh();toast.success("Loyer encaissé");
  }
  async function removeTenant(t:Tenant){if(!confirm(`Retirer ${t.name} de la liste ? Ses loyers déjà encaissés restent dans votre caisse.`))return;const {error}=await supabase.from("tenants").update({archived:true}).eq("id",t.id);if(error){toast.error(error.message);return;}await refresh();toast.success("Locataire retiré");}
  async function importSeed(){if(!user)return;setBusy(true);const {error}=await supabase.from("tenants").insert(SEED_TENANTS.map(t=>({name:t.name,expected_usd:t.expected_usd,user_id:user.id})));setBusy(false);if(error){toast.error(error.message);return;}await refresh();toast.success("Locataires importés.");}
  const receivedMonth=allPayments.filter(p=>inMonth(p.received_date,month)).reduce((s,p)=>s+Number(p.amount_usd),0);
  const total=allPayments.reduce((s,p)=>s+Number(p.amount_usd),0);
  const fmAmount=Number.isFinite(num(form.amount))?num(form.amount):0;
  return <div className="space-y-6 page-enter"><div className="flex flex-wrap items-end justify-between gap-4"><div><p className="section-kicker">MES REVENUS</p><h1 className="mt-2 text-2xl font-semibold sm:text-3xl">Carnet de loyers</h1></div><Button onClick={()=>edit()}><Plus /> Ajouter un locataire</Button></div>
    <div className="grid gap-4 sm:grid-cols-2">{[{label:"Encaissé ce mois-ci",amount:receivedMonth},{label:"Total encaissé (depuis le début)",amount:total}].map(({label,amount})=><Card key={label}><CardContent className="p-5"><p className="text-sm text-muted-foreground">{label}</p><p className="mt-3 text-2xl font-semibold text-success">{formatUSD(amount)}</p><p className="mt-1 text-sm text-muted-foreground">{formatFC(amount*rate)}</p></CardContent></Card>)}</div>
    {tenants.length===0 ? <div className="empty-note flex flex-col items-center gap-4 py-12"><Home className="h-8 w-8 text-primary" /><p>Aucun locataire pour l’instant.</p><Button variant="outline" disabled={busy} onClick={importSeed}><Download /> Reprendre les locataires de mon fichier Excel</Button></div> : <div className="space-y-3">{tenants.map(t=>{
      const shares=sharesOf(allPayments.filter(p=>p.tenant_id===t.id)).filter(s=>s.m===month); const paid=shares.reduce((s,x)=>s+shareAmount(x),0);
      const tenantTotal=allPayments.filter(p=>p.tenant_id===t.id).reduce((s,p)=>s+Number(p.amount_usd),0);
      return <Card key={t.id}><CardContent className="p-5"><div className="flex flex-wrap items-start gap-4"><span className="stat-icon bg-primary/10 text-primary"><Home /></span><div className="min-w-0 flex-1"><h2 className="text-lg font-semibold">{t.name}</h2>{t.note && <p className="mt-1 text-xs text-muted-foreground">{t.note}</p>}</div><div className="flex w-full flex-wrap items-center gap-1 sm:w-auto"><Button size="sm" variant="secondary" onClick={()=>receive(t)}><ArrowDownLeft /> Ajouter un paiement</Button><Button size="sm" variant="outline" onClick={()=>{setSel(new Set());setHistTenant(t);}}>Historique</Button><Button size="icon" variant="ghost" title="Modifier le locataire" onClick={()=>edit(t)}><Pencil /></Button><Button size="icon" variant="ghost" title="Retirer le locataire" onClick={()=>removeTenant(t)}><Trash2 className="text-destructive" /></Button></div></div>
      <div className="mt-5 grid grid-cols-2 gap-3 border-t border-border pt-4">{[{label:`Payé pour ${monthLabel(month)}`,value:paid},{label:"Total encaissé",value:tenantTotal}].map(v=><div key={v.label}><p className="text-xs text-muted-foreground">{v.label}</p><p className="mt-1 truncate text-sm font-semibold text-success sm:text-base">{formatUSD(v.value)}</p><p className="mt-1 text-xs text-muted-foreground">{formatFC(v.value*rate)}</p></div>)}</div>
      {shares.length>0 && <div className="mt-4 border-t border-border pt-2">{shares.map(s=><div key={keyOf(s)} className="flex flex-wrap items-center gap-2 py-2 text-xs"><span className="text-muted-foreground">Reçu le {displayDate(s.p.received_date)}</span><span className="min-w-0 flex-1">{s.p.note||"Loyer"} · pour {monthLabel(s.m)}</span><span className="text-success">{formatUSD(shareAmount(s))} · {formatFC(shareAmount(s)*rate)}</span><Button size="icon" variant="ghost" className="h-7 w-7" title="Modifier le paiement" onClick={()=>receive(t,s.p)}><Pencil /></Button><Button size="icon" variant="ghost" className="h-7 w-7" title="Supprimer ce mois" onClick={()=>removeShare(s)}><Trash2 /></Button></div>)}</div>}
      </CardContent></Card>;
    })}</div>}
    <Dialog open={open} onOpenChange={setOpen}><DialogContent><DialogHeader><DialogTitle>{form.id ? "Modifier le locataire" : "Nouveau locataire"}</DialogTitle></DialogHeader><div className="space-y-4"><div><Label htmlFor="tenant-name">Nom / bien loué</Label><Input id="tenant-name" value={form.name} onChange={e=>setForm({...form,name:e.target.value})} /></div><div><Label htmlFor="tenant-note">Note</Label><Input id="tenant-note" value={form.note} onChange={e=>setForm({...form,note:e.target.value})} /></div>
      {!form.id && <><div><Label htmlFor="tenant-amount">Loyer payé ($)</Label><Input id="tenant-amount" inputMode="decimal" placeholder="Laisser vide si rien n’est payé" value={form.amount} onChange={e=>setForm({...form,amount:e.target.value})} /><p className="mt-2 text-sm text-muted-foreground">{formatFC(fmAmount*rate)} · encaissé directement</p></div><div><Label>Mois payé(s)</Label><MonthGrid month={month} value={form.months} onChange={months=>setForm({...form,months})} />{form.months.length>1 && <p className="mt-2 text-xs text-muted-foreground">Réparti : {formatUSD(fmAmount/form.months.length)} par mois</p>}</div><div><Label htmlFor="tenant-date">Date de réception</Label><Input id="tenant-date" type="date" value={form.date} onChange={e=>setForm({...form,date:e.target.value})} /></div></>}
    </div><DialogFooter><Button onClick={save} disabled={busy}>Enregistrer</Button></DialogFooter></DialogContent></Dialog>
    <Dialog open={paymentOpen} onOpenChange={setPaymentOpen}><DialogContent><DialogHeader><DialogTitle>{payment.id ? "Modifier le paiement" : "Ajouter un paiement"} · {tenants.find(t=>t.id===payment.tenantId)?.name}</DialogTitle></DialogHeader><div className="space-y-4"><div><Label htmlFor="payment-amount">Montant reçu ($)</Label><Input id="payment-amount" inputMode="decimal" value={payment.amount} onChange={e=>setPayment({...payment,amount:e.target.value})} /><p className="mt-2 text-sm text-muted-foreground">{formatFC((Number.isFinite(num(payment.amount)) ? num(payment.amount) : 0)*rate)}</p></div><div><Label>Mois payé(s)</Label><MonthGrid month={month} value={payment.months} onChange={months=>setPayment({...payment,months})} />{payment.months.length>1 && <p className="mt-2 text-xs text-muted-foreground">Réparti : {formatUSD((Number.isFinite(num(payment.amount))?num(payment.amount):0)/payment.months.length)} par mois</p>}</div><div><Label htmlFor="payment-date">Date de réception</Label><Input id="payment-date" type="date" value={payment.date} onChange={e=>setPayment({...payment,date:e.target.value})} /></div><div><Label htmlFor="payment-note">Note</Label><Input id="payment-note" value={payment.note} onChange={e=>setPayment({...payment,note:e.target.value})} /></div></div><DialogFooter><Button disabled={busy} onClick={savePayment}>Enregistrer</Button></DialogFooter></DialogContent></Dialog>
    <Dialog open={!!histTenant} onOpenChange={o=>!o&&setHistTenant(null)}><DialogContent><DialogHeader><DialogTitle>Mois payés · {histTenant?.name}</DialogTitle></DialogHeader>
      {tenantHistory.length===0 ? <p className="text-sm text-muted-foreground">Aucun paiement enregistré.</p> : <div className="divide-y divide-border">{tenantHistory.map(s=><label key={keyOf(s)} className="flex items-center gap-3 py-3 text-sm"><Checkbox checked={sel.has(keyOf(s))} onCheckedChange={()=>setSel(x=>{const n=new Set(x);const k=keyOf(s);if(n.has(k))n.delete(k);else n.add(k);return n;})} /><span className="min-w-0 flex-1"><span className="block font-medium capitalize">{monthLabel(s.m)}</span><span className="block truncate text-xs text-muted-foreground">Reçu le {displayDate(s.p.received_date)}{s.p.note?` · ${s.p.note}`:""}</span></span><span className="shrink-0 text-right text-success">{formatUSD(shareAmount(s))}<span className="block text-xs text-muted-foreground">{formatFC(shareAmount(s)*rate)}</span></span></label>)}</div>}
      <DialogFooter className="gap-2"><Button variant="outline" disabled={tenantHistory.length===0} onClick={()=>setSel(new Set(tenantHistory.map(keyOf)))}>Tout sélectionner</Button><Button variant="destructive" disabled={sel.size===0} onClick={removeSelected}><Trash2 /> Supprimer ({sel.size})</Button></DialogFooter></DialogContent></Dialog>
  </div>;
}
