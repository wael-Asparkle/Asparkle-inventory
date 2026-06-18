import React, { useEffect, useMemo, useState } from 'react';
import {
  PackageOpen,
  RefreshCw,
  Clock,
  AlertTriangle,
  Download,
  BarChart2,
  X,
  ClipboardList,
} from 'lucide-react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db, appId } from '../config/firebase';

const stockMovementsCol = () => collection(db, 'artifacts', appId, 'public', 'data', 'stock_movements');
const stockSnapshotCol = () => collection(db, 'artifacts', appId, 'public', 'data', 'stock_snapshot');

const LOW_STOCK_LIMIT = 20;

const PRODUCT_NAMES = {
  '9000901': 'اسباركل الأخضر',
  '9000902': 'سجنتشر',
  '09000903': 'بكج عينات مجاني',
  '9000904': 'Moon Spark',
  '9000905': 'Spark Duo',
  '9000906': 'Spark Glow',
  '9000908': 'Spark Breeze',
  '9000909': 'Spark Ash',
};

const MOVEMENT_LABELS = {
  ADD: 'دخول',
  SALE: 'خروج / بيع',
  RETURN: 'مرتجع عميل',
  PHOTO_OUT: 'سحب للتصوير',
  PHOTO_RETURN: 'إرجاع من التصوير',
  PHOTO_LOSS: 'فاقد تصوير',
  UPDATE: 'تسوية',
  DAMAGE: 'دامج',
  MISSING: 'مفقود',
  UNKNOWN: 'غير معروف',
};

const MOVEMENT_CLASSES = {
  ADD: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  SALE: 'bg-rose-50 text-rose-700 border-rose-100',
  RETURN: 'bg-blue-50 text-blue-700 border-blue-100',
  PHOTO_OUT: 'bg-violet-50 text-violet-700 border-violet-100',
  PHOTO_RETURN: 'bg-cyan-50 text-cyan-700 border-cyan-100',
  PHOTO_LOSS: 'bg-orange-50 text-orange-700 border-orange-100',
  UPDATE: 'bg-amber-50 text-amber-700 border-amber-100',
  DAMAGE: 'bg-orange-50 text-orange-700 border-orange-100',
  MISSING: 'bg-slate-50 text-slate-700 border-slate-200',
  UNKNOWN: 'bg-slate-50 text-slate-700 border-slate-200',
};

function toNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function normalizeDate(value) {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (value?.toDate) return value.toDate().toISOString();
  return String(value);
}

function sameOrBefore(dateValue, selectedDate) {
  if (!selectedDate) return true;
  const date = normalizeDate(dateValue);
  if (!date) return false;
  return date <= `${selectedDate}T23:59:59`;
}

function movementSignedQty(movement) {
  const qty = Math.abs(toNumber(movement.qty ?? movement.quantity));
  switch (movement.movementType) {
    case 'ADD':
    case 'RETURN':
    case 'PHOTO_RETURN':
      return qty;
    case 'SALE':
    case 'DAMAGE':
    case 'MISSING':
    case 'PHOTO_OUT':
      return -qty;
    case 'PHOTO_LOSS':
      return 0;
    case 'UPDATE':
      return toNumber(movement.qty ?? movement.quantity);
    default:
      return toNumber(movement.qty ?? movement.quantity);
  }
}

function createEmptySummary() {
  return {
    inbound: 0,
    outbound: 0,
    returns: 0,
    damage: 0,
    missing: 0,
    photoOut: 0,
    photoReturn: 0,
    photoLoss: 0,
    photoOpen: 0,
    adjustments: 0,
  };
}

function buildMovementStock(movements, selectedDate) {
  const stock = {};
  movements
    .filter((m) => sameOrBefore(m.date, selectedDate))
    .sort((a, b) => new Date(normalizeDate(a.date)) - new Date(normalizeDate(b.date)))
    .forEach((m) => {
      if (!m.sku) return;
      stock[m.sku] = (stock[m.sku] || 0) + movementSignedQty(m);
    });
  return stock;
}

