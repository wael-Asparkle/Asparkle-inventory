import { useState } from 'react';
import { ROLES, DEFAULT_ROLE } from '../constants/ui';

export default function useAppData() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [currentUserRole] = useState(DEFAULT_ROLE);

  // 🔥 بيانات مؤقتة (تجريبية)
  const [productDetails] = useState({
    '9000904': { sku: '9000904', name: 'Moon Spark', openingStock: 100 },
    '9000905': { sku: '9000905', name: 'Spark Duo', openingStock: 80 },
    '9000906': { sku: '9000906', name: 'Spark Glow', openingStock: 60 },
    '9000908': { sku: '9000908', name: 'Spark Breeze', openingStock: 40 },
  });

  const [movements] = useState([
    { code: '9000904', quantity: 10, type: 'بيع' },
    { code: '9000905', quantity: 5, type: 'بيع' },
    { code: '9000906', quantity: 15, type: 'بيع' },
    { code: '9000908', quantity: 3, type: 'مرتجع' },
    { code: '9000904', quantity: 20, type: 'دخول بضاعة' },
  ]);

  const hasAccess = (allowedRoles = []) => {
    if (currentUserRole === ROLES.SUPER_ADMIN) return true;
    return allowedRoles.includes(currentUserRole);
  };

  return {
    activeTab,
    setActiveTab,
    currentUserRole,
    hasAccess,

    // 👇 أضفناهم هنا
    movements,
    productDetails,
  };
}
