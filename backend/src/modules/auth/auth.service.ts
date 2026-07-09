import crypto from 'node:crypto';
import type { Organization, User } from '@prisma/client';
import { systemPrisma, withTenant } from '../../lib/prisma';
import { hashPassword, verifyPassword } from '../../lib/password';
import { hashToken } from '../../lib/tokens';
import { slugify } from '../../lib/slug';
import { Conflict, Forbidden, NotFound, Unauthorized } from '../../lib/errors';
import type { AcceptInviteInput, LoginInput, SignupInput } from './auth.schemas';

export interface AuthResult {
  user: User;
  organization: Organization;
}

/**
 * Signup — creates one Organization + one ADMIN user in a single transaction
 * (PROJECT_SPEC.md §4.4). Uses systemPrisma because there is no tenant context
 * yet; the owner connection is exempt from RLS.
 */
export async function signup(input: SignupInput): Promise<AuthResult> {
  const existing = await systemPrisma.user.findUnique({ where: { email: input.email } });
  if (existing) throw Conflict('An account with this email already exists');

  const passwordHash = await hashPassword(input.password);
  const baseSlug = slugify(input.organizationName);

  return systemPrisma.$transaction(async (tx) => {
    let slug = baseSlug;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const clash = await tx.organization.findUnique({ where: { slug } });
      if (!clash) break;
      slug = `${baseSlug}-${crypto.randomBytes(2).toString('hex')}`;
    }

    const organization = await tx.organization.create({
      data: { name: input.organizationName, slug },
    });

    const user = await tx.user.create({
      data: {
        organizationId: organization.id,
        email: input.email,
        name: input.name,
        passwordHash,
        role: 'ADMIN',
        status: 'ACTIVE',
      },
    });

    return { user, organization };
  });
}

/** Login — looks the user up by email (cross-tenant, hence systemPrisma). */
export async function login(input: LoginInput): Promise<AuthResult> {
  const user = await systemPrisma.user.findUnique({
    where: { email: input.email },
    include: { organization: true },
  });

  // Generic message on missing user / bad password to avoid account enumeration.
  if (!user || !(await verifyPassword(input.password, user.passwordHash))) {
    throw Unauthorized('Invalid email or password');
  }
  if (user.status === 'DISABLED') {
    throw Forbidden('Your account has been disabled. Contact your administrator.');
  }

  await systemPrisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  const { organization, ...userOnly } = user;
  return { user: userOnly, organization };
}

/** Returns the current user + organization, fetched through the RLS-enforced path. */
export async function getSession(organizationId: string, userId: string): Promise<AuthResult> {
  return withTenant(organizationId, async (tx) => {
    const user = await tx.user.findUnique({ where: { id: userId } });
    const organization = await tx.organization.findUnique({ where: { id: organizationId } });
    if (!user || !organization) throw Unauthorized('Your session is no longer valid');
    return { user, organization };
  });
}

export interface InvitePreview {
  email: string;
  organizationName: string;
  role: 'ADMIN' | 'AGENT';
}

/** Resolves an invite token (cross-tenant) so the accept page can show details. */
export async function getInvitePreview(token: string): Promise<InvitePreview> {
  const invitation = await systemPrisma.invitation.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { organization: true },
  });

  if (!invitation || invitation.status !== 'PENDING' || invitation.expiresAt < new Date()) {
    throw NotFound('This invitation is invalid or has expired');
  }

  return {
    email: invitation.email,
    organizationName: invitation.organization.name,
    role: invitation.role,
  };
}

/** Accept-invite — creates the invited user in the invitation's organization. */
export async function acceptInvite(input: AcceptInviteInput): Promise<AuthResult> {
  const tokenHash = hashToken(input.token);
  const passwordHash = await hashPassword(input.password);

  return systemPrisma.$transaction(async (tx) => {
    const invitation = await tx.invitation.findUnique({
      where: { tokenHash },
      include: { organization: true },
    });

    if (!invitation || invitation.status !== 'PENDING' || invitation.expiresAt < new Date()) {
      throw NotFound('This invitation is invalid or has expired');
    }

    const emailTaken = await tx.user.findUnique({ where: { email: invitation.email } });
    if (emailTaken) throw Conflict('An account with this email already exists');

    const user = await tx.user.create({
      data: {
        organizationId: invitation.organizationId,
        email: invitation.email,
        name: input.name,
        passwordHash,
        role: invitation.role,
        status: 'ACTIVE',
      },
    });

    await tx.invitation.update({
      where: { id: invitation.id },
      data: { status: 'ACCEPTED', acceptedAt: new Date() },
    });

    return { user, organization: invitation.organization };
  });
}
