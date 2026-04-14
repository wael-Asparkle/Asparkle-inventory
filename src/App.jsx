import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  LayoutDashboard, 
  Package, 
  ArrowRightLeft, 
  ClipboardList, 
  Plus,
  AlertTriangle,
  PackageOpen,
  Cloud,
  CloudOff,
  Loader2,
  Settings,
  Link2,
  CalendarDays,
  Download,
  BarChart3,
  Trash2,
  Tags,
  X,
  Edit2,
  Check,
  Users,
  UploadCloud,
  FileSpreadsheet,
  CheckCircle2,
  DollarSign,
  TrendingUp,
  BellRing,
  AlertOctagon,
  Activity,
  Megaphone,
  Lightbulb,
  Target,
  Zap
} from 'lucide-react';

// --- إعدادات قاعدة البيانات السحابية (Firebase) ---
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
  { id: 'بيع (دفع إلكتروني)', type: 'out' },
  { id: 'بيع (تمارا)', type: 'out' },
  { id: 'بيع (دفع عند الاستلام)', type: 'out' },
  { id: 'بيع آلي (عبر الربط)', type: 'out'},
  { id: 'بيع مجمع (إدخال سابق)', type: 'out'},
  { id: 'مرتجع (إلغاء رغبة العميل)', type: 'in' },
  { id: 'مرتجع (عدم استلام من الشحن)', type: 'in' },
  { id: 'مرتجع (تالف أو خطأ بالطلب)', type: 'in' },
  { id: 'تلف داخلي', type: 'out' },
  { id: 'تعديل يدوي (نقص)', type: 'out' },
  { id: 'تعديل يدوي (زيادة)', type: 'in' },
  { id: 'دخول بضاعة جديدة', type: 'in' }
];

