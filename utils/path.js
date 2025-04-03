/**
 * Generates a Postman folder name from an API path.
 * Example: /users/{id}/orders -> Users Orders
 */
export function getFolderName(pathname) {
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
