import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowRightLeft,
  Plus,
  Save,
  RefreshCw,
  Search,
  Download,
  X,
  AlertTriangle,
} from 'lucide-react';
import { collection, onSnapshot, addDoc } from 'firebase/firestore';
import { db, appId } from '../config/firebase';

const stockMovementsCol = () => collection(db, 'artifacts', appId, 'public', 'data', 'stock_movements');

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

const MOVEMENT_TYPES = [
  { value: 'ADD', label: 'دخول مخزون', help: 'زيادة حقيقية في المخزون: إنتاج جديد أو استلام جديد فقط' },
  { value: 'SALE', label: 'خروج / بيع', help: 'ينقص المخزون بسبب طلب أو بيع' },
  { value: 'RETURN', label: 'مرتجع عميل', help: 'رجوع منتج من عميل، وليس رجوع تصوير' },
  { value: 'PHOTO_OUT', label: 'سحب للتصوير', help: 'استخدمها عند إخراج منتجات للتصوير — لا تستخدم خروج / بيع' },
  { value: 'PHOTO_RETURN', label: 'إرجاع من التصوير', help: 'استخدمها عند رجوع منتجات التصوير — لا تستخدم دخول مخزون حتى لا يتدبل' },
  { value: 'PHOTO_LOSS', label: 'فاقد تصوير', help: 'استخدمها للفرق الناقص بعد التصوير. توثيق فقط ولا تُسجل معه حركة دخول إضافية' },
  { value: 'UPDATE', label: 'تسوية جرد', help: 'تعديل يدوي عند وجود فرق جرد واضح' },
  { value: 'DAMAGE', label: 'دامج / تالف', help: 'توثيق فاقد أو تلف خارج التصوير' },
  { value: 'MISSING', label: 'مفقود شحن', help: 'مع AWB عند الحاجة' },
];

const TYPE_LABELS = MOVEMENT_TYPES.reduce((acc, item) => ({ ...acc, [item.value]: item.label }), {});

