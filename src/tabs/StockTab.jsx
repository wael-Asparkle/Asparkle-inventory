import React, { useMemo } from 'react';
import { PackageOpen } from 'lucide-react';
import useAppData from '../hooks/useAppData';

export default function StockTab() {
  const { movements, productDetails } = useAppData();

  const stock = useMemo(() => {
    let result = {};

    Object.values(productDetails || {}).forEach((p) => {
      result[p.sku] = parseInt(p.openingStock) || 0;
    });

    (movements || []).forEach((m) => {
      const qty = parseInt(m.quantity) || 0;

      const isOut =
        m.type?.includes('بيع') ||
        m.type?.includes('نقص') ||
        m.type?.includes('تالف');

      const multiplier = isOut ? -1 : 1;

      if (!result[m.code]) result[m.code] = 0;

      result[m.code] += qty * multiplier;
    });

    return result;
  }, [movements, productDetails]);

  const stats = useMemo(() => {
    const values = Object.values(stock);

    const total = values.reduce((a, b) => a + b, 0);
    const low = values.filter((v) => v > 0 && v <= 10).length;
    const zero = values.filter((v) => v <= 0).length;

    return { total, low, zero };
  }, [stock]);

  return (
    <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-8" dir="rtl">
      
      <div className="flex items-center gap-3 mb-6">
        <PackageOpen className="text-indigo-600" size={28} />
        <h2 className="text-2xl font-black text-slate-800">المخزون</h2>
      </div>

      {/* الكروت */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100">
          <p className="text-xs font-black text-slate-400 mb-2">إجمالي الوحدات</p>
          <h3 className="text-2xl font-black text-slate-800">{stats.total}</h3>
        </div>

        <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100">
          <p className="text-xs font-black text-slate-400 mb-2">منخفض المخزون</p>
          <h3 className="text-2xl font-black text-orange-600">{stats.low}</h3>
        </div>

        <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100">
          <p className="text-xs font-black text-slate-400 mb-2">نافد</p>
          <h3 className="text-2xl font-black text-rose-600">{stats.zero}</h3>
        </div>
      </div>

      {/* جدول */}
      <div className="bg-slate-50 rounded-2xl border border-slate-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-100 text-slate-600">
            <tr>
              <th className="p-3 text-right">SKU</th>
              <th className="p-3 text-right">الكمية</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(stock).map(([sku, qty]) => (
              <tr key={sku} className="border-t">
                <td className="p-3 font-mono">{sku}</td>
                <td className={`p-3 font-bold ${
                  qty <= 0
                    ? 'text-rose-600'
                    : qty <= 10
                    ? 'text-orange-600'
                    : 'text-emerald-600'
                }`}>
                  {qty}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

    </div>
  );
}
