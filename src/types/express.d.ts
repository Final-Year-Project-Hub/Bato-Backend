import { Request } from "express";

/**
 * Authenticated user data attached to requests by verifyUser middleware
 */
export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string | null;
  role: string;
}

/**
 * Extend Express Request to include authenticated user and session
 */
declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
      session?: any;
    }
  }
}
