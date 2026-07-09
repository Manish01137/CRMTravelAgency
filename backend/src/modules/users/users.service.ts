import { Prisma, type Invitation, type User } from '@prisma/client';
import { withTenant } from '../../lib/prisma';
import { generateInviteToken } from '../../lib/tokens';
import { hashPassword, verifyPassword } from '../../lib/password';
import { BadRequest, Conflict, NotFound } from '../../lib/errors';
import type { InviteUserInput, UpdateUserInput } from './users.schemas';

export interface UpdateProfileInput {
  name?: string;
  currentPassword?: string;
  newPassword?: string;
}

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export async function listUsers(organizationId: string): Promise<User[]> {
  return withTenant(organizationId, (tx) =>
    tx.user.findMany({ orderBy: [{ role: 'asc' }, { createdAt: 'asc' }] }),
  );
}

export async function listInvitations(organizationId: string): Promise<Invitation[]> {
  return withTenant(organizationId, (tx) =>
    tx.invitation.findMany({ where: { status: 'PENDING' }, orderBy: { createdAt: 'desc' } }),
  );
}

/** Creates (or refreshes) a pending invitation. Returns the raw token once. */
export async function inviteUser(
  organizationId: string,
  invitedById: string,
  input: InviteUserInput,
): Promise<{ invitation: Invitation; token: string }> {
  return withTenant(organizationId, async (tx) => {
    const existingMember = await tx.user.findFirst({ where: { email: input.email } });
    if (existingMember) throw Conflict('That person is already a member of your team');

    const { token, tokenHash } = generateInviteToken();
    const expiresAt = new Date(Date.now() + INVITE_TTL_MS);

    const pending = await tx.invitation.findFirst({
      where: { email: input.email, status: 'PENDING' },
    });

    const invitation = pending
      ? await tx.invitation.update({
          where: { id: pending.id },
          data: { role: input.role, tokenHash, expiresAt, invitedById },
        })
      : await tx.invitation.create({
          data: {
            organizationId,
            email: input.email,
            role: input.role,
            tokenHash,
            expiresAt,
            invitedById,
          },
        });

    return { invitation, token };
  });
}

export async function revokeInvitation(organizationId: string, invitationId: string): Promise<void> {
  await withTenant(organizationId, async (tx) => {
    const result = await tx.invitation.updateMany({
      where: { id: invitationId, status: 'PENDING' },
      data: { status: 'REVOKED' },
    });
    if (result.count === 0) throw NotFound('Pending invitation not found');
  });
}

export async function updateUser(
  organizationId: string,
  actingUserId: string,
  targetUserId: string,
  input: UpdateUserInput,
): Promise<User> {
  if (targetUserId === actingUserId) {
    throw BadRequest('You cannot change your own role or status here');
  }

  return withTenant(organizationId, async (tx) => {
    const target = await tx.user.findUnique({ where: { id: targetUserId } });
    if (!target) throw NotFound('User not found');

    const isDemotingAdmin =
      target.role === 'ADMIN' && (input.role === 'AGENT' || input.status === 'DISABLED');

    if (isDemotingAdmin) {
      const activeAdmins = await tx.user.count({ where: { role: 'ADMIN', status: 'ACTIVE' } });
      if (activeAdmins <= 1) {
        throw BadRequest('Your organization must keep at least one active admin');
      }
    }

    return tx.user.update({ where: { id: targetUserId }, data: input });
  });
}

export async function deleteUser(
  organizationId: string,
  actingUserId: string,
  targetUserId: string,
): Promise<void> {
  if (targetUserId === actingUserId) {
    throw BadRequest('You cannot delete your own account');
  }

  await withTenant(organizationId, async (tx) => {
    const target = await tx.user.findUnique({ where: { id: targetUserId } });
    if (!target) throw NotFound('User not found');

    if (target.role === 'ADMIN') {
      const adminCount = await tx.user.count({ where: { role: 'ADMIN' } });
      if (adminCount <= 1) throw BadRequest('Your organization must keep at least one admin');
    }

    await tx.user.delete({ where: { id: targetUserId } });
  });
}

/** Self-service profile update: your own name and/or password. */
export async function updateProfile(
  organizationId: string,
  userId: string,
  input: UpdateProfileInput,
): Promise<User> {
  return withTenant(organizationId, async (tx) => {
    const user = await tx.user.findUnique({ where: { id: userId } });
    if (!user) throw NotFound('User not found');

    const data: Prisma.UserUpdateInput = {};
    if (input.name) data.name = input.name;

    if (input.newPassword) {
      const currentOk =
        !!input.currentPassword && (await verifyPassword(input.currentPassword, user.passwordHash));
      if (!currentOk) {
        throw BadRequest('Your current password is incorrect', {
          currentPassword: ['Your current password is incorrect'],
        });
      }
      data.passwordHash = await hashPassword(input.newPassword);
    }

    if (Object.keys(data).length === 0) throw BadRequest('Nothing to update');

    return tx.user.update({ where: { id: userId }, data });
  });
}
