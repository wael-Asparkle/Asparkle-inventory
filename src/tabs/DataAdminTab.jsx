import React from 'react';
import { ShieldAlert } from 'lucide-react';
import { db, appId } from '../config/firebase';
import {
  collection,
  getDocs,
  deleteDoc,
  doc,
  updateDoc,
  getDoc,
} from 'firebase/firestore';

export default function DataAdminTab() {
  // 🧹 حذف أي كولكشن كاملاً
  const deleteCollectionItems = async (collectionName, label) => {
    const confirmed = window.confirm(`هل أنت متأكد من حذف ${label}؟`);
    if (!confirmed) return;

    try {
      const targetCollection = collection(db, 'artifacts', appId, 'public', 'data', collectionName);
      const snapshot = await getDocs(targetCollection);

      if (snapshot.empty) {
        alert(`لا توجد بيانات في ${label}`);
        return;
      }

      await Promise.all(
        snapshot.docs.map((d) =>
          deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', collectionName, d.id))
        )
      );

      alert(`تم حذف ${label} بنجاح ✅`);
      window.location.reload();
    } catch (error) {
      console.error('Delete error:', error);
      alert('حدث خطأ أثناء الحذف ❌');
    }
  };

  // 🔄 حذف حركات بتوين فقط (ADD, SALE, RETURN, UPDATE) — يبقى DAMAGE و MISSING
  const deleteBetweenMovementsOnly = async () => {
    const confirmed = window.confirm(
      'سيتم حذف حركات بتوين فقط (ADD / SALE / RETURN / UPDATE)\n\nسجلات الدامج والمفقودات لن تُحذف ✅\n\nهل أنت متأكد؟'
    );
    if (!confirmed) return;

    const BETWEEN_TYPES = ['ADD', 'SALE', 'RETURN', 'UPDATE'];

    try {
      const snapshot = await getDocs(
        collection(db, 'artifacts', appId, 'public', 'data', 'stock_movements')
      );

      if (snapshot.empty) {
        alert('لا توجد حركات مخزون');
        return;
      }

      const toDelete = snapshot.docs.filter((d) =>
        BETWEEN_TYPES.includes(d.data().movementType)
      );

      if (toDelete.length === 0) {
        alert('لا توجد حركات بتوين للحذف');
        return;
      }

      await Promise.all(
        toDelete.map((d) =>
          deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'stock_movements', d.id))
        )
      );

      alert(`تم حذف ${toDelete.length} حركة بتوين ✅\nسجلات الدامج والمفقودات محفوظة`);
      window.location.reload();
    } catch (error) {
      console.error('Delete error:', error);
      alert('حدث خطأ أثناء الحذف ❌');
    }
  };

  // 🔄 تصفير المخزون الافتتاحي
  const resetOpeningStock = async () => {
    const confirmed = window.confirm('هل أنت متأكد من تصفير المخزون الافتتاحي؟');
    if (!confirmed) return;

    try {
      const definitionsRef = doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'definitions');
      const definitionsSnap = await getDoc(definitionsRef);

      if (!definitionsSnap.exists()) {
        alert('لا توجد بيانات منتجات ❌');
        return;
      }

      const data = definitionsSnap.data();
      const products = data.productDetails || {};
      const updated = {};

      Object.keys(products).forEach((sku) => {
        updated[sku] = { ...products[sku], openingStock: 0 };
      });

      await updateDoc(definitionsRef, { productDetails: updated });

      alert('تم تصفير المخزون بنجاح ✅');
      window.location.reload();
    } catch (error) {
      console.error(error);
      alert('حدث خطأ أثناء التصفير ❌');
    }
  };

  return (
    <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-8" dir="rtl">
      <div className="flex items-center gap-3 mb-4">
        <ShieldAlert className="text-rose-600" size={28} />
        <h2 className="text-2xl font-black text-slate-800">إدارة البيانات</h2>
      </div>

      <p className="text-slate-500 text-sm leading-7 mb-8">
        هذا القسم مخصص لإعادة ضبط النظام (حذف البيانات + تصفير المخزون).
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* ── حركات بتوين فقط ── */}
        <button
          onClick={deleteBetweenMovementsOnly}
          className="flex flex-col items-center justify-center gap-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-5 rounded-2xl md:col-span-2"
        >
          <span className="text-base">حذف حركات بتوين فقط</span>
          <span className="text-xs font-normal opacity-80">
            يحذف ADD / SALE / RETURN / UPDATE — يبقى الدامج والمفقودات ✅
          </span>
        </button>

        {/* ── حذف كامل لـ stock_movements ── */}
        <button
          onClick={() => deleteCollectionItems('stock_movements', 'حركات المخزون الكاملة (بما فيها الدامج والمفقود)')}
          className="flex flex-col items-center justify-center gap-1 bg-slate-600 hover:bg-slate-700 text-white font-bold py-5 rounded-2xl"
        >
          <span className="text-base">حذف كل حركات المخزون</span>
          <span className="text-xs font-normal opacity-80">يشمل الدامج والمفقودات ⚠️</span>
        </button>

        <button
          onClick={() => deleteCollectionItems('stock_snapshot', 'Stock Snapshot')}
          className="bg-slate-600 hover:bg-slate-700 text-white font-bold py-4 rounded-2xl"
        >
          حذف Stock Snapshot
        </button>

        <button
          onClick={() => deleteCollectionItems('orders', 'الطلبات')}
          className="bg-orange-600 hover:bg-orange-700 text-white font-bold py-4 rounded-2xl"
        >
          حذف الطلبات
        </button>

        <button
          onClick={() => deleteCollectionItems('movements', 'الحركات')}
          className="bg-rose-600 hover:bg-rose-700 text-white font-bold py-4 rounded-2xl"
        >
          حذف الحركات
        </button>

        <button
          onClick={() => deleteCollectionItems('cs_returns', 'مرتجعات خدمة العملاء')}
          className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-4 rounded-2xl"
        >
          حذف مرتجعات CS
        </button>

        <button
          onClick={resetOpeningStock}
          className="bg-rose-700 hover:bg-rose-800 text-white font-bold py-4 rounded-2xl md:col-span-2"
        >
          تصفير المخزون الافتتاحي
        </button>

      </div>
    </div>
  );
}
