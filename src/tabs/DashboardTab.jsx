import React, { useEffect, useState, useMemo } from 'react';
import {
  TrendingUp, ShoppingBag, PackageOpen, Zap,
  Target, DollarSign, BarChart2, Award,
  CheckCircle, AlertTriangle, RefreshCw, Clock,
} from 'lucide-react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db, appId } from '../config/firebase';
import { PRODUCT_CATALOG } from '../constants/masterMapping';

const CHANNEL_META = {
  'سعيدينيو':        { color: '#6366f1', bg: 'bg-indigo-50',  text: 'text-indigo-700',  border: 'border-indigo-200'  },
  'دستور':           { color: '#10b981', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  'TikTok/Snapchat': { color: '#f59e0b', bg: 'bg-amber-50',   text: 'text-amber-700',   border: 'border-amber-200'   },
  'واتساب':          { color: '#3b82f6', bg: 'bg-blue-50',    text: 'text-blue-700',    border: 'border-blue-200'    },
  'مباشر':           { color: '#94a3b8', bg: 'bg-slate-50',   text: 'text-slate-600',   border: 'border-slate-200'   },
  'غير محدد':        { color: '#94a3b8', bg: 'bg-slate-50',   text: 'text-slate-600',   border: 'border-slate-200'   },
};

const fmt  = (n) => Number(n || 0).toLocaleString('ar-SA');
const fmtR = (n) => `${fmt(n)} ر`;
const pct  = (a, b) => b ? ((a / b) * 100).toFixed(1) : '0';

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
  const max = Math.max(...data), min = Math.min(...data);
  const range = max - min || 1;
  const w = 120, h = height;
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

export default function DashboardTab() {
  const [orders,    setOrders]    = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [costs,     setCosts]     = useState({});
  const [awbInput,  setAwbInput]  = useState('');
  const [awbResult, setAwbResult] = useState(null);

  useEffect(() => {
    const col = collection(db, 'artifacts', appId, 'public', 'data', 'orders');
    const unsub = onSnapshot(col, snap => {
      setOrders(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const channelStats = useMemo(() => {
    const map = {};
    orders.forEach(o => {
      const ch = o.channel || 'غير محدد';
      if (!map[ch]) map[ch] = { revenue: 0, orders: 0 };
      map[ch].revenue += o.total || 0;
      map[ch].orders  += 1;
    });
    return map;
  }, [orders]);

  const skuStats = useMemo(() => {
    const map = {};
    orders.forEach(o => {
      if (!o.skuBreakdown) return;
      Object.entries(o.skuBreakdown).forEach(([sku, qty]) => {
        if (!map[sku]) map[sku] = { orders: 0, units: 0 };
        map[sku].orders += 1;
        map[sku].units  += qty;
      });
    });
    return map;
  }, [orders]);

  const monthlyTrend = useMemo(() => {
    const map = {};
    orders.forEach(o => {
      const mo = (o.date || '').slice(0, 7);
      if (!mo) return;
      map[mo] = (map[mo] || 0) + 1;
    });
    return Object.keys(map).sort().slice(-6).map(k => map[k]);
  }, [orders]);

  const totalOrders  = orders.length;
  const totalRevenue = useMemo(() => orders.reduce((s, o) => s + (o.total || 0), 0), [orders]);
  const totalCost    = Object.values(costs).reduce((a, b) => a + (b || 0), 0);
  const totalRoas    = totalCost > 0 ? (totalRevenue / totalCost).toFixed(2) : null;

  const topSkus = useMemo(() =>
    Object.entries(skuStats).sort((a, b) => b[1].units - a[1].units),
    [skuStats]
  );
  const maxUnits = topSkus[0]?.[1]?.units || 1;

  const sortedChannels = useMemo(() =>
    Object.entries(channelStats).sort((a, b) => b[1].revenue - a[1].revenue),
    [channelStats]
  );
  const maxChRevenue = sortedChannels[0]?.[1]?.revenue || 1;

  const verifyAWB = () => {
    const q = awbInput.trim().toLowerCase();
    const found = orders.find(o => (o.reference || '').toLowerCase() === q);
    setAwbResult(found ? { found: true, order: found } : { found: false });
  };

  if (loading) return (
    <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-16 flex items-center justify-center gap-3">
      <RefreshCw size={20} className="animate-spin text-indigo-500" />
      <span className="font-bold text-slate-400 text-sm">جاري تحميل البيانات...</span>
    </div>
  );

  return (
    <div className="space-y-6" dir="rtl">

      {/* HEADER */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm px-8 py-5 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-black text-slate-800 flex items-center gap-2">
            <Zap size={22} className="text-indigo-500" /> لوحة التحكم
          </h2>
          <p className="text-slate-400 text-xs mt-1">
            بيانات من Firestore · <span className="font-black text-indigo-500">{fmt(totalOrders)}</span> طلب محمّل
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-emerald-600 font-black bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-100">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          متصل بـ Firebase
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="إجمالي الإيرادات" value={fmtR(totalRevenue)} sub={`${fmt(totalOrders)} طلب`}
          icon={<DollarSign size={20} className="text-emerald-600" />}
          bg="bg-emerald-50" border="border-emerald-100" trend={monthlyTrend} trendColor="#10b981" />
        <KpiCard label="إجمالي الطلبات" value={fmt(totalOrders)} sub="من orders"
          icon={<ShoppingBag size={20} className="text-indigo-600" />}
          bg="bg-indigo-50" border="border-indigo-100" trend={monthlyTrend} trendColor="#6366f1" />
        <KpiCard label="ROAS الإجمالي" value={totalRoas ? `${totalRoas}x` : '—'}
          sub={totalCost > 0 ? `إنفاق ${fmtR(totalCost)}` : 'أدخل التكاليف أدناه'}
          icon={<Target size={20} className="text-amber-600" />}
          bg="bg-amber-50" border="border-amber-100" />
        <KpiCard label="متوسط قيمة الطلب"
          value={totalOrders ? fmtR(Math.round(totalRevenue / totalOrders)) : '—'} sub="لكل طلب"
          icon={<BarChart2 size={20} className="text-blue-600" />}
          bg="bg-blue-50" border="border-blue-100" />
      </div>

      {/* CHANNELS + SKUs */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6">
          <div className="flex items-center gap-2 mb-5">
            <TrendingUp size={18} className="text-indigo-500" />
            <h3 className="font-black text-slate-800">الإيرادات per قناة + ROAS</h3>
          </div>
          <div className="space-y-3">
            {sortedChannels.map(([ch, st]) => {
              const meta = CHANNEL_META[ch] || CHANNEL_META['غير محدد'];
              const cost = costs[ch] || 0;
              const roas = cost > 0 ? (st.revenue / cost).toFixed(1) : null;
              const good = roas && Number(roas) >= 2;
              return (
                <div key={ch} className={`flex items-center gap-3 p-3 rounded-xl border ${meta.border} ${meta.bg}`}>
                  <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: meta.color }} />
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs font-black ${meta.text} truncate`}>{ch}</p>
                    <p className="text-xs text-slate-400">{fmt(st.orders)} طلب · {fmtR(st.revenue)}</p>
                  </div>
                  <input type="number" value={cost || ''} placeholder="التكلفة"
                    onChange={e => setCosts(p => ({ ...p, [ch]: Number(e.target.value) }))}
                    className="w-24 bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                  />
                  {roas && (
                    <span className={`text-xs font-black px-2 py-1 rounded-lg whitespace-nowrap ${good ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-600'}`}>
                      {roas}x
                    </span>
                  )}
                </div>
              );
            })}
          </div>
          {totalCost > 0 && (
            <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between">
              <span className="text-xs font-black text-slate-500">الإجمالي</span>
              <div className="flex items-center gap-3">
                <span className="text-xs text-slate-400">{fmtR(totalCost)} إنفاق</span>
                <span className={`font-black text-sm px-3 py-1 rounded-xl ${Number(totalRoas) >= 2 ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-600'}`}>
                  ROAS {totalRoas}x
                </span>
              </div>
            </div>
          )}
        </div>

        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6">
          <div className="flex items-center gap-2 mb-5">
            <PackageOpen size={18} className="text-indigo-500" />
            <h3 className="font-black text-slate-800">المبيعات per SKU</h3>
          </div>
          {topSkus.length === 0 ? (
            <div className="text-center py-10">
              <PackageOpen size={32} className="text-slate-200 mx-auto mb-2" />
              <p className="text-slate-400 text-sm">لا يوجد بيانات — ارفع ملف من تبويب الاستيراد</p>
            </div>
          ) : (
            <div className="space-y-4">
              {topSkus.map(([sku, st], i) => {
                const name = PRODUCT_CATALOG[sku]?.name || sku;
                const colors = ['#6366f1','#10b981','#f59e0b','#3b82f6','#ec4899','#8b5cf6','#14b8a6'];
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
                        <span className="text-xs font-black bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-lg">
                          {fmt(st.units)} وحدة
                        </span>
                      </div>
                    </div>
                    <MiniBar value={st.units} max={maxUnits} color={colors[i % colors.length]} />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* AWB VERIFY + CHANNEL BAR */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6">
          <div className="flex items-center gap-2 mb-5">
            <CheckCircle size={18} className="text-indigo-500" />
            <h3 className="font-black text-slate-800">التحقق من الطلب</h3>
          </div>
          <div className="flex gap-2 mb-4">
            <input value={awbInput} onChange={e => setAwbInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && verifyAWB()}
              placeholder="رقم الطلب..."
              className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-300"
            />
            <button onClick={verifyAWB}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-black text-sm px-5 py-2.5 rounded-xl transition-colors">
              بحث
            </button>
          </div>
          {awbResult && (
            <div className={`rounded-2xl p-4 border ${awbResult.found ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-50 border-slate-200'}`}>
              {!awbResult.found
                ? <p className="text-sm font-bold text-slate-500 flex items-center gap-2"><AlertTriangle size={16} className="text-amber-400" /> الطلب غير موجود</p>
                : (() => {
                    const o = awbResult.order;
                    const meta = CHANNEL_META[o.channel] || CHANNEL_META['غير محدد'];
                    return (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-black text-emerald-700">✅ {o.reference}</span>
                          <span className={`text-xs font-black px-2 py-0.5 rounded-lg ${meta.bg} ${meta.text}`}>{o.channel}</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          {[['العميل', o.customer?.name], ['المدينة', o.customer?.city],
                            ['الإجمالي', fmtR(o.total)], ['التاريخ', o.date],
                            ['الدفع', o.paymentMethod]].map(([k, v]) => (
                            <div key={k} className="bg-white rounded-lg px-3 py-2 border border-slate-100">
                              <p className="text-slate-400 font-bold">{k}</p>
                              <p className="text-slate-700 font-black mt-0.5">{v || '—'}</p>
                            </div>
                          ))}
                        </div>
                        {o.skuBreakdown && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {Object.entries(o.skuBreakdown).map(([sku, qty]) => (
                              <span key={sku} className="bg-indigo-50 text-indigo-700 text-xs font-black px-2 py-0.5 rounded-lg">
                                {PRODUCT_CATALOG[sku]?.name || sku} ×{qty}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })()
              }
            </div>
          )}
        </div>

        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6">
          <div className="flex items-center gap-2 mb-5">
            <BarChart2 size={18} className="text-indigo-500" />
            <h3 className="font-black text-slate-800">توزيع الإيرادات per قناة</h3>
          </div>
          <div className="space-y-4">
            {sortedChannels.map(([ch, st]) => {
              const meta = CHANNEL_META[ch] || CHANNEL_META['غير محدد'];
              const w = Math.round((st.revenue / maxChRevenue) * 100);
              return (
                <div key={ch}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-black text-slate-600">{ch}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-400">{fmt(st.orders)} طلب</span>
                      <span className="text-xs font-black text-slate-600">{fmtR(st.revenue)}</span>
                    </div>
                  </div>
                  <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${w}%`, background: meta.color }} />
                  </div>
                  <p className="text-xs text-slate-400 mt-1">{pct(st.revenue, totalRevenue)}% من الإجمالي</p>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* FOOTER */}
      <div className="bg-slate-50 rounded-2xl border border-slate-100 px-6 py-3 flex items-center gap-2">
        <Clock size={14} className="text-slate-400 flex-shrink-0" />
        <p className="text-xs text-slate-400 font-bold">
          البيانات من Firestore · orders — القنوات من masterMapping · أدخل تكاليف الإعلانات لحساب ROAS
        </p>
      </div>
    </div>
  );
}