const TYPE_CLASSES = {
  ADD: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  SALE: 'bg-rose-50 text-rose-700 border-rose-100',
  RETURN: 'bg-blue-50 text-blue-700 border-blue-100',
  PHOTO_OUT: 'bg-violet-50 text-violet-700 border-violet-100',
  PHOTO_RETURN: 'bg-cyan-50 text-cyan-700 border-cyan-100',
  PHOTO_LOSS: 'bg-orange-50 text-orange-700 border-orange-100',
  UPDATE: 'bg-amber-50 text-amber-700 border-amber-100',
  DAMAGE: 'bg-orange-50 text-orange-700 border-orange-100',
  MISSING: 'bg-slate-50 text-slate-700 border-slate-200',
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

function signedQty(type, qty) {
  const value = Math.abs(toNumber(qty));
  if (['SALE', 'DAMAGE', 'MISSING', 'PHOTO_OUT', 'PHOTO_LOSS'].includes(type)) return -value;
  return value;
}

function formatDateTime(value) {
  const date = normalizeDate(value);
  if (!date) return '—';
  return date.replace('T', ' ').slice(0, 16);
}

function exportCSV(rows) {
  const lines = [
    ['التاريخ', 'النوع', 'SKU', 'اسم المنتج', 'الكمية', 'AWB', 'المصدر', 'الملاحظة'],
    ...rows.map((m) => [
      formatDateTime(m.date),
      TYPE_LABELS[m.movementType] || m.movementType || '',
      m.sku || '',
      PRODUCT_NAMES[m.sku] || m.name || '',
      m.qty ?? '',
      m.awb || '',
      m.source || '',
      m.note || '',
    ]),
  ].map((r) => r.join(',')).join('\n');

  const blob = new Blob(['\uFEFF' + lines], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `stock-movements-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function MovementsTab() {
  const [movements, setMovements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [form, setForm] = useState({
    movementType: 'ADD',
    sku: '',
    qty: '',
    awb: '',
    note: '',
    date: new Date().toISOString().slice(0, 10),
  });

  useEffect(() => {
    const unsub = onSnapshot(stockMovementsCol(), (snap) => {
      setMovements(snap.docs.map((d) => ({ id: d.id, ...d.data(), date: normalizeDate(d.data().date) })));
      setLoading(false);
    }, (err) => {
      console.error(err);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const showMsg = (text) => { setMsg(text); setTimeout(() => setMsg(''), 3000); };

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return movements
      .filter((m) => typeFilter === 'ALL' || m.movementType === typeFilter)
      .filter((m) => {
        if (!q) return true;
        return [m.sku, PRODUCT_NAMES[m.sku], m.awb, m.note, m.source, m.movementType, TYPE_LABELS[m.movementType]]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(q));
      })
      .sort((a, b) => new Date(normalizeDate(b.date)) - new Date(normalizeDate(a.date)));
  }, [movements, search, typeFilter]);

  const todayStats = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const todayRows = movements.filter((m) => normalizeDate(m.date).slice(0, 10) === today);
    const photoOut = todayRows.filter((m) => m.movementType === 'PHOTO_OUT').reduce((sum, m) => sum + Math.abs(toNumber(m.qty)), 0);
    const photoReturn = todayRows.filter((m) => m.movementType === 'PHOTO_RETURN').reduce((sum, m) => sum + Math.abs(toNumber(m.qty)), 0);

    return {
      count: todayRows.length,
      in: todayRows.filter((m) => ['ADD', 'RETURN'].includes(m.movementType)).reduce((sum, m) => sum + Math.abs(toNumber(m.qty)), 0),
      out: todayRows.filter((m) => m.movementType === 'SALE').reduce((sum, m) => sum + Math.abs(toNumber(m.qty)), 0),
      photoOpen: Math.max(0, photoOut - photoReturn),
      loss: todayRows.filter((m) => ['DAMAGE', 'MISSING', 'PHOTO_LOSS'].includes(m.movementType)).reduce((sum, m) => sum + Math.abs(toNumber(m.qty)), 0),
    };
  }, [movements]);

  const selectedType = MOVEMENT_TYPES.find((type) => type.value === form.movementType);
  const isPhotoMovement = ['PHOTO_OUT', 'PHOTO_RETURN', 'PHOTO_LOSS'].includes(form.movementType);

  const handleSave = async () => {
    if (!form.sku || !form.qty || !form.movementType) return;
    setSaving(true);
    try {
      await addDoc(stockMovementsCol(), {
        sku: form.sku,
        movementType: form.movementType,
        qty: signedQty(form.movementType, form.qty),
        awb: form.awb.trim(),
        note: form.note.trim(),
        source: isPhotoMovement ? 'Photo' : 'Manual',
        date: form.date ? new Date(`${form.date}T12:00:00`).toISOString() : new Date().toISOString(),
        createdAt: new Date().toISOString(),
      });
      showMsg('تم حفظ الحركة ✅');
      setForm({ movementType: 'ADD', sku: '', qty: '', awb: '', note: '', date: new Date().toISOString().slice(0, 10) });
      setShowForm(false);
    } catch (err) {
      console.error(err);
      showMsg('حدث خطأ أثناء حفظ الحركة ❌');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-8" dir="rtl">
      <div className="flex items-center justify-between gap-4 flex-wrap mb-6">
        <div className="flex items-center gap-3">
          <ArrowRightLeft className="text-indigo-600" size={28} />
          <div>
            <h2 className="text-2xl font-black text-slate-800">حركات المخزون</h2>
            <p className="text-slate-400 text-xs mt-0.5">سجل الدخول والخروج والمرتجعات والتصوير والفاقد</p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {msg && <span className="text-sm font-bold text-emerald-600">{msg}</span>}
          <button onClick={() => exportCSV(filteredRows)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200">
            <Download size={15} /> تصدير
          </button>
          <button onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold bg-indigo-600 text-white hover:bg-indigo-700">
            {showForm ? <X size={15} /> : <Plus size={15} />} {showForm ? 'إغلاق' : 'تسجيل حركة'}
          </button>
        </div>
      </div>

      <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-4 mb-6 flex items-start gap-3">
        <AlertTriangle size={18} className="text-indigo-600 mt-0.5" />
        <p className="text-xs leading-6 text-indigo-700 font-bold">
          رجوع منتجات التصوير لا يُسجل كـ <span className="font-black">دخول مخزون</span>، بل كـ <span className="font-black">إرجاع من التصوير</span>.
          وإذا رجع أقل من المسحوب، سجّل الفرق كـ <span className="font-black">فاقد تصوير</span> حتى لا يتدبل المخزون.
        </p>
      </div>

      {showForm && (
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 mb-6">
          <p className="text-sm font-black text-slate-700 mb-4">تسجيل حركة يدوية</p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-3">
            <FormField label="نوع الحركة">
              <select value={form.movementType} onChange={(e) => setForm({ ...form, movementType: e.target.value })}
                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-indigo-300">
                {MOVEMENT_TYPES.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
              </select>
            </FormField>

            <FormField label="المنتج">
              <select value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })}
                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-indigo-300">
                <option value="">اختر المنتج</option>
                {Object.entries(PRODUCT_NAMES).map(([sku, name]) => <option key={sku} value={sku}>{name} ({sku})</option>)}
              </select>
            </FormField>

            <FormField label="الكمية">
              <input type="number" min="1" value={form.qty} onChange={(e) => setForm({ ...form, qty: e.target.value })} placeholder="مثال: 10"
                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-indigo-300" />
            </FormField>

            <FormField label="التاريخ">
              <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })}
                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
            </FormField>

            <FormField label="AWB / مرجع">
              <input type="text" value={form.awb} onChange={(e) => setForm({ ...form, awb: e.target.value })} placeholder="اختياري"
                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-indigo-300" />
            </FormField>

            <FormField label="ملاحظة">
              <input type="text" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="مثال: تصوير حملة البكج"
                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-indigo-300" />
            </FormField>
          </div>

          <div className="flex justify-between items-center gap-3 mt-4 flex-wrap">
            <p className={`text-xs font-bold ${isPhotoMovement ? 'text-violet-600' : 'text-slate-400'}`}>
              {selectedType?.help}
            </p>
            <button onClick={handleSave} disabled={!form.sku || !form.qty || saving}
              className="flex items-center gap-2 px-5 py-2 rounded-xl font-bold text-sm bg-indigo-600 hover:bg-indigo-700 text-white disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed">
              <Save size={14} /> {saving ? 'جاري الحفظ...' : 'حفظ الحركة'}
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard label="حركات اليوم" value={todayStats.count} tone="slate" />
        <StatCard label="دخول اليوم" value={todayStats.in.toLocaleString()} tone="emerald" />
        <StatCard label="تصوير مفتوح" value={todayStats.photoOpen.toLocaleString()} tone="violet" />
        <StatCard label="فاقد اليوم" value={todayStats.loss.toLocaleString()} tone="amber" />
      </div>

      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 flex-1 min-w-[240px]">
          <Search size={15} className="text-slate-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="بحث بالـ SKU أو AWB أو الملاحظة..."
            className="bg-transparent outline-none text-sm font-bold text-slate-600 flex-1" />
        </div>
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}
          className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-300">
          <option value="ALL">كل الحركات</option>
          {MOVEMENT_TYPES.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 gap-3 text-slate-400">
          <RefreshCw size={20} className="animate-spin" />
          <span className="font-bold text-sm">جاري تحميل الحركات...</span>
        </div>
      ) : (
        <div className="bg-slate-50 rounded-2xl border border-slate-100 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-100 text-slate-600">
              <tr>
                {['التاريخ', 'النوع', 'SKU', 'اسم المنتج', 'الكمية', 'AWB / مرجع', 'المصدر', 'ملاحظة'].map((h) => (
                  <th key={h} className="p-3 text-right font-black whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredRows.slice(0, 250).map((m) => (
                <tr key={m.id} className="border-t hover:bg-white transition-colors">
                  <td className="p-3 text-xs text-slate-400 font-bold whitespace-nowrap">{formatDateTime(m.date)}</td>
                  <td className="p-3 whitespace-nowrap"><span className={`inline-flex px-2 py-1 rounded-lg border text-xs font-black ${TYPE_CLASSES[m.movementType] || 'bg-slate-50 text-slate-600 border-slate-200'}`}>{TYPE_LABELS[m.movementType] || m.movementType || '—'}</span></td>
                  <td className="p-3 font-mono text-xs text-slate-500 whitespace-nowrap">{m.sku}</td>
                  <td className="p-3 font-bold text-slate-700 whitespace-nowrap">{PRODUCT_NAMES[m.sku] || m.name || '—'}</td>
                  <td className={`p-3 font-black ${toNumber(m.qty) < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>{toNumber(m.qty) > 0 ? `+${toNumber(m.qty)}` : toNumber(m.qty)}</td>
                  <td className="p-3 font-mono text-xs text-slate-400 whitespace-nowrap">{m.awb || '—'}</td>
                  <td className="p-3 text-xs text-slate-400 font-bold whitespace-nowrap">{m.source || '—'}</td>
                  <td className="p-3 text-xs text-slate-500 min-w-[160px]">{m.note || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredRows.length === 0 && <p className="text-center text-sm text-slate-400 font-bold py-8">لا توجد حركات مطابقة</p>}
          {filteredRows.length > 250 && <p className="text-center text-xs text-slate-400 font-bold py-3 border-t">تم عرض أول 250 حركة فقط من أصل {filteredRows.length}</p>}
        </div>
      )}
    </div>
  );
}

function FormField({ label, children }) {
  return (
    <div>
      <label className="text-xs font-black text-slate-500 mb-1 block">{label}</label>
      {children}
    </div>
  );
}

function StatCard({ label, value, tone }) {
  const toneClasses = {
    slate: 'text-slate-800',
    emerald: 'text-emerald-600',
    rose: 'text-rose-600',
    amber: 'text-amber-600',
    violet: 'text-violet-600',
  };
  return (
    <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
      <p className="text-xs font-black text-slate-400 mb-1">{label}</p>
      <p className={`text-2xl font-black ${toneClasses[tone] || toneClasses.slate}`}>{value}</p>
    </div>
  );
}
