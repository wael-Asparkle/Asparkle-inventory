import React, { useState, useMemo, useEffect } from 'react';
import { 
  LayoutDashboard, 
  Package, 
  ArrowRightLeft, 
  ClipboardList, 
  Plus,
  AlertTriangle,
  CheckCircle2,
  PackageOpen,
  Cloud,
  CloudOff,
  Loader2,
  Settings,
  Link2,
  CalendarDays,
  Download,
  BarChart3,
  Trash2
} from 'lucide-react';

// --- إعدادات قاعدة البيانات السحابية (Firebase) ---
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, doc, setDoc, deleteDoc, onSnapshot } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyCeHc-P80oM5hjc7yugdk-YVcRGnz8NOhE",
  authDomain: "asparkle-inventory.firebaseapp.com",
  projectId: "asparkle-inventory",
  storageBucket: "asparkle-inventory.firebasestorage.app",
  messagingSenderId: "75571875301",
  appId: "1:75571875301:web:bfe0465065e134d77cf30c"
};
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-inventory-app';

// --- البيانات الأساسية ---
const PRODUCTS = ['9000901', '9000902', '9000904', '9000905', '9000906', '9000908', '9000909'];

const PACKAGES = {
  'asg001': { 
    name: 'asg001', 
    items: { '9000901': 1, '9000902': 1 } 
  },
  'asg002': { 
    name: 'بكج الـ 7 عطور', 
    items: { '9000904': 1, '9000905': 1, '9000906': 1, '9000908': 1, '9000909': 1 } 
  }
};

