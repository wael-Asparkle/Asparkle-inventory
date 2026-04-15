import React from 'react';
import { ShoppingBag } from 'lucide-react';

export default function OrdersTab() {
  return (
    <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-8" dir="rtl">
      <div className="flex items-center gap-3 mb-4">
        <ShoppingBag className="text-indigo-600" size={28} />
        <h2 className="text-2xl font-black text-slate-800">الطلبات</h2>
      </div>

      <p className="text-slate-500 text-sm leading-7">
        هذا القسم سيكون مخصصًا لعرض الطلبات مع الفلترة والبحث والتقارير.
      </p>

      <div className="mt-8 bg-slate-50 rounded-2xl p-6 border border-slate-100">
        <p className="text-sm font-bold text-slate-600">
          تم تجهيز الصفحة مبدئيًا. لاحقًا سنربطها ببيانات الطلبات الفعلية.
        </p>
      </div>
    </div>
  );
}
