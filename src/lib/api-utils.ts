/**
 * Sanitize database error messages for API responses.
 * Logs the real error server-side, returns a generic message to the client.
 */
export function dbError(error: { message: string } | null, fallback = 'Database error') {
  if (error) console.error('[DB]', error.message)
  return fallback
}
