import React from 'react';
import { ArrowRightLeft } from 'lucide-react';

export default function MovementsTab() {
  return (
    <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-8" dir="rtl">
      <div className="flex items-center gap-3 mb-4">
        <ArrowRightLeft className="text-indigo-600" size={28} />
        <h2 className="text-2xl font-black text-slate-800">الحركات</h2>
      </div>

      <p className="text-slate-500 text-sm leading-7">
        هذا القسم سيكون مخصصًا للاستيراد، الإدخال اليدوي، وسجل الحركات.
      </p>
    </div>
  );
}
