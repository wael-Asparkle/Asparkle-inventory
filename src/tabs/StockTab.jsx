import React, { useEffect, useState, useMemo } from 'react';
import {
  PackageOpen, RefreshCw, Clock, AlertTriangle, Save, X, Plus,
  Download, BarChart2, ChevronDown, ChevronUp, CheckCircle, Pencil
} from 'lucide-react';
import { collection, onSnapshot, addDoc, doc, updateDoc } from 'firebase/firestore';
import { db, appId } from '../config/firebase';

const stockMovementsCol = () => collection(db, 'artifacts', appId, 'public', 'data', 'stock_movements');

const PRODUCT_NAMES = {
  '9000901':  'اسباركل الأخضر',
  '9000902':  'سجنتشر',
  '09000903': 'بكج عينات مجاني',
  '9000904':  'Moon Spark',
  '9000905':  'Spark Duo',
  '9000906':  'Spark Glow',
  '9000908':  'Spark Breeze',
  '9000909':  'Spark Ash',
};

const DAMAGE_REASONS = [
  'تسريب',
  'مكسور',
  'تلف داخلي',
  'مرتجع تالف',
  'دامج شركة الشحن',
  'خروج العطر من الفوم الداخلي',
];

function buildSnapshotAtDate(movements, beforeDate) {
  const filtered = beforeDate
    ? movements.filter((m) => m.date && m.date <= beforeDate + 'T23:59:59')
    : movements;
  const sorted = [...filtered].sort((a, b) => new Date(a.date) - new Date(b.date));
  const stock = {};
  sorted.forEach((m) => {
    if (!m.sku) return;
    if (!stock[m.sku]) stock[m.sku] = 0;
    switch (m.movementType) {
      case 'ADD':     stock[m.sku] += Math.abs(m.qty); break;
      case 'SALE':    stock[m.sku] -= Math.abs(m.qty); break;
      case 'RETURN':  stock[m.sku] += Math.abs(m.qty); break;
      case 'UPDATE':  stock[m.sku] += m.qty; break;      
    }
  });
  return stock;
}

function buildOpeningMap(movements) {
  const opening = {};
  [...movements].sort((a, b) => new Date(a.date) - new Date(b.date))
    .filter((m) => m.movementType === 'ADD')
    .forEach((m) => {
      if (!m.sku) return;
      opening[m.sku] = (opening[m.sku] || 0) + Math.abs(m.qty);
    });
  return opening;
}

function buildTypeMap(movements, type, beforeDate) {
  const filtered = beforeDate
    ? movements.filter((m) => m.date && m.date <= beforeDate + 'T23:59:59')
    : movements;
  const map = {};
  filtered.filter((m) => m.movementType === type).forEach((m) => {
    map[m.sku] = (map[m.sku] || 0) + Math.abs(m.qty);
  });
  return map;
}

function buildDayEvents(movements, date) {
  if (!date) return { damage: [], missing: [], returns: [] };
  const day = movements.filter((m) => m.date && m.date.slice(0, 10) === date);
  const groupBySku = (arr) => {
    const map = {};
    arr.forEach((m) => {
      if (!map[m.sku]) map[m.sku] = { ...m, qty: 0 };
      map[m.sku].qty += Math.abs(m.qty);
    });
    return Object.values(map);
  };
  return {
    damage:  groupBySku(day.filter((m) => m.movementType === 'DAMAGE')),
    missing: groupBySku(day.filter((m) => m.movementType === 'MISSING')),
    returns: groupBySku(day.filter((m) => m.movementType === 'RETURN')),
  };
}

