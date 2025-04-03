/**
 * Obtiene un valor anidado de un objeto usando notación de puntos.
 */
export function getNestedValue(obj, keyPath, defaultValue = undefined) {
    if (!obj || !keyPath) return defaultValue;
    const keys = keyPath.split('.');
    let current = obj;
    for (let i = 0; i < keys.length; i++) {
        const key = keys[i];
        if (current === null || typeof current !== 'object') {
            return defaultValue;
        }
        // Intentar encontrar la clave exacta primero
        if (Object.prototype.hasOwnProperty.call(current, key)) {
            current = current[key];
            continue;
        }
        // Si no, intentar buscar claves que contengan puntos
        let found = false;
        let combinedKey = key;
        for (let j = i + 1; j < keys.length; j++) {
            combinedKey += '.' + keys[j];
             if (Object.prototype.hasOwnProperty.call(current, combinedKey)) {
                current = current[combinedKey];
                i = j; // Avanzar el índice principal
                found = true;
                break;
            }
        }
        if (found) continue;
        // Si no se encontró ni la clave simple ni una combinada
        return defaultValue;
    }
    // Devolver defaultValue si el valor final es undefined, de lo contrario devolver el valor encontrado
    return current === undefined ? defaultValue : current;
}