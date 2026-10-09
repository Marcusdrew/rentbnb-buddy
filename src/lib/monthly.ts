import { fcToUsd } from "./format";

export function localDate(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
export function inMonth(date: string, month: string) { return date.slice(0, 7) === month; }
export function expenseUsd(expense: { amount_usd: number; amount_fc: number }, rate: number) {
  return Number(expense.amount_usd) + fcToUsd(Number(expense.amount_fc), rate);
}
export function monthlyIncome(payments: { received_date: string; amount_usd: number }[], month: string) {
  return payments.filter(p => inMonth(p.received_date, month)).reduce((s, p) => s + Number(p.amount_usd), 0);
}
export function dueDate(month: string, day: number) {
  const [year, m] = month.split("-").map(Number);
  if (year === undefined || m === undefined) return `${month}-01`;
  const last = new Date(year, m, 0).getDate();
  return `${month}-${String(Math.min(day, last)).padStart(2, "0")}`;
}
export function displayDate(date: string) { return new Intl.DateTimeFormat("fr", { day: "numeric", month: "short" }).format(new Date(`${date}T12:00:00`)); }