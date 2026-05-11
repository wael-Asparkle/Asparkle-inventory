import React, { useState, useCallback } from 'react';
import {
  Database, Upload, Save, Eye, RefreshCw, CheckCircle,
  XCircle, AlertTriangle, BarChart2, RotateCcw, Zap
} from 'lucide-react';
import {
  collection, doc, getDocs, writeBatch, setDoc, deleteDoc
} from 'firebase/firestore';
import { db, appId } from '../config/firebase';

// ── Firebase Paths ────────────────────────────────────────────
const movementsCol  = () => collection(db, 'artifacts', appId, 'public', 'data', 'stock_movements');
const snapshotCol   = () => collection(db, 'artifacts', appId, 'public', 'data', 'stock_snapshot');

const STATUS = { IDLE: 'idle', PARSING: 'parsing', PREVIEW: 'preview', SAVING: 'saving', REBUILDING: 'rebuilding', DONE: 'done', ERROR: 'error' };

// ── تحويل Status إلى نوع حركة ─────────────────────────────────
function resolveMovementType(status) {
  switch ((status || '').toLowerCase().trim()) {
    case 'deducted': return 'SALE';
    case 'return':   return 'RETURN';
    case 'add':      return 'ADD';
    case 'update':   return 'UPDATE';
    default:         return 'UNKNOWN';
  }
}

// ── تحليل صف واحد ─────────────────────────────────────────────
function parseRow(row) {
  const sku      = String(row['Sku']              || '').trim();
  const qtyUsed  = parseFloat(row['QuantityUsed'] || 0);
  const prevQty  = parseFloat(row['PreviousQuantity'] || 0);
  const newQty   = parseFloat(row['NewQuantity']  || 0);
  const status   = String(row['Status']           || '').trim();
  const awb      = String(row['AWB']              || '').trim();
  const date     = String(row['Entrydate']        || '').trim();

  if (!sku || sku === 'Sku' || !status || status === 'Status') return null;

  const movementType = resolveMovementType(status);
  const direction    = movementType === 'RETURN' || movementType === 'ADD' ? 1 : -1;

  return {
    sku,
    movementType,
    qty:      qtyUsed * direction,
    previousQty: prevQty,
    newQty,
    status,
    awb,
    date,
    source: 'Between',
  };
}

// ── تحميل XLSX من CDN ─────────────────────────────────────────
function loadXLSX() {
  return new Promise((resolve, reject) => {
    if (window.XLSX) return resolve(window.XLSX);
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
    s.onload  = () => resolve(window.XLSX);
    s.onerror = () => reject(new Error('فشل تحميل XLSX'));
    document.head.appendChild(s);
  });
}

// ── بناء الـ Snapshot من الحركات ──────────────────────────────
function buildSnapshot(movements) {
  // ترتيب زمني
  const sorted = [...movements].sort((a, b) =>
    new Date(a.date) - new Date(b.date)
  );

  const snapshot = {}; // { sku: { currentQty, lastUpdated, lastAWB } }

  sorted.forEach((m) => {
    if (!m.sku) return;
    // Latest NewQuantity Wins
    snapshot[m.sku] = {
      sku:         m.sku,
      currentQty:  m.newQty,
      lastUpdated: m.date,
      lastAWB:     m.awb,
      source:      'Between',
    };
  });

  return snapshot;
}

