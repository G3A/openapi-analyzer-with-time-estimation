// --- Generate Test Suggestions & Estimate Effort ---
export const operationSuggestions = [];
export let operationHours = 0;

// Estimaciones (pueden ajustarse) - Más granularidad ahora
export const testTypeEstimations = {
    // Generales por operación
    "Happy Path": 0.75,
    "Contract Test (Response Schema)": 0.25,
    "Auth: Missing Credentials": 0.25,
    "Auth: Invalid Credentials": 0.25,
    // Validación (por parámetro/campo) - Costo base por campo inválido
    "Validation: Required Missing": 0.15,
    "Validation: Invalid Type": 0.15,
    "Validation: Invalid Format/Enum/Pattern": 0.20,
    "Validation: Malformed Body": 0.30, // Para JSON/XML inválido
    // Específicas por verbo
    "GET: Not Found (404)": 0.25,
    "GET: Filtering/Pagination (if params exist)": 0.5,
    "POST: Created (201 Check)": 0.25,
    "POST: Conflict (Duplicate?)": 0.40, // Potencial duplicado
    "PUT/PATCH: Not Found (404)": 0.25,
    "PUT: Idempotency Check": 0.25, // Requiere 2 llamadas (estimación simplificada)
    "DELETE: Not Found (404)": 0.25,
    "DELETE: Verify Inaccessible (needs GET)": 0.35, // Requiere 2 llamadas (estimación simplificada)
    "DELETE: Idempotency Check": 0.25, // Requiere 2 llamadas (estimación simplificada)
    // Otras
    "Security (Basic Headers, e.g., HSTS)": 0.15, // Prueba básica en happy path
    "Performance (Basic Check)": 0.10, // Prueba básica en happy path
};

export function addSuggestion(type, condition = true, details = '') {
    if (condition && testTypeEstimations[type]) {
         const hours = testTypeEstimations[type];
         const description = `${type}${details ? ` (${details})` : ''}`;
        operationSuggestions.push({
            operationId: operationId,
            verb: verb.toUpperCase(),
            path: pathname,
            type: type,
            description: description, // More specific description
            estimatedHours: hours
        });
        operationHours += hours;
        // Add to legend if new
         if (!suggestionsLegend.has(type)) {
             suggestionsLegend.set(type, `Estimated effort: ${Formatting.formatNumberCommaDecimal(hours)}h. Basic check for ${type.toLowerCase()}.`);
         }
    }
}

// --- Funciones Auxiliares ---

export function getSuggestionDescription(testType, verb) {
    // Descripciones más alineadas con los tipos específicos generados
    switch (testType) {
        case "Happy Path": return `[${verb.toUpperCase()}] ¿Responde correctamente con datos válidos? (Status 2xx)`;
        case "Contract Test (Response Schema)": return "¿La estructura de la respuesta coincide con la definición OpenAPI?";
        case "Auth: Missing Credentials": return "¿Bloquea el acceso si no se envían credenciales? (Status 401)";
        case "Auth: Invalid Credentials": return "¿Bloquea el acceso si las credenciales son inválidas? (Status 401)";
        case "Validation: Required Missing": return "¿Maneja parámetros/campos requeridos ausentes? (Status 400/422)";
        case "Validation: Invalid Type": return "¿Maneja tipos de datos incorrectos en parámetros/campos? (Status 400/422)";
        case "Validation: Invalid Format/Enum/Pattern": return "¿Maneja formatos, enums o patrones inválidos? (Status 400/422)";
        case "Validation: Malformed Body": return "¿Maneja cuerpos de solicitud malformados (e.g., JSON inválido)? (Status 400)";
        case "GET: Not Found (404)": return "[GET] ¿Maneja correctamente la solicitud de un recurso inexistente? (Status 404)";
        case "GET: Filtering/Pagination (if params exist)": return "[GET] ¿Funcionan los parámetros de filtrado, paginación u ordenamiento?";
        case "POST: Created (201 Check)": return "[POST] ¿Se crea el recurso y responde con 201 Created?";
        case "POST: Conflict (Duplicate?)": return "[POST] ¿Evita la creación de duplicados si la lógica lo requiere? (Status 409)";
        case "PUT/PATCH: Not Found (404)": return "[PUT/PATCH] ¿Maneja intento de actualizar un recurso inexistente? (Status 404)";
        case "PUT: Idempotency Check": return "[PUT] ¿Múltiples requests idénticas tienen el mismo efecto que una sola?";
        case "DELETE: Not Found (404)": return "[DELETE] ¿Maneja intento de eliminar un recurso inexistente? (Status 404)";
        case "DELETE: Verify Inaccessible (needs GET)": return "[DELETE] Tras eliminar, ¿el recurso ya no es accesible vía GET? (Requiere encadenamiento)";
        case "DELETE: Idempotency Check": return "[DELETE] ¿Múltiples requests idénticas tienen el mismo efecto que una sola?";
        case "Security (Basic Headers, e.g., HSTS)": return "¿Incluye cabeceras básicas de seguridad en la respuesta?";
        case "Performance (Basic Check)": return "¿El tiempo de respuesta está dentro de límites aceptables?";
        default: return `Descripción para ${testType}`; // Fallback
    }
}

// Función que usa switch para traducir testType y verb
export function getTestTypeDescription(testType, verb = '') {
    const key = verb ? `${verb}: ${testType}` : testType;
    
    switch (key) {
        case "Happy Path":
            return "Camino Feliz";
        case "Contract Test (Response Schema)":
            return "Prueba de Contrato (Esquema)";
        case "Auth: Missing Credentials":
            return "Autenticación: Sin Credenciales";
        case "Auth: Invalid Credentials":
            return "Autenticación: Credenciales Inválidas";
        case "Validation: Required Missing":
            return "Validación: Requerido Ausente";
        case "Validation: Invalid Type":
            return "Validación: Tipo Inválido";
        case "Validation: Invalid Format/Enum/Pattern":
            return "Validación: Formato/Enum/Patrón Inválido";
        case "Validation: Malformed Body":
            return "Validación: Cuerpo Malformado";
        case "GET: Not Found (404)":
            return "GET: No Encontrado (404)";
        case "GET: Filtering/Pagination (if params exist)":
            return "GET: Filtrado/Paginación";
        case "POST: Created (201 Check)":
            return "POST: Creado (Verificar 201)";
        case "POST: Conflict (Duplicate?)":
            return "POST: Conflicto (Duplicado?)";
        case "PUT/PATCH: Not Found (404)":
            return "PUT/PATCH: No Encontrado (404)";
        case "PUT: Idempotency Check":
            return "PUT: Verificación Idempotencia";
        case "DELETE: Not Found (404)":
            return "DELETE: No Encontrado (404)";
        case "DELETE: Verify Inaccessible (needs GET)":
            return "DELETE: Verificar Inaccesibilidad";
        case "DELETE: Idempotency Check":
            return "DELETE: Verificación Idempotencia";
        case "Security (Basic Headers, e.g., HSTS)":
            return "Seguridad (Cabeceras Básicas)";
        case "Performance (Basic Check)":
            return "Rendimiento (Verificación Básica)";
        default:
            return "Descripción no disponible";
    }
}