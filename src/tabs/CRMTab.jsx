import React, { useEffect, useState, useMemo } from 'react';
import {
  UsersRound, RefreshCw, Search, ChevronDown, ChevronUp,
  Crown, Repeat2, ShoppingBag, MapPin, Phone, Calendar,
  TrendingUp, Package, Star, Filter, X,
} from 'lucide-react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db, appId } from '../config/firebase';
import { PRODUCT_CATALOG } from '../constants/masterMapping';

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────
const fmt  = (n) => Number(n || 0).toLocaleString('ar-SA');
const fmtR = (n) => `${fmt(n)} ريال`;

function normalizePhone(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('00966')) return `966${digits.slice(5)}`;
  if (digits.startsWith('966')) return digits;
  if (digits.startsWith('05')) return `966${digits.slice(1)}`;
  if (digits.startsWith('5') && digits.length === 9) return `966${digits}`;
  return digits;
}

const CHANNEL_META = {
  'سعيدينيو':        { color: '#6366f1', bg: 'bg-indigo-50',  text: 'text-indigo-700'  },
  'دستور':           { color: '#10b981', bg: 'bg-emerald-50', text: 'text-emerald-700' },
  'TikTok/Snapchat': { color: '#f59e0b', bg: 'bg-amber-50',   text: 'text-amber-700'   },
  'واتساب':          { color: '#3b82f6', bg: 'bg-blue-50',    text: 'text-blue-700'    },
  'مباشر':           { color: '#94a3b8', bg: 'bg-slate-50',   text: 'text-slate-600'   },
};

// شريحة العميل بناءً على عدد الطلبات
function getSegment(ordersCount) {
  if (ordersCount >= 4) return { label: 'VIP',       color: 'text-amber-600',   bg: 'bg-amber-50',   border: 'border-amber-200',   icon: <Crown size={12} /> };
  if (ordersCount >= 2) return { label: 'متكرر',     color: 'text-indigo-600',  bg: 'bg-indigo-50',  border: 'border-indigo-200',  icon: <Repeat2 size={12} /> };
  return                       { label: 'جديد',      color: 'text-slate-500',   bg: 'bg-slate-50',   border: 'border-slate-200',   icon: <Star size={12} /> };
}

// مفتاح تجميع العميل: رقم الجوال أو الاسم
function customerKey(o) {
  return normalizePhone(o.customer?.phone) || o.customer?.name || 'unknown';
}

// ─────────────────────────────────────────────
// بناء بيانات العملاء من الطلبات
// ─────────────────────────────────────────────
function buildCustomers(orders) {
  const map = {};
  const paidPhoneSet = new Set(
    orders
      .filter(o => Number(o.total || 0) > 0)
      .map(o => normalizePhone(o.customer?.phone))
      .filter(Boolean)
  );

  orders.forEach(o => {
    const key = customerKey(o);
    if (!map[key]) {
      map[key] = {
        key,
        name:    o.customer?.name  || '—',
        phone:   o.customer?.phone || '—',
        city:    o.customer?.city  || '—',
        orders:  [],
        totalSpent: 0,
        paidOrdersCount: 0,
        freeOrdersCount: 0,
        compensationOrdersCount: 0,
        skuCount: {},     // { sku: qty }
        channels: new Set(),
      };
    }
    const c = map[key];
    const total = Number(o.total || 0);
    const phoneKey = normalizePhone(o.customer?.phone);
    const skuBreakdown = o.skuBreakdown || {};
    const isFreeOrder = total <= 0;
    const isCompensation = isFreeOrder && Boolean(phoneKey) && paidPhoneSet.has(phoneKey);

    c.orders.push({
      reference:    o.reference,
      date:         o.date,
      total,
      channel:      o.channel || 'غير محدد',
      skuBreakdown,
      paymentMethod: o.paymentMethod || '—',
      isFreeOrder,
      isCompensation,
    });

    if (total > 0) {
      c.totalSpent += total;
      c.paidOrdersCount += 1;
      Object.entries(skuBreakdown).forEach(([sku, qty]) => {
        c.skuCount[sku] = (c.skuCount[sku] || 0) + Number(qty || 0);
      });
    } else {
      c.freeOrdersCount += 1;
      if (isCompensation) c.compensationOrdersCount += 1;
    }

    c.channels.add(o.channel || 'غير محدد');
  });

  // ترتيب الطلبات زمنياً
  return Object.values(map).map(c => {
    const sortedOrders = [...c.orders].sort((a, b) => new Date(b.date) - new Date(a.date));
    const paidOrdersCount = c.paidOrdersCount;
    const ordersCount = paidOrdersCount || sortedOrders.length;

    return {
      ...c,
      orders: sortedOrders,
      channels: [...c.channels],
      ordersCount,
      paidOrdersCount,
      allOrdersCount: sortedOrders.length,
      segment: getSegment(ordersCount),
      lastOrder: sortedOrders[0]?.date || '',
      topSku: Object.entries(c.skuCount).sort((a, b) => b[1] - a[1])[0]?.[0] || null,
    };
  });
}