function exportCSV(rows, missingRecords) {
  const stockLines = [
    ['SKU', 'اسم المنتج', 'الافتتاحي', 'المخزون الحالي', 'المرتجعات', 'الدامج', 'المفقودات', 'الصافي المتاح'],
    ...rows.map((r) => [r.sku, r.name, r.opening, r.current, r.returns, r.damage, r.missing, r.net]),
  ].map((r) => r.join(',')).join('\n');
  const missingLines = [
    '', 'سجل المفقودات',
    ['التاريخ', 'SKU', 'المنتج', 'الكمية', 'AWB', 'الحالة', 'مبلغ التعويض', 'ملاحظات'],
    ...missingRecords.map((m) => [
      m.date?.slice(0, 10) || '', m.sku, PRODUCT_NAMES[m.sku] || m.sku,
      Math.abs(m.qty), m.awb || '',
      m.status === 'compensated' ? 'تم التعويض' : 'بانتظار التعويض',
      m.compensationAmount || '', m.note || '',
    ]),
  ].map((r) => Array.isArray(r) ? r.join(',') : r).join('\n');
  const blob = new Blob(['\uFEFF' + stockLines + '\n' + missingLines], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `stock-report-${new Date().toISOString().slice(0,10)}.csv`;
  a.click(); URL.revokeObjectURL(url);
}

// ─── مكوّن سجل دامج واحد مع تعديل ─────────────────────────
function DamageRecord({ m, onSave, showMsg }) {
  const [editing, setEditing]   = useState(false);
  const [form, setForm]         = useState({
    sku:  m.sku,
    qty:  Math.abs(m.qty),
    note: m.note || '',
    date: m.date?.slice(0, 10) || '',
  });
  const [saving, setSaving] = useState(false);
  const today = new Date().toISOString().slice(0, 10);
  const isCustomNote = form.note && !DAMAGE_REASONS.includes(form.note);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'stock_movements', m.id), {
        sku:  form.sku,
        qty:  -Math.abs(parseInt(form.qty)),
        note: form.note,
        date: form.date ? new Date(form.date + 'T12:00:00').toISOString() : m.date,
        updatedAt: new Date().toISOString(),
      });
      showMsg('تم التعديل ✅');
      setEditing(false);
    } catch { showMsg('حدث خطأ ❌'); }
    finally { setSaving(false); }
  };

  if (editing) {
    return (
      <div className="bg-rose-50 rounded-xl px-4 py-3 border border-rose-200">
        <div className="grid grid-cols-2 gap-2 mb-2">
          <div>
            <label className="text-xs font-black text-slate-500 mb-1 block">المنتج</label>
            <select value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })}
              className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-rose-300">
              {Object.entries(PRODUCT_NAMES).map(([s, n]) => <option key={s} value={s}>{n}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-black text-slate-500 mb-1 block">الكمية</label>
            <input type="number" min="1" value={form.qty}
              onChange={(e) => setForm({ ...form, qty: e.target.value })}
              className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-rose-300" />
          </div>
          <div>
            <label className="text-xs font-black text-slate-500 mb-1 block">التاريخ</label>
            <input type="date" max={today} value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
              className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-rose-300" />
          </div>
          <div>
            <label className="text-xs font-black text-slate-500 mb-1 block">السبب</label>
            <select
              value={DAMAGE_REASONS.includes(form.note) || form.note === '' ? form.note : 'أخرى'}
              onChange={(e) => setForm({ ...form, note: e.target.value === 'أخرى' ? '' : e.target.value })}
              className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-rose-300">
              <option value="">اختر السبب</option>
              {DAMAGE_REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
              <option value="أخرى">أخرى (كتابة حرة)</option>
            </select>
          </div>
        </div>
        {(!DAMAGE_REASONS.includes(form.note) && form.note !== '') || isCustomNote ? (
          <input type="text" value={form.note}
            onChange={(e) => setForm({ ...form, note: e.target.value })}
            placeholder="اكتب السبب..."
            className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs font-bold mb-2 focus:outline-none focus:ring-2 focus:ring-rose-300" />
        ) : null}
        <div className="flex gap-2 justify-end mt-1">
          <button onClick={() => setEditing(false)}
            className="text-xs font-bold text-slate-400 hover:text-slate-600 px-2">إلغاء</button>
          <button onClick={handleSave} disabled={!form.sku || !form.qty || saving}
            className={`flex items-center gap-1 text-xs font-black px-3 py-1.5 rounded-lg transition-all ${
              form.sku && form.qty && !saving ? 'bg-rose-600 text-white hover:bg-rose-700' : 'bg-slate-100 text-slate-400 cursor-not-allowed'}`}>
            <Save size={12} /> {saving ? 'جاري الحفظ...' : 'حفظ التعديل'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl px-4 py-3 border border-rose-100">
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm font-black text-slate-700">{PRODUCT_NAMES[m.sku] || m.sku}</span>
        <div className="flex items-center gap-2">
          <span className="bg-rose-100 text-rose-600 font-black text-xs px-2 py-0.5 rounded-lg">
            -{Math.abs(m.qty)} وحدة
          </span>
          <button onClick={() => setEditing(true)}
            className="flex items-center gap-1 text-xs font-black text-slate-400 hover:text-indigo-600 transition-colors px-1">
            <Pencil size={12} /> تعديل
          </button>
        </div>
      </div>
      <div className="flex items-center gap-3 text-xs text-slate-400">
        {m.date && <span>{m.date.slice(0,10)}</span>}
        {m.note && <span className="bg-slate-100 text-slate-500 px-2 py-0.5 rounded-md font-bold">{m.note}</span>}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════
export default function StockTab() {
  const [movements, setMovements]         = useState([]);
  const [loading, setLoading]             = useState(true);
  const [selectedDate, setSelectedDate]   = useState('');
  const [activeForm, setActiveForm]       = useState(null);
  const [showDashboard, setShowDashboard] = useState(false);

  const [damageEntry, setDamageEntry]   = useState({ sku: '', qty: '', note: '', date: '' });
  const [missingEntry, setMissingEntry] = useState({ sku: '', qty: '', awb: '', note: '', date: '' });
  const [saving, setSaving]             = useState(false);
  const [msg, setMsg]                   = useState('');

  const [compensatingId, setCompensatingId]         = useState(null);
  const [compensationAmount, setCompensationAmount] = useState('');
  const [activeDamageNote, setActiveDamageNote]     = useState('');

  useEffect(() => {
    const unsub = onSnapshot(stockMovementsCol(), (snap) => {
      setMovements(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const snapshot   = useMemo(() => buildSnapshotAtDate(movements, selectedDate), [movements, selectedDate]);
  const openingMap = useMemo(() => buildOpeningMap(movements), [movements]);
  const damageMap  = useMemo(() => buildTypeMap(movements, 'DAMAGE',  selectedDate), [movements, selectedDate]);
  const missingMap = useMemo(() => buildTypeMap(movements, 'MISSING', selectedDate), [movements, selectedDate]);
  const returnMap  = useMemo(() => buildTypeMap(movements, 'RETURN',  selectedDate), [movements, selectedDate]);
  const dayEvents  = useMemo(() => buildDayEvents(movements, selectedDate), [movements, selectedDate]);

  const missingRecords = useMemo(
    () => movements.filter((m) => m.movementType === 'MISSING').sort((a, b) => new Date(b.date) - new Date(a.date)),
    [movements]
  );

  const damageRecords = useMemo(
    () => movements.filter((m) => m.movementType === 'DAMAGE').sort((a, b) => new Date(b.date) - new Date(a.date)),
    [movements]
  );

  const rows = useMemo(() => Object.keys(PRODUCT_NAMES).map((sku) => ({
    sku,
    name:    PRODUCT_NAMES[sku],
    opening: openingMap[sku] ?? 0,
    current: snapshot[sku]   ?? 0,
    returns: returnMap[sku]  ?? 0,
    damage:  damageMap[sku]  ?? 0,
    missing: missingMap[sku] ?? 0,
    net: (snapshot[sku] ?? 0) - (damageMap[sku] ?? 0) - (missingMap[sku] ?? 0),
  })).sort((a, b) => a.name.localeCompare(b.name, 'ar')), [snapshot, openingMap, returnMap, damageMap, missingMap]);

  const stats = useMemo(() => ({
    total:          rows.reduce((a, b) => a + b.net, 0),
    low:            rows.filter((r) => r.net > 0 && r.net <= 20).length,
    zero:           rows.filter((r) => r.net <= 0).length,
    damage:         rows.reduce((a, b) => a + b.damage, 0),
    missing:        rows.reduce((a, b) => a + b.missing, 0),
    returns:        rows.reduce((a, b) => a + b.returns, 0),
    pendingMissing: missingRecords.filter((m) => m.status !== 'compensated').length,
  }), [rows, missingRecords]);

  const today = new Date().toISOString().slice(0, 10);
  const showMsg = (t) => { setMsg(t); setTimeout(() => setMsg(''), 3000); };

  const handleSaveDamage = async () => {
    if (!damageEntry.sku || !damageEntry.qty) return;
    setSaving(true);
    try {
      await addDoc(stockMovementsCol(), {
        sku: damageEntry.sku, movementType: 'DAMAGE',
        qty: -Math.abs(parseInt(damageEntry.qty)),
        note: damageEntry.note, source: 'Manual',
        date: damageEntry.date ? new Date(damageEntry.date + 'T12:00:00').toISOString() : new Date().toISOString(),
        createdAt: new Date().toISOString(),
      });
      showMsg('تم حفظ الدامج ✅');
      setDamageEntry({ sku: '', qty: '', note: '', date: '' });
      setActiveForm(null);
    } catch { showMsg('حدث خطأ ❌'); } finally { setSaving(false); }
  };

  const handleSaveMissing = async () => {
    if (!missingEntry.sku || !missingEntry.qty) return;
    setSaving(true);
    try {
      await addDoc(stockMovementsCol(), {
        sku: missingEntry.sku, movementType: 'MISSING',
        qty: -Math.abs(parseInt(missingEntry.qty)),
        awb: missingEntry.awb, note: missingEntry.note,
        status: 'pending', source: 'Manual',
        date: missingEntry.date ? new Date(missingEntry.date + 'T12:00:00').toISOString() : new Date().toISOString(),
        createdAt: new Date().toISOString(),
      });
      showMsg('تم تسجيل المفقود ✅');
      setMissingEntry({ sku: '', qty: '', awb: '', note: '', date: '' });
      setActiveForm(null);
    } catch { showMsg('حدث خطأ ❌'); } finally { setSaving(false); }
  };

  const handleCompensate = async (id) => {
    if (!compensationAmount) return;
    try {
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'stock_movements', id), {
        status: 'compensated',
        compensationAmount: parseFloat(compensationAmount),
        compensatedAt: new Date().toISOString(),
      });
      showMsg('تم تسجيل التعويض ✅');
      setCompensatingId(null); setCompensationAmount('');
    } catch { showMsg('حدث خطأ ❌'); }
  };

  return (
    <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-8" dir="rtl">

      {/* Header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <PackageOpen className="text-indigo-600" size={28} />
          <div>
            <h2 className="text-2xl font-black text-slate-800">المخزون</h2>
            <p className="text-slate-400 text-xs mt-0.5">
              {selectedDate ? `📅 Time Machine — ${selectedDate}` : 'المخزون الحالي — Between Fulfillment'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {msg && <span className="text-sm font-bold text-emerald-600">{msg}</span>}
          <button onClick={() => exportCSV(rows, missingRecords)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200 transition-all">
            <Download size={15} /> تصدير
          </button>
          <button onClick={() => setShowDashboard(!showDashboard)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 transition-all">
            <BarChart2 size={15} /> داشبورد الخسائر
            {showDashboard ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
          <button onClick={() => setActiveForm(activeForm === 'damage' ? null : 'damage')}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 transition-all">
            <Plus size={15} /> تسجيل دامج
          </button>
          <button onClick={() => setActiveForm(activeForm === 'missing' ? null : 'missing')}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200 transition-all">
            <Plus size={15} /> تسجيل مفقود
          </button>
        </div>
      </div>

      {/* Time Machine */}
      <div className="bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 mb-6 flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2 text-slate-600">
          <Clock size={16} />
          <span className="text-sm font-black">عرض المخزون في تاريخ:</span>
        </div>
        <input type="date" max={today} value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
        {selectedDate && (
          <button onClick={() => setSelectedDate('')}
            className="flex items-center gap-1 text-sm font-bold text-slate-400 hover:text-slate-600">
            <X size={14} /> عرض الحالي
          </button>
        )}
        {selectedDate && (
          <span className="bg-indigo-100 text-indigo-700 text-xs font-black px-3 py-1 rounded-lg">
            المخزون كما كان في {selectedDate}
          </span>
        )}
      </div>

      {/* أحداث اليوم المختار */}
      {selectedDate && (dayEvents.damage.length > 0 || dayEvents.missing.length > 0 || dayEvents.returns.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {[
            { title: `دامج في ${selectedDate}`,      items: dayEvents.damage,  color: 'rose',  sign: '-' },
            { title: `مفقودات في ${selectedDate}`,   items: dayEvents.missing, color: 'amber', sign: '-' },
            { title: `مرتجعات في ${selectedDate}`,   items: dayEvents.returns, color: 'blue',  sign: '+' },
          ].map(({ title, items, color, sign }) => (
            <div key={title} className={`bg-${color}-50 border border-${color}-200 rounded-2xl p-4`}>
              <p className={`text-xs font-black text-${color}-600 mb-3 flex items-center gap-1`}>
                <AlertTriangle size={13} /> {title}
              </p>
              {items.length === 0
                ? <p className="text-xs text-slate-400">لا يوجد</p>
                : items.map((m) => (
                  <div key={m.sku} className="flex justify-between text-xs font-bold mb-1">
                    <span className="text-slate-600">{PRODUCT_NAMES[m.sku] || m.sku}</span>
                    <span className={`text-${color}-600`}>{sign}{m.qty}</span>
                  </div>
                ))}
            </div>
          ))}
        </div>
      )}

      {/* نموذج الدامج */}
      {activeForm === 'damage' && (
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-5 mb-6">
          <p className="text-rose-800 font-black text-sm mb-4 flex items-center gap-2">
            <AlertTriangle size={16} /> تسجيل دامج يدوي
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { label: 'المنتج', el: (
                <select value={damageEntry.sku} onChange={(e) => setDamageEntry({ ...damageEntry, sku: e.target.value })}
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-rose-300">
                  <option value="">اختر المنتج</option>
                  {Object.entries(PRODUCT_NAMES).map(([s, n]) => <option key={s} value={s}>{n} ({s})</option>)}
                </select>
              )},
              { label: 'الكمية التالفة', el: (
                <input type="number" min="1" value={damageEntry.qty}
                  onChange={(e) => setDamageEntry({ ...damageEntry, qty: e.target.value })}
                  placeholder="مثال: 2"
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-rose-300" />
              )},
              { label: 'تاريخ التلف (اختياري)', el: (
                <input type="date" max={today} value={damageEntry.date}
                  onChange={(e) => setDamageEntry({ ...damageEntry, date: e.target.value })}
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-rose-300" />
              )},
              { label: 'السبب', el: (
                <div className="flex flex-col gap-2">
                  <select
                    value={DAMAGE_REASONS.includes(damageEntry.note) || damageEntry.note === '' ? damageEntry.note : 'أخرى'}
                    onChange={(e) => setDamageEntry({ ...damageEntry, note: e.target.value === 'أخرى' ? '' : e.target.value })}
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-rose-300">
                    <option value="">اختر السبب</option>
                    {DAMAGE_REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
                    <option value="أخرى">أخرى (كتابة حرة)</option>
                  </select>
                  {!DAMAGE_REASONS.includes(damageEntry.note) && damageEntry.note !== '' && (
                    <input type="text" value={damageEntry.note}
                      onChange={(e) => setDamageEntry({ ...damageEntry, note: e.target.value })}
                      placeholder="اكتب السبب..."
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-rose-300" />
                  )}
                </div>
              )},
            ].map(({ label, el }) => (
              <div key={label}><label className="text-xs font-black text-slate-500 mb-1 block">{label}</label>{el}</div>
            ))}
          </div>
          <div className="flex gap-2 mt-4 justify-end">
            <button onClick={() => setActiveForm(null)} className="px-4 py-2 rounded-xl font-bold text-slate-500 hover:bg-slate-100 text-sm">إلغاء</button>
            <button onClick={handleSaveDamage} disabled={!damageEntry.sku || !damageEntry.qty || saving}
              className={`flex items-center gap-2 px-5 py-2 rounded-xl font-bold text-sm transition-all ${damageEntry.sku && damageEntry.qty && !saving ? 'bg-rose-600 hover:bg-rose-700 text-white' : 'bg-slate-100 text-slate-400 cursor-not-allowed'}`}>
              <Save size={14} /> {saving ? 'جاري الحفظ...' : 'حفظ الدامج'}
            </button>
          </div>
        </div>
      )}

      {/* نموذج المفقود */}
      {activeForm === 'missing' && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 mb-6">
          <p className="text-amber-800 font-black text-sm mb-4 flex items-center gap-2">
            <AlertTriangle size={16} /> تسجيل مفقود من شركة الشحن
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {[
              { label: 'المنتج', el: (
                <select value={missingEntry.sku} onChange={(e) => setMissingEntry({ ...missingEntry, sku: e.target.value })}
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-amber-300">
                  <option value="">اختر المنتج</option>
                  {Object.entries(PRODUCT_NAMES).map(([s, n]) => <option key={s} value={s}>{n} ({s})</option>)}
                </select>
              )},
              { label: 'الكمية المفقودة', el: (
                <input type="number" min="1" value={missingEntry.qty}
                  onChange={(e) => setMissingEntry({ ...missingEntry, qty: e.target.value })}
                  placeholder="مثال: 1"
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-amber-300" />
              )},
              { label: 'رقم AWB شركة الشحن', el: (
                <input type="text" value={missingEntry.awb}
                  onChange={(e) => setMissingEntry({ ...missingEntry, awb: e.target.value })}
                  placeholder="رقم الشحنة"
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-amber-300" />
              )},
              { label: 'تاريخ الاكتشاف (اختياري)', el: (
                <input type="date" max={today} value={missingEntry.date}
                  onChange={(e) => setMissingEntry({ ...missingEntry, date: e.target.value })}
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-300" />
              )},
              { label: 'ملاحظات', el: (
                <input type="text" value={missingEntry.note}
                  onChange={(e) => setMissingEntry({ ...missingEntry, note: e.target.value })}
                  placeholder="مثال: مرتجع ناقص منتج"
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-amber-300" />
              )},
            ].map(({ label, el }) => (
              <div key={label}><label className="text-xs font-black text-slate-500 mb-1 block">{label}</label>{el}</div>
            ))}
          </div>
          <div className="flex gap-2 mt-4 justify-end">
            <button onClick={() => setActiveForm(null)} className="px-4 py-2 rounded-xl font-bold text-slate-500 hover:bg-slate-100 text-sm">إلغاء</button>
            <button onClick={handleSaveMissing} disabled={!missingEntry.sku || !missingEntry.qty || saving}
              className={`flex items-center gap-2 px-5 py-2 rounded-xl font-bold text-sm transition-all ${missingEntry.sku && missingEntry.qty && !saving ? 'bg-amber-600 hover:bg-amber-700 text-white' : 'bg-slate-100 text-slate-400 cursor-not-allowed'}`}>
              <Save size={14} /> {saving ? 'جاري الحفظ...' : 'حفظ المفقود'}
            </button>
          </div>
        </div>
      )}

      {/* داشبورد الخسائر */}
      {showDashboard && (
        <div className="border border-slate-200 rounded-2xl p-6 mb-6 bg-slate-50">
          <h3 className="font-black text-slate-700 mb-5 flex items-center gap-2">
            <BarChart2 size={18} className="text-indigo-600" /> داشبورد الدامج والمفقودات
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            {[
              { label: 'إجمالي الدامج',    value: stats.damage,         sub: 'وحدة تالفة',     color: 'rose' },
              { label: 'إجمالي المفقودات', value: stats.missing,        sub: 'وحدة مفقودة',    color: 'amber' },
              { label: 'بانتظار التعويض',  value: stats.pendingMissing, sub: 'حالة لم تُسوَّ', color: 'amber' },
              {
                label: 'تم التعويض',
                value: missingRecords.filter((m) => m.status === 'compensated').length,
                sub: missingRecords.filter((m) => m.status === 'compensated')
                  .reduce((a, b) => a + (b.compensationAmount || 0), 0).toLocaleString() + ' ريال',
                color: 'emerald',
              },
            ].map(({ label, value, sub, color }) => (
              <div key={label} className={`bg-white rounded-2xl p-4 border border-${color}-100`}>
                <p className={`text-xs font-black text-${color}-500 mb-1`}>{label}</p>
                <p className={`text-2xl font-black text-${color}-600`}>{value}</p>
                <p className="text-xs text-slate-400 mt-1">{sub}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

            {/* سجل الدامج مع تعديل */}
            <div>
              <p className="text-xs font-black text-rose-500 mb-3">سجل الدامج</p>
              {/* فلتر الملاحظات */}
              {(() => {
                const allNotes = [...new Set(damageRecords.map((m) => m.note).filter(Boolean))];
                const filtered = activeDamageNote
                  ? damageRecords.filter((m) => m.note === activeDamageNote)
                  : damageRecords;
                return (
                  <>
                    {allNotes.length > 0 && (
                      <div className="flex flex-wrap gap-2 mb-3">
                        <button onClick={() => setActiveDamageNote('')}
                          className={`text-xs font-black px-3 py-1 rounded-lg transition-all ${!activeDamageNote ? 'bg-rose-600 text-white' : 'bg-rose-50 text-rose-600 hover:bg-rose-100'}`}>
                          الكل
                        </button>
                        {allNotes.map((note) => (
                          <button key={note}
                            onClick={() => setActiveDamageNote(activeDamageNote === note ? '' : note)}
                            className={`text-xs font-black px-3 py-1 rounded-lg transition-all ${activeDamageNote === note ? 'bg-rose-600 text-white' : 'bg-rose-50 text-rose-600 hover:bg-rose-100'}`}>
                            {note}
                          </button>
                        ))}
                      </div>
                    )}
                    <div className="space-y-2 max-h-72 overflow-y-auto">
                      {filtered.length === 0 && <p className="text-xs text-slate-400">لا يوجد دامج مسجّل</p>}
                      {filtered.map((m) => (
                        <DamageRecord key={m.id} m={m} showMsg={showMsg} />
                      ))}
                    </div>
                  </>
                );
              })()}
            </div>

            {/* سجل المفقودات */}
            <div>
              <p className="text-xs font-black text-amber-500 mb-3">سجل المفقودات</p>
              <div className="space-y-2 max-h-72 overflow-y-auto">
                {missingRecords.length === 0 && <p className="text-xs text-slate-400">لا يوجد مفقودات مسجّلة</p>}
                {missingRecords.map((m) => (
                  <div key={m.id} className={`bg-white rounded-xl px-4 py-3 border ${m.status === 'compensated' ? 'border-emerald-100' : 'border-amber-100'}`}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-black text-slate-700">{PRODUCT_NAMES[m.sku] || m.sku}</span>
                      <span className={`text-xs font-black px-2 py-0.5 rounded-lg ${m.status === 'compensated' ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'}`}>
                        {m.status === 'compensated' ? '✅ تم التعويض' : '⏳ بانتظار التعويض'}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-slate-400">
                      <span>{m.date?.slice(0,10)}</span>
                      {m.awb && <span>AWB: {m.awb}</span>}
                      <span className="text-amber-600 font-bold">-{Math.abs(m.qty)} وحدة</span>
                      {m.compensationAmount && <span className="text-emerald-600 font-bold">{m.compensationAmount} ريال</span>}
                    </div>
                    {m.note && <p className="text-xs text-slate-400 mt-1">{m.note}</p>}
                    {m.status !== 'compensated' && (
                      compensatingId === m.id ? (
                        <div className="flex gap-2 mt-2">
                          <input type="number" value={compensationAmount}
                            onChange={(e) => setCompensationAmount(e.target.value)}
                            placeholder="مبلغ التعويض (ريال)"
                            className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-emerald-300" />
                          <button onClick={() => handleCompensate(m.id)}
                            className="bg-emerald-600 text-white text-xs font-black px-3 py-1.5 rounded-lg hover:bg-emerald-700">تأكيد</button>
                          <button onClick={() => { setCompensatingId(null); setCompensationAmount(''); }}
                            className="text-slate-400 text-xs font-bold px-2 hover:text-slate-600"><X size={14} /></button>
                        </div>
                      ) : (
                        <button onClick={() => setCompensatingId(m.id)}
                          className="mt-2 flex items-center gap-1 text-xs font-black text-emerald-600 hover:text-emerald-700">
                          <CheckCircle size={13} /> تسجيل تعويض
                        </button>
                      )
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Loading */}
      {loading ? (
        <div className="flex items-center justify-center py-16 gap-3 text-slate-400">
          <RefreshCw size={20} className="animate-spin" />
          <span className="font-bold text-sm">جاري تحميل المخزون...</span>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
            {[
              { label: 'إجمالي الصافي', value: stats.total.toLocaleString(), color: 'text-slate-800' },
              { label: 'منخفض (≤20)',   value: stats.low,                    color: 'text-orange-600' },
              { label: 'نافد',          value: stats.zero,                   color: 'text-rose-600' },
              { label: 'المرتجعات',     value: stats.returns.toLocaleString(), color: 'text-blue-600' },
              { label: 'الدامج',        value: stats.damage,                 color: 'text-rose-400' },
              { label: 'المفقودات',     value: stats.missing,                color: 'text-amber-600' },
            ].map((s) => (
              <div key={s.label} className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
                <p className="text-xs font-black text-slate-400 mb-2">{s.label}</p>
                <h3 className={`text-2xl font-black ${s.color}`}>{s.value}</h3>
              </div>
            ))}
          </div>

          <div className="bg-slate-50 rounded-2xl border border-slate-100 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-100 text-slate-600">
                <tr>
                  {['SKU','اسم المنتج','الافتتاحي','المخزون الحالي','المرتجعات','الدامج','المفقودات','الصافي المتاح'].map((h) => (
                    <th key={h} className="p-3 text-right font-black whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.sku} className="border-t hover:bg-white transition-colors">
                    <td className="p-3 font-mono text-xs text-slate-500">{row.sku}</td>
                    <td className="p-3 font-bold text-slate-700 whitespace-nowrap">{row.name}</td>
                    <td className="p-3 font-bold text-slate-400">{row.opening > 0 ? row.opening.toLocaleString() : '—'}</td>
                    <td className="p-3 font-bold text-slate-600">{row.current.toLocaleString()}</td>
                    <td className="p-3">
                      {row.returns > 0 ? <span className="bg-blue-50 text-blue-600 font-black px-2 py-0.5 rounded-lg text-xs">+{row.returns}</span> : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="p-3">
                      {row.damage > 0 ? <span className="bg-rose-50 text-rose-600 font-black px-2 py-0.5 rounded-lg text-xs">-{row.damage}</span> : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="p-3">
                      {row.missing > 0 ? <span className="bg-amber-50 text-amber-600 font-black px-2 py-0.5 rounded-lg text-xs">-{row.missing}</span> : <span className="text-slate-300">—</span>}
                    </td>
                    <td className={`p-3 font-black text-lg ${row.net <= 0 ? 'text-rose-600' : row.net <= 20 ? 'text-orange-600' : 'text-emerald-600'}`}>
                      {row.net}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-slate-400 font-bold mt-4 text-center">
            {selectedDate ? `📅 المخزون كما كان بتاريخ ${selectedDate}` : 'المخزون الحالي — Between Fulfillment'}
          </p>
        </>
      )}
    </div>
  );
}
