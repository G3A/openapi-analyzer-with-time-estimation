import fs from 'fs';
import yaml from 'js-yaml';
import { v4 as uuidv4 } from 'uuid'; // Para generar IDs únicos para la colección
import * as ObjectUtils from '../utils/object.js';
import path from 'path';
import * as PathUtils from '../utils/path.js';
import * as OpenApiSecurity from './security.js';
import * as SchemasOpenApi from './schema.js';
import * as OpenApiSuggestion from './suggestion.js';
import * as Formatting from '../utils/formatting.js';  

const defaultBaseUrlVar = '{{baseUrl}}'; // Variable Postman para la URL base
const validHttpVerbs = ['get', 'post', 'put', 'delete', 'patch', 'options', 'head']; // Excluir trace
const excludePathKeywords = ['test', 'echo', 'prueba', 'health', 'ping', 'swagger', 'openapi'];
const defaultResourceIdVar = '{{resourceId}}'; // Placeholder para IDs en paths


export function analyzeOpenApi(openapiFile) {
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
            name: ObjectUtils.getNestedValue(spec, 'info.title', 'Generated API Tests') + ` (${path.basename(openapiFile)})`,
            schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
            description: ObjectUtils.getNestedValue(spec, 'info.description', 'Auto-generated tests from OpenAPI spec')
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
        const folderName = PathUtils.getFolderName(pathname);
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
            const securityInfo = OpenApiSecurity.getSecurityInfo(operationSecurity, spec);

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
        resolvedParam = SchemasOpenApi.resolveSchemaRef(param.$ref, spec);
        if (!resolvedParam) {
            console.warn(`Warning: Could not resolve parameter reference: ${param.$ref}`);
            return; // Skip if ref resolution failed
        }
    }

    const paramName = resolvedParam.name;
    const paramIn = resolvedParam.in; // 'query', 'path', 'header', 'cookie'
    const paramSchema = resolvedParam.schema || {}; // Schema for the parameter value
    // Generate a basic example value based on the schema
    const exampleValue = SchemasOpenApi.generateBasicValueForType(paramSchema, spec);
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
         resolvedRequestBody = SchemasOpenApi.resolveSchemaRef(resolvedRequestBody.$ref, spec);
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
                 const bodyExample = SchemasOpenApi.generateBasicSchemaExample(schema, spec);
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
                                     description: ObjectUtils.getNestedValue(propSchema, 'description', '')
                                 });
                             } else {
                                 // Stringify nested objects/arrays for form data if needed, or use simple value
                                 value = (typeof value === 'object' && value !== null) ? JSON.stringify(value) : String(value ?? '');
                                 postmanRequest.request.body[bodyMode].push({
                                     key: key,
                                     value: value,
                                     type: 'text', // Default type
                                     description: ObjectUtils.getNestedValue(propSchema, 'description', '')
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
    if (condition && OpenApiSuggestion.testTypeEstimations[type]) {
         const hours = OpenApiSuggestion.testTypeEstimations[type];
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

 // Basic Happy Path + Contract Test for all operations
addSuggestion("Happy Path");
addSuggestion("Contract Test (Response Schema)", !!operation.responses?.['200'] || !!operation.responses?.['201']);

// Auth Tests (if security is defined)
 const hasSecurity = !!securityInfo;
addSuggestion("Auth: Missing Credentials", hasSecurity);
addSuggestion("Auth: Invalid Credentials", hasSecurity);

// Validation Tests (Params & Body)
 let requiredParams = parameters.filter(p => p.required);
 let bodySchema = ObjectUtils.getNestedValue(operation, 'requestBody.content.application/json.schema'); // Basic check for JSON body schema
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
     const requiredBodyProps = SchemasOpenApi.resolveSchemaRef(bodySchema.$ref, spec)?.required || bodySchema.required || [];
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