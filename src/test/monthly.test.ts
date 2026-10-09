import { describe, it, expect } from "vitest";
import { monthlyIncome, expenseUsd, dueDate, inMonth } from "../lib/monthly";
describe("Carnet mensuel", () => {
  it("additionne les revenus de dates différentes dans un même mois", () => {
    expect(monthlyIncome([{ received_date: "2026-10-02", amount_usd: 1000 }, { received_date: "2026-10-20", amount_usd: 900 }, { received_date: "2026-09-20", amount_usd: 450 }], "2026-10")).toBe(1900);
  });
  it("convertit les dépenses FC en USD au taux 2300", () => { expect(expenseUsd({ amount_usd: 0, amount_fc: 23000 }, 2300)).toBe(10); });
  it("affiche l'équivalent FC d'une dépense USD", () => { expect(expenseUsd({ amount_usd: 100, amount_fc: 0 }, 2300) * 2300).toBe(230000); });
  it("sépare les dépenses des mois voisins", () => { expect(inMonth("2026-09-30", "2026-10")).toBe(false); expect(inMonth("2026-10-01", "2026-10")).toBe(true); });
  it("recalcule le solde après chaque dépense", () => { expect(monthlyIncome([{ received_date: "2026-10-04", amount_usd: 1000 }], "2026-10") - expenseUsd({ amount_usd: 700, amount_fc: 23000 }, 2300)).toBe(290); });
  it("adapte les échéances aux mois courts", () => { expect(dueDate("2026-02", 31)).toBe("2026-02-28"); });
});