function buildSkuSummary(movements, selectedDate) {
  const summary = {};
  movements.filter((m) => sameOrBefore(m.date, selectedDate)).forEach((m) => {
    if (!m.sku) return;
    if (!summary[m.sku]) summary[m.sku] = createEmptySummary();

    const qty = Math.abs(toNumber(m.qty ?? m.quantity));
    switch (m.movementType) {
      case 'ADD':
        summary[m.sku].inbound += qty;
        break;
      case 'SALE':
        summary[m.sku].outbound += qty;
        break;
      case 'RETURN':
        summary[m.sku].returns += qty;
        break;
      case 'PHOTO_OUT':
        summary[m.sku].photoOut += qty;
        break;
      case 'PHOTO_RETURN':
        summary[m.sku].photoReturn += qty;
        break;
      case 'PHOTO_LOSS':
        summary[m.sku].photoLoss += qty;
        break;
      case 'DAMAGE':
        summary[m.sku].damage += qty;
        break;
      case 'MISSING':
        summary[m.sku].missing += qty;
        break;
      case 'UPDATE':
        summary[m.sku].adjustments += toNumber(m.qty ?? m.quantity);
        break;
      default:
        break;
    }
  });

  Object.keys(summary).forEach((sku) => {
    const s = summary[sku];
    s.photoOpen = Math.max(0, s.photoOut - s.photoReturn - s.photoLoss);
  });

  return summary;
}

function formatDateTime(value) {
  const date = normalizeDate(value);
  if (!date) return '—';
  return date.replace('T', ' ').slice(0, 16);
}

function getStockStatus(row) {
  if (row.available <= 0) return { label: 'نافد', className: 'bg-rose-50 text-rose-700 border-rose-100' };
  if (row.available <= LOW_STOCK_LIMIT) return { label: 'منخفض', className: 'bg-orange-50 text-orange-700 border-orange-100' };
  return { label: 'جيد', className: 'bg-emerald-50 text-emerald-700 border-emerald-100' };
}

