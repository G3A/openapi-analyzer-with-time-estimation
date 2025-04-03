const fs = require('fs');
const yaml = require('js-yaml');
const path = require('path');
const { exec } = require('child_process');
const { v4: uuidv4 } = require('uuid'); // Para generar IDs únicos para la colección

// --- Configuración ---
const openapiFilePath=''; // <-- ¡IMPORTANTE! Pon la ruta correcta a tu archivo OpenAPI
const validHttpVerbs = ['get', 'post', 'put', 'delete', 'patch', 'options', 'head']; // Excluir trace
const excludePathKeywords = ['test', 'echo', 'prueba', 'health', 'ping', 'swagger', 'openapi'];
const csvSeparator = ';'; // Para compatibilidad Excel con formato español/europeo
const outputJsonFile = 'postman_collection.json';
const outputCsvFile = 'test_analysis_report.csv';
const outputHtmlFile = 'test_analysis_report.html'; // Nombre para el reporte HTML
const defaultBaseUrlVar = '{{baseUrl}}'; // Variable Postman para la URL base
const defaultTokenVar = '{{token}}'; // Variable Postman para el token (si se necesita)
const defaultApiKeyHeader = 'X-API-Key'; // Header común para API Key
const defaultApiKeyVar = '{{apiKey}}'; // Variable Postman para API Key (si se necesita)
const defaultResourceIdVar = '{{resourceId}}'; // Placeholder para IDs en paths
const nonExistentIdVar = '{{nonExistentId}}'; // Placeholder para IDs que no existen

const generateCsvReport = true; // Generar el reporte CSV?
const generateHtmlReport = true; // Generar el reporte HTML (recomendado para mejor formato)?
const generatePostmanCollection = true; // Generar la colección Postman?
const openReportAfterGeneration = true; // Abrir el reporte (HTML si existe, si no CSV) automáticamente?
const openPostmanAfterGeneration = false; // Intentar abrir Postman (puede no funcionar) - Requiere Newman o similar instalado y configurado

