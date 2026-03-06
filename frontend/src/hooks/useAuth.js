/**
 * useAuth — convenience hook to consume AuthContext.
 *
 * Re-exports the hook from AuthContext so components can import from the
 * hooks directory for consistency with the project's hook convention:
 *
 *   import { useAuth } from '../hooks/useAuth';
 *
 * Returns:
 *   user           — logged-in User object, or null
 *   loading        — true while restoring session on mount
 *   login(creds)   — POST /auth/login, stores token, updates user state
 *   register(data) — POST /auth/register
 *   logout()       — clears localStorage token and user state
 *   refreshUser()  — re-fetches /auth/me and updates user state
 *   isAuthenticated — boolean
 *   isCreator       — boolean (role === 'creator')
 *   isAdmin         — boolean (role === 'admin')
 *   isVerified      — boolean (KYC approved)
 */
export { useAuth } from '../context/AuthContext';
