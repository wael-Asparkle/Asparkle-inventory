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
  CheckCircle2
} from 'lucide-react';

// --- إعدادات قاعدة البيانات السحابية (Firebase) ---
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, doc, setDoc, deleteDoc, onSnapshot, writeBatch } from 'firebase/firestore';

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
const DEFAULT_PRODUCTS = ['9000901', '9000902', '9000904', '9000905', '9000906', '9000908', '9000909'];

const DEFAULT_PACKAGES = {
  'asg001': { 
    name: 'بكج اسباركل', 
    group: 'بكج اسباركل',
    channel: 'المتجر (عضوي)', 
    items: { '9000901': 1, '9000902': 1 } 
  },
  'asg002': { 
    name: 'مجموعة سبارك (كود المشهور)', 
    group: 'مجموعة سبارك الكاملة',
    channel: 'المشهور دستور', 
    items: { '9000904': 1, '9000905': 1, '9000906': 1, '9000908': 1, '9000909': 1 } 
  },
  'asg003': { 
    name: 'مجموعة سبارك (حملات السوشيال)', 
    group: 'مجموعة سبارك الكاملة',
    channel: 'سنابشات وتيك توك', 
    items: { '9000904': 1, '9000905': 1, '9000906': 1, '9000908': 1, '9000909': 1 } 
  },
  'asg004': { 
    name: 'مجموعة سبارك (حملات الرسائل)', 
    group: 'مجموعة سبارك الكاملة',
    channel: 'حملات الواتساب', 
    items: { '9000904': 1, '9000905': 1, '9000906': 1, '9000908': 1, '9000909': 1 } 
  }
};

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

