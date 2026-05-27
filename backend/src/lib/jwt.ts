import jwt from 'jsonwebtoken';
import type { User } from '@prisma/client';

const JWT_SECRET = process.env.JWT_SECRET || process.env.SESSION_SECRET!;
const JWT_EXPIRES_IN = '7d';

export interface JWTPayload {
  sub: string;
  email: string;
  name?: string | null;
  iat: number;
  exp: number;
}

/**
 * Generate JWT token for authenticated user
 */
export function generateToken(user: User): string {
  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
      name: user.name,
    },
    JWT_SECRET,
    {
      expiresIn: JWT_EXPIRES_IN,
    }
  );
}

/**
 * Verify and decode JWT token
 */
export function verifyToken(token: string): JWTPayload {
  return jwt.verify(token, JWT_SECRET) as JWTPayload;
}

/**
 * Extract token from Authorization header
 */
export function extractTokenFromHeader(authHeader?: string): string | null {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.substring(7);
}
