import { describe, it, expect } from "vitest";
import { generalBalance, previousMonth } from "../lib/monthly";
describe("Solde général", () => {
  const pays = [{ received_date: "2026-09-05", amount_usd: 1000 }, { received_date: "2026-10-03", amount_usd: 500 }];
  const exps = [{ expense_date: "2026-09-10", amount_usd: 700, amount_fc: 0 }, { expense_date: "2026-10-12", amount_usd: 0, amount_fc: 230000 }];
  it("reporte le reste de septembre sur octobre", () => { expect(generalBalance(pays, exps, 2300, "2026-09")).toBe(300); });
  it("cumule tout depuis le début", () => { expect(generalBalance(pays, exps, 2300, "2026-10")).toBe(700); });
  it("passe d'une année à l'autre", () => { expect(previousMonth("2026-01")).toBe("2025-12"); });
});
