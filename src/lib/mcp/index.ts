import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listTenants from "./tools/list-tenants";
import monthSummary from "./tools/month-summary";
import addExpense from "./tools/add-expense";
import recordPayment from "./tools/record-payment";

const projectRef = import.meta.env["VITE_SUPABASE_PROJECT_ID"] ?? "project-ref-unset";

export default defineMcp({
  name: "rentbnb-buddy",
  title: "Rentbnb Buddy",
  version: "0.1.0",
  instructions:
    "Carnet personnel de loyers et budget (USD et francs congolais). Consultez les locataires, le résumé d'un mois, ajoutez des dépenses et enregistrez des loyers reçus.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [listTenants, monthSummary, addExpense, recordPayment],
});
