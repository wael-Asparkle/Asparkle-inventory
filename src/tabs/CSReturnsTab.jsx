import React, { useState, useCallback, useMemo } from 'react';
import {
  RotateCcw, Upload, Save, Eye, RefreshCw, CheckCircle,
  XCircle, AlertTriangle, Package, Banknote, Truck, Search
} from 'lucide-react';
import { collection, doc, getDocs, writeBatch } from 'firebase/firestore';
import { db, appId } from '../config/firebase';

// ── Firebase ──────────────────────────────────────────────────
const returnsRef   = () => collection(db, 'artifacts', appId, 'public', 'data', 'cs_returns');
const movementsRef = () => collection(db, 'artifacts', appId, 'public', 'data', 'movements');

const STATUS = { IDLE: 'idle', PARSING: 'parsing', PREVIEW: 'preview', SAVING: 'saving', DONE: 'done', ERROR: 'error' };

// ── قاموس المنتجات ────────────────────────────────────────────
const PRODUCT_MAP = [
  { keywords: ['spark ash', 'سبارك اش', '9000909'],         sku: '9000909', name: 'Spark Ash'    },
  { keywords: ['spark breeze', 'بريز', '9000908'],          sku: '9000908', name: 'Spark Breeze' },
  { keywords: ['spark glow', 'قلو', '9000906'],             sku: '9000906', name: 'Spark Glow'   },
  { keywords: ['spark duo', 'دو', '9000905'],               sku: '9000905', name: 'Spark Duo'    },
  { keywords: ['moon spark', 'مون', '9000904'],             sku: '9000904', name: 'Moon Spark'   },
  { keywords: ['سجنتشر', 'signature', '9000902'],           sku: '9000902', name: 'سجنتشر'       },
  { keywords: ['اسباركل الأخضر', 'اسباركل', '9000901'],    sku: '9000901', name: 'اسباركل'      },
  { keywords: ['midnight', 'ميدنايت'],                      sku: 'MIDNIGHT', name: 'Midnight'    },
  { keywords: ['twilight', 'تويلايت'],                      sku: 'TWILIGHT', name: 'Twilight'    },
  { keywords: ['ray', 'راي'],                               sku: 'RAY',     name: 'RAY'          },
];

function extractProducts(note) {
  if (!note) return [];
  const lower = note.toLowerCase();
  const found = [];
  PRODUCT_MAP.forEach(({ keywords, sku, name }) => {
    if (keywords.some((kw) => lower.includes(kw.toLowerCase()))) {
      if (!found.find((f) => f.sku === sku)) found.push({ sku, name });
    }
  });
  return found;
}

// ── تحليل نوع الطلب ──────────────────────────────────────────
function classifyRow(row) {
  const amount   = parseFloat(String(row['المبلغ']).replace(/,/g, '')) || 0;
  const bank     = String(row['اسم البنك'] || '').trim();
  const note     = String(row['ملاحظات']   || '').toLowerCase().trim();
  const newOrder = String(row['رقم الطلب الجديد'] || '').replace(/\.0$/, '').trim();
  const status   = String(row['حالة المبلغ'] || '').trim();

  // استبدال مجاني أو شحن تعويض
  if (amount === 0) {
    if (newOrder) return 'استبدال';
    if (note.includes('شحن') || note.includes('اعادة') || note.includes('إعادة')) return 'شحن_تعويض';
    return 'شحن_تعويض';
  }

  // استرداد مالي
  if (bank.includes('تمارا')) return 'استرداد_تمارا';
  return 'استرداد_مالي';
}

