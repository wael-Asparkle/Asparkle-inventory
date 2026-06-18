import React, { useEffect, useState } from 'react';
import { collection, doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { Loader2, UsersRound } from 'lucide-react';
import { db } from '../config/firebase';
import { ROLE_LABELS, ROLES, normalizeRole } from '../constants/ui';

const EDITABLE_ROLES = [
  ROLES.ADMIN,
  ROLES.MANAGER,
  ROLES.OPERATIONS,
  ROLES.MARKETING,
  ROLES.VIEWER,
];

const ROLE_ACCESS_SUMMARY = {
  [ROLES.ADMIN]: {
    title: 'يرى كل النظام',
    items: ['لوحة التحكم', 'المخزون', 'الحركات', 'الطلبات', 'العملاء', 'استيراد', 'Between', 'CS مرتجعات', 'إدارة البيانات', 'المستخدمون والصلاحيات'],
    note: 'يمكنه إدارة المستخدمين والصفحات الحساسة وعمليات الحذف.',
  },
  [ROLES.MANAGER]: {
    title: 'إدارة ومتابعة بدون صفحات خطيرة',
    items: ['لوحة التحكم', 'المخزون', 'الحركات', 'الطلبات', 'العملاء'],
    note: 'لا يرى إدارة البيانات أو الاستيراد أو إدارة المستخدمين.',
  },
  [ROLES.OPERATIONS]: {
    title: 'صلاحيات العمليات والمستودع',
    items: ['المخزون', 'الحركات', 'الطلبات', 'Between', 'CS مرتجعات'],
    note: 'لا يرى لوحة الأرباح أو العملاء أو إدارة البيانات أو المستخدمين.',
  },
  [ROLES.MARKETING]: {
    title: 'صلاحيات التسويق والعملاء',
    items: ['لوحة التحكم', 'العملاء'],
    note: 'لا يرى المخزون أو العمليات أو الصفحات الحساسة.',
  },
  [ROLES.VIEWER]: {
    title: 'مشاهدة محدودة',
    items: ['لوحة التحكم', 'المخزون', 'الحركات', 'الطلبات', 'العملاء'],
    note: 'مشاهدة فقط، بدون صفحات الإدارة أو الاستيراد أو المستخدمين.',
  },
};

const RoleAccessSummary = ({ role }) => {
  const summary = ROLE_ACCESS_SUMMARY[normalizeRole(role)] || ROLE_ACCESS_SUMMARY[ROLES.VIEWER];

  return (
    <div className="mt-3 rounded-2xl border border-slate-100 bg-slate-50/70 p-3">
      <div className="text-xs font-black text-slate-700 mb-2">{summary.title}</div>
      <div className="flex flex-wrap gap-2">
        {summary.items.map((item) => (
          <span key={item} className="rounded-full bg-white border border-slate-100 px-3 py-1 text-[11px] font-bold text-slate-600">
            {item}
          </span>
        ))}
      </div>
      <div className="mt-2 text-[11px] font-bold text-slate-400 leading-5">{summary.note}</div>
    </div>
  );
};

export default function UserManagementTab({ currentUserUid }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, 'users'),
      (snapshot) => {
        const rows = snapshot.docs.map((item) => {
          const data = item.data();
          return {
            uid: item.id,
            name: data.name || '',
            email: data.email || '',
            role: normalizeRole(data.role),
            isActive: data.isActive === true,
          };
        });
        rows.sort((a, b) => `${a.name} ${a.email}`.localeCompare(`${b.name} ${b.email}`, 'ar'));
        setUsers(rows);
        setLoading(false);
      },
      (error) => {
        console.error('خطأ في تحميل المستخدمين:', error);
        setMessage('تعذر تحميل المستخدمين. تأكد من صلاحية Admin.');
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const saveUser = async (userItem, patch) => {
    setSavingId(userItem.uid);
    setMessage('');
    try {
      await updateDoc(doc(db, 'users', userItem.uid), patch);
      setMessage('تم حفظ التعديل.');
    } catch (error) {
      console.error('خطأ في حفظ المستخدم:', error);
      setMessage('تعذر حفظ التعديل.');
    } finally {
      setSavingId('');
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <UsersRound size={22} />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-800">المستخدمون والصلاحيات</h1>
            <p className="text-sm text-slate-400 mt-1">تعديل الدور وحالة التفعيل للمستخدمين الموجودين في Firestore.</p>
          </div>
        </div>
      </div>

      <div className="bg-amber-50 border border-amber-100 rounded-3xl p-5 text-sm text-amber-800 leading-7">
        إنشاء الحساب الجديد يتم من Firebase Authentication أولًا، ثم يتم إنشاء مستند له داخل collection باسم users.
      </div>

      {message && (
        <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 text-sm font-bold text-slate-700">
          {message}
        </div>
      )}

      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2 font-black text-slate-700">
          <UsersRound size={18} />
          قائمة المستخدمين
        </div>

        {loading ? (
          <div className="p-10 text-center text-slate-400 font-bold flex items-center justify-center gap-2">
            <Loader2 className="animate-spin" size={18} />
            جاري تحميل المستخدمين...
          </div>
        ) : users.length === 0 ? (
          <div className="p-10 text-center text-slate-400 font-bold">لا يوجد مستخدمون.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="text-right px-6 py-4 font-black">المستخدم</th>
                  <th className="text-right px-6 py-4 font-black">الدور وما يستطيع رؤيته</th>
                  <th className="text-right px-6 py-4 font-black">الحالة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.map((item) => {
                  const isSaving = savingId === item.uid;
                  const isCurrentUser = item.uid === currentUserUid;
                  return (
                    <tr key={item.uid} className="hover:bg-slate-50/60 transition-colors align-top">
                      <td className="px-6 py-4 min-w-[240px]">
                        <div className="font-black text-slate-800 flex items-center gap-2">
                          {item.name || 'بدون اسم'}
                          {isCurrentUser && (
                            <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-black text-indigo-600">أنت</span>
                          )}
                        </div>
                        <div className="text-slate-400 font-bold mt-1">{item.email || 'بدون إيميل'}</div>
                      </td>

                      <td className="px-6 py-4 min-w-[360px]">
                        <select
                          value={item.role}
                          disabled={isSaving || isCurrentUser}
                          onChange={(event) => saveUser(item, { role: event.target.value })}
                          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-100 disabled:opacity-60"
                        >
                          {EDITABLE_ROLES.map((role) => (
                            <option key={role} value={role}>{ROLE_LABELS[role]}</option>
                          ))}
                        </select>
                        {isCurrentUser && (
                          <div className="text-[11px] font-bold text-slate-400 mt-2">لا يمكن تعديل حسابك الحالي من هنا.</div>
                        )}
                        <RoleAccessSummary role={item.role} />
                      </td>

                      <td className="px-6 py-4 min-w-[180px]">
                        <button
                          disabled={isSaving || isCurrentUser}
                          onClick={() => saveUser(item, { isActive: !item.isActive })}
                          className={`rounded-2xl px-4 py-3 text-xs font-black transition-all disabled:opacity-60 ${
                            item.isActive
                              ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                              : 'bg-rose-50 text-rose-700 hover:bg-rose-100'
                          }`}
                        >
                          {isSaving ? 'جاري الحفظ...' : item.isActive ? 'مفعل' : 'غير مفعل'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
