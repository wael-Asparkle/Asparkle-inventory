import React, { useState, useCallback } from 'react';
import { Upload, AlertTriangle, CheckCircle, XCircle, Eye, Save, RefreshCw } from 'lucide-react';
import {
  collection, doc, getDocs, writeBatch
} from 'firebase/firestore';
import { db, appId } from '../config/firebase';
import { parseOrderRow, resolveSkusFromRaw, ASG_MAPPING, BUNDLE_COSTS, PRODUCT_CATALOG } from '../constants/masterMapping';

// ── مسارات Firebase ──────────────────────────────────────────
const ordersRef   = () => collection(db, 'artifacts', appId, 'public', 'data', 'orders');
const movementsRef= () => collection(db, 'artifacts', appId, 'public', 'data', 'movements');

// ── حالات الاستيراد ──────────────────────────────────────────
const STATUS = { IDLE: 'idle', PARSING: 'parsing', PREVIEW: 'preview', SAVING: 'saving', DONE: 'done', ERROR: 'error' };

export default function ImportTab() {
  const [status, setStatus]       = useState(STATUS.IDLE);
  const [parsed, setParsed]       = useState([]);   // كل الصفوف بعد التحليل
  const [existing, setExisting]   = useState(new Set()); // أرقام طلبات موجودة
  const [progress, setProgress]   = useState('');
  const [saved, setSaved]         = useState(0);
  const [skipped, setSkipped]     = useState(0);

  // ── تحميل مكتبة XLSX من CDN ─────────────────────────────
  const loadXLSX = () => new Promise((resolve, reject) => {
    if (window.XLSX) return resolve(window.XLSX);
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
    script.onload  = () => resolve(window.XLSX);
    script.onerror = () => reject(new Error('فشل تحميل مكتبة XLSX'));
    document.head.appendChild(script);
  });

  // ── قراءة الملف ──────────────────────────────────────────
  const handleFile = useCallback(async (file) => {
    if (!file) return;
    setStatus(STATUS.PARSING);
    setProgress('جاري قراءة الملف...');

    try {
      const XLSX   = await loadXLSX();
      const buffer = await file.arrayBuffer();
      const wb     = XLSX.read(buffer, { type: 'array', cellDates: true });
      const ws     = wb.Sheets[wb.SheetNames[0]];
      const rows   = XLSX.utils.sheet_to_json(ws, { defval: '' });

      setProgress('جاري تحليل الطلبات...');
      const parsedRows = rows.map(parseOrderRow).filter((r) => r.reference);

      setProgress('جاري فحص التكرار من Firebase...');
      const snap = await getDocs(ordersRef());
      const existingRefs = new Set(snap.docs.map((d) => d.data().reference));

      setExisting(existingRefs);
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
    const file = e.dataTransfer?.files[0] || e.target.files?.[0];
    if (file) handleFile(file);
  };

  // ── إحصائيات المعاينة ──────────────────────────────────
  const newRows      = parsed.filter((r) => !existing.has(r.reference));
  const dupRows      = parsed.filter((r) =>  existing.has(r.reference));
  const totalRevenue = newRows.reduce((a, b) => a + b.total, 0);

  // ── حفظ إلى Firebase ──────────────────────────────────────
  const handleSave = async () => {
    if (!newRows.length) return;
    setStatus(STATUS.SAVING);
    setProgress('جاري الحفظ...');

    try {
      // نحفظ على دفعات (Firestore batch limit = 500)
      const BATCH_SIZE = 400;

      for (let i = 0; i < newRows.length; i += BATCH_SIZE) {
        const batch = writeBatch(db);
        const chunk = newRows.slice(i, i + BATCH_SIZE);

        chunk.forEach((order) => {
          // 1) حفظ الطلب
          const oRef = doc(ordersRef());
          batch.set(oRef, {
            reference:     order.reference,
            customer:      order.customer,
            rawSku:        order.rawSku,
            asgCode:       order.asgCode,
            channel:       order.channel,
            skuBreakdown:  order.skuBreakdown,
            paymentMethod: order.paymentMethod,
            total:         order.total,
            date:          order.date,
            importedAt:    new Date().toISOString(),
          });

          // 2) حفظ حركة لكل SKU مخصوم
          Object.entries(order.skuBreakdown).forEach(([sku, qty]) => {
            const mRef = doc(movementsRef());
            batch.set(mRef, {
              type: paymentToMovementType(order.paymentMethod),
              level:     'منتج',
              code:      sku,
              quantity:  qty,
              reference: order.reference,
              channel:   order.channel,
              date:      order.date,
              createdAt: new Date().toISOString(),
            });
          });
        });

        await batch.commit();
        setProgress(`تم حفظ ${Math.min(i + BATCH_SIZE, newRows.length)} من ${newRows.length}...`);
      }

      setSaved(newRows.length);
      setSkipped(dupRows.length);
      setStatus(STATUS.DONE);
      setProgress('');
    } catch (err) {
      console.error(err);
      setProgress('حدث خطأ أثناء الحفظ ❌');
      setStatus(STATUS.ERROR);
    }
  };

  const reset = () => {
    setStatus(STATUS.IDLE);
    setParsed([]);
    setExisting(new Set());
    setProgress('');
    setSaved(0);
    setSkipped(0);
  };

  // ══════════════════════════════════════════════════════════
  //  UI
  // ══════════════════════════════════════════════════════════
  return (
    <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-8" dir="rtl">

      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Upload className="text-indigo-600" size={28} />
        <div>
          <h2 className="text-2xl font-black text-slate-800">استيراد المبيعات</h2>
          <p className="text-slate-400 text-xs mt-0.5">رفع ملف Excel يُغذّي الطلبات + المخزون + الحركات تلقائياً</p>
        </div>
      </div>

      {/* ── IDLE: منطقة الرفع ── */}
      {status === STATUS.IDLE && (
        <label
          onDrop={onDrop}
          onDragOver={(e) => e.preventDefault()}
          className="flex flex-col items-center justify-center border-2 border-dashed border-slate-200 rounded-2xl p-12 cursor-pointer hover:border-indigo-400 hover:bg-indigo-50/30 transition-all"
        >
          <Upload size={36} className="text-slate-300 mb-3" />
          <p className="text-slate-600 font-bold mb-1">اسحب ملف Excel هنا أو اضغط للاختيار</p>
          <p className="text-slate-400 text-xs">يدعم .xlsx و .xls</p>
          <input type="file" accept=".xlsx,.xls" className="hidden" onChange={onDrop} />
        </label>
      )}

      {/* ── PARSING / SAVING: تحميل ── */}
      {(status === STATUS.PARSING || status === STATUS.SAVING) && (
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
          <button onClick={reset} className="px-5 py-2.5 bg-slate-100 rounded-xl font-bold text-slate-600 hover:bg-slate-200 transition-all">
            حاول مرة أخرى
          </button>
        </div>
      )}

      {/* ── DONE ── */}
      {status === STATUS.DONE && (
        <div className="flex flex-col items-center gap-5 py-12">
          <CheckCircle size={48} className="text-emerald-500" />
          <div className="text-center">
            <p className="text-2xl font-black text-slate-800 mb-1">تم الاستيراد بنجاح! 🎉</p>
            <p className="text-slate-500 text-sm">
              تم حفظ <span className="text-emerald-600 font-black">{saved}</span> طلب جديد
              {skipped > 0 && <> — تم تخطي <span className="text-amber-600 font-black">{skipped}</span> مكرر</>}
            </p>
          </div>
          <button onClick={reset} className="px-6 py-3 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition-all">
            استيراد ملف آخر
          </button>
        </div>
      )}

      {/* ── PREVIEW ── */}
      {status === STATUS.PREVIEW && (
        <>
          {/* إحصائيات سريعة */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <StatCard label="إجمالي الصفوف"   value={parsed.length}                   color="slate"   />
            <StatCard label="طلبات جديدة"      value={newRows.length}                  color="emerald" />
            <StatCard label="مكررة (تُتخطى)"   value={dupRows.length}                  color="amber"   />
            <StatCard label="الإيراد المتوقع"  value={`${totalRevenue.toLocaleString()} ر`} color="indigo"  />
          </div>

          {/* تنبيه تكرار */}
          {dupRows.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl px-5 py-3 mb-5 flex items-center gap-2 text-amber-700 text-sm font-bold">
              <AlertTriangle size={16} />
              {dupRows.length} طلب موجود مسبقاً في النظام — سيتم تخطيها تلقائياً
            </div>
          )}

          {/* جدول معاينة */}
          <div className="bg-slate-50 rounded-2xl border border-slate-100 overflow-hidden mb-6">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-200 bg-slate-100">
              <Eye size={15} className="text-slate-500" />
              <span className="text-sm font-black text-slate-600">معاينة أول 20 طلب جديد</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="text-slate-500 bg-slate-100">
                  <tr>
                    <th className="p-2 text-right font-black">رقم الطلب</th>
                    <th className="p-2 text-right font-black">العميل</th>
                    <th className="p-2 text-right font-black">المدينة</th>
                    <th className="p-2 text-right font-black">SKU الخام</th>
                    <th className="p-2 text-right font-black">القناة</th>
                    <th className="p-2 text-right font-black">المخصوم من المخزون</th>
                    <th className="p-2 text-right font-black">الدفع</th>
                    <th className="p-2 text-right font-black">الإجمالي</th>
                  </tr>
                </thead>
                <tbody>
                  {newRows.slice(0, 20).map((row) => (
                    <tr key={row.reference} className="border-t hover:bg-white transition-colors">
                      <td className="p-2 font-mono text-slate-500">{row.reference}</td>
                      <td className="p-2 font-bold text-slate-700">{row.customer.name}</td>
                      <td className="p-2 text-slate-500">{row.customer.city}</td>
                      <td className="p-2 font-mono text-indigo-600 font-bold">{row.rawSku}</td>
                      <td className="p-2">
                        <span className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-lg font-bold">
                          {row.channel}
                        </span>
                      </td>
                      <td className="p-2">
                        <div className="flex flex-wrap gap-1">
                          {Object.entries(row.skuBreakdown).map(([sku, qty]) => (
                            <span key={sku} className="bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded text-xs font-bold">
                              {sku} ×{qty}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="p-2 text-slate-500">{row.paymentMethod}</td>
                      <td className="p-2 font-black text-slate-800">{row.total} ر</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {newRows.length > 20 && (
              <p className="text-center text-xs text-slate-400 font-bold py-3 border-t border-slate-200">
                + {newRows.length - 20} طلب إضافي
              </p>
            )}
          </div>

          {/* أزرار */}
          <div className="flex gap-3 justify-end">
            <button onClick={reset} className="px-5 py-2.5 rounded-xl font-bold text-slate-500 hover:bg-slate-100 transition-all">
              إلغاء
            </button>
            <button
              onClick={handleSave}
              disabled={!newRows.length}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold transition-all ${
                newRows.length
                  ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-400 cursor-not-allowed'
              }`}
            >
              <Save size={16} />
              استيراد {newRows.length} طلب جديد
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ── مكون بطاقة إحصاء ──────────────────────────────────────
function StatCard({ label, value, color }) {
  const colors = {
    slate:   'text-slate-800',
    emerald: 'text-emerald-600',
    amber:   'text-amber-600',
    indigo:  'text-indigo-600',
  };
  return (
    <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
      <p className="text-xs font-black text-slate-400 mb-1">{label}</p>
      <p className={`text-xl font-black ${colors[color]}`}>{value}</p>
    </div>
  );
}