// Estimaciones (pueden ajustarse) - Más granularidad ahora
const testTypeEstimations = {
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
// --- Fin Configuración ---

// --- Funciones Auxiliares ---

function getSuggestionDescription(testType, verb) {
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
function getTestTypeDescription(testType, verb = '') {
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

/**
 * Escapa un valor para usarlo de forma segura en un CSV.
 */
function escapeCsvValue(value, separator = csvSeparator) {
    if (value === null || value === undefined) return '';
    const stringValue = String(value);
    if (stringValue.includes(separator) || stringValue.includes('"') || stringValue.includes('\n') || stringValue.includes('\r')) {
        return `"${stringValue.replace(/"/g, '""')}"`;
    }
    return stringValue;
}

/**
 * Formatea un número usando coma como separador decimal.
 */
function formatNumberCommaDecimal(num, decimals = 2) {
    if (typeof num !== 'number' || isNaN(num)) return '';
    const roundedNum = num.toFixed(decimals);
    return roundedNum.replace('.', ',');
}

/**
 * Obtiene un valor anidado de un objeto usando notación de puntos.
 */
 function getNestedValue(obj, keyPath, defaultValue = undefined) {
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


/**
 * Resuelve una referencia de schema JSON ($ref) dentro de la especificación OpenAPI.
 */
function resolveSchemaRef(ref, spec) {
     if (!ref || !ref.startsWith('#/')) return null;
     const pathSegments = ref.substring(2).split('/');
     let current = spec;
     try {
         for (const segment of pathSegments) {
             const decodedSegment = decodeURIComponent(segment.replace(/~1/g, '/').replace(/~0/g, '~'));
             if (current && typeof current === 'object' && Object.prototype.hasOwnProperty.call(current, decodedSegment)) {
                 current = current[decodedSegment];
             } else {
                 // console.warn(`Warning: Could not resolve schema reference: ${ref} (segment: ${decodedSegment})`);
                 return null;
             }
         }
     } catch (e) {
         console.error(`Error resolving schema reference ${ref}: ${e.message}`);
         return null;
     }
     return current;
 }

/**
 * Genera un ejemplo básico de datos basado en un schema OpenAPI.
 */
 function generateBasicSchemaExample(schema, spec, visitedRefs = new Set()) {
    if (!schema) return {};
    let resolvedSchema = schema;

    if (schema.$ref) {
        if (visitedRefs.has(schema.$ref)) {
           return `/* Recursive reference: ${schema.$ref} */`;
        }
        const currentVisitedRefs = new Set(visitedRefs);
        currentVisitedRefs.add(schema.$ref);
        resolvedSchema = resolveSchemaRef(schema.$ref, spec);
        if (!resolvedSchema) return {};
        return generateBasicSchemaExample(resolvedSchema, spec, currentVisitedRefs);
    }

    if (resolvedSchema.example !== undefined) return resolvedSchema.example;
    if (resolvedSchema.default !== undefined) return resolvedSchema.default;

     if (resolvedSchema.allOf && Array.isArray(resolvedSchema.allOf)) {
        let combinedExample = {};
        resolvedSchema.allOf.forEach(subSchema => {
             const subExample = generateBasicSchemaExample(subSchema, spec, new Set(visitedRefs));
             if (typeof subExample === 'object' && subExample !== null && typeof combinedExample === 'object' && combinedExample !== null) {
                 Object.assign(combinedExample, subExample); // Simple merge
             } else if (typeof subExample !== 'object' || subExample === null) {
                 if (Object.keys(combinedExample).length === 0 || typeof combinedExample !== 'object' || combinedExample === null) {
                      combinedExample = subExample; // Use primitive if combined is empty/primitive
                 }
             }
        });
         const primaryTypeSchema = resolvedSchema.allOf.find(s => s && s.type && s.type !== 'object');
         if (primaryTypeSchema) {
             const primitiveValue = generateBasicSchemaExample(primaryTypeSchema, spec, new Set(visitedRefs));
             if ((typeof primitiveValue !== 'object' || primitiveValue === null) && (typeof combinedExample !== 'object' || combinedExample === null || Object.keys(combinedExample).length === 0)) {
                 return primitiveValue;
             }
         }
        return combinedExample;
     }
     if (resolvedSchema.oneOf && Array.isArray(resolvedSchema.oneOf) && resolvedSchema.oneOf.length > 0) {
         return generateBasicSchemaExample(resolvedSchema.oneOf[0], spec, new Set(visitedRefs)); // Use first oneOf option
     }
     if (resolvedSchema.anyOf && Array.isArray(resolvedSchema.anyOf) && resolvedSchema.anyOf.length > 0) {
         return generateBasicSchemaExample(resolvedSchema.anyOf[0], spec, new Set(visitedRefs)); // Use first anyOf option
     }

    if (resolvedSchema.type === 'object') {
        let example = {};
         if (resolvedSchema.properties) {
            for (const prop in resolvedSchema.properties) {
                 const propSchema = resolvedSchema.properties[prop];
                 if (propSchema && propSchema.readOnly) continue;
                example[prop] = generateBasicSchemaExample(propSchema, spec, new Set(visitedRefs));
            }
         }
          else if (typeof resolvedSchema.additionalProperties === 'object' && resolvedSchema.additionalProperties !== null && Object.keys(resolvedSchema.additionalProperties).length > 0) {
            example['additionalProp1'] = generateBasicSchemaExample(resolvedSchema.additionalProperties, spec, new Set(visitedRefs));
         } else if (!resolvedSchema.properties && (resolvedSchema.additionalProperties === true || resolvedSchema.additionalProperties === undefined)) {
             example = {};
         } else if (resolvedSchema.additionalProperties === false && !resolvedSchema.properties) {
             example = {};
         }

         if (Array.isArray(resolvedSchema.required)) {
             resolvedSchema.required.forEach(reqProp => {
                 const propSchema = resolvedSchema.properties?.[reqProp];
                 const isReadOnly = propSchema?.readOnly === true;
                 if (!(reqProp in example) && !isReadOnly) {
                      example[reqProp] = `{{${reqProp}_value}}`; // Placeholder for required & missing
                 }
             });
         }
        return example;
    } else if (resolvedSchema.type === 'array' && resolvedSchema.items) {
        const minItems = resolvedSchema.minItems ?? 1;
        const maxItems = resolvedSchema.maxItems;
        const numItems = Math.max(minItems, (minItems === 0 && maxItems === 0) ? 0 : 1);
        const examples = [];
        const limitItems = Math.min(numItems, maxItems === 0 ? 0 : (maxItems ?? 2));

        for (let i = 0; i < limitItems; i++) {
            examples.push(generateBasicSchemaExample(resolvedSchema.items, spec, new Set(visitedRefs)));
        }
        return examples;
    } else {
        return generateBasicValueForType(resolvedSchema, spec);
    }
}

/**
 * Genera un valor primitivo básico basado en el tipo y formato del schema.
 */
function generateBasicValueForType(propSchema, spec) {
    if (propSchema && propSchema.example !== undefined) return propSchema.example;
    if (propSchema && propSchema.default !== undefined) return propSchema.default;

     const isNullable = propSchema?.nullable === true || (Array.isArray(propSchema?.type) && propSchema.type.includes('null'));
     let potentialTypes = Array.isArray(propSchema?.type) ? propSchema.type.filter(t => t !== 'null') : [propSchema?.type];
     if (potentialTypes.length === 0 && isNullable) return null;
     const type = potentialTypes[0] || 'string'; // Default to string if type is missing

    if (propSchema?.$ref) {
        const resolved = resolveSchemaRef(propSchema.$ref, spec);
        return resolved ? generateBasicSchemaExample(resolved, spec, new Set([propSchema.$ref])) : `{{ref_${propSchema.$ref.split('/').pop()}}}`;
    }

    const format = propSchema?.format;
    if (propSchema?.enum && propSchema.enum.length > 0) {
        return propSchema.enum[0];
    }

    switch (type) {
        case 'string':
            if (format === 'date-time') return new Date().toISOString();
            if (format === 'date') return new Date().toISOString().split('T')[0];
            if (format === 'email') return 'user@example.com';
            if (format === 'uuid') return uuidv4();
            if (format === 'byte') return 'U3dhZ2dlciByb2Nrcw=='; // Example base64 string
            if (format === 'binary') return '<<binary data placeholder>>'; // Placeholder
            if (propSchema?.pattern) {
                // Basic pattern matching attempts
                if (/^\d+$/.test(propSchema.pattern)) return "12345";
                if (/email/i.test(propSchema.pattern)) return 'pattern.email@example.com';
                if (/^[a-zA-Z]+$/.test(propSchema.pattern)) return "abc";
                return `string_pattern`; // Generic pattern placeholder
            }
            let str = 'string';
             if (propSchema?.minLength !== undefined) {
                 // Ensure the generated string meets minLength
                 str = 's'.repeat(Math.max(str.length, propSchema.minLength));
             }
             if (propSchema?.maxLength !== undefined && str.length > propSchema.maxLength) {
                 str = str.substring(0, propSchema.maxLength);
                 // Re-check minLength after potentially shortening for maxLength
                 if (propSchema?.minLength !== undefined && str.length < propSchema.minLength) {
                     // This scenario (minLength > maxLength) is invalid in OpenAPI spec, but handle defensively
                     str = 's'.repeat(propSchema.minLength); // Prioritize minLength if conflict
                     if(str.length > propSchema.maxLength) { // If still too long, spec is contradictory
                         // console.warn(`Contradictory minLength(${propSchema.minLength}) / maxLength(${propSchema.maxLength})`);
                         str = str.substring(0, propSchema.maxLength); // Cut again if still needed
                     }
                 }
             }
            return str;

case 'integer':
        case 'number':
            let num = 0;
            const minimum = propSchema?.minimum;
            const maximum = propSchema?.maximum;
            const exclusiveMinimum = propSchema?.exclusiveMinimum; // boolean (OAS 3.0) or number (OAS 3.1)
            const exclusiveMaximum = propSchema?.exclusiveMaximum; // boolean (OAS 3.0) or number (OAS 3.1)
            const multipleOf = propSchema?.multipleOf;

            let minBound = (typeof exclusiveMinimum === 'number') ? exclusiveMinimum : (exclusiveMinimum === true ? minimum : minimum);
            let maxBound = (typeof exclusiveMaximum === 'number') ? exclusiveMaximum : (exclusiveMaximum === true ? maximum : maximum);
            let minInclusive = (typeof exclusiveMinimum !== 'number' && exclusiveMinimum !== true);
            let maxInclusive = (typeof exclusiveMaximum !== 'number' && exclusiveMaximum !== true);

            // Start with a default or the lower bound if available
            num = (minBound !== undefined) ? minBound : 0;
            if (!minInclusive && minBound !== undefined) {
                num += (type === 'integer' ? 1 : 0.001); // Adjust if exclusive minimum
            }

            // If a maximum is defined and is greater than the current num, use it or something close
             if (maxBound !== undefined) {
                 let potentialMax = maxBound;
                 if (!maxInclusive) {
                     potentialMax -= (type === 'integer' ? 1 : 0.001); // Adjust if exclusive maximum
                 }
                 // Use max only if it's valid relative to min
                 if (minBound === undefined || potentialMax >= num) {
                     num = potentialMax;
                 } else if (minBound !== undefined) {
                     // If max < min, the schema is likely invalid, but try to use min
                     num = minBound;
                     if (!minInclusive) num += (type === 'integer' ? 1: 0.001);
                 }
             }

            // Adjust for multipleOf if necessary
            if (multipleOf !== undefined && multipleOf > 0) {
                 // Try to find a multiple close to the current num, respecting bounds
                 if (num >= 0) {
                    num = Math.floor(num / multipleOf) * multipleOf;
                 } else {
                     num = Math.ceil(num / multipleOf) * multipleOf;
                 }

                 // Ensure bounds are still respected after multipleOf adjustment
                 if (minBound !== undefined) {
                     while ((minInclusive && num < minBound) || (!minInclusive && num <= minBound)) {
                         num += multipleOf;
                     }
                 }
                 if (maxBound !== undefined) {
                     while ((maxInclusive && num > maxBound) || (!maxInclusive && num >= maxBound)) {
                          // If adjustments push it beyond max, it might be impossible, fallback needed
                         // For simplicity, let's try reducing first. If it goes below min, schema might be contradictory.
                         num -= multipleOf;
                         // Basic check to prevent infinite loop if min/max/multipleOf are contradictory
                         if(minBound !== undefined && ((minInclusive && num < minBound) || (!minInclusive && num <= minBound))) {
                             // console.warn("Contradictory bounds/multipleOf", propSchema);
                             // Reset to a bound as fallback
                             num = minBound !== undefined ? (minInclusive ? minBound : minBound + (type === 'integer' ? 1 : 0.001 )) : 0;
                             break; // Exit while loop
                         }

                     }
                 }
            }

             // Final check to ensure the number is within strict exclusive bounds if they were numbers (OAS 3.1)
             if(typeof exclusiveMinimum === 'number' && num <= exclusiveMinimum) {
                num = exclusiveMinimum + (type === 'integer'? 1 : 0.001); // Adjust if needed
                // Re-validate against multipleOf maybe needed here in complex cases
             }
              if(typeof exclusiveMaximum === 'number' && num >= exclusiveMaximum) {
                 num = exclusiveMaximum - (type === 'integer'? 1 : 0.001); // Adjust if needed
                 // Re-validate against multipleOf maybe needed here
             }


            return (type === 'integer') ? Math.round(num) : num; // Round for integer type

        case 'boolean':
            return true; // Default to true

        case 'array':
             // This case is mostly handled by generateBasicSchemaExample,
             // but as a fallback if called directly with type 'array' without items:
             return [];

        case 'object':
            // Similar fallback for objects without properties/additionalProperties defined:
            return { property: 'value' };

        default:
             // Handle cases where type might be an array (OAS 3.1) like ['string', 'null']
             // We already filtered 'null' earlier, so just return a generic value.
             // Or if type is unknown.
             if (isNullable) return null; // If null was an option, return it as last resort
             // console.warn(`Unknown schema type: ${type || JSON.stringify(propSchema)}`);
             return 'unknown_type_value';
    }
}

/**
 * Extracts security scheme information relevant for Postman auth.
 */
function getSecurityInfo(securityRequirements, spec) {
    if (!securityRequirements || securityRequirements.length === 0) return null;

    const securitySchemes = getNestedValue(spec, 'components.securitySchemes', {});
    // Simplification: Use the first defined security requirement option.
    // OpenAPI allows multiple options (e.g., apiKey OR oauth2), specified as OR logic.
    const firstRequirementOption = securityRequirements[0];
    // Inside an option, multiple schemes might be required (AND logic), e.g., { "apiKey": [], "oauth2": ["read"] }
    // For simplicity here, we'll primarily focus on the *first* scheme listed in the first option.
    // A more robust solution would handle multiple ANDed schemes if needed.
    const schemeName = Object.keys(firstRequirementOption)[0];
    if (!schemeName) return null; // No scheme name found in the first requirement

    const scheme = securitySchemes[schemeName];
    if (!scheme) {
        console.warn(`Warning: Security scheme '${schemeName}' not found in components.securitySchemes`);
        return null;
    }

    return {
        schemeName: schemeName,
        type: scheme.type, // e.g., 'apiKey', 'http', 'oauth2', 'openIdConnect'
        scheme: scheme.scheme, // e.g., 'bearer' for http bearer auth
        in: scheme.in, // e.g., 'header', 'query', 'cookie' for apiKey
        name: scheme.name // e.g., Header or query param name for apiKey/http (like 'Authorization')
        // Note: This doesn't extract scopes for OAuth2/OpenIDConnect yet.
    };
}

/**
 * Generates a Postman folder name from an API path.
 * Example: /users/{id}/orders -> Users Orders
 */
function getFolderName(pathname) {
    // Remove leading/trailing slashes, replace slashes with spaces, remove path parameters, title case
    return pathname
        .replace(/^\/|\/$/g, '') // Remove leading/trailing slashes
        .replace(/\{[^}]+\}/g, '') // Remove path parameters like {id}
        .replace(/\/+/g, ' ') // Replace slashes with spaces
        .replace(/_/g, ' ') // Replace underscores with spaces
        .trim()
        .toLowerCase()
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ') || 'Root'; // Default to 'Root' if empty
}

// --- Lógica Principal de Análisis ---

function analyzeOpenApi(openapiFile) {
    let spec;
    try {
        console.log(`Attempting to read OpenAPI spec from: ${openapiFile}`);
        const fileContents = fs.readFileSync(openapiFile, 'utf8');
        // Determine if YAML or JSON based on extension or content
        if (openapiFile.endsWith('.yaml') || openapiFile.endsWith('.yml')) {
            spec = yaml.load(fileContents);
        } else {
            spec = JSON.parse(fileContents); // Assume JSON otherwise
        }
        console.log("Spec loaded successfully.");
    } catch (e) {
        console.error(`Error reading or parsing OpenAPI file '${openapiFile}': ${e.message}`);
        return null;
    }

    if (!spec || !spec.paths) {
        console.error("Error: OpenAPI spec is invalid or 'paths' section not found.");
        return null;
    }

    const paths = spec.paths;
    const servers = spec.servers || [{ url: '/' }];
    // Use the URL from the first server definition. Handle potential variables within the URL.
    let rawBaseUrl = servers[0].url || '/';
    // Very basic variable substitution for common cases like {basePath}
    // A more robust solution would parse server variables properly
    rawBaseUrl = rawBaseUrl.replace(/\{[^}]+\}/, ''); // Remove simple variables for now
    // Ensure it ends with a slash if it's not just '/'
    rawBaseUrl = (rawBaseUrl !== '/' && !rawBaseUrl.endsWith('/')) ? rawBaseUrl + '/' : rawBaseUrl;

    // Determine if the base URL is absolute or relative
    const baseUrl = rawBaseUrl.startsWith('http') ? rawBaseUrl : defaultBaseUrlVar; // Use Postman var if relative or needs env substitution


    const postmanCollection = {
        info: {
            _postman_id: uuidv4(),
            name: getNestedValue(spec, 'info.title', 'Generated API Tests') + ` (${path.basename(openapiFile)})`,
            schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
            description: getNestedValue(spec, 'info.description', 'Auto-generated tests from OpenAPI spec')
        },
        item: [], // Folders and requests
        variable: [ // Collection variables
             { key: "baseUrl", value: baseUrl, type: "string", description: `Extracted from OpenAPI servers or default. Original: ${servers[0].url}` },
             { key: "token", value: "YOUR_TOKEN_HERE", type: "string", description: "Placeholder for Bearer token or similar credentials" },
             { key: "apiKey", value: "YOUR_API_KEY_HERE", type: "string", description: "Placeholder for API Key credentials" },
             { key: "resourceId", value: "1", type: "string", description: "Placeholder for a valid resource ID (e.g., for GET/PUT/DELETE)" },
             { key: "nonExistentId", value: "id-does-not-exist-999", type: "string", description:"Placeholder for a non-existent resource ID (for 404 tests)" }
         ]
        // Add server variables from OpenAPI spec if they exist
         // TODO: Add proper parsing of spec.servers[0].variables
    };

    const allTestSuggestions = []; // For reports
    let totalEstimatedHours = 0;
    const suggestionsLegend = new Map(); // Unique descriptions for legend
    const verbCounts = {};
    validHttpVerbs.forEach(verb => verbCounts[verb] = 0);
    let includedPathsCount = 0;
    let operationIdCount = 0;

    // Global security defined at the root level
    const globalSecurity = spec.security;

    console.log(`Analyzing paths...`);
    for (const pathname in paths) {
        const pathItem = paths[pathname];
        if (!pathItem) continue;

        // Exclude paths based on keywords
        const lowerPathname = pathname.toLowerCase();
        const excludeCurrentPath = excludePathKeywords.some(keyword => lowerPathname.includes(keyword));
        if (excludeCurrentPath) {
            // console.log(`Skipping path due to exclude keyword: ${pathname}`);
            continue;
        }
        includedPathsCount++;

        // Create or find the Postman folder for this path
        const folderName = getFolderName(pathname);
        let folder = postmanCollection.item.find(f => f.name === folderName);
        if (!folder) {
            folder = {
                name: folderName,
                item: [],
                description: `Requests for path: ${pathname}`
            };
            postmanCollection.item.push(folder);
        }

        // Iterate through HTTP methods (operations) for the current path
        for (const verb in pathItem) {
            if (!validHttpVerbs.includes(verb.toLowerCase())) continue;

            const operation = pathItem[verb];
            if (!operation) continue;

            const lowerVerb = verb.toLowerCase();
            verbCounts[lowerVerb]++;
            operationIdCount++;

            const operationId = operation.operationId || `${verb.toUpperCase()} ${pathname}`;
            const requestName = operation.summary || operationId; // Use summary if available
            // console.log(`  Processing Operation: ${requestName} (${verb.toUpperCase()} ${pathname})`);

            // Determine security for this operation (operation-level overrides global)
            const operationSecurity = operation.security !== undefined ? operation.security : globalSecurity;
            const securityInfo = getSecurityInfo(operationSecurity, spec);

            // --- Create Postman Request ---
            const postmanRequest = {
                name: requestName,
                _postman_id: uuidv4(),
                request: {
                    method: verb.toUpperCase(),
                    header: [],
                    url: {
                        // Use the baseUrl variable, an combine with the path.
                        // Need to handle path parameters like /users/{id} -> /users/:id
                        raw: `${defaultBaseUrlVar}${pathname.substring(1)}`, // Assuming baseUrl ends with /
                        host: [ defaultBaseUrlVar ],
                        path: pathname.substring(1).split('/'), // Postman path segments
                        query: [], // Query params added later
                        variable: [] // Path variables added later
                    },
                    description: operation.description || `Operation ID: ${operationId}`,
                    body: undefined, // Added later if needed
                    auth: undefined // Added later based on securityInfo
                },
                response: [] // Expected responses can be added here later if needed
                // event: [] // Test scripts added later
            };

            // --- Handle Authentication ---
            if (securityInfo) {
                switch(securityInfo.type) {
                    case 'apiKey':
                        postmanRequest.request.auth = {
                            type: 'apikey',
                            apikey: [
                                { key: "key", value: securityInfo.name, type: "string" }, // The header/query name
                                { key: "value", value: defaultApiKeyVar, type: "string" }, // The variable holding the key
                                { key: "in", value: securityInfo.in || 'header', type: "string" } // Where the key goes
                            ]
                        };
                        // Also add header directly for clarity if it's a header key (Postman often uses 'auth' helper OR direct header)
            if (securityInfo.in === 'header' && securityInfo.name) {
                postmanRequest.request.header.push({
                    key: securityInfo.name,
                    value: defaultApiKeyVar,
                    type: 'text',
                    description: `API Key (${securityInfo.schemeName})`
                });
            }
             // If it's a query param, add it (less common for API keys)
             else if (securityInfo.in === 'query' && securityInfo.name) {
                 postmanRequest.request.url.query.push({
                     key: securityInfo.name,
                     value: defaultApiKeyVar,
                     description: `API Key (${securityInfo.schemeName})`
                 });
             }
            break;
        case 'http':
            if (securityInfo.scheme?.toLowerCase() === 'bearer') {
                postmanRequest.request.auth = {
                    type: 'bearer',
                    bearer: [ { key: "token", value: defaultTokenVar, type: "string" } ]
                };
                // Header added automatically by Postman's Bearer auth helper
            } else if (securityInfo.scheme?.toLowerCase() === 'basic') {
                postmanRequest.request.auth = {
                    type: 'basic',
                    basic: [
                        // Postman requires username/password variables for its Basic Auth helper
                        { key: "username", value: "{{apiUsername}}", type: "string" }, // Add apiUsername/apiPassword vars if needed
                        { key: "password", value: "{{apiPassword}}", type: "string" }
                    ]
                };
                 // Add apiUsername/apiPassword to collection variables if not present
                if (!postmanCollection.variable.some(v => v.key === 'apiUsername')) {
                    postmanCollection.variable.push({ key: 'apiUsername', value: 'YOUR_USERNAME', type: 'string', description: 'Username for Basic Auth'});
                    postmanCollection.variable.push({ key: 'apiPassword', value: 'YOUR_PASSWORD', type: 'string', description: 'Password for Basic Auth'});
                }
            }
            // Other HTTP schemes (Digest, etc.) are less common and harder to auto-configure
            break;
        case 'oauth2':
            // OAuth2 is complex to fully automate in Postman collection generation.
            // Add a note or placeholder. Requires manual configuration in Postman.
            postmanRequest.request.auth = { type: 'oauth2' }; // Basic marker
            postmanRequest.description += "\n\n**Note:** OAuth2 detected. Manual configuration required in Postman's Authorization tab.";
            console.warn(`OAuth2 detected for ${operationId}. Requires manual Postman configuration.`);
            break;
        case 'openIdConnect':
            // Similar to OAuth2, requires manual setup.
            postmanRequest.description += "\n\n**Note:** OpenID Connect detected. Manual configuration required in Postman's Authorization tab.";
            console.warn(`OpenID Connect detected for ${operationId}. Requires manual Postman configuration.`);
            break;
        // Mutual TLS ('mutualTLS') might appear here but isn't directly handled by Postman auth helpers easily.
    }
} else {
     // No security defined, explicitly set auth to null or 'noauth'
     postmanRequest.request.auth = { type: 'noauth' };
}

// --- Handle Parameters (Path, Query, Header, Cookie) ---
const parameters = operation.parameters || [];
parameters.forEach(param => {
    // Resolve $ref if present
    let resolvedParam = param;
    if (param.$ref) {
        resolvedParam = resolveSchemaRef(param.$ref, spec);
        if (!resolvedParam) {
            console.warn(`Warning: Could not resolve parameter reference: ${param.$ref}`);
            return; // Skip if ref resolution failed
        }
    }

    const paramName = resolvedParam.name;
    const paramIn = resolvedParam.in; // 'query', 'path', 'header', 'cookie'
    const paramSchema = resolvedParam.schema || {}; // Schema for the parameter value
    // Generate a basic example value based on the schema
    const exampleValue = generateBasicValueForType(paramSchema, spec);
    // Use description from parameter or schema
    const description = resolvedParam.description || paramSchema.description || `${paramIn} parameter`;
    const required = resolvedParam.required || false;
    // Use placeholder based on type for better clarity in Postman
    let postmanValue = `{{${paramName}}}`; // Default placeholder

    // Generate a more specific placeholder or example if possible
     if (paramIn === 'path' && paramName.toLowerCase().includes('id')) {
         postmanValue = defaultResourceIdVar; // Use standard ID placeholder
     } else if (exampleValue !== null && exampleValue !== undefined && typeof exampleValue !== 'object') {
         // Use generated primitive example if available (don't use objects directly in param value)
         postmanValue = String(exampleValue);
     } else {
         // Fallback to generic placeholder like {{paramName}} or based on type
         postmanValue = `{{${paramName}_${paramSchema.type || 'value'}}}`;
     }


    switch (paramIn) {
        case 'path':
            // Replace {paramName} with :paramName in Postman raw URL
            // Note: Postman's URL object path array doesn't use :, it uses the variable definition below.
            // The `raw` URL should ideally be updated too, but Postman recalculates it.
            postmanRequest.request.url.variable.push({
                key: paramName,
                value: postmanValue, // Use placeholder like {{resourceId}} or {{paramName}}
                description: description + (required ? ' (Required)' : '')
            });
            break;
        case 'query':
            postmanRequest.request.url.query.push({
                key: paramName,
                value: postmanValue, // Use placeholder like {{paramName}}
                description: description + (required ? ' (Required)' : ''),
                disabled: !required // Disable optional params by default
            });
            break;
        case 'header':
            // Avoid adding auth headers that are handled by Postman's auth helpers
            const isAuthHeader = securityInfo && securityInfo.in === 'header' && securityInfo.name === paramName;
            // Also avoid common content-type headers that Postman adds based on body
            const isContentTypeHeader = paramName.toLowerCase() === 'content-type';
            if (!isAuthHeader && !isContentTypeHeader) {
                postmanRequest.request.header.push({
                    key: paramName,
                    value: postmanValue, // Use placeholder {{paramName}}
                    description: description + (required ? ' (Required)' : ''),
                    type: 'text', // Default type for headers
                    disabled: !required
                });
            }
            break;
        case 'cookie':
            // Add to headers array using Cookie syntax
            postmanRequest.request.header.push({
                key: 'Cookie',
                // Simple case: one cookie. Real scenario might need merging.
                value: `${paramName}=${postmanValue}`,
                description: `Cookie Param: ${description}` + (required ? ' (Required)' : ''),
                type: 'text',
                disabled: !required
            });
            // Note: Managing cookies properly often requires pre-request scripts in Postman.
            break;
    }
});

 // --- Handle Request Body ---
 if (operation.requestBody) {
     let resolvedRequestBody = operation.requestBody;
     if (resolvedRequestBody.$ref) {
         resolvedRequestBody = resolveSchemaRef(resolvedRequestBody.$ref, spec);
     }

     if (resolvedRequestBody && resolvedRequestBody.content) {
         // Find the first supported content type (prioritize JSON)
         const supportedTypes = Object.keys(resolvedRequestBody.content);
         const preferredType = supportedTypes.includes('application/json') ? 'application/json' :
                               supportedTypes.includes('*/*') ? 'application/json' : // Assume JSON for */*
                               supportedTypes.includes('application/x-www-form-urlencoded') ? 'application/x-www-form-urlencoded' :
                               supportedTypes.includes('multipart/form-data') ? 'multipart/form-data' :
                               supportedTypes[0]; // Fallback to the first listed type

         if (preferredType) {
             const contentSchemaInfo = resolvedRequestBody.content[preferredType];
             const schema = contentSchemaInfo.schema;

             if (schema) {
                 const bodyExample = generateBasicSchemaExample(schema, spec);
                 const bodyMode = preferredType === 'application/x-www-form-urlencoded' ? 'urlencoded' :
                                  preferredType === 'multipart/form-data' ? 'formdata' :
                                  'raw'; // Default to raw for JSON, XML, text, etc.

                 postmanRequest.request.body = { mode: bodyMode };

                  // Add Content-Type header unless it's form-data/urlencoded (Postman adds these automatically)
                 if (bodyMode === 'raw') {
                     postmanRequest.request.header.push({ key: 'Content-Type', value: preferredType, type: 'text' });
                     // Format raw body (assuming JSON for now)
                     try {
                         postmanRequest.request.body.raw = JSON.stringify(bodyExample, null, 2);
                         postmanRequest.request.body.options = { raw: { language: 'json' } };
                     } catch (e) {
                         // Handle potential circular references or errors during stringify
                         console.warn(`Could not stringify body example for ${operationId}: ${e.message}`);
                         postmanRequest.request.body.raw = `// Error generating example: ${e.message}\n${JSON.stringify(bodyExample)}`; // Put raw object as fallback comment
                     }
                 } else if (bodyMode === 'urlencoded' || bodyMode === 'formdata') {
                     // Convert object properties to Postman's key-value format
                     postmanRequest.request.body[bodyMode] = [];
                     if (typeof bodyExample === 'object' && bodyExample !== null) {
                         for (const key in bodyExample) {
                             // Skip readOnly properties for request bodies
                             const propSchema = schema?.properties?.[key];
                             if(propSchema?.readOnly) continue;

                             let value = bodyExample[key];
                             // For file uploads in formdata, value needs special handling (usually left empty or placeholder)
                             const isFile = propSchema?.type === 'string' && (propSchema?.format === 'binary' || propSchema?.format === 'byte');

                             if (bodyMode === 'formdata' && isFile) {
                                  postmanRequest.request.body[bodyMode].push({
                                     key: key,
                                     type: 'file', // Indicate file upload
                                     src: [], // Postman UI uses this, leave empty for collection
                                     description: getNestedValue(propSchema, 'description', '')
                                 });
                             } else {
                                 // Stringify nested objects/arrays for form data if needed, or use simple value
                                 value = (typeof value === 'object' && value !== null) ? JSON.stringify(value) : String(value ?? '');
                                 postmanRequest.request.body[bodyMode].push({
                                     key: key,
                                     value: value,
                                     type: 'text', // Default type
                                     description: getNestedValue(propSchema, 'description', '')
                                 });
                             }
                         }
                     }
                 }
             }
         }
     }
 }


// --- Generate Test Suggestions & Estimate Effort ---
const operationSuggestions = [];
let operationHours = 0;

function addSuggestion(type, condition = true, details = '') {
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
             suggestionsLegend.set(type, `Estimated effort: ${formatNumberCommaDecimal(hours)}h. Basic check for ${type.toLowerCase()}.`);
         }
    }
}

 // Basic Happy Path + Contract Test for all operations
addSuggestion("Happy Path");
addSuggestion("Contract Test (Response Schema)", !!operation.responses?.['200'] || !!operation.responses?.['201']);

// Auth Tests (if security is defined)
 const hasSecurity = !!securityInfo;
addSuggestion("Auth: Missing Credentials", hasSecurity);
addSuggestion("Auth: Invalid Credentials", hasSecurity);

// Validation Tests (Params & Body)
 let requiredParams = parameters.filter(p => p.required);
 let bodySchema = getNestedValue(operation, 'requestBody.content.application/json.schema'); // Basic check for JSON body schema
 if (!bodySchema && operation.requestBody?.content) {
     // Try first content type if not JSON
     const firstType = Object.keys(operation.requestBody.content)[0];
     bodySchema = operation.requestBody.content[firstType]?.schema;
 }

requiredParams.forEach(p => addSuggestion("Validation: Required Missing", true, `${p.in} param: ${p.name}`));
parameters.forEach(p => {
    addSuggestion("Validation: Invalid Type", true, `${p.in} param: ${p.name}`);
    if (p.schema?.format || p.schema?.enum || p.schema?.pattern) {
         addSuggestion("Validation: Invalid Format/Enum/Pattern", true, `${p.in} param: ${p.name}`);
    }
});

if (bodySchema) {
     // Generic malformed body test
     addSuggestion("Validation: Malformed Body");
     // Check for required fields within the body schema (simplified)
     const requiredBodyProps = resolveSchemaRef(bodySchema.$ref, spec)?.required || bodySchema.required || [];
     // console.log("Req props:", requiredBodyProps, bodySchema) // Debug
     requiredBodyProps.forEach(prop => addSuggestion("Validation: Required Missing", true, `body field: ${prop}`));

     // Check for type/format validation on body fields (simplified - add one test per category)
     if (bodySchema.properties && Object.values(bodySchema.properties).some(p => p.type)) {
         addSuggestion("Validation: Invalid Type", true, "body field type");
     }
     if (bodySchema.properties && Object.values(bodySchema.properties).some(p => p.format || p.enum || p.pattern)) {
          addSuggestion("Validation: Invalid Format/Enum/Pattern", true, "body field format/enum/pattern");
     }
}


// Verb-Specific Tests
const hasPathId = pathname.includes('{') && pathname.includes('}'); // Simple check for path parameters
switch (lowerVerb) {
    case 'get':
        addSuggestion("GET: Not Found (404)", hasPathId); // Only suggest if likely fetching specific resource
        const hasQueryOrFilterParams = parameters.some(p => p.in === 'query' && (p.name.includes('filter') || p.name.includes('page') || p.name.includes('limit') || p.name.includes('sort')));
		addSuggestion("GET: Filtering/Pagination (if params exist)", hasQueryOrFilterParams);
                    break;
                case 'post':
                    addSuggestion("POST: Created (201 Check)", !!operation.responses?.['201']);
                    addSuggestion("POST: Conflict (Duplicate?)", !!operation.responses?.['409']); // Check if 409 response is defined
                    break;
                case 'put':
                    addSuggestion("PUT/PATCH: Not Found (404)", hasPathId);
                    addSuggestion("PUT: Idempotency Check", hasPathId); // PUT should be idempotent
                    break;
                case 'patch':
                    addSuggestion("PUT/PATCH: Not Found (404)", hasPathId);
                    // PATCH is not necessarily idempotent, so no idempotency check by default
                    break;
                case 'delete':
                    addSuggestion("DELETE: Not Found (404)", hasPathId);
                    addSuggestion("DELETE: Verify Inaccessible (needs GET)", hasPathId);
                    addSuggestion("DELETE: Idempotency Check", hasPathId); // DELETE should be idempotent
                    break;
            }

            // Other Basic Checks (apply to most operations)
            addSuggestion("Security (Basic Headers, e.g., HSTS)"); // Often checked on Happy Path response
            addSuggestion("Performance (Basic Check)"); // Often checked on Happy Path response


            // --- Add Postman Request Tests (Optional - Basic Examples) ---
            // You could add basic Postman test scripts here, e.g., status code checks
            postmanRequest.event = [
                 {
                     listen: "test",
                     script: {
                         id: uuidv4(),
                         type: "text/javascript",
                          // Basic status code check based on expected success response
                         exec: [
                             `// Basic Happy Path Status Code Check`,
                             `// TODO: Adapt expected code based on OpenAPI spec (e.g., 201 for POST, 204 for DELETE)`,
                             `let expectedStatusCode = ${lowerVerb === 'post' ? 201 : (lowerVerb === 'delete' ? 204 : 200)};`,
                              `pm.test("Status code is " + expectedStatusCode, function () {`,
                              `    pm.response.to.have.status(expectedStatusCode);`,
                              `});`,
                              ``,
                              `// TODO: Add more tests based on suggestions:`,
                              operationSuggestions.map(s => `// - ${s.description}`).join('\n'),
                              ``,
                              `// Example: Contract Test (requires schema in environment/collection var)`,
                              `/*`,
                              `const schema = pm.collectionVariables.get("schema_${operationId}");`,
                              `if (schema) {`,
                              `    pm.test("Response schema is valid", function() {`,
                              `        const responseData = pm.response.json();`,
                              `        pm.response.to.have.jsonSchema(JSON.parse(schema));`,
                              `    });`,
                              `}`,
                              `*/`
                         ]
                     }
                 }
             ];


            // Add the generated request to the folder
            folder.item.push(postmanRequest);

            // Aggregate suggestions and hours
            allTestSuggestions.push(...operationSuggestions);
            totalEstimatedHours += operationHours;

        } // End loop through verbs
    } // End loop through paths

    console.log(`Analysis complete. Processed ${includedPathsCount} paths and ${operationIdCount} operations.`);

    // Sort folders alphabetically
    postmanCollection.item.sort((a, b) => a.name.localeCompare(b.name));

    return {
        collection: postmanCollection,
        suggestions: allTestSuggestions,
        legend: suggestionsLegend,
        summary: {
            totalPaths: includedPathsCount,
            totalOperations: operationIdCount,
            totalSuggestions: allTestSuggestions.length,
            totalEstimatedHours: totalEstimatedHours,
            verbCounts: verbCounts
        }
    };
}


