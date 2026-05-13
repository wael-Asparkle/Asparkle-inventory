import React, { useState, useCallback } from 'react';
import {
  Database, Upload, Save, Eye, RefreshCw, CheckCircle,
  XCircle, AlertTriangle, BarChart2, Zap, ClipboardList
} from 'lucide-react';
import { collection, doc, getDocs, writeBatch, setDoc } from 'firebase/firestore';
import { db, appId } from '../config/firebase';

// ── Firebase Paths ────────────────────────────────────────────
const movementsCol = () => collection(db, 'artifacts', appId, 'public', 'data', 'stock_movements');
const snapshotCol  = () => collection(db, 'artifacts', appId, 'public', 'data', 'stock_snapshot');

const STATUS = { IDLE: 'idle', PARSING: 'parsing', PREVIEW: 'preview', SAVING: 'saving', REBUILDING: 'rebuilding', DONE: 'done', ERROR: 'error' };

// ── تحويل Status ───────────────────────────────────────────────
function resolveMovementType(status) {
  switch ((status || '').toLowerCase().trim()) {
    case 'deducted': return 'SALE';
    case 'return':   return 'RETURN';
    case 'add':      return 'ADD';
    case 'update':   return 'UPDATE';
    default:         return 'UNKNOWN';
  }
}

// ── تحليل صف حركة ─────────────────────────────────────────────
function parseMovementRow(row) {
  const sku    = String(row['Sku']    || '').trim();
  const status = String(row['Status'] || '').trim();
  if (!sku || sku === 'Sku' || !status || status === 'Status') return null;

  const rowNo  = parseInt(row['NO']) || 0;
  const movementType = resolveMovementType(status);
  const direction = movementType === 'RETURN' || movementType === 'ADD' || movementType === 'UPDATE' ? 1 : -1;

  return {
    rowNo,
    sku,
    movementType,
    qty:         parseFloat(row['QuantityUsed'] || 0) * direction,
    previousQty: parseFloat(row['PreviousQuantity'] || 0),
    newQty:      parseFloat(row['NewQuantity'] || 0),
    status,
    awb:         String(row['AWB']       || '').trim(),
    date:        String(row['Entrydate'] || '').trim(),
    source:      'Between',
  };
}

