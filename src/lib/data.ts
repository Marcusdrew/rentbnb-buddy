import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type Settings = {
  id: string;
  user_id: string;
  usd_fc_rate: number;
};

export type Tenant = {
  id: string;
  user_id: string;
  name: string;
  expected_usd: number;
  received_usd: number;
  note: string | null;
  created_at: string;
  due_day: number;
};

export type Expense = {
  id: string;
  user_id: string;
  category: string;
  label: string;
  amount_usd: number;
  amount_fc: number;
  paid: boolean;
  expense_date: string;
  note: string | null;
  created_at: string;
};

export const settingsQuery = queryOptions({
  queryKey: ["settings"],
  queryFn: async (): Promise<Settings | null> => {
    const { data, error } = await supabase
      .from("settings")
      .select("*")
      .maybeSingle();
    if (error) throw error;
    return data as Settings | null;
  },
});

export const tenantsQuery = queryOptions({
  queryKey: ["tenants"],
  queryFn: async (): Promise<Tenant[]> => {
    const { data, error } = await supabase
      .from("tenants")
      .select("*").eq("archived", false)
      .order("created_at", { ascending: true });
    if (error) throw error;
    return (data ?? []) as Tenant[];
  },
});

export const expensesQuery = queryOptions({
  queryKey: ["expenses"],
  queryFn: async (): Promise<Expense[]> => {
    const { data, error } = await supabase
      .from("expenses")
      .select("*")
      .order("created_at", { ascending: true });
    if (error) throw error;
    return (data ?? []) as Expense[];
  },
});

export type RentalPayment = { id: string; tenant_id: string; user_id: string; amount_usd: number; received_date: string; note: string | null; covered_months: string[] };
export const paymentsQuery = queryOptions({
  queryKey: ["rental_payments"],
  queryFn: async (): Promise<RentalPayment[]> => {
    const { data, error } = await supabase.from("rental_payments").select("*").order("received_date", { ascending: false });
    if (error) throw error;
    return data ?? [];
  },
});

export async function ensureSettings(userId: string): Promise<Settings> {
  const { data: existing } = await supabase
    .from("settings")
    .select("*")
    .maybeSingle();
  if (existing) return existing as Settings;
  const { data, error } = await supabase
    .from("settings")
    .insert({ user_id: userId, usd_fc_rate: 2300 })
    .select()
    .single();
  if (error) throw error;
  return data as Settings;
}
