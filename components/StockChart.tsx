
import React from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface StockChartProps {
  data: { time: string; price: number }[];
  color?: string;
  height?: number | string;
  isMini?: boolean;
}

const StockChart: React.FC<StockChartProps> = ({ data, color = "#10b981", height = 200, isMini = false }) => {
  return (
    <div style={{ width: '100%', height: height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 5, right: 0, left: 0, bottom: 5 }}>
          <defs>
            <linearGradient id={`colorPrice-${color}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={color} stopOpacity={isMini ? 0.1 : 0.3}/>
              <stop offset="95%" stopColor={color} stopOpacity={0}/>
            </linearGradient>
          </defs>
          {!isMini && <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e293b" opacity={0.4} />}
          <XAxis dataKey="time" hide />
          <YAxis hide domain={['auto', 'auto']} />
          {!isMini && (
            <Tooltip 
              contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px', color: '#f8fafc', fontSize: '12px' }}
              itemStyle={{ color: color }}
              labelStyle={{ display: 'none' }}
            />
          )}
          <Area 
            type="monotone" 
            dataKey="price" 
            stroke={color} 
            fillOpacity={1} 
            fill={`url(#colorPrice-${color})`} 
            strokeWidth={isMini ? 1.5 : 2.5}
            isAnimationActive={!isMini}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

export default StockChart;
