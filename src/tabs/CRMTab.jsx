import React from 'react';
import { UsersRound } from 'lucide-react';

export default function CRMTab() {
  return (
    <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-8" dir="rtl">
      <div className="flex items-center gap-3 mb-4">
        <UsersRound className="text-indigo-600" size={28} />
        <h2 className="text-2xl font-black text-slate-800">العملاء (CRM)</h2>
      </div>

      <p className="text-slate-500 text-sm leading-7">
        هذا القسم سيكون مخصصًا لإدارة العملاء والشرائح والتقارير.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
        <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100">
          <p className="text-xs font-black text-slate-400 mb-2">إجمالي العملاء</p>
          <h3 className="text-2xl font-black text-slate-800">--</h3>
        </div>

        <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100">
          <p className="text-xs font-black text-slate-400 mb-2">VIP</p>
          <h3 className="text-2xl font-black text-amber-600">--</h3>
        </div>

        <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100">
          <p className="text-xs font-black text-slate-400 mb-2">منقطع</p>
          <h3 className="text-2xl font-black text-rose-600">--</h3>
        </div>
      </div>
    </div>
  );
}
