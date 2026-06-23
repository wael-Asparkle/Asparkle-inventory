import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Calculator,
  CheckCircle2,
  Package,
  Percent,
  Receipt,
  ShieldCheck,
  SlidersHorizontal,
  Target,
  TrendingUp,
} from 'lucide-react';

const VAT_RATE = 15;

const PACKAGE_PRESETS = {
  bundle5: {
    label: 'بكج 5 عطور',
    productCost: 100.4,
    sellingPrice: 199,
    note: 'التكلفة مأخوذة من ملف تكلفة بكج 5 عطور وتشمل مكونات البكج الأساسية.',
  },
  custom: {
    label: 'بكج مخصص',
    productCost: 0,
    sellingPrice: 0,
    note: 'استخدم هذا الخيار لتجربة أي بكج أو عرض جديد.',
  },
};

const PRICE_SCENARIOS = [149, 169, 179, 199, 219, 249];

const formatNumber = (value, options = {}) => Number(value || 0).toLocaleString('ar-SA', {
  maximumFractionDigits: 2,
  minimumFractionDigits: options.minimumFractionDigits ?? 0,
});

const toNumber = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

function SaudiRiyalIcon({ size = 16, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden="true">
      <path d="M7 18h3.8c4.25 0 6.7-2.55 6.7-6.9V5.3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M7 9.2h11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M6 13.2h11.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M10.2 5.3v12.8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M14.1 5.3v11.2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function Money({ value, className = '', iconSize = 15 }) {
  return (
    <span className={`inline-flex items-center gap-1 align-middle whitespace-nowrap ${className}`}>
      <span>{formatNumber(value, { minimumFractionDigits: 2 })}</span>
      <SaudiRiyalIcon size={iconSize} className="shrink-0" />
    </span>
  );
}

function Field({ label, value, onChange, suffix, hint, disabled = false }) {
  return (
    <label className="block">
      <span className="text-xs font-black text-slate-500 mb-1.5 block">{label}</span>
      <div className="relative">
        <input
          type="number"
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          className="w-full bg-white border border-slate-200 rounded-2xl px-4 py-3 text-sm font-black text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300 disabled:bg-slate-50 disabled:text-slate-400"
        />
        {suffix && (
          <span className="absolute inset-y-0 left-4 flex items-center text-xs font-black text-slate-400">
            {suffix}
          </span>
        )}
      </div>
      {hint && <span className="text-[11px] text-slate-400 mt-1 block leading-5">{hint}</span>}
    </label>
  );
}

function MetricCard({ label, value, sub, icon, tone = 'slate' }) {
  const tones = {
    slate: 'bg-white border-slate-100 text-slate-700',
    indigo: 'bg-indigo-50 border-indigo-100 text-indigo-700',
    emerald: 'bg-emerald-50 border-emerald-100 text-emerald-700',
    amber: 'bg-amber-50 border-amber-100 text-amber-700',
    rose: 'bg-rose-50 border-rose-100 text-rose-700',
  };

  return (
    <div className={`rounded-3xl border p-5 shadow-sm ${tones[tone] || tones.slate}`}>
      <div className="flex items-center justify-between mb-4">
        <div className="w-10 h-10 rounded-2xl bg-white/80 flex items-center justify-center shadow-sm">
          {icon}
        </div>
      </div>
      <p className="text-xs font-black opacity-70 mb-1">{label}</p>
      <div className="text-2xl font-black text-slate-900">{value}</div>
      {sub && <p className="text-xs text-slate-400 mt-1 leading-5">{sub}</p>}
    </div>
  );
}

function ResultBadge({ profit, margin }) {
  if (profit <= 0) {
    return (
      <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-rose-50 text-rose-700 border border-rose-100 text-xs font-black">
        <AlertTriangle size={15} /> خطر: السعر لا يغطي التكاليف
      </div>
    );
  }

  if (margin < 10) {
    return (
      <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-50 text-amber-700 border border-amber-100 text-xs font-black">
        <AlertTriangle size={15} /> هامش ضعيف: يحتاج تحسين
      </div>
    );
  }

  return (
    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100 text-xs font-black">
      <CheckCircle2 size={15} /> مربح حسب المدخلات الحالية
    </div>
  );
}

function calculateScenario(input) {
  const vatRate = toNumber(input.vatRate) / 100;
  const discount = Math.max(0, toNumber(input.discount));
  const rawSellingPrice = Math.max(0, toNumber(input.sellingPrice));
  const listedPriceAfterDiscount = Math.max(0, rawSellingPrice - discount);
  const isVatIncluded = input.vatMode === 'included';

  const netRevenue = isVatIncluded
    ? listedPriceAfterDiscount / (1 + vatRate)
    : listedPriceAfterDiscount;
  const vatAmount = isVatIncluded
    ? listedPriceAfterDiscount - netRevenue
    : netRevenue * vatRate;
  const customerFinalPrice = netRevenue + vatAmount;

  const productCost = toNumber(input.productCost);
  const adCost = toNumber(input.adCost);
  const shippingCost = toNumber(input.shippingCost);
  const fulfillmentCost = toNumber(input.fulfillmentCost);
  const otherCost = toNumber(input.otherCost);
  const paymentFee = customerFinalPrice * (toNumber(input.paymentFeeRate) / 100);
  const returnReserve = customerFinalPrice * (toNumber(input.returnRate) / 100);

  const totalCosts = productCost + adCost + shippingCost + fulfillmentCost + otherCost + paymentFee + returnReserve;
  const profit = netRevenue - totalCosts;
  const margin = netRevenue > 0 ? (profit / netRevenue) * 100 : 0;
  const contributionBeforeAds = netRevenue - (totalCosts - adCost);
  const breakEvenAdCost = Math.max(0, contributionBeforeAds);

  const targetMargin = toNumber(input.targetMargin) / 100;
  const variableRateOnCustomerPrice = (toNumber(input.paymentFeeRate) + toNumber(input.returnRate)) / 100;
  const fixedCostsWithoutVariable = productCost + adCost + shippingCost + fulfillmentCost + otherCost;
  const denominator = ((1 - targetMargin) / (1 + vatRate)) - variableRateOnCustomerPrice;
  const requiredCustomerPrice = denominator > 0 ? fixedCostsWithoutVariable / denominator : 0;
  const requiredListedPrice = isVatIncluded ? requiredCustomerPrice : requiredCustomerPrice / (1 + vatRate);

  return {
    rawSellingPrice,
    listedPriceAfterDiscount,
    netRevenue,
    vatAmount,
    customerFinalPrice,
    productCost,
    adCost,
    shippingCost,
    fulfillmentCost,
    otherCost,
    paymentFee,
    returnReserve,
    totalCosts,
    profit,
    margin,
    breakEvenAdCost,
    requiredListedPrice,
    requiredCustomerPrice,
  };
}

export default function PriceSimulatorTab() {
  const [selectedPreset, setSelectedPreset] = useState('bundle5');
  const [form, setForm] = useState({
    sellingPrice: 199,
    productCost: 100.4,
    discount: 0,
    vatMode: 'included',
    vatRate: VAT_RATE,
    adCost: 40,
    shippingCost: 18,
    fulfillmentCost: 7,
    paymentFeeRate: 2.5,
    returnRate: 5,
    otherCost: 0,
    targetMargin: 15,
  });

  const updateField = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const applyPreset = (presetKey) => {
    const preset = PACKAGE_PRESETS[presetKey];
    setSelectedPreset(presetKey);
    setForm((prev) => ({
      ...prev,
      productCost: preset.productCost,
      sellingPrice: preset.sellingPrice || prev.sellingPrice,
    }));
  };

  const result = useMemo(() => calculateScenario(form), [form]);

  const scenarioRows = useMemo(() => PRICE_SCENARIOS.map((price) => {
    const scenario = calculateScenario({ ...form, sellingPrice: price, discount: 0 });
    return { price, ...scenario };
  }), [form]);

  const costRows = [
    { label: 'تكلفة البكج', value: result.productCost },
    { label: 'تكلفة الإعلان لكل طلب', value: result.adCost },
    { label: 'الشحن', value: result.shippingCost },
    { label: 'التشغيل / Between', value: result.fulfillmentCost },
    { label: 'رسوم الدفع', value: result.paymentFee },
    { label: 'مخصص المرتجعات', value: result.returnReserve },
    { label: 'تكاليف أخرى', value: result.otherCost },
  ];

  return (
    <div className="space-y-6">
      <div className="bg-slate-900 rounded-[2rem] p-6 md:p-8 text-white overflow-hidden relative">
        <div className="absolute -left-10 -top-10 w-44 h-44 bg-indigo-500/20 rounded-full blur-3xl" />
        <div className="absolute right-20 -bottom-16 w-56 h-56 bg-amber-400/10 rounded-full blur-3xl" />
        <div className="relative flex flex-col md:flex-row md:items-end md:justify-between gap-5">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 border border-white/10 text-xs font-black mb-4">
              <Calculator size={15} /> Price Simulator
            </div>
            <h1 className="text-3xl md:text-4xl font-black mb-3">محاكي الأسعار والربحية</h1>
            <p className="text-slate-300 text-sm md:text-base leading-8 max-w-3xl">
              جرّب سعر البيع، الضريبة، تكلفة البكج، الإعلان، الشحن، رسوم الدفع، والمرتجعات لمعرفة الربح الحقيقي وأقصى تكلفة إعلان آمنة لكل طلب.
            </p>
          </div>
          <ResultBadge profit={result.profit} margin={result.margin} />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <MetricCard
          label="صافي الربح لكل طلب"
          value={<Money value={result.profit} className={result.profit >= 0 ? 'text-emerald-700' : 'text-rose-700'} iconSize={18} />}
          sub="بعد فصل الضريبة وخصم التكاليف"
          icon={<TrendingUp size={20} className="text-indigo-600" />}
          tone={result.profit >= 0 ? 'emerald' : 'rose'}
        />
        <MetricCard
          label="هامش الربح"
          value={`${formatNumber(result.margin, { minimumFractionDigits: 1 })}%`}
          sub="محسوب على صافي السعر قبل الضريبة"
          icon={<Percent size={20} className="text-indigo-600" />}
          tone={result.margin >= 10 ? 'indigo' : 'amber'}
        />
        <MetricCard
          label="أقصى CAC للتعادل"
          value={<Money value={result.breakEvenAdCost} iconSize={18} />}
          sub="أي إعلان أعلى منه يدخل الطلب في الخسارة"
          icon={<Target size={20} className="text-indigo-600" />}
          tone="indigo"
        />
        <MetricCard
          label="السعر المطلوب للهامش المستهدف"
          value={<Money value={result.requiredListedPrice} iconSize={18} />}
          sub={`لتحقيق هامش ${form.targetMargin || 0}% حسب نفس التكاليف`}
          icon={<ShieldCheck size={20} className="text-indigo-600" />}
          tone="slate"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-100 shadow-sm p-6">
          <div className="flex items-center justify-between gap-3 mb-6">
            <div className="flex items-center gap-2">
              <SlidersHorizontal size={20} className="text-indigo-500" />
              <h2 className="text-lg font-black text-slate-800">مدخلات المحاكاة</h2>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <label className="block md:col-span-2">
              <span className="text-xs font-black text-slate-500 mb-1.5 block">البكج</span>
              <select
                value={selectedPreset}
                onChange={(e) => applyPreset(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-2xl px-4 py-3 text-sm font-black text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300"
              >
                {Object.entries(PACKAGE_PRESETS).map(([key, preset]) => (
                  <option key={key} value={key}>{preset.label}</option>
                ))}
              </select>
              <span className="text-[11px] text-slate-400 mt-1 block leading-5">{PACKAGE_PRESETS[selectedPreset]?.note}</span>
            </label>

            <Field label="سعر البيع المدخل" value={form.sellingPrice} onChange={(v) => updateField('sellingPrice', v)} suffix="ر.س" />
            <Field label="الخصم / الكوبون" value={form.discount} onChange={(v) => updateField('discount', v)} suffix="ر.س" />

            <label className="block md:col-span-2">
              <span className="text-xs font-black text-slate-500 mb-1.5 block">طريقة عرض الضريبة</span>
              <div className="grid grid-cols-2 gap-2 bg-slate-50 border border-slate-100 rounded-2xl p-1.5">
                <button
                  type="button"
                  onClick={() => updateField('vatMode', 'included')}
                  className={`rounded-xl px-4 py-2.5 text-xs font-black transition-all ${form.vatMode === 'included' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-400 hover:text-slate-700'}`}
                >
                  السعر شامل الضريبة
                </button>
                <button
                  type="button"
                  onClick={() => updateField('vatMode', 'excluded')}
                  className={`rounded-xl px-4 py-2.5 text-xs font-black transition-all ${form.vatMode === 'excluded' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-400 hover:text-slate-700'}`}
                >
                  السعر غير شامل الضريبة
                </button>
              </div>
            </label>

            <Field label="نسبة الضريبة" value={form.vatRate} onChange={(v) => updateField('vatRate', v)} suffix="%" />
            <Field label="تكلفة البكج" value={form.productCost} onChange={(v) => updateField('productCost', v)} suffix="ر.س" hint="تشمل مكونات المنتج الأساسية حسب ملف التكلفة." />
            <Field label="تكلفة الإعلان لكل طلب CAC" value={form.adCost} onChange={(v) => updateField('adCost', v)} suffix="ر.س" />
            <Field label="الشحن" value={form.shippingCost} onChange={(v) => updateField('shippingCost', v)} suffix="ر.س" />
            <Field label="التشغيل / التجهيز" value={form.fulfillmentCost} onChange={(v) => updateField('fulfillmentCost', v)} suffix="ر.س" hint="مثل Between أو المناولة أو التغليف التشغيلي الإضافي." />
            <Field label="رسوم الدفع" value={form.paymentFeeRate} onChange={(v) => updateField('paymentFeeRate', v)} suffix="%" />
            <Field label="مخصص المرتجعات / عدم الاستلام" value={form.returnRate} onChange={(v) => updateField('returnRate', v)} suffix="%" />
            <Field label="تكاليف أخرى" value={form.otherCost} onChange={(v) => updateField('otherCost', v)} suffix="ر.س" />
            <Field label="هامش الربح المستهدف" value={form.targetMargin} onChange={(v) => updateField('targetMargin', v)} suffix="%" />
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6">
            <div className="flex items-center gap-2 mb-5">
              <Receipt size={19} className="text-indigo-500" />
              <h2 className="text-lg font-black text-slate-800">تفصيل السعر</h2>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500 font-bold">السعر بعد الخصم</span>
                <Money value={result.listedPriceAfterDiscount} className="font-black text-slate-800" />
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500 font-bold">صافي السعر قبل الضريبة</span>
                <Money value={result.netRevenue} className="font-black text-slate-800" />
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500 font-bold">قيمة الضريبة</span>
                <Money value={result.vatAmount} className="font-black text-slate-800" />
              </div>
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-sm">
                <span className="text-slate-800 font-black">المبلغ النهائي للعميل</span>
                <Money value={result.customerFinalPrice} className="font-black text-indigo-700" iconSize={17} />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6">
            <div className="flex items-center gap-2 mb-5">
              <Package size={19} className="text-indigo-500" />
              <h2 className="text-lg font-black text-slate-800">تفصيل التكاليف</h2>
            </div>
            <div className="space-y-3">
              {costRows.map((row) => (
                <div key={row.label} className="flex items-center justify-between text-sm">
                  <span className="text-slate-500 font-bold">{row.label}</span>
                  <Money value={row.value} className="font-black text-slate-800" />
                </div>
              ))}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-sm">
                <span className="text-slate-800 font-black">إجمالي التكاليف</span>
                <Money value={result.totalCosts} className="font-black text-rose-700" iconSize={17} />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-5">
          <div>
            <h2 className="text-lg font-black text-slate-800 mb-1">مقارنة سيناريوهات الأسعار</h2>
            <p className="text-xs text-slate-400 font-bold">نفس التكاليف الحالية مع تغيير سعر البيع فقط.</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-slate-400 border-b border-slate-100">
                <th className="text-right py-3 px-3 font-black">سعر البيع</th>
                <th className="text-right py-3 px-3 font-black">صافي قبل الضريبة</th>
                <th className="text-right py-3 px-3 font-black">الضريبة</th>
                <th className="text-right py-3 px-3 font-black">إجمالي التكاليف</th>
                <th className="text-right py-3 px-3 font-black">الربح</th>
                <th className="text-right py-3 px-3 font-black">الهامش</th>
                <th className="text-right py-3 px-3 font-black">الحكم</th>
              </tr>
            </thead>
            <tbody>
              {scenarioRows.map((row) => {
                const good = row.profit > 0 && row.margin >= 10;
                const weak = row.profit > 0 && row.margin < 10;
                return (
                  <tr key={row.price} className="border-b border-slate-50 last:border-0">
                    <td className="py-3 px-3 font-black text-slate-800"><Money value={row.price} /></td>
                    <td className="py-3 px-3 text-slate-600 font-bold"><Money value={row.netRevenue} /></td>
                    <td className="py-3 px-3 text-slate-600 font-bold"><Money value={row.vatAmount} /></td>
                    <td className="py-3 px-3 text-slate-600 font-bold"><Money value={row.totalCosts} /></td>
                    <td className={`py-3 px-3 font-black ${row.profit >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}><Money value={row.profit} /></td>
                    <td className="py-3 px-3 font-black text-slate-800">{formatNumber(row.margin, { minimumFractionDigits: 1 })}%</td>
                    <td className="py-3 px-3">
                      <span className={`inline-flex px-3 py-1 rounded-full text-[11px] font-black ${good ? 'bg-emerald-50 text-emerald-700' : weak ? 'bg-amber-50 text-amber-700' : 'bg-rose-50 text-rose-700'}`}>
                        {good ? 'مناسب' : weak ? 'ضعيف' : 'خسارة'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
