import { describe, it, expect } from "vitest";
import { coveredAmount, monthlyIncome, rentStatus } from "../lib/monthly";
const donel = [{ received_date: "2026-10-05", amount_usd: 900, covered_months: ["2026-07", "2026-08"] }];
describe("Mois concernés", () => {
  it("le paiement reçu en octobre compte dans la caisse d'octobre", () => { expect(monthlyIncome(donel, "2026-10")).toBe(900); });
  it("juillet et août sont marqués payés", () => {
    expect(rentStatus(450, coveredAmount(donel, "2026-07"), "2026-07", 1, "2026-10-12")).toBe("Payé");
    expect(rentStatus(450, coveredAmount(donel, "2026-08"), "2026-08", 1, "2026-10-12")).toBe("Payé");
  });
  it("octobre n'est pas couvert par ce paiement", () => { expect(coveredAmount(donel, "2026-10")).toBe(0); });
  it("en retard après l'échéance si pas entièrement payé", () => { expect(rentStatus(450, 100, "2026-10", 5, "2026-10-12")).toBe("En retard"); });
  it("partiel avant l'échéance", () => { expect(rentStatus(450, 100, "2026-10", 20, "2026-10-12")).toBe("Partiel"); });
});
