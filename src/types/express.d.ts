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

declare global {
  namespace Express {
    // Extend the User interface (used by Passport and others) to include our properties
    interface User extends AuthenticatedUser {}

    interface Request {
      // user property is automatically added to Request by Express.User extension
      // via Passport types or similar. We can also explicitly type it here if needed,
      // but extending User is the cleaner way to fix "Property 'id' does not exist on type 'User'".
      user?: User;
      session?: any;
    }
  }
}
