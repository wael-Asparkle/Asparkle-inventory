import React, { useEffect, useState, useMemo } from 'react';
import {
  TrendingUp, ShoppingBag, PackageOpen, Users,
  Zap, ArrowUpRight, ArrowDownRight, RefreshCw,
  Target, DollarSign, BarChart2, Award, Calendar,
  CheckCircle, Clock, AlertTriangle,
} from 'lucide-react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db, appId } from '../config/firebase';

// ─────────────────────────────────────────────
// ATTRIBUTION MAP
// ─────────────────────────────────────────────
const ATTRIBUTION = {
  asg001: { label: 'سعيدينيو (يناير)', skus: ['9000901', '9000902'],                                         color: '#6366f1', bg: 'bg-indigo-50',  text: 'text-indigo-700',  border: 'border-indigo-200' },
  asg002: { label: 'دستور (مارس)',     skus: ['9000904','9000905','9000906','9000908','9000909'],             color: '#10b981', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  asg003: { label: 'ترويجية',          skus: ['9000904','9000905','9000906','9000908','9000909'],             color: '#f59e0b', bg: 'bg-amber-50',   text: 'text-amber-700',   border: 'border-amber-200' },
  asg004: { label: 'واتساب (مايو+)',   skus: ['9000904','9000905','9000906','9000908','9000909'],             color: '#3b82f6', bg: 'bg-blue-50',    text: 'text-blue-700',    border: 'border-blue-200' },
  direct: { label: 'مباشر',            skus: [],                                                             color: '#94a3b8', bg: 'bg-slate-50',   text: 'text-slate-600',   border: 'border-slate-200' },
};

const PRODUCT_NAMES = {
  '9000901': 'اسباركل الأخضر',
  '9000902': 'سجنتشر',
  '9000904': 'Moon Spark',
  '9000905': 'Spark Duo',
  '9000906': 'Spark Glow',
  '9000908': 'Spark Breeze',
  '9000909': 'Spark Ash',
};

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────
const fmt    = (n) => Number(n || 0).toLocaleString('ar-SA');
const fmtR   = (n) => `${fmt(n)} ر`;
const pct    = (a, b) => b ? ((a / b) * 100).toFixed(1) : '0';

function resolveChannel(sku, awb) {
  if (!awb) return 'direct';
  for (const [id, info] of Object.entries(ATTRIBUTION)) {
    if (id === 'direct') continue;
    if (info.skus.includes(sku)) return id;
  }
  return 'direct';
}

// Mini bar chart using pure divs
function MiniBar({ value, max, color = '#6366f1' }) {
  const w = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="h-2 bg-slate-100 rounded-full overflow-hidden w-full">
      <div
        className="h-full rounded-full transition-all duration-700"
        style={{ width: `${w}%`, background: color }}
      />
    </div>
  );
}

// Sparkline using SVG — no library needed
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

