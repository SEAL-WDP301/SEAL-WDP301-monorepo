"use client";
import { AreaChart } from "@tremor/react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { RegistrationTrendPoint } from "@/lib/organizer/registrations/registration-types";
import { formatRegistrationNumber } from "@/lib/organizer/registrations/registration-formatters";
export function RegistrationTrendChart({ data }: { data: RegistrationTrendPoint[] }) {
  const total = data.reduce((sum, item) => sum + item.Total, 0);
  return <Card><CardHeader><CardTitle>Registration Trend</CardTitle><CardDescription>Last 30 days · {formatRegistrationNumber(total)} registrations in this period</CardDescription></CardHeader><CardContent><AreaChart data={data} index="date" categories={["Total", "Approved"]} colors={["orange", "emerald"]} valueFormatter={formatRegistrationNumber} className="h-72" showAnimation={false} /></CardContent></Card>;
}