// --- Report Generation Functions ---

function generateCsvReportContent(analysisResult) {
    const { suggestions, summary, legend } = analysisResult;
    //Con let csvContent = "\ufeff", de esta forma, el archivo CSV incluirá el BOM y muchos visores (como Excel) reconocerán correctamente los caracteres acentuados.
    let csvContent = "\ufeff"; 

    // Header
    csvContent += `Test Analysis Report\n`;
    csvContent += `Generated: ${new Date().toISOString()}\n\n`;

    // Summary Section
    csvContent += `Summary\n`;
    csvContent += `Total Paths Analyzed${csvSeparator}${summary.totalPaths}\n`;
    csvContent += `Total Operations Found${csvSeparator}${summary.totalOperations}\n`;
    csvContent += `Total Test Suggestions${csvSeparator}${summary.totalSuggestions}\n`;
    csvContent += `Total Estimated Hours${csvSeparator}${formatNumberCommaDecimal(summary.totalEstimatedHours)}\n`;
    csvContent += `Operations by Verb:\n`;
    for (const verb in summary.verbCounts) {
        if (summary.verbCounts[verb] > 0) { // Only show verbs that were found
            csvContent += `${verb.toUpperCase()}${csvSeparator}${summary.verbCounts[verb]}\n`;
        }
    }
    csvContent += `\n`; // Separator line

    // Legend Section
    csvContent += `Test Type Legend\n`;
    csvContent += `Type${csvSeparator}Description\n`;
    legend.forEach((desc, type) => {
        csvContent += `${escapeCsvValue(type)}${csvSeparator}${escapeCsvValue(desc)}\n`;
    });
    csvContent += `\n`; // Separator line

    // Suggestions Table Header
    // Note: CSV alignment is determined by the viewing application (Excel, Sheets, etc.)
    // We ensure clean data without extra spaces.
    const headers = ["Operation ID", "Verb", "Path", "Test Type", "Test Description", "Est. Hours"];
    csvContent += headers.map(h => escapeCsvValue(h)).join(csvSeparator) + '\n';

    // Suggestions Table Rows
    suggestions.forEach(s => {
        const row = [
            s.operationId,
            s.verb,
            s.path,
            getTestTypeDescription(s.type),
			getSuggestionDescription(s.type,s.verb),
            formatNumberCommaDecimal(s.estimatedHours) // Format hours with comma decimal
        ];
        csvContent += row.map(cell => escapeCsvValue(cell)).join(csvSeparator) + '\n';
    });

    return csvContent;
}

