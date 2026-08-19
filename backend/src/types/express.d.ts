import type { Role } from '@prisma/client';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      /** Populated by requireAuth from a verified JWT. */
      auth?: {
        userId: string;
        organizationId: string;
        role: Role;
      };
      /** Populated by requirePlatformAdmin from a verified platform-admin JWT.
       *  Entirely separate from `auth` above — never both set on the same request. */
      platformAdmin?: {
        adminId: string;
        email: string;
      };
    }
  }
}

export {};
