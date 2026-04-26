import React, { useMemo } from 'react';
import { ShoppingBag } from 'lucide-react';
import useAppData from '../hooks/useAppData';

export default function OrdersTab() {
  const { orders } = useAppData();

  const rows = useMemo(() => {
    return (orders || [])
      .map((o) => ({
        reference: o.reference,
        name: o.customer?.name,
        phone: o.customer?.phone,
        city: o.customer?.city,
        total: o.total,
        date: o.date,
        payment: o.paymentMethod,
      }))
      .sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [orders]);

  return (
    <div className="bg-white rounded-3xl border p-8" dir="rtl">
      <div className="flex items-center gap-3 mb-6">
        <ShoppingBag className="text-indigo-600" size={28} />
        <h2 className="text-2xl font-black">الطلبات</h2>
      </div>

      <div className="bg-slate-50 rounded-2xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-100 text-slate-600">
            <tr>
              <th className="p-3 text-right">رقم الطلب</th>
              <th className="p-3 text-right">العميل</th>
              <th className="p-3 text-right">الجوال</th>
              <th className="p-3 text-right">المدينة</th>
              <th className="p-3 text-right">الدفع</th>
              <th className="p-3 text-right">الإجمالي</th>
              <th className="p-3 text-right">التاريخ</th>
            </tr>
          </thead>

          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className="border-t">
                <td className="p-3 font-mono">{row.reference}</td>
                <td className="p-3 font-bold">{row.name}</td>
                <td className="p-3">{row.phone}</td>
                <td className="p-3">{row.city}</td>
                <td className="p-3">{row.payment}</td>
                <td className="p-3 font-bold">{row.total} ريال</td>
                <td className="p-3">{row.date}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
