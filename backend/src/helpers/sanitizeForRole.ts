/**
 * Elimina campos sensibles (priceBuy y profit) de los objetos enviados al cliente
 * cuando el rol no es admin.
 */

export function sanitizeForRole<T extends Record<string, any>>(
  obj: T,
  roles: string[]
): T {
  if (roles.includes('admin')) {
    return obj;
  }
  // función recursiva para procesar arrays y objetos anidados
  const clean = (value: any): any => {
    if (Array.isArray(value)) {
      return value.map(v => clean(v));
    }
    if (value && typeof value === 'object') {
      const result: Record<string, any> = {};
      for (const [k, v] of Object.entries(value)) {
        if (k === 'priceBuy' || k === 'profit' || k === 'systemTotalCash' || k === 'systemTotalCard' || k === 'systemTotalTransfer' || k === 'systemTotalOther' || k === 'difference') {
          continue;
        }
        result[k] = clean(v);
      }
      return result;
    }
    return value;
  };
  return clean(obj);
}
