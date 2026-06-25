export const ROLES = {
  ADMIN: 'admin',
  CEO: 'ceo',
  MANAGER: 'manager',
  OPERATIONS: 'operations',
  MARKETING: 'marketing',
  FINANCE: 'finance',
  CUSTOMER_SERVICE: 'customer_service',
  VIEWER: 'viewer',
  // دعم مؤقت لأي بيانات قديمة كانت تستخدم super_admin
  SUPER_ADMIN: 'super_admin',
};

export const DEFAULT_ROLE = ROLES.VIEWER;

export const ROLE_LABELS = {
  [ROLES.ADMIN]: 'Admin',
  [ROLES.CEO]: 'CEO',
  [ROLES.MANAGER]: 'Manager',
  [ROLES.OPERATIONS]: 'Operations',
  [ROLES.MARKETING]: 'Marketing',
  [ROLES.FINANCE]: 'Finance',
  [ROLES.CUSTOMER_SERVICE]: 'Customer Service',
  [ROLES.VIEWER]: 'Viewer',
  [ROLES.SUPER_ADMIN]: 'Admin',
};

export const normalizeRole = (role) => {
  if (role === ROLES.SUPER_ADMIN) return ROLES.ADMIN;
  return Object.values(ROLES).includes(role) ? role : DEFAULT_ROLE;
};

export const TAB_ACCESS = {
  ceo_executive: [ROLES.ADMIN, ROLES.CEO, ROLES.MANAGER, ROLES.MARKETING, ROLES.VIEWER],
  dashboard: [ROLES.ADMIN, ROLES.CEO, ROLES.MANAGER, ROLES.MARKETING, ROLES.VIEWER],
  department_inputs: [
    ROLES.ADMIN,
    ROLES.CEO,
    ROLES.MANAGER,
    ROLES.MARKETING,
    ROLES.OPERATIONS,
    ROLES.FINANCE,
    ROLES.CUSTOMER_SERVICE,
  ],
  price_simulator: [ROLES.ADMIN, ROLES.MANAGER, ROLES.MARKETING],
  stock: [ROLES.ADMIN, ROLES.MANAGER, ROLES.OPERATIONS, ROLES.VIEWER],
  movements: [ROLES.ADMIN, ROLES.MANAGER, ROLES.OPERATIONS, ROLES.VIEWER],
  orders: [ROLES.ADMIN, ROLES.MANAGER, ROLES.OPERATIONS, ROLES.VIEWER],
  crm: [ROLES.ADMIN, ROLES.MANAGER, ROLES.MARKETING, ROLES.VIEWER],
  import: [ROLES.ADMIN],
  between: [ROLES.ADMIN, ROLES.OPERATIONS],
  cs_returns: [ROLES.ADMIN, ROLES.OPERATIONS],
  data_admin: [ROLES.ADMIN],
  user_management: [ROLES.ADMIN],
};

export const PERMISSIONS = {
  DELETE_DATA: 'delete_data',
  IMPORT_DATA: 'import_data',
  MANAGE_BETWEEN: 'manage_between',
  MANAGE_RETURNS: 'manage_returns',
  WRITE_OPERATIONAL_DATA: 'write_operational_data',
  WRITE_DEPARTMENT_INPUTS: 'write_department_inputs',
  MANAGE_AD_COSTS: 'manage_ad_costs',
  MANAGE_USERS: 'manage_users',
};

export const ROLE_PERMISSIONS = {
  [ROLES.ADMIN]: Object.values(PERMISSIONS),
  [ROLES.CEO]: [],
  [ROLES.MANAGER]: [],
  [ROLES.OPERATIONS]: [
    PERMISSIONS.MANAGE_BETWEEN,
    PERMISSIONS.MANAGE_RETURNS,
    PERMISSIONS.WRITE_OPERATIONAL_DATA,
    PERMISSIONS.WRITE_DEPARTMENT_INPUTS,
  ],
  [ROLES.MARKETING]: [PERMISSIONS.MANAGE_AD_COSTS, PERMISSIONS.WRITE_DEPARTMENT_INPUTS],
  [ROLES.FINANCE]: [PERMISSIONS.WRITE_DEPARTMENT_INPUTS],
  [ROLES.CUSTOMER_SERVICE]: [PERMISSIONS.WRITE_DEPARTMENT_INPUTS],
  [ROLES.VIEWER]: [],
};

export const hasPermissionForRole = (role, permission) => {
  const normalizedRole = normalizeRole(role);
  return (ROLE_PERMISSIONS[normalizedRole] || []).includes(permission);
};
