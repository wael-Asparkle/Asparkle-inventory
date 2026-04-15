import React from 'react';
import { PackageOpen } from 'lucide-react';

export default function StockTab() {
  return (
    <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-8" dir="rtl">
      <div className="flex items-center gap-3 mb-4">
        <PackageOpen className="text-indigo-600" size={28} />
        <h2 className="text-2xl font-black text-slate-800">المخزون</h2>
      </div>

      <p className="text-slate-500 text-sm leading-7">
        هذا هو القسم الجديد الخاص بالمخزون. لاحقًا سنربطه ببيانات المنتجات
        والكميات والبكجات الجاهزة.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
        <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100">
          <p className="text-xs font-black text-slate-400 mb-2">إجمالي الوحدات</p>
          <h3 className="text-2xl font-black text-slate-800">--</h3>
        </div>

        <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100">
          <p className="text-xs font-black text-slate-400 mb-2">منخفض المخزون</p>
          <h3 className="text-2xl font-black text-orange-600">--</h3>
        </div>

        <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100">
          <p className="text-xs font-black text-slate-400 mb-2">نافد</p>
          <h3 className="text-2xl font-black text-rose-600">--</h3>
        </div>
      </div>
    </div>
  );
}
