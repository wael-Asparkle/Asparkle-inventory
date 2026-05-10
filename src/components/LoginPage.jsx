import React, { useState } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../config/firebase';
import { Lock, Mail, Eye, EyeOff } from 'lucide-react';

export default function LoginPage() {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err) {
      switch (err.code) {
        case 'auth/user-not-found':
        case 'auth/wrong-password':
        case 'auth/invalid-credential':
          setError('البريد الإلكتروني أو كلمة المرور غير صحيحة');
          break;
        case 'auth/too-many-requests':
          setError('تم تجاوز عدد المحاولات — حاول لاحقاً');
          break;
        default:
          setError('حدث خطأ، حاول مرة أخرى');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4" dir="rtl">
      <div className="w-full max-w-sm">

        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="font-black text-3xl text-slate-800">
            Asparkle<span className="text-indigo-600">OS</span>
          </h1>
          <p className="text-slate-400 text-sm mt-2">نظام إدارة المتجر</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-8">
          <h2 className="text-xl font-black text-slate-800 mb-6">تسجيل الدخول</h2>

          <form onSubmit={handleLogin} className="flex flex-col gap-4">

            {/* Email */}
            <div>
              <label className="text-xs font-black text-slate-500 mb-1.5 block">البريد الإلكتروني</label>
              <div className="relative">
                <Mail size={15} className="absolute top-1/2 -translate-y-1/2 right-3 text-slate-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="example@asparkle.net"
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3 pr-9 pl-4 text-sm font-bold text-slate-700 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-300 transition-all"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="text-xs font-black text-slate-500 mb-1.5 block">كلمة المرور</label>
              <div className="relative">
                <Lock size={15} className="absolute top-1/2 -translate-y-1/2 right-3 text-slate-400" />
                <input
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3 pr-9 pl-10 text-sm font-bold text-slate-700 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-300 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute top-1/2 -translate-y-1/2 left-3 text-slate-400 hover:text-slate-600"
                >
                  {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="bg-rose-50 border border-rose-200 rounded-2xl px-4 py-3 text-rose-600 text-sm font-bold">
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className={`w-full py-3 rounded-2xl font-black text-sm transition-all mt-2 ${
                loading
                  ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                  : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm'
              }`}
            >
              {loading ? 'جاري التحقق...' : 'دخول'}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-slate-400 font-bold mt-6">
          Asparkle OS — للاستخدام الداخلي فقط
        </p>
      </div>
    </div>
  );
}
