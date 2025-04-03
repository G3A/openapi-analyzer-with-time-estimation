/**
 * Formatea un número usando coma como separador decimal.
 */
export function formatNumberCommaDecimal(num, decimals = 2) {
    if (typeof num !== 'number' || isNaN(num)) return '';
    const roundedNum = num.toFixed(decimals);
    return roundedNum.replace('.', ',');
}


/**
 * Escapa un valor para usarlo de forma segura en un CSV.
 */
export function escapeCsvValue(value, separator = ';') {
    if (value === null || value === undefined) return '';
    const stringValue = String(value);
    if (stringValue.includes(separator) || stringValue.includes('"') || stringValue.includes('\n') || stringValue.includes('\r')) {
        return `"${stringValue.replace(/"/g, '""')}"`;
    }
    return stringValue;
}