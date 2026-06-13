"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

interface RevenueChartProps {
  byMonth: { month: string; totalUsd: number }[];
}

export function RevenueChart({ byMonth }: RevenueChartProps) {
  if (byMonth.length === 0) {
    return (
      <div className="h-48 flex items-center justify-center text-xs text-zinc-600">
        Revenue chart appears after the first revenue entry
      </div>
    );
  }

  return (
    <div className="h-48">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={byMonth} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="revFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f97316" stopOpacity={0.3} />
              <stop offset="100%" stopColor="#f97316" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="#27272a" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="month" stroke="#52525b" fontSize={10} tickLine={false} axisLine={false} />
          <YAxis
            stroke="#52525b"
            fontSize={10}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v: number) => `$${v}`}
            width={48}
          />
          <Tooltip
            contentStyle={{
              background: "#18181b",
              border: "1px solid #27272a",
              borderRadius: 8,
              fontSize: 12,
            }}
            labelStyle={{ color: "#a1a1aa" }}
            formatter={(value) => [`$${Number(value ?? 0).toFixed(2)}`, "Revenue"]}
          />
          <Area
            type="monotone"
            dataKey="totalUsd"
            stroke="#f97316"
            strokeWidth={2}
            fill="url(#revFill)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