// ════════════════════════════════════════════════════════════
//  المكوّن الرئيسي
// ════════════════════════════════════════════════════════════
export default function BetweenImportTab() {
  const [status, setStatus]     = useState(STATUS.IDLE);
  const [parsed, setParsed]     = useState([]);
  const [existing, setExisting] = useState(new Set());
  const [progress, setProgress] = useState('');
  const [saved, setSaved]       = useState(0);
  const [snapshot, setSnapshot] = useState({});
  const [rebuildDone, setRebuildDone] = useState(false);

  // ── قراءة الملف ───────────────────────────────────────────
  const handleFile = useCallback(async (file) => {
    if (!file) return;
    setStatus(STATUS.PARSING); setProgress('جاري قراءة ملف Between...');
    try {
      const XLSX = await loadXLSX();
      const wb   = XLSX.read(await file.arrayBuffer(), { type: 'array' });
      const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' });

      setProgress('جاري تحليل الحركات...');
      const parsedRows = rows.map(parseRow).filter(Boolean);

      setProgress('جاري فحص التكرار...');
      const snap = await getDocs(movementsCol());
      const existingAWBs = new Set(
        snap.docs.map((d) => `${d.data().awb}_${d.data().sku}`).filter(Boolean)
      );

      // بناء snapshot للمعاينة
      const snapshotPreview = buildSnapshot(parsedRows);

      setExisting(existingAWBs);
      setParsed(parsedRows);
      setSnapshot(snapshotPreview);
      setStatus(STATUS.PREVIEW);
      setProgress('');
    } catch (err) {
      console.error(err);
      setProgress('فشل في قراءة الملف ❌');
      setStatus(STATUS.ERROR);
    }
  }, []);

  const onDrop = (e) => {
    e.preventDefault();
    const f = e.dataTransfer?.files[0] || e.target.files?.[0];
    if (f) handleFile(f);
  };

  const newRows = parsed.filter((r) => !existing.has(`${r.awb}_${r.sku}`));
  const dupRows = parsed.filter((r) =>  existing.has(`${r.awb}_${r.sku}`));

  // ── إحصائيات ──────────────────────────────────────────────
  const stats = {
    sales:   newRows.filter((r) => r.movementType === 'SALE').length,
    returns: newRows.filter((r) => r.movementType === 'RETURN').length,
    adds:    newRows.filter((r) => r.movementType === 'ADD').length,
    updates: newRows.filter((r) => r.movementType === 'UPDATE').length,
  };

  // ── حفظ الحركات + بناء Snapshot ───────────────────────────
  const handleSave = async () => {
    if (!newRows.length) return;
    setStatus(STATUS.SAVING);
    try {
      const BATCH_SIZE = 400;

      // 1) حفظ الحركات
      for (let i = 0; i < newRows.length; i += BATCH_SIZE) {
        const batch = writeBatch(db);
        newRows.slice(i, i + BATCH_SIZE).forEach((row) => {
          batch.set(doc(movementsCol()), {
            ...row,
            importedAt: new Date().toISOString(),
          });
        });
        await batch.commit();
        setProgress(`حفظ الحركات: ${Math.min(i + BATCH_SIZE, newRows.length)} / ${newRows.length}`);
      }

      // 2) بناء Snapshot من كل الحركات (القديمة + الجديدة)
      setProgress('جاري بناء Stock Snapshot...');
      await rebuildSnapshot();

      setSaved(newRows.length);
      setStatus(STATUS.DONE);
      setProgress('');
    } catch (err) {
      console.error(err);
      setProgress('حدث خطأ ❌');
      setStatus(STATUS.ERROR);
    }
  };

  // ── Rebuild Engine ─────────────────────────────────────────
  const rebuildSnapshot = async () => {
    // جلب كل الحركات
    const snap = await getDocs(movementsCol());
    const allMovements = snap.docs.map((d) => d.data());

    // بناء Snapshot
    const newSnapshot = buildSnapshot(allMovements);

    // حذف القديم وحفظ الجديد
    const existingSnap = await getDocs(snapshotCol());
    const deleteBatch  = writeBatch(db);
    existingSnap.docs.forEach((d) => deleteBatch.delete(d.ref));
    await deleteBatch.commit();

    const saveBatch = writeBatch(db);
    Object.entries(newSnapshot).forEach(([sku, data]) => {
      saveBatch.set(doc(snapshotCol(), sku), {
        ...data,
        rebuiltAt: new Date().toISOString(),
      });
    });
    await saveBatch.commit();

    return newSnapshot;
  };

  const handleRebuild = async () => {
    setStatus(STATUS.REBUILDING);
    setProgress('جاري إعادة بناء المخزون...');
    try {
      const result = await rebuildSnapshot();
      setSnapshot(result);
      setRebuildDone(true);
      setStatus(STATUS.IDLE);
      setProgress('');
    } catch (err) {
      console.error(err);
      setProgress('فشل في إعادة البناء ❌');
      setStatus(STATUS.ERROR);
    }
  };

  const reset = () => {
    setStatus(STATUS.IDLE); setParsed([]); setExisting(new Set());
    setProgress(''); setSaved(0); setSnapshot({}); setRebuildDone(false);
  };

  const movTypeColor = {
    SALE:    'bg-rose-50 text-rose-700',
    RETURN:  'bg-emerald-50 text-emerald-700',
    ADD:     'bg-indigo-50 text-indigo-700',
    UPDATE:  'bg-amber-50 text-amber-700',
    UNKNOWN: 'bg-slate-100 text-slate-500',
  };
  const movTypeLabel = {
    SALE: 'بيع', RETURN: 'مرتجع', ADD: 'إضافة', UPDATE: 'تسوية', UNKNOWN: 'غير محدد',
  };

  return (
    <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-8" dir="rtl">

      {/* Header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <Database className="text-indigo-600" size={28} />
          <div>
            <h2 className="text-2xl font-black text-slate-800">استيراد Between</h2>
            <p className="text-slate-400 text-xs mt-0.5">Inventory Ledger — مصدر الحقيقة الرسمي للمخزون</p>
          </div>
        </div>

        {/* Rebuild Button */}
        <button onClick={handleRebuild}
          disabled={status === STATUS.REBUILDING}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold bg-amber-50 text-amber-700 hover:bg-amber-100 transition-all border border-amber-200">
          <Zap size={15} />
          إعادة بناء المخزون
        </button>
      </div>

      {/* Rebuild Done Alert */}
      {rebuildDone && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl px-5 py-3 mb-5 flex items-center gap-2 text-emerald-700 text-sm font-bold">
          <CheckCircle size={16} /> تم إعادة بناء Stock Snapshot بنجاح ✅
        </div>
      )}

      {/* ── IDLE ── */}
      {status === STATUS.IDLE && (
        <>
          <label onDrop={onDrop} onDragOver={(e) => e.preventDefault()}
            className="flex flex-col items-center justify-center border-2 border-dashed border-indigo-200 rounded-2xl p-12 cursor-pointer hover:border-indigo-400 hover:bg-indigo-50/30 transition-all mb-6">
            <Upload size={36} className="text-indigo-300 mb-3" />
            <p className="text-slate-600 font-bold mb-1">اسحب ملف حركة المخزون من Between</p>
            <p className="text-slate-400 text-xs">ملف الـ Movements بصيغة .xlsx</p>
            <input type="file" accept=".xlsx,.xls" className="hidden" onChange={onDrop} />
          </label>

          {/* عرض Snapshot الحالي إن وجد */}
          {Object.keys(snapshot).length > 0 && (
            <div>
              <p className="text-sm font-black text-slate-600 mb-3 flex items-center gap-2">
                <BarChart2 size={16} /> المخزون الحالي (Stock Snapshot)
              </p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {Object.entries(snapshot).map(([sku, data]) => (
                  <div key={sku} className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
                    <p className="text-xs font-mono text-slate-400 mb-1">{sku}</p>
                    <p className="text-2xl font-black text-slate-800">{data.currentQty}</p>
                    <p className="text-xs text-slate-400 mt-1">{data.lastUpdated?.slice(0, 10)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* ── LOADING ── */}
      {(status === STATUS.PARSING || status === STATUS.SAVING || status === STATUS.REBUILDING) && (
        <div className="flex flex-col items-center justify-center py-16 gap-4">
          <RefreshCw size={32} className="text-indigo-500 animate-spin" />
          <p className="text-slate-600 font-bold">{progress}</p>
        </div>
      )}

      {/* ── ERROR ── */}
      {status === STATUS.ERROR && (
        <div className="flex flex-col items-center gap-4 py-12">
          <XCircle size={40} className="text-rose-500" />
          <p className="text-rose-600 font-bold">{progress}</p>
          <button onClick={reset} className="px-5 py-2.5 bg-slate-100 rounded-xl font-bold text-slate-600">حاول مرة أخرى</button>
        </div>
      )}

      {/* ── DONE ── */}
      {status === STATUS.DONE && (
        <div className="flex flex-col items-center gap-5 py-12">
          <CheckCircle size={48} className="text-emerald-500" />
          <div className="text-center">
            <p className="text-2xl font-black text-slate-800 mb-1">تم الاستيراد بنجاح! 🎉</p>
            <p className="text-slate-500 text-sm">
              تم حفظ <span className="text-emerald-600 font-black">{saved}</span> حركة
              وتحديث Stock Snapshot تلقائياً
            </p>
          </div>
          <button onClick={reset} className="px-6 py-3 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700">استيراد ملف آخر</button>
        </div>
      )}

      {/* ── PREVIEW ── */}
      {status === STATUS.PREVIEW && (
        <>
          {/* إحصائيات */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <StatCard label="إجمالي الحركات" value={newRows.length}  color="slate"   />
            <StatCard label="مبيعات (خصم)"   value={stats.sales}    color="rose"    />
            <StatCard label="مرتجعات (إضافة)"value={stats.returns}  color="emerald" />
            <StatCard label="إضافة / تسوية"  value={stats.adds + stats.updates} color="amber" />
          </div>

          {dupRows.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl px-5 py-3 mb-5 flex items-center gap-2 text-amber-700 text-sm font-bold">
              <AlertTriangle size={16} /> {dupRows.length} حركة موجودة مسبقاً — سيتم تخطيها
            </div>
          )}

          {/* Stock Snapshot Preview */}
          <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-5 mb-5">
            <p className="text-indigo-800 font-black text-sm mb-3 flex items-center gap-2">
              <BarChart2 size={16} /> المخزون بعد الاستيراد (Stock Snapshot)
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {Object.entries(snapshot).map(([sku, data]) => (
                <div key={sku} className="bg-white rounded-xl p-3 border border-indigo-100">
                  <p className="text-xs font-mono text-slate-400 mb-1">{sku}</p>
                  <p className="text-xl font-black text-slate-800">{data.currentQty}</p>
                  <p className="text-xs text-slate-400 mt-1">{data.lastUpdated?.slice(0, 10)}</p>
                </div>
              ))}
            </div>
          </div>

          {/* جدول معاينة */}
          <div className="bg-slate-50 rounded-2xl border border-slate-100 overflow-hidden mb-6">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-200 bg-slate-100">
              <Eye size={15} className="text-slate-500" />
              <span className="text-sm font-black text-slate-600">معاينة أول 20 حركة</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="text-slate-500 bg-slate-100">
                  <tr>
                    <th className="p-2 text-right font-black">SKU</th>
                    <th className="p-2 text-right font-black">النوع</th>
                    <th className="p-2 text-right font-black">الكمية</th>
                    <th className="p-2 text-right font-black">قبل</th>
                    <th className="p-2 text-right font-black">بعد</th>
                    <th className="p-2 text-right font-black">AWB</th>
                    <th className="p-2 text-right font-black">التاريخ</th>
                  </tr>
                </thead>
                <tbody>
                  {newRows.slice(0, 20).map((row, i) => (
                    <tr key={i} className="border-t hover:bg-white">
                      <td className="p-2 font-mono font-bold text-slate-700">{row.sku}</td>
                      <td className="p-2">
                        <span className={`px-2 py-0.5 rounded-lg font-bold ${movTypeColor[row.movementType]}`}>
                          {movTypeLabel[row.movementType]}
                        </span>
                      </td>
                      <td className={`p-2 font-black ${row.qty < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                        {row.qty > 0 ? `+${row.qty}` : row.qty}
                      </td>
                      <td className="p-2 text-slate-400">{row.previousQty}</td>
                      <td className="p-2 font-bold text-slate-700">{row.newQty}</td>
                      <td className="p-2 font-mono text-slate-400 text-xs">{row.awb}</td>
                      <td className="p-2 text-slate-400">{row.date?.slice(0, 10)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {newRows.length > 20 && (
              <p className="text-center text-xs text-slate-400 font-bold py-3 border-t">+ {newRows.length - 20} حركة إضافية</p>
            )}
          </div>

          <div className="flex gap-3 justify-end">
            <button onClick={reset} className="px-5 py-2.5 rounded-xl font-bold text-slate-500 hover:bg-slate-100">إلغاء</button>
            <button onClick={handleSave} disabled={!newRows.length}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold transition-all ${newRows.length ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm' : 'bg-slate-100 text-slate-400 cursor-not-allowed'}`}>
              <Save size={16} /> حفظ {newRows.length} حركة + بناء Snapshot
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function StatCard({ label, value, color }) {
  const colors = {
    slate: 'text-slate-800', emerald: 'text-emerald-600',
    amber: 'text-amber-600', rose: 'text-rose-600', indigo: 'text-indigo-600',
  };
  return (
    <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
      <p className="text-xs font-black text-slate-400 mb-1">{label}</p>
      <p className={`text-xl font-black ${colors[color]}`}>{value}</p>
    </div>
  );
}
