'use client';

import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';

export interface AnalyticsChartDataPoint {
  date: string;
  isoDate?: string;
  clicks: number;
  spend: number;
  weekday?: number;
}

interface AnalyticsChartProps {
  data: AnalyticsChartDataPoint[];
}

interface TooltipPayloadItem {
  dataKey: string;
  value: number;
  [key: string]: unknown;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  label?: string;
}

const CustomTooltip = ({ active, payload, label }: CustomTooltipProps) => {
  if (active && payload && payload.length) {
    const clicks = payload.find(p => p.dataKey === 'clicks')?.value || 0;
    const spend = payload.find(p => p.dataKey === 'spend')?.value || 0;
    const cpc = clicks > 0 ? spend / clicks : 0;

    return (
      <div className="bg-[#0A0E17]/95 border border-white/[0.1] rounded-xl p-3.5 shadow-2xl backdrop-blur-md min-w-[210px]">
        <div className="flex items-center justify-between pb-2 mb-2 border-b border-white/[0.08]">
          <span className="text-xs font-mono font-medium text-slate-300">{label}</span>
          <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500">Timeline Event</span>
        </div>
        <div className="space-y-2 font-mono text-xs">
          <div className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5 text-slate-400">
              <span className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_6px_rgba(59,130,246,0.6)]" /> Spend
            </span>
            <span className="font-semibold text-white tabular-nums">
              ₹{spend.toLocaleString('en-IN')}
            </span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5 text-slate-400">
              <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(16,185,129,0.6)]" /> Clicks
            </span>
            <span className="font-semibold text-emerald-400 tabular-nums">
              {clicks.toLocaleString('en-IN')}
            </span>
          </div>
          {(clicks > 0 || spend > 0) && (
            <div className="mt-2.5 pt-2 border-t border-white/[0.08] flex items-center justify-between gap-3 text-[11px]">
              <span className="text-slate-400">Unit Cost</span>
              <span className="text-slate-200 tabular-nums font-medium">
                {clicks > 0
                  ? (cpc < 100 ? `₹${cpc.toFixed(2)}/click` : `₹${Math.round(cpc).toLocaleString('en-IN')}/click`)
                  : 'Awaiting clicks'}
              </span>
            </div>
          )}
        </div>
      </div>
    );
  }
  return null;
};

export default function AnalyticsChart({ data }: AnalyticsChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="h-full w-full flex items-center justify-center text-xs font-mono text-slate-500">
        No campaign timeline data available for this range.
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={data} margin={{ top: 12, right: 12, left: -16, bottom: 0 }}>
        <defs>
          <linearGradient id="spendGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3B82F6" stopOpacity={0.15} />
            <stop offset="100%" stopColor="#3B82F6" stopOpacity={0.0} />
          </linearGradient>
          <linearGradient id="clicksGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#10B981" stopOpacity={0.15} />
            <stop offset="100%" stopColor="#10B981" stopOpacity={0.0} />
          </linearGradient>
        </defs>

        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255, 255, 255, 0.05)" />

        <XAxis
          dataKey="date"
          axisLine={{ stroke: 'rgba(255, 255, 255, 0.08)' }}
          tickLine={false}
          tick={{ fill: '#64748b', fontSize: 10, fontFamily: 'monospace' }}
          dy={8}
          minTickGap={24}
        />

        <YAxis
          yAxisId="left"
          axisLine={false}
          tickLine={false}
          tick={{ fill: '#64748b', fontSize: 10, fontFamily: 'monospace' }}
          allowDecimals={false}
          domain={[0, (dataMax: number) => Math.max(dataMax, 4)]}
          tickFormatter={(val) => (val >= 1000 ? `${(val / 1000).toFixed(1).replace(/\.0$/, '')}k` : `${val}`)}
        />

        <YAxis
          yAxisId="right"
          orientation="right"
          axisLine={false}
          tickLine={false}
          tick={{ fill: '#64748b', fontSize: 10, fontFamily: 'monospace' }}
          domain={[0, (dataMax: number) => Math.max(dataMax, 10000)]}
          tickFormatter={(val) => {
            if (val === 0) return '₹0';
            if (val >= 100000) return `₹${(val / 100000).toFixed(1).replace(/\.0$/, '')}L`;
            if (val >= 1000) return `₹${Math.round(val / 1000)}k`;
            return `₹${val}`;
          }}
        />

        <Tooltip
          content={<CustomTooltip />}
          cursor={{ stroke: 'rgba(255, 255, 255, 0.1)', strokeWidth: 1, strokeDasharray: '3 3' }}
        />

        {/* Spend Area (Right Y-Axis, Blue Gradient) */}
        <Area
          yAxisId="right"
          type="monotone"
          dataKey="spend"
          name="Spend (₹)"
          stroke="#3B82F6"
          strokeWidth={1.75}
          fill="url(#spendGradient)"
          activeDot={{ r: 4, fill: '#3B82F6', stroke: '#05070B', strokeWidth: 2 }}
        />

        {/* Clicks Area (Left Y-Axis, Emerald Gradient) */}
        <Area
          yAxisId="left"
          type="monotone"
          dataKey="clicks"
          name="Clicks"
          stroke="#10B981"
          strokeWidth={2}
          fill="url(#clicksGradient)"
          activeDot={{ r: 5, fill: '#10B981', stroke: '#05070B', strokeWidth: 2 }}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
