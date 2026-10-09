import { useEffect, useState } from "react";

export function BudgetRing({ income, expenses }: { income: number; expenses: number }) {
  const percentage = income > 0 ? Math.round(expenses / income * 100) : expenses > 0 ? 100 : 0;
  const [progress, setProgress] = useState(0);
  useEffect(() => { const frame = requestAnimationFrame(() => setProgress(Math.min(percentage, 100))); return () => cancelAnimationFrame(frame); }, [percentage]);
  return <div className="budget-ring relative shrink-0" role="img" aria-label={`${percentage} % des revenus engagés`}>
    <svg viewBox="0 0 200 200" className="h-full w-full -rotate-90" aria-hidden="true"><circle cx="100" cy="100" r="82" className="ring-track" /><circle cx="100" cy="100" r="82" pathLength="100" strokeDasharray="100" strokeDashoffset={100 - progress} className={`ring-fill ${percentage > 100 ? "ring-over" : ""}`} /></svg>
    <div className="absolute inset-0 flex flex-col items-center justify-center"><span className="font-display text-4xl font-semibold">{percentage}<span className="text-xl"> %</span></span><span className="mt-2 text-xs text-muted-foreground">du budget engagé</span></div>
  </div>;
}