import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  LayoutDashboard, Package, ArrowRightLeft, ClipboardList, Plus, AlertTriangle, 
  PackageOpen, Cloud, CloudOff, Loader2, Settings, Link2, CalendarDays, Download, 
  BarChart3, Trash2, Tags, X, Edit2, Check, Users, UploadCloud, FileSpreadsheet, 
  CheckCircle2, DollarSign, TrendingUp, BellRing, AlertOctagon, Activity, Megaphone, 
  Target, Zap, ShieldAlert, UsersRound, ShoppingBag, BrainCircuit, Calculator, Shield
} from 'lucide-react';

import { initializeApp, getApps } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, doc, setDoc, deleteDoc, onSnapshot, writeBatch } from 'firebase/firestore';

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

// SVG Line Chart Component
const SimpleLineChart = ({ data, dataKey, height = 150 }) => {
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
          fill="none" stroke="#4f46e5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        />
        <defs>
          <linearGradient id="gradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#4f46e5" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#4f46e5" stopOpacity="0" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
};

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  
  const [todayStr, setTodayStr] = useState(() => new Date().toISOString().split('T')[0]);
  const [periodType, setPeriodType] = useState('day');
  const [endDate, setEndDate] = useState(todayStr);
  const [startDate, setStartDate] = useState(todayStr);

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

  const [user, setUser] = useState(null);
  
  // Data States
  const [movements, setMovements] = useState([]);
  const [adCosts, setAdCosts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [productDetails, setProductDetails] = useState({}); 
  const [packages, setPackages] = useState({});
  const [products, setProducts] = useState([]); 
  
  const [permissions, setPermissions] = useState({});
  const [currentUserRole, setCurrentUserRole] = useState('viewer'); // super_admin, admin, editor, viewer

  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [authError, setAuthError] = useState(null);

  // Authentication State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState(''); // تم استرجاع المتغير الذي تسبب بالخطأ
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  useEffect(() => {
    const fallbackTimer = setTimeout(() => setIsLoading(false), 4000);
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
    });
  }, [user]);

  // Fetch All Core Data
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
        setProducts(data.products || []);
      }
    });

    return () => { unsubMov(); unsubAd(); unsubOrd(); unsubSet(); };
  }, [user]);

  const updateSettingsInCloud = async (newProductDetails, newPackages) => {
    if (!user) return;
    setIsSyncing(true);
    try {
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'definitions'), { 
        productDetails: newProductDetails || productDetails, 
        products: Object.keys(newProductDetails || productDetails),
        packages: newPackages || packages
      }, { merge: true });
    } catch (error) { alert('خطأ في الحفظ'); } finally { setIsSyncing(false); }
  };

  const handleLogin = async (e) => {
    e.preventDefault(); setIsLoggingIn(true); setLoginError('');
    try { await signInWithEmailAndPassword(auth, email, password); } 
    catch (error) { setLoginError('بيانات الدخول غير صحيحة.'); } 
    finally { setIsLoggingIn(false); }
  };

  const handleLogout = () => signOut(auth);

  // --- CORE PRE-PROCESSING & DERIVATIONS ---
  
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

  // CRM Derived Data
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
      if (data.returnRate > 0.15) decisions.push({ type: 'warning', msg: `معدل استرجاع خطر ( ${(data.returnRate*100).toFixed(1)}% ) في قناة (${ch}) ⚠️` });
      if (data.adCost > 0 && data.roi < 1.5) decisions.push({ type: 'stop', msg: `أوقف استنزاف الأموال في (${ch}) ❌ - العائد ضعيف.` });
      if (data.adCost > 0 && data.roi >= 3) decisions.push({ type: 'scale', msg: `ضاعف الميزانية في (${ch}) 🔥 - قناة تدر ذهباً!` });
    });
    return decisions;
  }, [channelStats]);

  const dashboardStats = useMemo(() => {
    let totalRevenue = 0, totalCogs = 0, netSales = 0;
    Object.values(channelStats).forEach(ch => { totalRevenue += ch.revenue; totalCogs += ch.cogs; });
    movementsInPeriod.forEach(m => { if(m.isSale) netSales += m.qty; if(m.isReturn) netSales -= m.qty; });
    const totalAdCost = adCostsInPeriod.reduce((sum, c) => sum + (parseFloat(c.cost) || 0), 0);
    return { totalRevenue, totalAdCost, netSales, netProfit: totalRevenue - totalCogs - totalAdCost };
  }, [channelStats, movementsInPeriod, adCostsInPeriod]);

  // --- ACCESS CONTROL GUARD ---
  const hasAccess = (requiredRoles) => {
    if (currentUserRole === 'super_admin') return true;
    return requiredRoles.includes(currentUserRole);
  };

  // --- COMPONENTS ---

  const DashboardTab = () => {
    const trendDates = useMemo(() => {
      const dates = new Set(parsedMovements.map(m => m.date)); dates.add(todayStr); 
      return Array.from(dates).sort().slice(-14); // Last 14 active days
    }, [parsedMovements, todayStr]);

    const trendLine = trendDates.map(d => {
      const sales = parsedMovements.filter(m => m.date === d && m.isSale).reduce((s, m) => s + m.qty, 0);
      return { date: d, sales };
    });

    return (
      <div className="space-y-6 animate-in fade-in">
        {/* Filters */}
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-wrap justify-between items-center gap-4">
          <div className="flex items-center gap-4 w-full md:w-auto">
            <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl hidden md:block"><CalendarDays size={20} /></div>
            <div className="flex gap-2">
              <select className="bg-slate-50 border-none outline-none text-sm font-bold text-slate-700 py-2 px-3 rounded-lg focus:ring-2 ring-indigo-100" value={periodType} onChange={e=>setPeriodType(e.target.value)}>
                <option value="day">اليوم</option><option value="week">هذا الأسبوع</option><option value="month">هذا الشهر</option><option value="custom">مخصص</option>
              </select>
              {periodType === 'custom' && (
                <div className="flex gap-2">
                  <input type="date" className="bg-slate-50 border-none text-sm font-bold text-slate-700 py-2 px-3 rounded-lg outline-none" value={startDate} onChange={e=>setStartDate(e.target.value)} />
                  <input type="date" className="bg-slate-50 border-none text-sm font-bold text-slate-700 py-2 px-3 rounded-lg outline-none" value={endDate} onChange={e=>setEndDate(e.target.value)} />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Hero KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[
            { label: "صافي الربح", value: dashboardStats.netProfit, c: "indigo" },
            { label: "الإيرادات", value: dashboardStats.totalRevenue, c: "emerald" },
            { label: "تكلفة التسويق", value: dashboardStats.totalAdCost, c: "rose" },
            { label: "صافي المبيعات (طلبات)", value: dashboardStats.netSales, c: "blue", isNum: true }
          ].map((k, i) => (
            <div key={i} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-center items-center text-center relative overflow-hidden group hover:shadow-md transition-all">
              <div className={`absolute top-0 w-full h-1 bg-${k.c}-500`}></div>
              <span className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-2">{k.label}</span>
              <span className={`text-3xl font-black text-slate-800`}>{k.isNum ? k.value : `${k.value.toLocaleString()} ﷼`}</span>
            </div>
          ))}
        </div>

        {/* Charts & Channels */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          <div className="lg:col-span-2 bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
             <div className="flex justify-between items-center mb-6">
               <h3 className="font-bold text-slate-800 flex items-center gap-2"><TrendingUp size={18} className="text-indigo-500"/> مسار الإيرادات (14 يوم)</h3>
             </div>
             {trendLine.every(d=>d.sales===0) ? (
               <div className="h-[200px] flex items-center justify-center text-slate-400 font-bold bg-slate-50 rounded-xl border border-dashed">لا توجد بيانات</div>
             ) : (
               <SimpleLineChart data={trendLine} dataKey="sales" height={200} />
             )}
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col max-h-[300px] overflow-hidden">
             <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2 shrink-0"><Target size={18} className="text-rose-500"/> أداء القنوات (ROI Ranking)</h3>
             <div className="flex-1 overflow-y-auto pr-2 space-y-3">
               {Object.entries(channelStats).filter(([ch])=>ch!=='المنتجات الفردية').sort((a,b)=>b[1].score - a[1].score).map(([ch, data], i) => (
                 <div key={i} className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                   <div className="flex justify-between items-center mb-2">
                     <span className="font-bold text-xs text-slate-800">{i===0&&'🥇'} {ch}</span>
                     <span className={`text-[10px] font-black px-2 py-0.5 rounded ${data.roi >= 2 ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                       ROI: {data.roi===Infinity ? 'عضوي' : data.roi.toFixed(1)+'x'}
                     </span>
                   </div>
                   <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                     <div className={`h-full ${data.netProfit > 0 ? 'bg-emerald-500' : 'bg-rose-500'}`} style={{width: `${Math.min((data.revenue / (data.revenue+data.adCost||1))*100, 100)}%`}}></div>
                   </div>
                 </div>
               ))}
             </div>
          </div>
        </div>

        {/* Products Intelligence */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
           <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2"><Package size={18} className="text-blue-500"/> ذكاء المنتجات (Top Performers)</h3>
           <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
             {productStats.slice(0,3).map((p, i) => (
               <div key={i} className="bg-slate-50 rounded-xl p-4 border border-slate-100 flex justify-between items-center">
                 <div>
                   <p className="font-bold text-sm text-slate-800 truncate">{p.name}</p>
                   <p className="text-[10px] text-slate-500 font-mono">{p.sku}</p>
                 </div>
                 <div className="text-right">
                   <p className="font-black text-emerald-600 text-sm">{p.profit.toLocaleString()} ﷼</p>
                   <p className="text-[10px] text-slate-500">{p.sales} وحدة مباعة</p>
                 </div>
               </div>
             ))}
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
                <div key={i} className="bg-white/10 backdrop-blur-md border border-white/10 rounded-2xl p-5 flex items-start gap-4">
                  <div className={`p-3 rounded-xl flex-shrink-0 ${d.type === 'scale' ? 'bg-emerald-500/20 text-emerald-400' : d.type === 'stop' ? 'bg-rose-500/20 text-rose-400' : d.type==='product-good'? 'bg-blue-500/20 text-blue-400' : 'bg-amber-500/20 text-amber-400'}`}>
                    {d.type === 'scale' ? <TrendingUp/> : d.type === 'stop' ? <X/> : d.type === 'product-good' ? <Package/> : <AlertOctagon/>}
                  </div>
                  <div>
                    <h4 className="font-bold text-white mb-1">{d.type === 'scale' ? 'فرصة نمو مؤكدة' : d.type === 'stop' ? 'إيقاف استنزاف' : d.type==='product-good' ? 'بطل المبيعات' : 'تحذير أداء'}</h4>
                    <p className="text-sm text-slate-300 leading-relaxed">{d.msg}</p>
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
    const effectiveProfit = unitProfit * (1 - (simData.returnRate/100)) - (simData.shipping * (simData.returnRate/100)); // خصم الشحن المعاكس للمرتجعات
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
              {/* التكاليف */}
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

              {/* التشغيل والبيع */}
              <div className="bg-indigo-50/50 p-5 rounded-2xl border border-indigo-100">
                <h4 className="font-bold text-sm text-indigo-900 mb-4 flex items-center gap-2"><ShoppingCart size={16}/> التسعير والتشغيل</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div><label className="block text-[10px] font-bold text-indigo-700 mb-1">سعر البيع النهائي</label><input type="number" className="w-full bg-white border border-indigo-200 p-2 rounded-lg text-sm text-center focus:ring-2 outline-none font-bold" value={simData.price} onChange={e=>handleCalc('price', e.target.value)} /></div>
                  <div><label className="block text-[10px] font-bold text-indigo-700 mb-1">متوسط الشحن للطلب</label><input type="number" className="w-full bg-white border border-indigo-200 p-2 rounded-lg text-sm text-center outline-none" value={simData.shipping} onChange={e=>handleCalc('shipping', e.target.value)} /></div>
                  <div><label className="block text-[10px] font-bold text-indigo-700 mb-1">عمولات (سلة/بوابات)</label><input type="number" className="w-full bg-white border border-indigo-200 p-2 rounded-lg text-sm text-center outline-none" value={simData.commission} onChange={e=>handleCalc('commission', e.target.value)} /></div>
                  <div><label className="block text-[10px] font-bold text-rose-700 mb-1">توقع نسبة المرتجع %</label><input type="number" className="w-full bg-white border border-rose-200 p-2 rounded-lg text-sm text-center outline-none text-rose-600 font-bold" value={simData.returnRate} onChange={e=>handleCalc('returnRate', e.target.value)} /></div>
                </div>
              </div>

              {/* التسويق */}
              <div className="bg-orange-50/50 p-5 rounded-2xl border border-orange-100">
                <h4 className="font-bold text-sm text-orange-900 mb-4 flex items-center gap-2"><Megaphone size={16}/> حملة تسويقية (توقعات)</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="block text-[10px] font-bold text-orange-700 mb-1">الميزانية المرصودة</label><input type="number" className="w-full bg-white border border-orange-200 p-2 rounded-lg text-sm text-center outline-none font-bold" value={simData.adBudget} onChange={e=>handleCalc('adBudget', e.target.value)} /></div>
                  <div><label className="block text-[10px] font-bold text-orange-700 mb-1">الطلبات المتوقعة من الحملة</label><input type="number" className="w-full bg-white border border-orange-200 p-2 rounded-lg text-sm text-center outline-none" value={simData.expectedOrders} onChange={e=>handleCalc('expectedOrders', e.target.value)} /></div>
                </div>
              </div>

            </div>

            {/* Results Panel */}
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

  const OrdersAndCRMTab = ({ mode = 'orders' }) => {
    // mode: 'orders' or 'crm'
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
        <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-slate-50/50">
            <div>
              <h2 className="text-xl font-black text-slate-800 flex items-center gap-2">{mode === 'orders' ? <ShoppingBag className="text-indigo-500"/> : <UsersRound className="text-indigo-500"/>} {mode === 'orders' ? 'سجل الطلبات الواردة' : 'قاعدة بيانات العملاء (CRM)'}</h2>
              <p className="text-xs text-slate-500 mt-1">{mode === 'orders' ? 'يعرض جميع الطلبات التي تم استيرادها.' : 'يتم بناء بيانات العملاء وتصنيفهم تلقائياً من الطلبات.'}</p>
            </div>
            <div className="w-full md:w-64">
              <input type="text" placeholder="بحث باسم، رقم، أو جوال..." className="w-full p-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" value={searchTerm} onChange={e=>setSearchTerm(e.target.value)} />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right text-sm">
              <thead className="bg-slate-100 text-slate-600 text-xs uppercase tracking-wider">
                {mode === 'orders' ? (
                  <tr><th className="p-4 font-bold border-b">المرجع</th><th className="p-4 font-bold border-b">التاريخ</th><th className="p-4 font-bold border-b">العميل</th><th className="p-4 font-bold border-b">الجوال</th><th className="p-4 font-bold border-b">القناة</th><th className="p-4 font-bold border-b">المبلغ</th></tr>
                ) : (
                  <tr><th className="p-4 font-bold border-b">اسم العميل</th><th className="p-4 font-bold border-b">الجوال</th><th className="p-4 font-bold border-b text-center">الطلبات</th><th className="p-4 font-bold border-b">إجمالي الدفع</th><th className="p-4 font-bold border-b">آخر طلب</th><th className="p-4 font-bold border-b">التصنيف</th></tr>
                )}
              </thead>
              <tbody className="divide-y divide-slate-50">
                {mode === 'orders' ? (
                  filteredOrders.length === 0 ? <tr><td colSpan="6" className="p-8 text-center text-slate-400">لا توجد طلبات.</td></tr> :
                  filteredOrders.slice(0, 100).map((o, i) => (
                    <tr key={i} className="hover:bg-slate-50 transition-colors">
                      <td className="p-4 font-mono text-slate-500 text-xs">{o.reference}</td>
                      <td className="p-4 text-xs text-slate-600">{o.date}</td>
                      <td className="p-4 font-bold text-slate-800">{o.customerName}</td>
                      <td className="p-4 text-slate-500 font-mono" dir="ltr">{o.mobile}</td>
                      <td className="p-4"><span className="bg-indigo-50 text-indigo-700 px-2 py-1 rounded-md text-[10px] font-bold">{o.channel}</span></td>
                      <td className="p-4 font-black text-emerald-600">{parseFloat(o.amount||0).toLocaleString()} ﷼</td>
                    </tr>
                  ))
                ) : (
                  filteredCRM.length === 0 ? <tr><td colSpan="6" className="p-8 text-center text-slate-400">لا يوجد عملاء.</td></tr> :
                  filteredCRM.slice(0, 100).map((c, i) => (
                    <tr key={i} className="hover:bg-slate-50 transition-colors">
                      <td className="p-4 font-bold text-slate-800">{c.name}</td>
                      <td className="p-4 text-slate-500 font-mono text-xs" dir="ltr">{c.mobile}</td>
                      <td className="p-4 font-black text-center text-indigo-600">{c.orderCount}</td>
                      <td className="p-4 font-bold text-emerald-600">{c.totalSpend.toLocaleString()} ﷼</td>
                      <td className="p-4 text-xs text-slate-500">{c.lastOrder} <span className="text-[10px] text-slate-400">({c.daysSince} يوم)</span></td>
                      <td className="p-4">
                        <span className={`px-2 py-1 rounded-md text-[10px] font-bold ${c.segment.includes('VIP') ? 'bg-amber-100 text-amber-700' : c.segment.includes('معرض') ? 'bg-orange-100 text-orange-700' : c.segment.includes('منقطع') ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'}`}>
                          {c.segment}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
            {(mode==='orders' ? filteredOrders.length : filteredCRM.length) > 100 && <div className="p-4 text-center text-xs text-slate-400 border-t">يتم عرض أحدث 100 سجل فقط للسرعة.</div>}
          </div>
        </div>
      </div>
    );
  };

  const DataAdminTab = () => {
    const [confirmText, setConfirmText] = useState('');
    const [nukeTarget, setNukeTarget] = useState(null); // 'movements', 'orders', 'adcosts'

    const handleNuke = async () => {
      if (confirmText !== 'DELETE') { alert('اكتب DELETE للتأكيد'); return; }
      setIsSyncing(true);
      try {
        let collectionName = nukeTarget;
        let dataArray = nukeTarget === 'movements' ? movements : nukeTarget === 'orders' ? orders : adCosts;
        
        // Firestore batch delete loop
        const batchSize = 100;
        for (let i = 0; i < dataArray.length; i += batchSize) {
          const chunk = dataArray.slice(i, i + batchSize);
          const batch = writeBatch(db);
          chunk.forEach(docItem => {
            batch.delete(doc(db, 'artifacts', appId, 'public', 'data', collectionName, docItem.id));
          });
          await batch.commit();
        }
        alert('تم المسح بنجاح');
        setConfirmText(''); setNukeTarget(null);
      } catch(e) { console.error(e); alert('خطأ'); } finally { setIsSyncing(false); }
    };

    return (
      <div className="space-y-6 animate-in fade-in max-w-2xl mx-auto">
        <div className="bg-rose-50 border-2 border-rose-200 p-8 rounded-3xl shadow-sm relative overflow-hidden">
          {isSyncing && <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center z-10"><Loader2 className="animate-spin text-rose-600" size={40} /></div>}
          <div className="flex items-center gap-4 mb-8 border-b border-rose-200 pb-6">
            <div className="p-4 bg-rose-600 text-white rounded-2xl"><ShieldAlert size={32}/></div>
            <div>
              <h2 className="text-2xl font-black text-rose-900">منطقة الخطر (Data Admin)</h2>
              <p className="text-sm text-rose-700 mt-1 font-bold">تحذير: لا يمكن استرجاع البيانات بعد حذفها.</p>
            </div>
          </div>

          <div className="space-y-4">
            {[
              { target: 'movements', title: 'مسح جميع حركات المخزون', count: movements.length },
              { target: 'orders', title: 'مسح جميع الطلبات المستوردة', count: orders.length },
              { target: 'adcosts', title: 'مسح سجل تكاليف التسويق', count: adCosts.length }
            ].map(act => (
              <div key={act.target} className="bg-white p-5 rounded-2xl border border-rose-100 flex justify-between items-center">
                <div>
                  <h4 className="font-bold text-rose-900">{act.title}</h4>
                  <p className="text-xs text-rose-500 font-mono mt-1">{act.count} سجل متوفر</p>
                </div>
                {nukeTarget === act.target ? (
                  <div className="flex gap-2 items-center">
                    <input type="text" placeholder="اكتب DELETE" className="p-2 border border-rose-300 rounded outline-none text-xs w-28 text-center font-bold text-rose-700" value={confirmText} onChange={e=>setConfirmText(e.target.value)}/>
                    <button onClick={handleNuke} className="bg-rose-600 text-white px-4 py-2 rounded text-xs font-bold hover:bg-rose-700">تأكيد المسح</button>
                    <button onClick={()=>{setNukeTarget(null);setConfirmText('');}} className="bg-slate-200 text-slate-700 px-3 py-2 rounded text-xs font-bold">إلغاء</button>
                  </div>
                ) : (
                  <button onClick={()=>setNukeTarget(act.target)} disabled={act.count === 0} className="bg-rose-100 text-rose-700 px-6 py-2 rounded-xl text-sm font-bold hover:bg-rose-200 disabled:opacity-50">مسح البيانات</button>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  // --- REFACTORED UPLOAD (Orders + Movements) ---
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
        // We will batch insert both orders and movements
        const batchSize = 50; 
        
        // 1. Insert Orders
        // Remove duplicate orders based on reference to avoid cluttering CRM
        const uniqueOrders = [];
        const seenRefs = new Set();
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

        // 2. Insert Movements
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
          <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-6">
            <h4 className="font-bold text-indigo-900 mb-4 flex items-center gap-2"><CheckCircle2/> تأكيد استيراد البيانات</h4>
            <div className="flex gap-6 mb-6">
              <div className="bg-white p-4 rounded-xl flex-1 text-center shadow-sm">
                <span className="block text-3xl font-black text-indigo-600 mb-1">{importPreview.orders.length}</span><span className="text-xs font-bold text-slate-500">طلب جديد سيبني الـ CRM</span>
              </div>
              <div className="bg-white p-4 rounded-xl flex-1 text-center shadow-sm">
                <span className="block text-3xl font-black text-emerald-600 mb-1">{importPreview.movements.length}</span><span className="text-xs font-bold text-slate-500">حركة مخزون ستحدث الأرباح</span>
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={confirmImport} disabled={isSyncing} className="flex-1 bg-indigo-600 text-white font-bold py-3 rounded-xl hover:bg-indigo-700">{isSyncing ? 'جاري المعالجة...' : 'تأكيد واعتماد'}</button>
              <button onClick={()=>setImportPreview(null)} disabled={isSyncing} className="bg-white text-slate-700 border font-bold py-3 px-6 rounded-xl hover:bg-slate-50">إلغاء</button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col md:flex-row gap-6 items-center bg-slate-50 p-6 rounded-2xl border border-slate-100 border-dashed">
            <div className="flex-1 w-full">
              <label className="flex items-center gap-3 bg-white p-4 rounded-xl border border-slate-200 cursor-pointer hover:border-indigo-500 transition-colors mb-3">
                <input type="radio" name="mode" className="accent-indigo-600 w-5 h-5" checked={importMode==='sales'} onChange={()=>setImportMode('sales')}/>
                <div><p className="font-bold text-slate-800">مبيعات (تم التوصيل)</p><p className="text-[10px] text-slate-500">يضيف إيرادات ويبني عملاء</p></div>
              </label>
              <label className="flex items-center gap-3 bg-white p-4 rounded-xl border border-slate-200 cursor-pointer hover:border-rose-500 transition-colors">
                <input type="radio" name="mode" className="accent-rose-600 w-5 h-5" checked={importMode==='returns'} onChange={()=>setImportMode('returns')}/>
                <div><p className="font-bold text-slate-800">مرتجعات (دعم فني)</p><p className="text-[10px] text-slate-500">يخصم إيرادات ويسترد بضاعة</p></div>
              </label>
            </div>
            <div className="w-full md:w-1/2">
              <input type="file" accept=".csv, .xlsx, .xls" ref={fileInputRef} onChange={handleFileUpload} className="hidden" id="file-upload"/>
              <label htmlFor="file-upload" className="bg-indigo-600 hover:bg-indigo-700 text-white font-black py-4 rounded-2xl flex flex-col items-center justify-center gap-2 cursor-pointer transition-colors shadow-sm h-full min-h-[140px]">
                <FileSpreadsheet size={32}/>
                <span>اختيار ورفع ملف (سلة)</span>
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
    useEffect(() => { setFormData(prev => ({ ...prev, code: prev.level === 'منتج' ? defaultCode : defaultPkgCode })); }, [productDetails, packages, formData.level]);

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

  // --- Main Render Switch ---

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

  const navItems = [
    { id: 'dashboard', label: 'لوحة التحكم', icon: <LayoutDashboard size={18}/>, roles: ['super_admin', 'admin', 'editor', 'viewer'] },
    { id: 'movements', label: 'المبيعات والحركات', icon: <ArrowRightLeft size={18}/>, roles: ['super_admin', 'admin', 'editor'] },
    { id: 'orders', label: 'الطلبات', icon: <ShoppingBag size={18}/>, roles: ['super_admin', 'admin', 'editor'] },
    { id: 'crm', label: 'العملاء (CRM)', icon: <UsersRound size={18}/>, roles: ['super_admin', 'admin'] },
    { id: 'adcosts', label: 'التسويق', icon: <Megaphone size={18}/>, roles: ['super_admin', 'admin'] },
    { id: 'decision_center', label: 'مركز القرارات', icon: <BrainCircuit size={18}/>, roles: ['super_admin'] },
    { id: 'profit_simulator', label: 'محاكي الأرباح', icon: <Calculator size={18}/>, roles: ['super_admin'] },
    { id: 'definitions', label: 'الإعدادات', icon: <Tags size={18}/>, roles: ['super_admin', 'admin'] },
    { id: 'users', label: 'المستخدمين', icon: <Users size={18}/>, roles: ['super_admin'] },
    { id: 'data_admin', label: 'إدارة البيانات', icon: <ShieldAlert size={18}/>, roles: ['super_admin'] }
  ];

  return (
    <div className="min-h-screen bg-slate-50 font-sans" dir="rtl">
      {/* SaaS Navbar */}
      <nav className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-[1400px] mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center shadow-sm">
                <Activity size={18} className="text-white"/>
              </div>
              <span className="font-black text-lg text-slate-800 tracking-tight hidden sm:block">Asparkle<span className="text-indigo-600">OS</span></span>
            </div>
            
            <div className="flex-1 flex justify-center overflow-x-auto scrollbar-hide px-4 mask-edges space-x-1 space-x-reverse">
              {navItems.filter(item => item.roles.includes(currentUserRole)).map(item => (
                <button key={item.id} onClick={() => setActiveTab(item.id)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${activeTab === item.id ? 'bg-slate-100 text-indigo-700' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'}`}>
                  {item.icon} <span className="hidden md:inline">{item.label}</span>
                </button>
              ))}
            </div>

            <div className="flex items-center gap-3">
              <div className="hidden sm:flex flex-col items-end">
                <span className="text-[10px] font-bold text-slate-400">متصل كـ {currentUserRole}</span>
                <span className="text-[9px] text-emerald-500 flex items-center gap-1"><Cloud size={10}/> سحابي</span>
              </div>
              <button onClick={handleLogout} className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"><CloudOff size={18}/></button>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content Wrapper */}
      <main className="max-w-[1400px] mx-auto px-4 py-8">
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

      <style dangerouslySetInnerHTML={{__html: `@import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800;900&display=swap'); body { font-family: 'Tajawal', sans-serif; } .scrollbar-hide::-webkit-scrollbar { display: none; } .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; } .mask-edges { -webkit-mask-image: linear-gradient(to right, transparent, black 10%, black 90%, transparent); }`}} />
    </div>
  );
}
