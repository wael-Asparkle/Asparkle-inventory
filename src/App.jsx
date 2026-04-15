import React from 'react';
import {
  LayoutDashboard,
  PackageOpen,
  ArrowRightLeft,
  ShoppingBag,
  UsersRound,
} from 'lucide-react';

import ErrorBoundary from './components/ErrorBoundary';
import useAppData from './hooks/useAppData';

import StockTab from './tabs/StockTab';
import MovementsTab from './tabs/MovementsTab';
import OrdersTab from './tabs/OrdersTab';
import CRMTab from './tabs/CRMTab';

function App() {
  const { activeTab, setActiveTab } = useAppData();

  const navItems = [
    { id: 'dashboard', label: 'لوحة التحكم', icon: <LayoutDashboard size={18} /> },
    { id: 'stock', label: 'المخزون', icon: <PackageOpen size={18} /> },
    { id: 'movements', label: 'الحركات', icon: <ArrowRightLeft size={18} /> },
    { id: 'orders', label: 'الطلبات', icon: <ShoppingBag size={18} /> },
    { id: 'crm', label: 'العملاء', icon: <UsersRound size={18} /> },
  ];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800" dir="rtl">
      <nav className="bg-white border-b border-slate-200 sticky top-0 z-50 shadow-sm">
        <div className="max-w-[1400px] mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <div className="font-black text-xl text-slate-800">
              Asparkle<span className="text-indigo-600">OS</span>
            </div>

            <div className="flex gap-2 overflow-x-auto">
              {navItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition-all ${
                    activeTab === item.id
                      ? 'bg-indigo-50 text-indigo-700'
                      : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'
                  }`}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-[1400px] mx-auto px-4 py-8">
        {activeTab === 'dashboard' && (
          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-8">
            <h2 className="text-2xl font-black text-slate-800 mb-3">لوحة التحكم</h2>
            <p className="text-slate-500 text-sm">
              تم تشغيل النسخة المفصولة بنجاح. هذه خطوة مؤقتة قبل إرجاع كل تفاصيل النظام.
            </p>
          </div>
        )}

        {activeTab === 'stock' && <StockTab />}
        {activeTab === 'movements' && <MovementsTab />}
        {activeTab === 'orders' && <OrdersTab />}
        {activeTab === 'crm' && <CRMTab />}
      </main>
    </div>
  );
}

export default function AppWrapper() {
  return (
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  );
}
