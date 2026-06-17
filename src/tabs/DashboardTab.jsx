import React, { useEffect, useMemo, useState } from 'react';
import {
  TrendingUp, ShoppingBag, PackageOpen, Zap,
  Target, DollarSign, BarChart2, Award,
  CheckCircle, AlertTriangle, RefreshCw, Clock,
  Download, Plus, Save, X,
} from 'lucide-react';
import { collection, deleteDoc, doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db, appId } from '../config/firebase';
import { PRODUCT_CATALOG } from '../constants/masterMapping';

const CHANNEL_META = {
  'سعيدينيو': { color: '#6366f1', bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200' },
  'دستور': { color: '#10b981', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  'TikTok/Snapchat': { color: '#f59e0b', bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
  'واتساب': { color: '#3b82f6', bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
  'مباشر': { color: '#94a3b8', bg: 'bg-slate-50', text: 'text-slate-600', border: 'border-slate-200' },
  'غير محدد': { color: '#94a3b8', bg: 'bg-slate-50', text: 'text-slate-600', border: 'border-slate-200' },
};

const MONTHS_AR = {
  '01': 'يناير', '02': 'فبراير', '03': 'مارس', '04': 'أبريل',
  '05': 'مايو', '06': 'يونيو', '07': 'يوليو', '08': 'أغسطس',
  '09': 'سبتمبر', '10': 'أكتوبر', '11': 'نوفمبر', '12': 'ديسمبر',
};

const fmt = (n) => Number(n || 0).toLocaleString('ar-SA');
const fmtR = (n) => `${fmt(n)} ر`;
const adCol = () => collection(db, 'artifacts', appId, 'public', 'data', 'ad_costs');
const getOrderDate = (order) => String(order?.date || '').slice(0, 10);
const getOrderMonth = (order) => String(order?.date || '').slice(0, 7);

const isDateInRange = (orderDate, from, to) => {
  const d = String(orderDate || '').slice(0, 10);
  if (!d) return false;
  if (from && d < from) return false;
  if (to && d > to) return false;
  return true;
};

function MiniBar({ value, max, color = '#6366f1' }) {
  const w = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="h-2 bg-slate-100 rounded-full overflow-hidden w-full">
      <div className="h-full rounded-full transition-all duration-700" style={{ width: `${w}%`, background: color }} />
    </div>
  );
}

function Sparkline({ data, color = '#6366f1', height = 36 }) {
  if (!data || data.length < 2) return null;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const w = 120;
  const h = height;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((v - min) / range) * (h - 4) - 2;
    return `${x},${y}`;
  }).join(' ');
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width={w} height={h} style={{ overflow: 'visible' }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      <polyline points={`0,${h} ${pts} ${w},${h}`} fill={color} fillOpacity="0.08" stroke="none" />
    </svg>
  );
}

function KpiCard({ label, value, sub, icon, bg, border, trend, trendColor }) {
  return (
    <div className={`${bg} border ${border} rounded-2xl p-5 flex flex-col gap-3`}>
      <div className="flex items-center justify-between">
        <div className="w-9 h-9 bg-white rounded-xl flex items-center justify-center shadow-sm">{icon}</div>
        {trend && <Sparkline data={trend} color={trendColor} />}
      </div>
      <div>
        <p className="text-xs font-black text-slate-400 mb-1">{label}</p>
        <p className="text-2xl font-black text-slate-800">{value}</p>
        {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

function AdCostsManager({ adCosts, channels, onSaved }) {
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ channel: '', month: '', amount: '' });

  const monthOptions = useMemo(() => {
    const opts = [];
    const now = new Date();
    for (let i = 0; i < 12; i += 1) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      opts.push({ value: `${d.getFullYear()}-${mm}`, label: `${MONTHS_AR[mm]} ${d.getFullYear()}` });
    }
    return opts;
  }, []);

  const handleSave = async () => {
    if (!form.channel || !form.month || !form.amount) return;
    setSaving(true);
    try {
      const id = `${form.channel}_${form.month}`;
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'ad_costs', id), {
        channel: form.channel,
        month: form.month,
        amount: parseFloat(form.amount),
        savedAt: new Date().toISOString(),
      });
      setForm({ channel: '', month: '', amount: '' });
      setShowForm(false);
      onSaved?.();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'ad_costs', id));
  };

  const grouped = useMemo(() => {
    const map = {};
    adCosts.forEach((c) => {
      if (!map[c.channel]) map[c.channel] = [];
      map[c.channel].push(c);
    });
    return map;
  }, [adCosts]);

  return (
    <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <Target size={18} className="text-indigo-500" />
          <h3 className="font-black text-slate-800">تكاليف الإعلانات</h3>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-1.5 text-xs font-black bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-2 rounded-xl transition-colors">
          <Plus size={13} /> إضافة تكلفة
        </button>
      </div>

      {showForm && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-4 mb-4">
          <p className="text-xs font-black text-indigo-700 mb-3">إضافة تكلفة إعلان</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-3">
            <div>
              <label className="text-xs font-black text-slate-500 mb-1 block">القناة</label>
              <select value={form.channel} onChange={(e) => setForm((p) => ({ ...p, channel: e.target.value }))} className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-300">
                <option value="">اختر القناة</option>
                {channels.map((ch) => <option key={ch} value={ch}>{ch}</option>)}
                {Object.keys(CHANNEL_META).filter((ch) => !channels.includes(ch) && ch !== 'غير محدد' && ch !== 'مباشر').map((ch) => <option key={ch} value={ch}>{ch}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-black text-slate-500 mb-1 block">الشهر</label>
              <select value={form.month} onChange={(e) => setForm((p) => ({ ...p, month: e.target.value }))} className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-300">
                <option value="">اختر الشهر</option>
                {monthOptions.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-black text-slate-500 mb-1 block">المبلغ (ريال)</label>
              <input type="number" value={form.amount} placeholder="مثال: 15000" onChange={(e) => setForm((p) => ({ ...p, amount: e.target.value }))} className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowForm(false)} className="text-xs font-bold text-slate-400 hover:text-slate-600 px-3 py-1.5">إلغاء</button>
            <button onClick={handleSave} disabled={!form.channel || !form.month || !form.amount || saving} className={`flex items-center gap-1.5 text-xs font-black px-4 py-1.5 rounded-xl transition-colors ${form.channel && form.month && form.amount && !saving ? 'bg-indigo-600 text-white hover:bg-indigo-700' : 'bg-slate-100 text-slate-400 cursor-not-allowed'}`}>
              <Save size={12} /> {saving ? 'جاري الحفظ...' : 'حفظ'}
            </button>
          </div>
        </div>
      )}

      {adCosts.length === 0 ? (
        <div className="text-center py-8">
          <Target size={28} className="text-slate-200 mx-auto mb-2" />
          <p className="text-xs text-slate-400 font-bold">لا يوجد تكاليف مسجّلة — أضف تكلفة الإعلان لحساب ROAS</p>
        </div>
      ) : (
        <div className="space-y-3">
          {Object.entries(grouped).map(([ch, entries]) => {
            const meta = CHANNEL_META[ch] || CHANNEL_META['غير محدد'];
            return (
              <div key={ch} className={`rounded-xl border ${meta.border} ${meta.bg} p-3`}>
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-2 h-2 rounded-full" style={{ background: meta.color }} />
                  <span className={`text-xs font-black ${meta.text}`}>{ch}</span>
                </div>
                <div className="space-y-1.5">
                  {[...entries].sort((a, b) => String(b.month || '').localeCompare(String(a.month || ''))).map((e) => {
                    const [yy, mm] = String(e.month || '').split('-');
                    return (
                      <div key={e.id} className="flex items-center justify-between bg-white rounded-lg px-3 py-2 border border-slate-100">
                        <span className="text-xs text-slate-500 font-bold">{MONTHS_AR[mm] || mm} {yy}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-black text-slate-700">{fmtR(e.amount)}</span>
                          <button onClick={() => handleDelete(e.id)} className="text-slate-300 hover:text-rose-500 transition-colors"><X size={13} /></button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function exportCSV({ channelStats, skuStats, adCosts }) {
  const lines = ['\uFEFF'];

  lines.push('تقرير الإيرادات per قناة');
  lines.push('القناة,الطلبات,الإيرادات,تكلفة الإعلانات,ROAS');
  const totalCostPerChannel = {};
  adCosts.forEach((c) => {
    totalCostPerChannel[c.channel] = (totalCostPerChannel[c.channel] || 0) + (c.amount || 0);
  });
  Object.entries(channelStats).forEach(([ch, st]) => {
    const cost = totalCostPerChannel[ch] || 0;
    const roas = cost > 0 ? (st.revenue / cost).toFixed(2) : '—';
    lines.push(`${ch},${st.orders},${st.revenue},${cost},${roas}`);
  });

  lines.push('');
  lines.push('تقرير المبيعات per SKU');
  lines.push('SKU,اسم المنتج,الطلبات,الوحدات');
  Object.entries(skuStats).sort((a, b) => b[1].units - a[1].units).forEach(([sku, st]) => {
    lines.push(`${sku},${PRODUCT_CATALOG[sku]?.name || sku},${st.orders},${st.units}`);
  });

  lines.push('');
  lines.push('تكاليف الإعلانات الشهرية');
  lines.push('القناة,الشهر,المبلغ');
  [...adCosts].sort((a, b) => String(b.month || '').localeCompare(String(a.month || ''))).forEach((c) => {
    const [yy, mm] = String(c.month || '').split('-');
    lines.push(`${c.channel},${MONTHS_AR[mm] || mm} ${yy},${c.amount}`);
  });

  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `asparkle-report-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function DashboardTab() {
  const [orders, setOrders] = useState([]);
  const [adCosts, setAdCosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [awbInput, setAwbInput] = useState('');
  const [awbResult, setAwbResult] = useState(null);
  const [filters, setFilters] = useState({ from: '', to: '', month: '', channel: 'all' });

  const resetFilters = () => setFilters({ from: '', to: '', month: '', channel: 'all' });

  useEffect(() => {
    const unsubOrders = onSnapshot(
      collection(db, 'artifacts', appId, 'public', 'data', 'orders'),
      (snap) => {
        setOrders(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setLoading(false);
      }
    );
    const unsubCosts = onSnapshot(
      adCol(),
      (snap) => setAdCosts(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    );
    return () => {
      unsubOrders();
      unsubCosts();
    };
  }, []);

  const availableMonths = useMemo(() => {
    const months = new Set();
    orders.forEach((o) => {
      const month = getOrderMonth(o);
      if (month && month.length === 7) months.add(month);
    });
    return Array.from(months).sort().reverse();
  }, [orders]);

  const availableChannels = useMemo(() => {
    const channels = new Set();
    orders.forEach((o) => channels.add(o.channel || 'غير محدد'));
    return Array.from(channels).sort((a, b) => a.localeCompare(b, 'ar'));
  }, [orders]);

  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      const ch = o.channel || 'غير محدد';
      const orderMonth = getOrderMonth(o);
      if (filters.channel !== 'all' && ch !== filters.channel) return false;
      if (filters.month && orderMonth !== filters.month) return false;
      if (!filters.month && (filters.from || filters.to)) return isDateInRange(o.date, filters.from, filters.to);
      return true;
    });
  }, [orders, filters]);

  const filteredAdCosts = useMemo(() => {
    return adCosts.filter((c) => {
      if (filters.channel !== 'all' && c.channel !== filters.channel) return false;
      if (filters.month) return c.month === filters.month;
      if (filters.from || filters.to) {
        const fromMonth = filters.from ? filters.from.slice(0, 7) : '';
        const toMonth = filters.to ? filters.to.slice(0, 7) : '';
        if (fromMonth && c.month < fromMonth) return false;
        if (toMonth && c.month > toMonth) return false;
      }
      return true;
    });
  }, [adCosts, filters]);

  const channelStats = useMemo(() => {
    const map = {};
    filteredOrders.forEach((o) => {
      const ch = o.channel || 'غير محدد';
      if (!map[ch]) map[ch] = { revenue: 0, orders: 0 };
      map[ch].revenue += o.total || 0;
      map[ch].orders += 1;
    });
    return map;
  }, [filteredOrders]);

  const skuStats = useMemo(() => {
    const map = {};
    filteredOrders.forEach((o) => {
      if (!o.skuBreakdown) return;
      Object.entries(o.skuBreakdown).forEach(([sku, qty]) => {
        if (!map[sku]) map[sku] = { orders: 0, units: 0 };
        map[sku].orders += 1;
        map[sku].units += Number(qty || 0);
      });
    });
    return map;
  }, [filteredOrders]);

  const costPerChannel = useMemo(() => {
    const map = {};
    filteredAdCosts.forEach((c) => {
      map[c.channel] = (map[c.channel] || 0) + (c.amount || 0);
    });
    return map;
  }, [filteredAdCosts]);

  const monthlyTrend = useMemo(() => {
    const map = {};
    filteredOrders.forEach((o) => {
      const mo = getOrderMonth(o);
      if (!mo) return;
      map[mo] = (map[mo] || 0) + 1;
    });
    return Object.keys(map).sort().slice(-6).map((k) => map[k]);
  }, [filteredOrders]);

  const loadedOrdersCount = orders.length;
  const totalOrders = filteredOrders.length;
  const totalRevenue = useMemo(() => filteredOrders.reduce((s, o) => s + (o.total || 0), 0), [filteredOrders]);
  const totalCost = useMemo(() => filteredAdCosts.reduce((s, c) => s + (c.amount || 0), 0), [filteredAdCosts]);
  const totalRoas = totalCost > 0 ? (totalRevenue / totalCost).toFixed(2) : null;

  const topSkus = useMemo(() => Object.entries(skuStats).sort((a, b) => b[1].units - a[1].units), [skuStats]);
  const maxUnits = topSkus[0]?.[1]?.units || 1;
  const sortedChannels = useMemo(() => Object.entries(channelStats).sort((a, b) => b[1].revenue - a[1].revenue), [channelStats]);
  const maxChRevenue = sortedChannels[0]?.[1]?.revenue || 1;

  const verifyAWB = () => {
    const q = awbInput.trim().toLowerCase();
    const found = orders.find((o) => (o.reference || '').toLowerCase() === q);
    setAwbResult(found ? { found: true, order: found } : { found: false });
  };

  if (loading) {
    return (
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-16 flex items-center justify-center gap-3">
        <RefreshCw size={20} className="animate-spin text-indigo-500" />
        <span className="font-bold text-slate-400 text-sm">جاري تحميل البيانات...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6" dir="rtl">
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm px-8 py-5 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-black text-slate-800 flex items-center gap-2">
            <Zap size={22} className="text-indigo-500" /> لوحة التحكم
          </h2>
          <p className="text-slate-400 text-xs mt-1">
            بيانات من Firestore · <span className="font-black text-indigo-500">{fmt(totalOrders)}</span> طلب ظاهر من أصل {fmt(loadedOrdersCount)}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => exportCSV({ channelStats, skuStats, adCosts: filteredAdCosts })} className="flex items-center gap-2 text-xs font-black bg-slate-800 hover:bg-slate-900 text-white px-4 py-2 rounded-xl transition-colors">
            <Download size={14} /> تصدير CSV
          </button>
          <div className="flex items-center gap-2 text-xs text-emerald-600 font-black bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-100">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            متصل بـ Firebase
          </div>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-3xl p-4 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-end gap-3">
          <div className="flex-1">
            <label className="block text-xs font-black text-slate-500 mb-1">من تاريخ</label>
            <input type="date" value={filters.from} onChange={(e) => setFilters((p) => ({ ...p, from: e.target.value, month: '' }))} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
          </div>
          <div className="flex-1">
            <label className="block text-xs font-black text-slate-500 mb-1">إلى تاريخ</label>
            <input type="date" value={filters.to} onChange={(e) => setFilters((p) => ({ ...p, to: e.target.value, month: '' }))} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
          </div>
          <div className="flex-1">
            <label className="block text-xs font-black text-slate-500 mb-1">الشهر</label>
            <select value={filters.month} onChange={(e) => setFilters((p) => ({ ...p, month: e.target.value, from: '', to: '' }))} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-300">
              <option value="">كل الشهور</option>
              {availableMonths.map((m) => {
                const [yy, mm] = m.split('-');
                return <option key={m} value={m}>{MONTHS_AR[mm]} {yy}</option>;
              })}
            </select>
          </div>
          <div className="flex-1">
            <label className="block text-xs font-black text-slate-500 mb-1">القناة</label>
            <select value={filters.channel} onChange={(e) => setFilters((p) => ({ ...p, channel: e.target.value }))} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-300">
              <option value="all">كل القنوات</option>
              {availableChannels.map((ch) => <option key={ch} value={ch}>{ch}</option>)}
            </select>
          </div>
          <button onClick={resetFilters} className="bg-slate-100 hover:bg-slate-200 text-slate-600 px-4 py-2 rounded-xl text-xs font-black transition-colors">تصفير الفلاتر</button>
        </div>
        <div className="mt-3 text-xs font-bold text-slate-400">ظاهر الآن {fmt(totalOrders)} طلب من أصل {fmt(loadedOrdersCount)} طلب</div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="إجمالي الإيرادات" value={fmtR(totalRevenue)} sub={`${fmt(totalOrders)} طلب`} icon={<DollarSign size={20} className="text-emerald-600" />} bg="bg-emerald-50" border="border-emerald-100" trend={monthlyTrend} trendColor="#10b981" />
        <KpiCard label="إجمالي الطلبات" value={fmt(totalOrders)} sub="حسب الفلاتر الحالية" icon={<ShoppingBag size={20} className="text-indigo-600" />} bg="bg-indigo-50" border="border-indigo-100" trend={monthlyTrend} trendColor="#6366f1" />
        <KpiCard label="ROAS الإجمالي" value={totalRoas ? `${totalRoas}x` : '—'} sub={totalCost > 0 ? `إنفاق ${fmtR(totalCost)}` : 'أضف تكاليف الإعلانات'} icon={<Target size={20} className="text-amber-600" />} bg="bg-amber-50" border="border-amber-100" />
        <KpiCard label="متوسط قيمة الطلب" value={totalOrders ? fmtR(Math.round(totalRevenue / totalOrders)) : '—'} sub="لكل طلب" icon={<BarChart2 size={20} className="text-blue-600" />} bg="bg-blue-50" border="border-blue-100" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6">
          <div className="flex items-center gap-2 mb-5">
            <TrendingUp size={18} className="text-indigo-500" />
            <h3 className="font-black text-slate-800">الإيرادات per قناة + ROAS</h3>
          </div>
          <div className="space-y-3">
            {sortedChannels.length === 0 ? <p className="text-center py-8 text-sm font-bold text-slate-400">لا توجد طلبات مطابقة للفلاتر الحالية</p> : sortedChannels.map(([ch, st]) => {
              const meta = CHANNEL_META[ch] || CHANNEL_META['غير محدد'];
              const cost = costPerChannel[ch] || 0;
              const roas = cost > 0 ? (st.revenue / cost).toFixed(1) : null;
              const good = roas && Number(roas) >= 2;
              return (
                <div key={ch} className={`p-3 rounded-xl border ${meta.border} ${meta.bg}`}>
                  <div className="flex items-center gap-3">
                    <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: meta.color }} />
                    <div className="flex-1 min-w-0">
                      <p className={`text-xs font-black ${meta.text}`}>{ch}</p>
                      <p className="text-xs text-slate-400">{fmt(st.orders)} طلب · {fmtR(st.revenue)}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {cost > 0 && <span className="text-xs text-slate-400">إنفاق {fmtR(cost)}</span>}
                      {roas && <span className={`text-xs font-black px-2 py-1 rounded-lg whitespace-nowrap ${good ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-600'}`}>ROAS {roas}x</span>}
                    </div>
                  </div>
                  <div className="mt-2"><MiniBar value={st.revenue} max={maxChRevenue} color={meta.color} /></div>
                </div>
              );
            })}
          </div>
          {totalCost > 0 && (
            <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between">
              <span className="text-xs font-black text-slate-500">الإجمالي</span>
              <div className="flex items-center gap-3">
                <span className="text-xs text-slate-400">إنفاق {fmtR(totalCost)}</span>
                <span className={`font-black text-sm px-3 py-1 rounded-xl ${Number(totalRoas) >= 2 ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-600'}`}>ROAS {totalRoas}x</span>
              </div>
            </div>
          )}
        </div>
        <AdCostsManager adCosts={adCosts} channels={availableChannels} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6">
          <div className="flex items-center gap-2 mb-5">
            <PackageOpen size={18} className="text-indigo-500" />
            <h3 className="font-black text-slate-800">المبيعات per SKU</h3>
          </div>
          {topSkus.length === 0 ? (
            <div className="text-center py-10">
              <PackageOpen size={32} className="text-slate-200 mx-auto mb-2" />
              <p className="text-slate-400 text-sm">لا يوجد بيانات مطابقة للفلاتر الحالية</p>
            </div>
          ) : (
            <div className="space-y-4">
              {topSkus.map(([sku, st], i) => {
                const name = PRODUCT_CATALOG[sku]?.name || sku;
                const colors = ['#6366f1', '#10b981', '#f59e0b', '#3b82f6', '#ec4899', '#8b5cf6', '#14b8a6'];
                return (
                  <div key={sku}>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        {i === 0 && <Award size={13} className="text-amber-400" />}
                        <span className="text-sm font-black text-slate-700">{name}</span>
                        <span className="text-xs text-slate-300 font-mono">{sku}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-400">{fmt(st.orders)} طلب</span>
                        <span className="text-xs font-black bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-lg">{fmt(st.units)} وحدة</span>
                      </div>
                    </div>
                    <MiniBar value={st.units} max={maxUnits} color={colors[i % colors.length]} />
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6">
          <div className="flex items-center gap-2 mb-5">
            <CheckCircle size={18} className="text-indigo-500" />
            <h3 className="font-black text-slate-800">التحقق من الطلب</h3>
          </div>
          <div className="flex gap-2 mb-4">
            <input value={awbInput} onChange={(e) => setAwbInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && verifyAWB()} placeholder="رقم الطلب..." className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
            <button onClick={verifyAWB} className="bg-indigo-600 hover:bg-indigo-700 text-white font-black text-sm px-5 py-2.5 rounded-xl transition-colors">بحث</button>
          </div>
          {awbResult && (
            <div className={`rounded-2xl p-4 border ${awbResult.found ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-50 border-slate-200'}`}>
              {!awbResult.found ? <p className="text-sm font-bold text-slate-500 flex items-center gap-2"><AlertTriangle size={16} className="text-amber-400" /> الطلب غير موجود</p> : (() => {
                const o = awbResult.order;
                const meta = CHANNEL_META[o.channel] || CHANNEL_META['غير محدد'];
                return (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-black text-emerald-700">✅ {o.reference}</span>
                      <span className={`text-xs font-black px-2 py-0.5 rounded-lg ${meta.bg} ${meta.text}`}>{o.channel}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      {[
                        ['العميل', o.customer?.name], ['المدينة', o.customer?.city],
                        ['الإجمالي', fmtR(o.total)], ['التاريخ', getOrderDate(o)], ['الدفع', o.paymentMethod],
                      ].map(([k, v]) => (
                        <div key={k} className="bg-white rounded-lg px-3 py-2 border border-slate-100">
                          <p className="text-slate-400 font-bold">{k}</p>
                          <p className="text-slate-700 font-black mt-0.5">{v || '—'}</p>
                        </div>
                      ))}
                    </div>
                    {o.skuBreakdown && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {Object.entries(o.skuBreakdown).map(([sku, qty]) => (
                          <span key={sku} className="bg-indigo-50 text-indigo-700 text-xs font-black px-2 py-0.5 rounded-lg">{PRODUCT_CATALOG[sku]?.name || sku} ×{qty}</span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      </div>

      <div className="bg-slate-50 rounded-2xl border border-slate-100 px-6 py-3 flex items-center gap-2">
        <Clock size={14} className="text-slate-400 flex-shrink-0" />
        <p className="text-xs text-slate-400 font-bold">البيانات من Firestore · الطلبات والتكاليف المعروضة تتغير حسب الفلاتر · ROAS = الإيراد ÷ مجموع تكاليف القناة</p>
      </div>
    </div>
  );
}
