import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "record_payment",
  title: "Enregistrer un loyer reçu",
  description: "Enregistre un paiement de loyer reçu d'un locataire, à une date donnée.",
  inputSchema: {
    tenant_id: z.string().uuid().describe("Identifiant du locataire (voir list_tenants)"),
    amount_usd: z.number().positive(),
    received_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe("Date AAAA-MM-JJ"),
    note: z.string().optional(),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async (input, ctx) => {
    const { data, error } = await supabaseForUser(ctx)
      .from("rental_payments")
      .insert({ ...input, note: input.note ?? null, user_id: ctx.getUserId() })
      .select("id")
      .single();
    if (error) throw new ToolError(error.message);
    return { content: [{ type: "text", text: `Paiement enregistré (${data.id}).` }] };
  },
});
