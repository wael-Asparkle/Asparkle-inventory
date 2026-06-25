import React, { useState } from 'react';
import {
  LayoutDashboard,
  Calculator,
  Crown,
  PackageOpen,
  ShoppingBag,
  UsersRound,
  ShieldAlert,
  Upload,
  RotateCcw,
  Database,
  LogOut,
  ChevronDown,
} from 'lucide-react';
import ErrorBoundary from './components/ErrorBoundary';
import useAppData from './hooks/useAppData';
import LoginPage from './components/LoginPage';
import CEOExecutiveTab from './tabs/CEOExecutiveTab';
import StockTab from './tabs/StockTab';
import MovementsTab from './tabs/MovementsTab';
import OrdersTab from './tabs/OrdersTab';
import CRMTab from './tabs/CRMTab';
import DataAdminTab from './tabs/DataAdminTab';
import UserManagementTab from './tabs/UserManagementTab';
import ImportTab from './tabs/ImportTab';
import CSReturnsTab from './tabs/CSReturnsTab';
import BetweenImportTab from './tabs/BetweenImportTab';
import DashboardTab from './tabs/DashboardTab';
import PriceSimulatorTab from './tabs/PriceSimulatorTab';
import { PERMISSIONS, ROLE_LABELS, TAB_ACCESS } from './constants/ui';

function StatusPage({ title, message, onLogout }) {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4" dir="rtl">
      <div className="w-full max-w-lg bg-white border border-slate-100 rounded-3xl shadow-sm p-8 text-center">
        <ShieldAlert className="mx-auto text-rose-500 mb-4" size={42} />
        <h1 className="text-2xl font-black text-slate-800 mb-3">{title}</h1>
        <p className="text-slate-500 text-sm leading-7 mb-6">{message}</p>
        {onLogout && (
          <button
            onClick={onLogout}
            className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-slate-800 text-white text-sm font-black hover:bg-slate-900 transition-all"
          >
            <LogOut size={16} />
            تسجيل الخروج
          </button>
        )}
      </div>
    </div>
  );
}