// دالة لفك تشفير ملفات الـ CSV بشكل صحيح
const parseCSV = (str) => {
  const arr = [];
  let quote = false;
  let row = 0, col = 0;
  for (let c = 0; c < str.length; c++) {
      let cc = str[c], nc = str[c+1];
      arr[row] = arr[row] || [];
      arr[row][col] = arr[row][col] || '';
      if (cc === '"' && quote && nc === '"') { arr[row][col] += cc; ++c; continue; }
      if (cc === '"') { quote = !quote; continue; }
      if (cc === ',' && !quote) { ++col; continue; }
      if (cc === '\n' && !quote) { ++row; col = 0; continue; }
      arr[row][col] += cc;
  }
  return arr.map(row => row.map(cell => cell.trim().replace(/\r/g, '')));
};

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  
  // --- حالات التاريخ وفترة التقرير ---
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

  useEffect(() => {
    const timer = setInterval(() => {
      const currentDay = new Date().toISOString().split('T')[0];
      if (currentDay !== todayStr) {
        setTodayStr(currentDay);
        setEndDate(prev => prev === todayStr ? currentDay : prev);
      }
    }, 60000); 
    return () => clearInterval(timer);
  }, [todayStr]);

  // --- حالات الاتصال وقاعدة البيانات ---
  const [user, setUser] = useState(null);
  const [movements, setMovements] = useState([]);
  
  const [products, setProducts] = useState([]);
  const [packages, setPackages] = useState({});
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

  // 1. المصادقة
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

  // 2. جلب صلاحيات المستخدمين
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
    }, (error) => {
      console.error("خطأ في جلب الصلاحيات:", error);
      setIsPermissionsLoaded(true);
    });

    return () => unsubscribe();
  }, [user]);

  // 3. جلب الحركات السحابية
  useEffect(() => {
    if (!user) return;
    const movementsCollection = collection(db, 'artifacts', appId, 'public', 'data', 'movements');
    const unsubscribe = onSnapshot(movementsCollection, (snapshot) => {
      const fetchedMovements = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      fetchedMovements.sort((a, b) => b.timestamp - a.timestamp);
      setMovements(fetchedMovements);
    }, (error) => {
      console.error("خطأ في جلب الحركات:", error);
    });
    return () => unsubscribe();
  }, [user]);

  // 4. جلب وتحديث (المنتجات والبكجات)
  useEffect(() => {
    if (!user) return;
    const settingsRef = doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'definitions');
    
    const unsubscribe = onSnapshot(settingsRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setProducts(data.products || []);
        setPackages(data.packages || {});
      } else {
        setDoc(settingsRef, {
          products: DEFAULT_PRODUCTS,
          packages: DEFAULT_PACKAGES
        }).catch(err => console.error("خطأ في تهيئة الإعدادات:", err));
      }
      setIsSettingsLoaded(true);
    }, (error) => {
      console.error("خطأ في جلب الإعدادات:", error);
    });

    return () => unsubscribe();
  }, [user]);

  const updateSettingsInCloud = async (newProducts, newPackages) => {
    if (!user) return;
    setIsSyncing(true);
    try {
      const settingsRef = doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'definitions');
      await setDoc(settingsRef, { products: newProducts, packages: newPackages }, { merge: true });
    } catch (error) {
      console.error("خطأ في تحديث الإعدادات:", error);
      alert('حدث خطأ أثناء حفظ التعديلات');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setIsLoggingIn(true);
    setLoginError('');
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
      setLoginError('البريد الإلكتروني أو كلمة المرور غير صحيحة.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    try { await signOut(auth); } catch (error) { console.error(error); }
  };

  const addMovementToCloud = async (data) => {
    if (!user) return;
    setIsSyncing(true);
    try {
      const movementId = `mov_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
      const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'movements', movementId);
      await setDoc(docRef, { ...data, timestamp: Date.now() });
    } catch (error) {
      setAuthError("حدث خطأ أثناء حفظ البيانات.");
    } finally {
      setIsSyncing(false);
    }
  };

  const deleteMovementFromCloud = async (id) => {
    if (!user) return;
    setIsSyncing(true);
    try {
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'movements', id));
    } catch (error) {
      setAuthError("حدث خطأ أثناء محاولة الحذف.");
    } finally {
      setIsSyncing(false);
    }
  };

  // --- الحسابات والعمليات ---
  const uniqueDates = useMemo(() => {
    const dates = new Set(movements.map(m => m.date));
    dates.add(todayStr); 
    return Array.from(dates).sort((a, b) => b.localeCompare(a));
  }, [movements, todayStr]);

  const movementsUpToDate = useMemo(() => {
    return movements.filter(m => m.date <= endDate);
  }, [movements, endDate]);

  const movementsInPeriod = useMemo(() => {
    return movements.filter(m => m.date >= startDate && m.date <= endDate);
  }, [movements, startDate, endDate]);

  const stockAsOfDate = useMemo(() => {
    let stock = {};
    products.forEach(p => stock[p] = 0);

    movementsUpToDate.forEach(mov => {
      const isOut = MOVEMENT_TYPES.find(t => t.id === mov.type)?.type === 'out';
      const multiplier = isOut ? -1 : 1;
      const qty = parseInt(mov.quantity) || 0;

      if (mov.level === 'منتج') {
        if (stock[mov.code] !== undefined) {
          stock[mov.code] += (qty * multiplier);
        }
      } else if (mov.level === 'بكج' && packages[mov.code]) {
        const pkgItems = packages[mov.code].items;
        Object.entries(pkgItems).forEach(([sku, requiredQty]) => {
          if (stock[sku] !== undefined) {
            stock[sku] += (qty * requiredQty * multiplier);
          }
        });
      }
    });
    return stock;
  }, [movementsUpToDate, products, packages]);

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

  const dashboardStats = useMemo(() => {
    let totalStock = Object.values(stockAsOfDate).reduce((a, b) => a + b, 0);
    let totalSkuSales = 0;
    let totalPkgSales = 0;
    let totalReturns = 0;

    movementsInPeriod.forEach(m => {
      const isSale = m.type.includes('بيع');
      const isReturn = m.type.includes('مرتجع') || m.type.includes('رفض استلام');

      if (isSale && m.level === 'منتج') totalSkuSales += parseInt(m.quantity);
      if (isSale && m.level === 'بكج') totalPkgSales += parseInt(m.quantity);
      if (isReturn) totalReturns += parseInt(m.quantity);
    });

    return { totalStock, totalSkuSales, totalPkgSales, totalReturns };
  }, [stockAsOfDate, movementsInPeriod]);

  const getPeriodItemStats = (code, level) => {
    let sales = 0;
    let returns = 0;
    movementsInPeriod.forEach(m => {
      if (m.code === code && m.level === level) {
        const isSale = m.type.includes('بيع');
        const isReturn = m.type.includes('مرتجع') || m.type.includes('رفض استلام');
        if (isSale) sales += parseInt(m.quantity);
        if (isReturn) returns += parseInt(m.quantity);
      }
    });
    return { sales, returns, net: sales - returns };
  };

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
          .bg-green { background-color: #dcfce7; color: #166534; font-weight: bold; }
          .bg-orange { background-color: #ffedd5; color: #9a3412; font-weight: bold; }
          .bg-red { background-color: #fee2e2; color: #991b1b; font-weight: bold; }
          .text-blue { color: #1d4ed8; font-weight: bold; }
          .text-red { color: #b91c1c; font-weight: bold; }
          .text-purple { color: #6d28d9; font-weight: bold; }
        </style>
      </head>
      <body dir="rtl">
        <h2>تقرير أسباركل للمخزون والمبيعات</h2>
        <p><strong>فترة التقرير:</strong> من ${startDate} إلى ${endDate}</p>

        <h3>المؤشرات العامة</h3>
        <table class="kpi-table">
          <tr>
            <th>إجمالي مخزون المنتجات (الحالي)</th>
            <th>بيع المنتجات المسجل (للفترة)</th>
            <th>بيع البكجات المسجل (للفترة)</th>
            <th>الرجوعات المسجلة (للفترة)</th>
          </tr>
          <tr>
            <td>${dashboardStats.totalStock}</td>
            <td class="text-blue">${dashboardStats.totalSkuSales}</td>
            <td class="text-blue">${dashboardStats.totalPkgSales}</td>
            <td class="text-red">${dashboardStats.totalReturns}</td>
          </tr>
        </table>

        <h3>تحليل المنتجات الفردية</h3>
        <table>
          <tr>
            <th>SKU</th>
            <th>المخزون الحالي</th>
            <th>مبيعات فعلية</th>
            <th>رجوعات/رفض</th>
            <th>صافي المبيعات</th>
            <th>الحالة</th>
          </tr>
          ${products.map(sku => {
            const qty = stockAsOfDate[sku] || 0;
            const stats = getPeriodItemStats(sku, 'منتج');
            const status = qty > 150 ? 'جيد' : (qty > 50 ? 'متوسط' : 'منخفض');
            const statusClass = qty > 150 ? 'bg-green' : (qty > 50 ? 'bg-orange' : 'bg-red');
            return `<tr>
              <td style="text-align: right; font-weight: bold;">&#x200E;${sku}</td>
              <td>${qty}</td>
              <td class="text-blue">${stats.sales}</td>
              <td class="text-red">${stats.returns}</td>
              <td>${stats.net}</td>
              <td class="${statusClass}">${status}</td>
            </tr>`;
          }).join('')}
        </table>

        <h3>تحليل البكجات والعروض (بحسب القناة والمشهور)</h3>
        <table>
          <tr>
            <th>كود البكج</th>
            <th>اسم البكج</th>
            <th>المجموعة الأساسية</th>
            <th>القناة التسويقية</th>
            <th>أقصى بيع ممكن</th>
            <th>مبيعات فعلية</th>
            <th>رجوعات/رفض</th>
            <th>صافي المبيعات</th>
            <th>القرار</th>
          </tr>
          ${Object.entries(packageAvailabilityAsOfDate).map(([code, data]) => {
            const stats = getPeriodItemStats(code, 'بكج');
            const decision = data.max > 150 ? 'أطلق حملات' : (data.max > 50 ? 'احذر' : 'إيقاف/توريد');
            const decisionClass = data.max > 150 ? 'bg-green' : (data.max > 50 ? 'bg-orange' : 'bg-red');
            const channel = packages[code].channel || '-';
            const group = packages[code].group || '-';
            return `<tr>
              <td style="text-align: right; font-weight: bold;">&#x200E;${code}</td>
              <td style="text-align: right;">${packages[code].name}</td>
              <td style="text-align: right;">${group}</td>
              <td class="text-purple">${channel}</td>
              <td style="font-weight: bold;">${data.max}</td>
              <td class="text-blue">${stats.sales}</td>
              <td class="text-red">${stats.returns}</td>
              <td>${stats.net}</td>
              <td class="${decisionClass}">${decision}</td>
            </tr>`;
          }).join('')}
        </table>
      </body>
      </html>
    `;

    const blob = new Blob([htmlContent], { type: 'application/vnd.ms-excel;charset=utf-8' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `تقرير_اسباركل_${endDate}.xls`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const trendData = useMemo(() => {
    const last7Dates = uniqueDates.slice(0, 7).reverse();
    return last7Dates.map(d => {
      let dailySales = 0;
      movements.forEach(m => {
        if (m.date === d && m.type.includes('بيع')) dailySales += parseInt(m.quantity);
      });
      return { date: d, sales: dailySales };
    });
  }, [uniqueDates, movements]);

  const maxSalesInTrend = Math.max(...trendData.map(d => d.sales), 1); 

  const groupedPackagePerformance = useMemo(() => {
    const groups = {};
    Object.keys(packages).forEach(code => {
      const stats = getPeriodItemStats(code, 'بكج');
      const groupName = packages[code].group || packages[code].name;
      
      if (!groups[groupName]) groups[groupName] = { groupName, totalSales: 0, pkgs: [] };
      
      groups[groupName].pkgs.push({
        code,
        name: packages[code].name,
        channel: packages[code].channel || 'بدون قناة',
        sales: stats.sales
      });
      groups[groupName].totalSales += stats.sales;
    });

    const sortedGroups = Object.values(groups).sort((a, b) => b.totalSales - a.totalSales);
    sortedGroups.forEach(g => g.pkgs.sort((a, b) => b.sales - a.sales));
    return sortedGroups;
  }, [movementsInPeriod, packages]);

  // --- مكونات الواجهة الفرعية ---

  const UsersManagementTab = () => {
    const [newUserEmail, setNewUserEmail] = useState('');
    const [newUserRole, setNewUserRole] = useState('viewer');

    const handleAddPermission = async (e) => {
      e.preventDefault();
      if(!newUserEmail.trim()) return;
      const email = newUserEmail.trim().toLowerCase();
      
      const newPerms = { ...permissions, [email]: newUserRole };
      setIsSyncing(true);
      try {
        await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'permissions'), newPerms);
        setNewUserEmail('');
      } catch(e) { 
        console.error(e);
        alert('حدث خطأ أثناء الحفظ');
      } finally {
        setIsSyncing(false);
      }
    };

    const handleRemovePermission = async (emailToRemove) => {
      if(emailToRemove === user.email) {
        alert('لا يمكنك إزالة صلاحياتك كمدير رئيسي!');
        return;
      }
      if(window.confirm(`هل أنت متأكد من إزالة صلاحيات (${emailToRemove})؟ لن يتمكن من رؤية أي صفحات.`)) {
        const newPerms = { ...permissions };
        delete newPerms[emailToRemove];
        setIsSyncing(true);
        try {
          await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'permissions'), newPerms);
        } catch(e) { console.error(e); } finally { setIsSyncing(false); }
      }
    };

    const roleNames = { 
      'admin': { title: 'مدير (صلاحيات كاملة)', color: 'bg-indigo-100 text-indigo-700' },
      'editor': { title: 'موظف (إدخال حركات فقط)', color: 'bg-green-100 text-green-700' },
      'viewer': { title: 'مشاهد (لوحة التحكم فقط)', color: 'bg-gray-100 text-gray-700' }
    };

    return (
      <div className="space-y-6 animate-in fade-in pb-10">
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm relative">
           {isSyncing && (
            <div className="absolute inset-0 bg-white/50 backdrop-blur-sm flex items-center justify-center rounded-xl z-10">
               <Loader2 className="animate-spin text-blue-600" size={32} />
            </div>
           )}
           <div className="flex items-center gap-3 mb-6 border-b pb-4">
             <div className="p-3 bg-blue-50 text-blue-600 rounded-lg">
               <Users size={24} />
             </div>
             <div>
               <h3 className="text-lg font-semibold text-gray-800">إدارة صلاحيات المستخدمين</h3>
               <p className="text-xs text-gray-500 mt-1">
                 أضف البريد الإلكتروني للموظف وحدد رتبته. (ملاحظة: يجب أولاً إنشاء حسابه وكلمة مروره في منصة Firebase).
               </p>
             </div>
           </div>

           <form onSubmit={handleAddPermission} className="flex flex-col md:flex-row gap-3 mb-8 bg-gray-50 p-4 rounded-xl border border-gray-200">
             <div className="flex-1">
               <label className="block text-xs font-bold text-gray-600 mb-1">البريد الإلكتروني للمستخدم</label>
               <input type="email" required placeholder="مثال: emp@asparkle.net" className="w-full p-2 border rounded outline-none focus:ring-2 focus:ring-blue-500 text-sm text-left" dir="ltr"
                 value={newUserEmail} onChange={e => setNewUserEmail(e.target.value)} />
             </div>
             <div className="md:w-64">
               <label className="block text-xs font-bold text-gray-600 mb-1">نوع الصلاحية</label>
               <select className="w-full p-2 border rounded outline-none focus:ring-2 focus:ring-blue-500 text-sm font-bold"
                 value={newUserRole} onChange={e => setNewUserRole(e.target.value)}>
                 <option value="admin">مدير (صلاحيات كاملة)</option>
                 <option value="editor">موظف (تسجيل حركات وجرد)</option>
                 <option value="viewer">مشاهد (لوحة التحكم فقط)</option>
               </select>
             </div>
             <div className="flex items-end">
               <button type="submit" disabled={isSyncing} className="w-full md:w-auto bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded font-bold text-sm transition-colors h-[38px]">
                 تحديد الصلاحية
               </button>
             </div>
           </form>

           <div className="overflow-x-auto border border-gray-200 rounded-xl">
             <table className="w-full text-right text-sm">
               <thead className="bg-gray-100 text-gray-600">
                 <tr>
                   <th className="p-3 font-bold border-b">البريد الإلكتروني</th>
                   <th className="p-3 font-bold border-b">الرتبة الممنوحة</th>
                   <th className="p-3 font-bold border-b text-center">الإجراءات</th>
                 </tr>
               </thead>
               <tbody className="divide-y divide-gray-100">
                 {Object.entries(permissions).map(([email, role]) => (
                   <tr key={email} className="hover:bg-gray-50">
                     <td className="p-3 font-mono text-gray-800" dir="ltr">{email}</td>
                     <td className="p-3">
                       <span className={`px-2 py-1 rounded text-xs font-bold ${roleNames[role]?.color || 'bg-gray-100'}`}>
                         {roleNames[role]?.title || role}
                       </span>
                       {email === user.email && <span className="text-[10px] text-blue-500 mr-2">(أنت)</span>}
                     </td>
                     <td className="p-3 text-center">
                       <button onClick={() => handleRemovePermission(email)} className="text-gray-400 hover:text-red-500 transition-colors p-1" title="إزالة الصلاحية">
                         <Trash2 size={16} />
                       </button>
                     </td>
                   </tr>
                 ))}
                 {Object.keys(permissions).length === 0 && <tr><td colSpan="3" className="p-4 text-center text-gray-400">لا توجد صلاحيات معرفة</td></tr>}
               </tbody>
             </table>
           </div>
        </div>
      </div>
    );
  };

  const DefinitionsTab = () => {
    const [newSku, setNewSku] = useState('');
    const [editingSku, setEditingSku] = useState(null);
    const [editSkuValue, setEditSkuValue] = useState('');
    
    const [pkgCode, setPkgCode] = useState('');
    const [pkgName, setPkgName] = useState('');
    const [pkgGroup, setPkgGroup] = useState('');
    const [pkgChannel, setPkgChannel] = useState('');
    const [pkgItems, setPkgItems] = useState({});
    
    const [itemSelectSku, setItemSelectSku] = useState(products[0] || '');
    const [itemSelectQty, setItemSelectQty] = useState(1);

    const handleAddProduct = () => {
      if (!newSku.trim() || products.includes(newSku.trim())) return;
      updateSettingsInCloud([...products, newSku.trim()], packages);
      setNewSku('');
    };

    const handleSaveEditProduct = (oldSku) => {
      const newVal = editSkuValue.trim();
      if (!newVal || newVal === oldSku) {
        setEditingSku(null);
        return;
      }
      if (products.includes(newVal)) {
        alert("هذا الرمز موجود مسبقاً!");
        return;
      }
      const newProducts = products.map(p => p === oldSku ? newVal : p);
      updateSettingsInCloud(newProducts, packages);
      setEditingSku(null);
    };

    const handleDeleteProduct = (sku) => {
      if(window.confirm(`هل أنت متأكد من حذف المنتج ${sku}؟`)) {
        updateSettingsInCloud(products.filter(p => p !== sku), packages);
      }
    };

    const handleAddPackageItem = () => {
      if (!itemSelectSku) return;
      setPkgItems(prev => ({
        ...prev,
        [itemSelectSku]: (prev[itemSelectSku] || 0) + parseInt(itemSelectQty)
      }));
      setItemSelectQty(1);
    };

    const handleRemovePackageItem = (sku) => {
      const newItems = { ...pkgItems };
      delete newItems[sku];
      setPkgItems(newItems);
    };

    const handleAddPackage = () => {
      if (!pkgCode.trim() || !pkgName.trim() || Object.keys(pkgItems).length === 0) {
        alert("يرجى إدخال كود البكج، واسمه، وإضافة منتج واحد على الأقل داخله.");
        return;
      }
      
      const newPackages = {
        ...packages,
        [pkgCode.trim()]: {
          name: pkgName.trim(),
          group: pkgGroup.trim() || pkgName.trim(),
          channel: pkgChannel.trim() || 'عام',
          items: pkgItems
        }
      };
      
      updateSettingsInCloud(products, newPackages);
      
      setPkgCode(''); setPkgName(''); setPkgGroup(''); setPkgChannel(''); setPkgItems({});
    };

    const handleEditPackageLoad = (code, pkg) => {
      setPkgCode(code);
      setPkgName(pkg.name);
      setPkgGroup(pkg.group);
      setPkgChannel(pkg.channel);
      setPkgItems({ ...pkg.items });
      document.getElementById('package-form')?.scrollIntoView({ behavior: 'smooth' });
    };

    const handleDeletePackage = (code) => {
      if(window.confirm(`هل أنت متأكد من حذف البكج ${code}؟`)) {
        const newPackages = { ...packages };
        delete newPackages[code];
        updateSettingsInCloud(products, newPackages);
      }
    };

    const isEditingPkg = Object.keys(packages).includes(pkgCode.trim());

    return (
      <div className="space-y-6 animate-in fade-in pb-10">
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm relative">
           {isSyncing && (
            <div className="absolute inset-0 bg-white/50 backdrop-blur-sm flex items-center justify-center rounded-xl z-10">
               <Loader2 className="animate-spin text-blue-600" size={32} />
            </div>
           )}
           <h3 className="text-lg font-semibold text-gray-800 mb-2 flex items-center gap-2 border-b pb-4">
             <Package size={20} className="text-blue-600"/> إدارة المنتجات الفردية (SKUs)
           </h3>
           
           <div className="flex flex-wrap gap-3 my-6">
             {products.length === 0 && <span className="text-sm text-gray-400">لا توجد منتجات معرفة.</span>}
             {products.map(sku => (
               <div key={sku} className="flex items-center gap-2 bg-blue-50 text-blue-800 px-3 py-1.5 rounded-lg border border-blue-100 font-bold text-sm">
                 {editingSku === sku ? (
                   <div className="flex items-center gap-1">
                     <input 
                       type="text" 
                       value={editSkuValue} 
                       onChange={e => setEditSkuValue(e.target.value)} 
                       className="p-1 text-xs border rounded w-24 outline-none text-left" 
                       dir="ltr"
                       autoFocus
                     />
                     <button onClick={() => handleSaveEditProduct(sku)} className="text-green-600 hover:bg-green-100 rounded p-1 transition-colors"><Check size={14} /></button>
                     <button onClick={() => setEditingSku(null)} className="text-gray-400 hover:bg-gray-200 rounded p-1 transition-colors"><X size={14} /></button>
                   </div>
                 ) : (
                   <>
                     <span dir="ltr">{sku}</span>
                     <div className="flex gap-1 mr-1 border-r border-blue-200 pr-2">
                       <button onClick={() => { setEditingSku(sku); setEditSkuValue(sku); }} className="text-blue-400 hover:text-blue-600 transition-colors" title="تعديل الاسم">
                         <Edit2 size={14} />
                       </button>
                       <button onClick={() => handleDeleteProduct(sku)} className="text-blue-400 hover:text-red-500 transition-colors" title="حذف المنتج">
                         <X size={14} />
                       </button>
                     </div>
                   </>
                 )}
               </div>
             ))}
           </div>

           <div className="flex gap-2 max-w-sm">
             <input 
               type="text" 
               placeholder="رمز المنتج الجديد (SKU)..." 
               className="flex-1 p-2 border rounded outline-none focus:ring-2 focus:ring-blue-500 text-sm"
               value={newSku}
               onChange={e => setNewSku(e.target.value)}
             />
             <button onClick={handleAddProduct} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded font-bold text-sm transition-colors">
               إضافة
             </button>
           </div>
        </div>

        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm relative">
           {isSyncing && (
            <div className="absolute inset-0 bg-white/50 backdrop-blur-sm flex items-center justify-center rounded-xl z-10">
               <Loader2 className="animate-spin text-blue-600" size={32} />
            </div>
           )}
           <h3 className="text-lg font-semibold text-gray-800 mb-6 flex items-center gap-2 border-b pb-4">
             <PackageOpen size={20} className="text-purple-600"/> إدارة البكجات والعروض التسويقية
           </h3>

           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
             {Object.keys(packages).length === 0 && <span className="text-sm text-gray-400 col-span-full">لا توجد بكجات معرفة.</span>}
             {Object.entries(packages).map(([code, pkg]) => (
               <div key={code} className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col relative group">
                 <div className="absolute top-3 left-3 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                   <button onClick={() => handleEditPackageLoad(code, pkg)} className="text-blue-400 hover:text-blue-600 bg-white rounded-full p-1.5 shadow-sm border border-gray-100" title="تعديل">
                     <Edit2 size={14} />
                   </button>
                   <button onClick={() => handleDeletePackage(code)} className="text-gray-400 hover:text-red-500 bg-white rounded-full p-1.5 shadow-sm border border-gray-100" title="حذف">
                     <Trash2 size={14} />
                   </button>
                 </div>

                 <div className="font-bold text-gray-800 mb-1 pr-6 truncate" title={pkg.name}>{pkg.name}</div>
                 <div className="text-xs text-indigo-600 font-mono mb-3 bg-indigo-50 inline-block px-2 py-0.5 rounded w-fit">{code}</div>
                 
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

           <div id="package-form" className={`rounded-xl border p-5 transition-colors ${isEditingPkg ? 'bg-blue-50 border-blue-200' : 'bg-gray-50 border-gray-200'}`}>
             <h4 className={`font-bold text-sm mb-4 ${isEditingPkg ? 'text-blue-800' : 'text-gray-800'}`}>
               {isEditingPkg ? '✏️ تحديث بيانات البكج الحالي' : '✨ إنشاء بكج / كود تسويقي جديد'}
             </h4>
             <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
               <div>
                 <label className="block text-xs font-bold text-gray-600 mb-1">كود البكج (مثال: asg005)</label>
                 <input type="text" className={`w-full p-2 border rounded outline-none text-sm font-mono ${isEditingPkg ? 'bg-gray-100 cursor-not-allowed' : 'focus:ring-2 focus:ring-purple-500'}`}
                   value={pkgCode} onChange={e => setPkgCode(e.target.value)} disabled={isEditingPkg} title={isEditingPkg ? 'لا يمكن تعديل كود البكج بعد إنشائه' : ''} />
               </div>
               <div>
                 <label className="block text-xs font-bold text-gray-600 mb-1">اسم البكج الواضح</label>
                 <input type="text" placeholder="مثال: عرض الصيف" className="w-full p-2 border rounded outline-none focus:ring-2 focus:ring-purple-500 text-sm"
                   value={pkgName} onChange={e => setPkgName(e.target.value)} />
               </div>
               <div>
                 <label className="block text-xs font-bold text-gray-600 mb-1">المجموعة (للمقارنة)</label>
                 <input type="text" placeholder="مثال: مجموعة سبارك" className="w-full p-2 border rounded outline-none focus:ring-2 focus:ring-purple-500 text-sm"
                   value={pkgGroup} onChange={e => setPkgGroup(e.target.value)} />
               </div>
               <div>
                 <label className="block text-xs font-bold text-gray-600 mb-1">القناة / المشهور</label>
                 <input type="text" placeholder="مثال: إعلانات تيك توك" className="w-full p-2 border rounded outline-none focus:ring-2 focus:ring-purple-500 text-sm"
                   value={pkgChannel} onChange={e => setPkgChannel(e.target.value)} />
               </div>

               <div className="md:col-span-4 bg-white p-4 rounded-lg border border-gray-200 mt-2">
                 <label className="block text-xs font-bold text-gray-600 mb-3">📦 إضافة المنتجات داخل هذا البكج:</label>
                 <div className="flex flex-wrap items-center gap-3 mb-4">
                   <select className="p-2 border rounded outline-none focus:ring-2 focus:ring-purple-500 text-sm flex-1 min-w-[150px]"
                     value={itemSelectSku} onChange={e => setItemSelectSku(e.target.value)}>
                     {products.map(p => <option key={p} value={p}>{p}</option>)}
                   </select>
                   <div className="flex items-center gap-2">
                     <span className="text-xs font-bold text-gray-500">الكمية:</span>
                     <input type="number" min="1" className="w-20 p-2 border rounded outline-none focus:ring-2 focus:ring-purple-500 text-sm"
                       value={itemSelectQty} onChange={e => setItemSelectQty(e.target.value)} />
                   </div>
                   <button onClick={handleAddPackageItem} className="bg-gray-800 hover:bg-gray-900 text-white px-4 py-2 rounded font-bold text-sm transition-colors whitespace-nowrap">
                     إدراج بالبكج
                   </button>
                 </div>
                 
                 {Object.keys(pkgItems).length > 0 && (
                   <div className="flex flex-wrap gap-2 pt-3 border-t">
                     {Object.entries(pkgItems).map(([sku, qty]) => (
                       <div key={sku} className="flex items-center gap-2 bg-purple-50 text-purple-800 px-3 py-1.5 rounded-lg border border-purple-100 font-bold text-xs">
                         <span dir="ltr">{sku}</span>
                         <span className="bg-white px-1.5 py-0.5 rounded text-purple-600 text-[10px]">x{qty}</span>
                         <button onClick={() => handleRemovePackageItem(sku)} className="text-purple-400 hover:text-red-500 hover:bg-red-50 rounded-full p-0.5 transition-colors ml-1">
                           <X size={14} />
                         </button>
                       </div>
                     ))}
                   </div>
                 )}
               </div>

               <div className="md:col-span-4 mt-2 flex gap-2">
                 <button onClick={handleAddPackage} className={`flex-1 text-white p-3 rounded-lg font-bold flex justify-center items-center gap-2 transition-colors shadow-sm ${isEditingPkg ? 'bg-blue-600 hover:bg-blue-700' : 'bg-purple-600 hover:bg-purple-700'}`}>
                   {isEditingPkg ? <Edit2 size={18} /> : <Plus size={18} />}
                   {isEditingPkg ? 'حفظ التعديلات' : 'اعتماد البكج الجديد'}
                 </button>
                 {isEditingPkg && (
                   <button onClick={() => {setPkgCode(''); setPkgName(''); setPkgGroup(''); setPkgChannel(''); setPkgItems({});}} className="bg-gray-200 hover:bg-gray-300 text-gray-700 p-3 rounded-lg font-bold transition-colors">
                     إلغاء التعديل
                   </button>
                 )}
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

    const defaultCode = products.length > 0 ? products[0] : '';
    const defaultPkgCode = Object.keys(packages).length > 0 ? Object.keys(packages)[0] : '';
    
    const [formData, setFormData] = useState({
      date: todayStr,
      level: 'منتج',
      code: defaultCode,
      type: MOVEMENT_TYPES[0].id, 
      quantity: 1,
      reference: '',
      note: ''
    });

    useEffect(() => {
      setFormData(prev => ({ ...prev, date: todayStr }));
    }, [todayStr]);

    useEffect(() => {
      setFormData(prev => ({
        ...prev,
        code: prev.level === 'منتج' ? defaultCode : defaultPkgCode
      }));
    }, [products, packages, formData.level]);

    const [deleteConfirmId, setDeleteConfirmId] = useState(null);

    const handleSubmit = async (e) => {
      e.preventDefault();
      if (!formData.code) {
        alert("يرجى اختيار الكود بشكل صحيح.");
        return;
      }
      await addMovementToCloud(formData);
      setFormData({ ...formData, quantity: 1, reference: '', note: '', date: todayStr });
    };

    // ميزة قراءة ملف الـ CSV الذكية مع التعرف على الكمية وطريقة الدفع
    const handleFileUpload = (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = async (event) => {
        const text = event.target.result;
        const rows = parseCSV(text);
        if(rows.length < 2) {
          alert('الملف فارغ أو غير صالح');
          return;
        }

        const headers = rows[0];
        
        // البحث عن أعمدة سلة الذكية
        const orderIdCol = headers.findIndex(h => h.includes('رقم الطلب') || h.includes('رقم'));
        const productCol = headers.findIndex(h => h.includes('نوع الطلب') || h.includes('المنتجات') || h.includes('اسم المنتج') || h.includes('اسماء'));
        const qtyCol = headers.findIndex(h => h.includes('الكمية') || h.includes('العدد') || h === 'Qty');
        const paymentCol = headers.findIndex(h => h.includes('طريقة الدفع') || h.includes('الدفع')); // لتمييز نوع الدفع للمبيعات

        const parsedMovements = [];
        
        for (let i = 1; i < rows.length; i++) {
          const row = rows[i];
          if(!row || row.length < 2 || !row[orderIdCol]) continue;
          
          let orderId = row[orderIdCol]?.replace(/["']/g, '').replace(/^\uFEFF/, ''); // إزالة الـ BOM إن وجد
          let productStr = productCol !== -1 ? (row[productCol] || '') : '';
          let paymentStr = paymentCol !== -1 ? (row[paymentCol] || '') : '';
          
          let qty = 1;
          // محاولة أخذ الكمية من عمود مستقل أولاً
          if (qtyCol !== -1 && row[qtyCol] && !isNaN(parseInt(row[qtyCol]))) {
              qty = parseInt(row[qtyCol]);
          } else {
              // ذكاء اصطناعي: محاولة استخراج الكمية المكتوبة داخل اسم المنتج في سلة مثل (Qty: 2)
              const qtyMatch = productStr.match(/Qty:\s*(\d+)/i);
              if (qtyMatch) qty = parseInt(qtyMatch[1]);
          }

          // خوارزمية ذكية لاكتشاف نوع البكج من النص (مطابقة للصورة المطلوبة)
          let mappedCode = null;
          let mappedLevel = 'بكج';

          // 1- محاولة التقاط الـ SKU مباشرة إذا كان سلة كاتبه (SKU: asg002)
          const skuMatch = productStr.match(/SKU:\s*([a-zA-Z0-9_-]+)/i);
          if (skuMatch && packages[skuMatch[1]]) {
             mappedCode = skuMatch[1];
          } 
          else if (productStr.includes('مجموعة سباركل الكاملة') || productStr.includes('مجموعة سبارك الكاملة')) {
            mappedCode = 'asg002';
          } else if (productStr.includes('بكج اسباركل') || productStr.includes('بكج التأسيس')) {
            mappedCode = 'asg001';
          } else if (productStr.includes('بكج العساف')) {
            mappedCode = 'asg003';
          } else if (productStr.includes('بكج الـ 7 عطور')) {
            mappedCode = 'asg002';
          } else {
            // 2- البحث التلقائي في البكجات المعرفة سلفاً
            Object.entries(packages).forEach(([code, pkg]) => {
              if(productStr.includes(code) || productStr.includes(pkg.name)) {
                mappedCode = code;
              }
            });
          }

          // 3- إذا لم يجد بكج، يبحث في المنتجات الفردية
          if (!mappedCode) {
            products.forEach(sku => {
              if(productStr.includes(sku)) {
                mappedCode = sku;
                mappedLevel = 'منتج';
              }
            });
          }

          // افتراضي إذا لم يتعرف عليه أبداً
          if (!mappedCode) {
            mappedCode = Object.keys(packages)[0] || products[0];
          }

          // ذكاء اصطناعي: تحديد نوع الحركة بدقة من طريقة الدفع
          let movType = 'بيع آلي (عبر الربط)'; // الافتراضي
          
          if (importMode === 'sales') {
             if (paymentStr.includes('تمارا') || paymentStr.includes('تابي')) {
                 movType = 'بيع (تمارا)';
             } else if (paymentStr.includes('عند الاستلام') || paymentStr.includes('الدفع عند الاستلام')) {
                 movType = 'بيع (دفع عند الاستلام)';
             } else if (paymentStr !== '') {
                 movType = 'بيع (دفع إلكتروني)';
             }
          } else {
             movType = 'مرتجع (إلغاء رغبة العميل)'; // للرجيع
          }
          
          parsedMovements.push({
            date: todayStr,
            level: mappedLevel,
            code: mappedCode,
            type: movType,
            quantity: qty,
            reference: orderId,
            note: importMode === 'sales' ? 'استيراد مبيعات (مُوصل)' : 'استيراد رجيع (دعم فني)'
          });
        }

        setImportPreview(parsedMovements);
        if (fileInputRef.current) fileInputRef.current.value = '';
      };
      reader.readAsText(file, 'UTF-8');
    };

    const confirmImport = async () => {
      if(!importPreview || importPreview.length === 0) return;
      setIsSyncing(true);
      
      try {
        const batchSize = 100;
        for (let i = 0; i < importPreview.length; i += batchSize) {
          const chunk = importPreview.slice(i, i + batchSize);
          const batch = writeBatch(db);
          
          chunk.forEach(mov => {
            const movementId = `mov_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
            const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'movements', movementId);
            batch.set(docRef, { ...mov, timestamp: Date.now() });
          });
          
          await batch.commit();
        }
        alert(`تم رفع ${importPreview.length} حركة بنجاح!`);
        setImportPreview(null);
      } catch (e) {
        console.error(e);
        alert('حدث خطأ أثناء رفع الملف.');
      } finally {
        setIsSyncing(false);
      }
    };

    return (
      <div className="space-y-6 animate-in fade-in">
        
        {/* قسم استيراد الدعم الفني والمبيعات */}
        <div className="bg-gradient-to-r from-blue-900 to-indigo-800 p-6 rounded-xl border border-indigo-200 shadow-sm text-white relative">
          {importPreview && (
            <div className="absolute inset-0 bg-white/95 text-gray-800 z-20 rounded-xl p-6 flex flex-col shadow-xl border border-gray-200 animate-in fade-in zoom-in-95">
               <h3 className="text-xl font-bold mb-2 flex items-center gap-2"><CheckCircle2 className="text-green-500"/> معاينة قبل الحفظ</h3>
               <p className="text-sm text-gray-500 mb-4">تم العثور على <b>{importPreview.length}</b> طلب في الملف. سيتم إدراجها كـ <span className={`font-bold px-2 py-0.5 rounded text-white ${importMode === 'sales' ? 'bg-blue-500' : 'bg-red-500'}`}>{importMode === 'sales' ? 'مبيعات' : 'مرتجعات'}</span>.</p>
               
               <div className="flex-1 overflow-auto border rounded-lg bg-gray-50 p-2 mb-4 custom-scrollbar">
                  <table className="w-full text-right text-xs">
                    <thead>
                      <tr className="text-gray-400 border-b bg-gray-100">
                        <th className="p-2 font-bold">المرجع</th>
                        <th className="p-2 font-bold">الكود</th>
                        <th className="p-2 font-bold">الكمية</th>
                        <th className="p-2 font-bold">نوع الحركة</th>
                      </tr>
                    </thead>
                    <tbody>
                      {importPreview.slice(0, 20).map((m, i) => (
                        <tr key={i} className="border-b border-gray-100 last:border-0 hover:bg-white transition-colors">
                          <td className="p-2 font-mono text-gray-500">{m.reference}</td>
                          <td className="p-2 font-bold text-indigo-600">{m.code}</td>
                          <td className="p-2 font-black">{m.quantity}</td>
                          <td className="p-2">
                             <span className={`px-2 py-1 rounded text-[10px] ${m.type.includes('بيع') ? 'bg-blue-50 text-blue-700' : 'bg-red-50 text-red-700'}`}>
                               {m.type}
                             </span>
                          </td>
                        </tr>
                      ))}
                      {importPreview.length > 20 && <tr><td colSpan="4" className="py-4 text-center text-gray-400 font-bold">... و {importPreview.length - 20} طلب آخر</td></tr>}
                    </tbody>
                  </table>
               </div>

               <div className="flex gap-3">
                 <button onClick={confirmImport} disabled={isSyncing} className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-lg flex justify-center items-center gap-2 transition-colors">
                   {isSyncing ? <Loader2 className="animate-spin" size={18}/> : 'تأكيد وحفظ في السحابة'}
                 </button>
                 <button onClick={() => setImportPreview(null)} disabled={isSyncing} className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold py-3 px-6 rounded-lg transition-colors">إلغاء</button>
               </div>
            </div>
          )}

          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h3 className="text-lg font-bold flex items-center gap-2 mb-1">
                <FileSpreadsheet size={20} /> استيراد ذكي لملفات الإكسل (CSV)
              </h3>
              <p className="text-indigo-200 text-xs max-w-xl mb-4 leading-relaxed">
                ارفع ملفات (تم التوصيل) لتسجيل المبيعات، أو ملفات (الدعم الفني والرجيع) لخصمها من المبيعات. النظام سيقرأ أرقام الطلبات ويتعرف على البكجات وطريقة الدفع تلقائياً.
              </p>
              
              <div className="flex items-center gap-4 bg-indigo-950/50 p-2 rounded-lg w-fit">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="radio" name="importType" checked={importMode === 'sales'} onChange={() => setImportMode('sales')} className="w-4 h-4 accent-blue-500" />
                  <span>ملف مبيعات (تم التوصيل)</span>
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="radio" name="importType" checked={importMode === 'returns'} onChange={() => setImportMode('returns')} className="w-4 h-4 accent-red-500" />
                  <span className="text-red-200">ملف رجيع (دعم فني)</span>
                </label>
              </div>
            </div>
            
            <div className="mt-4 md:mt-0">
               <input type="file" accept=".csv" ref={fileInputRef} onChange={handleFileUpload} className="hidden" id="csv-upload" />
               <label htmlFor="csv-upload" className="cursor-pointer flex items-center gap-2 bg-white text-indigo-900 px-5 py-3 rounded-lg font-bold text-sm shadow-md hover:bg-indigo-50 transition-colors">
                  <UploadCloud size={18} /> اختيار ورفع الملف
               </label>
            </div>
          </div>
        </div>

        {/* قسم التسجيل اليدوي كالعادة */}
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm relative">
          {isSyncing && (
            <div className="absolute inset-0 bg-white/50 backdrop-blur-sm flex items-center justify-center rounded-xl z-10">
               <Loader2 className="animate-spin text-blue-600" size={32} />
            </div>
          )}
          <h3 className="text-lg font-semibold mb-4 border-b pb-2 flex justify-between items-center">
            <span>تسجيل حركة جديدة (يدوي)</span>
            <span className="text-xs font-normal text-gray-500 bg-gray-100 px-2 py-1 rounded">أو قم بالإدخال يدوياً من هنا</span>
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
                onChange={e => setFormData({...formData, level: e.target.value})}>
                <option value="منتج">منتج فردي</option>
                <option value="بكج">بكج / عرض</option>
              </select>
            </div>

            <div>
              <label className="block text-sm text-gray-600 mb-1">الكود</label>
              <select className="w-full p-2 border rounded outline-none focus:ring-2 focus:ring-blue-500"
                value={formData.code} onChange={e => setFormData({...formData, code: e.target.value})} required>
                {formData.level === 'منتج' 
                  ? products.map(p => <option key={p} value={p}>{p}</option>)
                  : Object.keys(packages).map(p => <option key={p} value={p}>{p} - {packages[p].name} ({packages[p].channel})</option>)
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
              <button type="submit" disabled={isSyncing || !formData.code} className="w-full bg-blue-600 hover:bg-blue-700 text-white p-3 rounded-lg font-medium flex justify-center items-center gap-2 transition-colors disabled:opacity-50">
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
                    const isAutomated = mov.type.includes('آلي') || mov.type.includes('مجمع');
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
                          {currentUserRole === 'admin' ? (
                            deleteConfirmId === mov.id ? (
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
                            )
                          ) : (
                            <span className="text-xs text-gray-400">-</span>
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
             type: 'دخول بضاعة جديدة',
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
              {products.length === 0 && <p className="text-sm text-gray-400 col-span-full">يرجى تعريف المنتجات (SKUs) أولاً من شاشة "تعريف المنتجات".</p>}
              {products.map(sku => (
                <div key={sku} className="p-3 bg-gray-50 rounded-lg border border-gray-100">
                  <label className="block text-sm font-medium text-gray-700 mb-2">{sku}</label>
                  <input type="number" min="0" placeholder="الكمية" 
                    className="w-full p-2 border rounded outline-none focus:ring-2 focus:ring-blue-500"
                    value={stockInputs[sku] || ''} 
                    onChange={e => setStockInputs({...stockInputs, [sku]: e.target.value})} />
                </div>
              ))}
            </div>

            <button type="submit" disabled={isSyncing || products.length === 0} className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg font-medium disabled:opacity-50">
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
                   <li>عندما يصبح الطلب <b>"مسترجع"</b>: أرسل حركة بنوع <code>مرتجع (إلغاء رغبة العميل)</code>.</li>
                   <li>اجعل حقل <code>reference</code> يحتوي على رقم طلب سلة (مثال: #12345).</li>
                 </ul>
               </div>

               <div className="bg-emerald-50 p-5 rounded-xl border border-emerald-100">
                 <h3 className="font-bold text-emerald-800 text-lg mb-2 flex items-center gap-2">📦 الربط مع Between (المخزون)</h3>
                 <p className="text-sm text-emerald-700 mb-3">تُستخدم بتوين كمصدر لتسجيل دخول البضاعة والتوالف.</p>
                 <ul className="list-disc list-inside space-y-1 text-emerald-800 text-xs font-medium">
                   <li>عند استلام <b>توريد جديد</b>: أرسل حركة بنوع <code>دخول بضاعة جديدة</code>.</li>
                   <li>عند اكتشاف <b>تالف</b>: أرسل حركة بنوع <code>تلف داخلي</code>.</li>
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

  // --- شاشات التحميل والأمان ---
  if (authError) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 font-sans" dir="rtl">
        <div className="bg-white border-2 border-red-200 shadow-lg p-8 rounded-2xl max-w-lg text-center space-y-4">
           <div className="bg-red-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4">
             <AlertTriangle size={40} className="text-red-500" />
           </div>
           <h2 className="font-bold text-2xl text-gray-800">تنبيه أمان (تفعيل المصادقة)</h2>
           <p className="text-gray-600 leading-relaxed">{authError}</p>
        </div>
        <style dangerouslySetInnerHTML={{__html: `@import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800&display=swap'); body { font-family: 'Tajawal', sans-serif; }`}} />
      </div>
    )
  }

  if (isLoading || (user && (!isSettingsLoaded || !isPermissionsLoaded))) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center gap-4 text-blue-600 font-sans">
        <Loader2 className="animate-spin" size={48} />
        <p className="font-bold">جاري الاتصال بالسحابة وتحميل الإعدادات...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 font-sans" dir="rtl">
        <div className="bg-white border border-gray-200 shadow-xl p-8 rounded-2xl w-full max-w-md">
          <div className="flex justify-center mb-6">
            <div className="h-20 w-20 bg-white rounded-2xl shadow-lg flex items-center justify-center p-2 overflow-hidden border border-gray-100">
               <img src="/logo.png" alt="أسباركل" className="w-full h-full object-contain" 
                    onError={(e) => { e.target.onerror = null; e.target.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="%232563eb" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>'; }}
               />
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
              <input type="email" required className="w-full p-3 border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-left" dir="ltr" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">كلمة المرور</label>
              <input type="password" required className="w-full p-3 border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-left" dir="ltr" value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <button type="submit" disabled={isLoggingIn} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold p-3 rounded-xl transition-all disabled:opacity-70 flex justify-center items-center gap-2 mt-4">
              {isLoggingIn ? <Loader2 size={20} className="animate-spin" /> : 'تسجيل الدخول'}
            </button>
          </form>
        </div>
        <style dangerouslySetInnerHTML={{__html: `@import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800;900&display=swap'); body { font-family: 'Tajawal', sans-serif; }`}} />
      </div>
    );
  }

  // --- الواجهة الرئيسية ---
  return (
    <div className="min-h-screen bg-slate-50 font-sans" dir="rtl">
      <nav className="bg-slate-900 text-white shadow-lg sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 bg-white rounded-lg flex items-center justify-center overflow-hidden p-1 shadow-sm">
                 <img src="/logo.png" alt="أسباركل" className="w-full h-full object-contain" 
                      onError={(e) => { e.target.onerror = null; e.target.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="%233b82f6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>'; }}
                 />
              </div>
              <div className="flex flex-col">
                <span className="font-bold text-lg tracking-wide leading-none">نظام أسباركل</span>
                <span className="text-[10px] text-blue-300 flex items-center gap-1 mt-1">
                  {user ? <Cloud size={10} /> : <CloudOff size={10} />}
                  {user ? 'متصل سحابياً' : 'غير متصل'}
                </span>
              </div>
            </div>
            
            <div className="hidden md:flex space-x-1 space-x-reverse items-center overflow-x-auto">
              <button onClick={() => setActiveTab('dashboard')} className={`px-3 py-2 rounded-md flex items-center gap-2 transition-colors text-sm font-bold ${activeTab === 'dashboard' ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-800'}`}>
                <LayoutDashboard size={16} /> لوحة التحكم
              </button>
              
              {(currentUserRole === 'admin' || currentUserRole === 'editor') && (
                <>
                  <button onClick={() => setActiveTab('movements')} className={`px-3 py-2 rounded-md flex items-center gap-2 transition-colors text-sm font-bold ${activeTab === 'movements' ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-800'}`}>
                    <ArrowRightLeft size={16} /> الحركات
                  </button>
                  <button onClick={() => setActiveTab('stock')} className={`px-3 py-2 rounded-md flex items-center gap-2 transition-colors text-sm font-bold ${activeTab === 'stock' ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-800'}`}>
                    <ClipboardList size={16} /> جرد
                  </button>
                </>
              )}

              {currentUserRole === 'admin' && (
                <>
                  <button onClick={() => setActiveTab('definitions')} className={`px-3 py-2 rounded-md flex items-center gap-2 transition-colors text-sm font-bold ${activeTab === 'definitions' ? 'bg-purple-600 text-white' : 'text-slate-300 hover:bg-slate-800'}`}>
                    <Tags size={16} /> تعريف المنتجات
                  </button>
                  <button onClick={() => setActiveTab('integration')} className={`px-3 py-2 rounded-md flex items-center gap-2 transition-colors text-sm font-bold ${activeTab === 'integration' ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:bg-slate-800'}`}>
                    <Link2 size={16} /> الربط
                  </button>
                  <button onClick={() => setActiveTab('users')} className={`px-3 py-2 rounded-md flex items-center gap-2 transition-colors text-sm font-bold ${activeTab === 'users' ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-800'}`}>
                    <Users size={16} /> الصلاحيات
                  </button>
                </>
              )}

              <div className="w-px h-6 bg-slate-700 mx-2"></div>
              <button onClick={handleLogout} className="px-3 py-1.5 rounded-md text-xs font-bold bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white transition-colors border border-red-500/20">
                تسجيل خروج
              </button>
            </div>
          </div>
        </div>
      </nav>

      <div className="md:hidden flex bg-white border-b overflow-x-auto scrollbar-hide">
        <button onClick={() => setActiveTab('dashboard')} className={`flex-1 px-4 py-3 text-xs flex justify-center items-center gap-1 whitespace-nowrap ${activeTab === 'dashboard' ? 'border-b-2 border-blue-600 text-blue-600 font-bold' : 'text-gray-500'}`}>
           اللوحة
        </button>
        
        {(currentUserRole === 'admin' || currentUserRole === 'editor') && (
          <>
            <button onClick={() => setActiveTab('movements')} className={`flex-1 px-4 py-3 text-xs flex justify-center items-center gap-1 whitespace-nowrap ${activeTab === 'movements' ? 'border-b-2 border-blue-600 text-blue-600 font-bold' : 'text-gray-500'}`}>
              الحركات
            </button>
            <button onClick={() => setActiveTab('stock')} className={`flex-1 px-4 py-3 text-xs flex justify-center items-center gap-1 whitespace-nowrap ${activeTab === 'stock' ? 'border-b-2 border-blue-600 text-blue-600 font-bold' : 'text-gray-500'}`}>
              جرد
            </button>
          </>
        )}

        {currentUserRole === 'admin' && (
          <>
            <button onClick={() => setActiveTab('definitions')} className={`flex-1 px-4 py-3 text-xs flex justify-center items-center gap-1 whitespace-nowrap ${activeTab === 'definitions' ? 'border-b-2 border-purple-600 text-purple-600 font-bold' : 'text-gray-500'}`}>
              تعريف
            </button>
            <button onClick={() => setActiveTab('users')} className={`flex-1 px-4 py-3 text-xs flex justify-center items-center gap-1 whitespace-nowrap ${activeTab === 'users' ? 'border-b-2 border-blue-600 text-blue-600 font-bold' : 'text-gray-500'}`}>
              صلاحيات
            </button>
          </>
        )}
      </div>

      <main className="max-w-full mx-auto px-2 md:px-6 py-6">
        {activeTab === 'dashboard' && renderDashboard()}
        {activeTab === 'movements' && (currentUserRole === 'admin' || currentUserRole === 'editor') && <MovementForm />}
        {activeTab === 'stock' && (currentUserRole === 'admin' || currentUserRole === 'editor') && <DailyStockForm />}
        {activeTab === 'definitions' && currentUserRole === 'admin' && <DefinitionsTab />}
        {activeTab === 'integration' && currentUserRole === 'admin' && <IntegrationSettings />}
        {activeTab === 'users' && currentUserRole === 'admin' && <UsersManagementTab />}
      </main>
      
      <style dangerouslySetInnerHTML={{__html: `
        @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800;900&display=swap');
        body { font-family: 'Tajawal', sans-serif; }
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
      `}} />
    </div>
  );
}
