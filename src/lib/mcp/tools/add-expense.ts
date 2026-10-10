import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "add_expense",
  title: "Ajouter une dépense",
  description: "Ajoute une dépense de la maison (montant en USD et/ou FC) au budget.",
  inputSchema: {
    label: z.string().trim().min(1).describe("Libellé, ex. « Makala »"),
    category: z.string().trim().min(1).describe("Catégorie, ex. « Alimentation »"),
    amount_usd: z.number().min(0).default(0),
    amount_fc: z.number().min(0).default(0),
    expense_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe("Date AAAA-MM-JJ"),
    paid: z.boolean().default(false),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async (input, ctx) => {
    const { data, error } = await supabaseForUser(ctx)
      .from("expenses")
      .insert({ ...input, user_id: ctx.getUserId() })
      .select("id")
      .single();
    if (error) throw new ToolError(error.message);
    return { content: [{ type: "text", text: `Dépense ajoutée (${data.id}).` }] };
  },
});
