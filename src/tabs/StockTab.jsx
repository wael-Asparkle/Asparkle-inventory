import React, { useEffect, useState, useMemo } from 'react';
import { PackageOpen, RefreshCw, Clock, AlertTriangle, Save, X, Plus } from 'lucide-react';
import { collection, onSnapshot, addDoc } from 'firebase/firestore';
import { db, appId } from '../config/firebase';

// ── Firebase ──────────────────────────────────────────────────
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

// ── بناء Snapshot حتى تاريخ معين ─────────────────────────────
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
      case 'ADD':    stock[m.sku] += Math.abs(m.qty); break;
      case 'SALE':   stock[m.sku] -= Math.abs(m.qty); break;
      case 'RETURN': stock[m.sku] += Math.abs(m.qty); break;
      case 'UPDATE': stock[m.sku] += m.qty; break;
      case 'DAMAGE': stock[m.sku] -= Math.abs(m.qty); break;
    }
  });

  return stock;
}

// ── حساب الدامج لكل SKU ───────────────────────────────────────
function buildDamageMap(movements, beforeDate) {
  const filtered = beforeDate
    ? movements.filter((m) => m.date && m.date <= beforeDate + 'T23:59:59')
    : movements;

  const damage = {};
  filtered
    .filter((m) => m.movementType === 'DAMAGE')
    .forEach((m) => {
      damage[m.sku] = (damage[m.sku] || 0) + Math.abs(m.qty);
    });
  return damage;
}