function exportCSV(rows, lossRows) {
  const stockLines = [
    ['SKU', 'اسم المنتج', 'مخزون بتوين', 'الدخول', 'الخروج', 'المرتجعات', 'سحب تصوير', 'رجع تصوير', 'فاقد تصوير', 'تصوير مفتوح', 'دامج/مفقود', 'المتاح للبيع', 'المصدر', 'الحالة'],
    ...rows.map((r) => [
      r.sku,
      r.name,
      r.officialQty,
      r.inbound,
      r.outbound,
      r.returns,
      r.photoOut,
      r.photoReturn,
      r.photoLoss,
      r.photoOpen,
      r.damage + r.missing,
      r.available,
      r.source,
      getStockStatus(r).label,
    ]),
  ].map((r) => r.join(',')).join('\n');

  const lossLines = [
    '',
    'سجل الدامج والمفقودات وفاقد التصوير',
    ['التاريخ', 'النوع', 'SKU', 'المنتج', 'الكمية', 'AWB', 'الحالة', 'ملاحظات'],
    ...lossRows.map((m) => [
      formatDateTime(m.date),
      MOVEMENT_LABELS[m.movementType] || m.movementType,
      m.sku || '',
      PRODUCT_NAMES[m.sku] || '',
      Math.abs(toNumber(m.qty)),
      m.awb || '',
      m.status || '',
      m.note || '',
    ]),
  ].map((r) => Array.isArray(r) ? r.join(',') : r).join('\n');

  const blob = new Blob(['\uFEFF' + stockLines + '\n' + lossLines], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `stock-report-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function StockTab() {
  const [movements, setMovements] = useState([]);
  const [officialStock, setOfficialStock] = useState({});
  const [selectedDate, setSelectedDate] = useState('');
  const [showLossSection, setShowLossSection] = useState(false);
  const [loadingParts, setLoadingParts] = useState({ movements: true, snapshot: true });

  useEffect(() => {
    const unsubMovements = onSnapshot(stockMovementsCol(), (snap) => {
      setMovements(snap.docs.map((d) => ({ id: d.id, ...d.data(), date: normalizeDate(d.data().date) })));
      setLoadingParts((prev) => ({ ...prev, movements: false }));
    }, (err) => {
      console.error(err);
      setLoadingParts((prev) => ({ ...prev, movements: false }));
    });

    const unsubSnapshot = onSnapshot(stockSnapshotCol(), (snap) => {
      const map = {};
      snap.docs.forEach((d) => {
        const data = d.data();
        const sku = String(data.sku || d.id || '').trim();
        if (!sku) return;
        map[sku] = {
          sku,
          name: data.name || PRODUCT_NAMES[sku] || sku,
          currentQty: toNumber(data.currentQty ?? data.quantity ?? data.qty),
          lastUpdated: normalizeDate(data.lastUpdated || data.updatedAt || data.importedAt),
        };
      });
      setOfficialStock(map);
      setLoadingParts((prev) => ({ ...prev, snapshot: false }));
    }, (err) => {
      console.error(err);
      setLoadingParts((prev) => ({ ...prev, snapshot: false }));
    });

    return () => {
      unsubMovements();
      unsubSnapshot();
    };
  }, []);

  const loading = loadingParts.movements || loadingParts.snapshot;
  const today = new Date().toISOString().slice(0, 10);

  const movementStock = useMemo(() => buildMovementStock(movements, selectedDate), [movements, selectedDate]);
  const summaryMap = useMemo(() => buildSkuSummary(movements, selectedDate), [movements, selectedDate]);

  const allSkus = useMemo(() => {
    const set = new Set(Object.keys(PRODUCT_NAMES));
    Object.keys(officialStock).forEach((sku) => set.add(sku));
    movements.forEach((m) => { if (m.sku) set.add(m.sku); });
    return Array.from(set);
  }, [officialStock, movements]);

  const rows = useMemo(() => allSkus.map((sku) => {
    const summary = summaryMap[sku] || createEmptySummary();
    const officialQty = officialStock[sku]?.currentQty ?? 0;
    const calculatedQty = movementStock[sku] ?? 0;
    const baseAvailable = selectedDate ? calculatedQty : (officialStock[sku] ? officialQty : calculatedQty);
    const available = Math.max(0, baseAvailable - summary.photoOpen);

    return {
      sku,
      name: PRODUCT_NAMES[sku] || officialStock[sku]?.name || sku,
      officialQty,
      calculatedQty,
      baseAvailable,
      available,
      ...summary,
      source: selectedDate ? 'حركات تاريخية' : (officialStock[sku] ? 'مخزون بتوين + التصوير المفتوح' : 'حركات فقط'),
    };
  }).sort((a, b) => a.name.localeCompare(b.name, 'ar')), [allSkus, officialStock, movementStock, selectedDate, summaryMap]);

  const lossRows = useMemo(() => movements
    .filter((m) => ['DAMAGE', 'MISSING', 'PHOTO_LOSS'].includes(m.movementType))
    .sort((a, b) => new Date(normalizeDate(b.date)) - new Date(normalizeDate(a.date))), [movements]);

  const recentMovements = useMemo(() => movements
    .filter((m) => selectedDate ? normalizeDate(m.date).slice(0, 10) === selectedDate : true)
    .sort((a, b) => new Date(normalizeDate(b.date)) - new Date(normalizeDate(a.date)))
    .slice(0, 8), [movements, selectedDate]);

  const latestSnapshotUpdate = useMemo(() => Object.values(officialStock)
    .map((item) => item.lastUpdated)
    .filter(Boolean)
    .sort()
    .pop(), [officialStock]);

  const stats = useMemo(() => ({
    total: rows.reduce((sum, row) => sum + row.available, 0),
    low: rows.filter((row) => row.available > 0 && row.available <= LOW_STOCK_LIMIT).length,
    zero: rows.filter((row) => row.available <= 0).length,
    inbound: rows.reduce((sum, row) => sum + row.inbound, 0),
    outbound: rows.reduce((sum, row) => sum + row.outbound, 0),
    returns: rows.reduce((sum, row) => sum + row.returns, 0),
    photoOpen: rows.reduce((sum, row) => sum + row.photoOpen, 0),
    photoLoss: rows.reduce((sum, row) => sum + row.photoLoss, 0),
    loss: rows.reduce((sum, row) => sum + row.damage + row.missing + row.photoLoss, 0),
  }), [rows]);

  const lowRows = rows.filter((row) => row.available <= LOW_STOCK_LIMIT).sort((a, b) => a.available - b.available);

  return (
    <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-8" dir="rtl">
      <div className="flex items-center justify-between gap-4 flex-wrap mb-6">
        <div className="flex items-center gap-3">
          <PackageOpen className="text-indigo-600" size={28} />
          <div>
            <h2 className="text-2xl font-black text-slate-800">المخزون</h2>
            <p className="text-slate-400 text-xs mt-0.5">
              {selectedDate ? `المخزون حسب الحركات حتى ${selectedDate}` : 'المخزون الحالي من Between + التصوير المفتوح'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={() => exportCSV(rows, lossRows)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200 transition-all">
            <Download size={15} /> تصدير
          </button>
        </div>
      </div>

      <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-4 mb-6 flex items-start gap-3">
        <ClipboardList size={18} className="text-indigo-600 mt-0.5" />
        <div>
          <p className="text-xs leading-6 text-indigo-700 font-bold">
            مصدر المخزون الحالي هو <span className="font-black">stock_snapshot</span> من Between، مع مراعاة المنتجات المفتوحة للتصوير.
            رجوع التصوير يظهر كـ <span className="font-black">إرجاع من التصوير</span> وليس كـ دخول جديد، حتى لا يتدبل المخزون.
          </p>
          <p className="text-xs text-indigo-500 font-bold mt-1">
            آخر تحديث من Between: {latestSnapshotUpdate ? formatDateTime(latestSnapshotUpdate) : 'لم يتم رفع مخزون رسمي بعد'}
          </p>
        </div>
      </div>

      <div className="bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 mb-6 flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2 text-slate-600">
          <Clock size={16} />
          <span className="text-sm font-black">عرض المخزون في تاريخ:</span>
        </div>
        <input type="date" max={today} value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
        {selectedDate && (
          <button onClick={() => setSelectedDate('')} className="flex items-center gap-1 text-sm font-bold text-slate-400 hover:text-slate-600">
            <X size={14} /> الحالي
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 gap-3 text-slate-400">
          <RefreshCw size={20} className="animate-spin" />
          <span className="font-bold text-sm">جاري تحميل المخزون...</span>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
            <StatCard label="المتاح للبيع" value={stats.total.toLocaleString()} hint="بعد خصم التصوير المفتوح" tone="slate" />
            <StatCard label="تصوير مفتوح" value={stats.photoOpen.toLocaleString()} hint="مسحوب ولم يُقفل" tone="violet" />
            <StatCard label="منخفض" value={stats.low} hint={`≤ ${LOW_STOCK_LIMIT} وحدة`} tone="orange" />
            <StatCard label="نافد" value={stats.zero} hint="صفر أو أقل" tone="rose" />
            <StatCard label="فاقد تصوير" value={stats.photoLoss.toLocaleString()} hint="فرق ناقص بعد الرجوع" tone="amber" />
          </div>

          {lowRows.length > 0 && (
            <div className="bg-orange-50 border border-orange-100 rounded-2xl p-4 mb-6">
              <p className="flex items-center gap-2 text-sm font-black text-orange-700 mb-3">
                <AlertTriangle size={16} /> تنبيه انخفاض المخزون
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                {lowRows.slice(0, 6).map((row) => (
                  <div key={row.sku} className="bg-white rounded-xl px-3 py-2 border border-orange-100 flex items-center justify-between gap-3">
                    <span className="text-xs font-bold text-slate-600">{row.name}</span>
                    <span className="text-sm font-black text-orange-700">{row.available}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="bg-slate-50 rounded-2xl border border-slate-100 overflow-x-auto mb-6">
            <table className="w-full text-sm">
              <thead className="bg-slate-100 text-slate-600">
                <tr>
                  {['SKU', 'اسم المنتج', 'مخزون بتوين', 'دخول', 'خروج', 'مرتجع', 'تصوير مفتوح', 'فاقد تصوير', 'دامج/مفقود', 'المتاح للبيع', 'المصدر', 'الحالة'].map((h) => (
                    <th key={h} className="p-3 text-right font-black whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const status = getStockStatus(row);
                  return (
                    <tr key={row.sku} className="border-t hover:bg-white transition-colors">
                      <td className="p-3 font-mono text-xs text-slate-500 whitespace-nowrap">{row.sku}</td>
                      <td className="p-3 font-bold text-slate-700 whitespace-nowrap">{row.name}</td>
                      <td className="p-3 font-bold text-slate-600">{selectedDate ? '—' : row.officialQty.toLocaleString()}</td>
                      <td className="p-3 font-bold text-emerald-600">{row.inbound ? row.inbound.toLocaleString() : '—'}</td>
                      <td className="p-3 font-bold text-rose-600">{row.outbound ? row.outbound.toLocaleString() : '—'}</td>
                      <td className="p-3 font-bold text-blue-600">{row.returns ? row.returns.toLocaleString() : '—'}</td>
                      <td className="p-3 font-black text-violet-600">{row.photoOpen ? row.photoOpen.toLocaleString() : '—'}</td>
                      <td className="p-3 font-bold text-orange-600">{row.photoLoss ? row.photoLoss.toLocaleString() : '—'}</td>
                      <td className="p-3 font-bold text-amber-600">{row.damage + row.missing ? (row.damage + row.missing).toLocaleString() : '—'}</td>
                      <td className={`p-3 font-black text-lg ${row.available <= 0 ? 'text-rose-600' : row.available <= LOW_STOCK_LIMIT ? 'text-orange-600' : 'text-emerald-600'}`}>{row.available.toLocaleString()}</td>
                      <td className="p-3 text-xs font-bold text-slate-400 whitespace-nowrap">{row.source}</td>
                      <td className="p-3"><span className={`inline-flex px-2 py-1 rounded-lg border text-xs font-black ${status.className}`}>{status.label}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-slate-50 rounded-2xl border border-slate-100 p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="flex items-center gap-2 text-sm font-black text-slate-700"><BarChart2 size={15} /> آخر الحركات</p>
                <span className="text-xs text-slate-400 font-bold">{selectedDate || 'الأحدث'}</span>
              </div>
              <div className="space-y-2 max-h-72 overflow-y-auto">
                {recentMovements.length === 0 && <p className="text-xs text-slate-400 font-bold">لا توجد حركات</p>}
                {recentMovements.map((m) => (
                  <div key={m.id} className="bg-white rounded-xl border border-slate-100 px-3 py-2">
                    <div className="flex items-center justify-between gap-3 mb-1">
                      <span className="font-black text-sm text-slate-700">{PRODUCT_NAMES[m.sku] || m.sku}</span>
                      <span className={`inline-flex px-2 py-0.5 rounded-lg border text-xs font-black ${MOVEMENT_CLASSES[m.movementType] || 'bg-slate-50 text-slate-600 border-slate-200'}`}>{MOVEMENT_LABELS[m.movementType] || m.movementType || '—'}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3 text-xs text-slate-400 font-bold">
                      <span>{formatDateTime(m.date)}</span>
                      <span className={toNumber(m.qty) < 0 ? 'text-rose-600' : 'text-emerald-600'}>{toNumber(m.qty) > 0 ? `+${toNumber(m.qty)}` : toNumber(m.qty)}</span>
                    </div>
                    {m.awb && <p className="text-xs text-slate-400 mt-1 font-mono">AWB: {m.awb}</p>}
                    {m.note && <p className="text-xs text-slate-400 mt-1">{m.note}</p>}
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-slate-50 rounded-2xl border border-slate-100 p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="flex items-center gap-2 text-sm font-black text-slate-700"><AlertTriangle size={15} /> الفاقد والدامج</p>
                <button onClick={() => setShowLossSection(!showLossSection)} className="text-xs font-black text-indigo-600 hover:text-indigo-700">
                  {showLossSection ? 'إخفاء' : 'عرض'} السجل
                </button>
              </div>
              <div className="grid grid-cols-3 gap-3 mb-4">
                <MiniStat label="دامج" value={rows.reduce((sum, row) => sum + row.damage, 0)} tone="orange" />
                <MiniStat label="مفقود" value={rows.reduce((sum, row) => sum + row.missing, 0)} tone="slate" />
                <MiniStat label="فاقد تصوير" value={stats.photoLoss} tone="violet" />
              </div>

              {showLossSection && (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {lossRows.length === 0 && <p className="text-xs text-slate-400 font-bold">لا يوجد فاقد مسجل</p>}
                  {lossRows.map((m) => (
                    <div key={m.id} className="bg-white rounded-xl border border-slate-100 px-3 py-2">
                      <div className="flex items-center justify-between gap-3 mb-1">
                        <span className="font-black text-sm text-slate-700">{PRODUCT_NAMES[m.sku] || m.sku}</span>
                        <span className={`inline-flex px-2 py-0.5 rounded-lg border text-xs font-black ${MOVEMENT_CLASSES[m.movementType] || 'bg-slate-50 text-slate-600 border-slate-200'}`}>{MOVEMENT_LABELS[m.movementType] || m.movementType}</span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-slate-400 font-bold flex-wrap">
                        <span>{formatDateTime(m.date)}</span>
                        <span>-{Math.abs(toNumber(m.qty))} وحدة</span>
                        {m.awb && <span>AWB: {m.awb}</span>}
                        {m.status && <span>{m.status === 'compensated' ? 'تم التعويض' : 'بانتظار التعويض'}</span>}
                      </div>
                      {m.note && <p className="text-xs text-slate-400 mt-1">{m.note}</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function StatCard({ label, value, hint, tone }) {
  const toneClasses = {
    slate: 'text-slate-800',
    indigo: 'text-indigo-600',
    emerald: 'text-emerald-600',
    orange: 'text-orange-600',
    rose: 'text-rose-600',
    amber: 'text-amber-600',
    violet: 'text-violet-600',
  };
  return (
    <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
      <p className="text-xs font-black text-slate-400 mb-1">{label}</p>
      <p className={`text-2xl font-black ${toneClasses[tone] || toneClasses.slate}`}>{value}</p>
      {hint && <p className="text-xs text-slate-400 mt-1 font-bold">{hint}</p>}
    </div>
  );
}

function MiniStat({ label, value, tone }) {
  const toneClasses = {
    slate: 'text-slate-700',
    orange: 'text-orange-600',
    rose: 'text-rose-600',
    violet: 'text-violet-600',
  };
  return (
    <div className="bg-white rounded-xl border border-slate-100 p-3">
      <p className="text-xs font-black text-slate-400 mb-1">{label}</p>
      <p className={`text-xl font-black ${toneClasses[tone] || toneClasses.slate}`}>{Number(value || 0).toLocaleString()}</p>
    </div>
  );
}
