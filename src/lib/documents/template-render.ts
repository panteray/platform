/**
 * Replace `{{token}}` placeholders in `body` with values from `vars`.
 *
 * - Whitespace inside braces tolerated: `{{ token }}` matches `{{token}}`.
 * - Dotted paths supported: `{{customer.name}}` walks `vars.customer.name`.
 * - Missing values render as empty string (no error).
 */
export function renderTemplate(body: string, vars: Record<string, unknown>): string {
  return body.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_match, key: string) => {
    const value = key.split('.').reduce<unknown>((acc, segment) => {
      if (acc == null || typeof acc !== 'object') return undefined
      return (acc as Record<string, unknown>)[segment]
    }, vars)
    return value == null ? '' : String(value)
  })
}
