import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Award, BarChart3, CheckCircle2, Crown, Megaphone, Package, RefreshCw, ShoppingBag, TrendingUp, UsersRound, WalletCards } from 'lucide-react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db, appId } from '../config/firebase';
import { PRODUCT_CATALOG } from '../constants/masterMapping';

const DAILY_ORDER_TARGET = 20;
const MIN_HEALTHY_ROAS = 3;
const MAX_HEALTHY_CPA = 40;

const englishFormatter = new Intl.NumberFormat('en-US');
const fmt = (value) => englishFormatter.format(Number(value || 0));
const fmtMoney = (value) => `${fmt(Math.round(Number(value || 0)))} ر`;
const fmtRatio = (value) => (Number.isFinite(value) ? Number(value).toFixed(2) : '—');

const getSaudiDate = () => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Riyadh', year: 'numeric', month: '2-digit', day: '2-digit',
}).format(new Date());

const normalizeDate = (value) => {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const iso = raw.match(/\d{4}-\d{2}-\d{2}/);
  if (iso) return iso[0];
  const dmy = raw.match(/(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
  if (dmy) {
    const [, dd, mm, yyyy] = dmy;
    return `${yyyy}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
  }
  return raw.slice(0, 10);
};

const getCustomerKey = (order) => String(order?.customer?.phone || '').replace(/\s/g, '') || String(order?.customer?.name || '').trim() || `unknown-${order?.reference || order?.id || 'customer'}`;

function StatCard({ title, value, note, icon, tone = 'slate' }) {
  const tones = {
    slate: 'bg-white border-slate-100 text-slate-700',
    indigo: 'bg-indigo-50 border-indigo-100 text-indigo-700',
    emerald: 'bg-emerald-50 border-emerald-100 text-emerald-700',
    amber: 'bg-amber-50 border-amber-100 text-amber-700',
    sky: 'bg-sky-50 border-sky-100 text-sky-700',
  };
  return (
    <div className={`${tones[tone] || tones.slate} border rounded-3xl p-5 shadow-sm`}>
      <div className="flex items-center justify-between gap-3 mb-4">
        <p className="text-xs font-black opacity-70">{title}</p>
        <div className="w-10 h-10 rounded-2xl bg-white/80 flex items-center justify-center shadow-sm">{icon}</div>
      </div>
      <p className="text-2xl font-black text-slate-900">{value}</p>
      {note && <p className="text-xs font-bold text-slate-400 mt-1 leading-6">{note}</p>}
    </div>
  );
}

function InsightCard({ title, value, note, icon }) {
  return (
    <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-5">
      <div className="flex items-center gap-2 mb-3 text-slate-500">{icon}<p className="text-xs font-black">{title}</p></div>
      <p className="text-xl font-black text-slate-900">{value}</p>
      {note && <p className="text-xs font-bold text-slate-400 mt-2 leading-6">{note}</p>}
    </div>
  );
}

function AlertItem({ alert }) {
  const styles = {
    good: 'bg-emerald-50 border-emerald-100 text-emerald-700',
    warning: 'bg-amber-50 border-amber-100 text-amber-700',
    danger: 'bg-rose-50 border-rose-100 text-rose-700',
    info: 'bg-sky-50 border-sky-100 text-sky-700',
  };
  const Icon = alert.type === 'good' ? CheckCircle2 : AlertTriangle;
  return (
    <div className={`flex items-start gap-3 border rounded-2xl p-4 ${styles[alert.type] || styles.info}`}>
      <Icon size={18} className="shrink-0 mt-0.5" />
      <div><p className="text-sm font-black">{alert.title}</p><p className="text-xs font-bold opacity-80 mt-1 leading-6">{alert.message}</p></div>
    </div>
  );
}

export default function CEOExecutiveTab() {
  const [orders, setOrders] = useState([]);
  const [adCosts, setAdCosts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubOrders = onSnapshot(
      collection(db, 'artifacts', appId, 'public', 'data', 'orders'),
      (snap) => { setOrders(snap.docs.map((d) => ({ id: d.id, ...d.data() }))); setLoading(false); },
      (error) => { console.error('خطأ في تحميل طلبات صفحة الرئيس التنفيذي:', error); setLoading(false); }
    );
    const unsubCosts = onSnapshot(
      collection(db, 'artifacts', appId, 'public', 'data', 'ad_costs'),
      (snap) => setAdCosts(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      (error) => console.error('خطأ في تحميل تكاليف الإعلانات لصفحة الرئيس التنفيذي:', error)
    );
    return () => { unsubOrders(); unsubCosts(); };
  }, []);

  const summary = useMemo(() => {
    const today = getSaudiDate();
    const currentMonth = today.slice(0, 7);
    const normalizedOrders = orders.map((order) => ({ ...order, normalizedDate: normalizeDate(order.date), total: Number(order.total || 0) }));
    const todayOrders = normalizedOrders.filter((order) => order.normalizedDate === today);
    const monthOrders = normalizedOrders.filter((order) => order.normalizedDate.slice(0, 7) === currentMonth);
    const todayRevenue = todayOrders.reduce((sum, order) => sum + order.total, 0);
    const monthRevenue = monthOrders.reduce((sum, order) => sum + order.total, 0);
    const averageOrderValue = monthOrders.length ? monthRevenue / monthOrders.length : 0;
    const monthCosts = adCosts.filter((cost) => String(cost.month || '') === currentMonth);
    const adSpend = monthCosts.reduce((sum, cost) => sum + Number(cost.amount || 0), 0);
    const roas = adSpend > 0 ? monthRevenue / adSpend : null;
    const cpa = adSpend > 0 && monthOrders.length > 0 ? adSpend / monthOrders.length : null;

    const channelStats = {};
    const skuStats = {};
    const customers = {};
    monthOrders.forEach((order) => {
      const channel = order.channel || 'غير محدد';
      channelStats[channel] = channelStats[channel] || { revenue: 0, orders: 0 };
      channelStats[channel].revenue += order.total;
      channelStats[channel].orders += 1;
      Object.entries(order.skuBreakdown || {}).forEach(([sku, qty]) => {
        skuStats[sku] = skuStats[sku] || { units: 0, orders: 0 };
        skuStats[sku].units += Number(qty || 0);
        skuStats[sku].orders += 1;
      });
    });
    normalizedOrders.forEach((order) => {
      const key = getCustomerKey(order);
      customers[key] = customers[key] || { orders: 0 };
      customers[key].orders += 1;
    });

    const alerts = [];
    if (!normalizedOrders.length) alerts.push({ type: 'danger', title: 'لا توجد طلبات مستوردة', message: 'استورد طلبات سلة أولًا حتى تعرض الصفحة حالة الشركة بشكل صحيح.' });
    if (todayOrders.length >= DAILY_ORDER_TARGET) alerts.push({ type: 'good', title: 'طلبات اليوم على الهدف أو أعلى', message: `طلبات اليوم ${fmt(todayOrders.length)} من هدف ${fmt(DAILY_ORDER_TARGET)} طلب.` });
    else alerts.push({ type: 'warning', title: 'طلبات اليوم أقل من الهدف', message: `طلبات اليوم ${fmt(todayOrders.length)} من هدف ${fmt(DAILY_ORDER_TARGET)} طلب. راجع الحملات أو القنوات النشطة اليوم.` });
    if (adSpend === 0) alerts.push({ type: 'info', title: 'لا يوجد صرف إعلاني مسجل لهذا الشهر', message: 'أضف تكاليف الإعلانات الشهرية حتى يظهر ROAS وتقييم الصرف بشكل أدق.' });
    else if (!monthOrders.length) alerts.push({ type: 'danger', title: 'يوجد صرف إعلاني بدون طلبات شهرية', message: 'راجع الحملات فورًا لأن هناك صرفًا مسجلًا ولا توجد طلبات في الشهر الحالي.' });
    else if (roas !== null && roas < MIN_HEALTHY_ROAS) alerts.push({ type: 'warning', title: 'ROAS أقل من المستوى الصحي', message: `ROAS الحالي ${fmtRatio(roas)}. الهدف المبدئي ألا يقل عن ${MIN_HEALTHY_ROAS}.` });
    else if (roas !== null) alerts.push({ type: 'good', title: 'صرف الإعلانات يبدو منطقيًا', message: `ROAS الحالي ${fmtRatio(roas)} بناءً على إيرادات الشهر وصرف الإعلانات المسجل.` });
    if (cpa !== null && cpa > MAX_HEALTHY_CPA) alerts.push({ type: 'warning', title: 'تكلفة الطلب أعلى من المستوى المطلوب', message: `تكلفة الطلب التقريبية ${fmtMoney(cpa)} والهدف المبدئي أقل من ${fmtMoney(MAX_HEALTHY_CPA)}.` });

    const hasDanger = alerts.some((alert) => alert.type === 'danger');
    const hasWarning = alerts.some((alert) => alert.type === 'warning');
    return {
      today,
      currentMonth,
      todayRevenue,
      todayOrders: todayOrders.length,
      monthRevenue,
      monthOrders: monthOrders.length,
      averageOrderValue,
      adSpend,
      roas,
      topChannel: Object.entries(channelStats).sort((a, b) => b[1].revenue - a[1].revenue)[0],
      topSku: Object.entries(skuStats).sort((a, b) => b[1].units - a[1].units)[0],
      totalCustomers: Object.keys(customers).length,
      repeatedCustomers: Object.values(customers).filter((customer) => customer.orders >= 2).length,
      alerts,
      health: hasDanger ? 'danger' : hasWarning ? 'warning' : 'good',
    };
  }, [orders, adCosts]);

  const healthCopy = {
    good: { label: 'الوضع مستقر', title: 'الشركة تسير بشكل جيد حسب البيانات المتاحة', className: 'bg-emerald-50 text-emerald-700 border-emerald-100' },
    warning: { label: 'يحتاج متابعة', title: 'يوجد مؤشرات تحتاج مراجعة إدارية', className: 'bg-amber-50 text-amber-700 border-amber-100' },
    danger: { label: 'يحتاج قرار', title: 'يوجد تنبيه تنفيذي يحتاج تدخل سريع', className: 'bg-rose-50 text-rose-700 border-rose-100' },
  }[summary.health];

  if (loading) {
    return <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-16 flex items-center justify-center gap-3" dir="rtl"><RefreshCw size={20} className="animate-spin text-indigo-500" /><span className="font-bold text-slate-400 text-sm">جاري تحميل صفحة الرئيس التنفيذي...</span></div>;
  }

  const topChannelName = summary.topChannel?.[0] || '—';
  const topChannelData = summary.topChannel?.[1];
  const topSkuCode = summary.topSku?.[0];
  const topSkuData = summary.topSku?.[1];

  return (
    <div className="space-y-6" dir="rtl">
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm px-8 py-6 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
        <div><div className="flex items-center gap-2 mb-2"><Crown size={24} className="text-amber-500" /><h2 className="text-2xl font-black text-slate-900">الرئيس التنفيذي</h2></div><p className="text-sm font-bold text-slate-400 leading-7">ملخص مختصر للمالك: المبيعات، الطلبات، الإعلانات، القنوات، المنتجات، والتنبيهات التنفيذية.</p></div>
        <div className={`border rounded-3xl px-5 py-4 ${healthCopy.className}`}><p className="text-xs font-black opacity-80 mb-1">حالة الشركة الآن</p><p className="text-xl font-black">{healthCopy.label}</p><p className="text-xs font-bold opacity-80 mt-1">{healthCopy.title}</p></div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard title="إيرادات اليوم" value={fmtMoney(summary.todayRevenue)} note={`تاريخ اليوم: ${summary.today}`} icon={<WalletCards size={20} />} tone="emerald" />
        <StatCard title="طلبات اليوم" value={fmt(summary.todayOrders)} note={`الهدف المبدئي: ${fmt(DAILY_ORDER_TARGET)} طلب يومي`} icon={<ShoppingBag size={20} />} tone={summary.todayOrders >= DAILY_ORDER_TARGET ? 'emerald' : 'amber'} />
        <StatCard title="إيرادات الشهر حتى اليوم" value={fmtMoney(summary.monthRevenue)} note={`الشهر الحالي: ${summary.currentMonth}`} icon={<TrendingUp size={20} />} tone="indigo" />
        <StatCard title="طلبات الشهر حتى اليوم" value={fmt(summary.monthOrders)} note="إجمالي الطلبات المسجلة في الشهر الحالي" icon={<BarChart3 size={20} />} tone="sky" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard title="متوسط قيمة الطلب" value={fmtMoney(summary.averageOrderValue)} note="محسوب من طلبات الشهر الحالي" icon={<Award size={20} />} tone="slate" />
        <StatCard title="صرف الإعلانات" value={fmtMoney(summary.adSpend)} note="إجمالي الصرف المسجل للشهر الحالي" icon={<Megaphone size={20} />} tone="amber" />
        <StatCard title="ROAS" value={summary.roas === null ? '—' : fmtRatio(summary.roas)} note="إيرادات الشهر ÷ صرف الإعلانات" icon={<TrendingUp size={20} />} tone={summary.roas !== null && summary.roas >= MIN_HEALTHY_ROAS ? 'emerald' : 'amber'} />
        <StatCard title="عدد العملاء" value={fmt(summary.totalCustomers)} note={`العملاء المتكررون: ${fmt(summary.repeatedCustomers)}`} icon={<UsersRound size={20} />} tone="indigo" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <InsightCard title="أفضل قناة مبيعات" value={topChannelName} note={topChannelData ? `${fmt(topChannelData.orders)} طلب · ${fmtMoney(topChannelData.revenue)} إيرادات` : 'لا توجد قناة واضحة للشهر الحالي'} icon={<Megaphone size={17} className="text-indigo-500" />} />
        <InsightCard title="أكثر SKU مبيعًا" value={topSkuCode ? (PRODUCT_CATALOG[topSkuCode]?.name || topSkuCode) : '—'} note={topSkuData ? `${fmt(topSkuData.units)} وحدة · ${fmt(topSkuData.orders)} طلب` : 'لا توجد مبيعات SKU للشهر الحالي'} icon={<Package size={17} className="text-emerald-500" />} />
      </div>
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6"><div className="flex items-center gap-2 mb-5"><AlertTriangle size={19} className="text-amber-500" /><h3 className="text-lg font-black text-slate-900">تنبيهات تنفيذية</h3></div><div className="grid grid-cols-1 lg:grid-cols-2 gap-3">{summary.alerts.map((alert, index) => <AlertItem key={`${alert.title}-${index}`} alert={alert} />)}</div></div>
      <div className="bg-slate-100 border border-slate-200 rounded-3xl p-5 text-xs font-bold text-slate-500 leading-7">ملاحظة: هذه النسخة لا تعرض السيولة أو صافي الربح الحقيقي لأنها تحتاج بيانات تكاليف مكتملة. يمكن إضافتها لاحقًا بعد اعتماد نظام الأرباح والتكاليف.</div>
    </div>
  );
}