function generateHtmlReportContent(analysisResult) {
    const { suggestions, summary, legend } = analysisResult;

    let htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Test Analysis Report</title>
    <style>
        body { font-family: sans-serif; line-height: 1.6; padding: 20px; }
        h1, h2, h3 { color: #333; border-bottom: 1px solid #eee; padding-bottom: 5px; margin-top: 30px;}
        table { border-collapse: collapse; width: 100%; margin-bottom: 20px; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f2f2f2; font-weight: bold; }
        tr:nth-child(even) { background-color: #f9f9f9; }
        .summary-table td:first-child { font-weight: bold; width: 200px; }
        .legend-table td:first-child { font-weight: bold; width: 250px; }
        .suggestions-table th:last-child, .suggestions-table td:last-child { text-align: right; } /* Align hours right */
        .container { max-width: 1200px; margin: auto; }
        code { background-color: #eee; padding: 2px 4px; border-radius: 3px; }
    </style>
</head>
<body>
    <div class="container">
        <h1>Test Analysis Report</h1>
        <p>Generated: ${new Date().toISOString()}</p>

        <h2>Summary</h2>
        <table class="summary-table">
            <tr><td>Total Paths Analyzed:</td><td>${summary.totalPaths}</td></tr>
            <tr><td>Total Operations Found:</td><td>${summary.totalOperations}</td></tr>
            <tr><td>Total Test Suggestions:</td><td>${summary.totalSuggestions}</td></tr>
            <tr><td>Total Estimated Hours:</td><td>${formatNumberCommaDecimal(summary.totalEstimatedHours)}</td></tr>
            <tr><td colspan="2"><strong>Operations by Verb:</strong></td></tr>
            ${Object.entries(summary.verbCounts).filter(([, count]) => count > 0).map(([verb, count]) => `<tr><td>${verb.toUpperCase()}</td><td>${count}</td></tr>`).join('')}
        </table>

        <h2>Test Type Legend</h2>
        <table class="legend-table">
            <thead><tr><th>Type</th><th>Description</th></tr></thead>
            <tbody>
                ${Array.from(legend.entries()).map(([type, desc]) => `<tr><td>${type}</td><td>${desc}</td></tr>`).join('')}
            </tbody>
        </table>

        <h2>Test Suggestions</h2>
        <table class="suggestions-table">
            <thead>
                <tr>
                    <th>Operation ID / Summary</th>
                    <th>Verb</th>
                    <th>Path</th>
                    <th>Test Type</th>
                    <th>Test Description</th>
                    <th>Est. Hours</th>
                </tr>
            </thead>
            <tbody>
                ${suggestions.map(s => `
                <tr>
                    <td>${s.operationId}</td>
                    <td>${s.verb}</td>
                    <td><code>${s.path}</code></td>
                    <td>${getTestTypeDescription(s.type)}</td>
                    <td><div>${s.description} </br> ${getSuggestionDescription(s.type,s.verb)}</div></td>
                    <td>${formatNumberCommaDecimal(s.estimatedHours)}</td>
                </tr>`).join('')}
            </tbody>
        </table>
    </div>
</body>
</html>`;
    return htmlContent;
}


// --- Main Execution ---

(async () => {
	const args = process.argv.slice(2);
    if (args.length === 0) {
        console.error("Uso: node analyze_openapi.js <ruta_al_archivo_openapi.yaml_o_json>");
        process.exit(1);
    }
    const openapiFilePath = args[0];
    if (!fs.existsSync(openapiFilePath)) {
        console.error(`Error: OpenAPI file not found at '${openapiFilePath}'. Please update the 'openapiFilePath' variable in the script.`);
        process.exit(1);
    }

    const analysisResult = analyzeOpenApi(openapiFilePath);

    if (!analysisResult) {
        console.error("Analysis failed. Exiting.");
        process.exit(1);
    }

    // Generate Postman Collection
    if (generatePostmanCollection) {
        try {
            fs.writeFileSync(outputJsonFile, JSON.stringify(analysisResult.collection, null, 2), 'utf8');
            console.log(`Postman collection saved to: ${outputJsonFile}`);
            if (openPostmanAfterGeneration) {
                console.log("Attempting to open Postman (requires Postman installed and accessible)...");
                try {
                    // This is platform-dependent and might not work reliably
                    const command = process.platform === 'win32' ? `start "" "${outputJsonFile}"` :
                                    process.platform === 'darwin' ? `open "${outputJsonFile}"` :
                                    `xdg-open "${outputJsonFile}"`; // Linux
                    exec(command, (err) => {
                        if (err) console.warn("Could not automatically open Postman:", err.message);
                    });
                } catch (e) {
                     console.warn("Failed to execute command to open Postman:", e.message);
                }
            }
        } catch (e) {
            console.error(`Error writing Postman collection file: ${e.message}`);
        }
    }

    // Generate CSV Report
     let reportToOpen = null;
    if (generateCsvReport) {
        try {
            const csvData = generateCsvReportContent(analysisResult);
            fs.writeFileSync(outputCsvFile, csvData, 'utf8');
            console.log(`CSV analysis report saved to: ${outputCsvFile}`);
            reportToOpen = outputCsvFile; // Set CSV as the file to open by default
        } catch (e) {
            console.error(`Error writing CSV report file: ${e.message}`);
        }
    }

    // Generate HTML Report
    if (generateHtmlReport) {
        try {
            const htmlData = generateHtmlReportContent(analysisResult);
            fs.writeFileSync(outputHtmlFile, htmlData, 'utf8');
            console.log(`HTML analysis report saved to: ${outputHtmlFile}`);
            reportToOpen = outputHtmlFile; // Prefer opening HTML if generated
        } catch (e) {
            console.error(`Error writing HTML report file: ${e.message}`);
        }
    }

    // Open the generated report (HTML preferred)
    if (openReportAfterGeneration && reportToOpen) {
        console.log(`Attempting to open report: ${reportToOpen}`);
        try {
            const command = process.platform === 'win32' ? `start "" "${reportToOpen}"` :
                            process.platform === 'darwin' ? `open "${reportToOpen}"` :
                            `xdg-open "${reportToOpen}"`; // Linux
             exec(command, (err) => {
                 if (err) console.warn(`Could not automatically open report file '${reportToOpen}': ${err.message}`);
             });
        } catch (e) {
            console.warn(`Failed to execute command to open report file '${reportToOpen}': ${e.message}`);
        }
    }

})(); // Immediately invoke the async function