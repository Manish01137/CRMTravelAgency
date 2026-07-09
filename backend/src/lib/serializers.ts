import type { Invitation, User } from '@prisma/client';

export type PublicUser = Omit<User, 'passwordHash'>;

/** Strips the password hash before a user object leaves the API. */
export function toPublicUser(user: User): PublicUser {
  const { passwordHash: _passwordHash, ...rest } = user;
  return rest;
}

export type PublicInvitation = Omit<Invitation, 'tokenHash'>;

/** Strips the token hash before an invitation leaves the API. */
export function toPublicInvitation(invitation: Invitation): PublicInvitation {
  const { tokenHash: _tokenHash, ...rest } = invitation;
  return rest;
}