// ─────────────────────────────────────────────
// ROAS INPUT ROW
// ─────────────────────────────────────────────
function RoasRow({ id, info, revenue, orders, cost, onCostChange }) {
  const roas = cost > 0 ? (revenue / cost) : null;
  const roasGood = roas && roas >= 2;
  return (
    <div className={`flex items-center gap-3 p-3 rounded-xl border ${info.border} ${info.bg}`}>
      <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: info.color }} />
      <div className="flex-1 min-w-0">
        <p className={`text-xs font-black ${info.text} truncate`}>{info.label}</p>
        <p className="text-xs text-slate-400">{fmt(orders)} طلب · {fmtR(revenue)}</p>
      </div>
      <div className="flex items-center gap-2">
        <div className="relative">
          <input
            type="number"
            value={cost || ''}
            onChange={e => onCostChange(Number(e.target.value))}
            placeholder="التكلفة"
            className="w-24 bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-300 text-left"
          />
        </div>
        {roas !== null && (
          <span className={`text-xs font-black px-2 py-1 rounded-lg whitespace-nowrap ${roasGood ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-600'}`}>
            {roas.toFixed(1)}x
          </span>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────
export default function DashboardTab() {
  const [movements, setMovements] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [costs, setCosts]         = useState({ asg001: 0, asg002: 0, asg003: 0, asg004: 0 });
  const [awbInput, setAwbInput]   = useState('');
  const [awbResult, setAwbResult] = useState(null);

  // Firestore: stock_movements (contains AWB + SKU → enough for attribution)
  useEffect(() => {
    const col = collection(db, 'artifacts', appId, 'public', 'data', 'stock_movements');
    const unsub = onSnapshot(col, snap => {
      setMovements(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    return () => unsub();
  }, []);

  // ── Sales = SALE movements only
  const sales = useMemo(() => movements.filter(m => m.movementType === 'SALE'), [movements]);

  // ── Per-channel stats
  const channelStats = useMemo(() => {
    const stats = {};
    Object.keys(ATTRIBUTION).forEach(k => { stats[k] = { revenue: 0, orders: 0, skuMap: {} }; });
    sales.forEach(m => {
      const ch = resolveChannel(m.sku, m.awb);
      const qty = Math.abs(m.qty || 1);
      const rev = (m.price || 0) * qty;
      stats[ch].revenue += rev;
      stats[ch].orders  += qty;
      stats[ch].skuMap[m.sku] = (stats[ch].skuMap[m.sku] || 0) + qty;
    });
    return stats;
  }, [sales]);

  // ── Per-SKU stats
  const skuStats = useMemo(() => {
    const map = {};
    sales.forEach(m => {
      if (!m.sku) return;
      if (!map[m.sku]) map[m.sku] = { orders: 0, revenue: 0 };
      const qty = Math.abs(m.qty || 1);
      map[m.sku].orders  += qty;
      map[m.sku].revenue += (m.price || 0) * qty;
    });
    return map;
  }, [sales]);

  // ── Monthly trend (last 6 months)
  const monthlyTrend = useMemo(() => {
    const map = {};
    sales.forEach(m => {
      const mo = (m.date || m.createdAt || '').slice(0, 7);
      if (!mo) return;
      map[mo] = (map[mo] || 0) + Math.abs(m.qty || 1);
    });
    const sorted = Object.keys(map).sort();
    return sorted.slice(-6).map(k => map[k]);
  }, [sales]);

  // ── Totals
  const totalOrders  = useMemo(() => sales.reduce((s, m) => s + Math.abs(m.qty || 1), 0), [sales]);
  const totalRevenue = useMemo(() => sales.reduce((s, m) => s + (m.price || 0) * Math.abs(m.qty || 1), 0), [sales]);
  const delivered    = useMemo(() => movements.filter(m => m.movementType === 'SALE' && m.status === 'delivered').length, [movements]);
  const deliveryRate = totalOrders > 0 ? pct(delivered, totalOrders) : '—';

  // ── ROAS totals
  const totalCost  = Object.values(costs).reduce((a, b) => a + b, 0);
  const totalRoas  = totalCost > 0 ? (totalRevenue / totalCost).toFixed(2) : null;

  // ── AWB verify
  const verifyAWB = () => {
    const found = movements.find(m => (m.awb || '').toLowerCase() === awbInput.trim().toLowerCase());
    setAwbResult(found ? { found: true, m: found } : { found: false });
  };

  // ── Top SKUs sorted
  const topSkus = useMemo(() =>
    Object.entries(skuStats).sort((a, b) => b[1].orders - a[1].orders),
    [skuStats]
  );
  const maxSkuOrders = topSkus[0]?.[1]?.orders || 1;

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

      {/* ══ HEADER ══ */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm px-8 py-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h2 className="text-2xl font-black text-slate-800 flex items-center gap-2">
              <Zap size={24} className="text-indigo-500" />
              لوحة التحكم
            </h2>
            <p className="text-slate-400 text-xs mt-1">بيانات حقيقية من Firestore · stock_movements</p>
          </div>
          <div className="flex items-center gap-3 text-xs text-slate-400 font-bold">
            <span className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              متصل بـ Firebase
            </span>
          </div>
        </div>
      </div>

      {/* ══ KPI STRIP ══ */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: 'إجمالي الإيرادات',
            value: fmtR(totalRevenue),
            sub: `${fmt(totalOrders)} طلب`,
            icon: <DollarSign size={20} className="text-emerald-600" />,
            bg: 'bg-emerald-50', border: 'border-emerald-100',
            trend: monthlyTrend, trendColor: '#10b981',
          },
          {
            label: 'إجمالي الطلبات',
            value: fmt(totalOrders),
            sub: 'من stock_movements',
            icon: <ShoppingBag size={20} className="text-indigo-600" />,
            bg: 'bg-indigo-50', border: 'border-indigo-100',
            trend: monthlyTrend, trendColor: '#6366f1',
          },
          {
            label: 'ROAS الإجمالي',
            value: totalRoas ? `${totalRoas}x` : '—',
            sub: totalCost > 0 ? `تكلفة ${fmtR(totalCost)}` : 'أدخل التكاليف أدناه',
            icon: <Target size={20} className="text-amber-600" />,
            bg: 'bg-amber-50', border: 'border-amber-100',
          },
          {
            label: 'القنوات النشطة',
            value: Object.keys(ATTRIBUTION).length,
            sub: 'قناة attribution',
            icon: <BarChart2 size={20} className="text-blue-600" />,
            bg: 'bg-blue-50', border: 'border-blue-100',
          },
        ].map((k, i) => (
          <div key={i} className={`${k.bg} border ${k.border} rounded-2xl p-5 flex flex-col gap-3`}>
            <div className="flex items-center justify-between">
              <div className="w-9 h-9 bg-white rounded-xl flex items-center justify-center shadow-sm">
                {k.icon}
              </div>
              {k.trend && <Sparkline data={k.trend} color={k.trendColor} />}
            </div>
            <div>
              <p className="text-xs font-black text-slate-400 mb-1">{k.label}</p>
              <p className="text-2xl font-black text-slate-800">{k.value}</p>
              <p className="text-xs text-slate-400 mt-0.5">{k.sub}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ══ CHANNELS + ROAS + SKUs ══ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* القنوات + ROAS */}
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6">
          <div className="flex items-center gap-2 mb-5">
            <TrendingUp size={18} className="text-indigo-500" />
            <h3 className="font-black text-slate-800">الإيرادات per قناة + ROAS</h3>
          </div>
          <div className="space-y-3">
            {Object.entries(ATTRIBUTION).map(([id, info]) => {
              const st = channelStats[id] || { revenue: 0, orders: 0 };
              return (
                <RoasRow
                  key={id}
                  id={id}
                  info={info}
                  revenue={st.revenue}
                  orders={st.orders}
                  cost={costs[id] || 0}
                  onCostChange={v => setCosts(p => ({ ...p, [id]: v }))}
                />
              );
            })}
          </div>

          {/* ملخص ROAS */}
          {totalCost > 0 && (
            <div className="mt-5 pt-4 border-t border-slate-100">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-slate-500">الإجمالي</span>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-slate-400">{fmtR(totalCost)} إنفاق</span>
                  <span className={`font-black text-sm px-3 py-1 rounded-xl ${Number(totalRoas) >= 2 ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-600'}`}>
                    ROAS {totalRoas}x
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* المنتجات */}
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6">
          <div className="flex items-center gap-2 mb-5">
            <PackageOpen size={18} className="text-indigo-500" />
            <h3 className="font-black text-slate-800">المبيعات per SKU</h3>
          </div>
          {topSkus.length === 0 ? (
            <div className="text-center py-8">
              <PackageOpen size={32} className="text-slate-200 mx-auto mb-2" />
              <p className="text-slate-400 text-sm">لا يوجد بيانات مبيعات بعد</p>
              <p className="text-slate-300 text-xs mt-1">تأكد إن stock_movements يحتوي على movementType = SALE</p>
            </div>
          ) : (
            <div className="space-y-3">
              {topSkus.map(([sku, st], i) => (
                <div key={sku}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      {i === 0 && <Award size={13} className="text-amber-400" />}
                      <span className="text-sm font-black text-slate-700">
                        {PRODUCT_NAMES[sku] || sku}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      {st.revenue > 0 && (
                        <span className="text-xs text-slate-400">{fmtR(st.revenue)}</span>
                      )}
                      <span className="text-xs font-black text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-lg">
                        {fmt(st.orders)} وحدة
                      </span>
                    </div>
                  </div>
                  <MiniBar value={st.orders} max={maxSkuOrders} color={i === 0 ? '#6366f1' : i === 1 ? '#10b981' : '#94a3b8'} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ══ AWB VERIFY + CHANNEL BREAKDOWN ══ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* التحقق من AWB */}
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6">
          <div className="flex items-center gap-2 mb-5">
            <CheckCircle size={18} className="text-indigo-500" />
            <h3 className="font-black text-slate-800">التحقق من التسليم (AWB)</h3>
          </div>
          <div className="flex gap-2 mb-4">
            <input
              value={awbInput}
              onChange={e => setAwbInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && verifyAWB()}
              placeholder="BET1234567..."
              className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-300"
            />
            <button
              onClick={verifyAWB}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-black text-sm px-5 py-2.5 rounded-xl transition-colors"
            >
              بحث
            </button>
          </div>

          {awbResult && (
            <div className={`rounded-2xl p-4 border ${awbResult.found ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-50 border-slate-200'}`}>
              {!awbResult.found && (
                <p className="text-sm font-bold text-slate-500 flex items-center gap-2">
                  <AlertTriangle size={16} className="text-amber-500" />
                  البوليصة غير موجودة في النظام
                </p>
              )}
              {awbResult.found && (() => {
                const m = awbResult.m;
                const ch = resolveChannel(m.sku, m.awb);
                const info = ATTRIBUTION[ch];
                return (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-black text-slate-700">✅ وجدناها</span>
                      <span className={`text-xs font-black px-2 py-0.5 rounded-lg ${info.bg} ${info.text}`}>
                        {info.label}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      {[
                        ['SKU', m.sku],
                        ['المنتج', PRODUCT_NAMES[m.sku] || '—'],
                        ['النوع', m.movementType],
                        ['الكمية', Math.abs(m.qty || 0)],
                        ['التاريخ', (m.date || m.createdAt || '').slice(0,10)],
                        ['الحالة', m.status || '—'],
                      ].map(([k, v]) => (
                        <div key={k} className="bg-white rounded-lg px-3 py-2 border border-slate-100">
                          <p className="text-slate-400 font-bold">{k}</p>
                          <p className="text-slate-700 font-black mt-0.5">{v}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </div>
          )}
        </div>

        {/* توزيع الطلبات per قناة — bar chart بدون مكتبة */}
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6">
          <div className="flex items-center gap-2 mb-5">
            <BarChart2 size={18} className="text-indigo-500" />
            <h3 className="font-black text-slate-800">توزيع الطلبات per قناة</h3>
          </div>
          {(() => {
            const maxOrders = Math.max(...Object.values(channelStats).map(s => s.orders), 1);
            return (
              <div className="space-y-4">
                {Object.entries(ATTRIBUTION).map(([id, info]) => {
                  const st = channelStats[id] || { orders: 0, revenue: 0 };
                  const w = Math.round((st.orders / maxOrders) * 100);
                  return (
                    <div key={id}>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-black text-slate-600">{info.label}</span>
                        <span className="text-xs font-black text-slate-400">{fmt(st.orders)} طلب</span>
                      </div>
                      <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-700"
                          style={{ width: `${w}%`, background: info.color }}
                        />
                      </div>
                      {st.revenue > 0 && (
                        <p className="text-xs text-slate-400 mt-1 text-left">{fmtR(st.revenue)}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })()}

          {/* تنبيه لو مافيه price في الـ movements */}
          {totalRevenue === 0 && totalOrders > 0 && (
            <div className="mt-4 bg-amber-50 border border-amber-200 rounded-xl p-3">
              <p className="text-xs font-bold text-amber-700 flex items-center gap-1">
                <AlertTriangle size={13} />
                الإيرادات صفر — تأكد إن حقل <code className="bg-amber-100 px-1 rounded">price</code> موجود في stock_movements
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ══ FOOTER NOTE ══ */}
      <div className="bg-slate-50 rounded-2xl border border-slate-100 px-6 py-4 flex items-center gap-3">
        <Clock size={15} className="text-slate-400 flex-shrink-0" />
        <p className="text-xs text-slate-400 font-bold">
          البيانات مباشرة من Firestore · stock_movements — القنوات محسوبة من SKU + AWB حسب Attribution Map المحسوم
          · أدخل تكاليف الإعلانات في الجدول أعلاه لحساب ROAS
        </p>
      </div>

    </div>
  );
}
