import { useState } from 'react';
import { ROLES, DEFAULT_ROLE } from '../constants/ui';

export default function useAppData() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [currentUserRole] = useState(DEFAULT_ROLE);

  const hasAccess = (allowedRoles = []) => {
    if (currentUserRole === ROLES.SUPER_ADMIN) return true;
    return allowedRoles.includes(currentUserRole);
  };

  return {
    activeTab,
    setActiveTab,
    currentUserRole,
    hasAccess,
  };
}
