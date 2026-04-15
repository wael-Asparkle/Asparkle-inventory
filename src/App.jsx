import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  LayoutDashboard, Package, ArrowRightLeft, ClipboardList, Plus, AlertTriangle, 
  PackageOpen, Cloud, CloudOff, Loader2, Settings, Link2, CalendarDays, Download, 
  BarChart3, Trash2, Tags, X, Edit2, Check, Users, UploadCloud, FileSpreadsheet, 
  CheckCircle2, DollarSign, TrendingUp, BellRing, AlertOctagon, Activity, Megaphone, 
  Target, Zap, ShieldAlert, UsersRound, ShoppingBag, BrainCircuit, Calculator, Shield,
  Search, PieChart
} from 'lucide-react';

import { initializeApp, getApps } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, doc, setDoc, deleteDoc, onSnapshot, writeBatch } from 'firebase/firestore';

// مكتبة الإكسل
const loadXLSX = async () => {
  if (window.XLSX) return window.XLSX;
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';
    script.onload = () => resolve(window.XLSX);
    script.onerror = reject;
    document.body.appendChild(script);
  });
};

const firebaseConfig = {
  apiKey: "AIzaSyCeHc-P80oM5hjc7yugdk-YVcRGnz8NOhE",
  authDomain: "asparkle-inventory.firebaseapp.com",
  projectId: "asparkle-inventory",
  storageBucket: "asparkle-inventory.firebasestorage.app",
  messagingSenderId: "75571875301",
  appId: "1:75571875301:web:bfe0465065e134d77cf30c"
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-inventory-app';

const MOVEMENT_TYPES = [
  { id: 'بيع (دفع إلكتروني)', type: 'out' }, { id: 'بيع (تمارا)', type: 'out' },
  { id: 'بيع (دفع عند الاستلام)', type: 'out' }, { id: 'بيع آلي (عبر الربط)', type: 'out'},
  { id: 'بيع مجمع (إدخال سابق)', type: 'out'}, { id: 'مرتجع (إلغاء رغبة العميل)', type: 'in' },
  { id: 'مرتجع (عدم استلام من الشحن)', type: 'in' }, { id: 'مرتجع (تالف أو خطأ بالطلب)', type: 'in' },
  { id: 'تلف داخلي', type: 'out' }, { id: 'تعديل يدوي (نقص)', type: 'out' },
  { id: 'تعديل يدوي (زيادة)', type: 'in' }, { id: 'دخول بضاعة جديدة', type: 'in' }
];

const safeConfirm = (msg) => {
  if (typeof window !== 'undefined') return window.confirm(msg);
  return false;
};

// خريطة كلاسات Tailwind الثابتة
const kpiColors = {
  indigo: { bg: 'bg-indigo-500', iconBg: 'bg-indigo-50', iconText: 'text-indigo-600', text: 'text-indigo-700' },
  emerald: { bg: 'bg-emerald-500', iconBg: 'bg-emerald-50', iconText: 'text-emerald-600', text: 'text-emerald-700' },
  rose: { bg: 'bg-rose-500', iconBg: 'bg-rose-50', iconText: 'text-rose-600', text: 'text-rose-700' },
  blue: { bg: 'bg-blue-500', iconBg: 'bg-blue-50', iconText: 'text-blue-600', text: 'text-blue-700' },
  purple: { bg: 'bg-purple-500', iconBg: 'bg-purple-50', iconText: 'text-purple-600', text: 'text-purple-700' },
  orange: { bg: 'bg-orange-500', iconBg: 'bg-orange-50', iconText: 'text-orange-600', text: 'text-orange-700' },
  amber: { bg: 'bg-amber-500', iconBg: 'bg-amber-50', iconText: 'text-amber-600', text: 'text-amber-700' }
};

// SVG Line Chart Component
const SimpleLineChart = ({ data, dataKey, height = 200 }) => {
  if (!data || data.length === 0) return null;
  const maxVal = Math.max(...data.map(d => d[dataKey] || 0), 1);
  const minVal = 0;
  
  return (
    <div className="w-full relative" style={{ height: `${height}px` }}>
      <svg className="w-full h-full overflow-visible" viewBox="0 0 100 100" preserveAspectRatio="none">
        <path
          d={`M 0,100 ${data.map((d, i) => {
            const x = (i / (data.length - 1 || 1)) * 100;
            const y = 100 - (((d[dataKey] || 0) - minVal) / (maxVal - minVal)) * 100;
            return `L ${x},${y}`;
          }).join(' ')} L 100,100 Z`}
          fill="url(#gradient)" opacity="0.2"
        />
        <path
          d={`M ${data.map((d, i) => {
            const x = (i / (data.length - 1 || 1)) * 100;
            const y = 100 - (((d[dataKey] || 0) - minVal) / (maxVal - minVal)) * 100;
            return `${x},${y}`;
          }).join(' L ')}`}
          fill="none" stroke="#4f46e5" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
        />
        <defs>
          <linearGradient id="gradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#4f46e5" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#4f46e5" stopOpacity="0" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
};

export default function App() {
  // --- 1. STATES ---
  const [activeTab, setActiveTab] = useState('dashboard');
  
  const [todayStr, setTodayStr] = useState(() => new Date().toISOString().split('T')[0]);
  const [periodType, setPeriodType] = useState('month');
  const [endDate, setEndDate] = useState(todayStr);
  const [startDate, setStartDate] = useState(() => {
    const d = new Date(); d.setMonth(d.getMonth() - 1);
    return d.toISOString().split('T')[0];
  });

  const [user, setUser] = useState(null);
  
  const [movements, setMovements] = useState([]);
  const [adCosts, setAdCosts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [productDetails, setProductDetails] = useState({}); 
  const [packages, setPackages] = useState({});
  const [channelsList, setChannelsList] = useState(['المتجر (عضوي)', 'تيك توك', 'سناب شات', 'واتساب']); 
  
  const [permissions, setPermissions] = useState({});
  const [currentUserRole, setCurrentUserRole] = useState('viewer');

  const [isLoading, setIsLoading] = useState(true);
  const [isSettingsLoaded, setIsSettingsLoaded] = useState(false);
  const [isPermissionsLoaded, setIsPermissionsLoaded] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [authError, setAuthError] = useState(null);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState(''); 
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const navItems = [
    { id: 'dashboard', label: 'لوحة التحكم', icon: <LayoutDashboard size={18}/>, roles: ['super_admin', 'admin', 'editor', 'viewer'] },
    { id: 'movements', label: 'المبيعات والحركات', icon: <ArrowRightLeft size={18}/>, roles: ['super_admin', 'admin', 'editor'] },
    { id: 'orders', label: 'الطلبات', icon: <ShoppingBag size={18}/>, roles: ['super_admin', 'admin', 'editor'] },
    { id: 'crm', label: 'العملاء (CRM)', icon: <UsersRound size={18}/>, roles: ['super_admin', 'admin'] },
    { id: 'adcosts', label: 'التسويق', icon: <Megaphone size={18}/>, roles: ['super_admin', 'admin'] },
    { id: 'decision_center', label: 'مركز القرارات', icon: <BrainCircuit size={18}/>, roles: ['super_admin'] },
    { id: 'profit_simulator', label: 'محاكي الأرباح', icon: <Calculator size={18}/>, roles: ['super_admin'] },
    { id: 'definitions', label: 'الإعدادات', icon: <Tags size={18}/>, roles: ['super_admin', 'admin'] },
    { id: 'users', label: 'المستخدمين', icon: <Shield size={18}/>, roles: ['super_admin'] },
    { id: 'data_admin', label: 'إدارة البيانات', icon: <ShieldAlert size={18}/>, roles: ['super_admin'] }
  ];

  // --- 2. EFFECTS ---
  useEffect(() => {
    if (periodType === 'day') setStartDate(endDate);
    else if (periodType === 'week') {
      const d = new Date(endDate); d.setDate(d.getDate() - 6);
      setStartDate(d.toISOString().split('T')[0]);
    }
    else if (periodType === 'month') {
      const d = new Date(endDate); d.setMonth(d.getMonth() - 1);
      setStartDate(d.toISOString().split('T')[0]);
    }
  }, [periodType, endDate]);

  useEffect(() => {
    const fallbackTimer = setTimeout(() => { 
      setIsLoading(false); 
    }, 4000);
    return () => clearTimeout(fallbackTimer);
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) { setUser(currentUser); setAuthError(null); } else { setUser(null); }
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;
    const permsRef = doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'permissions');
    return onSnapshot(permsRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setPermissions(data);
        setCurrentUserRole(data[user.email] || 'viewer');
      } else {
        const initialData = { [user.email]: 'super_admin' };
        setDoc(permsRef, initialData).catch(console.error);
        setCurrentUserRole('super_admin');
      }
      setIsPermissionsLoaded(true);
    }, (error) => {
      console.error(error);
      setIsPermissionsLoaded(true);
    });
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const loadCollection = (colName, setter) => {
      return onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', colName), (snap) => {
        const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        data.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
        setter(data);
      });
    };

    const unsubMov = loadCollection('movements', setMovements);
    const unsubAd = loadCollection('adcosts', setAdCosts);
    const unsubOrd = loadCollection('orders', setOrders);

    const settingsRef = doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'definitions');
    const unsubSet = onSnapshot(settingsRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setProductDetails(data.productDetails || {});
        setPackages(data.packages || {});
        if(data.channelsList) setChannelsList(data.channelsList);
      }
      setIsSettingsLoaded(true); 
    }, (error) => {
      console.error(error);
      setIsSettingsLoaded(true);
    });

    return () => { unsubMov(); unsubAd(); unsubOrd(); unsubSet(); };
  }, [user]);

  // --- 3. HANDLERS ---
  const handleLogin = async (e) => {
    e.preventDefault(); setIsLoggingIn(true); setLoginError('');
    try { await signInWithEmailAndPassword(auth, email, password); } 
    catch (error) { setLoginError('بيانات الدخول غير صحيحة.'); } 
    finally { setIsLoggingIn(false); }
  };

  const handleLogout = () => signOut(auth);

  const handleExportExcel = () => {
    const htmlContent = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; direction: rtl; text-align: right; }
          table { border-collapse: collapse; width: 100%; margin-bottom: 20px; }
          th { background-color: #1e293b; color: #ffffff; padding: 10px; border: 1px solid #cbd5e1; text-align: center; }
          td { padding: 8px; border: 1px solid #cbd5e1; text-align: center; }
        </style>
      </head>
      <body dir="rtl">
        <h2>تقرير أسباركل المالي والتشغيلي</h2>
        <p><strong>الفترة:</strong> من ${startDate} إلى ${endDate}</p>
      </body>
      </html>
    `;
    const blob = new Blob([htmlContent], { type: 'application/vnd.ms-excel;charset=utf-8' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `تقرير_ارباح_اسباركل_${endDate}.xls`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const updateSettingsInCloud = async (newProductDetails, newPackages, newChannels) => {
    if (!user) return;
    setIsSyncing(true);
    try {
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'definitions'), { 
        productDetails: newProductDetails || productDetails, 
        packages: newPackages || packages,
        channelsList: newChannels || channelsList
      }, { merge: true });
    } catch (error) { alert('خطأ في الحفظ'); } finally { setIsSyncing(false); }
  };

  const addMovementToCloud = async (data) => {
    if (!user) return;
    setIsSyncing(true);
    try {
      const movementId = `mov_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
      const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'movements', movementId);
      await setDoc(docRef, { ...data, timestamp: Date.now() });
    } catch (error) {
      console.error(error);
      alert("حدث خطأ أثناء حفظ البيانات.");
    } finally {
      setIsSyncing(false);
    }
  };

  // --- 4. DATA MEMOS (Pre-processing) ---
  const parsedMovements = useMemo(() => {
    return movements.map(m => ({
      ...m,
      qty: parseInt(m.quantity) || 0,
      isSale: !!m.type?.includes('بيع'),
      isReturn: !!(m.type?.includes('مرتجع') || m.type?.includes('رفض'))
    }));
  }, [movements]);

  const movementsInPeriod = useMemo(() => parsedMovements.filter(m => m.date >= startDate && m.date <= endDate), [parsedMovements, startDate, endDate]);
  const adCostsInPeriod = useMemo(() => adCosts.filter(c => c.date >= startDate && c.date <= endDate), [adCosts, startDate, endDate]);
  
  const stockAsOfDate = useMemo(() => {
    let stock = {};
    Object.values(productDetails).forEach(p => stock[p.sku] = parseInt(p.openingStock) || 0);
    parsedMovements.forEach(mov => {
      if (mov.date > endDate) return;
      const isOut = MOVEMENT_TYPES.find(t => t.id === mov.type)?.type === 'out';
      const multiplier = isOut ? -1 : 1;
      if (mov.level === 'منتج') {
        const p = productDetails[mov.code];
        if (p && mov.date >= p.openingDate) stock[mov.code] += (mov.qty * multiplier);
      } else if (mov.level === 'بكج' && packages[mov.code]) {
        Object.entries(packages[mov.code].items).forEach(([sku, reqQty]) => {
          const p = productDetails[sku];
          if (p && mov.date >= p.openingDate) stock[sku] += (mov.qty * reqQty * multiplier);
        });
      }
    });
    return stock;
  }, [parsedMovements, productDetails, packages, endDate]);

  const packageAvailabilityAsOfDate = useMemo(() => {
    let availability = {};
    Object.entries(packages).forEach(([pkgCode, pkg]) => {
      let maxPossible = Infinity;
      let limitingSku = null;

      Object.entries(pkg.items).forEach(([sku, reqQty]) => {
        const availableSkus = stockAsOfDate[sku] || 0;
        const possibleFromThisSku = Math.floor(availableSkus / reqQty);
        
        if (possibleFromThisSku < maxPossible) {
          maxPossible = possibleFromThisSku;
          limitingSku = sku;
        }
      });
      availability[pkgCode] = {
        max: maxPossible === Infinity ? 0 : Math.max(0, maxPossible),
        criticalSku: limitingSku
      };
    });
    return availability;
  }, [stockAsOfDate, packages]);

  const channelStats = useMemo(() => {
    const result = {};
    movementsInPeriod.forEach(m => {
      if (!m.isSale && !m.isReturn) return;
      let channel = 'المنتجات الفردية';
      let revenue = 0, cost = 0;

      if (m.level === 'بكج' && packages[m.code]) {
        const pkg = packages[m.code];
        channel = pkg.channel || 'غير محدد';
        revenue = (pkg.price || 0) * m.qty;
        let pkgCogs = 0;
        Object.entries(pkg.items).forEach(([sku, reqQty]) => { pkgCogs += (productDetails[sku]?.unitCost || 0) * reqQty; });
        cost = pkgCogs * m.qty;
      } else if (m.level === 'منتج' && productDetails[m.code]) {
        revenue = (productDetails[m.code].sellingPrice || 0) * m.qty;
        cost = (productDetails[m.code].unitCost || 0) * m.qty;
      }

      if (!result[channel]) result[channel] = { revenue: 0, cogs: 0, adCost: 0, netSales: 0, returns: 0 };
      if (m.isSale) {
        result[channel].revenue += revenue; result[channel].cogs += cost; result[channel].netSales += m.qty;
      } else {
        result[channel].revenue -= revenue; result[channel].cogs -= cost; result[channel].netSales -= m.qty; result[channel].returns += m.qty;
      }
    });

    adCostsInPeriod.forEach(c => {
      const channel = c.channel || 'غير محدد';
      if (!result[channel]) result[channel] = { revenue: 0, cogs: 0, adCost: 0, netSales: 0, returns: 0 };
      result[channel].adCost += parseFloat(c.cost) || 0;
    });

    Object.keys(result).forEach(ch => {
      const r = result[ch];
      r.netProfit = r.revenue - r.cogs - r.adCost;
      r.roi = r.adCost > 0 ? r.revenue / r.adCost : (r.revenue > 0 ? Infinity : 0);
      const profitPerUnit = r.netSales > 0 ? (r.revenue / r.netSales) - (r.cogs / r.netSales) : 0;
      r.breakEvenUnits = (profitPerUnit > 0 && r.adCost > 0) ? Math.ceil(r.adCost / profitPerUnit) : 0;
      r.profitPerOrder = r.netSales > 0 ? r.netProfit / r.netSales : 0;
      r.returnRate = (r.netSales + r.returns) > 0 ? r.returns / (r.netSales + r.returns) : 0;
      r.score = (r.roi * 0.5) + (r.netProfit > 0 ? 1 : -1) + (r.profitPerOrder || 0) - (r.returnRate * 10);
    });

    return result;
  }, [movementsInPeriod, adCostsInPeriod, packages, productDetails]);

  const productStats = useMemo(() => {
    const result = {};
    Object.values(productDetails).forEach(p => result[p.sku] = { name: p.name, sales: 0, revenue: 0, cost: 0, profit: 0 });
    movementsInPeriod.forEach(m => {
      if (!m.isSale && !m.isReturn) return;
      const multiplier = m.isSale ? 1 : -1;
      if (m.level === 'منتج' && productDetails[m.code]) {
        const p = productDetails[m.code];
        result[m.code].sales += m.qty * multiplier;
        result[m.code].revenue += (p.sellingPrice || 0) * m.qty * multiplier;
        result[m.code].cost += (p.unitCost || 0) * m.qty * multiplier;
      }
    });
    Object.values(result).forEach(r => r.profit = r.revenue - r.cost);
    return Object.entries(result).map(([sku, data]) => ({ sku, ...data })).sort((a, b) => b.profit - a.profit);
  }, [movementsInPeriod, productDetails]);

  const customers = useMemo(() => {
    const cusMap = {};
    orders.forEach(o => {
      if (!o.mobile) return;
      if (!cusMap[o.mobile]) {
        cusMap[o.mobile] = { name: o.customerName || 'عميل', mobile: o.mobile, orderCount: 0, totalSpend: 0, lastOrder: '', city: o.city || '' };
      }
      cusMap[o.mobile].orderCount += 1;
      cusMap[o.mobile].totalSpend += parseFloat(o.amount) || 0;
      if (o.date > cusMap[o.mobile].lastOrder) cusMap[o.mobile].lastOrder = o.date;
    });
    
    return Object.values(cusMap).map(c => {
      const daysSince = c.lastOrder ? Math.floor((new Date() - new Date(c.lastOrder)) / (1000*60*60*24)) : 999;
      let segment = 'نشط';
      if (c.totalSpend >= 1000 || c.orderCount >= 3) segment = 'VIP 🌟';
      else if (daysSince > 60) segment = 'منقطع ⚠️';
      else if (daysSince > 30) segment = 'معرض للانقطاع 🟠';
      return { ...c, daysSince, segment };
    }).sort((a, b) => b.totalSpend - a.totalSpend);
  }, [orders]);

  const businessDecisions = useMemo(() => {
    const decisions = [];
    Object.entries(channelStats).forEach(([ch, data]) => {
      if (ch === 'المنتجات الفردية' || ch === 'غير محدد') return;
      if (data.returnRate > 0.15) decisions.push({ type: 'warning', iconType: 'warning', color: 'text-orange-700 bg-orange-100 border-orange-200', msg: `معدل استرجاع خطر ( ${(data.returnRate*100).toFixed(1)}% ) في قناة (${ch}) ⚠️` });
      if (data.adCost > 0 && data.roi < 1.5 && data.netSales > 0) decisions.push({ type: 'stop', iconType: 'stop', color: 'text-rose-700 bg-rose-100 border-rose-200', msg: `أوقف استنزاف الأموال في (${ch}) ❌ - العائد ضعيف.` });
      if (data.adCost > 0 && data.roi >= 3) decisions.push({ type: 'scale', iconType: 'scale', color: 'text-emerald-700 bg-emerald-100 border-emerald-200', msg: `ضاعف الميزانية في (${ch}) 🔥 - قناة تدر ذهباً!` });
    });
    const topProduct = productStats.find(p => p.sales > 0);
    const worstProduct = [...productStats].reverse().find(p => p.profit < 0);
    if (topProduct && topProduct.profit > 0) {
       decisions.push({ type: 'product-good', iconType: 'product-good', color: 'text-blue-700 bg-blue-100 border-blue-200', msg: `منتج (${topProduct.name}) هو البطل الرابح! 🌟 يدر أعلى أرباح مبيعات فردية.` });
    }
    if (worstProduct) {
       decisions.push({ type: 'product-bad', iconType: 'product-bad', color: 'text-rose-700 bg-rose-100 border-rose-200', msg: `منتج (${worstProduct.name}) يسبب خسائر 📉 راجع التسعير أو المرتجعات.` });
    }
    return decisions;
  }, [channelStats, productStats]);

  const dashboardStats = useMemo(() => {
    let totalRevenue = 0, totalCogs = 0, netSales = 0;
    Object.values(channelStats).forEach(ch => { totalRevenue += ch.revenue; totalCogs += ch.cogs; });
    movementsInPeriod.forEach(m => { if(m.isSale) netSales += m.qty; if(m.isReturn) netSales -= m.qty; });
    const totalAdCost = adCostsInPeriod.reduce((sum, c) => sum + (parseFloat(c.cost) || 0), 0);
    return { totalRevenue, totalAdCost, netSales, netProfit: totalRevenue - totalCogs - totalAdCost };
  }, [channelStats, movementsInPeriod, adCostsInPeriod]);

  const hasAccess = (requiredRoles) => {
    if (currentUserRole === 'super_admin') return true;
    return requiredRoles.includes(currentUserRole);
  };

  // --- 5. SUB-COMPONENTS ---

  const DashboardTab = () => {
    const trendDates = useMemo(() => {
      const dates = new Set(parsedMovements.map(m => m.date)); dates.add(todayStr); 
      return Array.from(dates).sort().slice(-14); 
    }, [parsedMovements, todayStr]);

    const trendLine = trendDates.map(d => {
      const sales = parsedMovements.filter(m => m.date === d && m.isSale).reduce((s, m) => s + m.qty, 0);
      return { date: d, sales };
    });

    const smartAlerts = useMemo(() => {
      const alerts = [];
      Object.values(productDetails).forEach(p => {
        const qty = stockAsOfDate[p.sku] || 0;
        if (qty < 30 && qty > 0) alerts.push({ type: 'danger', msg: `مخزون منخفض: ${p.name} (${qty} حبة)` });
        else if (qty === 0) alerts.push({ type: 'critical', msg: `نفاد مخزون: ${p.name} ❌` });
      });
      Object.entries(packageAvailabilityAsOfDate).forEach(([code, data]) => {
        if (data.max < 20 && data.max > 0) alerts.push({ type: 'warning', msg: `خطر توقف بكج: ${packages[code]?.name} (يكفي لـ ${data.max} طلب)` });
      });
      return alerts;
    }, [stockAsOfDate, packageAvailabilityAsOfDate, productDetails, packages]);

    return (
      <div className="space-y-8 animate-in fade-in">
        {/* 🔥 استعادة الفلتر العلوي كما طلبت */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 mb-8">
          <button onClick={handleExportExcel} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-5 py-3 rounded-xl flex items-center gap-2 shadow-sm">
            <Download size={18} /> تصدير التقرير (Excel)
          </button>
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">فترة التقرير</label>
              <select className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold outline-none" value={periodType} onChange={(e) => setPeriodType(e.target.value)}>
                <option value="day">يوم واحد</option><option value="week">أسبوع</option><option value="month">شهر</option><option value="custom">مخصص</option>
              </select>
            </div>
            {periodType === 'custom' && (
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">من تاريخ</label>
                <input type="date" className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold outline-none" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </div>
            )}
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">{periodType === 'custom' ? 'إلى تاريخ' : 'التاريخ'}</label>
              <input type="date" className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold outline-none" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
          </div>
        </div>

        {/* SECTION 1: HERO SUMMARY */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-gradient-to-br from-indigo-900 to-slate-900 p-8 rounded-[2rem] shadow-xl text-white relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500 rounded-full blur-[60px] opacity-30 -mr-10 -mt-10 transition-transform group-hover:scale-150"></div>
            <p className="text-indigo-200 text-sm font-bold uppercase tracking-widest mb-2 flex items-center gap-2"><DollarSign size={16}/> صافي الربح</p>
            <h2 className="text-4xl font-black tracking-tight">{dashboardStats.netProfit.toLocaleString()} ﷼</h2>
          </div>
          {[
            { label: "الإيرادات", value: `${dashboardStats.totalRevenue.toLocaleString()} ﷼`, icon: <TrendingUp/>, color: "emerald" },
            { label: "تكلفة الإعلانات", value: `${dashboardStats.totalAdCost.toLocaleString()} ﷼`, icon: <Megaphone/>, color: "rose" },
            { label: "صافي المبيعات", value: `${dashboardStats.netSales} طلب`, icon: <ShoppingBag/>, color: "blue" }
          ].map((k, i) => (
            <div key={i} className="bg-white p-8 rounded-[2rem] shadow-sm border border-slate-100 flex flex-col justify-center relative overflow-hidden hover:shadow-md transition-shadow">
              <div className={`absolute top-0 right-0 w-1 h-full ${kpiColors[k.color].bg}`}></div>
              <div className={`absolute top-6 left-6 p-3 rounded-2xl ${kpiColors[k.color].iconBg} ${kpiColors[k.color].iconText}`}>{k.icon}</div>
              <p className="text-slate-400 text-sm font-bold uppercase tracking-wider mb-2">{k.label}</p>
              <h2 className={`text-3xl font-black ${kpiColors[k.color].text}`}>{k.value}</h2>
            </div>
          ))}
        </div>

        {/* SECTION 2: OPERATIONAL ALERTS */}
        {smartAlerts.length > 0 && (
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
            <h3 className="font-black text-slate-800 mb-4 flex items-center gap-2"><BellRing className="text-amber-500"/> التنبيهات التشغيلية</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {smartAlerts.map((a, i) => (
                <div key={i} className={`p-4 rounded-2xl border flex items-start gap-3 ${a.type==='critical'?'bg-rose-50 border-rose-200 text-rose-800':a.type==='danger'?'bg-orange-50 border-orange-200 text-orange-800':'bg-amber-50 border-amber-200 text-amber-800'}`}>
                  <AlertTriangle size={18} className="mt-0.5 flex-shrink-0" />
                  <span className="text-sm font-bold leading-relaxed">{a.msg}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* SECTION 3: CHARTS & PRODUCTS */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
             <h3 className="font-black text-slate-800 mb-8 flex items-center gap-2"><Activity className="text-indigo-500"/> مسار المبيعات</h3>
             {trendLine.every(d=>d.sales===0) ? (
               <div className="h-[200px] flex items-center justify-center text-slate-400 font-bold bg-slate-50 rounded-2xl border border-dashed">لا توجد بيانات لعرضها</div>
             ) : <SimpleLineChart data={trendLine} dataKey="sales" height={250} />}
          </div>

          <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100 flex flex-col">
             <h3 className="font-black text-slate-800 mb-6 flex items-center gap-2"><Package className="text-emerald-500"/> تحليل المنتجات</h3>
             <div className="flex-1 space-y-4 overflow-y-auto custom-scrollbar pr-2">
               {productStats.slice(0, 5).map((p, i) => (
                 <div key={i} className="flex flex-col gap-1.5">
                   <div className="flex justify-between text-sm font-bold text-slate-700">
                     <span className="truncate pr-2">{p.name}</span>
                     <span>{p.sales} حبة</span>
                   </div>
                   <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                     <div className={`h-full rounded-full ${i===0 ? 'bg-emerald-500' : 'bg-indigo-400'}`} style={{width: `${Math.min((p.sales / Math.max(...productStats.map(s=>s.sales), 1))*100, 100)}%`}}></div>
                   </div>
                   <div className="text-[10px] text-slate-400 flex justify-between font-mono">
                     <span>{p.sku}</span><span>{p.profit > 0 ? `+${p.profit.toLocaleString()} ﷼` : 'خسارة'}</span>
                   </div>
                 </div>
               ))}
             </div>
          </div>
        </div>

        {/* SECTION 4: CHANNELS PERFORMANCE */}
        <div className="bg-white rounded-3xl p-8 shadow-sm border border-slate-100">
           <h3 className="font-black text-slate-800 mb-6 flex items-center gap-2"><PieChart className="text-blue-500"/> أداء القنوات التسويقية</h3>
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
             {Object.entries(channelStats).filter(([ch])=>ch!=='المنتجات الفردية').sort((a,b)=>b[1].score - a[1].score).map(([ch, data], i) => (
               <div key={i} className="bg-slate-50 p-6 rounded-2xl border border-slate-100 flex flex-col justify-between hover:shadow-md transition-shadow">
                 <div className="mb-4">
                   <h4 className="text-sm font-black text-slate-800 flex justify-between items-center mb-4">
                     <span className="truncate pr-1">{ch}</span>
                     <span className={`text-[10px] font-black px-2.5 py-1 rounded-lg border ${data.roi >= 2 ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-rose-100 text-rose-700 border-rose-200'}`}>
                       ROI: {data.roi===Infinity ? 'عضوي' : data.roi.toFixed(1)+'x'}
                     </span>
                   </h4>
                   <div className="space-y-3 text-xs font-bold text-slate-600">
                     <div className="flex justify-between"><span>الإيراد</span><span className="text-slate-900">{data.revenue.toLocaleString()} ﷼</span></div>
                     <div className="flex justify-between"><span>التكلفة</span><span className="text-rose-600">{data.adCost.toLocaleString()} ﷼</span></div>
                     <div className="flex justify-between"><span>الربح</span><span className={data.netProfit >= 0 ? "text-emerald-600" : "text-rose-600"}>{data.netProfit.toLocaleString()} ﷼</span></div>
                   </div>
                 </div>
                 <div className="pt-4 border-t border-slate-200">
                   <div className="flex justify-between items-center">
                     <span className="text-[10px] font-bold text-slate-400">الحالة</span>
                     <span className={`text-[11px] font-black ${data.score >= 2 ? 'text-emerald-500' : data.score > 0 ? 'text-amber-500' : 'text-rose-500'}`}>
                       {data.score >= 2 ? 'ممتاز 🔥' : data.score > 0 ? 'مقبول ⚠️' : 'يحتاج تدخل ❌'}
                     </span>
                   </div>
                 </div>
               </div>
             ))}
           </div>
        </div>
      </div>
    );
  };

  const UploadTab = () => {
    const fileInputRef = useRef(null);
    const [importPreview, setImportPreview] = useState(null);
    const [importMode, setImportMode] = useState('sales');

    const handleFileUpload = async (e) => {
      const file = e.target.files[0]; if (!file) return;
      try {
        const XLSX = await loadXLSX();
        const reader = new FileReader();
        reader.onload = async (event) => {
          const data = new Uint8Array(event.target.result);
          const workbook = XLSX.read(data, { type: 'array' });
          const rows = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { header: 1 });
          if(rows.length < 2) return alert('ملف غير صالح');

          const headers = rows[0].map(h => String(h || ''));
          const orderIdCol = headers.findIndex(h => h.includes('رقم الطلب') || h.includes('رقم'));
          const productCol = headers.findIndex(h => h.includes('نوع الطلب') || h.includes('المنتجات') || h.includes('اسم المنتج'));
          const qtyCol = headers.findIndex(h => h.includes('الكمية') || h.includes('العدد') || h === 'Qty');
          const paymentCol = headers.findIndex(h => h.includes('طريقة الدفع') || h.includes('الدفع'));
          const customerCol = headers.findIndex(h => h.includes('اسم العميل') || h.includes('العميل'));
          const mobileCol = headers.findIndex(h => h.includes('الجوال') || h.includes('هاتف'));
          const amountCol = headers.findIndex(h => h.includes('إجمالي') || h.includes('المبلغ') || h.includes('مجموع'));

          const parsedOrders = [];
          const parsedMovementsLocal = [];
          
          for (let i = 1; i < rows.length; i++) {
            const row = rows[i]; if(!row || row.length === 0) continue;
            let orderId = row[orderIdCol] ? String(row[orderIdCol]).replace(/["']/g, '').replace(/^\uFEFF/, '') : '';
            if(!orderId) continue;

            let productStr = productCol !== -1 ? String(row[productCol] || '') : '';
            let paymentStr = paymentCol !== -1 ? String(row[paymentCol] || '') : '';
            let customerName = customerCol !== -1 ? String(row[customerCol] || 'غير معروف') : 'غير معروف';
            let mobile = mobileCol !== -1 ? String(row[mobileCol] || '').replace(/[^0-9+]/g, '') : '';
            let amount = amountCol !== -1 ? parseFloat(row[amountCol]) || 0 : 0;
            
            let qty = 1;
            if (qtyCol !== -1 && row[qtyCol] !== undefined && !isNaN(parseInt(row[qtyCol]))) { qty = parseInt(row[qtyCol]); } 
            else { const qtyMatch = productStr.match(/Qty:\s*(\d+)/i); if (qtyMatch) qty = parseInt(qtyMatch[1]); }

            let mappedCode = null; let mappedLevel = 'بكج';
            const skuMatch = productStr.match(/SKU:\s*([a-zA-Z0-9_-]+)/i);
            
            if (skuMatch && packages[skuMatch[1]]) { mappedCode = skuMatch[1]; } 
            else if (productStr.includes('مجموعة سباركل الكاملة') || productStr.includes('مجموعة سبارك الكاملة')) { mappedCode = 'asg002'; } 
            else if (productStr.includes('بكج اسباركل') || productStr.includes('بكج التأسيس')) { mappedCode = 'asg001'; } 
            else if (productStr.includes('بكج العساف')) { mappedCode = 'asg003'; } 
            else if (productStr.includes('بكج الـ 7 عطور')) { mappedCode = 'asg002'; } 
            else {
              Object.entries(packages).forEach(([code, pkg]) => { if(productStr.includes(code) || productStr.includes(pkg.name)) mappedCode = code; });
            }
            if (!mappedCode) {
              Object.keys(productDetails).forEach(sku => { if(productStr.includes(sku)) { mappedCode = sku; mappedLevel = 'منتج'; } });
            }
            if (!mappedCode) mappedCode = Object.keys(packages)[0] || Object.keys(productDetails)[0];

            let movType = 'بيع آلي (عبر الربط)'; 
            if (importMode === 'sales') {
               if (paymentStr.includes('تمارا') || paymentStr.includes('تابي')) movType = 'بيع (تمارا)';
               else if (paymentStr.includes('عند الاستلام') || paymentStr.includes('الدفع عند الاستلام')) movType = 'بيع (دفع عند الاستلام)';
               else if (paymentStr !== '') movType = 'بيع (دفع إلكتروني)';
            } else { movType = 'مرتجع (إلغاء رغبة العميل)'; }

            const channelName = mappedLevel === 'بكج' ? (packages[mappedCode]?.channel || 'عضوي') : 'المنتجات الفردية';
            
            parsedOrders.push({ date: todayStr, reference: orderId, customerName, mobile, amount, channel: channelName, status: importMode==='sales'?'مكتمل':'مرتجع' });
            parsedMovementsLocal.push({ date: todayStr, level: mappedLevel, code: mappedCode, type: movType, quantity: qty, reference: orderId, note: importMode === 'sales' ? 'استيراد مبيعات' : 'استيراد رجيع' });
          }
          setImportPreview({ orders: parsedOrders, movements: parsedMovementsLocal });
          if (fileInputRef.current) fileInputRef.current.value = '';
        };
        reader.readAsArrayBuffer(file);
      } catch (err) { alert('خطأ في القراءة'); }
    };

    const confirmImport = async () => {
      if(!importPreview || importPreview.movements.length === 0) return;
      setIsSyncing(true);
      try {
        const batchSize = 50; 
        const uniqueOrders = [];
        const seenRefs = new Set(orders.map(o => o.reference)); 
        for (const o of importPreview.orders) {
          if (!seenRefs.has(o.reference)) { seenRefs.add(o.reference); uniqueOrders.push(o); }
        }

        for (let i = 0; i < uniqueOrders.length; i += batchSize) {
          const chunk = uniqueOrders.slice(i, i + batchSize);
          const batch = writeBatch(db);
          chunk.forEach((ord, index) => {
            const now = Date.now() + index; 
            const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'orders', `ord_${now}_${Math.random().toString(36).slice(2, 6)}`);
            batch.set(docRef, { ...ord, timestamp: now });
          });
          await batch.commit();
        }

        for (let i = 0; i < importPreview.movements.length; i += batchSize) {
          const chunk = importPreview.movements.slice(i, i + batchSize);
          const batch = writeBatch(db);
          chunk.forEach((mov, index) => {
            const now = Date.now() + index; 
            const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'movements', `mov_${now}_${Math.random().toString(36).slice(2, 6)}`);
            batch.set(docRef, { ...mov, timestamp: now });
          });
          await batch.commit();
        }
        
        alert('تم دمج العمليات وبناء قاعدة العملاء بنجاح!'); setImportPreview(null);
      } catch (e) { console.error(e); alert('خطأ أثناء الرفع'); } finally { setIsSyncing(false); }
    };

    return (
      <div className="bg-white p-6 md:p-10 rounded-3xl border border-slate-100 shadow-sm animate-in fade-in">
        <h2 className="text-2xl font-black text-slate-800 mb-2 flex items-center gap-3"><UploadCloud className="text-indigo-500" size={28}/> استيراد البيانات (ETL Engine)</h2>
        <p className="text-slate-500 text-sm mb-8">ارفع ملفات سلة لبناء بيانات المخزون، الإيرادات، وقاعدة بيانات العملاء دفعة واحدة.</p>

        {importPreview ? (
          <div className="bg-indigo-50 border border-indigo-100 rounded-3xl p-8">
            <h4 className="font-black text-indigo-900 mb-6 flex items-center gap-2 text-lg"><CheckCircle2/> تأكيد استيراد البيانات</h4>
            <div className="flex flex-col md:flex-row gap-6 mb-8">
              <div className="bg-white p-6 rounded-2xl flex-1 text-center shadow-sm border border-indigo-100/50">
                <span className="block text-4xl font-black text-indigo-600 mb-2">{importPreview.orders.length}</span><span className="text-sm font-bold text-slate-500">طلب (يبني الـ CRM)</span>
              </div>
              <div className="bg-white p-6 rounded-2xl flex-1 text-center shadow-sm border border-indigo-100/50">
                <span className="block text-4xl font-black text-emerald-600 mb-2">{importPreview.movements.length}</span><span className="text-sm font-bold text-slate-500">حركة مخزون ومالية</span>
              </div>
            </div>
            <div className="flex gap-4">
              <button onClick={confirmImport} disabled={isSyncing} className="flex-1 bg-indigo-600 text-white font-black py-4 rounded-xl hover:bg-indigo-700 shadow-md transition-colors">{isSyncing ? 'جاري المعالجة...' : 'تأكيد واعتماد الرفع'}</button>
              <button onClick={()=>setImportPreview(null)} disabled={isSyncing} className="bg-white text-slate-700 border font-bold py-4 px-8 rounded-xl hover:bg-slate-50 transition-colors">إلغاء</button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col md:flex-row gap-6 items-center bg-slate-50 p-8 rounded-3xl border border-slate-200 border-dashed">
            <div className="flex-1 w-full">
              <label className="flex items-center gap-4 bg-white p-5 rounded-2xl border border-slate-200 cursor-pointer hover:border-indigo-500 transition-colors mb-4 shadow-sm">
                <input type="radio" name="mode" className="accent-indigo-600 w-5 h-5" checked={importMode==='sales'} onChange={()=>setImportMode('sales')}/>
                <div><p className="font-black text-slate-800 text-base">مبيعات (تم التوصيل)</p><p className="text-xs font-bold text-slate-500 mt-1">يضيف إيرادات ويبني عملاء</p></div>
              </label>
              <label className="flex items-center gap-4 bg-white p-5 rounded-2xl border border-slate-200 cursor-pointer hover:border-rose-500 transition-colors shadow-sm">
                <input type="radio" name="mode" className="accent-rose-600 w-5 h-5" checked={importMode==='returns'} onChange={()=>setImportMode('returns')}/>
                <div><p className="font-black text-slate-800 text-base">مرتجعات (دعم فني)</p><p className="text-xs font-bold text-slate-500 mt-1">يخصم إيرادات ويسترد بضاعة</p></div>
              </label>
            </div>
            <div className="w-full md:w-1/2">
              <input type="file" accept=".csv, .xlsx, .xls" ref={fileInputRef} onChange={handleFileUpload} className="hidden" id="file-upload"/>
              <label htmlFor="file-upload" className="bg-indigo-600 hover:bg-indigo-700 text-white font-black py-6 rounded-2xl flex flex-col items-center justify-center gap-3 cursor-pointer transition-colors shadow-lg h-full min-h-[160px]">
                <FileSpreadsheet size={40}/>
                <span className="text-lg">اختيار ورفع ملف (سلة)</span>
              </label>
            </div>
          </div>
        )}
      </div>
    );
  };

  const ManualMovementForm = () => {
    const defaultCode = Object.keys(productDetails)[0] || '';
    const defaultPkgCode = Object.keys(packages)[0] || '';
    const [formData, setFormData] = useState({ date: todayStr, level: 'منتج', code: defaultCode, type: MOVEMENT_TYPES[0].id, quantity: 1, reference: '', note: '' });
    
    useEffect(() => { 
      setFormData(prev => ({ ...prev, code: prev.level === 'منتج' ? defaultCode : defaultPkgCode })); 
    }, [productDetails, packages, formData.level]);

    const handleSubmit = async (e) => {
      e.preventDefault();
      await addMovementToCloud(formData);
      setFormData({ ...formData, quantity: 1, reference: '', note: '' });
      alert('تم التسجيل بنجاح');
    };

    return (
      <div className="bg-white p-6 md:p-8 rounded-3xl border border-slate-100 shadow-sm animate-in fade-in mt-6">
        <h3 className="text-xl font-bold mb-6 text-slate-800 border-b border-slate-100 pb-4">إدخال مخزون يدوي (طوارئ / جرد)</h3>
        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div><label className="block text-xs font-bold mb-1 text-slate-600">التاريخ</label><input type="date" required className="w-full p-2.5 bg-slate-50 rounded-xl border-none outline-none" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} /></div>
          <div><label className="block text-xs font-bold mb-1 text-slate-600">المستوى</label><select className="w-full p-2.5 bg-slate-50 rounded-xl border-none outline-none" value={formData.level} onChange={e => setFormData({...formData, level: e.target.value})}><option value="منتج">منتج فردي</option><option value="بكج">بكج / عرض</option></select></div>
          <div>
            <label className="block text-xs font-bold mb-1 text-slate-600">الكود</label>
            <select className="w-full p-2.5 bg-slate-50 rounded-xl border-none outline-none" value={formData.code} onChange={e => setFormData({...formData, code: e.target.value})} required>
              {formData.level === 'منتج' ? Object.keys(productDetails).map(p => <option key={p} value={p}>{p} - {productDetails[p].name}</option>) : Object.keys(packages).map(p => <option key={p} value={p}>{p} - {packages[p].name}</option>)}
            </select>
          </div>
          <div><label className="block text-xs font-bold mb-1 text-slate-600">النوع</label><select className="w-full p-2.5 bg-slate-50 rounded-xl border-none outline-none" value={formData.type} onChange={e => setFormData({...formData, type: e.target.value})}>{MOVEMENT_TYPES.map(t => <option key={t.id} value={t.id}>{t.id}</option>)}</select></div>
          <div><label className="block text-xs font-bold mb-1 text-slate-600">الكمية</label><input type="number" min="1" required className="w-full p-2.5 bg-slate-50 rounded-xl border-none outline-none" value={formData.quantity} onChange={e => setFormData({...formData, quantity: e.target.value})} /></div>
          <div><label className="block text-xs font-bold mb-1 text-slate-600">المرجع</label><input type="text" className="w-full p-2.5 bg-slate-50 rounded-xl border-none outline-none" value={formData.reference} onChange={e => setFormData({...formData, reference: e.target.value})} /></div>
          <div className="md:col-span-2"><label className="block text-xs font-bold mb-1 text-slate-600">ملاحظات</label><input type="text" className="w-full p-2.5 bg-slate-50 rounded-xl border-none outline-none" value={formData.note} onChange={e => setFormData({...formData, note: e.target.value})} /></div>
          <div className="md:col-span-4 mt-2"><button type="submit" disabled={isSyncing} className="w-full bg-slate-800 text-white p-3.5 rounded-xl font-bold hover:bg-slate-900 transition-colors">تنفيذ الحركة</button></div>
        </form>
      </div>
    );
  };

  const OrdersAndCRMTab = ({ mode = 'orders' }) => {
    const [searchTerm, setSearchTerm] = useState('');
    
    const filteredOrders = useMemo(() => {
      if(!searchTerm) return orders;
      return orders.filter(o => (o.reference||'').includes(searchTerm) || (o.customerName||'').includes(searchTerm) || (o.mobile||'').includes(searchTerm));
    }, [orders, searchTerm]);

    const filteredCRM = useMemo(() => {
      if(!searchTerm) return customers;
      return customers.filter(c => c.name.includes(searchTerm) || c.mobile.includes(searchTerm));
    }, [customers, searchTerm]);

    return (
      <div className="space-y-6 animate-in fade-in">
        <div className="bg-white rounded-[2rem] shadow-sm border border-slate-100 overflow-hidden">
          <div className="p-8 border-b border-slate-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 bg-slate-50/50">
            <div>
              <h2 className="text-2xl font-black text-slate-800 flex items-center gap-3">{mode === 'orders' ? <ShoppingBag className="text-indigo-500" size={28}/> : <UsersRound className="text-indigo-500" size={28}/>} {mode === 'orders' ? 'الطلبات' : 'العملاء (CRM)'}</h2>
              <p className="text-sm text-slate-500 mt-2">{mode === 'orders' ? 'سجل كافة الطلبات الواردة من المتجر.' : 'قاعدة بيانات العملاء وتصنيفهم الذكي.'}</p>
            </div>
            <div className="w-full md:w-80 relative">
              <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input type="text" placeholder="بحث برقم، اسم، أو جوال..." className="w-full pl-4 pr-12 py-3 rounded-2xl border border-slate-200 text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none bg-white shadow-sm" value={searchTerm} onChange={e=>setSearchTerm(e.target.value)} />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right text-sm">
              <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-widest font-bold">
                {mode === 'orders' ? (
                  <tr><th className="p-6 border-b">رقم الطلب</th><th className="p-6 border-b">التاريخ</th><th className="p-6 border-b">العميل</th><th className="p-6 border-b">الجوال</th><th className="p-6 border-b">القناة</th><th className="p-6 border-b">المبلغ</th><th className="p-6 border-b">الحالة</th></tr>
                ) : (
                  <tr><th className="p-6 border-b">اسم العميل</th><th className="p-6 border-b">الجوال</th><th className="p-6 border-b text-center">عدد الطلبات</th><th className="p-6 border-b">إجمالي الإنفاق</th><th className="p-6 border-b">آخر طلب</th><th className="p-6 border-b">التصنيف</th></tr>
                )}
              </thead>
              <tbody className="divide-y divide-slate-100">
                {mode === 'orders' ? (
                  filteredOrders.length === 0 ? <tr><td colSpan="7" className="p-12 text-center text-slate-400 font-bold">لا توجد طلبات مطابقة.</td></tr> :
                  filteredOrders.slice(0, 100).map((o, i) => (
                    <tr key={i} className="hover:bg-indigo-50/30 transition-colors">
                      <td className="p-6 font-mono text-slate-500 text-xs">{o.reference}</td>
                      <td className="p-6 text-xs text-slate-500 font-bold">{o.date}</td>
                      <td className="p-6 font-black text-slate-800">{o.customerName}</td>
                      <td className="p-6 text-slate-500 font-mono text-xs" dir="ltr">{o.mobile}</td>
                      <td className="p-6"><span className="bg-slate-100 text-slate-600 px-3 py-1.5 rounded-lg text-[10px] font-bold">{o.channel}</span></td>
                      <td className="p-6 font-black text-emerald-600">{parseFloat(o.amount||0).toLocaleString()} ﷼</td>
                      <td className="p-6"><span className={`px-3 py-1.5 rounded-lg text-[10px] font-bold ${o.status === 'مكتمل' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>{o.status}</span></td>
                    </tr>
                  ))
                ) : (
                  filteredCRM.length === 0 ? <tr><td colSpan="6" className="p-12 text-center text-slate-400 font-bold">لا يوجد عملاء.</td></tr> :
                  filteredCRM.slice(0, 100).map((c, i) => (
                    <tr key={i} className="hover:bg-indigo-50/30 transition-colors">
                      <td className="p-6 font-black text-slate-800">{c.name}</td>
                      <td className="p-6 text-slate-500 font-mono text-xs" dir="ltr">{c.mobile}</td>
                      <td className="p-6 font-black text-center text-indigo-600 text-lg">{c.orderCount}</td>
                      <td className="p-6 font-black text-emerald-600">{c.totalSpend.toLocaleString()} ﷼</td>
                      <td className="p-6 text-xs text-slate-500 font-bold">{c.lastOrder} <span className="block text-[10px] text-slate-400 mt-1">منذ {c.daysSince} يوم</span></td>
                      <td className="p-6">
                        <span className={`px-3 py-1.5 rounded-lg text-xs font-black ${c.segment.includes('VIP') ? 'bg-amber-100 text-amber-700' : c.segment.includes('معرض') ? 'bg-orange-100 text-orange-700' : c.segment.includes('منقطع') ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'}`}>
                          {c.segment}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
            {(mode==='orders' ? filteredOrders.length : filteredCRM.length) > 100 && <div className="p-6 text-center text-xs font-bold text-slate-400 border-t border-slate-100">يتم عرض أحدث 100 سجل فقط.</div>}
          </div>
        </div>
      </div>
    );
  };

  const DecisionCenterTab = () => {
    return (
      <div className="space-y-6 animate-in fade-in">
        <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-3xl p-8 shadow-xl text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500 rounded-full blur-[100px] opacity-20 -mr-20 -mt-20"></div>
          <h2 className="text-2xl font-black mb-2 flex items-center gap-3"><BrainCircuit className="text-indigo-400" size={28}/> مركز القرارات الإستراتيجية</h2>
          <p className="text-slate-300 text-sm mb-8">يتم توليد هذه التوصيات بالذكاء الاصطناعي بناءً على الأرقام الحقيقية لهوامش الربح والعائد على الإعلانات.</p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 relative z-10">
            {businessDecisions.length === 0 ? <div className="col-span-2 text-center text-slate-400 py-10 font-bold bg-white/5 rounded-2xl">لا توجد توصيات حرجة حالياً. أرقامك مستقرة!</div> : 
              businessDecisions.map((d, i) => (
                <div key={i} className={`bg-white/10 backdrop-blur-md border border-white/10 rounded-2xl p-5 flex items-start gap-4 ${d.color}`}>
                  <div className="mt-0.5 bg-white/20 p-2 rounded-lg">
                    {d.iconType === 'scale' ? <TrendingUp size={20}/> : d.iconType === 'stop' ? <X size={20}/> : d.iconType === 'product-good' ? <CheckCircle2 size={20}/> : d.iconType === 'warning' ? <AlertTriangle size={20}/> : <AlertOctagon size={20}/>}
                  </div>
                  <div>
                    <h4 className="font-bold mb-1 text-white">{d.iconType === 'scale' ? 'فرصة نمو مؤكدة' : d.iconType === 'stop' ? 'إيقاف استنزاف' : d.iconType==='product-good' ? 'بطل المبيعات' : 'تحذير أداء'}</h4>
                    <p className="text-sm opacity-90 leading-relaxed text-white">{d.msg}</p>
                  </div>
                </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const ProfitSimulatorTab = () => {
    const [simData, setSimData] = useState({
      glass: 0, cap: 0, pump: 0, oil: 0, box: 0, carton: 0, filling: 0, packaging: 0, printing: 0, other: 0,
      price: 150, shipping: 25, commission: 5, adBudget: 1000, expectedOrders: 20, returnRate: 10
    });

    const handleCalc = (key, val) => setSimData(prev => ({...prev, [key]: parseFloat(val) || 0}));

    const unitCost = simData.glass + simData.cap + simData.pump + simData.oil + simData.box + simData.carton + simData.filling + simData.packaging + simData.printing + simData.other;
    const unitProfit = simData.price - unitCost - simData.shipping - simData.commission;
    const effectiveProfit = unitProfit * (1 - (simData.returnRate/100)) - (simData.shipping * (simData.returnRate/100)); 
    const breakEven = effectiveProfit > 0 ? Math.ceil(simData.adBudget / effectiveProfit) : 0;

    return (
      <div className="space-y-6 animate-in fade-in">
        <div className="bg-white rounded-3xl p-6 md:p-8 shadow-sm border border-slate-100">
          <div className="flex items-center gap-3 mb-8 border-b border-slate-100 pb-4">
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl"><Calculator size={24}/></div>
            <div>
              <h2 className="text-xl font-black text-slate-800">محاكي الأرباح المتقدم (Profit Simulator)</h2>
              <p className="text-xs text-slate-500 mt-1">احسب التكلفة الدقيقة للوحدة ونقاط التعادل للحملات التسويقية.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-8">
              <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100">
                <h4 className="font-bold text-sm text-slate-800 mb-4 flex items-center gap-2"><Package size={16}/> تكاليف التصنيع (للعلبة)</h4>
                <div className="grid grid-cols-3 md:grid-cols-5 gap-3">
                  {['glass:الزجاج', 'cap:الغطاء', 'pump:البامب', 'oil:الزيت', 'box:البكج', 'carton:الكرتون', 'filling:التعبئة', 'packaging:التغليف', 'printing:الطباعة', 'other:أخرى'].map(item => {
                    const [key, label] = item.split(':');
                    return (
                      <div key={key}>
                        <label className="block text-[10px] font-bold text-slate-500 mb-1">{label}</label>
                        <input type="number" min="0" step="0.5" className="w-full bg-white border border-slate-200 p-2 rounded-lg text-sm text-center focus:ring-2 focus:ring-emerald-500 outline-none" value={simData[key] || ''} onChange={e=>handleCalc(key, e.target.value)} />
                      </div>
                    );
                  })}
                </div>
                <div className="mt-4 text-left font-black text-sm text-slate-700 bg-white p-2 rounded-lg border inline-block">إجمالي تكلفة العلبة: {unitCost.toFixed(2)} ﷼</div>
              </div>

              <div className="bg-indigo-50/50 p-5 rounded-2xl border border-indigo-100">
                <h4 className="font-bold text-sm text-indigo-900 mb-4 flex items-center gap-2"><ShoppingBag size={16}/> التسعير والتشغيل</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div><label className="block text-[10px] font-bold text-indigo-700 mb-1">سعر البيع النهائي</label><input type="number" className="w-full bg-white border border-indigo-200 p-2 rounded-lg text-sm text-center focus:ring-2 outline-none font-bold" value={simData.price} onChange={e=>handleCalc('price', e.target.value)} /></div>
                  <div><label className="block text-[10px] font-bold text-indigo-700 mb-1">متوسط الشحن للطلب</label><input type="number" className="w-full bg-white border border-indigo-200 p-2 rounded-lg text-sm text-center outline-none" value={simData.shipping} onChange={e=>handleCalc('shipping', e.target.value)} /></div>
                  <div><label className="block text-[10px] font-bold text-indigo-700 mb-1">عمولات (سلة/بوابات)</label><input type="number" className="w-full bg-white border border-indigo-200 p-2 rounded-lg text-sm text-center outline-none" value={simData.commission} onChange={e=>handleCalc('commission', e.target.value)} /></div>
                  <div><label className="block text-[10px] font-bold text-rose-700 mb-1">توقع نسبة المرتجع %</label><input type="number" className="w-full bg-white border border-rose-200 p-2 rounded-lg text-sm text-center outline-none text-rose-600 font-bold" value={simData.returnRate} onChange={e=>handleCalc('returnRate', e.target.value)} /></div>
                </div>
              </div>

              <div className="bg-orange-50/50 p-5 rounded-2xl border border-orange-100">
                <h4 className="font-bold text-sm text-orange-900 mb-4 flex items-center gap-2"><Megaphone size={16}/> حملة تسويقية (توقعات)</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="block text-[10px] font-bold text-orange-700 mb-1">الميزانية المرصودة</label><input type="number" className="w-full bg-white border border-orange-200 p-2 rounded-lg text-sm text-center outline-none font-bold" value={simData.adBudget} onChange={e=>handleCalc('adBudget', e.target.value)} /></div>
                  <div><label className="block text-[10px] font-bold text-orange-700 mb-1">الطلبات المتوقعة من الحملة</label><input type="number" className="w-full bg-white border border-orange-200 p-2 rounded-lg text-sm text-center outline-none" value={simData.expectedOrders} onChange={e=>handleCalc('expectedOrders', e.target.value)} /></div>
                </div>
              </div>
            </div>

            <div className="bg-slate-900 rounded-3xl p-6 text-white flex flex-col justify-between shadow-lg">
               <div>
                 <h3 className="font-black text-xl mb-6 text-emerald-400">النتائج وصناعة القرار</h3>
                 <div className="space-y-4 mb-8">
                   <div className="flex justify-between items-center border-b border-slate-700 pb-2">
                     <span className="text-slate-400 text-sm">صافي ربح الطلب (بعد المرتجع)</span>
                     <span className="font-black text-lg">{effectiveProfit.toFixed(2)} ﷼</span>
                   </div>
                   <div className="flex justify-between items-center border-b border-slate-700 pb-2">
                     <span className="text-slate-400 text-sm">نقطة التعادل (لتغطية التسويق)</span>
                     <span className="font-black text-rose-400 text-xl">{breakEven} طلب</span>
                   </div>
                   <div className="flex justify-between items-center border-b border-slate-700 pb-2">
                     <span className="text-slate-400 text-sm">ROI الحملة المتوقع</span>
                     <span className="font-black text-indigo-400 text-lg">{simData.adBudget > 0 ? ((simData.expectedOrders * simData.price) / simData.adBudget).toFixed(2) : 0}x</span>
                   </div>
                 </div>
               </div>
               <div className="bg-emerald-500/20 p-5 rounded-2xl border border-emerald-500/30 text-center">
                 <p className="text-xs text-emerald-300 font-bold mb-1">الربح الصافي المتوقع من الحملة</p>
                 <p className="text-3xl font-black text-emerald-400">{((simData.expectedOrders * effectiveProfit) - simData.adBudget).toLocaleString()} ﷼</p>
               </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const DataAdminTab = () => {
    const [confirmText, setConfirmText] = useState('');
    const [nukeTarget, setNukeTarget] = useState(null); 

    const handleNuke = async () => {
      if (confirmText !== 'DELETE') { alert('يجب كتابة DELETE بالأحرف الكبيرة للتأكيد'); return; }
      setIsSyncing(true);
      try {
        let collectionName = nukeTarget;
        let dataArray = nukeTarget === 'movements' ? movements : nukeTarget === 'orders' ? orders : adCosts;
        
        const batchSize = 100;
        for (let i = 0; i < dataArray.length; i += batchSize) {
          const chunk = dataArray.slice(i, i + batchSize);
          const batch = writeBatch(db);
          chunk.forEach(docItem => batch.delete(doc(db, 'artifacts', appId, 'public', 'data', collectionName, docItem.id)));
          await batch.commit();
        }
        alert('تم مسح البيانات بنجاح');
        setConfirmText(''); setNukeTarget(null);
      } catch(e) { console.error(e); alert('خطأ أثناء المسح'); } finally { setIsSyncing(false); }
    };

    return (
      <div className="space-y-6 animate-in fade-in max-w-3xl mx-auto">
        <div className="bg-rose-50 border-2 border-rose-200 p-10 rounded-[2rem] shadow-sm relative overflow-hidden">
          {isSyncing && <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center z-10"><Loader2 className="animate-spin text-rose-600" size={48} /></div>}
          <div className="flex items-center gap-5 mb-10 border-b border-rose-200 pb-8">
            <div className="p-5 bg-rose-600 text-white rounded-3xl shadow-lg shadow-rose-200"><ShieldAlert size={40}/></div>
            <div>
              <h2 className="text-3xl font-black text-rose-900">منطقة الخطر (Data Admin)</h2>
              <p className="text-sm text-rose-700 mt-2 font-bold">إجراءات لا رجعة فيها. استخدمها فقط لإعادة ضبط النظام.</p>
            </div>
          </div>

          <div className="space-y-4">
            {[
              { target: 'movements', title: 'مسح جميع حركات المخزون', count: movements.length },
              { target: 'orders', title: 'مسح جميع الطلبات المستوردة', count: orders.length },
              { target: 'adcosts', title: 'مسح سجل تكاليف التسويق', count: adCosts.length }
            ].map(act => (
              <div key={act.target} className="bg-white p-6 rounded-2xl border border-rose-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                  <h4 className="font-black text-rose-900 text-lg">{act.title}</h4>
                  <p className="text-sm text-rose-500 font-mono mt-1 font-bold">{act.count} سجل متوفر</p>
                </div>
                {nukeTarget === act.target ? (
                  <div className="flex gap-2 items-center w-full md:w-auto bg-rose-50 p-2 rounded-xl border border-rose-100">
                    <input type="text" placeholder="اكتب DELETE" className="p-3 border border-rose-300 rounded-lg outline-none text-sm w-32 text-center font-black text-rose-700" value={confirmText} onChange={e=>setConfirmText(e.target.value)}/>
                    <button onClick={handleNuke} className="bg-rose-600 text-white px-6 py-3 rounded-lg text-sm font-black hover:bg-rose-700 transition-colors shadow-md">تأكيد</button>
                    <button onClick={()=>{setNukeTarget(null);setConfirmText('');}} className="bg-white text-slate-700 px-4 py-3 rounded-lg text-sm font-bold border border-slate-200">إلغاء</button>
                  </div>
                ) : (
                  <button onClick={()=>setNukeTarget(act.target)} disabled={act.count === 0} className="w-full md:w-auto bg-rose-100 text-rose-700 px-8 py-3 rounded-xl text-sm font-black hover:bg-rose-200 disabled:opacity-50 transition-colors">تحديد للمسح</button>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const AdCostsTab = () => {
    const [date, setDate] = useState(todayStr);
    const [channel, setChannel] = useState(channelsList[0] || '');
    const [campaign, setCampaign] = useState('');
    const [cost, setCost] = useState('');
    const [note, setNote] = useState('');

    const handleAdd = async (e) => {
      e.preventDefault();
      if (!channel || !cost) return;

      setIsSyncing(true);
      try {
        const id = `ad_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
        await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'adcosts', id), {
          date,
          channel: channel.trim(),
          campaign: campaign.trim(),
          cost: parseFloat(cost) || 0,
          note: note.trim(),
          timestamp: Date.now(),
        });

        setCampaign('');
        setCost('');
        setNote('');
      } catch (err) {
        console.error(err);
        alert('حدث خطأ أثناء حفظ تكلفة التسويق');
      } finally {
        setIsSyncing(false);
      }
    };

    const handleDelete = async (id) => {
      if (!safeConfirm('هل تريد حذف هذا السجل؟')) return;
      setIsSyncing(true);
      try {
        await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'adcosts', id));
      } catch (err) {
        console.error(err);
        alert('تعذر حذف السجل');
      } finally {
        setIsSyncing(false);
      }
    };

    return (
      <div className="space-y-6 animate-in fade-in">
        <div className="bg-white rounded-3xl p-8 shadow-sm border border-slate-100">
          <h2 className="text-2xl font-black text-slate-800 mb-2 flex items-center gap-3">
            <Megaphone className="text-rose-500" size={28} />
            التسويق
          </h2>
          <p className="text-sm text-slate-500 mb-8">إدارة تكاليف الحملات والقنوات التسويقية لضبط الـ ROI.</p>

          <form onSubmit={handleAdd} className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8">
            <input type="date" className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold outline-none"
              value={date} onChange={(e) => setDate(e.target.value)} />

            <input type="text" list="channels-list" placeholder="القناة"
              className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold outline-none"
              value={channel} onChange={(e) => setChannel(e.target.value)} />
            <datalist id="channels-list">
              {channelsList.map((c) => <option key={c} value={c} />)}
            </datalist>

            <input type="text" placeholder="اسم الحملة"
              className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold outline-none"
              value={campaign} onChange={(e) => setCampaign(e.target.value)} />

            <input type="number" placeholder="التكلفة (ريال)"
              className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold outline-none"
              value={cost} onChange={(e) => setCost(e.target.value)} />

            <button type="submit"
              className="bg-rose-600 hover:bg-rose-700 text-white font-black rounded-xl px-5 py-3">
              إضافة
            </button>

            <div className="md:col-span-5">
              <input type="text" placeholder="ملاحظات"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold outline-none"
                value={note} onChange={(e) => setNote(e.target.value)} />
            </div>
          </form>

          <div className="overflow-x-auto">
            <table className="w-full text-right text-sm">
              <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-widest font-bold">
                <tr>
                  <th className="p-4 border-b">التاريخ</th>
                  <th className="p-4 border-b">القناة</th>
                  <th className="p-4 border-b">الحملة</th>
                  <th className="p-4 border-b">التكلفة</th>
                  <th className="p-4 border-b">ملاحظات</th>
                  <th className="p-4 border-b">إجراء</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {adCosts.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="p-10 text-center text-slate-400 font-bold">لا توجد سجلات تسويق.</td>
                  </tr>
                ) : (
                  adCosts.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                      <td className="p-4">{item.date}</td>
                      <td className="p-4 font-bold">{item.channel}</td>
                      <td className="p-4">{item.campaign || '-'}</td>
                      <td className="p-4 font-black text-rose-600">{(parseFloat(item.cost) || 0).toLocaleString()} ﷼</td>
                      <td className="p-4 text-slate-500">{item.note || '-'}</td>
                      <td className="p-4">
                        <button
                          onClick={() => handleDelete(item.id)}
                          className="text-rose-600 hover:text-rose-800 font-bold"
                        >
                          حذف
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  const DefinitionsTab = () => {
    const [newSku, setNewSku] = useState('');
    const [newName, setNewName] = useState('');
    const [newOpeningStock, setNewOpeningStock] = useState('0');
    const [newOpeningDate, setNewOpeningDate] = useState(todayStr);
    const [newCost, setNewCost] = useState('0');
    const [newSellingPrice, setNewSellingPrice] = useState('0');
    
    const [editingSku, setEditingSku] = useState(null);
    const [editData, setEditData] = useState({});

    const [pkgCode, setPkgCode] = useState('');
    const [pkgName, setPkgName] = useState('');
    const [pkgGroup, setPkgGroup] = useState('');
    const [pkgChannel, setPkgChannel] = useState('');
    const [pkgPrice, setPkgPrice] = useState('');
    const [pkgItems, setPkgItems] = useState({});
    const [itemSelectSku, setItemSelectSku] = useState(Object.keys(productDetails)[0] || '');
    const [itemSelectQty, setItemSelectQty] = useState(1);

    const [newChannelStr, setNewChannelStr] = useState('');

    const handleAddProduct = () => {
      const skuTrimmed = newSku.trim();
      if (!skuTrimmed || productDetails[skuTrimmed]) { alert("SKU غير صالح أو موجود مسبقاً"); return; }
      const newDetails = { ...productDetails };
      newDetails[skuTrimmed] = { sku: skuTrimmed, name: newName.trim() || skuTrimmed, openingStock: parseInt(newOpeningStock) || 0, openingDate: newOpeningDate || todayStr, unitCost: parseFloat(newCost) || 0, sellingPrice: parseFloat(newSellingPrice) || 0 };
      updateSettingsInCloud(newDetails, packages, channelsList);
      setNewSku(''); setNewName(''); setNewOpeningStock('0'); setNewCost('0'); setNewSellingPrice('0');
    };

    const handleSaveEditProduct = () => {
      const newDetails = { ...productDetails };
      newDetails[editingSku] = { ...newDetails[editingSku], name: editData.name, openingStock: parseInt(editData.openingStock) || 0, openingDate: editData.openingDate, unitCost: parseFloat(editData.unitCost) || 0, sellingPrice: parseFloat(editData.sellingPrice) || 0 };
      updateSettingsInCloud(newDetails, packages, channelsList);
      setEditingSku(null);
    };

    const handleDeleteProduct = (sku) => {
      if(safeConfirm(`هل أنت متأكد من حذف ${sku}؟`)) {
        const newDetails = { ...productDetails }; delete newDetails[sku];
        updateSettingsInCloud(newDetails, packages, channelsList);
      }
    };

    const handleAddPackageItem = () => {
      if (!itemSelectSku) return;
      setPkgItems(prev => ({ ...prev, [itemSelectSku]: (prev[itemSelectSku] || 0) + parseInt(itemSelectQty) }));
      setItemSelectQty(1);
    };

    const handleRemovePackageItem = (sku) => { const newItems = { ...pkgItems }; delete newItems[sku]; setPkgItems(newItems); };

    const handleAddPackage = () => {
      if (!pkgCode.trim() || !pkgName.trim() || Object.keys(pkgItems).length === 0) { alert("أكمل بيانات البكج"); return; }
      const newPackages = { ...packages, [pkgCode.trim()]: { name: pkgName.trim(), group: pkgGroup.trim() || pkgName.trim(), channel: pkgChannel.trim() || 'عام', price: parseFloat(pkgPrice) || 0, items: pkgItems } };
      updateSettingsInCloud(productDetails, newPackages, channelsList);
      setPkgCode(''); setPkgName(''); setPkgGroup(''); setPkgChannel(''); setPkgPrice(''); setPkgItems({});
    };

    const handleAddChannel = () => {
      if(!newChannelStr.trim() || channelsList.includes(newChannelStr.trim())) return;
      updateSettingsInCloud(productDetails, packages, [...channelsList, newChannelStr.trim()]);
      setNewChannelStr('');
    };
    const handleRemoveChannel = (ch) => {
      if(safeConfirm('حذف القناة؟')) updateSettingsInCloud(productDetails, packages, channelsList.filter(c => c !== ch));
    };

    return (
      <div className="space-y-6 animate-in fade-in pb-10">
        
        {/* --- المنتجات --- */}
        <div className="bg-white p-6 md:p-8 rounded-3xl border border-slate-100 shadow-sm relative">
           {isSyncing && <div className="absolute inset-0 bg-white/50 backdrop-blur-sm flex items-center justify-center rounded-3xl z-10"><Loader2 className="animate-spin text-indigo-600" size={40} /></div>}
           <h3 className="text-xl font-black text-slate-800 mb-4 flex items-center gap-3 border-b border-slate-100 pb-4">
             <Package size={24} className="text-blue-500"/> التأسيس: المنتجات (SKUs)
           </h3>
           <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl mb-6 text-xs text-amber-800 font-bold flex items-center gap-3">
             <AlertTriangle size={16} className="text-amber-600 shrink-0"/> النظام لن يحسب الحركات التي تسبق "تاريخ الافتتاح" لمنع التكرار!
           </div>

           <div className="grid grid-cols-1 md:grid-cols-7 gap-3 bg-slate-50 p-5 rounded-2xl border border-slate-100 mb-8">
             <div><label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">SKU</label><input type="text" className="w-full p-2.5 bg-white border border-slate-200 rounded-xl outline-none font-bold text-sm" value={newSku} onChange={e=>setNewSku(e.target.value)} /></div>
             <div><label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">الاسم</label><input type="text" className="w-full p-2.5 bg-white border border-slate-200 rounded-xl outline-none font-bold text-sm" value={newName} onChange={e=>setNewName(e.target.value)} /></div>
             <div><label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">افتتاحي</label><input type="number" className="w-full p-2.5 bg-white border border-slate-200 rounded-xl outline-none font-bold text-sm text-blue-600" value={newOpeningStock} onChange={e=>setNewOpeningStock(e.target.value)} /></div>
             <div><label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">تاريخ</label><input type="date" className="w-full p-2.5 bg-white border border-slate-200 rounded-xl outline-none font-bold text-sm" value={newOpeningDate} onChange={e=>setNewOpeningDate(e.target.value)} /></div>
             <div><label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">تكلفة</label><input type="number" className="w-full p-2.5 bg-white border border-slate-200 rounded-xl outline-none font-bold text-sm text-orange-600 focus:ring-2 ring-orange-500" value={newCost} onChange={e=>setNewCost(e.target.value)} /></div>
             <div><label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">بيع</label><input type="number" className="w-full p-2.5 bg-white border border-slate-200 rounded-xl outline-none font-bold text-sm text-emerald-600 focus:ring-2 ring-emerald-500" value={newSellingPrice} onChange={e=>setNewSellingPrice(e.target.value)} /></div>
             <div className="flex items-end"><button onClick={handleAddProduct} className="w-full bg-blue-600 text-white p-2.5 rounded-xl text-sm font-black hover:bg-blue-700 shadow-sm transition-colors">إضافة</button></div>
           </div>

           <div className="overflow-x-auto">
             <table className="w-full text-right text-sm">
               <thead className="bg-slate-100 text-slate-500 text-[10px] uppercase tracking-widest font-black">
                 <tr><th className="p-4 border-b rounded-tr-xl">SKU</th><th className="p-4 border-b">المنتج</th><th className="p-4 border-b">افتتاحي</th><th className="p-4 border-b">التاريخ</th><th className="p-4 border-b">التكلفة</th><th className="p-4 border-b">البيع</th><th className="p-4 border-b text-center rounded-tl-xl">إجراء</th></tr>
               </thead>
               <tbody className="divide-y divide-slate-50">
                 {Object.values(productDetails).map(p => (
                   <tr key={p.sku} className="hover:bg-slate-50 transition-colors">
                     <td className="p-4 font-mono font-bold text-slate-800 text-xs">{p.sku}</td>
                     {editingSku === p.sku ? (
                       <>
                         <td className="p-2"><input type="text" className="w-full p-2 text-xs border rounded-lg" value={editData.name} onChange={e=>setEditData({...editData, name: e.target.value})} /></td>
                         <td className="p-2"><input type="number" className="w-20 p-2 text-xs border rounded-lg font-bold text-blue-600" value={editData.openingStock} onChange={e=>setEditData({...editData, openingStock: e.target.value})} /></td>
                         <td className="p-2"><input type="date" className="w-32 p-2 text-xs border rounded-lg" value={editData.openingDate} onChange={e=>setEditData({...editData, openingDate: e.target.value})} /></td>
                         <td className="p-2"><input type="number" className="w-20 p-2 text-xs border rounded-lg font-bold text-orange-600" value={editData.unitCost} onChange={e=>setEditData({...editData, unitCost: e.target.value})} /></td>
                         <td className="p-2"><input type="number" className="w-20 p-2 text-xs border rounded-lg font-bold text-emerald-600" value={editData.sellingPrice} onChange={e=>setEditData({...editData, sellingPrice: e.target.value})} /></td>
                         <td className="p-2 text-center flex justify-center gap-2">
                           <button onClick={handleSaveEditProduct} className="bg-emerald-500 text-white p-2 rounded-lg shadow-sm"><Check size={14}/></button>
                           <button onClick={() => setEditingSku(null)} className="bg-slate-300 text-slate-700 p-2 rounded-lg shadow-sm"><X size={14}/></button>
                         </td>
                       </>
                     ) : (
                       <>
                         <td className="p-4 font-bold text-slate-700">{p.name}</td>
                         <td className="p-4 font-black text-blue-600 text-lg">{p.openingStock}</td>
                         <td className="p-4 text-xs text-slate-500 font-bold">{p.openingDate}</td>
                         <td className="p-4 font-black text-orange-600">{p.unitCost} ﷼</td>
                         <td className="p-4 font-black text-emerald-600">{p.sellingPrice || 0} ﷼</td>
                         <td className="p-4 text-center flex justify-center gap-3">
                           <button onClick={() => { setEditingSku(p.sku); setEditData(p); }} className="text-slate-400 hover:text-blue-500 transition-colors"><Edit2 size={16}/></button>
                           <button onClick={() => handleDeleteProduct(p.sku)} className="text-slate-400 hover:text-rose-500 transition-colors"><Trash2 size={16}/></button>
                         </td>
                       </>
                     )}
                   </tr>
                 ))}
               </tbody>
             </table>
           </div>
        </div>

        {/* --- القنوات التسويقية --- */}
        <div className="bg-white p-6 md:p-8 rounded-3xl border border-slate-100 shadow-sm">
          <h3 className="text-xl font-black text-slate-800 mb-6 flex items-center gap-3 border-b border-slate-100 pb-4"><Target size={24} className="text-indigo-500"/> قنوات التسويق (Channels)</h3>
          <div className="flex flex-wrap gap-3 mb-6">
            {channelsList.map(ch => (
              <div key={ch} className="bg-slate-100 text-slate-700 px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 border border-slate-200">
                {ch} <button onClick={()=>handleRemoveChannel(ch)} className="text-slate-400 hover:text-rose-500"><X size={14}/></button>
              </div>
            ))}
          </div>
          <div className="flex gap-3 max-w-sm">
            <input type="text" placeholder="اسم القناة الجديدة..." className="flex-1 p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none font-bold text-sm focus:ring-2 ring-indigo-500" value={newChannelStr} onChange={e=>setNewChannelStr(e.target.value)}/>
            <button onClick={handleAddChannel} className="bg-indigo-600 text-white px-6 rounded-xl font-black text-sm shadow-sm hover:bg-indigo-700">إضافة</button>
          </div>
        </div>

        {/* --- البكجات --- */}
        <div className="bg-white p-6 md:p-8 rounded-3xl border border-slate-100 shadow-sm relative">
           <h3 className="text-xl font-black text-slate-800 mb-6 flex items-center gap-3 border-b border-slate-100 pb-4">
             <PackageOpen size={24} className="text-purple-500"/> إدارة البكجات والتسعير
           </h3>

           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-10">
             {Object.entries(packages).map(([code, pkg]) => (
               <div key={code} className="bg-white border-2 border-slate-100 rounded-2xl p-6 flex flex-col relative group hover:border-purple-200 transition-colors shadow-sm">
                 <div className="absolute top-4 left-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                   <button onClick={() => { setPkgCode(code); setPkgName(pkg.name); setPkgGroup(pkg.group); setPkgChannel(pkg.channel); setPkgPrice(pkg.price); setPkgItems({...pkg.items}); }} className="text-slate-400 hover:text-blue-500 bg-white rounded-lg p-1.5 shadow-sm border"><Edit2 size={16}/></button>
                   <button onClick={() => handleDeletePackage(code)} className="text-slate-400 hover:text-rose-500 bg-white rounded-lg p-1.5 shadow-sm border"><Trash2 size={16}/></button>
                 </div>

                 <div className="font-black text-lg text-slate-800 mb-2 pr-6 truncate">{pkg.name}</div>
                 <div className="flex items-center gap-3 mb-4">
                    <div className="text-xs text-indigo-600 font-mono bg-indigo-50 px-2.5 py-1 rounded-lg font-bold">{code}</div>
                    <div className="text-[11px] text-emerald-700 font-black bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">{pkg.price} ﷼</div>
                 </div>
                 
                 <div className="space-y-2 mb-5 flex-1">
                   <div className="flex justify-between items-center text-xs font-bold text-slate-500"><span>المجموعة:</span> <span className="text-slate-700 truncate">{pkg.group}</span></div>
                   <div className="flex justify-between items-center text-xs font-bold text-slate-500"><span>القناة:</span> <span className="text-purple-700 bg-purple-50 px-2 py-0.5 rounded-md truncate">{pkg.channel}</span></div>
                 </div>

                 <div className="border-t border-slate-100 pt-4">
                   <div className="flex flex-wrap gap-1.5">
                     {Object.entries(pkg.items).map(([sku, qty]) => (
                       <span key={sku} className="text-[10px] font-black bg-slate-50 border border-slate-200 text-slate-600 px-2 py-1 rounded-lg flex items-center gap-1.5">
                         <span dir="ltr">{sku}</span> <span className="text-indigo-500 text-[10px]">x{qty}</span>
                       </span>
                     ))}
                   </div>
                 </div>
               </div>
             ))}
           </div>

           <div id="package-form" className={`rounded-2xl border-2 p-6 md:p-8 ${Object.keys(packages).includes(pkgCode.trim()) ? 'bg-purple-50 border-purple-200' : 'bg-slate-50 border-slate-200 border-dashed'}`}>
             <h4 className="font-black text-lg mb-6 flex items-center gap-2 text-slate-800"><Plus size={20}/> {Object.keys(packages).includes(pkgCode.trim()) ? 'تحديث بيانات البكج' : 'إنشاء بكج جديد'}</h4>
             <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
               <div><label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">كود البكج</label><input type="text" className="w-full p-3 bg-white border border-slate-200 rounded-xl outline-none font-bold text-sm font-mono" value={pkgCode} onChange={e=>setPkgCode(e.target.value)} disabled={Object.keys(packages).includes(pkgCode.trim())} /></div>
               <div><label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">اسم البكج</label><input type="text" className="w-full p-3 bg-white border border-slate-200 rounded-xl outline-none font-bold text-sm" value={pkgName} onChange={e=>setPkgName(e.target.value)} /></div>
               <div><label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">السعر (للأرباح)</label><input type="number" className="w-full p-3 bg-white border border-slate-200 rounded-xl outline-none font-black text-sm text-emerald-600 focus:ring-2 ring-emerald-500" value={pkgPrice} onChange={e=>setPkgPrice(e.target.value)} /></div>
               <div><label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">المجموعة</label><input type="text" className="w-full p-3 bg-white border border-slate-200 rounded-xl outline-none font-bold text-sm" value={pkgGroup} onChange={e=>setPkgGroup(e.target.value)} /></div>
               <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">القناة / المشهور</label>
                  <input type="text" list="pkg-channels" className="w-full p-3 bg-white border border-slate-200 rounded-xl outline-none font-bold text-sm" value={pkgChannel} onChange={e=>setPkgChannel(e.target.value)} />
                  <datalist id="pkg-channels">{channelsList.map(c=><option key={c} value={c}/>)}</datalist>
               </div>

               <div className="md:col-span-5 bg-white p-5 rounded-2xl border border-slate-200 mt-4 shadow-sm">
                 <label className="block text-xs font-black text-slate-800 mb-4 flex items-center gap-2"><Package size={16}/> محتويات البكج (SKUs):</label>
                 <div className="flex flex-wrap items-center gap-3 mb-5">
                   <select className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold flex-1 outline-none focus:ring-2 ring-indigo-500" value={itemSelectSku} onChange={e=>setItemSelectSku(e.target.value)}>
                     {Object.keys(productDetails).map(sku => <option key={sku} value={sku}>{sku} - {productDetails[sku].name}</option>)}
                   </select>
                   <input type="number" min="1" className="w-24 p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-black text-center outline-none" value={itemSelectQty} onChange={e=>setItemSelectQty(e.target.value)} />
                   <button onClick={handleAddPackageItem} className="bg-slate-800 text-white px-6 py-3 rounded-xl text-sm font-black hover:bg-slate-900 transition-colors shadow-md">إدراج</button>
                 </div>
                 {Object.keys(pkgItems).length > 0 && (
                   <div className="flex flex-wrap gap-2 pt-4 border-t border-slate-100">
                     {Object.entries(pkgItems).map(([sku, qty]) => (
                       <div key={sku} className="flex items-center gap-2 bg-indigo-50 text-indigo-900 px-3 py-2 rounded-xl text-xs font-bold border border-indigo-100">
                         <span dir="ltr">{sku}</span> <span className="bg-white px-2 py-0.5 rounded-lg text-indigo-500 shadow-sm">x{qty}</span>
                         <button onClick={()=>handleRemovePackageItem(sku)} className="text-indigo-300 hover:text-rose-500 transition-colors ml-1"><X size={14}/></button>
                       </div>
                     ))}
                   </div>
                 )}
               </div>

               <div className="md:col-span-5 mt-4 flex gap-3">
                 <button onClick={handleAddPackage} className="flex-1 bg-purple-600 text-white p-4 rounded-xl font-black text-base shadow-md hover:bg-purple-700 transition-colors">حفظ واعتماد البكج</button>
                 {Object.keys(packages).includes(pkgCode.trim()) && (
                   <button onClick={() => {setPkgCode(''); setPkgName(''); setPkgGroup(''); setPkgChannel(''); setPkgPrice(''); setPkgItems({});}} className="bg-white text-slate-700 p-4 rounded-xl font-bold border border-slate-200 hover:bg-slate-50 transition-colors">إلغاء التعديل</button>
                 )}
               </div>
             </div>
           </div>
        </div>
      </div>
    );
  };

  const UsersManagementTab = () => {
    const [newUserEmail, setNewUserEmail] = useState('');
    const [newUserRole, setNewUserRole] = useState('viewer');

    const handleAddPermission = async (e) => {
      e.preventDefault(); if(!newUserEmail.trim()) return;
      setIsSyncing(true);
      try {
        await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'permissions'), { ...permissions, [newUserEmail.trim().toLowerCase()]: newUserRole });
        setNewUserEmail('');
      } catch(e) { alert('خطأ'); } finally { setIsSyncing(false); }
    };

    const handleRemovePermission = async (emailToRemove) => {
      if(emailToRemove === user.email) return alert('لا يمكنك إزالة نفسك!');
      if(safeConfirm(`حذف ${emailToRemove}؟`)) {
        const newPerms = { ...permissions }; delete newPerms[emailToRemove];
        setIsSyncing(true);
        try { await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'permissions'), newPerms); } 
        catch(e) { console.error(e); } finally { setIsSyncing(false); }
      }
    };

    return (
      <div className="space-y-6 animate-in fade-in max-w-4xl mx-auto">
        <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm relative">
           {isSyncing && <div className="absolute inset-0 bg-white/50 backdrop-blur-sm flex items-center justify-center z-10 rounded-3xl"><Loader2 className="animate-spin text-blue-600" size={40} /></div>}
           <div className="flex items-center gap-4 mb-8 border-b border-slate-100 pb-6">
             <div className="p-4 bg-blue-50 text-blue-600 rounded-2xl"><Shield size={28} /></div>
             <div>
               <h3 className="text-2xl font-black text-slate-800">صلاحيات الوصول (Access Control)</h3>
               <p className="text-sm text-slate-500 mt-1">تأكد من إنشاء الحسابات أولاً في منصة Firebase قبل منحها الصلاحيات هنا.</p>
             </div>
           </div>

           <form onSubmit={handleAddPermission} className="flex flex-col md:flex-row gap-4 mb-10 bg-slate-50 p-6 rounded-2xl border border-slate-100">
             <div className="flex-1"><label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">البريد الإلكتروني</label><input type="email" required placeholder="emp@domain.com" className="w-full p-3 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 ring-blue-500 text-sm text-left font-mono font-bold" dir="ltr" value={newUserEmail} onChange={e => setNewUserEmail(e.target.value)} /></div>
             <div className="md:w-64"><label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">الرتبة (Role)</label><select className="w-full p-3 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 ring-blue-500 text-sm font-bold" value={newUserRole} onChange={e => setNewUserRole(e.target.value)}><option value="super_admin">Super Admin (كامل)</option><option value="admin">Admin (بدون النظام والقرارات)</option><option value="editor">Editor (إدخال فقط)</option><option value="viewer">Viewer (لوحة فقط)</option></select></div>
             <div className="flex items-end"><button type="submit" disabled={isSyncing} className="w-full md:w-auto bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-xl font-black text-sm transition-colors shadow-md">منح الصلاحية</button></div>
           </form>

           <div className="overflow-x-auto">
             <table className="w-full text-right text-sm">
               <thead className="bg-slate-100 text-slate-500 text-xs uppercase tracking-widest">
                 <tr><th className="p-4 border-b rounded-tr-xl">المستخدم</th><th className="p-4 border-b">الرتبة</th><th className="p-4 border-b text-center rounded-tl-xl">إجراء</th></tr>
               </thead>
               <tbody className="divide-y divide-slate-50">
                 {Object.entries(permissions).map(([email, role]) => (
                   <tr key={email} className="hover:bg-slate-50 transition-colors">
                     <td className="p-4 font-mono font-bold text-slate-700 text-xs" dir="ltr">{email} {email === user.email && <span className="text-[10px] text-emerald-500 bg-emerald-50 px-2 py-0.5 rounded-lg ml-2 border border-emerald-100">أنت</span>}</td>
                     <td className="p-4"><span className={`px-3 py-1.5 rounded-lg text-[10px] font-black ${role==='super_admin'?'bg-purple-100 text-purple-700':role==='admin'?'bg-blue-100 text-blue-700':role==='editor'?'bg-emerald-100 text-emerald-700':'bg-slate-200 text-slate-700'}`}>{role}</span></td>
                     <td className="p-4 text-center"><button onClick={() => handleRemovePermission(email)} className="text-slate-300 hover:text-rose-500 transition-colors"><Trash2 size={18} /></button></td>
                   </tr>
                 ))}
               </tbody>
             </table>
           </div>
        </div>
      </div>
    );
  };

  // --- 6. AUTH GUARDS & RENDER ---

  if (authError) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 font-sans" dir="rtl">
        <div className="bg-white p-8 rounded-3xl shadow-xl max-w-sm w-full text-center border border-slate-100">
           <AlertTriangle size={48} className="text-rose-500 mx-auto mb-4" />
           <h2 className="font-black text-xl text-slate-800 mb-2">تنبيه أمان</h2>
           <p className="text-slate-500 text-sm">{authError}</p>
        </div>
      </div>
    );
  }

  if (isLoading || (user && (!isSettingsLoaded || !isPermissionsLoaded))) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center font-sans text-indigo-600 gap-4" dir="rtl">
        <Loader2 className="animate-spin" size={40} /><p className="font-bold text-sm">تهيئة برج المراقبة...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 font-sans" dir="rtl">
        <div className="bg-white p-8 md:p-10 rounded-[2rem] shadow-xl w-full max-w-md border border-slate-100">
          <div className="w-16 h-16 bg-indigo-600 rounded-2xl mx-auto mb-6 flex items-center justify-center shadow-lg shadow-indigo-200">
            <Activity size={32} className="text-white"/>
          </div>
          <h2 className="text-2xl font-black text-center text-slate-800 mb-1">Asparkle OS</h2>
          <p className="text-center text-slate-500 mb-8 text-xs font-bold uppercase tracking-widest">Business Control Tower</p>
          <form onSubmit={handleLogin} className="space-y-4">
            {loginError && <div className="bg-rose-50 text-rose-600 p-3 rounded-xl text-xs font-bold text-center border border-rose-100">{loginError}</div>}
            <input type="email" required placeholder="البريد الإلكتروني" className="w-full p-3.5 bg-slate-50 rounded-xl outline-none focus:ring-2 ring-indigo-500 text-sm font-mono text-left" dir="ltr" value={email} onChange={e=>setEmail(e.target.value)} />
            <input type="password" required placeholder="كلمة المرور" className="w-full p-3.5 bg-slate-50 rounded-xl outline-none focus:ring-2 ring-indigo-500 text-sm font-mono text-left" dir="ltr" value={password} onChange={e=>setPassword(e.target.value)} />
            <button type="submit" disabled={isLoggingIn} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold p-3.5 rounded-xl transition-all shadow-md shadow-indigo-200 mt-2">تسجيل الدخول</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800" dir="rtl">
      <nav className="bg-white border-b border-slate-200 sticky top-0 z-50 shadow-sm">
        <div className="max-w-[1600px] mx-auto px-4 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-indigo-600 rounded-xl flex items-center justify-center shadow-md shadow-indigo-200">
                <Activity size={20} className="text-white"/>
              </div>
              <span className="font-black text-xl text-slate-800 tracking-tight hidden sm:block">Asparkle<span className="text-indigo-600">OS</span></span>
            </div>
            
            <div className="flex-1 flex justify-center overflow-x-auto scrollbar-hide px-4 mask-edges space-x-1 space-x-reverse">
              {navItems.filter(item => item.roles.includes(currentUserRole)).map(item => (
                <button key={item.id} onClick={() => setActiveTab(item.id)} className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${activeTab === item.id ? 'bg-indigo-50 text-indigo-700' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'}`}>
                  {item.icon} <span className="hidden lg:inline">{item.label}</span>
                </button>
              ))}
            </div>

            <div className="flex items-center gap-4 border-r border-slate-100 pr-4">
              <div className="hidden md:flex flex-col items-end">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{currentUserRole}</span>
                <span className="text-[10px] font-bold text-emerald-500 flex items-center gap-1"><Cloud size={10}/> متصل</span>
              </div>
              <button onClick={handleLogout} className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-colors"><CloudOff size={20}/></button>
            </div>
          </div>
        </div>
      </nav>

      <div className="md:hidden fixed bottom-0 w-full bg-white border-t border-slate-200 z-50 px-2 py-2 flex justify-between overflow-x-auto scrollbar-hide shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">
        {navItems.filter(item => item.roles.includes(currentUserRole)).slice(0,5).map(item => (
          <button key={item.id} onClick={() => setActiveTab(item.id)} className={`flex flex-col items-center gap-1 p-2 min-w-[64px] rounded-xl transition-colors ${activeTab === item.id ? 'text-indigo-600 bg-indigo-50' : 'text-slate-400'}`}>
            {item.icon} <span className="text-[9px] font-bold">{item.label.split(' ')[0]}</span>
          </button>
        ))}
      </div>

      <main className="max-w-[1600px] mx-auto px-4 lg:px-8 py-8 mb-20 md:mb-8">
        {activeTab === 'dashboard' && <DashboardTab />}
        {activeTab === 'movements' && hasAccess(['super_admin', 'admin', 'editor']) && <><UploadTab/><ManualMovementForm/></>}
        {activeTab === 'orders' && hasAccess(['super_admin', 'admin', 'editor']) && <OrdersAndCRMTab mode="orders"/>}
        {activeTab === 'crm' && hasAccess(['super_admin', 'admin']) && <OrdersAndCRMTab mode="crm"/>}
        {activeTab === 'adcosts' && hasAccess(['super_admin', 'admin']) && <AdCostsTab />}
        {activeTab === 'decision_center' && hasAccess(['super_admin']) && <DecisionCenterTab />}
        {activeTab === 'profit_simulator' && hasAccess(['super_admin']) && <ProfitSimulatorTab />}
        {activeTab === 'definitions' && hasAccess(['super_admin', 'admin']) && <DefinitionsTab />}
        {activeTab === 'users' && hasAccess(['super_admin']) && <UsersManagementTab />}
        {activeTab === 'data_admin' && hasAccess(['super_admin']) && <DataAdminTab />}
      </main>
      
      <style dangerouslySetInnerHTML={{__html: `@import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800;900&display=swap'); body { font-family: 'Tajawal', sans-serif; background-color: #f8fafc; } .scrollbar-hide::-webkit-scrollbar { display: none; } .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; } .custom-scrollbar::-webkit-scrollbar { width: 4px; } .custom-scrollbar::-webkit-scrollbar-thumb { background-color: #cbd5e1; border-radius: 4px; } .mask-edges { -webkit-mask-image: linear-gradient(to right, transparent, black 5%, black 95%, transparent); mask-image: linear-gradient(to right, transparent, black 5%, black 95%, transparent); }`}} />
    </div>
  );
}