const safeConfirm = (msg) => {
  if (typeof window !== 'undefined') return window.confirm(msg);
  return false;
};

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  
  const [todayStr, setTodayStr] = useState(() => new Date().toISOString().split('T')[0]);
  const [periodType, setPeriodType] = useState('day');
  const [endDate, setEndDate] = useState(todayStr);
  const [startDate, setStartDate] = useState(todayStr);
  const [simulatorBoost, setSimulatorBoost] = useState(0); // لمحاكي الأرباح

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
  
  // States Data
  const [movements, setMovements] = useState([]);
  const [adCosts, setAdCosts] = useState([]);
  const [productDetails, setProductDetails] = useState({}); 
  const [packages, setPackages] = useState({});
  const [products, setProducts] = useState([]); 
  const [isSettingsLoaded, setIsSettingsLoaded] = useState(false);

  const [permissions, setPermissions] = useState({});
  const [currentUserRole, setCurrentUserRole] = useState('viewer'); 
  const [isPermissionsLoaded, setIsPermissionsLoaded] = useState(false);

  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [authError, setAuthError] = useState(null);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Fallback Loading
  useEffect(() => {
    const fallbackTimer = setTimeout(() => { setIsLoading(false); }, 5000);
    return () => clearTimeout(fallbackTimer);
  }, []);

  // Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) { setUser(currentUser); setAuthError(null); } 
      else { setUser(null); }
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Fetch Permissions
  useEffect(() => {
    if (!user) return;
    const permsRef = doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'permissions');
    const unsubscribe = onSnapshot(permsRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setPermissions(data);
        setCurrentUserRole(data[user.email] || 'viewer');
      } else {
        const initialData = { [user.email]: 'admin' };
        setDoc(permsRef, initialData).catch(console.error);
        setPermissions(initialData);
        setCurrentUserRole('admin');
      }
      setIsPermissionsLoaded(true);
    }, (error) => { console.error(error); setIsPermissionsLoaded(true); });
    return () => unsubscribe();
  }, [user]);

  // Fetch Movements
  useEffect(() => {
    if (!user) return;
    const movementsCollection = collection(db, 'artifacts', appId, 'public', 'data', 'movements');
    const unsubscribe = onSnapshot(movementsCollection, (snapshot) => {
      const fetchedMovements = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      fetchedMovements.sort((a, b) => b.timestamp - a.timestamp);
      setMovements(fetchedMovements);
    }, (error) => { console.error(error); });
    return () => unsubscribe();
  }, [user]);

  // Fetch Ad Costs
  useEffect(() => {
    if (!user) return;
    const adCostsCollection = collection(db, 'artifacts', appId, 'public', 'data', 'adcosts');
    const unsubscribe = onSnapshot(adCostsCollection, (snapshot) => {
      const fetchedCosts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      fetchedCosts.sort((a, b) => b.timestamp - a.timestamp);
      setAdCosts(fetchedCosts);
    }, (error) => { console.error(error); });
    return () => unsubscribe();
  }, [user]);

  // Fetch Settings
  useEffect(() => {
    if (!user) return;
    const settingsRef = doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'definitions');
    const unsubscribe = onSnapshot(settingsRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        
        let loadedProductDetails = data.productDetails;
        if (!loadedProductDetails && data.products) {
          loadedProductDetails = {};
          data.products.forEach(sku => {
            loadedProductDetails[sku] = {
              sku: sku, name: sku, openingStock: 0, openingDate: '2026-04-01', unitCost: 0, sellingPrice: 0
            };
          });
          if (currentUserRole === 'admin') {
            setDoc(settingsRef, { productDetails: loadedProductDetails }, { merge: true }).catch(e=>console.error(e));
          }
        }
        
        setProducts(data.products || []);
        setProductDetails(loadedProductDetails || {});
        setPackages(data.packages || {});
      } else {
        const initialProducts = {
          '9000901': { sku: '9000901', name: 'عطر أسباركل', openingStock: 0, openingDate: todayStr, unitCost: 15, sellingPrice: 79 },
          '9000902': { sku: '9000902', name: 'عطر 2', openingStock: 0, openingDate: todayStr, unitCost: 15, sellingPrice: 79 }
        };
        const initialPackages = {
          'asg001': { name: 'بكج اسباركل', group: 'بكج اسباركل', channel: 'المتجر (عضوي)', price: 150, items: { '9000901': 1, '9000902': 1 } }
        };
        setDoc(settingsRef, {
          productDetails: initialProducts,
          packages: initialPackages,
          products: Object.keys(initialProducts)
        }).catch(console.error);
      }
      setIsSettingsLoaded(true);
    }, (error) => { console.error(error); setIsSettingsLoaded(true); });
    return () => unsubscribe();
  }, [user, currentUserRole, todayStr]);

  const updateSettingsInCloud = async (newProductDetails, newPackages) => {
    if (!user) return;
    setIsSyncing(true);
    try {
      const settingsRef = doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'definitions');
      await setDoc(settingsRef, { 
        productDetails: newProductDetails || productDetails, 
        products: Object.keys(newProductDetails || productDetails),
        packages: newPackages || packages
      }, { merge: true });
    } catch (error) {
      console.error(error); alert('حدث خطأ أثناء حفظ التعديلات');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setIsLoggingIn(true); setLoginError('');
    try { await signInWithEmailAndPassword(auth, email, password); } 
    catch (error) { setLoginError('البريد الإلكتروني أو كلمة المرور غير صحيحة.'); } 
    finally { setIsLoggingIn(false); }
  };

  const handleLogout = async () => { try { await signOut(auth); } catch (error) { console.error(error); } };

  // --- التحسينات المعمارية والأداء (Pre-processing) ---
  
  const parsedMovements = useMemo(() => {
    return movements.map(m => {
      const qty = parseInt(m.quantity) || 0; 
      const isSale = m.type && m.type.includes('بيع');
      const isReturn = m.type && (m.type.includes('مرتجع') || m.type.includes('رفض'));
      return { ...m, qty, isSale, isReturn };
    });
  }, [movements]);

  const movementsInPeriod = useMemo(() => {
    return parsedMovements.filter(m => m.date >= startDate && m.date <= endDate);
  }, [parsedMovements, startDate, endDate]);

  const adCostsInPeriod = useMemo(() => {
    return adCosts.filter(c => c.date >= startDate && c.date <= endDate);
  }, [adCosts, startDate, endDate]);

  const stockAsOfDate = useMemo(() => {
    let stock = {};
    
    // 1. وضع المخزون الافتتاحي
    Object.values(productDetails).forEach(p => {
      stock[p.sku] = parseInt(p.openingStock) || 0;
    });

    // 2. تصفية وتطبيق الحركات التي (بعد) أو (يساوي) تاريخ الافتتاح فقط
    parsedMovements.forEach(mov => {
      if (mov.date > endDate) return;

      const isOut = MOVEMENT_TYPES.find(t => t.id === mov.type)?.type === 'out';
      const multiplier = isOut ? -1 : 1;
      const qty = mov.qty;

      if (mov.level === 'منتج') {
        const p = productDetails[mov.code];
        if (p && mov.date >= p.openingDate) {
          stock[mov.code] += (qty * multiplier);
        }
      } else if (mov.level === 'بكج' && packages[mov.code]) {
        Object.entries(packages[mov.code].items).forEach(([sku, reqQty]) => {
          const p = productDetails[sku];
          if (p && mov.date >= p.openingDate) {
            stock[sku] += (qty * reqQty * multiplier);
          }
        });
      }
    });
    return stock;
  }, [parsedMovements, productDetails, packages, endDate]);

  // إضافة دالة حساب توفر البكجات بناءً على المخزون الحالي
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

  // إحصائيات القنوات التسويقية والعائد (ROI) مع (نقطة التعادل Break-even والذكاء التسويقي) 🔥
  const channelStats = useMemo(() => {
    const result = {};

    // 1. جمع الإيرادات والتكاليف من الحركات
    movementsInPeriod.forEach(m => {
      if (!m.isSale && !m.isReturn) return;

      let channel = 'مبيعات المنتجات الفردية';
      let revenue = 0;
      let cost = 0;

      if (m.level === 'بكج' && packages[m.code]) {
        const pkg = packages[m.code];
        channel = pkg.channel || 'غير محدد';
        revenue = (pkg.price || 0) * m.qty;
        
        let pkgCogs = 0;
        Object.entries(pkg.items).forEach(([sku, reqQty]) => {
          pkgCogs += (productDetails[sku]?.unitCost || 0) * reqQty;
        });
        cost = pkgCogs * m.qty;
      } else if (m.level === 'منتج' && productDetails[m.code]) {
        revenue = (productDetails[m.code].sellingPrice || 0) * m.qty;
        cost = (productDetails[m.code].unitCost || 0) * m.qty;
      }

      if (!result[channel]) result[channel] = { revenue: 0, cogs: 0, adCost: 0, netSales: 0, returns: 0 };

      if (m.isSale) {
        result[channel].revenue += revenue;
        result[channel].cogs += cost;
        result[channel].netSales += m.qty;
      } else if (m.isReturn) {
        result[channel].revenue -= revenue;
        result[channel].cogs -= cost;
        result[channel].netSales -= m.qty;
        result[channel].returns += m.qty; // تتبع المرتجعات لكل قناة
      }
    });

    // 2. إضافة تكاليف التسويق المدخلة يدوياً
    adCostsInPeriod.forEach(c => {
      const channel = c.channel || 'غير محدد';
      if (!result[channel]) result[channel] = { revenue: 0, cogs: 0, adCost: 0, netSales: 0, returns: 0 };
      result[channel].adCost += parseFloat(c.cost) || 0;
    });

    // 3. حساب الأرباح، الـ ROI، التقييم، ونقطة التعادل
    Object.keys(result).forEach(ch => {
      const r = result[ch];
      r.netProfit = r.revenue - r.cogs - r.adCost;
      r.roi = r.adCost > 0 ? r.revenue / r.adCost : (r.revenue > 0 ? Infinity : 0);

      // نقطة التعادل (Break-even)
      if (r.netSales > 0) {
        const profitPerUnit = (r.revenue / r.netSales) - (r.cogs / r.netSales);
        r.breakEvenUnits = (profitPerUnit > 0 && r.adCost > 0) ? Math.ceil(r.adCost / profitPerUnit) : 0;
      } else {
        r.breakEvenUnits = 0;
      }

      // إضافة Level الوحش: الربح لكل طلب ومعدل الاسترجاع
      r.profitPerOrder = r.netSales > 0 ? r.netProfit / r.netSales : 0;
      
      const totalGrossSales = r.netSales + r.returns;
      r.returnRate = totalGrossSales > 0 ? r.returns / totalGrossSales : 0;

      // تقييم الذكاء الاصطناعي (AI Decision Score)
      r.score = (r.roi * 0.5) + (r.netProfit > 0 ? 1 : -1) + (r.profitPerOrder || 0);
    });

    return result;
  }, [movementsInPeriod, adCostsInPeriod, packages, productDetails]);

  // محاكي الأرباح (Scenario Simulator)
  const simulatedStats = useMemo(() => {
    if (simulatorBoost === 0) return null;
    let totalOldProfit = 0;
    let totalNewProfit = 0;
    const boostFactor = 1 + (simulatorBoost / 100);

    Object.entries(channelStats).forEach(([ch, data]) => {
      if (ch === 'مبيعات المنتجات الفردية' || ch === 'غير محدد') return;
      totalOldProfit += data.netProfit;
      const newRev = data.revenue * boostFactor;
      totalNewProfit += (newRev - data.cogs - data.adCost);
    });

    return { oldProfit: totalOldProfit, newProfit: totalNewProfit, diff: totalNewProfit - totalOldProfit };
  }, [channelStats, simulatorBoost]);

  // Product Intelligence (الربحية لكل منتج فردي) 🔥
  const productStats = useMemo(() => {
    const result = {};
    
    // تهيئة المنتجات
    Object.values(productDetails).forEach(p => {
      result[p.sku] = { name: p.name, sales: 0, revenue: 0, cost: 0, profit: 0 };
    });

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

    Object.values(result).forEach(r => {
      r.profit = r.revenue - r.cost;
    });

    return Object.entries(result).map(([sku, data]) => ({ sku, ...data })).sort((a, b) => b.profit - a.profit);
  }, [movementsInPeriod, productDetails]);

  // Decision Engine (محرك القرارات الذكي) 🔥
  const businessDecisions = useMemo(() => {
    const decisions = [];

    // قرارات القنوات التسويقية
    Object.entries(channelStats).forEach(([ch, data]) => {
      if (ch === 'مبيعات المنتجات الفردية' || ch === 'غير محدد') return;

      if (data.returnRate > 0.15) { // معدل مرتجعات أكثر من 15%
        decisions.push({ type: 'warning', iconType: 'AlertTriangle', color: 'text-orange-700 bg-orange-100 border-orange-200', msg: `معدل استرجاع عالي ( ${(data.returnRate*100).toFixed(1)}% ) في قناة (${ch}) ⚠️ - الأرباح تضيع في الشحن المعاكس.` });
      }
      if (data.adCost > 0 && data.roi < 1.5) {
        decisions.push({ type: 'stop', iconType: 'X', color: 'text-red-700 bg-red-100 border-red-200', msg: `أوقف أو عدّل إعلانات (${ch}) فوراً ❌ - العائد ضعيف جداً وتخسر أموالك.` });
      }
      if (data.adCost > 0 && data.roi >= 3) {
        decisions.push({ type: 'scale', iconType: 'TrendingUp', color: 'text-green-700 bg-green-100 border-green-200', msg: `ضاعف الميزانية في (${ch}) 🔥 - قناة رابحة جداً وتدر ذهباً (ROI: ${data.roi.toFixed(1)}x).` });
      }
      if (data.netSales === 0 && data.adCost > 0) {
        decisions.push({ type: 'warning', iconType: 'AlertTriangle', color: 'text-orange-700 bg-orange-100 border-orange-200', msg: `صرف بدون أي مبيعات في (${ch}) ⚠️ - تأكد من الربط أو أوقف الحملة الآن.` });
      }
    });

    // قرارات المنتجات الفردية
    const topProduct = productStats.find(p => p.sales > 0);
    const worstProduct = [...productStats].reverse().find(p => p.profit < 0);

    if (topProduct && topProduct.profit > 0) {
       decisions.push({ type: 'product-good', iconType: 'CheckCircle2', color: 'text-blue-700 bg-blue-100 border-blue-200', msg: `منتج (${topProduct.name}) هو البطل الرابح! 🌟 يدر أعلى أرباح مبيعات فردية.` });
    }
    if (worstProduct) {
       decisions.push({ type: 'product-bad', iconType: 'AlertOctagon', color: 'text-rose-700 bg-rose-100 border-rose-200', msg: `منتج (${worstProduct.name}) يسبب خسائر 📉 راجع التسعير أو المرتجعات.` });
    }

    return decisions;
  }, [channelStats, productStats]);

  // التنبيهات الذكية (المخزون)
  const smartAlerts = useMemo(() => {
    const alerts = [];
    
    Object.values(productDetails).forEach(p => {
      const qty = stockAsOfDate[p.sku] || 0;
      if (qty < 30 && qty > 0) {
        alerts.push({ type: 'danger', msg: `SKU (${p.sku}) يوشك على النفاد! متبقي ${qty} حبة فقط.` });
      } else if (qty === 0) {
        alerts.push({ type: 'critical', msg: `SKU (${p.sku}) نفد تماماً من المخزون!` });
      }
    });

    Object.entries(packageAvailabilityAsOfDate).forEach(([code, data]) => {
      if (data.max < 20 && data.max > 0) {
        alerts.push({ type: 'warning', msg: `البكج (${packages[code]?.name}) مهدد بالتوقف، يكفي لـ ${data.max} طلبات فقط بسبب نقص المنتج ${data.criticalSku}.` });
      }
    });

    return alerts;
  }, [stockAsOfDate, packageAvailabilityAsOfDate, productDetails, packages]);

  const dashboardStats = useMemo(() => {
    let totalStock = Object.values(stockAsOfDate).reduce((a, b) => a + b, 0);
    let totalRevenue = 0; 
    let totalCogs = 0;    
    let totalReturns = 0;
    let netSales = 0;

    Object.values(channelStats).forEach(ch => {
      totalRevenue += ch.revenue;
      totalCogs += ch.cogs;
    });

    movementsInPeriod.forEach(m => {
      if(m.isSale) netSales += m.qty;
      if(m.isReturn) {
        netSales -= m.qty;
        totalReturns += m.qty;
      }
    });

    const totalAdCost = adCostsInPeriod.reduce((sum, c) => sum + (parseFloat(c.cost) || 0), 0);
    const grossProfit = totalRevenue - totalCogs;
    const netProfit = grossProfit - totalAdCost;

    return { totalStock, totalRevenue, totalCogs, totalAdCost, netProfit, netSales, totalReturns };
  }, [stockAsOfDate, movementsInPeriod, adCostsInPeriod, channelStats]);

  const uniqueDates = useMemo(() => {
    const dates = new Set(parsedMovements.map(m => m.date));
    dates.add(todayStr); 
    return Array.from(dates).sort((a, b) => b.localeCompare(a));
  }, [parsedMovements, todayStr]);

  const trendData = useMemo(() => {
    const last7Dates = uniqueDates.slice(0, 7).reverse();
    return last7Dates.map(d => {
      let dailySales = 0;
      parsedMovements.forEach(m => {
        if (m.date === d && m.isSale) dailySales += m.qty;
      });
      return { date: d, sales: dailySales };
    });
  }, [uniqueDates, parsedMovements]);

  const maxSalesInTrend = Math.max(...trendData.map(d => d.sales || 0), 1); 

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
          h2, h3 { color: #0f172a; margin-bottom: 10px; }
          .kpi-table th { background-color: #f1f5f9; color: #334155; font-weight: bold; }
          .text-blue { color: #1d4ed8; font-weight: bold; }
          .text-red { color: #b91c1c; font-weight: bold; }
          .text-green { color: #166534; font-weight: bold; }
          .text-purple { color: #6d28d9; font-weight: bold; }
          .text-orange { color: #ea580c; font-weight: bold; }
        </style>
      </head>
      <body dir="rtl">
        <h2>برج مراقبة أسباركل المالي والتشغيلي (إدارة ذكية)</h2>
        <p><strong>فترة التقرير:</strong> من ${startDate} إلى ${endDate}</p>

        <h3>المؤشرات العامة المحدثة</h3>
        <table class="kpi-table">
          <tr>
            <th>إجمالي المخزون</th>
            <th>المبيعات الصافية</th>
            <th>المرتجعات</th>
            <th>الإيرادات (SAR)</th>
            <th>تكاليف التسويق (SAR)</th>
            <th>الربح الصافي (SAR)</th>
          </tr>
          <tr>
            <td>${dashboardStats.totalStock}</td>
            <td class="text-blue">${dashboardStats.netSales}</td>
            <td class="text-red">${dashboardStats.totalReturns}</td>
            <td class="text-green">${dashboardStats.totalRevenue.toLocaleString()}</td>
            <td class="text-orange">${dashboardStats.totalAdCost.toLocaleString()}</td>
            <td class="text-purple">${dashboardStats.netProfit.toLocaleString()}</td>
          </tr>
        </table>

        <h3>تحليل القنوات التسويقية ونقاط التعادل</h3>
        <table>
          <tr>
            <th>القناة التسويقية</th>
            <th>صافي الطلبات</th>
            <th>الإيرادات</th>
            <th>تكلفة البضاعة</th>
            <th>تكلفة التسويق</th>
            <th>نقطة التعادل (للتغطية)</th>
            <th>نسبة الاسترجاع</th>
            <th>الربح للطلب الواحد</th>
            <th>صافي الربح</th>
            <th>مؤشر العائد (ROI)</th>
          </tr>
          ${Object.entries(channelStats)
            .sort((a, b) => b[1].score - a[1].score)
            .map(([ch, data]) => {
            return `<tr>
              <td style="text-align: right; font-weight: bold;">${ch}</td>
              <td class="text-blue">${data.netSales}</td>
              <td class="text-green">${data.revenue.toLocaleString()}</td>
              <td class="text-orange">${data.cogs.toLocaleString()}</td>
              <td class="text-red">${data.adCost.toLocaleString()}</td>
              <td style="font-weight: bold;">${data.breakEvenUnits > 0 ? data.breakEvenUnits + ' طلب' : '-'}</td>
              <td class="text-red">${(data.returnRate * 100).toFixed(1)}%</td>
              <td class="text-green">${data.profitPerOrder.toFixed(2)} ر.س</td>
              <td class="text-purple">${data.netProfit.toLocaleString()}</td>
              <td style="font-weight: bold;">${data.roi === Infinity ? 'عضوي' : data.roi.toFixed(2) + 'x'}</td>
            </tr>`;
          }).join('')}
        </table>
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

  // --- Components: Tabs ---

  const AdCostsTab = () => {
    const [date, setDate] = useState(todayStr);
    const [channel, setChannel] = useState('');
    const [campaign, setCampaign] = useState('');
    const [cost, setCost] = useState('');
    const [note, setNote] = useState('');
    const [deleteConfirmId, setDeleteConfirmId] = useState(null);

    const handleSubmit = async (e) => {
      e.preventDefault();
      if (!cost || !channel) return;
      setIsSyncing(true);
      try {
        const id = `ad_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
        await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'adcosts', id), {
          date, channel: channel.trim(), campaign, cost: parseFloat(cost), note, timestamp: Date.now()
        });
        setCampaign(''); setCost(''); setNote('');
      } catch (err) { console.error(err); alert('خطأ في الحفظ'); }
      finally { setIsSyncing(false); }
    };

    const handleDelete = async (id) => {
      setIsSyncing(true);
      try { await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'adcosts', id)); }
      catch (e) { console.error(e); } finally { setIsSyncing(false); }
    };

    const existingChannels = [...new Set(Object.values(packages).map(p => p.channel).filter(Boolean))];

    return (
      <div className="space-y-6 animate-in fade-in pb-10">
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm relative">
           {isSyncing && <div className="absolute inset-0 bg-white/50 backdrop-blur-sm flex items-center justify-center rounded-xl z-10"><Loader2 className="animate-spin text-blue-600" size={32} /></div>}
           <div className="flex items-center gap-3 mb-6 border-b pb-4">
             <div className="p-3 bg-red-50 text-red-600 rounded-lg"><Megaphone size={24} /></div>
             <div>
               <h3 className="text-lg font-semibold text-gray-800">سجل التكاليف التسويقية (Ad Costs)</h3>
               <p className="text-xs text-gray-500 mt-1">أدخل تكاليف الإعلانات للقنوات ليتم حساب (ROI) ونقطة التعادل لكل قناة بدقة.</p>
             </div>
           </div>

           <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8 bg-red-50/30 p-5 rounded-xl border border-red-100">
             <div>
               <label className="block text-xs font-bold text-gray-600 mb-1">التاريخ</label>
               <input type="date" required className="w-full p-2.5 border rounded-lg outline-none focus:ring-2 focus:ring-red-500 text-sm" value={date} onChange={e => setDate(e.target.value)} />
             </div>
             <div>
               <label className="block text-xs font-bold text-gray-600 mb-1">القناة المستهدفة (تطابق)</label>
               <input type="text" list="channel-suggestions" required placeholder="نفس اسم القناة في البكج" className="w-full p-2.5 border rounded-lg outline-none focus:ring-2 focus:ring-red-500 text-sm font-bold" value={channel} onChange={e => setChannel(e.target.value)} />
               <datalist id="channel-suggestions">
                 {existingChannels.map(c => <option key={c} value={c} />)}
               </datalist>
             </div>
             <div>
               <label className="block text-xs font-bold text-gray-600 mb-1">اسم الحملة (اختياري)</label>
               <input type="text" placeholder="مثال: دستور يوم 15" className="w-full p-2.5 border rounded-lg outline-none focus:ring-2 focus:ring-red-500 text-sm" value={campaign} onChange={e => setCampaign(e.target.value)} />
             </div>
             <div>
               <label className="block text-xs font-bold text-gray-600 mb-1">التكلفة (ريال)</label>
               <input type="number" required min="1" placeholder="مثال: 1500" className="w-full p-2.5 border rounded-lg outline-none focus:ring-2 focus:ring-red-500 text-sm" value={cost} onChange={e => setCost(e.target.value)} />
             </div>
             <div className="md:col-span-5 flex gap-4">
               <div className="flex-1">
                 <input type="text" placeholder="ملاحظات تفصيلية (اختياري)..." className="w-full p-2.5 border rounded-lg outline-none focus:ring-2 focus:ring-red-500 text-sm" value={note} onChange={e => setNote(e.target.value)} />
               </div>
               <button type="submit" disabled={isSyncing} className="bg-red-600 hover:bg-red-700 text-white px-8 py-2.5 rounded-lg font-bold text-sm transition-colors whitespace-nowrap shadow-sm">
                 إضافة التكلفة
               </button>
             </div>
           </form>

           <div className="overflow-x-auto border border-gray-200 rounded-xl">
             <table className="w-full text-right text-sm">
               <thead className="bg-gray-100 text-gray-600">
                 <tr>
                   <th className="p-3 font-bold border-b">التاريخ</th>
                   <th className="p-3 font-bold border-b">القناة</th>
                   <th className="p-3 font-bold border-b">الحملة</th>
                   <th className="p-3 font-bold border-b">التكلفة</th>
                   <th className="p-3 font-bold border-b">ملاحظات</th>
                   <th className="p-3 font-bold border-b text-center">إجراء</th>
                 </tr>
               </thead>
               <tbody className="divide-y divide-gray-100">
                 {adCosts.length === 0 ? <tr><td colSpan="6" className="p-8 text-center text-gray-400">لا توجد تكاليف مسجلة</td></tr> : 
                  adCosts.map(c => (
                   <tr key={c.id} className="hover:bg-gray-50">
                     <td className="p-3 text-gray-600">{c.date}</td>
                     <td className="p-3"><span className="bg-red-50 text-red-700 px-2 py-1 rounded text-xs font-bold border border-red-100">{c.channel}</span></td>
                     <td className="p-3 font-bold text-gray-800">{c.campaign || '-'}</td>
                     <td className="p-3 font-black text-red-600">{c.cost.toLocaleString()} ر.س</td>
                     <td className="p-3 text-xs text-gray-500">{c.note}</td>
                     <td className="p-3 text-center">
                       {deleteConfirmId === c.id ? (
                         <div className="flex justify-center gap-2">
                           <button onClick={() => handleDelete(c.id)} className="bg-red-600 text-white px-2 py-1 rounded text-xs">تأكيد</button>
                           <button onClick={() => setDeleteConfirmId(null)} className="bg-gray-200 px-2 py-1 rounded text-xs">إلغاء</button>
                         </div>
                       ) : (
                         <button onClick={() => setDeleteConfirmId(c.id)} className="text-gray-400 hover:text-red-500"><Trash2 size={16} /></button>
                       )}
                     </td>
                   </tr>
                 ))}
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

    const handleAddProduct = () => {
      const skuTrimmed = newSku.trim();
      if (!skuTrimmed || productDetails[skuTrimmed]) { alert("SKU غير صالح أو موجود مسبقاً"); return; }
      
      const newDetails = { ...productDetails };
      newDetails[skuTrimmed] = {
        sku: skuTrimmed, name: newName.trim() || skuTrimmed, openingStock: parseInt(newOpeningStock) || 0,
        openingDate: newOpeningDate || todayStr, unitCost: parseFloat(newCost) || 0, sellingPrice: parseFloat(newSellingPrice) || 0
      };
      
      updateSettingsInCloud(newDetails, packages);
      setNewSku(''); setNewName(''); setNewOpeningStock('0'); setNewCost('0'); setNewSellingPrice('0');
    };

    const handleSaveEditProduct = () => {
      const newDetails = { ...productDetails };
      newDetails[editingSku] = {
        ...newDetails[editingSku], name: editData.name, openingStock: parseInt(editData.openingStock) || 0,
        openingDate: editData.openingDate, unitCost: parseFloat(editData.unitCost) || 0, sellingPrice: parseFloat(editData.sellingPrice) || 0
      };
      updateSettingsInCloud(newDetails, packages);
      setEditingSku(null);
    };

    const handleDeleteProduct = (sku) => {
      if(safeConfirm(`هل أنت متأكد من حذف المنتج ${sku}؟`)) {
        const newDetails = { ...productDetails }; delete newDetails[sku];
        updateSettingsInCloud(newDetails, packages);
      }
    };

    const handleAddPackageItem = () => {
      if (!itemSelectSku) return;
      setPkgItems(prev => ({ ...prev, [itemSelectSku]: (prev[itemSelectSku] || 0) + parseInt(itemSelectQty) }));
      setItemSelectQty(1);
    };

    const handleRemovePackageItem = (sku) => {
      const newItems = { ...pkgItems }; delete newItems[sku]; setPkgItems(newItems);
    };

    const handleAddPackage = () => {
      if (!pkgCode.trim() || !pkgName.trim() || Object.keys(pkgItems).length === 0) {
        alert("يرجى إدخال كود البكج، واسمه، وإضافة منتج واحد على الأقل داخله."); return;
      }
      const newPackages = {
        ...packages,
        [pkgCode.trim()]: {
          name: pkgName.trim(), group: pkgGroup.trim() || pkgName.trim(),
          channel: pkgChannel.trim() || 'عام', price: parseFloat(pkgPrice) || 0, items: pkgItems
        }
      };
      updateSettingsInCloud(productDetails, newPackages);
      setPkgCode(''); setPkgName(''); setPkgGroup(''); setPkgChannel(''); setPkgPrice(''); setPkgItems({});
    };

    return (
      <div className="space-y-6 animate-in fade-in pb-10">
        
        {/* --- المنتجات --- */}
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm relative">
           {isSyncing && <div className="absolute inset-0 bg-white/50 backdrop-blur-sm flex items-center justify-center z-10"><Loader2 className="animate-spin text-blue-600" size={32} /></div>}
           <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2 border-b pb-4">
             <Package size={20} className="text-blue-600"/> التأسيس: إدارة المنتجات (الرصيد الافتتاحي والتكلفة والبيع)
           </h3>
           
           <div className="bg-blue-50 border-r-4 border-blue-500 p-4 rounded-l-lg mb-6 text-xs text-blue-800 leading-relaxed">
             <strong>القاعدة الذهبية:</strong> ضع الرصيد الافتتاحي الفعلي للمنتج وتاريخ الجرد. النظام <span className="font-bold underline">لن يخصم أو يجمع</span> أي مبيعات حدثت قبل هذا التاريخ لضمان عدم وجود خصم مزدوج!
           </div>

           {/* فورم إضافة منتج */}
           <div className="grid grid-cols-1 md:grid-cols-7 gap-3 bg-gray-50 p-4 rounded-xl border border-gray-200 mb-6">
             <div><label className="block text-[10px] font-bold text-gray-600 mb-1">SKU</label><input type="text" className="w-full p-2 border rounded text-sm" value={newSku} onChange={e=>setNewSku(e.target.value)} /></div>
             <div><label className="block text-[10px] font-bold text-gray-600 mb-1">اسم المنتج</label><input type="text" className="w-full p-2 border rounded text-sm" value={newName} onChange={e=>setNewName(e.target.value)} /></div>
             <div><label className="block text-[10px] font-bold text-gray-600 mb-1">المخزون الافتتاحي</label><input type="number" className="w-full p-2 border rounded text-sm" value={newOpeningStock} onChange={e=>setNewOpeningStock(e.target.value)} /></div>
             <div><label className="block text-[10px] font-bold text-gray-600 mb-1">تاريخ الافتتاح</label><input type="date" className="w-full p-2 border rounded text-sm" value={newOpeningDate} onChange={e=>setNewOpeningDate(e.target.value)} /></div>
             <div><label className="block text-[10px] font-bold text-gray-600 mb-1">التكلفة (ريال)</label><input type="number" className="w-full p-2 border rounded text-sm focus:border-green-500" value={newCost} onChange={e=>setNewCost(e.target.value)} /></div>
             <div><label className="block text-[10px] font-bold text-gray-600 mb-1">سعر البيع (ريال)</label><input type="number" className="w-full p-2 border rounded text-sm focus:border-blue-500" value={newSellingPrice} onChange={e=>setNewSellingPrice(e.target.value)} /></div>
             <div className="flex items-end"><button onClick={handleAddProduct} className="w-full bg-blue-600 text-white p-2 rounded text-sm font-bold hover:bg-blue-700">إضافة</button></div>
           </div>

           <div className="overflow-x-auto border border-gray-200 rounded-xl">
             <table className="w-full text-right text-sm">
               <thead className="bg-slate-100 text-slate-600 text-xs">
                 <tr>
                   <th className="p-3 border-b">SKU</th>
                   <th className="p-3 border-b">اسم المنتج</th>
                   <th className="p-3 border-b">الافتتاحي</th>
                   <th className="p-3 border-b">التاريخ</th>
                   <th className="p-3 border-b text-orange-700">التكلفة</th>
                   <th className="p-3 border-b text-green-700">البيع</th>
                   <th className="p-3 border-b text-center">إجراء</th>
                 </tr>
               </thead>
               <tbody className="divide-y divide-gray-100">
                 {Object.values(productDetails).map(p => (
                   <tr key={p.sku} className="hover:bg-gray-50">
                     <td className="p-3 font-mono font-bold text-gray-700">{p.sku}</td>
                     {editingSku === p.sku ? (
                       <>
                         <td className="p-2"><input type="text" className="w-full p-1 text-xs border" value={editData.name} onChange={e=>setEditData({...editData, name: e.target.value})} /></td>
                         <td className="p-2"><input type="number" className="w-20 p-1 text-xs border" value={editData.openingStock} onChange={e=>setEditData({...editData, openingStock: e.target.value})} /></td>
                         <td className="p-2"><input type="date" className="w-32 p-1 text-xs border" value={editData.openingDate} onChange={e=>setEditData({...editData, openingDate: e.target.value})} /></td>
                         <td className="p-2"><input type="number" className="w-16 p-1 text-xs border" value={editData.unitCost} onChange={e=>setEditData({...editData, unitCost: e.target.value})} /></td>
                         <td className="p-2"><input type="number" className="w-16 p-1 text-xs border" value={editData.sellingPrice} onChange={e=>setEditData({...editData, sellingPrice: e.target.value})} /></td>
                         <td className="p-2 text-center flex justify-center gap-2">
                           <button onClick={handleSaveEditProduct} className="bg-green-500 text-white p-1 rounded"><Check size={14}/></button>
                           <button onClick={() => setEditingSku(null)} className="bg-gray-400 text-white p-1 rounded"><X size={14}/></button>
                         </td>
                       </>
                     ) : (
                       <>
                         <td className="p-3 text-xs">{p.name}</td>
                         <td className="p-3 font-bold text-blue-600">{p.openingStock}</td>
                         <td className="p-3 text-xs text-gray-500">{p.openingDate}</td>
                         <td className="p-3 font-bold text-orange-600">{p.unitCost} ر.س</td>
                         <td className="p-3 font-bold text-green-600">{p.sellingPrice || 0} ر.س</td>
                         <td className="p-3 text-center flex justify-center gap-3">
                           <button onClick={() => { setEditingSku(p.sku); setEditData(p); }} className="text-blue-500"><Edit2 size={16}/></button>
                           <button onClick={() => handleDeleteProduct(p.sku)} className="text-gray-400 hover:text-red-500"><Trash2 size={16}/></button>
                         </td>
                       </>
                     )}
                   </tr>
                 ))}
               </tbody>
             </table>
           </div>
        </div>

        {/* --- البكجات --- */}
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm relative">
           <h3 className="text-lg font-semibold text-gray-800 mb-6 flex items-center gap-2 border-b pb-4">
             <PackageOpen size={20} className="text-purple-600"/> إدارة البكجات والتسعير
           </h3>

           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
             {Object.entries(packages).map(([code, pkg]) => (
               <div key={code} className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col relative group">
                 <div className="absolute top-3 left-3 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                   <button onClick={() => {
                     setPkgCode(code); setPkgName(pkg.name); setPkgGroup(pkg.group); setPkgChannel(pkg.channel); setPkgPrice(pkg.price); setPkgItems({...pkg.items});
                   }} className="text-blue-500 bg-white rounded p-1 shadow-sm border"><Edit2 size={14}/></button>
                   <button onClick={() => handleDeletePackage(code)} className="text-red-500 bg-white rounded p-1 shadow-sm border"><Trash2 size={14}/></button>
                 </div>

                 <div className="font-bold text-gray-800 mb-1 pr-6 truncate">{pkg.name}</div>
                 <div className="flex items-center gap-2 mb-3">
                    <div className="text-xs text-indigo-600 font-mono bg-indigo-50 px-2 py-0.5 rounded">{code}</div>
                    <div className="text-[10px] text-green-700 font-bold bg-green-50 px-2 py-0.5 border border-green-200 rounded">سعر البيع: {pkg.price} ر.س</div>
                 </div>
                 
                 <div className="space-y-1 mb-4 flex-1">
                   <div className="flex items-center gap-2 text-[10px] text-gray-500">
                     <span className="w-12">المجموعة:</span> <span className="font-bold text-gray-700 truncate">{pkg.group}</span>
                   </div>
                   <div className="flex items-center gap-2 text-[10px] text-gray-500">
                     <span className="w-12">القناة:</span> <span className="font-bold text-purple-700 bg-purple-50 px-1 rounded truncate">{pkg.channel}</span>
                   </div>
                 </div>

                 <div className="border-t pt-3">
                   <p className="text-[10px] text-gray-400 mb-2">مكونات البكج:</p>
                   <div className="flex flex-wrap gap-1">
                     {Object.entries(pkg.items).map(([sku, qty]) => (
                       <span key={sku} className="text-[10px] font-bold bg-white border border-gray-200 text-gray-600 px-1.5 py-0.5 rounded flex items-center gap-1">
                         <span dir="ltr">{sku}</span> <span className="text-blue-600 text-[8px]">x{qty}</span>
                       </span>
                     ))}
                   </div>
                 </div>
               </div>
             ))}
           </div>

           <div id="package-form" className={`rounded-xl border p-5 ${Object.keys(packages).includes(pkgCode.trim()) ? 'bg-blue-50 border-blue-200' : 'bg-gray-50 border-gray-200'}`}>
             <h4 className="font-bold text-sm mb-4">إنشاء / تعديل بكج</h4>
             <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
               <div><label className="block text-xs font-bold mb-1">كود البكج</label><input type="text" className="w-full p-2 border rounded text-sm font-mono" value={pkgCode} onChange={e=>setPkgCode(e.target.value)} disabled={Object.keys(packages).includes(pkgCode.trim())} /></div>
               <div><label className="block text-xs font-bold mb-1">اسم البكج</label><input type="text" className="w-full p-2 border rounded text-sm" value={pkgName} onChange={e=>setPkgName(e.target.value)} /></div>
               <div><label className="block text-xs font-bold mb-1">سعر البيع النهائي</label><input type="number" className="w-full p-2 border rounded text-sm focus:border-green-500" value={pkgPrice} onChange={e=>setPkgPrice(e.target.value)} /></div>
               <div><label className="block text-xs font-bold mb-1">المجموعة</label><input type="text" className="w-full p-2 border rounded text-sm" value={pkgGroup} onChange={e=>setPkgGroup(e.target.value)} /></div>
               <div><label className="block text-xs font-bold mb-1">القناة / المشهور</label><input type="text" className="w-full p-2 border rounded text-sm" value={pkgChannel} onChange={e=>setPkgChannel(e.target.value)} /></div>

               <div className="md:col-span-5 bg-white p-4 rounded-lg border mt-2">
                 <div className="flex flex-wrap items-center gap-3 mb-4">
                   <select className="p-2 border rounded text-sm flex-1" value={itemSelectSku} onChange={e=>setItemSelectSku(e.target.value)}>
                     {Object.keys(productDetails).map(sku => <option key={sku} value={sku}>{sku} - {productDetails[sku].name}</option>)}
                   </select>
                   <input type="number" min="1" className="w-20 p-2 border rounded text-sm" value={itemSelectQty} onChange={e=>setItemSelectQty(e.target.value)} />
                   <button onClick={handleAddPackageItem} className="bg-gray-800 text-white px-4 py-2 rounded text-sm font-bold">إدراج بالبكج</button>
                 </div>
                 {Object.keys(pkgItems).length > 0 && (
                   <div className="flex gap-2 pt-3 border-t">
                     {Object.entries(pkgItems).map(([sku, qty]) => (
                       <div key={sku} className="flex items-center gap-1 bg-purple-50 text-purple-800 px-2 py-1 rounded text-xs">
                         <span>{sku}</span> <span className="bg-white px-1 rounded text-[10px]">x{qty}</span>
                         <button onClick={()=>handleRemovePackageItem(sku)} className="text-red-500 ml-1"><X size={12}/></button>
                       </div>
                     ))}
                   </div>
                 )}
               </div>

               <div className="md:col-span-5 mt-2 flex gap-2">
                 <button onClick={handleAddPackage} className="flex-1 bg-purple-600 text-white p-3 rounded-lg font-bold">حفظ البكج</button>
               </div>
             </div>
           </div>
        </div>
      </div>
    );
  };

  const MovementForm = () => {
    const fileInputRef = useRef(null);
    const [importPreview, setImportPreview] = useState(null);
    const [importMode, setImportMode] = useState('sales');

    const defaultCode = Object.keys(productDetails)[0] || '';
    const defaultPkgCode = Object.keys(packages)[0] || '';
    
    const [formData, setFormData] = useState({ date: todayStr, level: 'منتج', code: defaultCode, type: MOVEMENT_TYPES[0].id, quantity: 1, reference: '', note: '' });

    useEffect(() => { setFormData(prev => ({ ...prev, code: prev.level === 'منتج' ? defaultCode : defaultPkgCode })); }, [productDetails, packages, formData.level]);

    const [deleteConfirmId, setDeleteConfirmId] = useState(null);

    const handleSubmit = async (e) => {
      e.preventDefault();
      await addMovementToCloud(formData);
      setFormData({ ...formData, quantity: 1, reference: '', note: '' });
    };

    const handleFileUpload = async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      try {
        const XLSX = await loadXLSX();
        const reader = new FileReader();
        
        reader.onload = async (event) => {
          const data = new Uint8Array(event.target.result);
          const workbook = XLSX.read(data, { type: 'array' });
          const rows = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { header: 1 });

          if(rows.length < 2) { alert('الملف فارغ أو غير صالح'); return; }

          const headers = rows[0].map(h => String(h || ''));
          const orderIdCol = headers.findIndex(h => h.includes('رقم الطلب') || h.includes('رقم'));
          const productCol = headers.findIndex(h => h.includes('نوع الطلب') || h.includes('المنتجات') || h.includes('اسم المنتج') || h.includes('اسماء'));
          const qtyCol = headers.findIndex(h => h.includes('الكمية') || h.includes('العدد') || h === 'Qty');
          const paymentCol = headers.findIndex(h => h.includes('طريقة الدفع') || h.includes('الدفع')); 

          const parsedMovements = [];
          
          for (let i = 1; i < rows.length; i++) {
            const row = rows[i];
            if(!row || row.length === 0) continue;
            
            let orderId = row[orderIdCol] ? String(row[orderIdCol]).replace(/["']/g, '').replace(/^\uFEFF/, '') : '';
            if(!orderId) continue;

            let productStr = productCol !== -1 ? String(row[productCol] || '') : '';
            let paymentStr = paymentCol !== -1 ? String(row[paymentCol] || '') : '';
            
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
              Object.keys(productDetails).forEach(sku => {
                if(productStr.includes(sku)) { mappedCode = sku; mappedLevel = 'منتج'; }
              });
            }
            if (!mappedCode) mappedCode = Object.keys(packages)[0] || Object.keys(productDetails)[0];

            let movType = 'بيع آلي (عبر الربط)'; 
            if (importMode === 'sales') {
               if (paymentStr.includes('تمارا') || paymentStr.includes('تابي')) movType = 'بيع (تمارا)';
               else if (paymentStr.includes('عند الاستلام') || paymentStr.includes('الدفع عند الاستلام')) movType = 'بيع (دفع عند الاستلام)';
               else if (paymentStr !== '') movType = 'بيع (دفع إلكتروني)';
            } else { movType = 'مرتجع (إلغاء رغبة العميل)'; }
            
            parsedMovements.push({
              date: todayStr, level: mappedLevel, code: mappedCode, type: movType, quantity: qty, reference: orderId,
              note: importMode === 'sales' ? 'استيراد مبيعات' : 'استيراد رجيع'
            });
          }

          setImportPreview(parsedMovements);
          if (fileInputRef.current) fileInputRef.current.value = '';
        };
        reader.readAsArrayBuffer(file);
      } catch (err) { alert('حدث خطأ أثناء قراءة الملف.'); }
    };

    const confirmImport = async () => {
      if(!importPreview || importPreview.length === 0) return;
      setIsSyncing(true);
      try {
        const batchSize = 100;
        for (let i = 0; i < importPreview.length; i += batchSize) {
          const chunk = importPreview.slice(i, i + batchSize);
          const batch = writeBatch(db);
          chunk.forEach((mov, index) => {
            const now = Date.now() + index; // Protection against ID collisions
            const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'movements', `mov_${now}_${Math.random().toString(36).slice(2, 7)}`);
            batch.set(docRef, { ...mov, timestamp: now });
          });
          await batch.commit();
        }
        alert(`تم رفع ${importPreview.length} حركة بنجاح!`); setImportPreview(null);
      } catch (e) { alert('خطأ أثناء رفع الملف.'); } finally { setIsSyncing(false); }
    };

    return (
      <div className="space-y-6 animate-in fade-in">
        <div className="bg-gradient-to-r from-blue-900 to-indigo-800 p-6 rounded-xl text-white relative shadow-sm">
          {importPreview && (
            <div className="absolute inset-0 bg-white/95 text-gray-800 z-20 rounded-xl p-6 flex flex-col shadow-xl">
               <h3 className="text-xl font-bold mb-2 flex items-center gap-2"><CheckCircle2 className="text-green-500"/> معاينة قبل الحفظ</h3>
               <p className="text-sm text-gray-500 mb-4">تم العثور على <b>{importPreview.length}</b> طلب. سيتم إدراجها كـ <span className="font-bold bg-blue-500 px-2 py-0.5 rounded text-white">{importMode === 'sales' ? 'مبيعات' : 'مرتجعات'}</span>.</p>
               <div className="flex-1 overflow-auto border rounded-lg bg-gray-50 p-2 mb-4 custom-scrollbar">
                  <table className="w-full text-right text-xs">
                    <thead><tr className="text-gray-400 border-b bg-gray-100"><th className="p-2">المرجع</th><th className="p-2">الكود</th><th className="p-2">الكمية</th><th className="p-2">النوع</th></tr></thead>
                    <tbody>
                      {importPreview.slice(0, 20).map((m, i) => (
                        <tr key={i} className="border-b"><td className="p-2 font-mono">{m.reference}</td><td className="p-2 font-bold text-indigo-600">{m.code}</td><td className="p-2">{m.quantity}</td><td className="p-2 text-[10px]">{m.type}</td></tr>
                      ))}
                    </tbody>
                  </table>
               </div>
               <div className="flex gap-3">
                 <button onClick={confirmImport} disabled={isSyncing} className="flex-1 bg-green-600 text-white font-bold py-3 rounded-lg">تأكيد وحفظ</button>
                 <button onClick={() => setImportPreview(null)} disabled={isSyncing} className="bg-gray-200 text-gray-800 font-bold py-3 px-6 rounded-lg">إلغاء</button>
               </div>
            </div>
          )}

          <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
            <div>
              <h3 className="text-lg font-bold flex items-center gap-2 mb-1"><FileSpreadsheet size={20} /> استيراد ذكي لملفات الإكسل (XLSX / CSV)</h3>
              <p className="text-indigo-200 text-xs max-w-xl mb-4">ارفع ملفات المبيعات أو الدعم الفني. النظام يقرأها أوتوماتيكياً ويربطها بالبكجات.</p>
              <div className="flex items-center gap-4 bg-indigo-950/50 p-2 rounded-lg w-fit">
                <label className="flex items-center gap-2 text-sm cursor-pointer"><input type="radio" checked={importMode === 'sales'} onChange={() => setImportMode('sales')} className="accent-blue-500" /><span>ملف مبيعات</span></label>
                <label className="flex items-center gap-2 text-sm cursor-pointer"><input type="radio" checked={importMode === 'returns'} onChange={() => setImportMode('returns')} className="accent-red-500" /><span className="text-red-200">ملف رجيع</span></label>
              </div>
            </div>
            <div>
               <input type="file" accept=".csv, .xlsx, .xls" ref={fileInputRef} onChange={handleFileUpload} className="hidden" id="csv-upload" />
               <label htmlFor="csv-upload" className="cursor-pointer flex items-center gap-2 bg-white text-indigo-900 px-5 py-3 rounded-lg font-bold text-sm shadow-md hover:bg-indigo-50"><UploadCloud size={18} /> رفع الملف</label>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
          <h3 className="text-lg font-semibold mb-4 border-b pb-2 flex justify-between items-center">
            <span>إدخال يدوي</span>
          </h3>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div><label className="block text-xs font-bold mb-1">التاريخ</label><input type="date" required className="w-full p-2 border rounded" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} /></div>
            <div><label className="block text-xs font-bold mb-1">المستوى</label><select className="w-full p-2 border rounded" value={formData.level} onChange={e => setFormData({...formData, level: e.target.value})}><option value="منتج">منتج فردي</option><option value="بكج">بكج / عرض</option></select></div>
            <div>
              <label className="block text-xs font-bold mb-1">الكود</label>
              <select className="w-full p-2 border rounded" value={formData.code} onChange={e => setFormData({...formData, code: e.target.value})} required>
                {formData.level === 'منتج' 
                  ? Object.keys(productDetails).map(p => <option key={p} value={p}>{p}</option>)
                  : Object.keys(packages).map(p => <option key={p} value={p}>{p} - {packages[p].name}</option>)
                }
              </select>
            </div>
            <div><label className="block text-xs font-bold mb-1">نوع الحركة</label><select className="w-full p-2 border rounded" value={formData.type} onChange={e => setFormData({...formData, type: e.target.value})}>{MOVEMENT_TYPES.map(t => <option key={t.id} value={t.id}>{t.id}</option>)}</select></div>
            <div><label className="block text-xs font-bold mb-1">الكمية</label><input type="number" min="1" required className="w-full p-2 border rounded" value={formData.quantity} onChange={e => setFormData({...formData, quantity: e.target.value})} /></div>
            <div><label className="block text-xs font-bold mb-1">المرجع</label><input type="text" className="w-full p-2 border rounded" value={formData.reference} onChange={e => setFormData({...formData, reference: e.target.value})} /></div>
            <div className="md:col-span-2"><label className="block text-xs font-bold mb-1">ملاحظات</label><input type="text" className="w-full p-2 border rounded" value={formData.note} onChange={e => setFormData({...formData, note: e.target.value})} /></div>
            <div className="md:col-span-4 mt-2"><button type="submit" disabled={isSyncing} className="w-full bg-blue-600 text-white p-3 rounded-lg font-bold flex justify-center gap-2"><Plus size={20} /> تسجيل الحركة</button></div>
          </form>
        </div>
      </div>
    );
  };

  const renderDashboard = () => (
    <div className="space-y-6 animate-in fade-in">
      {/* Header & Date Filter */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 w-full lg:w-auto">
          <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg hidden sm:block"><Activity size={24} /></div>
          <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap">
            <div><p className="text-[10px] text-gray-500 font-bold mb-1">فترة التقرير</p><select className="border rounded-md p-1.5 text-sm font-bold bg-gray-50" value={periodType} onChange={(e) => setPeriodType(e.target.value)}><option value="day">يوم واحد</option><option value="week">أسبوع</option><option value="month">شهر</option><option value="custom">مخصصة</option></select></div>
            {periodType === 'custom' && <div><p className="text-[10px] text-gray-500 font-bold mb-1">من تاريخ</p><input type="date" className="border rounded-md p-1.5 text-sm font-bold bg-gray-50" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></div>}
            <div><p className="text-[10px] text-gray-500 font-bold mb-1">{periodType === 'custom' ? 'إلى تاريخ' : 'التاريخ'}</p><input type="date" className="border rounded-md p-1.5 text-sm font-bold bg-gray-50" value={endDate} onChange={(e) => setEndDate(e.target.value)} /></div>
          </div>
        </div>
        <button onClick={handleExportExcel} className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg font-bold text-sm w-full sm:w-auto justify-center"><Download size={16} /> تصدير التقرير المالي</button>
      </div>

      {/* Decision Engine Panel (المحرك الذكي للقرارات) 🔥 */}
      {businessDecisions.length > 0 && (
        <div className="bg-gradient-to-r from-slate-900 to-slate-800 rounded-xl shadow-lg border border-slate-700 overflow-hidden">
          <div className="p-3 bg-white/10 border-b border-white/5 flex items-center gap-2 text-white">
            <Lightbulb size={20} className="text-yellow-400" />
            <h3 className="font-bold text-sm">محرك القرارات الذكي (Decision Engine)</h3>
          </div>
          <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
            {businessDecisions.map((decision, i) => (
              <div key={i} className={`flex items-start gap-3 p-3 rounded-lg border ${decision.color}`}>
                <div className="mt-0.5">
                   {decision.iconType === 'stop' && <X size={16}/>}
                   {decision.iconType === 'scale' && <TrendingUp size={16}/>}
                   {decision.iconType === 'warning' && <AlertTriangle size={16}/>}
                   {decision.iconType === 'product-good' && <CheckCircle2 size={16}/>}
                   {decision.iconType === 'product-bad' && <AlertOctagon size={16}/>}
                </div>
                <div className="text-xs font-bold leading-relaxed">{decision.msg}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Smart Alerts */}
      {smartAlerts.length > 0 && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-r-lg flex flex-col gap-2">
          <div className="flex items-center gap-2 text-red-800 font-bold"><BellRing size={18} className="animate-pulse" /> تنبيهات تشغيلية</div>
          <div className="space-y-1">
            {smartAlerts.map((alert, i) => (
              <div key={i} className={`text-xs font-bold flex items-center gap-2 ${alert.type === 'critical' ? 'text-red-700' : 'text-orange-700'}`}><AlertOctagon size={14} /> {alert.msg}</div>
            ))}
          </div>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { title: "صافي المبيعات (حبة)", value: dashboardStats.netSales, icon: <Package size={20}/>, color: "blue" },
          { title: "الإيرادات", value: `${dashboardStats.totalRevenue.toLocaleString()} ر.س`, icon: <DollarSign size={20}/>, color: "emerald" },
          { title: "تكاليف التسويق", value: `${dashboardStats.totalAdCost.toLocaleString()} ر.س`, icon: <Megaphone size={20}/>, color: "orange" },
          { title: "صافي الربح", value: `${dashboardStats.netProfit.toLocaleString()} ر.س`, icon: <TrendingUp size={20}/>, color: "purple" }
        ].map((card, i) => (
          <div key={i} className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition group relative overflow-hidden">
            <div className={`absolute top-0 right-0 w-1 h-full bg-${card.color}-500`}></div>
            <div className="flex justify-between items-start mb-2">
               <p className="text-xs text-gray-500 font-bold">{card.title}</p>
               <div className={`p-1.5 rounded-lg bg-${card.color}-50 text-${card.color}-600`}>{card.icon}</div>
            </div>
            <h2 className={`text-2xl font-black text-${card.color}-700`}>{card.value}</h2>
          </div>
        ))}
      </div>

      {/* Simulator Section (محاكي الأرباح) 🔥 */}
      <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex flex-col md:flex-row items-center gap-6">
        <div className="flex flex-col flex-1 w-full">
          <h3 className="font-bold text-gray-800 mb-2 flex items-center gap-2"><Zap size={18} className="text-yellow-500" /> محاكي الأرباح (Scenario Simulator)</h3>
          <label className="block text-xs font-bold text-gray-600 mb-2">ماذا لو قمنا برفع أسعار البيع بنسبة: <span className="text-blue-600 text-sm">{simulatorBoost}%</span></label>
          <input type="range" min="0" max="50" step="1" value={simulatorBoost} onChange={e => setSimulatorBoost(Number(e.target.value))} className="w-full accent-blue-600" />
        </div>
        {simulatorBoost > 0 && simulatedStats && (
          <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 flex justify-between items-center w-full md:w-1/3">
            <span className="text-xs font-bold text-blue-800">الأرباح الصافية<br/>المتوقعة:</span>
            <div className="text-left">
              <div className="text-sm font-black text-green-600" title="قيمة الزيادة في الأرباح">+{simulatedStats.diff.toLocaleString()} ر.س</div>
              <div className="text-xl font-black text-blue-700">{simulatedStats.newProfit.toLocaleString()} ر.س</div>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Trend Chart */}
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex flex-col">
          <h3 className="font-bold text-gray-800 mb-6 flex items-center gap-2"><BarChart3 size={18} className="text-blue-600" /> حركة المبيعات (آخر 7 أيام)</h3>
          {trendData.length === 0 || trendData.every(d => d.sales === 0) ? (
            <div className="flex items-center justify-center h-48 text-gray-400 text-sm font-bold bg-gray-50 rounded-lg border border-dashed border-gray-200">لا توجد بيانات كافية لعرض الرسم البياني</div>
          ) : (
            <div className="flex items-end gap-2 h-48 pt-6 mt-auto">
              {trendData.map((d, index) => {
                const heightPercent = maxSalesInTrend > 0 ? (d.sales / maxSalesInTrend) * 100 : 0;
                return (
                  <div key={index} className="flex-1 flex flex-col items-center gap-2 group">
                    <div className="w-full max-w-[40px] bg-blue-50 rounded-t-md relative flex items-end justify-center h-full border-b border-blue-100">
                      <div className="w-full bg-blue-500 rounded-t-md transition-all duration-700 ease-out group-hover:bg-blue-600 shadow-sm" style={{ height: `${heightPercent}%`, minHeight: d.sales > 0 ? '4px' : '0' }}></div>
                      <span className="absolute -top-6 text-xs font-bold text-gray-700 opacity-80 group-hover:opacity-100 transition-all">{d.sales}</span>
                    </div>
                    <span className="text-[10px] text-gray-500 font-medium truncate w-full text-center" dir="ltr">{d.date.substring(5)}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Product Intelligence (ذكاء المنتجات الفردية) 🔥 */}
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex flex-col max-h-[300px] overflow-hidden">
          <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2 shrink-0"><Target size={18} className="text-blue-600" /> ذكاء المنتجات الفردية (أرباح الـ SKUs)</h3>
          <div className="flex-1 flex flex-col gap-4 overflow-y-auto pr-2 custom-scrollbar">
            {productStats.length === 0 || productStats.every(p => p.sales === 0) ? (
              <p className="text-sm text-gray-400 text-center mt-10">لا توجد مبيعات فردية مسجلة</p>
            ) : (
              <div className="space-y-3">
                {productStats.filter(p => p.sales !== 0 || p.profit !== 0).map((p, pIdx) => {
                  const isProfitable = p.profit >= 0;
                  return (
                    <div key={pIdx} className={`p-3 rounded-xl border ${isProfitable ? 'bg-slate-50 border-slate-100' : 'bg-red-50 border-red-100'} shrink-0`}>
                      <h4 className="text-xs font-black text-slate-700 border-b border-slate-200 pb-2 flex justify-between">
                        <span>{p.name} <span className="text-[10px] font-normal text-gray-400 ml-1">({p.sku})</span></span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${isProfitable ? 'text-green-700 bg-green-50 border-green-200' : 'text-red-700 bg-red-50 border-red-200'}`}>
                          {isProfitable ? `الربح: ${p.profit.toLocaleString()} ر.س` : `خسارة: ${Math.abs(p.profit).toLocaleString()} ر.س`}
                        </span>
                      </h4>
                      <div className="flex justify-between items-center text-[10px] font-bold mt-2 text-gray-600">
                        <span>المبيعات: <span className="text-blue-600">{p.sales} حبة</span></span>
                        <span>الإيرادات: <span className="text-gray-800">{p.revenue.toLocaleString()} ر.س</span></span>
                        <span>التكلفة: <span className="text-orange-600">{p.cost.toLocaleString()} ر.س</span></span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ROI by Channel Section (Updated with AI Ranking) */}
      <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex flex-col">
        <h3 className="font-bold text-gray-800 mb-6 flex items-center gap-2"><TrendingUp size={18} className="text-purple-600" /> لوحة قياس العائد التسويقي الشامل (ROI) ونقاط التعادل</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Object.keys(channelStats).length === 0 && <p className="text-sm text-gray-400 text-center col-span-full">لا توجد بيانات</p>}
          {Object.entries(channelStats)
            .filter(([ch]) => ch !== 'مبيعات المنتجات الفردية' && ch !== 'غير محدد')
            .sort((a, b) => b[1].score - a[1].score) // تم الترتيب بالذكاء الاصطناعي بدلاً من الربح فقط
            .map(([ch, data], gIdx) => {
            const roiColor = data.roi >= 3 ? 'text-green-700 bg-green-50 border-green-200' : (data.roi >= 2 ? 'text-yellow-700 bg-yellow-50 border-yellow-200' : 'text-red-700 bg-red-50 border-red-200');
            const profitText = data.netProfit >= 0 ? `الربح: ${data.netProfit.toLocaleString()} ر.س` : `خسارة: ${Math.abs(data.netProfit).toLocaleString()} ر.س`;
            const profitColor = data.netProfit >= 0 ? 'text-green-600' : 'text-red-600';

            return (
              <div key={gIdx} className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-col justify-between">
                <div className="mb-4">
                  <h4 className="text-sm font-black text-slate-800 flex justify-between items-center mb-2">
                    <span className="flex items-center gap-1">{gIdx === 0 && '🏆'} {ch}</span>
                    <span className={`text-[10px] font-bold px-2 py-1 rounded border ${roiColor}`}>ROI: {data.roi === Infinity ? 'عضوي' : data.roi.toFixed(1) + 'x'}</span>
                  </h4>
                  <div className="grid grid-cols-2 gap-2 text-[11px] font-bold text-gray-600">
                    <div className="bg-white p-2 rounded border">الإيرادات:<br/><span className="text-gray-800 text-xs">{data.revenue.toLocaleString()}</span></div>
                    <div className="bg-white p-2 rounded border">تكلفة الإعلان:<br/><span className="text-orange-600 text-xs">{data.adCost.toLocaleString()}</span></div>
                    <div className="bg-white p-2 rounded border">الربح للطلب:<br/><span className="text-green-600 text-xs">{data.profitPerOrder.toFixed(2)} ر.س</span></div>
                    <div className="bg-white p-2 rounded border">نسبة الاسترجاع:<br/><span className="text-red-600 text-xs">{(data.returnRate * 100).toFixed(1)}%</span></div>
                    <div className="bg-white p-2 rounded border col-span-2 flex justify-between items-center">
                      <span>نقطة التعادل (للتغطية):</span>
                      <span className="text-blue-700 text-xs">{data.breakEvenUnits > 0 ? `${data.breakEvenUnits} طلبات` : '-'}</span>
                    </div>
                  </div>
                </div>
                <div className={`pt-3 border-t border-slate-200 flex justify-between items-center text-xs font-black ${profitColor}`}>
                  <span>الصافي النهائي:</span>
                  <span className="text-sm">{profitText}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 font-sans" dir="rtl">
      {/* Navbar */}
      <nav className="bg-slate-900 text-white shadow-lg sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 bg-white rounded-lg flex items-center justify-center overflow-hidden p-1 shadow-sm">
                 <img src="/logo.png" alt="أسباركل" className="w-full h-full object-contain" onError={(e) => { e.target.onerror = null; e.target.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="%233b82f6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>'; }}/>
              </div>
              <div className="flex flex-col">
                <span className="font-bold text-lg tracking-wide leading-none">أسباركل | Control Tower</span>
              </div>
            </div>
            
            <div className="hidden md:flex space-x-1 space-x-reverse items-center">
              <button onClick={() => setActiveTab('dashboard')} className={`px-3 py-2 rounded-md flex items-center gap-2 text-sm font-bold ${activeTab === 'dashboard' ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-800'}`}><LayoutDashboard size={16} /> اللوحة</button>
              {(currentUserRole === 'admin' || currentUserRole === 'editor') && (
                <>
                  <button onClick={() => setActiveTab('movements')} className={`px-3 py-2 rounded-md flex items-center gap-2 text-sm font-bold ${activeTab === 'movements' ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-800'}`}><ArrowRightLeft size={16} /> الحركات</button>
                  <button onClick={() => setActiveTab('adcosts')} className={`px-3 py-2 rounded-md flex items-center gap-2 text-sm font-bold ${activeTab === 'adcosts' ? 'bg-red-600 text-white' : 'text-slate-300 hover:bg-slate-800'}`}><Megaphone size={16} /> التسويق</button>
                </>
              )}
              {currentUserRole === 'admin' && (
                <>
                  <button onClick={() => setActiveTab('definitions')} className={`px-3 py-2 rounded-md flex items-center gap-2 text-sm font-bold ${activeTab === 'definitions' ? 'bg-purple-600 text-white' : 'text-slate-300 hover:bg-slate-800'}`}><Tags size={16} /> الإعدادات</button>
                  <button onClick={() => setActiveTab('users')} className={`px-3 py-2 rounded-md flex items-center gap-2 text-sm font-bold ${activeTab === 'users' ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-800'}`}><Users size={16} /> الصلاحيات</button>
                </>
              )}
            </div>
          </div>
        </div>
      </nav>

      <div className="md:hidden flex bg-white border-b overflow-x-auto scrollbar-hide">
        <button onClick={() => setActiveTab('dashboard')} className={`flex-1 px-4 py-3 text-xs flex justify-center items-center gap-1 ${activeTab === 'dashboard' ? 'border-b-2 border-blue-600 text-blue-600 font-bold' : 'text-gray-500'}`}>اللوحة</button>
        {(currentUserRole === 'admin' || currentUserRole === 'editor') && (
          <>
            <button onClick={() => setActiveTab('movements')} className={`flex-1 px-4 py-3 text-xs flex justify-center items-center gap-1 ${activeTab === 'movements' ? 'border-b-2 border-blue-600 text-blue-600 font-bold' : 'text-gray-500'}`}>الحركات</button>
            <button onClick={() => setActiveTab('adcosts')} className={`flex-1 px-4 py-3 text-xs flex justify-center items-center gap-1 ${activeTab === 'adcosts' ? 'border-b-2 border-red-600 text-red-600 font-bold' : 'text-gray-500'}`}>التسويق</button>
          </>
        )}
        {currentUserRole === 'admin' && (
          <button onClick={() => setActiveTab('definitions')} className={`flex-1 px-4 py-3 text-xs flex justify-center items-center gap-1 ${activeTab === 'definitions' ? 'border-b-2 border-purple-600 text-purple-600 font-bold' : 'text-gray-500'}`}>إعدادات</button>
        )}
      </div>

      <main className="max-w-7xl mx-auto px-2 md:px-6 py-6">
        {activeTab === 'dashboard' && renderDashboard()}
        {activeTab === 'movements' && <MovementForm />}
        {activeTab === 'adcosts' && <AdCostsTab />}
        {activeTab === 'definitions' && <DefinitionsTab />}
        {activeTab === 'users' && <UsersManagementTab />}
      </main>
      
      <style dangerouslySetInnerHTML={{__html: `@import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800;900&display=swap'); body { font-family: 'Tajawal', sans-serif; } .scrollbar-hide::-webkit-scrollbar { display: none; } .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }`}} />
    </div>
  );
}