// ════════════════════════════════════════════════════════════
export default function StockTab() {
  const [movements, setMovements]       = useState([]);
  const [loading, setLoading]           = useState(true);
  const [selectedDate, setSelectedDate] = useState('');
  const [showDamageForm, setShowDamageForm] = useState(false);
  const [damageEntry, setDamageEntry]   = useState({ sku: '', qty: '', note: '' });
  const [savingDamage, setSavingDamage] = useState(false);
  const [damageMsg, setDamageMsg]       = useState('');

  useEffect(() => {
    const unsub = onSnapshot(stockMovementsCol(), (snap) => {
      setMovements(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const snapshot  = useMemo(() => buildSnapshotAtDate(movements, selectedDate), [movements, selectedDate]);
  const damageMap = useMemo(() => buildDamageMap(movements, selectedDate),      [movements, selectedDate]);

  const rows = useMemo(() => {
    return Object.keys(PRODUCT_NAMES).map((sku) => {
      const current = snapshot[sku] ?? 0;
      const damage  = damageMap[sku] ?? 0;
      return { sku, name: PRODUCT_NAMES[sku], current, damage, net: current - damage };
    }).sort((a, b) => a.name.localeCompare(b.name, 'ar'));
  }, [snapshot, damageMap]);

  const stats = useMemo(() => ({
    total:  rows.reduce((a, b) => a + b.net, 0),
    low:    rows.filter((r) => r.net > 0 && r.net <= 20).length,
    zero:   rows.filter((r) => r.net <= 0).length,
    damage: rows.reduce((a, b) => a + b.damage, 0),
  }), [rows]);

  const handleSaveDamage = async () => {
    if (!damageEntry.sku || !damageEntry.qty) return;
    setSavingDamage(true);
    try {
      await addDoc(stockMovementsCol(), {
        sku:          damageEntry.sku,
        movementType: 'DAMAGE',
        qty:          -Math.abs(parseInt(damageEntry.qty)),
        newQty:       null,
        previousQty:  null,
        note:         damageEntry.note,
        source:       'Manual',
        date:         new Date().toISOString(),
        createdAt:    new Date().toISOString(),
      });
      setDamageMsg('تم حفظ الدامج ✅');
      setDamageEntry({ sku: '', qty: '', note: '' });
      setShowDamageForm(false);
      setTimeout(() => setDamageMsg(''), 3000);
    } catch (err) {
      console.error(err);
      setDamageMsg('حدث خطأ ❌');
    } finally {
      setSavingDamage(false);
    }
  };

  const today = new Date().toISOString().slice(0, 10);

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
          {damageMsg && <span className="text-sm font-bold text-emerald-600">{damageMsg}</span>}
          <button onClick={() => setShowDamageForm(!showDamageForm)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold bg-rose-50 text-rose-700 hover:bg-rose-100 transition-all border border-rose-200">
            <Plus size={15} /> تسجيل دامج
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

      {/* نموذج الدامج */}
      {showDamageForm && (
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-5 mb-6">
          <p className="text-rose-800 font-black text-sm mb-4 flex items-center gap-2">
            <AlertTriangle size={16} /> تسجيل دامج يدوي
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-black text-slate-500 mb-1 block">المنتج</label>
              <select value={damageEntry.sku}
                onChange={(e) => setDamageEntry({ ...damageEntry, sku: e.target.value })}
                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-rose-300">
                <option value="">اختر المنتج</option>
                {Object.entries(PRODUCT_NAMES).map(([sku, name]) => (
                  <option key={sku} value={sku}>{name} ({sku})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-black text-slate-500 mb-1 block">الكمية التالفة</label>
              <input type="number" min="1" value={damageEntry.qty}
                onChange={(e) => setDamageEntry({ ...damageEntry, qty: e.target.value })}
                placeholder="مثال: 2"
                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-rose-300" />
            </div>
            <div>
              <label className="text-xs font-black text-slate-500 mb-1 block">السبب</label>
              <input type="text" value={damageEntry.note}
                onChange={(e) => setDamageEntry({ ...damageEntry, note: e.target.value })}
                placeholder="مثال: مكسور أثناء الشحن"
                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-rose-300" />
            </div>
          </div>
          <div className="flex gap-2 mt-4 justify-end">
            <button onClick={() => setShowDamageForm(false)}
              className="px-4 py-2 rounded-xl font-bold text-slate-500 hover:bg-slate-100 text-sm">إلغاء</button>
            <button onClick={handleSaveDamage}
              disabled={!damageEntry.sku || !damageEntry.qty || savingDamage}
              className={`flex items-center gap-2 px-5 py-2 rounded-xl font-bold text-sm transition-all ${
                damageEntry.sku && damageEntry.qty && !savingDamage
                  ? 'bg-rose-600 hover:bg-rose-700 text-white'
                  : 'bg-slate-100 text-slate-400 cursor-not-allowed'}`}>
              <Save size={14} />
              {savingDamage ? 'جاري الحفظ...' : 'حفظ الدامج'}
            </button>
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
          {/* إحصائيات */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100">
              <p className="text-xs font-black text-slate-400 mb-2">إجمالي الصافي</p>
              <h3 className="text-2xl font-black text-slate-800">{stats.total.toLocaleString()}</h3>
            </div>
            <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100">
              <p className="text-xs font-black text-slate-400 mb-2">منخفض (≤20)</p>
              <h3 className="text-2xl font-black text-orange-600">{stats.low}</h3>
            </div>
            <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100">
              <p className="text-xs font-black text-slate-400 mb-2">نافد</p>
              <h3 className="text-2xl font-black text-rose-600">{stats.zero}</h3>
            </div>
            <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100">
              <p className="text-xs font-black text-slate-400 mb-2">إجمالي الدامج</p>
              <h3 className="text-2xl font-black text-rose-400">{stats.damage}</h3>
            </div>
          </div>

          {/* جدول */}
          <div className="bg-slate-50 rounded-2xl border border-slate-100 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-100 text-slate-600">
                <tr>
                  <th className="p-3 text-right font-black">SKU</th>
                  <th className="p-3 text-right font-black">اسم المنتج</th>
                  <th className="p-3 text-right font-black">المخزون الحالي</th>
                  <th className="p-3 text-right font-black">الدامج</th>
                  <th className="p-3 text-right font-black">الصافي المتاح</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.sku} className="border-t hover:bg-white transition-colors">
                    <td className="p-3 font-mono text-xs text-slate-500">{row.sku}</td>
                    <td className="p-3 font-bold text-slate-700">{row.name}</td>
                    <td className="p-3 font-bold text-slate-600">{row.current}</td>
                    <td className="p-3">
                      {row.damage > 0
                        ? <span className="bg-rose-50 text-rose-600 font-black px-2 py-0.5 rounded-lg text-xs">-{row.damage}</span>
                        : <span className="text-slate-300 font-bold">—</span>}
                    </td>
                    <td className={`p-3 font-black text-lg ${
                      row.net <= 0 ? 'text-rose-600' : row.net <= 20 ? 'text-orange-600' : 'text-emerald-600'
                    }`}>{row.net}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-slate-400 font-bold mt-4 text-center">
            {selectedDate ? `📅 المخزون كما كان بتاريخ ${selectedDate}` : 'المخزون الحالي — Latest NewQuantity Wins من Between'}
          </p>
        </>
      )}
    </div>
  );
}
