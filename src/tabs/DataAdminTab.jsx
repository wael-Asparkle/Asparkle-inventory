import React, { useState } from 'react';
import { ShieldAlert } from 'lucide-react';
import { db, appId } from '../config/firebase';
import {
  collection,
  getDocs,
  writeBatch,
} from 'firebase/firestore';

const EMPTY_DELETE_PROGRESS = {
  isDeleting: false,
  label: '',
  total: 0,
  deleted: 0,
  percent: 0,
  status: '',
};

export default function DataAdminTab() {
  const [deleteProgress, setDeleteProgress] = useState(EMPTY_DELETE_PROGRESS);

  const prepareDeleteProgress = (label) => {
    setDeleteProgress({
      isDeleting: true,
      label,
      total: 0,
      deleted: 0,
      percent: 0,
      status: 'جاري تجهيز البيانات...',
    });
  };

  const finishDeleteProgress = (label, total) => {
    setDeleteProgress({
      isDeleting: false,
      label,
      total,
      deleted: total,
      percent: 100,
      status: 'اكتمل الحذف',
    });
  };

  const resetDeleteProgress = () => {
    setDeleteProgress(EMPTY_DELETE_PROGRESS);
  };

  // 🧹 حذف السجلات على دفعات مع تحديث شريط التقدم
  const deleteDocsWithProgress = async (docsToDelete, label) => {
    const total = docsToDelete.length;
    const batchSize = 50;
    let deleted = 0;

    setDeleteProgress({
      isDeleting: true,
      label,
      total,
      deleted: 0,
      percent: 0,
      status: 'جاري الحذف...',
    });

    for (let i = 0; i < docsToDelete.length; i += batchSize) {
      const batch = writeBatch(db);
      const currentBatch = docsToDelete.slice(i, i + batchSize);

      currentBatch.forEach((documentSnapshot) => {
        batch.delete(documentSnapshot.ref);
      });

      await batch.commit();

      deleted += currentBatch.length;
      setDeleteProgress({
        isDeleting: true,
        label,
        total,
        deleted,
        percent: Math.round((deleted / total) * 100),
        status: 'جاري الحذف...',
      });
    }

    finishDeleteProgress(label, total);
  };

  // 🧹 حذف أي كولكشن كاملاً
  const deleteCollectionItems = async (collectionName, label) => {
    const confirmed = window.confirm(`هل أنت متأكد من حذف ${label}؟`);
    if (!confirmed) return;

    prepareDeleteProgress(label);

    try {
      const targetCollection = collection(db, 'artifacts', appId, 'public', 'data', collectionName);
      const snapshot = await getDocs(targetCollection);

      if (snapshot.empty) {
        resetDeleteProgress();
        alert(`لا توجد بيانات في ${label}`);
        return;
      }

      await deleteDocsWithProgress(snapshot.docs, label);

      alert(`تم حذف ${label} بنجاح ✅`);
      window.location.reload();
    } catch (error) {
      console.error('Delete error:', error);
      resetDeleteProgress();
      alert('حدث خطأ أثناء الحذف ❌');
    }
  };

  // 🔄 حذف حركات بتوين فقط (ADD, SALE, RETURN, UPDATE) — يبقى DAMAGE و MISSING
  const deleteBetweenMovementsOnly = async () => {
    const confirmed = window.confirm(
      'سيتم حذف حركات بتوين فقط (ADD / SALE / RETURN / UPDATE)\n\nسجلات الدامج والمفقودات لن تُحذف ✅\n\nهل أنت متأكد؟'
    );
    if (!confirmed) return;

    const label = 'حركات بتوين فقط';
    const BETWEEN_TYPES = ['ADD', 'SALE', 'RETURN', 'UPDATE'];

    prepareDeleteProgress(label);

    try {
      const snapshot = await getDocs(
        collection(db, 'artifacts', appId, 'public', 'data', 'stock_movements')
      );

      if (snapshot.empty) {
        resetDeleteProgress();
        alert('لا توجد حركات مخزون');
        return;
      }

      const toDelete = snapshot.docs.filter((d) =>
        BETWEEN_TYPES.includes(d.data().movementType)
      );

      if (toDelete.length === 0) {
        resetDeleteProgress();
        alert('لا توجد حركات بتوين للحذف');
        return;
      }

      await deleteDocsWithProgress(toDelete, label);

      alert(`تم حذف ${toDelete.length} حركة بتوين ✅\nسجلات الدامج والمفقودات محفوظة`);
      window.location.reload();
    } catch (error) {
      console.error('Delete error:', error);
      resetDeleteProgress();
      alert('حدث خطأ أثناء الحذف ❌');
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

      {deleteProgress.isDeleting && (
        <div className="mb-6 rounded-2xl border border-orange-200 bg-orange-50 p-4">
          <div className="flex items-center justify-between gap-4 text-sm font-bold text-orange-900">
            <span>{deleteProgress.status} {deleteProgress.label}</span>
            <span>{deleteProgress.percent}%</span>
          </div>

          <div className="mt-3 h-3 w-full overflow-hidden rounded-full bg-white">
            <div
              className="h-full rounded-full bg-orange-500 transition-all duration-300"
              style={{ width: `${deleteProgress.percent}%` }}
            />
          </div>

          <p className="mt-2 text-xs text-orange-800">
            {deleteProgress.total > 0
              ? `تم حذف ${deleteProgress.deleted} من ${deleteProgress.total} سجل`
              : 'جاري حساب عدد السجلات...'}
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* ── حركات بتوين فقط ── */}
        <button
          onClick={deleteBetweenMovementsOnly}
          disabled={deleteProgress.isDeleting}
          className="flex flex-col items-center justify-center gap-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-5 rounded-2xl md:col-span-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <span className="text-base">حذف حركات بتوين فقط</span>
          <span className="text-xs font-normal opacity-80">
            يحذف ADD / SALE / RETURN / UPDATE — يبقى الدامج والمفقودات ✅
          </span>
        </button>

        {/* ── حذف كامل لـ stock_movements ── */}
        <button
          onClick={() => deleteCollectionItems('stock_movements', 'حركات المخزون الكاملة (بما فيها الدامج والمفقود)')}
          disabled={deleteProgress.isDeleting}
          className="flex flex-col items-center justify-center gap-1 bg-slate-600 hover:bg-slate-700 text-white font-bold py-5 rounded-2xl disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <span className="text-base">حذف كل حركات المخزون</span>
          <span className="text-xs font-normal opacity-80">يشمل الدامج والمفقودات ⚠️</span>
        </button>

        <button
          onClick={() => deleteCollectionItems('stock_snapshot', 'Stock Snapshot')}
          disabled={deleteProgress.isDeleting}
          className="bg-slate-600 hover:bg-slate-700 text-white font-bold py-4 rounded-2xl disabled:opacity-50 disabled:cursor-not-allowed"
        >
          حذف Stock Snapshot
        </button>

        <button
          onClick={() => deleteCollectionItems('orders', 'الطلبات')}
          disabled={deleteProgress.isDeleting}
          className="bg-orange-600 hover:bg-orange-700 text-white font-bold py-4 rounded-2xl disabled:opacity-50 disabled:cursor-not-allowed"
        >
          حذف الطلبات
        </button>

        <button
          onClick={() => deleteCollectionItems('cs_returns', 'مرتجعات خدمة العملاء')}
          disabled={deleteProgress.isDeleting}
          className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-4 rounded-2xl disabled:opacity-50 disabled:cursor-not-allowed"
        >
          حذف مرتجعات CS
        </button>

      </div>
    </div>
  );
}
