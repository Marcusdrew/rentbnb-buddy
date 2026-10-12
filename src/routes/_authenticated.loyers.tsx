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
import { localDate, inMonth, displayDate, dueDate, coveredAmount, coveredMonths, rentStatus } from "@/lib/monthly";
function shiftMonth(m:string,d:number){const [y,mo]=m.split("-").map(Number);const x=new Date(y!,mo!-1+d,1);return `${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,"0")}`;}
function monthLabel(m:string){return new Intl.DateTimeFormat("fr",{month:"short",year:"2-digit"}).format(new Date(`${m}-15T12:00:00`));}
const STATUS_CLASS:Record<string,string>={"Payé":"border-success/30 bg-success/10 text-success","Partiel":"border-gold/40 bg-gold/10 text-foreground","En attente":"border-border bg-muted text-muted-foreground","En retard":"border-destructive/30 bg-destructive/10 text-destructive"};
import { useMonth } from "@/components/month-picker";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

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

type TenantForm = { id?: string; name: string; expected: string; day: string; note: string };
function num(v: string) { return Number(v.replace(/\s/g, "").replace(",", ".")); }
function LoyersPage() {
  const { user } = useAuth(); const { month } = useMonth(); const qc = useQueryClient();
  const { data: tenants } = useSuspenseQuery(tenantsQuery);
  const { data: settings } = useSuspenseQuery(settingsQuery);
  const { data: allPayments } = useSuspenseQuery(paymentsQuery);
  const payments = allPayments.filter(p => inMonth(p.received_date,month));
  const rate = settings?.usd_fc_rate ?? 2300;
  const [open,setOpen] = useState(false); const [busy,setBusy] = useState(false);
  const [form,setForm] = useState<TenantForm>({ name: "", expected: "", day: "1", note: "" });
  const [paymentOpen,setPaymentOpen] = useState(false);
  const [payment,setPayment] = useState({ id: "", tenantId: "", amount: "", date: localDate(), note: "", months: [] as string[] });
  const [histTenant,setHistTenant] = useState<Tenant|null>(null); const [sel,setSel] = useState<Set<string>>(new Set());
  const tenantHistory = histTenant ? allPayments.filter(p=>p.tenant_id===histTenant.id).sort((a,b)=>b.received_date.localeCompare(a.received_date)) : [];
  async function removeSelected(){ if(sel.size===0||!confirm(`Supprimer ${sel.size} encaissement(s) ?`))return; const {error}=await supabase.from("rental_payments").delete().in("id",[...sel]); if(error){toast.error(error.message);return;} setSel(new Set()); await refresh(); toast.success("Encaissements supprimés"); }
  const refresh = async () => { await Promise.all([qc.invalidateQueries({ queryKey:["tenants"] }),qc.invalidateQueries({ queryKey:["rental_payments"] })]); };
  const receivedFor = (id: string) => coveredAmount(allPayments.filter(p=>p.tenant_id===id),month);
  function edit(t?: Tenant) { setForm(t ? { id:t.id,name:t.name,expected:String(t.expected_usd),day:String(t.due_day),note:t.note??"" } : { name:"",expected:"",day:"1",note:"" }); setOpen(true); }
  function receive(t: Tenant, p?: RentalPayment) { setPayment({ id:p?.id??"",tenantId:t.id,amount:String(p?.amount_usd??Math.max(0,t.expected_usd-receivedFor(t.id))),date:p?.received_date??(localDate().startsWith(month) ? localDate() : `${month}-01`),note:p?.note??"",months:p?coveredMonths(p):[month] });setPaymentOpen(true); }
  async function save() {
    if (!user) return;
    if (!form.name.trim() || !Number.isFinite(num(form.expected)) || num(form.expected)<0 || !Number.isInteger(num(form.day)) || num(form.day)<1 || num(form.day)>31) { toast.error("Indiquez un nom, un montant positif et un jour de 1 à 31.");return; }
    setBusy(true);
    const payload = { name:form.name.trim(),expected_usd:num(form.expected),due_day:num(form.day),note:form.note.trim()||null };
    const {error} = form.id ? await supabase.from("tenants").update(payload).eq("id",form.id) : await supabase.from("tenants").insert({ ...payload,user_id:user.id });
    setBusy(false);if(error){toast.error(error.message);return;}setOpen(false);await refresh();toast.success("Locataire enregistré");
  }
  async function savePayment() {
    if(!user)return;
    if(!Number.isFinite(num(payment.amount)) || num(payment.amount)<=0 || !payment.date || payment.months.length===0){toast.error("Indiquez un montant positif, la date de réception et au moins un mois concerné.");return;}
    setBusy(true);const payload={tenant_id:payment.tenantId,amount_usd:num(payment.amount),received_date:payment.date,note:payment.note.trim()||null,user_id:user.id,covered_months:[...payment.months].sort()};
    const {error}= payment.id ? await supabase.from("rental_payments").update(payload).eq("id",payment.id) : await supabase.from("rental_payments").insert(payload);
    setBusy(false);if(error){toast.error(error.message);return;}setPaymentOpen(false);await refresh();toast.success("Encaissement enregistré");
  }
  async function removeTenant(t:Tenant){if(!confirm(`Supprimer ${t.name} et ses encaissements ?`))return;const {error}=await supabase.from("tenants").delete().eq("id",t.id);if(error){toast.error(error.message);return;}await refresh();}
  async function removePayment(p:RentalPayment){if(!confirm("Supprimer cet encaissement ?"))return;const {error}=await supabase.from("rental_payments").delete().eq("id",p.id);if(error){toast.error(error.message);return;}await refresh();}
  async function importSeed(){if(!user)return;setBusy(true);const {error}=await supabase.from("tenants").insert(SEED_TENANTS.map(t=>({name:t.name,expected_usd:t.expected_usd,user_id:user.id})));setBusy(false);if(error){toast.error(error.message);return;}await refresh();toast.success("Locataires importés. Les encaissements restent à dater.");}
  const expected=tenants.reduce((s,t)=>s+t.expected_usd,0), received=payments.reduce((s,p)=>s+p.amount_usd,0);
  return <div className="space-y-6 page-enter"><div className="flex flex-wrap items-end justify-between gap-4"><div><p className="section-kicker">MES REVENUS</p><h1 className="mt-2 text-2xl font-semibold sm:text-3xl">Carnet de loyers</h1></div><Button onClick={()=>edit()}><Plus /> Ajouter un locataire</Button></div>
    <div className="grid gap-4 sm:grid-cols-3">{[{label:"Attendu ce mois-ci",amount:expected},{label:"Encaissé ce mois-ci",amount:received},{label:"Reste à encaisser",amount:tenants.reduce((s,t)=>s+Math.max(0,t.expected_usd-receivedFor(t.id)),0)}].map(({label,amount})=><Card key={label}><CardContent className="p-5"><p className="text-sm text-muted-foreground">{label}</p><p className="mt-3 text-2xl font-semibold">{formatUSD(amount)}</p><p className="mt-1 text-sm text-muted-foreground">{formatFC(amount*rate)}</p></CardContent></Card>)}</div>
    {tenants.length===0 ? <div className="empty-note flex flex-col items-center gap-4 py-12"><Home className="h-8 w-8 text-primary" /><p>Aucun locataire pour l’instant.</p><Button variant="outline" disabled={busy} onClick={importSeed}><Download /> Reprendre les locataires de mon fichier Excel</Button></div> : <div className="space-y-3">{tenants.map(t=>{
      const received=receivedFor(t.id), rest=Math.max(0,t.expected_usd-received);const history=allPayments.filter(p=>p.tenant_id===t.id&&coveredMonths(p).includes(month));const status=rentStatus(t.expected_usd,received,month,t.due_day);
      return <Card key={t.id}><CardContent className="p-5"><div className="flex flex-wrap items-start gap-4"><span className="stat-icon bg-primary/10 text-primary"><Home /></span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h2 className="text-lg font-semibold">{t.name}</h2><Badge variant="outline" className={STATUS_CLASS[status]}>{status}</Badge></div><p className="mt-1 text-xs text-muted-foreground">Échéance : {displayDate(dueDate(month,t.due_day))}{t.note ? ` · ${t.note}` : ""}</p></div><div className="flex w-full flex-wrap items-center gap-1 sm:w-auto"><Button size="sm" variant="secondary" onClick={()=>receive(t)}><ArrowDownLeft /> Encaisser</Button><Button size="sm" variant="outline" onClick={()=>{setSel(new Set());setHistTenant(t);}}>Mois</Button><Button size="icon" variant="ghost" title="Modifier le locataire" onClick={()=>edit(t)}><Pencil /></Button><Button size="icon" variant="ghost" title="Supprimer le locataire" onClick={()=>removeTenant(t)}><Trash2 className="text-destructive" /></Button></div></div>
      <div className="mt-5 grid grid-cols-3 gap-2 sm:gap-3 border-t border-border pt-4">{[{label:"Attendu",value:t.expected_usd},{label:"Reçu",value:received},{label:"Reste",value:rest}].map(v=><div key={v.label}><p className="text-xs text-muted-foreground">{v.label}</p><p className={`mt-1 truncate text-sm sm:text-base font-semibold ${v.label==="Reçu" ? "text-success" : ""}`}>{formatUSD(v.value)}</p><p className="mt-1 text-xs text-muted-foreground">{formatFC(v.value*rate)}</p></div>)}</div>
      {history.length>0 && <div className="mt-4 border-t border-border pt-2">{history.map(p=><div key={p.id} className="flex flex-wrap items-center gap-2 py-2 text-xs"><span className="text-muted-foreground">{displayDate(p.received_date)}</span><span className="min-w-0 flex-1">{p.note||"Loyer reçu"} · pour {coveredMonths(p).map(monthLabel).join(", ")}</span><span className="text-success">{formatUSD(p.amount_usd)} · {formatFC(p.amount_usd*rate)}</span><Button size="icon" variant="ghost" className="h-7 w-7" title="Modifier l’encaissement" onClick={()=>receive(t,p)}><Pencil /></Button><Button size="icon" variant="ghost" className="h-7 w-7" title="Supprimer l’encaissement" onClick={()=>removePayment(p)}><Trash2 /></Button></div>)}</div>}
      </CardContent></Card>;
    })}</div>}
    <Dialog open={open} onOpenChange={setOpen}><DialogContent><DialogHeader><DialogTitle>{form.id ? "Modifier le locataire" : "Nouveau locataire"}</DialogTitle></DialogHeader><div className="space-y-4"><div><Label htmlFor="tenant-name">Nom / bien loué</Label><Input id="tenant-name" value={form.name} onChange={e=>setForm({...form,name:e.target.value})} /></div><div className="grid grid-cols-2 gap-3"><div><Label htmlFor="expected">Loyer mensuel ($)</Label><Input id="expected" inputMode="decimal" value={form.expected} onChange={e=>setForm({...form,expected:e.target.value})} /></div><div><Label htmlFor="due-day">Jour d’échéance</Label><Input id="due-day" type="number" min="1" max="31" value={form.day} onChange={e=>setForm({...form,day:e.target.value})} /></div></div><div><Label htmlFor="tenant-note">Note</Label><Input id="tenant-note" value={form.note} onChange={e=>setForm({...form,note:e.target.value})} /></div></div><DialogFooter><Button onClick={save} disabled={busy}>Enregistrer</Button></DialogFooter></DialogContent></Dialog>
    <Dialog open={paymentOpen} onOpenChange={setPaymentOpen}><DialogContent><DialogHeader><DialogTitle>{payment.id ? "Modifier l’encaissement" : "Encaisser un loyer"} · {tenants.find(t=>t.id===payment.tenantId)?.name}</DialogTitle></DialogHeader><div className="space-y-4"><div><Label htmlFor="payment-amount">Montant reçu ($)</Label><Input id="payment-amount" inputMode="decimal" value={payment.amount} onChange={e=>setPayment({...payment,amount:e.target.value})} /><p className="mt-2 text-sm text-muted-foreground">{formatFC((Number.isFinite(num(payment.amount)) ? num(payment.amount) : 0)*rate)}</p></div><div><Label>Mois concerné(s)</Label><div className="mt-2 grid grid-cols-4 gap-2">{Array.from({length:12},(_,i)=>shiftMonth(month,i-9)).map(m=>{const on=payment.months.includes(m);return <Button key={m} type="button" size="sm" variant={on?"default":"outline"} onClick={()=>setPayment({...payment,months:on?payment.months.filter(x=>x!==m):[...payment.months,m]})}>{monthLabel(m)}</Button>;})}</div>{payment.months.length>1 && <p className="mt-2 text-xs text-muted-foreground">Réparti : {formatUSD((Number.isFinite(num(payment.amount))?num(payment.amount):0)/payment.months.length)} par mois</p>}</div><div><Label htmlFor="payment-date">Date de réception</Label><Input id="payment-date" type="date" value={payment.date} onChange={e=>setPayment({...payment,date:e.target.value})} /></div><div><Label htmlFor="payment-note">Note</Label><Input id="payment-note" value={payment.note} onChange={e=>setPayment({...payment,note:e.target.value})} /></div></div><DialogFooter><Button disabled={busy} onClick={savePayment}>Enregistrer l’encaissement</Button></DialogFooter></DialogContent></Dialog>
    <Dialog open={!!histTenant} onOpenChange={o=>!o&&setHistTenant(null)}><DialogContent><DialogHeader><DialogTitle>Mois encaissés · {histTenant?.name}</DialogTitle></DialogHeader>
      {tenantHistory.length===0 ? <p className="text-sm text-muted-foreground">Aucun encaissement enregistré.</p> : <div className="divide-y divide-border">{tenantHistory.map(p=><label key={p.id} className="flex items-center gap-3 py-3 text-sm"><Checkbox checked={sel.has(p.id)} onCheckedChange={()=>setSel(s=>{const n=new Set(s);if(n.has(p.id))n.delete(p.id);else n.add(p.id);return n;})} /><span className="min-w-0 flex-1"><span className="block">{displayDate(p.received_date)}</span><span className="block truncate text-xs text-muted-foreground">Pour {coveredMonths(p).map(monthLabel).join(", ")}{p.note?` · ${p.note}`:""}</span></span><span className="shrink-0 text-right text-success">{formatUSD(p.amount_usd)}<span className="block text-xs text-muted-foreground">{formatFC(p.amount_usd*rate)}</span></span></label>)}</div>}
      <DialogFooter className="gap-2"><Button variant="outline" disabled={tenantHistory.length===0} onClick={()=>setSel(new Set(tenantHistory.map(p=>p.id)))}>Tout sélectionner</Button><Button variant="destructive" disabled={sel.size===0} onClick={removeSelected}><Trash2 /> Supprimer ({sel.size})</Button></DialogFooter></DialogContent></Dialog>
  </div>;
}
