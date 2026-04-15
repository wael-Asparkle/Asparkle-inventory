import React from 'react';

export default function SimpleLineChart({ data, dataKey }) {
  if (!data || data.length === 0) return null;

  const max = Math.max(...data.map(d => d[dataKey] || 0), 1);

  return (
    <svg width="100%" height="150">
      {data.map((d, i) => {
        const x = (i / (data.length - 1)) * 100;
        const y = 150 - ((d[dataKey] || 0) / max) * 150;

        return (
          <circle key={i} cx={`${x}%`} cy={y} r="3" fill="#4f46e5" />
        );
      })}
    </svg>
  );
}