// ─────────────────────────────────────────────
// CUSTOMER ROW
// ─────────────────────────────────────────────
function CustomerRow({ customer }) {
  const [expanded, setExpanded] = useState(false);
  const seg = customer.segment;

  return (
    <div className={`border rounded-2xl overflow-hidden transition-all ${expanded ? 'border-indigo-200' : 'border-slate-100'}`}>
      {/* الصف الرئيسي */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-4 px-5 py-4 bg-white hover:bg-slate-50 transition-colors text-right"
      >
        {/* Avatar */}
        <div className="w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm flex-shrink-0"
          style={{ background: `${customer.ordersCount >= 2 ? '#eef2ff' : '#f8fafc'}`, color: '#6366f1' }}>
          {(customer.name || '?')[0]}
        </div>

        {/* الاسم والمدينة */}
        <div className="flex-1 min-w-0 text-right">
          <div className="flex items-center gap-2">
            <p className="text-sm font-black text-slate-800 truncate">{customer.name}</p>
            <span className={`flex items-center gap-1 text-xs font-black px-2 py-0.5 rounded-lg border ${seg.bg} ${seg.color} ${seg.border}`}>
              {seg.icon} {seg.label}
            </span>
            {customer.compensationOrdersCount > 0 && (
              <span className="text-xs font-black px-2 py-0.5 rounded-lg border border-rose-200 bg-rose-50 text-rose-600">
                تعويض ×{customer.compensationOrdersCount}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-0.5">
            <span className="flex items-center gap-1 text-xs text-slate-400">
              <MapPin size={11} /> {customer.city}
            </span>
            <span className="flex items-center gap-1 text-xs text-slate-400">
              <Phone size={11} /> {customer.phone}
            </span>
          </div>
        </div>

        {/* الإحصائيات */}
        <div className="hidden md:flex items-center gap-6 flex-shrink-0">
          <div className="text-center">
            <p className="text-xs text-slate-400 font-bold">الطلبات المدفوعة</p>
            <p className={`text-lg font-black ${customer.ordersCount >= 2 ? 'text-indigo-600' : 'text-slate-700'}`}>
              {customer.ordersCount}
            </p>
          </div>
          <div className="text-center">
            <p className="text-xs text-slate-400 font-bold">الإجمالي</p>
            <p className="text-sm font-black text-emerald-600">{fmtR(customer.totalSpent)}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-slate-400 font-bold">آخر طلب</p>
            <p className="text-xs font-bold text-slate-500">{customer.lastOrder?.slice(0,10) || '—'}</p>
          </div>
          {customer.topSku && (
            <div className="text-center hidden lg:block">
              <p className="text-xs text-slate-400 font-bold">المنتج المفضل</p>
              <p className="text-xs font-black text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-lg">
                {PRODUCT_CATALOG[customer.topSku]?.name || customer.topSku}
              </p>
            </div>
          )}
        </div>

        <div className="text-slate-300 flex-shrink-0">
          {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </div>
      </button>

      {/* التفاصيل الموسّعة */}
      {expanded && (
        <div className="bg-slate-50 border-t border-slate-100 px-5 py-4 space-y-4">

          {/* المنتجات المشتراة */}
          {Object.keys(customer.skuCount).length > 0 && (
            <div>
              <p className="text-xs font-black text-slate-500 mb-2 flex items-center gap-1">
                <Package size={12} /> المنتجات المشتراة
              </p>
              <div className="flex flex-wrap gap-2">
                {Object.entries(customer.skuCount)
                  .sort((a, b) => b[1] - a[1])
                  .map(([sku, qty]) => (
                    <div key={sku} className="bg-white border border-slate-200 rounded-xl px-3 py-2 flex items-center gap-2">
                      <span className="text-xs font-black text-slate-700">
                        {PRODUCT_CATALOG[sku]?.name || sku}
                      </span>
                      <span className="text-xs font-black bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded-lg">
                        ×{qty}
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* سجل الطلبات */}
          <div>
            <p className="text-xs font-black text-slate-500 mb-2 flex items-center gap-1">
              <Calendar size={12} /> سجل الطلبات ({customer.allOrdersCount || customer.ordersCount})
            </p>
            <div className="space-y-2">
              {customer.orders.map((o, i) => {
                const chMeta = CHANNEL_META[o.channel] || CHANNEL_META['مباشر'];
                return (
                  <div key={o.reference}
                    className="bg-white border border-slate-100 rounded-xl px-4 py-3 flex items-center gap-4 flex-wrap">
                    {/* رقم الطلب */}
                    <div className="flex items-center gap-2">
                      {i === 0 && <span className="text-xs bg-emerald-100 text-emerald-700 font-black px-1.5 py-0.5 rounded-md">آخر طلب</span>}
                      {o.isCompensation && <span className="text-xs bg-rose-100 text-rose-700 font-black px-1.5 py-0.5 rounded-md">تعويض</span>}
                      {o.isFreeOrder && !o.isCompensation && <span className="text-xs bg-slate-100 text-slate-600 font-black px-1.5 py-0.5 rounded-md">طلب مجاني</span>}
                      <span className="text-xs font-mono text-slate-500">{o.reference}</span>
                    </div>
                    {/* التاريخ */}
                    <span className="flex items-center gap-1 text-xs text-slate-400 font-bold">
                      <Calendar size={11} /> {o.date?.slice(0,10) || '—'}
                    </span>
                    {/* القناة */}
                    <span className={`text-xs font-black px-2 py-0.5 rounded-lg ${chMeta.bg} ${chMeta.text}`}>
                      {o.channel}
                    </span>
                    {/* المنتجات */}
                    <div className="flex flex-wrap gap-1">
                      {Object.entries(o.skuBreakdown).map(([sku, qty]) => (
                        <span key={sku} className="text-xs bg-slate-100 text-slate-600 font-bold px-2 py-0.5 rounded-md">
                          {PRODUCT_CATALOG[sku]?.name || sku} ×{qty}
                        </span>
                      ))}
                    </div>
                    {/* الإجمالي */}
                    <span className={`text-sm font-black mr-auto ${o.isFreeOrder ? 'text-rose-600' : 'text-emerald-600'}`}>{fmtR(o.total)}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ملخص التكرار */}
          {customer.ordersCount >= 2 && (
            <div className="bg-indigo-50 border border-indigo-100 rounded-xl px-4 py-3 flex items-center gap-3">
              <Repeat2 size={16} className="text-indigo-500 flex-shrink-0" />
              <p className="text-xs font-bold text-indigo-700">
                كرّر الشراء <span className="font-black text-indigo-800">{customer.ordersCount} مرات</span>
                {' '}— متوسط قيمة الطلب: <span className="font-black text-indigo-800">{fmtR(Math.round(customer.totalSpent / (customer.paidOrdersCount || customer.ordersCount)))}</span>
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────
export default function CRMTab() {
  const [orders,   setOrders]   = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [search,   setSearch]   = useState('');
  const [segment,  setSegment]  = useState('all');   // all | vip | repeat | new | one_time
  const [sortBy,   setSortBy]   = useState('spent'); // spent | orders | recent

  useEffect(() => {
    const col = collection(db, 'artifacts', appId, 'public', 'data', 'orders');
    const unsub = onSnapshot(col, snap => {
      setOrders(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const customers = useMemo(() => buildCustomers(orders), [orders]);

  // ── KPIs ──
  const stats = useMemo(() => ({
    total:   customers.length,
    vip:     customers.filter(c => c.ordersCount >= 4).length,
    repeat:  customers.filter(c => c.ordersCount >= 2 && c.ordersCount < 4).length,
    newC:    customers.filter(c => c.ordersCount === 1).length,
    oneTime: customers.filter(c => c.ordersCount === 1).length,
    totalRev: customers.reduce((s, c) => s + c.totalSpent, 0),
    avgLTV:   customers.length ? Math.round(customers.reduce((s, c) => s + c.totalSpent, 0) / customers.length) : 0,
    repeatRate: customers.length ? ((customers.filter(c => c.ordersCount >= 2).length / customers.length) * 100).toFixed(1) : 0,
  }), [customers]);

  // ── فلترة + ترتيب ──
  const filtered = useMemo(() => {
    let list = [...customers];
    if (segment === 'vip')      list = list.filter(c => c.ordersCount >= 4);
    if (segment === 'repeat')   list = list.filter(c => c.ordersCount >= 2 && c.ordersCount < 4);
    if (segment === 'new')      list = list.filter(c => c.ordersCount === 1);
    if (segment === 'one_time') list = list.filter(c => c.ordersCount === 1);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(c =>
        c.name.toLowerCase().includes(q) ||
        c.phone.includes(q) ||
        c.city.toLowerCase().includes(q)
      );
    }
    if (sortBy === 'spent')   list.sort((a, b) => b.totalSpent - a.totalSpent);
    if (sortBy === 'orders')  list.sort((a, b) => b.ordersCount - a.ordersCount);
    if (sortBy === 'recent')  list.sort((a, b) => new Date(b.lastOrder) - new Date(a.lastOrder));
    return list;
  }, [customers, segment, search, sortBy]);

  if (loading) return (
    <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-16 flex items-center justify-center gap-3">
      <RefreshCw size={20} className="animate-spin text-indigo-500" />
      <span className="font-bold text-slate-400 text-sm">جاري تحميل بيانات العملاء...</span>
    </div>
  );

  return (
    <div className="space-y-6" dir="rtl">

      {/* HEADER */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm px-8 py-5 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-black text-slate-800 flex items-center gap-2">
            <UsersRound size={22} className="text-indigo-500" /> إدارة العملاء (CRM)
          </h2>
          <p className="text-slate-400 text-xs mt-1">
            <span className="font-black text-indigo-500">{fmt(stats.total)}</span> عميل فريد من {fmt(orders.length)} طلب
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-emerald-600 font-black bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-100">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          متصل بـ Firebase
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'إجمالي العملاء',   value: fmt(stats.total),          sub: 'عميل فريد',           icon: <UsersRound size={20} className="text-indigo-600" />,  bg: 'bg-indigo-50',  border: 'border-indigo-100'  },
          { label: 'VIP (4+ طلبات)',    value: fmt(stats.vip),            sub: `${pct(stats.vip, stats.total)}% من العملاء`, icon: <Crown size={20} className="text-amber-600" />, bg: 'bg-amber-50', border: 'border-amber-100' },
          { label: 'معدل التكرار',      value: `${stats.repeatRate}%`,    sub: 'مشتروا أكثر من مرة',  icon: <Repeat2 size={20} className="text-emerald-600" />,   bg: 'bg-emerald-50', border: 'border-emerald-100' },
          { label: 'متوسط LTV',         value: fmtR(stats.avgLTV),        sub: 'قيمة العميل مدى الحياة', icon: <TrendingUp size={20} className="text-blue-600" />, bg: 'bg-blue-50',    border: 'border-blue-100'    },
        ].map((k, i) => (
          <div key={i} className={`${k.bg} border ${k.border} rounded-2xl p-5`}>
            <div className="w-9 h-9 bg-white rounded-xl flex items-center justify-center shadow-sm mb-3">{k.icon}</div>
            <p className="text-xs font-black text-slate-400 mb-1">{k.label}</p>
            <p className="text-2xl font-black text-slate-800">{k.value}</p>
            <p className="text-xs text-slate-400 mt-0.5">{k.sub}</p>
          </div>
        ))}
      </div>

      {/* شرائح سريعة */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-5">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { id: 'vip',      label: 'VIP',        count: stats.vip,     color: 'text-amber-600',  bg: 'bg-amber-50',  border: 'border-amber-200',  icon: <Crown size={14} />       },
            { id: 'repeat',   label: 'متكرر',      count: stats.repeat,  color: 'text-indigo-600', bg: 'bg-indigo-50', border: 'border-indigo-200', icon: <Repeat2 size={14} />     },
            { id: 'new',      label: 'جديد',       count: stats.newC,    color: 'text-slate-500',  bg: 'bg-slate-50',  border: 'border-slate-200',  icon: <Star size={14} />        },
            { id: 'one_time', label: 'لم يكرروا',  count: stats.oneTime, color: 'text-rose-600',   bg: 'bg-rose-50',   border: 'border-rose-200',   icon: <ShoppingBag size={14} /> },
          ].map(s => (
            <button key={s.id}
              onClick={() => setSegment(segment === s.id ? 'all' : s.id)}
              className={`flex items-center justify-between p-4 rounded-2xl border transition-all ${
                segment === s.id ? `${s.bg} ${s.border}` : 'border-slate-100 hover:bg-slate-50'
              }`}>
              <div className="flex items-center gap-2">
                <span className={s.color}>{s.icon}</span>
                <span className={`text-sm font-black ${segment === s.id ? s.color : 'text-slate-600'}`}>{s.label}</span>
              </div>
              <span className={`text-xl font-black ${s.color}`}>{s.count}</span>
            </button>
          ))}
        </div>
      </div>

      {segment === 'one_time' && (
        <div className="bg-rose-50 border border-rose-100 rounded-2xl px-5 py-4 flex items-center gap-3">
          <ShoppingBag size={18} className="text-rose-500 flex-shrink-0" />
          <p className="text-xs font-bold text-rose-700 leading-6">
            هذه شريحة عملاء اشتروا مرة واحدة فقط. مناسبة لاحقاً لحملة واتساب لإعادة الشراء أو تجربة عطر/بكج مختلف.
          </p>
        </div>
      )}

      {/* البحث والفلاتر */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm px-5 py-4 flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="ابحث بالاسم أو الجوال أو المدينة..."
            className="w-full bg-slate-50 border border-slate-200 rounded-xl pr-9 pl-4 py-2.5 text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-300"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
              <X size={13} />
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Filter size={14} className="text-slate-400" />
          <span className="text-xs font-black text-slate-400">ترتيب:</span>
          {['spent','orders','recent'].map((id) => {
            const label = id === 'spent' ? 'الأعلى إنفاقاً' : id === 'orders' ? 'الأكثر طلبات' : 'الأحدث';
            return (
              <button key={id} onClick={() => setSortBy(id)}
                className={`text-xs font-black px-3 py-1.5 rounded-lg transition-all ${
                  sortBy === id ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                }`}>
                {label}
              </button>
            );
          })}
        </div>
        <span className="text-xs text-slate-400 font-bold">{fmt(filtered.length)} نتيجة</span>
      </div>

      {/* قائمة العملاء */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-16 text-center">
          <UsersRound size={40} className="text-slate-200 mx-auto mb-3" />
          <p className="text-slate-400 font-bold">
            {orders.length === 0 ? 'لا يوجد بيانات — ارفع ملف من تبويب الاستيراد' : 'لا توجد نتائج مطابقة'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(c => <CustomerRow key={c.key} customer={c} />)}
        </div>
      )}
    </div>
  );
}

function pct(a, b) { return b ? ((a / b) * 100).toFixed(0) : '0'; }