// ── تحليل صف واحد ────────────────────────────────────────────
function parseRow(row) {
  const ref = String(row['رقم الطلب'] || '')
    .replace(/\.0$/, '')
    .replace(/E\d+/g, (m) => '')
    .trim();

  // تحويل الأرقام العلمية
  const refNum = parseFloat(String(row['رقم الطلب'] || ''));
  const cleanRef = refNum ? Math.round(refNum).toString() : ref;

  if (!cleanRef || cleanRef === 'رقم الطلب') return null;

  const amount    = parseFloat(String(row['المبلغ']).replace(/,/g, '')) || 0;
  const note      = String(row['ملاحظات'] || '').trim();
  const bank      = String(row['اسم البنك'] || '').trim();
  const status    = String(row['حالة المبلغ'] || '').trim();
  const newOrder  = String(row['رقم الطلب الجديد'] || '').replace(/\.0$/, '').trim();
  const newOrderNum = parseFloat(String(row['رقم الطلب الجديد'] || ''));
  const cleanNewOrder = newOrderNum ? Math.round(newOrderNum).toString() : newOrder;
  const type      = classifyRow(row);
  const products  = extractProducts(note);

  return {
    reference:    cleanRef,
    customerName: String(row['اسم العميل'] || '').trim(),
    amount,
    bank,
    note,
    status,
    newOrderRef:  cleanNewOrder || null,
    iban:         String(row['رقم الأيبان'] || '').trim(),
    type,
    products,
    needsShipment: type === 'استبدال' || type === 'شحن_تعويض',
    affectsStock:  type === 'استبدال' || type === 'شحن_تعويض',
    source:       'customer_service',
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

// ════════════════════════════════════════════════════════════
//  المكوّن الرئيسي
// ════════════════════════════════════════════════════════════
export default function CSReturnsTab() {
  const [view, setView]         = useState('import'); // 'import' | 'records'
  const [status, setStatus]     = useState(STATUS.IDLE);
  const [parsed, setParsed]     = useState([]);
  const [existing, setExisting] = useState(new Set());
  const [records, setRecords]   = useState([]);
  const [progress, setProgress] = useState('');
  const [saved, setSaved]       = useState(0);
  const [search, setSearch]     = useState('');

  // ── تحميل السجلات الموجودة ────────────────────────────────
  const loadRecords = useCallback(async () => {
    const snap = await getDocs(returnsRef());
    setRecords(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  }, []);

  // ── قراءة الملف ───────────────────────────────────────────
  const handleFile = useCallback(async (file) => {
    if (!file) return;
    setStatus(STATUS.PARSING); setProgress('جاري قراءة الملف...');
    try {
      const XLSX = await loadXLSX();
      const wb   = XLSX.read(await file.arrayBuffer(), { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, { defval: '', range: 2 });

      setProgress('جاري تحليل البيانات...');
      const parsedRows = rows.map(parseRow).filter(Boolean);

      setProgress('جاري فحص التكرار...');
      const snap = await getDocs(returnsRef());
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
    const f = e.dataTransfer?.files[0] || e.target.files?.[0];
    if (f) handleFile(f);
  };

  const newRows = parsed.filter((r) => !existing.has(r.reference));
  const dupRows = parsed.filter((r) =>  existing.has(r.reference));

  // ── إحصائيات المعاينة ─────────────────────────────────────
  const stats = useMemo(() => {
    const financial  = newRows.filter((r) => r.type === 'استرداد_مالي' || r.type === 'استرداد_تمارا');
    const shipment   = newRows.filter((r) => r.type === 'شحن_تعويض' || r.type === 'استبدال');
    const totalAmt   = financial.reduce((a, b) => a + b.amount, 0);
    return { financial: financial.length, shipment: shipment.length, totalAmt };
  }, [newRows]);

  // ── حفظ ───────────────────────────────────────────────────
  const handleSave = async () => {
    if (!newRows.length) return;
    setStatus(STATUS.SAVING);
    try {
      const BATCH_SIZE = 400;
      for (let i = 0; i < newRows.length; i += BATCH_SIZE) {
        const batch = writeBatch(db);
        newRows.slice(i, i + BATCH_SIZE).forEach((row) => {
          // حفظ سجل المرتجع
          batch.set(doc(returnsRef()), {
            ...row,
            importedAt: new Date().toISOString(),
          });

          // إذا شحن تعويض أو استبدال → يخصم من المخزون
          if (row.affectsStock && row.products.length > 0) {
            row.products.forEach(({ sku }) => {
              if (sku.startsWith('UNKNOWN') || ['MIDNIGHT','TWILIGHT','RAY'].includes(sku)) return;
              batch.set(doc(movementsRef()), {
                type:      'بيع آلي (عبر الربط)',
                level:     'منتج',
                code:      sku,
                quantity:  1,
                reference: row.reference,
                note:      row.note,
                date:      new Date().toISOString().split('T')[0],
                source:    'cs_return_shipment',
                createdAt: new Date().toISOString(),
              });
            });
          }
        });
        await batch.commit();
        setProgress(`تم حفظ ${Math.min(i + BATCH_SIZE, newRows.length)} من ${newRows.length}...`);
      }
      setSaved(newRows.length);
      setStatus(STATUS.DONE);
      setProgress('');
      loadRecords();
    } catch (err) {
      console.error(err);
      setProgress('حدث خطأ أثناء الحفظ ❌');
      setStatus(STATUS.ERROR);
    }
  };

  const reset = () => { setStatus(STATUS.IDLE); setParsed([]); setExisting(new Set()); setProgress(''); setSaved(0); };

  // ── تصنيف الألوان ────────────────────────────────────────
  const typeColors = {
    'استرداد_تمارا': 'bg-purple-50 text-purple-700',
    'استرداد_مالي':  'bg-blue-50 text-blue-700',
    'شحن_تعويض':    'bg-amber-50 text-amber-700',
    'استبدال':       'bg-emerald-50 text-emerald-700',
  };
  const typeLabels = {
    'استرداد_تمارا': 'استرداد تمارا',
    'استرداد_مالي':  'استرداد مالي',
    'شحن_تعويض':    'شحن تعويض',
    'استبدال':       'استبدال',
  };

  return (
    <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-8" dir="rtl">

      {/* Header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <RotateCcw className="text-rose-500" size={28} />
          <div>
            <h2 className="text-2xl font-black text-slate-800">مرتجعات خدمة العملاء</h2>
            <p className="text-slate-400 text-xs mt-0.5">استيراد ومتابعة ملفات الرجيع الشهرية</p>
          </div>
        </div>

        <div className="flex gap-2">
          <button onClick={() => setView('import')}
            className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${view === 'import' ? 'bg-rose-50 text-rose-700' : 'text-slate-500 hover:bg-slate-100'}`}>
            <Upload size={14} className="inline ml-1" /> استيراد
          </button>
          <button onClick={() => { setView('records'); loadRecords(); }}
            className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${view === 'records' ? 'bg-rose-50 text-rose-700' : 'text-slate-500 hover:bg-slate-100'}`}>
            <Eye size={14} className="inline ml-1" /> السجلات
          </button>
        </div>
      </div>

      {/* ══ IMPORT VIEW ══ */}
      {view === 'import' && (
        <>
          {status === STATUS.IDLE && (
            <label onDrop={onDrop} onDragOver={(e) => e.preventDefault()}
              className="flex flex-col items-center justify-center border-2 border-dashed border-rose-200 rounded-2xl p-12 cursor-pointer hover:border-rose-400 hover:bg-rose-50/30 transition-all">
              <Upload size={36} className="text-rose-300 mb-3" />
              <p className="text-slate-600 font-bold mb-1">اسحب ملف الرجيع الشهري هنا أو اضغط للاختيار</p>
              <p className="text-slate-400 text-xs">ملف Excel من فريق خدمة العملاء</p>
              <input type="file" accept=".xlsx,.xls" className="hidden" onChange={onDrop} />
            </label>
          )}

          {(status === STATUS.PARSING || status === STATUS.SAVING) && (
            <div className="flex flex-col items-center justify-center py-16 gap-4">
              <RefreshCw size={32} className="text-rose-500 animate-spin" />
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
                <p className="text-2xl font-black text-slate-800 mb-1">تم الاستيراد بنجاح! 🎉</p>
                <p className="text-slate-500 text-sm">تم حفظ <span className="text-emerald-600 font-black">{saved}</span> سجل مرتجع</p>
              </div>
              <button onClick={reset} className="px-6 py-3 bg-rose-500 text-white rounded-2xl font-bold hover:bg-rose-600">استيراد ملف آخر</button>
            </div>
          )}

          {status === STATUS.PREVIEW && (
            <>
              {/* إحصائيات */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <StatCard label="إجمالي الصفوف"    value={parsed.length}                         color="slate"   icon={<RotateCcw size={16}/>} />
                <StatCard label="جديدة"             value={newRows.length}                        color="emerald" icon={<CheckCircle size={16}/>} />
                <StatCard label="استردادات مالية"   value={`${stats.totalAmt.toLocaleString()} ر`} color="blue"    icon={<Banknote size={16}/>} />
                <StatCard label="تحتاج شحن"         value={stats.shipment}                        color="amber"   icon={<Truck size={16}/>} />
              </div>

              {dupRows.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl px-5 py-3 mb-5 flex items-center gap-2 text-amber-700 text-sm font-bold">
                  <AlertTriangle size={16} /> {dupRows.length} سجل موجود مسبقاً — سيتم تخطيه
                </div>
              )}

              {/* تنبيه الشحن */}
              {stats.shipment > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 mb-5">
                  <p className="text-amber-800 font-black text-sm mb-3 flex items-center gap-2">
                    <Truck size={16} /> طلبات تحتاج شحن تعويض ({stats.shipment})
                  </p>
                  <div className="flex flex-col gap-2">
                    {newRows.filter((r) => r.needsShipment).map((r) => (
                      <div key={r.reference} className="bg-white rounded-xl border border-amber-100 px-4 py-3 text-xs">
                        <span className="font-black text-slate-700">{r.customerName}</span>
                        <span className="text-slate-400 mx-2">#{r.reference}</span>
                        <span className="text-slate-600">{r.note.slice(0, 80)}...</span>
                        {r.products.length > 0 && (
                          <div className="flex gap-1 mt-1 flex-wrap">
                            {r.products.map((p) => (
                              <span key={p.sku} className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded font-bold">{p.name}</span>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* جدول معاينة */}
              <div className="bg-slate-50 rounded-2xl border border-slate-100 overflow-hidden mb-6">
                <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-200 bg-slate-100">
                  <Eye size={15} className="text-slate-500" />
                  <span className="text-sm font-black text-slate-600">معاينة أول 15 سجل</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="text-slate-500 bg-slate-100">
                      <tr>
                        <th className="p-2 text-right font-black">رقم الطلب</th>
                        <th className="p-2 text-right font-black">العميل</th>
                        <th className="p-2 text-right font-black">النوع</th>
                        <th className="p-2 text-right font-black">المبلغ</th>
                        <th className="p-2 text-right font-black">البنك</th>
                        <th className="p-2 text-right font-black">المنتجات</th>
                        <th className="p-2 text-right font-black">الحالة</th>
                      </tr>
                    </thead>
                    <tbody>
                      {newRows.slice(0, 15).map((row) => (
                        <tr key={row.reference} className="border-t hover:bg-white">
                          <td className="p-2 font-mono text-slate-500">{row.reference}</td>
                          <td className="p-2 font-bold text-slate-700">{row.customerName}</td>
                          <td className="p-2">
                            <span className={`px-2 py-0.5 rounded-lg font-bold text-xs ${typeColors[row.type] || 'bg-slate-100 text-slate-600'}`}>
                              {typeLabels[row.type] || row.type}
                            </span>
                          </td>
                          <td className="p-2 font-black text-slate-800">{row.amount > 0 ? `${row.amount} ر` : '—'}</td>
                          <td className="p-2 text-slate-500">{row.bank || '—'}</td>
                          <td className="p-2">
                            {row.products.length > 0
                              ? <div className="flex flex-wrap gap-1">{row.products.map((p) => <span key={p.sku} className="bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded font-bold">{p.name}</span>)}</div>
                              : <span className="text-slate-300">—</span>}
                          </td>
                          <td className="p-2 text-slate-500">{row.status || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {newRows.length > 15 && <p className="text-center text-xs text-slate-400 font-bold py-3 border-t">+ {newRows.length - 15} سجل إضافي</p>}
              </div>

              <div className="flex gap-3 justify-end">
                <button onClick={reset} className="px-5 py-2.5 rounded-xl font-bold text-slate-500 hover:bg-slate-100">إلغاء</button>
                <button onClick={handleSave} disabled={!newRows.length}
                  className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold transition-all ${newRows.length ? 'bg-rose-500 hover:bg-rose-600 text-white shadow-sm' : 'bg-slate-100 text-slate-400 cursor-not-allowed'}`}>
                  <Save size={16} /> حفظ {newRows.length} سجل
                </button>
              </div>
            </>
          )}
        </>
      )}

      {/* ══ RECORDS VIEW ══ */}
      {view === 'records' && (
        <>
          <div className="relative mb-5">
            <Search size={15} className="absolute top-1/2 -translate-y-1/2 right-3 text-slate-400" />
            <input type="text" placeholder="ابحث برقم الطلب أو اسم العميل..."
              value={search} onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-2.5 pr-9 pl-4 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-rose-300" />
          </div>

          {records.length === 0 ? (
            <div className="text-center py-16 text-slate-400 font-bold">لا توجد سجلات بعد</div>
          ) : (
            <div className="bg-slate-50 rounded-2xl border border-slate-100 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="text-slate-500 bg-slate-100">
                    <tr>
                      <th className="p-2 text-right font-black">رقم الطلب</th>
                      <th className="p-2 text-right font-black">العميل</th>
                      <th className="p-2 text-right font-black">النوع</th>
                      <th className="p-2 text-right font-black">المبلغ</th>
                      <th className="p-2 text-right font-black">المنتجات</th>
                      <th className="p-2 text-right font-black">الحالة</th>
                      <th className="p-2 text-right font-black">ملاحظات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {records
                      .filter((r) => !search || r.reference?.includes(search) || r.customerName?.includes(search))
                      .map((row) => (
                        <tr key={row.id} className="border-t hover:bg-white">
                          <td className="p-2 font-mono text-slate-500">{row.reference}</td>
                          <td className="p-2 font-bold text-slate-700">{row.customerName}</td>
                          <td className="p-2">
                            <span className={`px-2 py-0.5 rounded-lg font-bold text-xs ${typeColors[row.type] || 'bg-slate-100 text-slate-600'}`}>
                              {typeLabels[row.type] || row.type}
                            </span>
                          </td>
                          <td className="p-2 font-black">{row.amount > 0 ? `${row.amount} ر` : '—'}</td>
                          <td className="p-2">
                            {row.products?.length > 0
                              ? <div className="flex flex-wrap gap-1">{row.products.map((p) => <span key={p.sku} className="bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded font-bold">{p.name}</span>)}</div>
                              : '—'}
                          </td>
                          <td className="p-2 text-slate-500">{row.status || '—'}</td>
                          <td className="p-2 text-slate-400 max-w-[200px] truncate">{row.note}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function StatCard({ label, value, color, icon }) {
  const colors = {
    slate: 'text-slate-800', emerald: 'text-emerald-600',
    amber: 'text-amber-600', blue: 'text-blue-600', rose: 'text-rose-600',
  };
  return (
    <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
      <div className="flex items-center gap-1 text-slate-400 mb-1">{icon}<p className="text-xs font-black">{label}</p></div>
      <p className={`text-xl font-black ${colors[color]}`}>{value}</p>
    </div>
  );
}
