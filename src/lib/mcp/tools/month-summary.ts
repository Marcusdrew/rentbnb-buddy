import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "month_summary",
  title: "Résumé du mois",
  description: "Loyers encaissés, dépenses et solde (USD et FC) pour un mois donné (AAAA-MM).",
  inputSchema: { month: z.string().regex(/^\d{4}-\d{2}$/).describe("Mois au format AAAA-MM") },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ month }, ctx) => {
    const sb = supabaseForUser(ctx);
    const y = Number(month.slice(0, 4));
    const m = Number(month.slice(5, 7));
    const start = `${month}-01`;
    const end = new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10);
    const [settings, pays, exps] = await Promise.all([
      sb.from("settings").select("usd_fc_rate").maybeSingle(),
      sb.from("rental_payments").select("amount_usd").gte("received_date", start).lt("received_date", end),
      sb.from("expenses").select("amount_usd, amount_fc").gte("expense_date", start).lt("expense_date", end),
    ]);
    const err = settings.error ?? pays.error ?? exps.error;
    if (err) throw new ToolError(err.message);
    const rate = Number(settings.data?.usd_fc_rate ?? 2300);
    const income = (pays.data ?? []).reduce((s, p) => s + Number(p.amount_usd), 0);
    const spent = (exps.data ?? []).reduce((s, e) => s + Number(e.amount_usd) + Number(e.amount_fc) / rate, 0);
    const summary = {
      month, rate_usd_fc: rate,
      income_usd: income, expenses_usd: Math.round(spent * 100) / 100,
      balance_usd: Math.round((income - spent) * 100) / 100,
      balance_fc: Math.round((income - spent) * rate),
    };
    return { content: [{ type: "text", text: JSON.stringify(summary) }], structuredContent: { summary } };
  },
});
