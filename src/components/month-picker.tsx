import { createContext, useContext, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { localDate } from "@/lib/monthly";

const MonthContext = createContext({ month: localDate().slice(0, 7), setMonth: (_month: string) => {} });
export function MonthProvider({ children }: { children: ReactNode }) {
  const [month, setMonth] = useState(localDate().slice(0, 7));
  return <MonthContext.Provider value={{ month, setMonth }}>{children}</MonthContext.Provider>;
}
export function useMonth() { return useContext(MonthContext); }
export function MonthPicker() {
  const { month, setMonth } = useMonth();
  function move(delta: number) {
    const [y, m] = month.split("-").map(Number);
    setMonth(localDate(new Date(y, m - 1 + delta, 1)).slice(0, 7));
  }
  return <div className="flex items-center gap-1"><CalendarDays className="mr-2 h-4 w-4 text-primary" /><Button variant="ghost" size="icon" title="Mois précédent" onClick={() => move(-1)}><ChevronLeft /></Button><Input aria-label="Mois du carnet" type="month" className="w-44 border-none bg-transparent font-medium" value={month} onChange={e => e.target.value && setMonth(e.target.value)} /><Button variant="ghost" size="icon" title="Mois suivant" onClick={() => move(1)}><ChevronRight /></Button></div>;
}