// ── تحليل صف مخزون رسمي ───────────────────────────────────────
function parseStockRow(row) {
  const sku = String(row['Iteam sku'] || row['SKU'] || row['Sku'] || '').trim();
  const qty = parseFloat(row['Quantity'] || row['quantity'] || 0);
  const name = String(row['Name'] || row['NAME'] || '').trim();
  if (!sku || isNaN(qty)) return null;
  return { sku, currentQty: qty, name };
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

// ── بناء Snapshot من الحركات ──────────────────────────────────
function buildSnapshot(movements) {
  const sorted = [...movements].sort((a, b) => new Date(a.date) - new Date(b.date));
  const snapshot = {};
  sorted.forEach((m) => {
    if (!m.sku) return;
    const key = `${m.rowNo}_${m.sku}`;
    if (m.movementType === 'ADD' || m.movementType === 'UPDATE') {
      snapshot[m.sku] = m.newQty;
    } else {
      snapshot[m.sku] = m.newQty;
    }
  });
  return snapshot;
}

// ════════════════════════════════════════════════════════════
//  المكوّن الرئيسي
// ════════════════════════════════════════════════════════════
export default function BetweenImportTab() {
  const [activeMode, setActiveMode] = useState('snapshot'); // 'snapshot' | 'movements'

  return (
    <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-8" dir="rtl">

      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Database className="text-indigo-600" size={28} />
        <div>
          <h2 className="text-2xl font-black text-slate-800">استيراد Between</h2>
          <p className="text-slate-400 text-xs mt-0.5">Inventory Ledger — مصدر الحقيقة الرسمي للمخزون</p>
        </div>
      </div>

      {/* Mode Tabs */}
      <div className="flex gap-2 mb-8 bg-slate-50 p-1 rounded-2xl w-fit">
        <button onClick={() => setActiveMode('snapshot')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${activeMode === 'snapshot' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
          <ClipboardList size={15} /> مخزون رسمي
        </button>
        <button onClick={() => setActiveMode('movements')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${activeMode === 'movements' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
          <BarChart2 size={15} /> حركات المخزون
        </button>
      </div>

      {activeMode === 'snapshot'  && <OfficialStockImport />}
      {activeMode === 'movements' && <MovementsImport />}
    </div>
  );
}

// ════════════════════════════════════════════════════════════
//  رفع المخزون الرسمي من بتوين
// ════════════════════════════════════════════════════════════
function OfficialStockImport() {
  const [status, setStatus]   = useState(STATUS.IDLE);
  const [parsed, setParsed]   = useState([]);
  const [progress, setProgress] = useState('');
  const [saved, setSaved]     = useState(0);

  const handleFile = useCallback(async (file) => {
    if (!file) return;
    setStatus(STATUS.PARSING); setProgress('جاري قراءة الملف...');
    try {
      const XLSX = await loadXLSX();
      const wb   = XLSX.read(await file.arrayBuffer(), { type: 'array' });
      const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' });
      const rawRows = rows.map(parseStockRow).filter(Boolean);
// دمج نفس الـ SKU من locations مختلفة
const skuMap = {};
rawRows.forEach((r) => {
  if (!skuMap[r.sku]) skuMap[r.sku] = { sku: r.sku, name: r.name, currentQty: 0 };
  skuMap[r.sku].currentQty += r.currentQty;
});
const parsedRows = Object.values(skuMap);
      setParsed(parsedRows);
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

  const handleSave = async () => {
    if (!parsed.length) return;
    setStatus(STATUS.SAVING); setProgress('جاري حفظ المخزون الرسمي...');
    try {
      const batch = writeBatch(db);
      parsed.forEach((row) => {
        batch.set(doc(snapshotCol(), row.sku), {
          sku:         row.sku,
          currentQty:  row.currentQty,
          name:        row.name,
          lastUpdated: new Date().toISOString(),
          source:      'Between_Official',
        });
      });
      await batch.commit();
      setSaved(parsed.length);
      setStatus(STATUS.DONE);
      setProgress('');
    } catch (err) {
      console.error(err);
      setProgress('حدث خطأ ❌');
      setStatus(STATUS.ERROR);
    }
  };

  const reset = () => { setStatus(STATUS.IDLE); setParsed([]); setProgress(''); setSaved(0); };

  return (
    <div>
      <div className="bg-indigo-50 border border-indigo-100 rounded-2xl px-5 py-3 mb-6 text-indigo-700 text-sm font-bold flex items-center gap-2">
        <ClipboardList size={16} />
        ارفع ملف "Items List" من بتوين — يحتوي على الكميات الإجمالية الصحيحة لكل SKU
      </div>

      {status === STATUS.IDLE && (
        <label onDrop={onDrop} onDragOver={(e) => e.preventDefault()}
          className="flex flex-col items-center justify-center border-2 border-dashed border-indigo-200 rounded-2xl p-12 cursor-pointer hover:border-indigo-400 hover:bg-indigo-50/30 transition-all">
          <ClipboardList size={36} className="text-indigo-300 mb-3" />
          <p className="text-slate-600 font-bold mb-1">اسحب ملف المخزون الرسمي من Between</p>
          <p className="text-slate-400 text-xs">ملف Items List بصيغة .xlsx</p>
          <input type="file" accept=".xlsx,.xls" className="hidden" onChange={onDrop} />
        </label>
      )}

      {(status === STATUS.PARSING || status === STATUS.SAVING) && (
        <div className="flex flex-col items-center justify-center py-16 gap-4">
          <RefreshCw size={32} className="text-indigo-500 animate-spin" />
          <p className="text-slate-600 font-bold">{progress}</p>
        </div>
      )}

      {status === STATUS.ERROR && (
        <div className="flex flex-col items-center gap-4 py-12">
          <XCircle size={40} className="text-rose-500" />
          <p className="text-rose-600 font-bold">{progress}</p>
          <button onClick={reset} className="px-5 py-2.5 bg-slate-100 rounded-xl font-bold text-slate-600">حاول مرة أخرى</button>
        </div>
      )}

      {status === STATUS.DONE && (
        <div className="flex flex-col items-center gap-5 py-12">
          <CheckCircle size={48} className="text-emerald-500" />
          <div className="text-center">
            <p className="text-2xl font-black text-slate-800 mb-1">تم تحديث المخزون الرسمي! ✅</p>
            <p className="text-slate-500 text-sm">تم حفظ <span className="text-emerald-600 font-black">{saved}</span> منتج في Stock Snapshot</p>
          </div>
          <button onClick={reset} className="px-6 py-3 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700">رفع ملف آخر</button>
        </div>
      )}

      {status === STATUS.PREVIEW && (
        <>
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 mb-5">
            <p className="text-emerald-800 font-black text-sm mb-3">المخزون الذي سيُحفظ:</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {parsed.map((row) => (
                <div key={row.sku} className="bg-white rounded-xl p-3 border border-emerald-100">
                  <p className="text-xs font-mono text-slate-400 mb-1">{row.sku}</p>
                  <p className="text-xl font-black text-slate-800">{row.currentQty}</p>
                  <p className="text-xs text-slate-500 mt-1">{row.name}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-3 justify-end">
            <button onClick={reset} className="px-5 py-2.5 rounded-xl font-bold text-slate-500 hover:bg-slate-100">إلغاء</button>
            <button onClick={handleSave}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm transition-all">
              <Save size={16} /> حفظ كـ Stock Snapshot رسمي
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════
//  رفع حركات المخزون من بتوين
// ════════════════════════════════════════════════════════════
function MovementsImport() {
  const [status, setStatus]     = useState(STATUS.IDLE);
  const [parsed, setParsed]     = useState([]);
  const [existing, setExisting] = useState(new Set());
  const [progress, setProgress] = useState('');
  const [saved, setSaved]       = useState(0);
  const [rebuildDone, setRebuildDone] = useState(false);

  const handleFile = useCallback(async (file) => {
    if (!file) return;
    setStatus(STATUS.PARSING); setProgress('جاري قراءة ملف الحركات...');
    try {
      const XLSX = await loadXLSX();
      const wb   = XLSX.read(await file.arrayBuffer(), { type: 'array' });
      const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' });

      setProgress('جاري تحليل الحركات...');
      const parsedRows = rows.map(parseMovementRow).filter(Boolean);

      setProgress('جاري فحص التكرار...');
      const snap = await getDocs(movementsCol());
      const existingKeys = new Set(
        snap.docs.map((d) => {
          const m = d.data();
          return (m.movementType === 'ADD' || m.movementType === 'UPDATE')
            ? `${m.rowNo}_${m.sku}`
            : `${m.awb}_${m.sku}`;
        }).filter(Boolean)
      );

      setExisting(existingKeys);
      setParsed(parsedRows);
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

  const newRows = parsed.filter((r) => {
    const key = (r.movementType === 'ADD' || r.movementType === 'UPDATE')
      ? `${r.rowNo}_${r.sku}` : `${r.awb}_${r.sku}`;
    return !existing.has(key);
  });
  const dupRows = parsed.filter((r) => {
    const key = (r.movementType === 'ADD' || r.movementType === 'UPDATE')
      ? `${r.rowNo}_${r.sku}` : `${r.awb}_${r.sku}`;
    return existing.has(key);
  });

  const stats = {
    sales:   newRows.filter((r) => r.movementType === 'SALE').length,
    returns: newRows.filter((r) => r.movementType === 'RETURN').length,
    adds:    newRows.filter((r) => r.movementType === 'ADD').length,
    updates: newRows.filter((r) => r.movementType === 'UPDATE').length,
  };

  const handleSave = async () => {
    if (!newRows.length) return;
    setStatus(STATUS.SAVING);
    try {
      const BATCH_SIZE = 400;
      for (let i = 0; i < newRows.length; i += BATCH_SIZE) {
        const batch = writeBatch(db);
        newRows.slice(i, i + BATCH_SIZE).forEach((row) => {
          batch.set(doc(movementsCol()), { ...row, importedAt: new Date().toISOString() });
        });
        await batch.commit();
        setProgress(`حفظ ${Math.min(i + BATCH_SIZE, newRows.length)} / ${newRows.length}...`);
      }
      setSaved(newRows.length);
      setStatus(STATUS.DONE);
      setProgress('');
    } catch (err) {
      console.error(err);
      setProgress('حدث خطأ ❌');
      setStatus(STATUS.ERROR);
    }
  };

  const reset = () => { setStatus(STATUS.IDLE); setParsed([]); setExisting(new Set()); setProgress(''); setSaved(0); setRebuildDone(false); };

  const movTypeColor = { SALE: 'bg-rose-50 text-rose-700', RETURN: 'bg-emerald-50 text-emerald-700', ADD: 'bg-indigo-50 text-indigo-700', UPDATE: 'bg-amber-50 text-amber-700' };
  const movTypeLabel = { SALE: 'بيع', RETURN: 'مرتجع', ADD: 'إضافة', UPDATE: 'تسوية' };

  return (
    <div>
      <div className="bg-amber-50 border border-amber-100 rounded-2xl px-5 py-3 mb-6 text-amber-700 text-sm font-bold flex items-center gap-2">
        <BarChart2 size={16} />
        ارفع ملف "Item Movement" من بتوين — للتحليل التاريخي وحساب Time Machine
      </div>

      {status === STATUS.IDLE && (
        <label onDrop={onDrop} onDragOver={(e) => e.preventDefault()}
          className="flex flex-col items-center justify-center border-2 border-dashed border-amber-200 rounded-2xl p-12 cursor-pointer hover:border-amber-400 hover:bg-amber-50/30 transition-all">
          <BarChart2 size={36} className="text-amber-300 mb-3" />
          <p className="text-slate-600 font-bold mb-1">اسحب ملف حركات المخزون من Between</p>
          <p className="text-slate-400 text-xs">ملف Item Movement بصيغة .xlsx</p>
          <input type="file" accept=".xlsx,.xls" className="hidden" onChange={onDrop} />
        </label>
      )}

      {(status === STATUS.PARSING || status === STATUS.SAVING || status === STATUS.REBUILDING) && (
        <div className="flex flex-col items-center justify-center py-16 gap-4">
          <RefreshCw size={32} className="text-amber-500 animate-spin" />
          <p className="text-slate-600 font-bold">{progress}</p>
        </div>
      )}

      {status === STATUS.ERROR && (
        <div className="flex flex-col items-center gap-4 py-12">
          <XCircle size={40} className="text-rose-500" />
          <p className="text-rose-600 font-bold">{progress}</p>
          <button onClick={reset} className="px-5 py-2.5 bg-slate-100 rounded-xl font-bold text-slate-600">حاول مرة أخرى</button>
        </div>
      )}

      {status === STATUS.DONE && (
        <div className="flex flex-col items-center gap-5 py-12">
          <CheckCircle size={48} className="text-emerald-500" />
          <div className="text-center">
            <p className="text-2xl font-black text-slate-800 mb-1">تم حفظ الحركات! 🎉</p>
            <p className="text-slate-500 text-sm">تم حفظ <span className="text-emerald-600 font-black">{saved}</span> حركة</p>
          </div>
          <button onClick={reset} className="px-6 py-3 bg-amber-500 text-white rounded-2xl font-bold hover:bg-amber-600">رفع ملف آخر</button>
        </div>
      )}

      {status === STATUS.PREVIEW && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <StatCard label="إجمالي الحركات" value={newRows.length}  color="slate"   />
            <StatCard label="مبيعات (خصم)"   value={stats.sales}    color="rose"    />
            <StatCard label="مرتجعات"         value={stats.returns}  color="emerald" />
            <StatCard label="إضافة / تسوية"  value={stats.adds + stats.updates} color="amber" />
          </div>

          {dupRows.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl px-5 py-3 mb-5 flex items-center gap-2 text-amber-700 text-sm font-bold">
              <AlertTriangle size={16} /> {dupRows.length} حركة موجودة مسبقاً — سيتم تخطيها
            </div>
          )}

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
                      <td className="p-2"><span className={`px-2 py-0.5 rounded-lg font-bold ${movTypeColor[row.movementType] || 'bg-slate-100 text-slate-500'}`}>{movTypeLabel[row.movementType] || row.movementType}</span></td>
                      <td className={`p-2 font-black ${row.qty < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>{row.qty > 0 ? `+${row.qty}` : row.qty}</td>
                      <td className="p-2 text-slate-400">{row.previousQty}</td>
                      <td className="p-2 font-bold text-slate-700">{row.newQty}</td>
                      <td className="p-2 font-mono text-slate-400 text-xs">{row.awb}</td>
                      <td className="p-2 text-slate-400">{row.date?.slice(0, 10)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {newRows.length > 20 && <p className="text-center text-xs text-slate-400 font-bold py-3 border-t">+ {newRows.length - 20} حركة إضافية</p>}
          </div>

          <div className="flex gap-3 justify-end">
            <button onClick={reset} className="px-5 py-2.5 rounded-xl font-bold text-slate-500 hover:bg-slate-100">إلغاء</button>
            <button onClick={handleSave} disabled={!newRows.length}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold transition-all ${newRows.length ? 'bg-amber-500 hover:bg-amber-600 text-white shadow-sm' : 'bg-slate-100 text-slate-400 cursor-not-allowed'}`}>
              <Save size={16} /> حفظ {newRows.length} حركة
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function StatCard({ label, value, color }) {
  const colors = { slate: 'text-slate-800', emerald: 'text-emerald-600', amber: 'text-amber-600', rose: 'text-rose-600', indigo: 'text-indigo-600' };
  return (
    <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
      <p className="text-xs font-black text-slate-400 mb-1">{label}</p>
      <p className={`text-xl font-black ${colors[color]}`}>{value}</p>
    </div>
  );
}
