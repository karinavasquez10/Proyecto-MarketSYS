export const UNLIMITED_STOCK_VALUE = 999999;

export const isUnlimitedStock = (value) => Number(value || 0) >= UNLIMITED_STOCK_VALUE;

export const stockInputValue = (value) => (isUnlimitedStock(value) ? "" : String(value ?? ""));

export const stockSubmitValue = (value, unlimited = false) => {
  if (unlimited) return UNLIMITED_STOCK_VALUE;
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
};

export const formatStock = (value, unit = "", options = {}) => {
  if (isUnlimitedStock(value)) return "Ilimitado";
  const decimals = options.decimals ?? 2;
  const number = Number(value || 0).toLocaleString("es-CO", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  return `${number}${unit ? ` ${unit}` : ""}`;
};
