import React from 'react';
import {
  LayoutDashboard,
  PackageOpen,
  ArrowRightLeft,
  ShoppingBag,
  UsersRound,
  ShieldAlert,
  Upload,
  LogOut,
} from 'lucide-react';
import ErrorBoundary from './components/ErrorBoundary';
import useAppData from './hooks/useAppData';
import LoginPage from './components/LoginPage';
import StockTab from './tabs/StockTab';
import MovementsTab from './tabs/MovementsTab';
import OrdersTab from './tabs/OrdersTab';
import CRMTab from './tabs/CRMTab';
import DataAdminTab from './tabs/DataAdminTab';
import ImportTab from './tabs/ImportTab';
import CSReturnsTab from './tabs/CSReturnsTab';

function App() {
  const { activeTab, setActiveTab, user, authReady, logout } = useAppData();

  // ── جاري التحقق من تسجيل الدخول ──
  if (!authReady) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-slate-400 font-bold text-sm">جاري التحقق...</div>
      </div>
    );
  }

  // ── غير مسجل → صفحة الدخول ──
  if (!user) {
    return <LoginPage />;
  }

  const navItems = [
    { id: 'dashboard',    label: 'لوحة التحكم',  icon: <LayoutDashboard size={18} /> },
    { id: 'stock',        label: 'المخزون',       icon: <PackageOpen size={18} /> },
    { id: 'movements',    label: 'الحركات',       icon: <ArrowRightLeft size={18} /> },
    { id: 'orders',       label: 'الطلبات',       icon: <ShoppingBag size={18} /> },
    { id: 'crm',          label: 'العملاء',       icon: <UsersRound size={18} /> },
    { id: 'import',       label: 'استيراد',       icon: <Upload size={18} /> },
    { id: 'cs_returns', label: 'مرتجعات CS', icon: <RotateCcw size={18} /> },
    { id: 'data_admin',   label: 'إدارة البيانات',icon: <ShieldAlert size={18} /> },
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

            {/* زر تسجيل الخروج */}
            <button
              onClick={logout}
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-bold text-slate-400 hover:bg-slate-100 hover:text-rose-500 transition-all"
              title="تسجيل الخروج"
            >
              <LogOut size={16} />
            </button>

          </div>
        </div>
      </nav>

      <main className="max-w-[1400px] mx-auto px-4 py-8">
        {activeTab === 'dashboard' && (
          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-8">
            <h2 className="text-2xl font-black text-slate-800 mb-3">لوحة التحكم</h2>
            <p className="text-slate-500 text-sm">قيد التطوير — قريباً 🚀</p>
          </div>
        )}
        {activeTab === 'stock'      && <StockTab />}
        {activeTab === 'movements'  && <MovementsTab />}
        {activeTab === 'orders'     && <OrdersTab />}
        {activeTab === 'crm'        && <CRMTab />}
        {activeTab === 'import'     && <ImportTab />}
        {activeTab === 'cs_returns' && <CSReturnsTab />}
        {activeTab === 'data_admin' && <DataAdminTab />}
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
