/**
 * Extracts security scheme information relevant for Postman auth.
 */
export function getSecurityInfo(securityRequirements, spec) {
    if (!securityRequirements || securityRequirements.length === 0) return null;

    const securitySchemes = ObjectUtils.getNestedValue(spec, 'components.securitySchemes', {});
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