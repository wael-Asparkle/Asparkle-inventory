import React from 'react';
import { ShieldAlert } from 'lucide-react';

export default function DataAdminTab() {
  return (
    <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-8" dir="rtl">
      <div className="flex items-center gap-3 mb-4">
        <ShieldAlert className="text-rose-600" size={28} />
        <h2 className="text-2xl font-black text-slate-800">إدارة البيانات</h2>
      </div>

      <p className="text-slate-500 text-sm leading-7 mb-8">
        هذا القسم مخصص لحذف الطلبات والحركات وإعادة بناء النظام.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <button className="bg-rose-600 hover:bg-rose-700 text-white font-bold py-4 rounded-2xl">
          حذف الحركات
        </button>

        <button className="bg-orange-600 hover:bg-orange-700 text-white font-bold py-4 rounded-2xl">
          حذف الطلبات
        </button>
      </div>
    </div>
  );
}
