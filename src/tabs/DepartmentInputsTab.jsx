import React, { useEffect, useMemo, useState } from 'react';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { ClipboardList, Filter, Loader2, Pencil, Plus, Save, Trash2, X } from 'lucide-react';
import { db } from '../config/firebase';
import { ROLES, normalizeRole } from '../constants/ui';

const DEPARTMENTS = [
  { id: 'marketing', label: 'التسويق' },
  { id: 'operations', label: 'العمليات' },
  { id: 'finance', label: 'المالية' },
  { id: 'customer_service', label: 'خدمة العملاء' },
];

const DEPARTMENT_LABELS = DEPARTMENTS.reduce((acc, item) => {
  acc[item.id] = item.label;
  return acc;
}, {});

const ROLE_DEPARTMENT = {
  [ROLES.MARKETING]: 'marketing',
  [ROLES.OPERATIONS]: 'operations',
  [ROLES.FINANCE]: 'finance',
  [ROLES.CUSTOMER_SERVICE]: 'customer_service',
};

const STATUS_OPTIONS = ['جيد', 'يحتاج متابعة', 'خطر'];

const emptyForm = {
  date: new Date().toISOString().slice(0, 10),
  department: 'marketing',
  metric: '',
  value: '',
  status: 'جيد',
  notes: '',
  recommendation: '',
};

const statusClass = (status) => {
  if (status === 'خطر') return 'bg-rose-50 text-rose-700 border-rose-100';
  if (status === 'يحتاج متابعة') return 'bg-amber-50 text-amber-700 border-amber-100';
  return 'bg-emerald-50 text-emerald-700 border-emerald-100';
};

const formatDateTime = (value) => {
  if (!value?.seconds) return '—';
  return new Date(value.seconds * 1000).toLocaleString('ar-SA');
};

