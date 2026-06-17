export const ROLES = {
  ADMIN: 'admin',
  MANAGER: 'manager',
  OPERATIONS: 'operations',
  MARKETING: 'marketing',
  VIEWER: 'viewer',
  // دعم مؤقت لأي بيانات قديمة كانت تستخدم super_admin
  SUPER_ADMIN: 'super_admin',
};

export const DEFAULT_ROLE = ROLES.VIEWER;

export const ROLE_LABELS = {
  [ROLES.ADMIN]: 'Admin',
  [ROLES.MANAGER]: 'Manager',
  [ROLES.OPERATIONS]: 'Operations',
  [ROLES.MARKETING]: 'Marketing',
  [ROLES.VIEWER]: 'Viewer',
  [ROLES.SUPER_ADMIN]: 'Admin',
};

export const normalizeRole = (role) => {
  if (role === ROLES.SUPER_ADMIN) return ROLES.ADMIN;
  return Object.values(ROLES).includes(role) ? role : DEFAULT_ROLE;
};

export const TAB_ACCESS = {
  dashboard: [ROLES.ADMIN, ROLES.MANAGER, ROLES.MARKETING, ROLES.VIEWER],
  stock: [ROLES.ADMIN, ROLES.MANAGER, ROLES.OPERATIONS, ROLES.VIEWER],
  movements: [ROLES.ADMIN, ROLES.MANAGER, ROLES.OPERATIONS, ROLES.VIEWER],
  orders: [ROLES.ADMIN, ROLES.MANAGER, ROLES.OPERATIONS, ROLES.VIEWER],
  crm: [ROLES.ADMIN, ROLES.MANAGER, ROLES.MARKETING, ROLES.VIEWER],
  import: [ROLES.ADMIN],
  between: [ROLES.ADMIN, ROLES.OPERATIONS],
  cs_returns: [ROLES.ADMIN, ROLES.OPERATIONS],
  data_admin: [ROLES.ADMIN],
};

export const PERMISSIONS = {
  DELETE_DATA: 'delete_data',
  IMPORT_DATA: 'import_data',
  MANAGE_BETWEEN: 'manage_between',
  MANAGE_RETURNS: 'manage_returns',
  WRITE_OPERATIONAL_DATA: 'write_operational_data',
  MANAGE_AD_COSTS: 'manage_ad_costs',
};

export const ROLE_PERMISSIONS = {
  [ROLES.ADMIN]: Object.values(PERMISSIONS),
  [ROLES.MANAGER]: [],
  [ROLES.OPERATIONS]: [
    PERMISSIONS.MANAGE_BETWEEN,
    PERMISSIONS.MANAGE_RETURNS,
    PERMISSIONS.WRITE_OPERATIONAL_DATA,
  ],
  [ROLES.MARKETING]: [PERMISSIONS.MANAGE_AD_COSTS],
  [ROLES.VIEWER]: [],
};

export const hasPermissionForRole = (role, permission) => {
  const normalizedRole = normalizeRole(role);
  return (ROLE_PERMISSIONS[normalizedRole] || []).includes(permission);
};
