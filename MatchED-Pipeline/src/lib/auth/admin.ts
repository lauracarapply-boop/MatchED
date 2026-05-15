import { NextRequest } from 'next/server';

export interface AdminUser {
  id: string;
  email: string;
  name?: string;
  image?: string;
}

export class UnauthorizedError extends Error {
  constructor(message = 'Unauthorized') {
    super(message);
    this.name = 'UnauthorizedError';
  }
}

export class ForbiddenError extends Error {
  constructor(message = 'Forbidden') {
    super(message);
    this.name = 'ForbiddenError';
  }
}

/**
 * Returns the configured admin emails as a normalized array.
 */
function getAdminEmails(): string[] {
  const raw = process.env.ADMIN_EMAILS || process.env.ADMIN_EMAIL || '';
  return raw
    .split(',')
    .map(email => email.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Checks if a user email is an admin email
 */
export function isAdminUser(email: string | null | undefined): boolean {
  if (!email) return false;
  const adminEmails = getAdminEmails();
  return adminEmails.includes(email.toLowerCase());
}

/**
 * Requires admin access - throws error if not admin
 * This should be called in API routes that require admin access
 */
export async function requireAdmin(request: NextRequest): Promise<AdminUser> {
  const authHeader = request.headers.get('authorization');
  const cookieToken = request.cookies.get('admin_token')?.value;

  const token = authHeader?.startsWith('Bearer ')
    ? authHeader.substring(7)
    : cookieToken;

  const adminSecret = process.env.ADMIN_SECRET;
  if (!adminSecret || !token || token !== adminSecret) {
    throw new UnauthorizedError('Invalid or missing admin token');
  }

  const adminEmails = getAdminEmails();
  if (adminEmails.length === 0) {
    throw new Error('ADMIN_EMAIL or ADMIN_EMAILS not configured');
  }

  return {
    id: 'admin-user',
    email: adminEmails[0],
    name: 'Admin User',
  };
}

/**
 * Validates if the current user is admin based on email
 * This is a helper for client-side checks
 */
export function validateAdminAccess(userEmail: string | null | undefined): boolean {
  return isAdminUser(userEmail);
}