import crypto from 'node:crypto';
import type { Organization, User } from '@prisma/client';
import { systemPrisma, withTenant } from '../../lib/prisma';
import { hashPassword, verifyPassword } from '../../lib/password';
import { hashToken } from '../../lib/tokens';
import { slugify } from '../../lib/slug';
import { sendEmail } from '../../lib/resend';
import { env } from '../../env';
import { AppError, BadRequest, Conflict, Forbidden, NotFound, Unauthorized } from '../../lib/errors';
import type { AcceptInviteInput, LoginInput, ResendSignupOtpInput, StartSignupInput, VerifySignupInput } from './auth.schemas';

export interface AuthResult {
  user: User;
  organization: Organization;
}

const OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes
const OTP_MIN_RESEND_MS = 45 * 1000; // throttle resend independent of the route-level rate limiter
const OTP_MAX_ATTEMPTS = 5;

function isPlatformEmailConfigured(): boolean {
  return !!env.PLATFORM_RESEND_API_KEY && !!env.PLATFORM_EMAIL_FROM_ADDRESS;
}

function generateOtp(): string {
  return crypto.randomInt(0, 1_000_000).toString().padStart(6, '0');
}

async function sendOtp(email: string, otp: string): Promise<void> {
  if (!isPlatformEmailConfigured()) {
    throw new AppError(503, 'OTP_NOT_CONFIGURED', 'Signup verification is not configured on the server yet — contact your administrator');
  }
  await sendEmail(env.PLATFORM_RESEND_API_KEY!, {
    from: env.PLATFORM_EMAIL_FROM_ADDRESS!,
    to: email,
    subject: 'Your verification code',
    text: `Your verification code is ${otp}. It expires in 10 minutes. If you didn't request this, you can ignore this email.`,
  });
}

/** Creates one Organization + one ADMIN user in a single transaction (PROJECT_SPEC.md §4.4).
 *  Exported for reuse by the Super Admin panel's manual org-creation flow — same
 *  slug-uniqueness handling, no duplicated logic. */
export async function createOrgAndUser(input: { organizationName: string; name: string; email: string; passwordHash: string }): Promise<AuthResult> {
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
        passwordHash: input.passwordHash,
        role: 'ADMIN',
        status: 'ACTIVE',
      },
    });

    return { user, organization };
  });
}

/**
 * Step 1 of signup — validates the details, stages them (nothing is created
 * yet), and sends a 6-digit OTP by email. Nothing here is tenant-scoped
 * (systemPrisma, same as login/signup always were) — there is no organization
 * to attach RLS to until step 2 succeeds.
 */
export async function startSignup(input: StartSignupInput): Promise<{ expiresInSeconds: number }> {
  const existing = await systemPrisma.user.findUnique({ where: { email: input.email } });
  if (existing) throw Conflict('An account with this email already exists');

  const passwordHash = await hashPassword(input.password);
  const otp = generateOtp();
  const otpHash = hashToken(otp);
  const expiresAt = new Date(Date.now() + OTP_TTL_MS);

  await systemPrisma.signupVerification.upsert({
    where: { email: input.email },
    create: {
      email: input.email,
      organizationName: input.organizationName,
      name: input.name,
      passwordHash,
      otpHash,
      expiresAt,
    },
    update: {
      organizationName: input.organizationName,
      name: input.name,
      passwordHash,
      otpHash,
      attempts: 0,
      expiresAt,
      createdAt: new Date(),
    },
  });

  await sendOtp(input.email, otp);
  return { expiresInSeconds: OTP_TTL_MS / 1000 };
}

/** Step 2 — verifies the OTP and, on success, actually creates the Organization + admin User. */
export async function verifySignup(input: VerifySignupInput): Promise<AuthResult> {
  const pending = await systemPrisma.signupVerification.findUnique({ where: { email: input.email } });
  if (!pending) throw NotFound('No pending signup for this email — start signup again');

  if (pending.expiresAt < new Date()) {
    await systemPrisma.signupVerification.delete({ where: { id: pending.id } });
    throw BadRequest('This code has expired — request a new one');
  }
  if (pending.attempts >= OTP_MAX_ATTEMPTS) {
    await systemPrisma.signupVerification.delete({ where: { id: pending.id } });
    throw BadRequest('Too many incorrect attempts — request a new code');
  }

  if (hashToken(input.otp) !== pending.otpHash) {
    // Check the count AFTER incrementing — otherwise the Nth wrong guess only
    // records itself and the lockout doesn't actually bite until N+1 (an
    // off-by-one caught during this feature's own end-to-end testing).
    const updated = await systemPrisma.signupVerification.update({
      where: { id: pending.id },
      data: { attempts: { increment: 1 } },
    });
    if (updated.attempts >= OTP_MAX_ATTEMPTS) {
      await systemPrisma.signupVerification.delete({ where: { id: pending.id } });
      throw BadRequest('Too many incorrect attempts — request a new code');
    }
    throw BadRequest('Incorrect code — please try again');
  }

  // Re-check email uniqueness — time has passed since step 1, another signup could have taken it.
  const existing = await systemPrisma.user.findUnique({ where: { email: pending.email } });
  if (existing) {
    await systemPrisma.signupVerification.delete({ where: { id: pending.id } });
    throw Conflict('An account with this email already exists');
  }

  const result = await createOrgAndUser({
    organizationName: pending.organizationName,
    name: pending.name,
    email: pending.email,
    passwordHash: pending.passwordHash,
  });
  await systemPrisma.signupVerification.delete({ where: { id: pending.id } });
  return result;
}

/** Resends a fresh OTP for an already-started signup. */
export async function resendSignupOtp(input: ResendSignupOtpInput): Promise<{ expiresInSeconds: number }> {
  const pending = await systemPrisma.signupVerification.findUnique({ where: { email: input.email } });
  if (!pending) throw NotFound('No pending signup for this email — start signup again');

  const sinceLast = Date.now() - pending.createdAt.getTime();
  if (sinceLast < OTP_MIN_RESEND_MS) {
    throw BadRequest(`Please wait ${Math.ceil((OTP_MIN_RESEND_MS - sinceLast) / 1000)}s before requesting another code`);
  }

  const otp = generateOtp();
  const otpHash = hashToken(otp);
  const expiresAt = new Date(Date.now() + OTP_TTL_MS);

  await systemPrisma.signupVerification.update({
    where: { id: pending.id },
    data: { otpHash, attempts: 0, expiresAt, createdAt: new Date() },
  });

  await sendOtp(input.email, otp);
  return { expiresInSeconds: OTP_TTL_MS / 1000 };
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
  if (user.organization.status === 'SUSPENDED') {
    throw Forbidden('Your organization\'s access has been suspended. Contact support.');
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
    if (organization.status === 'SUSPENDED') {
      throw Forbidden('Your organization\'s access has been suspended. Contact support.');
    }
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
