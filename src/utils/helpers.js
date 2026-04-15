export const safeConfirm = (msg) => {
  if (typeof window !== 'undefined') return window.confirm(msg);
  return false;
};

export const formatCurrency = (value) => {
  return `${(value || 0).toLocaleString()} ﷼`;
};
