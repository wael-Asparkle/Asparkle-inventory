import React from 'react';
import { ShieldAlert } from 'lucide-react';
import { db, appId } from '../config/firebase';
import { collection, getDocs, deleteDoc, doc } from 'firebase/firestore';

export default function DataAdminTab() {
  const deleteCollectionItems = async (collectionName, label) => {
    const confirmed = window.confirm(`هل أنت متأكد من حذف ${label}؟`);
    if (!confirmed) return;

    try {
      const targetCollection = collection(
        db,
        'artifacts',
        appId,
        'public',
        'data',
        collectionName
      );

      const snapshot = await getDocs(targetCollection);

      if (snapshot.empty) {
        alert(`لا توجد بيانات في ${label}`);
        return;
      }

      const promises = snapshot.docs.map((d) =>
        deleteDoc(
          doc(db, 'artifacts', appId, 'public', 'data', collectionName, d.id)
        )
      );

      await Promise.all(promises);

      alert(`تم حذف ${label} بنجاح ✅`);
      window.location.reload();
    } catch (error) {
      console.error('Delete error:', error);
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
        هذا القسم مخصص لحذف الطلبات والحركات وإعادة بناء النظام.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
      </div>
    </div>
  );
}