function App() {
  const [openMenu, setOpenMenu] = useState(null);

  const {
    activeTab,
    setActiveTab,
    user,
    authReady,
    logout,
    currentUserRole,
    userProfile,
    profileError,
    hasAccess,
    hasPermission,
  } = useAppData();

  if (!authReady) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-slate-400 font-bold text-sm">جاري التحقق...</div>
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  if (profileError) {
    return <StatusPage title="تعذر تحميل الصلاحيات" message="راجع إعدادات المستخدم وقواعد Firestore." onLogout={logout} />;
  }

  if (!userProfile?.isActive) {
    return <StatusPage title="الحساب يحتاج تفعيل" message="تم تسجيل الدخول، لكن الحساب غير مفعل داخل نظام الصلاحيات." onLogout={logout} />;
  }

  const mainNavItems = [
    { id: 'ceo_executive', label: 'الرئيس التنفيذي', icon: <Crown size={18} />, allowedRoles: TAB_ACCESS.ceo_executive },
    { id: 'dashboard', label: 'لوحة التحكم', icon: <LayoutDashboard size={18} />, allowedRoles: TAB_ACCESS.dashboard },
    { id: 'orders', label: 'الطلبات', icon: <ShoppingBag size={18} />, allowedRoles: TAB_ACCESS.orders },
    { id: 'stock', label: 'المخزون', icon: <PackageOpen size={18} />, allowedRoles: TAB_ACCESS.stock },
    { id: 'crm', label: 'العملاء', icon: <UsersRound size={18} />, allowedRoles: TAB_ACCESS.crm },
  ];

  const operationsNavItems = [
    { id: 'import', label: 'استيراد الطلبات', icon: <Upload size={18} />, allowedRoles: TAB_ACCESS.import },
    { id: 'between', label: 'استيراد بتوين', icon: <Database size={18} />, allowedRoles: TAB_ACCESS.between },
    { id: 'cs_returns', label: 'مرتجعات CS', icon: <RotateCcw size={18} />, allowedRoles: TAB_ACCESS.cs_returns },
  ];

  const adminNavItems = [
    { id: 'price_simulator', label: 'محاكي الأسعار', icon: <Calculator size={18} />, allowedRoles: TAB_ACCESS.price_simulator },
    { id: 'user_management', label: 'المستخدمون والصلاحيات', icon: <UsersRound size={18} />, allowedRoles: TAB_ACCESS.user_management },
    { id: 'data_admin', label: 'إدارة البيانات', icon: <ShieldAlert size={18} />, allowedRoles: TAB_ACCESS.data_admin },
  ];

  const navItems = [...mainNavItems, ...operationsNavItems, ...adminNavItems];
  const allowedNavItems = navItems.filter((item) => hasAccess(item.allowedRoles));
  const allowedMainNavItems = mainNavItems.filter((item) => hasAccess(item.allowedRoles));
  const allowedOperationsNavItems = operationsNavItems.filter((item) => hasAccess(item.allowedRoles));
  const allowedAdminNavItems = adminNavItems.filter((item) => hasAccess(item.allowedRoles));

  const currentTab = allowedNavItems.some((item) => item.id === activeTab)
    ? activeTab
    : allowedNavItems[0]?.id;

  if (!currentTab) {
    return <StatusPage title="لا توجد صفحات متاحة" message="هذا الدور لا يملك صفحات مفعلة داخل النظام." onLogout={logout} />;
  }

  const handleTabChange = (tabId) => {
    setActiveTab(tabId);
    setOpenMenu(null);
  };

  const renderNavButton = (item) => (
    <button
      key={item.id}
      onClick={() => handleTabChange(item.id)}
      className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition-all ${
        currentTab === item.id
          ? 'bg-indigo-50 text-indigo-700'
          : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'
      }`}
    >
      {item.icon}
      <span>{item.label}</span>
    </button>
  );

  const renderDropdown = (menuKey, label, items) => {
    if (!items.length) return null;

    const isActive = items.some((item) => item.id === currentTab);
    const isOpen = openMenu === menuKey;

    return (
      <div
        className="relative"
        onMouseEnter={() => setOpenMenu(menuKey)}
        onMouseLeave={() => setOpenMenu(null)}
      >
        <button
          type="button"
          onClick={() => setOpenMenu(isOpen ? null : menuKey)}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition-all ${
            isActive || isOpen
              ? 'bg-indigo-50 text-indigo-700'
              : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'
          }`}
        >
          <span>{label}</span>
          <ChevronDown
            size={16}
            className={`transition-transform ${isOpen ? 'rotate-180' : ''}`}
          />
        </button>

        {isOpen && (
          <div className="absolute right-0 top-full mt-2 w-64 bg-white border border-slate-200 rounded-2xl shadow-xl p-2 z-[999]">
            {items.map((item) => (
              <button
                key={item.id}
                onClick={() => handleTabChange(item.id)}
                className={`w-full flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-bold text-right transition-all ${
                  currentTab === item.id
                    ? 'bg-indigo-50 text-indigo-700'
                    : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'
                }`}
              >
                {item.icon}
                <span>{item.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800" dir="rtl">
      <nav className="bg-white border-b border-slate-200 sticky top-0 z-50 shadow-sm">
        <div className="max-w-[1400px] mx-auto px-4">
          <div className="flex items-center justify-between h-16 gap-4">
            <div className="font-black text-xl text-slate-800 shrink-0">
              Asparkle<span className="text-indigo-600">OS</span>
            </div>

            <div className="flex items-center gap-2 flex-1 justify-center overflow-visible">
              {allowedMainNavItems.map(renderNavButton)}
              {renderDropdown('operations', 'التشغيل', allowedOperationsNavItems)}
              {renderDropdown('admin', 'الإدارة', allowedAdminNavItems)}
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <span className="hidden md:inline-flex px-3 py-1 rounded-full bg-slate-100 text-slate-500 text-xs font-black">
                {ROLE_LABELS[currentUserRole] || currentUserRole}
              </span>

              <button
                onClick={logout}
                className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-bold text-slate-400 hover:bg-slate-100 hover:text-rose-500 transition-all"
                title="تسجيل الخروج"
              >
                <LogOut size={16} />
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-[1400px] mx-auto px-4 py-8">
        {currentTab === 'ceo_executive' && <CEOExecutiveTab />}
        {currentTab === 'dashboard' && <DashboardTab />}
        {currentTab === 'orders' && <OrdersTab />}
        {currentTab === 'price_simulator' && <PriceSimulatorTab />}
        {currentTab === 'stock' && <StockTab />}
        {currentTab === 'movements' && <MovementsTab />}
        {currentTab === 'crm' && <CRMTab />}
        {currentTab === 'import' && <ImportTab />}
        {currentTab === 'between' && <BetweenImportTab />}
        {currentTab === 'cs_returns' && <CSReturnsTab />}
        {currentTab === 'data_admin' && (
          <DataAdminTab canDeleteData={hasPermission(PERMISSIONS.DELETE_DATA)} />
        )}
        {currentTab === 'user_management' && (
          <UserManagementTab currentUserUid={userProfile?.uid || user?.uid} />
        )}
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
