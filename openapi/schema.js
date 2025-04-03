/**
 * Resuelve una referencia de schema JSON ($ref) dentro de la especificación OpenAPI.
 */
export function resolveSchemaRef(ref, spec) {
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
export function generateBasicSchemaExample(schema, spec, visitedRefs = new Set()) {
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
export function generateBasicValueForType(propSchema, spec) {
    if (propSchema && propSchema.example !== undefined) return propSchema.example;
    if (propSchema && propSchema.default !== undefined) return propSchema.default;

     const isNullable = propSchema?.nullable === true || (Array.isArray(propSchema?.type) && propSchema.type.includes('null'));
     let potentialTypes = Array.isArray(propSchema?.type) ? propSchema.type.filter(t => t !== 'null') : [propSchema?.type];
     if (potentialTypes.length === 0 && isNullable) return null;
     const type = potentialTypes[0] || 'string'; // Default to string if type is missing

    if (propSchema?.$ref) {
        const resolved = resolveSchemaRef(propSchema.$ref, spec);
        return resolved ? ObjectUtils.generateBasicSchemaExample(resolved, spec, new Set([propSchema.$ref])) : `{{ref_${propSchema.$ref.split('/').pop()}}}`;
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
             // This case is mostly handled by ObjectUtils.generateBasicSchemaExample,
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