import React, { useState } from 'react';
import { ShoppingBag } from 'lucide-react';
import { db, appId } from '../config/firebase';
import {
  collection,
  addDoc,
  getDocs,
} from 'firebase/firestore';
import * as XLSX from 'xlsx';

export default function OrdersTab() {
  const [loading, setLoading] = useState(false);

  // 🔥 تنظيف رقم الجوال
  function normalizePhone(phone) {
    if (!phone) return '';

    let p = phone.toString().replace(/\s+/g, '');

    if (p.startsWith('+966')) {
      return '0' + p.slice(4);
    }

    if (p.startsWith('966')) {
      return '0' + p.slice(3);
    }

    return p;
  }

  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setLoading(true);

    try {
      // 📄 قراءة الملف
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json(sheet);

      // 🔗 Collections
      const ordersRef = collection(
        db,
        'artifacts',
        appId,
        'public',
        'data',
        'orders'
      );

      const movementsRef = collection(
        db,
        'artifacts',
        appId,
        'public',
        'data',
        'movements'
      );

      // 📥 جلب الطلبات الحالية
      const snapshot = await getDocs(ordersRef);
      const existingRefs = new Set(
        snapshot.docs.map((d) => d.data().reference)
      );

      const ordersMap = new Map();
      const newMovements = [];

      let duplicates = 0;

      // 🔄 معالجة الصفوف
      json.forEach((row) => {
        const reference = String(row['رقم الطلب'] || '').trim();
        if (!reference) return;

        // ❌ مكرر
        if (existingRefs.has(reference)) {
          duplicates++;
          return;
        }

        // ✅ إنشاء الطلب (مرة وحدة فقط)
        if (!ordersMap.has(reference)) {
          ordersMap.set(reference, {
            reference,

            customer: {
              name: row['اسم العميل'] || '',
              phone: normalizePhone(row['رقم الجوال']),
              city: row['المدينة'] || '',
            },

            paymentMethod: row['طريقة الدفع'] || '',
            total: Number(row['إجمالي الطلب']) || 0,
            date: row['تاريخ الطلب'] || '',
            createdAt: Date.now(),
          });
        }

        // 📦 إنشاء حركة لكل SKU
        const sku = row['SKU'];
        if (!sku) return;

        newMovements.push({
          code: sku,
          quantity: 1,
          level: 'منتج',
          direction: 'out',
          type: 'sale',
          reference,
          date: row['تاريخ الطلب'] || '',
          note: 'استيراد من سلة',
          timestamp: Date.now(),
        });
      });

      const newOrders = Array.from(ordersMap.values());

      // 🚀 حفظ البيانات
      await Promise.all([
        ...newOrders.map((o) => addDoc(ordersRef, o)),
        ...newMovements.map((m) => addDoc(movementsRef, m)),
      ]);

      alert(`
تم الرفع بنجاح ✅
طلبات جديدة: ${newOrders.length}
حركات: ${newMovements.length}
طلبات مكررة: ${duplicates}
      `);

    } catch (err) {
      console.error(err);
      alert('حدث خطأ أثناء رفع الملف ❌');
    }

    setLoading(false);
  };

  return (
    <div className="bg-white rounded-3xl border p-8" dir="rtl">
      <div className="flex items-center gap-3 mb-6">
        <ShoppingBag className="text-indigo-600" size={28} />
        <h2 className="text-2xl font-black">الطلبات</h2>
      </div>

      <div className="bg-slate-50 rounded-2xl p-6 border">
        <p className="mb-4 font-bold text-slate-700">
          رفع ملف الطلبات (سلة)
        </p>

        <input
          type="file"
          accept=".xlsx, .csv"
          onChange={handleUpload}
        />

        {loading && (
          <p className="mt-3 text-sm text-indigo-600">
            جاري معالجة الملف...
          </p>
        )}
      </div>
    </div>
  );
}
