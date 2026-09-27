'use client';

import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const clicks = payload.find((p: any) => p.dataKey === 'clicks')?.value || 0;
    const spend = payload.find((p: any) => p.dataKey === 'spend')?.value || 0;
    const roi = spend > 0 ? ((clicks / spend) * 1000).toFixed(1) : 0;
    
    return (
      <div className="bg-slate-900/95 dark:bg-slate-800 border border-slate-700 rounded-xl p-3 shadow-xl backdrop-blur-sm">
        <p className="text-slate-400 text-xs font-semibold mb-2 border-b border-slate-700 pb-1">{label}</p>
        <div className="space-y-1">
          <p className="text-sm font-bold text-blue-400 flex justify-between gap-4">
            <span>Spend:</span> <span>₹{spend.toLocaleString('en-IN')}</span>
          </p>
          <p className="text-sm font-bold text-emerald-400 flex justify-between gap-4">
            <span>Clicks:</span> <span>{clicks.toLocaleString('en-IN')}</span>
          </p>
          <div className="mt-2 pt-1 border-t border-slate-700/50">
            <p className="text-[10px] text-slate-400 uppercase tracking-wider">Daily ROI</p>
            <p className="text-sm font-bold text-white">{roi} clicks / ₹1k</p>
          </div>
        </div>
      </div>
    );
  }
  return null;
};

export default function AnalyticsChart({ data }: { data: any[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={data} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" opacity={0.15} />
        <XAxis 
          dataKey="date" 
          axisLine={false} 
          tickLine={false} 
          tick={{ fill: '#64748b', fontSize: 10, fontWeight: 500 }}
          dy={10}
          minTickGap={15}
        />
        <YAxis 
          yAxisId="left"
          axisLine={false} 
          tickLine={false} 
          tick={{ fill: '#64748b', fontSize: 10, fontWeight: 500 }}
          tickFormatter={(val) => val >= 1000 ? `${(val / 1000).toFixed(1)}k` : val}
        />
        <YAxis 
          yAxisId="right" 
          orientation="right" 
          axisLine={false} 
          tickLine={false} 
          tick={{ fill: '#64748b', fontSize: 10, fontWeight: 500 }}
          tickFormatter={(val) => val >= 1000 ? `₹${(val / 1000).toFixed(1)}k` : `₹${val}`}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(51, 65, 85, 0.05)' }} />
        <Bar yAxisId="right" dataKey="spend" name="Spend" fill="#3b82f6" opacity={0.3} radius={[4, 4, 0, 0]} />
        <Line yAxisId="left" type="monotone" dataKey="clicks" name="Clicks" stroke="#10b981" strokeWidth={3} dot={{ r: 0 }} activeDot={{ r: 6, fill: '#10b981', stroke: '#fff', strokeWidth: 2 }} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
