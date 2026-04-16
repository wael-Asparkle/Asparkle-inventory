import React, { useMemo } from 'react';
import { PackageOpen } from 'lucide-react';
import useAppData from '../hooks/useAppData';
import { MOVEMENT_TYPES } from '../constants/movementTypes';

export default function StockTab() {
  const { movements, productDetails, packages } = useAppData();

  const stock = useMemo(() => {
    const result = {};

    // 1) المخزون الافتتاحي للمنتجات فقط
    Object.values(productDetails || {}).forEach((p) => {
      if (!p?.sku) return;
      result[p.sku] = parseInt(p.openingStock) || 0;
    });

    // 2) تطبيق الحركات
    (movements || []).forEach((m) => {
      const qty = parseInt(m.quantity) || 0;
      if (!qty) return;

      const movementMeta = MOVEMENT_TYPES.find((t) => t.id === m.type);
      const direction = movementMeta?.type; // in / out
      if (!direction) return;

      const multiplier = direction === 'out' ? -1 : 1;

      // لو الحركة على منتج مباشر
      if (m.level === 'منتج') {
        if (!m.code) return;
        if (result[m.code] === undefined) result[m.code] = 0;
        result[m.code] += qty * multiplier;
      }

      // لو الحركة على بكج: نفك البكج إلى مكوناته
      if (m.level === 'بكج') {
        const pkg = packages?.[m.code];
        if (!pkg?.items) return;

        Object.entries(pkg.items).forEach(([sku, requiredQty]) => {
          if (result[sku] === undefined) result[sku] = 0;
          result[sku] += qty * requiredQty * multiplier;
        });
      }
    });

    return result;
  }, [movements, productDetails, packages]);

  const stats = useMemo(() => {
    const productSkus = Object.keys(productDetails || {});
    const values = productSkus.map((sku) => stock[sku] || 0);

    const total = values.reduce((a, b) => a + b, 0);
    const low = values.filter((v) => v > 0 && v <= 10).length;
    const zero = values.filter((v) => v <= 0).length;

    return { total, low, zero };
  }, [stock, productDetails]);

  const rows = useMemo(() => {
    return Object.values(productDetails || [])
      .filter((p) => p?.sku)
      .map((p) => ({
        sku: p.sku,
        name: p.name || p.sku,
        qty: stock[p.sku] || 0,
      }))
      .sort((a, b) => a.qty - b.qty);
  }, [productDetails, stock]);

  return (
    <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-8" dir="rtl">
      <div className="flex items-center gap-3 mb-6">
        <PackageOpen className="text-indigo-600" size={28} />
        <h2 className="text-2xl font-black text-slate-800">المخزون</h2>
      </div>

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

      <div className="bg-slate-50 rounded-2xl border border-slate-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-100 text-slate-600">
            <tr>
              <th className="p-3 text-right">SKU</th>
              <th className="p-3 text-right">اسم المنتج</th>
              <th className="p-3 text-right">الكمية</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.sku} className="border-t">
                <td className="p-3 font-mono">{row.sku}</td>
                <td className="p-3 font-bold text-slate-700">{row.name}</td>
                <td
                  className={`p-3 font-bold ${
                    row.qty <= 0
                      ? 'text-rose-600'
                      : row.qty <= 10
                      ? 'text-orange-600'
                      : 'text-emerald-600'
                  }`}
                >
                  {row.qty}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
