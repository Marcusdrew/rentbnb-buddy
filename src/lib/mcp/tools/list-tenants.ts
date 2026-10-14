import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_tenants",
  title: "Lister les locataires",
  description: "Liste les locataires du carnet avec leur loyer attendu (USD) et jour d'échéance.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    const { data, error } = await supabaseForUser(ctx)
      .from("tenants")
      .select("id, name, expected_usd, due_day, note").eq("archived", false)
      .order("created_at");
    if (error) throw new ToolError(error.message);
    const tenants = (data ?? []).map((t) => ({
      id: String(t.id), name: String(t.name), expected_usd: Number(t.expected_usd),
      due_day: Number(t.due_day), note: t.note ? String(t.note) : null,
    }));
    return { content: [{ type: "text", text: JSON.stringify(tenants) }], structuredContent: { tenants } };
  },
});
