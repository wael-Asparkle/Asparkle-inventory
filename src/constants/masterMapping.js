// ============================================================
//  Master Mapping — Attribution + Bundle Logic
//  SKU  = ماذا بعنا  (للمخزون)
//  ASG  = كيف بعناه (للتسويق)
// ============================================================

export const PRODUCT_CATALOG = {
  '9000901': { name: 'اسباركل',      unitCost: 22.05, sellingPrice: 69  },
  '9000902': { name: 'سجنتشر',       unitCost: 19.24, sellingPrice: 69  },
  '9000904': { name: 'Moon Spark',   unitCost: null,  sellingPrice: null },
  '9000905': { name: 'Spark Duo',    unitCost: null,  sellingPrice: null },
  '9000906': { name: 'Spark Glow',   unitCost: null,  sellingPrice: null },
  '9000908': { name: 'Spark Breeze', unitCost: null,  sellingPrice: null },
  '9000909': { name: 'Spark Ash',    unitCost: null,  sellingPrice: null },
};

// تكلفة البكجات
export const BUNDLE_COSTS = {
  asg001: { unitCost: 41.29,  sellingPrice: 99  },
  asg002: { unitCost: 101.94, sellingPrice: 199 },
  asg003: { unitCost: 101.94, sellingPrice: 199 },
  asg004: { unitCost: 101.94, sellingPrice: 199 },
};

// تكاليف القنوات التسويقية الثابتة
export const CHANNEL_COSTS = {
  'سعيدينيو':        5000,
  'واتساب':          700,
  'دستور':           15000,
  'TikTok/Snapchat': 2500,
};

// ============================================================
//  ASG Mapping
//  items     = المنتجات التي تُخصم من المخزون
//  channel   = القناة التسويقية (ثابتة أو حسب التاريخ)
// ============================================================
export const ASG_MAPPING = {
  asg001: {
    type: 'bundle',
    items: ['9000901', '9000902'],
    // القناة تتغير حسب التاريخ
    channelTimeline: [
      { from: '2026-01-01', to: '2026-02-25', channel: 'سعيدينيو' },
      { from: '2026-02-26', to: null,          channel: 'واتساب'   },
    ],
  },
  asg002: {
    type: 'bundle',
    items: ['9000904', '9000905', '9000906', '9000908', '9000909'],
    channel: 'دستور',
  },
  asg003: {
    type: 'bundle',
    items: ['9000904', '9000905', '9000906', '9000908', '9000909'],
    channel: 'TikTok/Snapchat',
  },
  asg004: {
    type: 'bundle',
    items: ['9000904', '9000905', '9000906', '9000908', '9000909'],
    channel: 'واتساب',
  },
};

// ============================================================
//  Attribution Engine
//  يُعيد القناة الصحيحة بناءً على ASG + تاريخ الطلب
// ============================================================
export function resolveChannel(asgCode, orderDate) {
  const mapping = ASG_MAPPING[asgCode];
  if (!mapping) return 'غير محدد';

  // قناة ثابتة
  if (mapping.channel) return mapping.channel;

  // قناة حسب التاريخ
  if (mapping.channelTimeline) {
    const date = new Date(orderDate);
    for (const entry of mapping.channelTimeline) {
      const from = new Date(entry.from);
      const to   = entry.to ? new Date(entry.to) : null;
      if (date >= from && (!to || date <= to)) return entry.channel;
    }
  }

  return 'غير محدد';
}

// ============================================================
//  Bundle Resolver
//  يُعيد قائمة الـ SKU الفعلية التي تُخصم من المخزون
//  مع الكميات — يدعم ASG codes + SKU مباشر + متعدد
// ============================================================
export function resolveSkusFromRaw(rawSku) {
  // ممكن يكون فيه أكثر من كود مفصول بفاصلة: "asg001, 9000902"
  const codes = rawSku
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  const skuMap = {}; // { sku: qty }

  codes.forEach((code) => {
    const asg = ASG_MAPPING[code];

    if (asg) {
      // بكج → فك إلى مكوناته
      asg.items.forEach((sku) => {
        skuMap[sku] = (skuMap[sku] || 0) + 1;
      });
    } else {
      // SKU مباشر
      skuMap[code] = (skuMap[code] || 0) + 1;
    }
  });

  return skuMap; // { '9000901': 1, '9000902': 2, ... }
}

// ============================================================
//  Row Parser
//  يُحوّل صف Excel إلى كائن طلب منظم
// ============================================================
export function parseOrderRow(row) {
  const rawSku   = String(row['SKU'] || '').trim();
  const date     = String(row['تاريخ الطلب'] || '').trim();
  const asgCodes = rawSku.split(',').map((s) => s.trim()).filter((s) => ASG_MAPPING[s]);
  const channel  = asgCodes.length > 0 ? resolveChannel(asgCodes[0], date) : 'مباشر';
  const skuMap   = resolveSkusFromRaw(rawSku);

  return {
    reference:   String(row['رقم الطلب'] || '').trim(), 
    customer: {
      name:  String(row['اسم العميل']  || '').trim(),
      phone: String(row['رقم الجوال']  || '').trim(),
      city:  String(row['المدينة']     || '').trim(),
    },
    rawSku,
    asgCode:       asgCodes[0] || null,
    channel,
    skuBreakdown:  skuMap,
    paymentMethod: String(row['طريقة الدفع']   || '').trim(),
    total:         parseFloat(row['إجمالي الطلب (شامل التخفيضات)']) || 0,,
    date,
  };
}