const MOVEMENT_TYPES = [
  { id: 'بيع', type: 'out' },
  { id: 'مرتجع', type: 'in' },
  { id: 'رفض استلام - رجوع للمخزون', type: 'in' },
  { id: 'تلف', type: 'out' },
  { id: 'تعديل يدوي (نقص)', type: 'out' },
  { id: 'تعديل يدوي (زيادة)', type: 'in' },
  { id: 'دخول بضاعة', type: 'in' },
  { id: 'بيع آلي (عبر الربط)', type: 'out'}
];

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  
  // --- التحديث الجديد: جعل التاريخ ديناميكي ويتحدث تلقائياً ---
  const [todayStr, setTodayStr] = useState(() => new Date().toISOString().split('T')[0]);
  const [selectedDate, setSelectedDate] = useState(todayStr);

  // ساعة داخلية للتحقق من تغير اليوم (عند منتصف الليل)
  useEffect(() => {
    const timer = setInterval(() => {
      const currentDay = new Date().toISOString().split('T')[0];
      if (currentDay !== todayStr) {
        setTodayStr(currentDay);
        // إذا كان المستخدم يراقب "اليوم"، اجعل اللوحة تنتقل لليوم الجديد تلقائياً
        setSelectedDate(prev => prev === todayStr ? currentDay : prev);
      }
    }, 60000); // يتحقق كل دقيقة
    return () => clearInterval(timer);
  }, [todayStr]);
  // -------------------------------------------------------------

  // حالات الاتصال وقاعدة البيانات
  const [user, setUser] = useState(null);
  const [movements, setMovements] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [authError, setAuthError] = useState(null);

  // حالات شاشة تسجيل الدخول
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // 1. تسجيل الدخول والمصادقة
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        setAuthError(null);
      } else {
        setUser(null);
      }
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    setIsLoggingIn(true);
    setLoginError('');
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
      console.error("Login error:", error);
      setLoginError('البريد الإلكتروني أو كلمة المرور غير صحيحة.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  // 2. جلب البيانات من السحابة في الوقت الفعلي
  useEffect(() => {
    if (!user) return;
    setIsLoading(true);

    const movementsCollection = collection(db, 'artifacts', appId, 'public', 'data', 'movements');
    
    const unsubscribe = onSnapshot(movementsCollection, (snapshot) => {
      const fetchedMovements = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      fetchedMovements.sort((a, b) => b.timestamp - a.timestamp);
      
      setMovements(fetchedMovements);
      setIsLoading(false);
    }, (error) => {
      console.error("خطأ في جلب البيانات:", error);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  // دالة لإضافة حركة جديدة للسحابة
  const addMovementToCloud = async (data) => {
    if (!user) return;
    setIsSyncing(true);
    try {
      const movementId = `mov_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
      const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'movements', movementId);
      
      await setDoc(docRef, {
        ...data,
        timestamp: Date.now()
      });
    } catch (error) {
      console.error("خطأ في الحفظ:", error);
      setAuthError("حدث خطأ أثناء حفظ البيانات. تأكد من صلاحيات قاعدة البيانات.");
    } finally {
      setIsSyncing(false);
    }
  };

  // دالة لحذف حركة
  const deleteMovementFromCloud = async (id) => {
    if (!user) return;
    setIsSyncing(true);
    try {
      const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'movements', id);
      await deleteDoc(docRef);
    } catch (error) {
      console.error("خطأ في الحذف:", error);
      setAuthError("حدث خطأ أثناء محاولة الحذف.");
    } finally {
      setIsSyncing(false);
    }
  };

  // --- الحسابات المبنية على "التاريخ المختار" ---

  const uniqueDates = useMemo(() => {
    const dates = new Set(movements.map(m => m.date));
    dates.add(todayStr); // todayStr يتحدث تلقائياً الآن
    return Array.from(dates).sort((a, b) => b.localeCompare(a));
  }, [movements, todayStr]);

  const movementsUpToDate = useMemo(() => {
    return movements.filter(m => m.date <= selectedDate);
  }, [movements, selectedDate]);

  const movementsOnDate = useMemo(() => {
    return movements.filter(m => m.date === selectedDate);
  }, [movements, selectedDate]);

  const stockAsOfDate = useMemo(() => {
    let stock = {};
    PRODUCTS.forEach(p => stock[p] = 0);

    movementsUpToDate.forEach(mov => {
      const isOut = MOVEMENT_TYPES.find(t => t.id === mov.type)?.type === 'out';
      const multiplier = isOut ? -1 : 1;
      const qty = parseInt(mov.quantity) || 0;

      if (mov.level === 'منتج') {
        if (stock[mov.code] !== undefined) {
          stock[mov.code] += (qty * multiplier);
        }
      } else if (mov.level === 'بكج' && PACKAGES[mov.code]) {
        const pkgItems = PACKAGES[mov.code].items;
        Object.entries(pkgItems).forEach(([sku, requiredQty]) => {
          if (stock[sku] !== undefined) {
            stock[sku] += (qty * requiredQty * multiplier);
          }
        });
      }
    });
    return stock;
  }, [movementsUpToDate]);

  const packageAvailabilityAsOfDate = useMemo(() => {
    let availability = {};
    Object.entries(PACKAGES).forEach(([pkgCode, pkg]) => {
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
  }, [stockAsOfDate]);

  const dashboardStats = useMemo(() => {
    let totalStock = Object.values(stockAsOfDate).reduce((a, b) => a + b, 0);
    let totalSkuSales = 0;
    let totalPkgSales = 0;
    let totalReturns = 0;

    movementsOnDate.forEach(m => {
      const isSale = m.type === 'بيع' || m.type === 'بيع آلي (عبر الربط)';
      const isReturn = m.type === 'مرتجع' || m.type.includes('رفض استلام');

      if (isSale && m.level === 'منتج') totalSkuSales += parseInt(m.quantity);
      if (isSale && m.level === 'بكج') totalPkgSales += parseInt(m.quantity);
      if (isReturn) totalReturns += parseInt(m.quantity);
    });

    return { totalStock, totalSkuSales, totalPkgSales, totalReturns };
  }, [stockAsOfDate, movementsOnDate]);

  const getDailyItemStats = (code, level) => {
    let sales = 0;
    let returns = 0;
    movementsOnDate.forEach(m => {
      if (m.code === code && m.level === level) {
        const isSale = m.type === 'بيع' || m.type === 'بيع آلي (عبر الربط)';
        const isReturn = m.type === 'مرتجع' || m.type.includes('رفض استلام');
        if (isSale) sales += parseInt(m.quantity);
        if (isReturn) returns += parseInt(m.quantity);
      }
    });
    return { sales, returns, net: sales - returns };
  };

  const handleExportCSV = () => {
    let csvContent = "data:text/csv;charset=utf-8,\uFEFF"; 
    
    csvContent += `تقرير أسباركل للمخزون والمبيعات\n`;
    csvContent += `تاريخ التقرير:,${selectedDate}\n\n`;

    csvContent += `المؤشرات العامة\n`;
    csvContent += `إجمالي مخزون المنتجات,${dashboardStats.totalStock}\n`;
    csvContent += `إجمالي بيع المنتجات المسجل,${dashboardStats.totalSkuSales}\n`;
    csvContent += `صافي بيع البكجات المسجل,${dashboardStats.totalPkgSales}\n`;
    csvContent += `إجمالي الرجوعات المسجلة,${dashboardStats.totalReturns}\n\n`;

    csvContent += `تحليل المنتجات الفردية\n`;
    csvContent += `SKU,مخزون اليوم,مبيعات فعلية,رجوعات/رفض,صافي المبيعات,الحالة\n`;
    PRODUCTS.forEach(sku => {
      const qty = stockAsOfDate[sku] || 0;
      const stats = getDailyItemStats(sku, 'منتج');
      const status = qty > 150 ? 'جيد' : (qty > 50 ? 'متوسط' : 'منخفض');
      csvContent += `${sku},${qty},${stats.sales},${stats.returns},${stats.net},${status}\n`;
    });
    csvContent += `\n`;

    csvContent += `تحليل البكجات والعروض\n`;
    csvContent += `كود البكج,اسم البكج,أقصى بيع ممكن,مبيعات فعلية,رجوعات/رفض,صافي المبيعات,القرار\n`;
    Object.entries(packageAvailabilityAsOfDate).forEach(([code, data]) => {
      const stats = getDailyItemStats(code, 'بكج');
      const decision = data.max > 150 ? 'حملات قوية' : (data.max > 50 ? 'بحذر' : 'إيقاف/توريد');
      csvContent += `${code},${PACKAGES[code].name},${data.max},${stats.sales},${stats.returns},${stats.net},${decision}\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `تقرير_اسباركل_${selectedDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const trendData = useMemo(() => {
    const last7Dates = uniqueDates.slice(0, 7).reverse();
    
    return last7Dates.map(d => {
      let dailySales = 0;
      movements.forEach(m => {
        if (m.date === d && (m.type === 'بيع' || m.type === 'بيع آلي (عبر الربط)')) {
          dailySales += parseInt(m.quantity);
        }
      });
      return { date: d, sales: dailySales };
    });
  }, [uniqueDates, movements]);

  const maxSalesInTrend = Math.max(...trendData.map(d => d.sales), 1); 

  // --- مكونات الواجهة ---

  const renderDashboard = () => (
    <div className="space-y-6 animate-in fade-in">
      
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
            <CalendarDays size={24} />
          </div>
          <div className="flex-1">
            <p className="text-xs text-gray-500 font-bold mb-1">التاريخ المختار للوحة</p>
            {/* التعديل هنا: تحويل القائمة المنسدلة إلى أداة اختيار تاريخ */}
            <input 
              type="date"
              className="border-gray-300 rounded-md border p-2 text-sm font-bold bg-gray-50 focus:ring-2 focus:ring-blue-500 outline-none w-full"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
            />
          </div>
        </div>
        
        <div className="flex items-center gap-4 w-full md:w-auto justify-between md:justify-end">
          <div className="text-right text-sm">
            <span className="text-gray-500 block text-xs">آخر تاريخ مسجل:</span>
            <span className="font-bold text-gray-800" dir="ltr">{uniqueDates[0] || todayStr}</span>
          </div>
          <button 
            onClick={handleExportCSV}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg font-bold text-sm transition-colors shadow-sm"
          >
            <Download size={16} />
            تصدير التقرير
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
          <p className="text-xs text-gray-500 mb-1 font-bold">إجمالي مخزون المنتجات</p>
          <h3 className="text-2xl font-black text-gray-800">{dashboardStats.totalStock}</h3>
        </div>
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
          <p className="text-xs text-gray-500 mb-1 font-bold">بيع المنتجات المسجل</p>
          <h3 className="text-2xl font-black text-blue-600">{dashboardStats.totalSkuSales}</h3>
        </div>
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
          <p className="text-xs text-gray-500 mb-1 font-bold">بيع البكجات المسجل</p>
          <h3 className="text-2xl font-black text-green-600">{dashboardStats.totalPkgSales}</h3>
        </div>
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
          <p className="text-xs text-gray-500 mb-1 font-bold">الرجوعات المسجلة</p>
          <h3 className="text-2xl font-black text-red-600">{dashboardStats.totalReturns}</h3>
        </div>
      </div>

      <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
        <h3 className="font-bold text-gray-800 mb-6 flex items-center gap-2">
          <BarChart3 size={18} className="text-blue-600" /> حركة إجمالي المبيعات (آخر 7 أيام)
        </h3>
        <div className="flex items-end gap-2 md:gap-4 h-48 pt-6">
          {trendData.map((d, index) => {
            const heightPercent = maxSalesInTrend > 0 ? (d.sales / maxSalesInTrend) * 100 : 0;
            return (
              <div key={index} className="flex-1 flex flex-col items-center gap-2 group">
                <div className="w-full max-w-[40px] bg-blue-50 rounded-t-md relative flex items-end justify-center h-full border-b border-blue-100">
                  <div 
                    className="w-full bg-blue-500 rounded-t-md transition-all duration-700 ease-out group-hover:bg-blue-600 shadow-sm" 
                    style={{ height: `${heightPercent}%`, minHeight: d.sales > 0 ? '4px' : '0' }}
                  ></div>
                  <span className="absolute -top-6 text-xs font-bold text-gray-700 opacity-80 group-hover:opacity-100 group-hover:-top-7 transition-all">
                    {d.sales}
                  </span>
                </div>
                <span className="text-[10px] md:text-xs text-gray-500 font-medium truncate w-full text-center" dir="ltr">
                  {d.date.substring(5)}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="p-3 border-b border-gray-200 bg-slate-800 text-white">
            <h3 className="font-bold text-sm flex items-center gap-2">
              <Package size={16} /> تحليل المنتجات الفردية (للتاريخ: {selectedDate})
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-gray-100 text-gray-600 border-b border-gray-200">
                <tr>
                  <th className="p-2 font-bold whitespace-nowrap">SKU</th>
                  <th className="p-2 font-bold whitespace-nowrap text-center">مخزون اليوم</th>
                  <th className="p-2 font-bold whitespace-nowrap text-center text-blue-700">مبيعات فعلية</th>
                  <th className="p-2 font-bold whitespace-nowrap text-center text-red-700">رجوعات/رفض</th>
                  <th className="p-2 font-bold whitespace-nowrap text-center">صافي المبيعات</th>
                  <th className="p-2 font-bold whitespace-nowrap text-center">الحالة</th>
                  <th className="p-2 font-bold whitespace-nowrap text-center">تنبيه</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {PRODUCTS.map(sku => {
                  const qty = stockAsOfDate[sku] || 0;
                  const stats = getDailyItemStats(sku, 'منتج');
                  const status = qty > 150 ? 'جيد' : (qty > 50 ? 'متوسط' : 'منخفض');
                  const statusColor = qty > 150 ? 'text-green-600 bg-green-50' : (qty > 50 ? 'text-orange-600 bg-orange-50' : 'text-red-600 bg-red-50');
                  
                  return (
                    <tr key={sku} className="hover:bg-gray-50">
                      <td className="p-2 font-bold text-gray-800 bg-gray-50 border-l border-gray-100">{sku}</td>
                      <td className="p-2 text-center font-bold text-gray-700">{qty}</td>
                      <td className="p-2 text-center font-bold text-blue-600">{stats.sales}</td>
                      <td className="p-2 text-center font-bold text-red-600">{stats.returns}</td>
                      <td className="p-2 text-center font-bold text-gray-800">{stats.net}</td>
                      <td className="p-2 text-center">
                        <span className={`inline-block px-2 py-1 rounded-md text-[10px] font-bold ${statusColor}`}>
                          {status}
                        </span>
                      </td>
                      <td className="p-2 text-center">
                        {qty < 50 && <AlertTriangle size={14} className="text-red-500 inline" />}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="p-3 border-b border-gray-200 bg-indigo-900 text-white">
            <h3 className="font-bold text-sm flex items-center gap-2">
              <PackageOpen size={16} /> تحليل البكجات والعروض (للتاريخ: {selectedDate})
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-gray-100 text-gray-600 border-b border-gray-200">
                <tr>
                  <th className="p-2 font-bold whitespace-nowrap">كود البكج</th>
                  <th className="p-2 font-bold whitespace-nowrap text-center">أقصى بيع ممكن</th>
                  <th className="p-2 font-bold whitespace-nowrap text-center text-blue-700">مبيعات فعلية</th>
                  <th className="p-2 font-bold whitespace-nowrap text-center text-red-700">رجوعات/رفض</th>
                  <th className="p-2 font-bold whitespace-nowrap text-center">صافي المبيعات</th>
                  <th className="p-2 font-bold whitespace-nowrap text-center">SKU الحرج</th>
                  <th className="p-2 font-bold whitespace-nowrap text-center">القرار</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {Object.entries(packageAvailabilityAsOfDate).map(([code, data]) => {
                  const stats = getDailyItemStats(code, 'بكج');
                  const decision = data.max > 150 ? 'حملات قوية' : (data.max > 50 ? 'بحذر' : 'إيقاف/توريد');
                  const decisionColor = data.max > 150 ? 'text-green-600 bg-green-50' : (data.max > 50 ? 'text-orange-600 bg-orange-50' : 'text-red-600 bg-red-50');

                  return (
                    <tr key={code} className="hover:bg-gray-50">
                      <td className="p-2 font-bold text-gray-800 bg-gray-50 border-l border-gray-100">
                        {code}
                        <div className="text-[10px] text-gray-400 font-normal">{PACKAGES[code].name}</div>
                      </td>
                      <td className="p-2 text-center font-black text-indigo-700">{data.max}</td>
                      <td className="p-2 text-center font-bold text-blue-600">{stats.sales}</td>
                      <td className="p-2 text-center font-bold text-red-600">{stats.returns}</td>
                      <td className="p-2 text-center font-bold text-gray-800">{stats.net}</td>
                      <td className="p-2 text-center text-[10px] font-mono text-red-500 bg-red-50/50 rounded">
                        {data.max === 0 ? 'نفد' : data.criticalSku}
                      </td>
                      <td className="p-2 text-center">
                        <span className={`inline-block px-2 py-1 rounded-md text-[10px] font-bold whitespace-nowrap ${decisionColor}`}>
                          {decision}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );

  const MovementForm = () => {
    const [formData, setFormData] = useState({
      date: todayStr,
      level: 'منتج',
      code: PRODUCTS[0],
      type: 'بيع',
      quantity: 1,
      reference: '',
      note: ''
    });

    // تحديث تاريخ النموذج تلقائياً إذا تغير اليوم والمستخدم تارك الصفحة مفتوحة
    useEffect(() => {
      setFormData(prev => ({ ...prev, date: todayStr }));
    }, [todayStr]);

    const [deleteConfirmId, setDeleteConfirmId] = useState(null);

    const handleSubmit = async (e) => {
      e.preventDefault();
      await addMovementToCloud(formData);
      // نرجع نستخدم todayStr عند تفريغ النموذج بعد الإرسال
      setFormData({ ...formData, quantity: 1, reference: '', note: '', date: todayStr });
    };

    return (
      <div className="space-y-6 animate-in fade-in">
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm relative">
          {isSyncing && (
            <div className="absolute inset-0 bg-white/50 backdrop-blur-sm flex items-center justify-center rounded-xl z-10">
               <Loader2 className="animate-spin text-blue-600" size={32} />
            </div>
          )}
          <h3 className="text-lg font-semibold mb-4 border-b pb-2 flex justify-between items-center">
            <span>تسجيل حركة جديدة</span>
            <span className="text-xs font-normal text-gray-500 bg-gray-100 px-2 py-1 rounded">يمكن للأدوات الخارجية الإضافة هنا آلياً</span>
          </h3>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm text-gray-600 mb-1">التاريخ</label>
              <input type="date" required className="w-full p-2 border rounded outline-none focus:ring-2 focus:ring-blue-500"
                value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} />
            </div>

            <div>
              <label className="block text-sm text-gray-600 mb-1">مستوى الحركة</label>
              <select className="w-full p-2 border rounded outline-none focus:ring-2 focus:ring-blue-500"
                value={formData.level} 
                onChange={e => setFormData({...formData, level: e.target.value, code: e.target.value === 'منتج' ? PRODUCTS[0] : Object.keys(PACKAGES)[0]})}>
                <option value="منتج">منتج فردي</option>
                <option value="بكج">بكج / عرض</option>
              </select>
            </div>

            <div>
              <label className="block text-sm text-gray-600 mb-1">الكود</label>
              <select className="w-full p-2 border rounded outline-none focus:ring-2 focus:ring-blue-500"
                value={formData.code} onChange={e => setFormData({...formData, code: e.target.value})}>
                {formData.level === 'منتج' 
                  ? PRODUCTS.map(p => <option key={p} value={p}>{p}</option>)
                  : Object.keys(PACKAGES).map(p => <option key={p} value={p}>{p} - {PACKAGES[p].name}</option>)
                }
              </select>
            </div>

            <div>
              <label className="block text-sm text-gray-600 mb-1">نوع الحركة</label>
              <select className="w-full p-2 border rounded outline-none focus:ring-2 focus:ring-blue-500"
                value={formData.type} onChange={e => setFormData({...formData, type: e.target.value})}>
                {MOVEMENT_TYPES.map(t => <option key={t.id} value={t.id}>{t.id}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-sm text-gray-600 mb-1">الكمية</label>
              <input type="number" min="1" required className="w-full p-2 border rounded outline-none focus:ring-2 focus:ring-blue-500"
                value={formData.quantity} onChange={e => setFormData({...formData, quantity: e.target.value})} />
            </div>

            <div>
              <label className="block text-sm text-gray-600 mb-1">المرجع (رقم الطلب)</label>
              <input type="text" placeholder="مثال: #10052" className="w-full p-2 border rounded outline-none focus:ring-2 focus:ring-blue-500"
                value={formData.reference} onChange={e => setFormData({...formData, reference: e.target.value})} />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm text-gray-600 mb-1">ملاحظات (حالة الطلب/تفاصيل)</label>
              <input type="text" placeholder="مثال: تم التنفيذ من سلة" className="w-full p-2 border rounded outline-none focus:ring-2 focus:ring-blue-500"
                value={formData.note} onChange={e => setFormData({...formData, note: e.target.value})} />
            </div>

            <div className="md:col-span-4 mt-2">
              <button type="submit" disabled={isSyncing} className="w-full bg-blue-600 hover:bg-blue-700 text-white p-3 rounded-lg font-medium flex justify-center items-center gap-2 transition-colors disabled:opacity-50">
                <Plus size={20} /> تسجيل الحركة
              </button>
            </div>
          </form>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
            <h3 className="font-semibold text-gray-800">سجل الحركات (سحابي مباشر)</h3>
            <span className="flex items-center gap-1 text-xs text-green-600 bg-green-50 px-2 py-1 rounded-full">
               <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
               محدث لحظياً
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-right text-sm">
              <thead className="bg-gray-50 text-gray-500 border-b">
                <tr>
                  <th className="p-3 font-medium">التاريخ</th>
                  <th className="p-3 font-medium">المستوى</th>
                  <th className="p-3 font-medium">الكود</th>
                  <th className="p-3 font-medium">نوع الحركة</th>
                  <th className="p-3 font-medium">الكمية</th>
                  <th className="p-3 font-medium">المرجع</th>
                  <th className="p-3 font-medium text-center">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {movements.length === 0 ? (
                  <tr><td colSpan="7" className="p-8 text-center text-gray-400">لا توجد حركات مسجلة حتى الآن</td></tr>
                ) : (
                  movements.map(mov => {
                    const isOut = MOVEMENT_TYPES.find(t => t.id === mov.type)?.type === 'out';
                    const isAutomated = mov.type.includes('آلي');
                    return (
                      <tr key={mov.id} className={`hover:bg-gray-50 ${isAutomated ? 'bg-blue-50/30' : ''}`}>
                        <td className="p-3">{mov.date}</td>
                        <td className="p-3"><span className="bg-gray-100 px-2 py-1 rounded text-xs">{mov.level}</span></td>
                        <td className="p-3 font-medium">{mov.code}</td>
                        <td className="p-3">
                           <span className={`px-2 py-1 rounded text-xs ${isOut ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>
                             {mov.type}
                           </span>
                        </td>
                        <td className="p-3 font-bold" dir="ltr">{isOut ? '-' : '+'}{mov.quantity}</td>
                        <td className="p-3 font-mono text-xs text-gray-500">{mov.reference || '-'}</td>
                        <td className="p-3 text-center">
                          {deleteConfirmId === mov.id ? (
                            <div className="flex items-center justify-center gap-2 animate-in fade-in">
                              <button onClick={() => deleteMovementFromCloud(mov.id)} className="bg-red-600 hover:bg-red-700 text-white text-xs px-2 py-1 rounded shadow-sm">تأكيد الحذف</button>
                              <button onClick={() => setDeleteConfirmId(null)} className="bg-gray-200 hover:bg-gray-300 text-gray-700 text-xs px-2 py-1 rounded shadow-sm">إلغاء</button>
                            </div>
                          ) : (
                            <button 
                              onClick={() => setDeleteConfirmId(mov.id)} 
                              className="text-gray-400 hover:text-red-500 transition-colors p-1 rounded-full hover:bg-red-50"
                              title="حذف الحركة"
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  const DailyStockForm = () => {
    const [date, setDate] = useState(todayStr);

    // تحديث التاريخ في النموذج إذا تغير اليوم
    useEffect(() => {
      setDate(todayStr);
    }, [todayStr]);

    const [stockInputs, setStockInputs] = useState({});

    const handleInitialStock = async (e) => {
      e.preventDefault();
      
      const promises = Object.entries(stockInputs)
        .filter(([_, qty]) => qty && parseInt(qty) > 0)
        .map(([sku, qty]) => {
           return addMovementToCloud({
             date,
             level: 'منتج',
             code: sku,
             type: 'دخول بضاعة',
             quantity: parseInt(qty),
             note: 'إدخال بضاعة / جرد'
           });
        });
      
      if(promises.length > 0) {
        await Promise.all(promises);
        setStockInputs({});
      }
    };

    return (
       <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm animate-in fade-in relative">
          {isSyncing && (
            <div className="absolute inset-0 bg-white/50 backdrop-blur-sm flex items-center justify-center rounded-xl z-10">
               <Loader2 className="animate-spin text-blue-600" size={32} />
            </div>
          )}
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-800">إدخال بضاعة جديدة للسحابة</h3>
            <p className="text-sm text-gray-500">سيتم حفظ هذه البيانات وستنعكس لدى جميع المستخدمين المتصلين بالنظام.</p>
          </div>
          
          <form onSubmit={handleInitialStock}>
            <div className="mb-6 max-w-xs">
              <label className="block text-sm text-gray-600 mb-1">التاريخ</label>
              <input type="date" required className="w-full p-2 border rounded outline-none focus:ring-2 focus:ring-blue-500"
                value={date} onChange={e => setDate(e.target.value)} />
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              {PRODUCTS.map(sku => (
                <div key={sku} className="p-3 bg-gray-50 rounded-lg border border-gray-100">
                  <label className="block text-sm font-medium text-gray-700 mb-2">{sku}</label>
                  <input type="number" min="0" placeholder="الكمية" 
                    className="w-full p-2 border rounded outline-none focus:ring-2 focus:ring-blue-500"
                    value={stockInputs[sku] || ''} 
                    onChange={e => setStockInputs({...stockInputs, [sku]: e.target.value})} />
                </div>
              ))}
            </div>

            <button type="submit" disabled={isSyncing} className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg font-medium disabled:opacity-50">
              حفظ وتزامن المخزون
            </button>
          </form>
       </div>
    );
  };

  const IntegrationSettings = () => {
    return (
      <div className="space-y-6 animate-in fade-in">
        <div className="bg-white p-8 rounded-xl border border-gray-200 shadow-sm">
          <div className="flex items-center gap-3 mb-6 pb-4 border-b">
            <div className="p-3 bg-indigo-50 text-indigo-600 rounded-lg">
              <Link2 size={24} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-800">إعدادات الربط الآلي (API & Webhooks)</h2>
              <p className="text-sm text-gray-500">دليل ربط منصة سلة (للمبيعات) ومستودعات Between (للمخزون) مع نظام أسباركل.</p>
            </div>
          </div>

          <div className="bg-blue-50 border-r-4 border-blue-500 p-4 rounded-l-lg mb-6 text-sm text-blue-800">
            <strong>ملاحظة هامة:</strong> لأن مخزونكم الفعلي يدار بواسطة Between Fulfillment، يجب أن يكون هذا النظام هو مصدر "الحقيقة المطلقة" (Source of Truth). أي أن الحركات هنا يجب أن تأتي آلياً من نظامهم.
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-6">
               
               <div className="bg-blue-50 p-5 rounded-xl border border-blue-100">
                 <h3 className="font-bold text-blue-800 text-lg mb-2 flex items-center gap-2">🛒 الربط مع سلة (المبيعات)</h3>
                 <p className="text-sm text-blue-700 mb-3">تُستخدم سلة كمصدر لتسجيل المبيعات والمرتجعات تلقائياً.</p>
                 <ul className="list-disc list-inside space-y-1 text-blue-800 text-xs font-medium">
                   <li>عندما يصبح الطلب <b>"تم التنفيذ"</b>: أرسل حركة بنوع <code>بيع آلي (عبر الربط)</code>.</li>
                   <li>عندما يصبح الطلب <b>"مسترجع"</b>: أرسل حركة بنوع <code>مرتجع</code>.</li>
                   <li>اجعل حقل <code>reference</code> يحتوي على رقم طلب سلة (مثال: #12345).</li>
                 </ul>
               </div>

               <div className="bg-emerald-50 p-5 rounded-xl border border-emerald-100">
                 <h3 className="font-bold text-emerald-800 text-lg mb-2 flex items-center gap-2">📦 الربط مع Between (المخزون)</h3>
                 <p className="text-sm text-emerald-700 mb-3">تُستخدم بتوين كمصدر لتسجيل دخول البضاعة والتوالف.</p>
                 <ul className="list-disc list-inside space-y-1 text-emerald-800 text-xs font-medium">
                   <li>عند استلام <b>توريد جديد</b>: أرسل حركة بنوع <code>دخول بضاعة</code>.</li>
                   <li>عند اكتشاف <b>تالف</b>: أرسل حركة بنوع <code>تلف</code>.</li>
                   <li>اجعل حقل <code>reference</code> يحتوي على رقم إيصال الاستلام من بتوين.</li>
                 </ul>
               </div>

            </div>

            <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 text-slate-200">
              <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
                <Settings size={18}/> بيانات مسار قاعدة البيانات (Firestore)
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-1">مسار الإرسال (Collection Path)</label>
                  <code className="block w-full p-2 bg-slate-900 border border-slate-600 rounded text-xs text-green-400 break-all select-all" dir="ltr">
                    /artifacts/{appId}/public/data/movements
                  </code>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-1">صيغة البيانات المطلوبة (JSON Payload)</label>
                  <pre className="block w-full p-3 bg-slate-900 text-blue-300 border border-slate-600 rounded text-xs overflow-x-auto" dir="ltr">
{`{
  "date": "2026-04-11",
  "level": "بكج", // أو "منتج"
  "code": "asg002",
  "type": "بيع آلي (عبر الربط)",
  "quantity": 1,
  "reference": "Salla-#205011",
  "note": "تم التنفيذ"
}`}
                  </pre>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  if (authError) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 font-sans" dir="rtl">
        <div className="bg-white border-2 border-red-200 shadow-lg p-8 rounded-2xl max-w-lg text-center space-y-4">
           <div className="bg-red-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4">
             <AlertTriangle size={40} className="text-red-500" />
           </div>
           <h2 className="font-bold text-2xl text-gray-800">تنبيه أمان (تفعيل المصادقة)</h2>
           <p className="text-gray-600 leading-relaxed">{authError}</p>
           <div className="text-sm bg-gray-50 p-4 rounded-lg mt-6 text-right border">
             <p className="font-bold mb-2">لحل هذه المشكلة خطوة بخطوة:</p>
             <ol className="list-decimal list-inside space-y-2 text-gray-700">
               <li>افتح موقع <strong>Firebase Console</strong></li>
               <li>اختر مشروعك: <strong>asparkle-inventory</strong></li>
               <li>من القائمة الجانبية اختر: <strong>Authentication</strong></li>
               <li>اختر تبويب: <strong>Sign-in method</strong></li>
               <li>قم بتفعيل خيار: <strong>Anonymous</strong> واضغط حفظ.</li>
               <li>قم بتحديث هذه الصفحة.</li>
             </ol>
           </div>
        </div>
        <style dangerouslySetInnerHTML={{__html: `
          @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800&display=swap');
          body { font-family: 'Tajawal', sans-serif; }
        `}} />
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center gap-4 text-blue-600 font-sans">
        <Loader2 className="animate-spin" size={48} />
        <p className="font-bold">جاري الاتصال بقاعدة البيانات السحابية...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 font-sans" dir="rtl">
        <div className="bg-white border border-gray-200 shadow-xl p-8 rounded-2xl w-full max-w-md">
          <div className="flex justify-center mb-6">
            <div className="bg-blue-600 p-4 rounded-2xl shadow-lg">
              <PackageOpen size={40} className="text-white" />
            </div>
          </div>
          <h2 className="text-2xl font-black text-center text-gray-800 mb-2">نظام أسباركل للمخزون</h2>
          <p className="text-center text-gray-500 mb-8 text-sm">الرجاء تسجيل الدخول للوصول إلى لوحة التحكم</p>
          
          <form onSubmit={handleLogin} className="space-y-4">
            {loginError && (
              <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm font-bold flex items-center gap-2">
                <AlertTriangle size={16} /> {loginError}
              </div>
            )}
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">البريد الإلكتروني</label>
              <input 
                type="email" 
                required 
                className="w-full p-3 border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-left" 
                dir="ltr"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">كلمة المرور</label>
              <input 
                type="password" 
                required 
                className="w-full p-3 border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-left" 
                dir="ltr"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <button 
              type="submit" 
              disabled={isLoggingIn}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold p-3 rounded-xl transition-all disabled:opacity-70 flex justify-center items-center gap-2 mt-4"
            >
              {isLoggingIn ? <Loader2 size={20} className="animate-spin" /> : 'تسجيل الدخول'}
            </button>
          </form>
        </div>
        <style dangerouslySetInnerHTML={{__html: `
          @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800;900&display=swap');
          body { font-family: 'Tajawal', sans-serif; }
        `}} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans" dir="rtl">
      <nav className="bg-slate-900 text-white shadow-lg sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="bg-blue-500 p-2 rounded-lg">
                <PackageOpen size={24} className="text-white" />
              </div>
              <div className="flex flex-col">
                <span className="font-bold text-lg tracking-wide leading-none">نظام أسباركل</span>
                <span className="text-[10px] text-blue-300 flex items-center gap-1 mt-1">
                  {user ? <Cloud size={10} /> : <CloudOff size={10} />}
                  {user ? 'متصل سحابياً' : 'غير متصل'}
                </span>
              </div>
            </div>
            
            <div className="hidden md:flex space-x-1 space-x-reverse items-center">
              <button onClick={() => setActiveTab('dashboard')} className={`px-4 py-2 rounded-md flex items-center gap-2 transition-colors ${activeTab === 'dashboard' ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-800'}`}>
                <LayoutDashboard size={18} /> لوحة التحكم
              </button>
              <button onClick={() => setActiveTab('movements')} className={`px-4 py-2 rounded-md flex items-center gap-2 transition-colors ${activeTab === 'movements' ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-800'}`}>
                <ArrowRightLeft size={18} /> الحركات
              </button>
              <button onClick={() => setActiveTab('stock')} className={`px-4 py-2 rounded-md flex items-center gap-2 transition-colors ${activeTab === 'stock' ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-800'}`}>
                <ClipboardList size={18} /> جرد
              </button>
              <button onClick={() => setActiveTab('integration')} className={`px-4 py-2 rounded-md flex items-center gap-2 transition-colors ${activeTab === 'integration' ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:bg-slate-800'}`}>
                <Link2 size={18} /> الربط
              </button>
              <div className="w-px h-6 bg-slate-700 mx-2"></div>
              <button onClick={handleLogout} className="px-3 py-1.5 rounded-md text-xs font-bold bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white transition-colors border border-red-500/20">
                تسجيل خروج
              </button>
            </div>
          </div>
        </div>
      </nav>

      <div className="md:hidden flex bg-white border-b overflow-x-auto">
        <button onClick={() => setActiveTab('dashboard')} className={`flex-1 p-3 text-sm flex justify-center items-center gap-1 whitespace-nowrap ${activeTab === 'dashboard' ? 'border-b-2 border-blue-600 text-blue-600 font-bold' : 'text-gray-500'}`}>
           لوحة التحكم
        </button>
        <button onClick={() => setActiveTab('movements')} className={`flex-1 p-3 text-sm flex justify-center items-center gap-1 whitespace-nowrap ${activeTab === 'movements' ? 'border-b-2 border-blue-600 text-blue-600 font-bold' : 'text-gray-500'}`}>
           الحركات
        </button>
        <button onClick={() => setActiveTab('stock')} className={`flex-1 p-3 text-sm flex justify-center items-center gap-1 whitespace-nowrap ${activeTab === 'stock' ? 'border-b-2 border-blue-600 text-blue-600 font-bold' : 'text-gray-500'}`}>
           جرد
        </button>
        <button onClick={() => setActiveTab('integration')} className={`flex-1 p-3 text-sm flex justify-center items-center gap-1 whitespace-nowrap ${activeTab === 'integration' ? 'border-b-2 border-indigo-600 text-indigo-600 font-bold' : 'text-gray-500'}`}>
           الربط
        </button>
      </div>

      <main className="max-w-full mx-auto px-2 md:px-6 py-6">
        {activeTab === 'dashboard' && renderDashboard()}
        {activeTab === 'movements' && <MovementForm />}
        {activeTab === 'stock' && <DailyStockForm />}
        {activeTab === 'integration' && <IntegrationSettings />}
      </main>
      
      <style dangerouslySetInnerHTML={{__html: `
        @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800;900&display=swap');
        body { font-family: 'Tajawal', sans-serif; }
      `}} />
    </div>
  );
}