export default function DepartmentInputsTab({ currentUserRole, userProfile }) {
  const role = normalizeRole(currentUserRole);
  const userDepartment = ROLE_DEPARTMENT[role];
  const canSeeAll = [ROLES.ADMIN, ROLES.CEO, ROLES.MANAGER].includes(role);
  const canCreate = role === ROLES.ADMIN || Boolean(userDepartment);
  const isReadOnlyLeader = [ROLES.CEO, ROLES.MANAGER].includes(role);

  const [inputs, setInputs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [editingId, setEditingId] = useState('');
  const [filterDepartment, setFilterDepartment] = useState('all');
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');
  const [form, setForm] = useState(() => ({
    ...emptyForm,
    department: userDepartment || 'marketing',
  }));

  useEffect(() => {
    setForm((current) => ({
      ...current,
      department: userDepartment || current.department || 'marketing',
    }));
  }, [userDepartment]);

  useEffect(() => {
    if (!canSeeAll && !userDepartment) {
      setInputs([]);
      setLoading(false);
      return undefined;
    }

    setLoading(true);
    const baseRef = collection(db, 'department_inputs');
    const source = canSeeAll
      ? baseRef
      : query(baseRef, where('department', '==', userDepartment));

    const unsubscribe = onSnapshot(
      source,
      (snapshot) => {
        const rows = snapshot.docs.map((item) => ({
          id: item.id,
          ...item.data(),
        }));

        rows.sort((a, b) => {
          const dateCompare = `${b.date || ''}`.localeCompare(`${a.date || ''}`);
          if (dateCompare !== 0) return dateCompare;
          return (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0);
        });

        setInputs(rows);
        setLoading(false);
      },
      (error) => {
        console.error('خطأ في تحميل إدخالات الأقسام:', error);
        setMessage('تعذر تحميل إدخالات الأقسام. تأكد من الصلاحيات وقواعد Firestore.');
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [canSeeAll, userDepartment]);

  const visibleInputs = useMemo(() => {
    return inputs.filter((item) => {
      const departmentOk = !canSeeAll || filterDepartment === 'all' || item.department === filterDepartment;
      const fromOk = !filterFrom || (item.date || '') >= filterFrom;
      const toOk = !filterTo || (item.date || '') <= filterTo;
      return departmentOk && fromOk && toOk;
    });
  }, [inputs, canSeeAll, filterDepartment, filterFrom, filterTo]);

  const updateForm = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const resetForm = () => {
    setEditingId('');
    setForm({
      ...emptyForm,
      department: userDepartment || 'marketing',
    });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setMessage('');

    if (!canCreate) {
      setMessage('هذا الدور يملك صلاحية قراءة فقط.');
      return;
    }

    if (!form.date || !form.metric.trim()) {
      setMessage('التاريخ ونوع المؤشر حقول مطلوبة.');
      return;
    }

    const department = role === ROLES.ADMIN ? form.department : userDepartment;
    if (!department) {
      setMessage('لا يوجد قسم مرتبط بهذا المستخدم.');
      return;
    }

    const payload = {
      date: form.date,
      department,
      metric: form.metric.trim(),
      value: form.value === '' ? null : Number(form.value),
      status: form.status,
      notes: form.notes.trim(),
      recommendation: form.recommendation.trim(),
      updatedAt: serverTimestamp(),
    };

    setSaving(true);
    try {
      if (editingId) {
        await updateDoc(doc(db, 'department_inputs', editingId), payload);
        setMessage('تم حفظ التعديل.');
      } else {
        await addDoc(collection(db, 'department_inputs'), {
          ...payload,
          enteredBy: {
            uid: userProfile?.uid || '',
            name: userProfile?.name || userProfile?.email || '',
            email: userProfile?.email || '',
            role,
          },
          createdAt: serverTimestamp(),
        });
        setMessage('تم حفظ الإدخال.');
      }
      resetForm();
    } catch (error) {
      console.error('خطأ في حفظ إدخال القسم:', error);
      setMessage('تعذر حفظ الإدخال. راجع الصلاحيات أو اتصال Firebase.');
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (item) => {
    setEditingId(item.id);
    setForm({
      date: item.date || new Date().toISOString().slice(0, 10),
      department: item.department || userDepartment || 'marketing',
      metric: item.metric || '',
      value: item.value === null || item.value === undefined ? '' : String(item.value),
      status: item.status || 'جيد',
      notes: item.notes || '',
      recommendation: item.recommendation || '',
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (item) => {
    if (role !== ROLES.ADMIN) return;
    const confirmed = window.confirm('سيتم حذف هذا الإدخال نهائيًا. هل تريد المتابعة؟');
    if (!confirmed) return;

    setSaving(true);
    setMessage('');
    try {
      await deleteDoc(doc(db, 'department_inputs', item.id));
      setMessage('تم حذف الإدخال.');
    } catch (error) {
      console.error('خطأ في حذف إدخال القسم:', error);
      setMessage('تعذر حذف الإدخال. الحذف متاح للـ Admin فقط.');
    } finally {
      setSaving(false);
    }
  };

  const canEditItem = (item) => role === ROLES.ADMIN || item.enteredBy?.uid === userProfile?.uid;
  const canDeleteItem = role === ROLES.ADMIN;
  const currentDepartmentLabel = userDepartment ? DEPARTMENT_LABELS[userDepartment] : 'كل الأقسام';

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <ClipboardList size={22} />
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-800">إدخالات الأقسام</h1>
              <p className="text-sm text-slate-400 mt-1">
                إدخال ومتابعة ملاحظات ومؤشرات الأقسام لتغذية صفحة الرئيس التنفيذي لاحقًا.
              </p>
            </div>
          </div>
          <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm font-black text-slate-600">
            نطاقك الحالي: {canSeeAll ? 'كل الأقسام' : currentDepartmentLabel}
          </div>
        </div>
      </div>

      {message && (
        <div className="rounded-2xl border border-slate-100 bg-white p-4 text-sm font-bold text-slate-700">
          {message}
        </div>
      )}

      {isReadOnlyLeader && (
        <div className="rounded-3xl border border-blue-100 bg-blue-50 p-5 text-sm font-bold text-blue-800 leading-7">
          هذا الدور مخصص للمتابعة والقراءة فقط. يمكنه رؤية كل إدخالات الأقسام، بدون إضافة أو تعديل أو حذف.
        </div>
      )}

      {canCreate && (
        <form onSubmit={handleSubmit} className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 space-y-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-black text-slate-800">
              {editingId ? 'تعديل إدخال' : 'إدخال جديد'}
            </h2>
            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 px-4 py-2 text-xs font-black text-slate-500 hover:bg-slate-50"
              >
                <X size={15} />
                إلغاء التعديل
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            <label className="space-y-2">
              <span className="text-xs font-black text-slate-500">التاريخ</span>
              <input
                type="date"
                value={form.date}
                onChange={(event) => updateForm('date', event.target.value)}
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-100"
              />
            </label>

            <label className="space-y-2">
              <span className="text-xs font-black text-slate-500">القسم</span>
              {role === ROLES.ADMIN ? (
                <select
                  value={form.department}
                  onChange={(event) => updateForm('department', event.target.value)}
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                >
                  {DEPARTMENTS.map((department) => (
                    <option key={department.id} value={department.id}>{department.label}</option>
                  ))}
                </select>
              ) : (
                <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 font-black text-slate-700">
                  {currentDepartmentLabel}
                </div>
              )}
            </label>

            <label className="space-y-2">
              <span className="text-xs font-black text-slate-500">نوع المؤشر أو الملاحظة</span>
              <input
                type="text"
                value={form.metric}
                onChange={(event) => updateForm('metric', event.target.value)}
                placeholder="مثال: عدد الطلبات، ملاحظة حملة، مشكلة شحن"
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-100"
              />
            </label>

            <label className="space-y-2">
              <span className="text-xs font-black text-slate-500">القيمة الرقمية إن وجدت</span>
              <input
                type="number"
                value={form.value}
                onChange={(event) => updateForm('value', event.target.value)}
                placeholder="اختياري"
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-100"
              />
            </label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <label className="space-y-2">
              <span className="text-xs font-black text-slate-500">مستوى الحالة</span>
              <select
                value={form.status}
                onChange={(event) => updateForm('status', event.target.value)}
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-100"
              >
                {STATUS_OPTIONS.map((status) => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </select>
            </label>

            <label className="space-y-2 md:col-span-2">
              <span className="text-xs font-black text-slate-500">القرار المطلوب أو التوصية</span>
              <input
                type="text"
                value={form.recommendation}
                onChange={(event) => updateForm('recommendation', event.target.value)}
                placeholder="مثال: نحتاج متابعة المورد / رفع ميزانية الإعلان / التواصل مع العميل"
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-100"
              />
            </label>
          </div>

          <label className="space-y-2 block">
            <span className="text-xs font-black text-slate-500">الملاحظة النصية</span>
            <textarea
              value={form.notes}
              onChange={(event) => updateForm('notes', event.target.value)}
              placeholder="اكتب التفاصيل المهمة هنا..."
              rows={4}
              className="w-full rounded-2xl border border-slate-200 px-4 py-3 font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-100"
            />
          </label>

          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-900 px-5 py-3 text-sm font-black text-white hover:bg-slate-800 disabled:opacity-60"
          >
            {editingId ? <Save size={16} /> : <Plus size={16} />}
            {saving ? 'جاري الحفظ...' : editingId ? 'حفظ التعديل' : 'إضافة الإدخال'}
          </button>
        </form>
      )}

      {canSeeAll && (
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-5">
          <div className="flex items-center gap-2 font-black text-slate-700 mb-4">
            <Filter size={18} />
            تصفية الإدخالات
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <label className="space-y-2">
              <span className="text-xs font-black text-slate-500">القسم</span>
              <select
                value={filterDepartment}
                onChange={(event) => setFilterDepartment(event.target.value)}
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-100"
              >
                <option value="all">كل الأقسام</option>
                {DEPARTMENTS.map((department) => (
                  <option key={department.id} value={department.id}>{department.label}</option>
                ))}
              </select>
            </label>

            <label className="space-y-2">
              <span className="text-xs font-black text-slate-500">من تاريخ</span>
              <input
                type="date"
                value={filterFrom}
                onChange={(event) => setFilterFrom(event.target.value)}
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-100"
              />
            </label>

            <label className="space-y-2">
              <span className="text-xs font-black text-slate-500">إلى تاريخ</span>
              <input
                type="date"
                value={filterTo}
                onChange={(event) => setFilterTo(event.target.value)}
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-100"
              />
            </label>
          </div>
        </div>
      )}

      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between gap-3">
          <div className="font-black text-slate-700">سجل الإدخالات</div>
          <div className="text-xs font-bold text-slate-400">{visibleInputs.length} إدخال</div>
        </div>

        {loading ? (
          <div className="p-10 text-center text-slate-400 font-bold flex items-center justify-center gap-2">
            <Loader2 className="animate-spin" size={18} />
            جاري تحميل الإدخالات...
          </div>
        ) : visibleInputs.length === 0 ? (
          <div className="p-10 text-center text-slate-400 font-bold">لا توجد إدخالات حتى الآن.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="text-right px-6 py-4 font-black">التاريخ والقسم</th>
                  <th className="text-right px-6 py-4 font-black">المؤشر</th>
                  <th className="text-right px-6 py-4 font-black">الحالة</th>
                  <th className="text-right px-6 py-4 font-black">الملاحظة والتوصية</th>
                  <th className="text-right px-6 py-4 font-black">المدخل</th>
                  <th className="text-right px-6 py-4 font-black">إجراء</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visibleInputs.map((item) => (
                  <tr key={item.id} className="align-top hover:bg-slate-50/60">
                    <td className="px-6 py-4 min-w-[170px]">
                      <div className="font-black text-slate-800">{item.date || '—'}</div>
                      <div className="text-slate-400 font-bold mt-1">{DEPARTMENT_LABELS[item.department] || item.department || '—'}</div>
                    </td>
                    <td className="px-6 py-4 min-w-[220px]">
                      <div className="font-black text-slate-800">{item.metric || '—'}</div>
                      <div className="text-slate-400 font-bold mt-1">القيمة: {item.value ?? '—'}</div>
                    </td>
                    <td className="px-6 py-4 min-w-[150px]">
                      <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-black ${statusClass(item.status)}`}>
                        {item.status || 'جيد'}
                      </span>
                    </td>
                    <td className="px-6 py-4 min-w-[320px]">
                      <div className="text-slate-700 font-bold leading-7 whitespace-pre-wrap">{item.notes || '—'}</div>
                      {item.recommendation && (
                        <div className="mt-3 rounded-2xl bg-indigo-50 px-4 py-3 text-xs font-bold text-indigo-700 leading-6">
                          التوصية: {item.recommendation}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 min-w-[190px]">
                      <div className="font-black text-slate-700">{item.enteredBy?.name || '—'}</div>
                      <div className="text-slate-400 font-bold mt-1">{item.enteredBy?.email || '—'}</div>
                      <div className="text-[11px] text-slate-300 font-bold mt-2">آخر تحديث: {formatDateTime(item.updatedAt)}</div>
                    </td>
                    <td className="px-6 py-4 min-w-[160px]">
                      <div className="flex flex-col gap-2">
                        {canEditItem(item) && (
                          <button
                            type="button"
                            onClick={() => startEdit(item)}
                            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 px-4 py-2 text-xs font-black text-slate-600 hover:bg-slate-50"
                          >
                            <Pencil size={14} />
                            تعديل
                          </button>
                        )}

                        {canDeleteItem && (
                          <button
                            type="button"
                            onClick={() => handleDelete(item)}
                            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-rose-100 px-4 py-2 text-xs font-black text-rose-700 hover:bg-rose-50"
                          >
                            <Trash2 size={14} />
                            حذف
                          </button>
                        )}

                        {!canEditItem(item) && !canDeleteItem && (
                          <span className="text-xs font-bold text-slate-400">قراءة فقط</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
