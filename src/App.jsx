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
import { 
  getFirestore, collection, doc, setDoc, deleteDoc, onSnapshot, writeBatch,
  query, orderBy, limit, getDocs 
} from 'firebase/firestore';

// --- Error Boundary ---
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Application crash:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6" dir="rtl">
          <div className="bg-white rounded-3xl shadow-xl border border-slate-100 p-8 max-w-lg w-full text-center">
            <div className="mx-auto bg-rose-100 text-rose-600 w-16 h-16 flex items-center justify-center rounded-2xl mb-4"><ShieldAlert size={32}/></div>
            <h2 className="text-2xl font-black text-rose-600 mb-3">حدث خطأ في النظام</h2>
            <p className="text-slate-600 mb-4 text-sm font-bold">تم التقاط الخطأ وحماية النظام من الانهيار.</p>
            <pre className="text-xs bg-slate-50 border border-slate-200 rounded-xl p-4 overflow-auto text-left text-slate-500 font-mono mb-6" dir="ltr">
              {this.state.error?.message || 'Unknown error'}
            </pre>
            <button
              onClick={() => window.location.reload()}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-4 rounded-xl font-black transition-colors"
            >
              إعادة تحميل الصفحة
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

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

function App() {
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
  
  // Data States
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

  // Fetch All Core Data with Limits for performance
  useEffect(() => {
    if (!user) return;
    const loadCollection = (colName, setter, max = 2000) => {
      const q = query(
        collection(db, 'artifacts', appId, 'public', 'data', colName),
        orderBy('timestamp', 'desc'),
        limit(max)
      );
      return onSnapshot(q, (snap) => {
        const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        // sorting desc already handled by query, but we can ensure date sorting if needed
        setter(data);
      }, (error) => {
        console.error(`Error loading ${colName}:`, error);
      });
    };

    const unsubMov = loadCollection('movements', setMovements, 2000);
    const unsubAd = loadCollection('adcosts', setAdCosts, 1000);
    const unsubOrd = loadCollection('orders', setOrders, 2000);

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

  // --- 4. DATA MEMOS (Pre-processing & Protection) ---
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
  const ordersInPeriod = useMemo(() => orders.filter(o => o.date >= startDate && o.date <= endDate), [orders, startDate, endDate]);
  
  const stockAsOfDate = useMemo(() => {
    let stock = {};
    Object.values(productDetails).forEach(p => {
      if (!p?.sku) return;
      stock[p.sku] = parseInt(p.openingStock) || 0;
    });

    parsedMovements.forEach(mov => {
      if (mov.date > endDate) return;
      const isOut = MOVEMENT_TYPES.find(t => t.id === mov.type)?.type === 'out';
      const multiplier = isOut ? -1 : 1;
      
      if (mov.level === 'منتج') {
        const p = productDetails[mov.code];
        if (!p) return; 
        if (mov.date >= p.openingDate) stock[mov.code] += (mov.qty * multiplier);
      } else if (mov.level === 'بكج') {
        const pkg = packages[mov.code];
        if (!pkg?.items) return;
        Object.entries(pkg.items).forEach(([sku, reqQty]) => {
          const p = productDetails[sku];
          if (!p) return;
          if (mov.date >= p.openingDate) stock[sku] += (mov.qty * reqQty * multiplier);
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

      if(pkg.items) {
        Object.entries(pkg.items).forEach(([sku, reqQty]) => {
          const availableSkus = stockAsOfDate[sku] || 0;
          const possibleFromThisSku = Math.floor(availableSkus / reqQty);
          
          if (possibleFromThisSku < maxPossible) {
            maxPossible = possibleFromThisSku;
            limitingSku = sku;
          }
        });
      }
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

      if (m.level === 'بكج') {
        const pkg = packages[m.code];
        if (!pkg) return;
        channel = pkg.channel || 'غير محدد';
        revenue = (pkg.price || 0) * m.qty;
        let pkgCogs = 0;
        if(pkg.items) {
          Object.entries(pkg.items).forEach(([sku, reqQty]) => { 
            pkgCogs += (productDetails[sku]?.unitCost || 0) * reqQty; 
          });
        }
        cost = pkgCogs * m.qty;
      } else if (m.level === 'منتج') {
        const p = productDetails[m.code];
        if (!p) return;
        revenue = (p.sellingPrice || 0) * m.qty;
        cost = (p.unitCost || 0) * m.qty;
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
    Object.values(productDetails).forEach(p => {
      if(!p?.sku) return;
      result[p.sku] = { name: p.name, sales: 0, revenue: 0, cost: 0, profit: 0 };
    });
    movementsInPeriod.forEach(m => {
      if (!m.isSale && !m.isReturn) return;
      const multiplier = m.isSale ? 1 : -1;
      if (m.level === 'منتج') {
        const p = productDetails[m.code];
        if (!p || !result[m.code]) return;
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
      const c = cusMap[o.mobile];
      c.orderCount += 1;
      c.totalSpend += parseFloat(o.amount) || 0;
      if (o.date && (!c.lastOrder || o.date > c.lastOrder)) c.lastOrder = o.date;
      if (o.date && (!c.firstOrder || o.date < c.firstOrder)) c.firstOrder = o.date;
      
      if (!c.channels) c.channels = {};
      if (o.channel) c.channels[o.channel] = (c.channels[o.channel] || 0) + 1;
    });
    
    return Object.values(cusMap).map(c => {
      const daysSince = c.lastOrder ? Math.floor((new Date() - new Date(c.lastOrder)) / (1000*60*60*24)) : 999;
      let segment = 'نشط';
      if (c.totalSpend >= 1000 || c.orderCount >= 3) segment = 'VIP 🌟';
      else if (daysSince > 60) segment = 'منقطع ⚠️';
      else if (daysSince > 30) segment = 'معرض للانقطاع 🟠';
      
      const favoriteChannel = Object.entries(c.channels || {}).sort((a, b) => b[1] - a[1])[0]?.[0] || 'غير محدد';
      const averageOrderValue = c.orderCount > 0 ? c.totalSpend / c.orderCount : 0;
      
      return { ...c, daysSince, segment, favoriteChannel, averageOrderValue };
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
    const topProduct = [...productStats].find(p => p.sales > 0);
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
        if(!p?.sku) return;
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
             <div className="flex-1 space-y-4 overflow-y-auto custom-scrollbar pr-2 max-h-[250px]">
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
        
        // خوارزمية متقدمة لقراءة التاريخ بجميع أشكاله
        const normalizeDate = (value) => {
          if (!value) return todayStr;

          if (typeof value === 'number' && window.XLSX) {
            try {
              const date = window.XLSX.SSF.parse_date_code(value);
              if (date) {
                const mm = String(date.m).padStart(2, '0');
                const dd = String(date.d).padStart(2, '0');
                return `${date.y}-${mm}-${dd}`;
              }
            } catch (e) {
              console.error(e);
            }
          }

          const strVal = String(value).trim();

          const isoMatch = strVal.match(/^(\d{4})-(\d{2})-(\d{2})$/);
          if (isoMatch) return strVal;

          const slashMatch = strVal.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
          if (slashMatch) {
            const dd = String(slashMatch[1]).padStart(2, '0');
            const mm = String(slashMatch[2]).padStart(2, '0');
            const yyyy = slashMatch[3];
            return `${yyyy}-${mm}-${dd}`;
          }

          const parsed = new Date(strVal);
          if (!isNaN(parsed.getTime())) {
            return parsed.toISOString().split('T')[0];
          }

          return todayStr;
        };

        reader.onload = async (event) => {
          const data = new Uint8Array(event.target.result);
          const workbook = XLSX.read(data, { type: 'array' });
          const rows = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { header: 1 });
          if(rows.length < 2) return alert('ملف غير صالح');

          const headers = rows[0].map(h => String(h || ''));
          const dateCol = headers.findIndex(h => h.includes('التاريخ') || h.includes('تاريخ الطلب') || h.includes('Date') || h.includes('date'));
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

            const orderDate = dateCol !== -1 ? normalizeDate(row[dateCol]) : todayStr;

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
            if (!mappedCode) {
              const firstPackageCode = Object.keys(packages)[0];
              const firstProductCode = Object.keys(productDetails)[0];
              mappedCode = firstPackageCode || firstProductCode;
            }
            if (!mappedCode) continue; // الحماية من الـ Bugs الصامتة

            let movType = 'بيع آلي (عبر الربط)'; 
            if (importMode === 'sales') {
               if (paymentStr.includes('تمارا') || paymentStr.includes('تابي')) movType = 'بيع (تمارا)';
               else if (paymentStr.includes('عند الاستلام') || paymentStr.includes('الدفع عند الاستلام')) movType = 'بيع (دفع عند الاستلام)';
               else if (paymentStr !== '') movType = 'بيع (دفع إلكتروني)';
            } else { movType = 'مرتجع (إلغاء رغبة العميل)'; }

            const channelName = mappedLevel === 'بكج' ? (packages[mappedCode]?.channel || 'عضوي') : 'المنتجات الفردية';
            
            parsedOrders.push({ date: orderDate, reference: orderId, customerName, mobile, amount, channel: channelName, status: importMode==='sales'?'مكتمل':'مرتجع' });
            parsedMovementsLocal.push({ date: orderDate, level: mappedLevel, code: mappedCode, type: movType, quantity: qty, reference: orderId, note: importMode === 'sales' ? 'استيراد مبيعات' : 'استيراد رجيع' });
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
        const dbOrderRefs = new Set([ ...orders.map(o => o.reference) ]);
        
        const uniqueOrders = [];
        const seenNewRefs = new Set(); 

        for (const o of importPreview.orders) {
          if (dbOrderRefs.has(o.reference) || seenNewRefs.has(o.reference)) continue;
          seenNewRefs.add(o.reference);
          uniqueOrders.push(o);
        }

        const uniqueMovements = [];
        for (const m of importPreview.movements) {
          if (dbOrderRefs.has(m.reference)) continue;
          uniqueMovements.push(m);
        }

        const skippedOrders = importPreview.orders.length - uniqueOrders.length;
        const skippedMovements = importPreview.movements.length - uniqueMovements.length;

        const baseNow = Date.now();
        for (let i = 0; i < uniqueOrders.length; i += batchSize) {
          const chunk = uniqueOrders.slice(i, i + batchSize);
          const batch = writeBatch(db);
          chunk.forEach((ord, index) => {
            const now = baseNow + i + index; 
            const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'orders', `ord_${now}_${Math.random().toString(36).slice(2, 6)}`);
            batch.set(docRef, { ...ord, timestamp: now });
          });
          await batch.commit();
        }

        for (let i = 0; i < uniqueMovements.length; i += batchSize) {
          const chunk = uniqueMovements.slice(i, i + batchSize);
          const batch = writeBatch(db);
          chunk.forEach((mov, index) => {
            const now = baseNow + i + index; 
            const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'movements', `mov_${now}_${Math.random().toString(36).slice(2, 6)}`);
            batch.set(docRef, { ...mov, timestamp: now });
          });
          await batch.commit();
        }
        
        alert(`تم رفع ${uniqueOrders.length} طلب و ${uniqueMovements.length} حركة بنجاح.\nتم تجاهل ${skippedOrders} طلب مكرر و ${skippedMovements} حركة مرتبطة بطلبات مكررة.`); 
        setImportPreview(null);
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
                <span className="block text-4xl font-black text-indigo-600 mb-2">{importPreview.orders.length}</span><span className="text-sm font-bold text-slate-500">طلب في الملف</span>
              </div>
              <div className="bg-white p-6 rounded-2xl flex-1 text-center shadow-sm border border-indigo-100/50">
                <span className="block text-4xl font-black text-emerald-600 mb-2">{importPreview.movements.length}</span><span className="text-sm font-bold text-slate-500">حركة مخزون محتملة</span>
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

  const OrdersTab = () => {
    const [searchTerm, setSearchTerm] = useState('');
    const [channelFilter, setChannelFilter] = useState('all');
    const [statusFilter, setStatusFilter] = useState('all');
    const [ordersPage, setOrdersPage] = useState(1);
    const ordersPageSize = 50;
  
    const orderChannels = useMemo(() => {
      return Array.from(new Set(orders.map(o => o.channel).filter(Boolean)));
    }, [orders]);
  
    const filteredOrders = useMemo(() => {
      let data = [...orders];
  
      if (searchTerm.trim()) {
        const q = searchTerm.trim();
        data = data.filter(o =>
          (o.reference || '').includes(q) ||
          (o.customerName || '').includes(q) ||
          (o.mobile || '').includes(q)
        );
      }
  
      if (channelFilter !== 'all') {
        data = data.filter(o => o.channel === channelFilter);
      }
  
      if (statusFilter !== 'all') {
        data = data.filter(o => o.status === statusFilter);
      }
  
      data.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
      return data;
    }, [orders, searchTerm, channelFilter, statusFilter]);
  
    const ordersTotalPages = Math.max(1, Math.ceil(filteredOrders.length / ordersPageSize));
  
    const paginatedOrders = useMemo(() => {
      const start = (ordersPage - 1) * ordersPageSize;
      return filteredOrders.slice(start, start + ordersPageSize);
    }, [filteredOrders, ordersPage]);
  
    useEffect(() => {
      setOrdersPage(1);
    }, [searchTerm, channelFilter, statusFilter]);
  
    const exportOrdersToExcel = async () => {
      try {
        const XLSX = await loadXLSX();
  
        const rows = filteredOrders.map(o => ({
          'رقم الطلب': o.reference,
          'التاريخ': o.date,
          'اسم العميل': o.customerName,
          'الجوال': o.mobile,
          'القناة': o.channel,
          'المبلغ': o.amount,
          'الحالة': o.status,
        }));
  
        const worksheet = XLSX.utils.json_to_sheet(rows);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Orders');
        XLSX.writeFile(workbook, `Orders_Report_${endDate}.xlsx`);
      } catch (e) {
        console.error(e);
        alert('تعذر تصدير التقرير');
      }
    };
  
    return (
      <div className="space-y-8 animate-in fade-in">
        <div className="bg-white rounded-[2rem] shadow-sm border border-slate-100 p-8">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6 mb-8">
            <div>
              <h2 className="text-2xl font-black text-slate-800 flex items-center gap-3">
                <ShoppingBag className="text-indigo-500" size={28} />
                الطلبات
              </h2>
              <p className="text-sm text-slate-500 mt-2">
                عرض جميع الطلبات مع الفلترة والتصدير وتقسيم الصفحات.
              </p>
            </div>
  
            <button
              onClick={exportOrdersToExcel}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-black px-5 py-3 rounded-xl flex items-center gap-2 shadow-sm"
            >
              <Download size={18} />
              تصدير الطلبات
            </button>
          </div>
  
          <div className="bg-slate-50 rounded-3xl p-6 border border-slate-100 mb-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="relative">
                <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input
                  type="text"
                  placeholder="بحث برقم الطلب أو الاسم أو الجوال..."
                  className="w-full pl-4 pr-12 py-3 rounded-2xl border border-slate-200 text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none bg-white shadow-sm"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
  
              <select
                className="w-full py-3 px-4 rounded-2xl border border-slate-200 text-sm font-bold outline-none bg-white shadow-sm"
                value={channelFilter}
                onChange={(e) => setChannelFilter(e.target.value)}
              >
                <option value="all">كل القنوات</option>
                {orderChannels.map(ch => (
                  <option key={ch} value={ch}>{ch}</option>
                ))}
              </select>
  
              <select
                className="w-full py-3 px-4 rounded-2xl border border-slate-200 text-sm font-bold outline-none bg-white shadow-sm"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="all">كل الحالات</option>
                <option value="مكتمل">مكتمل</option>
                <option value="مرتجع">مرتجع</option>
              </select>
            </div>
          </div>
  
          <div className="overflow-x-auto rounded-3xl border border-slate-100 max-h-[70vh] overflow-y-auto custom-scrollbar">
            <table className="w-full text-right text-sm bg-white">
              <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-widest font-bold sticky top-0 z-10 shadow-sm">
                <tr>
                  <th className="p-5 border-b">رقم الطلب</th>
                  <th className="p-5 border-b">التاريخ</th>
                  <th className="p-5 border-b">العميل</th>
                  <th className="p-5 border-b">الجوال</th>
                  <th className="p-5 border-b">القناة</th>
                  <th className="p-5 border-b">المبلغ</th>
                  <th className="p-5 border-b">الحالة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedOrders.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="p-12 text-center text-slate-400 font-bold">
                      لا توجد نتائج مطابقة
                    </td>
                  </tr>
                ) : (
                  paginatedOrders.map((o, i) => (
                    <tr key={`${o.reference}-${i}`} className="hover:bg-indigo-50/30 transition-colors">
                      <td className="p-5 font-mono text-slate-500 text-xs">{o.reference}</td>
                      <td className="p-5 text-xs text-slate-500 font-bold">{o.date}</td>
                      <td className="p-5 font-black text-slate-800">{o.customerName}</td>
                      <td className="p-5 text-slate-500 font-mono text-xs" dir="ltr">{o.mobile}</td>
                      <td className="p-5">
                        <span className="bg-slate-100 text-slate-700 px-3 py-1.5 rounded-lg text-[10px] font-bold">
                          {o.channel}
                        </span>
                      </td>
                      <td className="p-5 font-black text-emerald-600">
                        {parseFloat(o.amount || 0).toLocaleString()} ﷼
                      </td>
                      <td className="p-5">
                        <span className={`px-3 py-1.5 rounded-lg text-[10px] font-bold ${
                          o.status === 'مكتمل'
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-rose-100 text-rose-700'
                        }`}>
                          {o.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
  
          <div className="flex items-center justify-between mt-6">
            <button
              onClick={() => setOrdersPage(p => Math.max(1, p - 1))}
              disabled={ordersPage === 1}
              className="px-4 py-2 rounded-xl border border-slate-200 bg-white font-bold disabled:opacity-50"
            >
              السابق
            </button>
  
            <span className="text-sm font-bold text-slate-500">
              صفحة {ordersPage} من {ordersTotalPages}
            </span>
  
            <button
              onClick={() => setOrdersPage(p => Math.min(ordersTotalPages, p + 1))}
              disabled={ordersPage === ordersTotalPages}
              className="px-4 py-2 rounded-xl border border-slate-200 bg-white font-bold disabled:opacity-50"
            >
              التالي
            </button>
          </div>
        </div>
      </div>
    );
  };

  const CRMTab = () => {
    const [searchTerm, setSearchTerm] = useState('');
    const [segmentFilter, setSegmentFilter] = useState('all');
    const [channelFilter, setChannelFilter] = useState('all');
    const [sortBy, setSortBy] = useState('totalSpend');
    const [crmPage, setCrmPage] = useState(1);
    const crmPageSize = 50;

    const enhancedCustomers = useMemo(() => {
      const cusMap = {};

      orders.forEach((o) => {
        if (!o.mobile) return;

        if (!cusMap[o.mobile]) {
          cusMap[o.mobile] = {
            name: o.customerName || 'عميل',
            mobile: o.mobile,
            orderCount: 0,
            totalSpend: 0,
            firstOrder: o.date || '',
            lastOrder: o.date || '',
            city: o.city || '',
            channels: {},
          };
        }

        const c = cusMap[o.mobile];
        c.orderCount += 1;
        c.totalSpend += parseFloat(o.amount) || 0;

        if (o.date && (!c.firstOrder || o.date < c.firstOrder)) c.firstOrder = o.date;
        if (o.date && (!c.lastOrder || o.date > c.lastOrder)) c.lastOrder = o.date;

        if (o.channel) {
          c.channels[o.channel] = (c.channels[o.channel] || 0) + 1;
        }
      });

      return Object.values(cusMap).map((c) => {
        const daysSince = c.lastOrder
          ? Math.floor((new Date() - new Date(c.lastOrder)) / (1000 * 60 * 60 * 24))
          : 999;

        const favoriteChannel =
          Object.entries(c.channels || {}).sort((a, b) => b[1] - a[1])[0]?.[0] || 'غير محدد';

        let segment = 'نشط';
        if (c.totalSpend >= 1000 || c.orderCount >= 3) segment = 'VIP 🌟';
        else if (daysSince > 60) segment = 'منقطع ⚠️';
        else if (daysSince > 30) segment = 'معرض للانقطاع 🟠';

        return {
          ...c,
          daysSince,
          favoriteChannel,
          averageOrderValue: c.orderCount > 0 ? c.totalSpend / c.orderCount : 0,
          segment,
        };
      });
    }, [orders]);

    const crmSummary = useMemo(() => {
      const totalCustomers = enhancedCustomers.length;
      const vip = enhancedCustomers.filter(c => c.segment.includes('VIP')).length;
      const active = enhancedCustomers.filter(c => c.segment === 'نشط').length;
      const atRisk = enhancedCustomers.filter(c => c.segment.includes('معرض')).length;
      const churned = enhancedCustomers.filter(c => c.segment.includes('منقطع')).length;
      const totalRevenue = enhancedCustomers.reduce((sum, c) => sum + c.totalSpend, 0);

      return { totalCustomers, vip, active, atRisk, churned, totalRevenue };
    }, [enhancedCustomers]);

    const crmChannels = useMemo(() => {
      const set = new Set(
        enhancedCustomers
          .map(c => c.favoriteChannel)
          .filter(Boolean)
      );
      return Array.from(set);
    }, [enhancedCustomers]);

    const filteredCRM = useMemo(() => {
      let data = [...enhancedCustomers];

      if (searchTerm.trim()) {
        const q = searchTerm.trim();
        data = data.filter(c =>
          (c.name || '').includes(q) ||
          (c.mobile || '').includes(q) ||
          (c.city || '').includes(q)
        );
      }

      if (segmentFilter !== 'all') {
        data = data.filter(c => c.segment === segmentFilter);
      }

      if (channelFilter !== 'all') {
        data = data.filter(c => c.favoriteChannel === channelFilter);
      }

      data.sort((a, b) => {
        if (sortBy === 'totalSpend') return b.totalSpend - a.totalSpend;
        if (sortBy === 'orderCount') return b.orderCount - a.orderCount;
        if (sortBy === 'lastOrder') return (b.lastOrder || '').localeCompare(a.lastOrder || '');
        if (sortBy === 'averageOrderValue') return b.averageOrderValue - a.averageOrderValue;
        return 0;
      });

      return data;
    }, [enhancedCustomers, searchTerm, segmentFilter, channelFilter, sortBy]);

    const crmTotalPages = Math.max(1, Math.ceil(filteredCRM.length / crmPageSize));

    const paginatedCRM = useMemo(() => {
      const start = (crmPage - 1) * crmPageSize;
      return filteredCRM.slice(start, start + crmPageSize);
    }, [filteredCRM, crmPage]);

    useEffect(() => {
      setCrmPage(1);
    }, [searchTerm, segmentFilter, channelFilter, sortBy]);

    const topSpenders = useMemo(() => filteredCRM.slice(0, 5), [filteredCRM]);

    const exportCRMToExcel = async () => {
      try {
        const XLSX = await loadXLSX();

        const rows = filteredCRM.map(c => ({
          'اسم العميل': c.name,
          'الجوال': c.mobile,
          'المدينة': c.city || '',
          'عدد الطلبات': c.orderCount,
          'إجمالي الإنفاق': c.totalSpend,
          'متوسط السلة': c.averageOrderValue.toFixed(2),
          'أول طلب': c.firstOrder || '',
          'آخر طلب': c.lastOrder || '',
          'منذ آخر طلب (يوم)': c.daysSince,
          'التصنيف': c.segment,
          'القناة المفضلة': c.favoriteChannel || '',
        }));

        const worksheet = XLSX.utils.json_to_sheet(rows);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'CRM');
        XLSX.writeFile(workbook, `CRM_Report_${endDate}.xlsx`);
      } catch (e) {
        console.error(e);
        alert('تعذر تصدير التقرير');
      }
    };

    return (
      <div className="space-y-8 animate-in fade-in">
        <div className="bg-white rounded-[2rem] shadow-sm border border-slate-100 p-8">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6 mb-8">
            <div>
              <h2 className="text-2xl font-black text-slate-800 flex items-center gap-3">
                <UsersRound className="text-indigo-500" size={28} />
                العملاء (CRM)
              </h2>
              <p className="text-sm text-slate-500 mt-2">
                لوحة CRM احترافية لإدارة العملاء، الشرائح، والتقارير.
              </p>
            </div>

            <button
              onClick={exportCRMToExcel}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-black px-5 py-3 rounded-xl flex items-center gap-2 shadow-sm"
            >
              <Download size={18} />
              تصدير تقرير CRM
            </button>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-4 mb-8">
            {[
              { label: 'إجمالي العملاء', value: crmSummary.totalCustomers, color: 'text-slate-800' },
              { label: 'VIP', value: crmSummary.vip, color: 'text-amber-600' },
              { label: 'نشط', value: crmSummary.active, color: 'text-emerald-600' },
              { label: 'معرض للانقطاع', value: crmSummary.atRisk, color: 'text-orange-600' },
              { label: 'منقطع', value: crmSummary.churned, color: 'text-rose-600' },
              { label: 'إجمالي الإنفاق', value: `${crmSummary.totalRevenue.toLocaleString()} ﷼`, color: 'text-indigo-600' },
            ].map((card, i) => (
              <div key={i} className="bg-slate-50 rounded-2xl p-5 border border-slate-100">
                <p className="text-xs font-black text-slate-400 mb-2">{card.label}</p>
                <h3 className={`text-2xl font-black ${card.color}`}>{card.value}</h3>
              </div>
            ))}
          </div>

          {/* Filters */}
          <div className="bg-slate-50 rounded-3xl p-6 border border-slate-100 mb-8">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
              <div className="relative">
                <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input
                  type="text"
                  placeholder="ابحث بالاسم أو الجوال أو المدينة..."
                  className="w-full pl-4 pr-12 py-3 rounded-2xl border border-slate-200 text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none bg-white shadow-sm"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>

              <select
                className="w-full py-3 px-4 rounded-2xl border border-slate-200 text-sm font-bold outline-none bg-white shadow-sm"
                value={segmentFilter}
                onChange={(e) => setSegmentFilter(e.target.value)}
              >
                <option value="all">كل التصنيفات</option>
                <option value="نشط">نشط</option>
                <option value="VIP 🌟">VIP 🌟</option>
                <option value="معرض للانقطاع 🟠">معرض للانقطاع 🟠</option>
                <option value="منقطع ⚠️">منقطع ⚠️</option>
              </select>

              <select
                className="w-full py-3 px-4 rounded-2xl border border-slate-200 text-sm font-bold outline-none bg-white shadow-sm"
                value={channelFilter}
                onChange={(e) => setChannelFilter(e.target.value)}
              >
                <option value="all">كل القنوات</option>
                {crmChannels.map((ch) => (
                  <option key={ch} value={ch}>{ch}</option>
                ))}
              </select>

              <select
                className="w-full py-3 px-4 rounded-2xl border border-slate-200 text-sm font-bold outline-none bg-white shadow-sm"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
              >
                <option value="totalSpend">ترتيب حسب الإنفاق</option>
                <option value="orderCount">ترتيب حسب عدد الطلبات</option>
                <option value="lastOrder">ترتيب حسب آخر طلب</option>
                <option value="averageOrderValue">ترتيب حسب متوسط السلة</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 2xl:grid-cols-4 gap-8">
            {/* Main Table */}
            <div className="2xl:col-span-3">
              <div className="overflow-x-auto rounded-3xl border border-slate-100 max-h-[70vh] overflow-y-auto custom-scrollbar">
                <table className="w-full text-right text-sm bg-white">
                  <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-widest font-bold sticky top-0 z-10 shadow-sm">
                    <tr>
                      <th className="p-5 border-b">اسم العميل</th>
                      <th className="p-5 border-b">الجوال</th>
                      <th className="p-5 border-b">عدد الطلبات</th>
                      <th className="p-5 border-b">إجمالي الإنفاق</th>
                      <th className="p-5 border-b">متوسط السلة</th>
                      <th className="p-5 border-b">آخر طلب</th>
                      <th className="p-5 border-b">القناة المفضلة</th>
                      <th className="p-5 border-b">التصنيف</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {paginatedCRM.length === 0 ? (
                      <tr>
                        <td colSpan="8" className="p-12 text-center text-slate-400 font-bold">
                          لا توجد نتائج مطابقة
                        </td>
                      </tr>
                    ) : (
                      paginatedCRM.map((c, i) => (
                        <tr key={`${c.mobile}-${i}`} className="hover:bg-indigo-50/30 transition-colors">
                          <td className="p-5 font-black text-slate-800">{c.name}</td>
                          <td className="p-5 text-slate-500 font-mono text-xs" dir="ltr">{c.mobile}</td>
                          <td className="p-5 font-black text-center text-indigo-600">{c.orderCount}</td>
                          <td className="p-5 font-black text-emerald-600">{c.totalSpend.toLocaleString()} ﷼</td>
                          <td className="p-5 font-black text-slate-700">{c.averageOrderValue.toFixed(2)} ﷼</td>
                          <td className="p-5 text-xs text-slate-500 font-bold">
                            {c.lastOrder}
                            <span className="block text-[10px] text-slate-400 mt-1">
                              منذ {c.daysSince} يوم
                            </span>
                          </td>
                          <td className="p-5">
                            <span className="bg-slate-100 text-slate-700 px-3 py-1.5 rounded-lg text-[10px] font-bold">
                              {c.favoriteChannel}
                            </span>
                          </td>
                          <td className="p-5">
                            <span className={`px-3 py-1.5 rounded-lg text-xs font-black ${
                              c.segment.includes('VIP')
                                ? 'bg-amber-100 text-amber-700'
                                : c.segment.includes('معرض')
                                ? 'bg-orange-100 text-orange-700'
                                : c.segment.includes('منقطع')
                                ? 'bg-rose-100 text-rose-700'
                                : 'bg-emerald-100 text-emerald-700'
                            }`}>
                              {c.segment}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="flex items-center justify-between mt-6">
                <button
                  onClick={() => setCrmPage(p => Math.max(1, p - 1))}
                  disabled={crmPage === 1}
                  className="px-4 py-2 rounded-xl border border-slate-200 bg-white font-bold disabled:opacity-50"
                >
                  السابق
                </button>

                <span className="text-sm font-bold text-slate-500">
                  صفحة {crmPage} من {crmTotalPages}
                </span>

                <button
                  onClick={() => setCrmPage(p => Math.min(crmTotalPages, p + 1))}
                  disabled={crmPage === crmTotalPages}
                  className="px-4 py-2 rounded-xl border border-slate-200 bg-white font-bold disabled:opacity-50"
                >
                  التالي
                </button>
              </div>
            </div>

            {/* Side Insights */}
            <div className="space-y-6">
              <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm">
                <h3 className="font-black text-slate-800 mb-4">أعلى العملاء إنفاقًا</h3>
                <div className="space-y-3">
                  {topSpenders.length === 0 ? (
                    <div className="text-slate-400 font-bold text-sm">لا توجد بيانات</div>
                  ) : (
                    topSpenders.map((c, i) => (
                      <div key={i} className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
                        <p className="font-black text-slate-800 text-sm">{c.name}</p>
                        <p className="text-xs text-slate-500 mt-1" dir="ltr">{c.mobile}</p>
                        <p className="text-sm font-black text-emerald-600 mt-2">{c.totalSpend.toLocaleString()} ﷼</p>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm">
                <h3 className="font-black text-slate-800 mb-4">ملخص سريع</h3>
                <div className="space-y-3 text-sm font-bold text-slate-600">
                  <div className="flex justify-between">
                    <span>النتائج الحالية</span>
                    <span className="text-slate-800">{filteredCRM.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>عدد الصفحات</span>
                    <span className="text-slate-800">{crmTotalPages}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>حجم الصفحة</span>
                    <span className="text-slate-800">{crmPageSize}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // --- MAIN RENDER ---
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
        {activeTab === 'orders' && hasAccess(['super_admin', 'admin', 'editor']) && <OrdersTab />}
        {activeTab === 'crm' && hasAccess(['super_admin', 'admin']) && <CRMTab />}
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

export default function AppWrapper() {
  return (
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  );
}
