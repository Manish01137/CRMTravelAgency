/**
 * One-time bootstrap for the Super Admin panel's first (and normally only)
 * owner account. Deliberately a CLI script, not an HTTP endpoint — there is
 * no self-signup for platform admins, by design.
 *
 *   npm run owner:create -- "you@example.com" "A strong password" "Your Name"
 *
 * Safe to re-run: exits cleanly with a clear message if that email already
 * has an owner account, instead of erroring.
 */
import 'dotenv/config';
import { systemPrisma, disconnectPrisma } from '../src/lib/prisma';
import { hashPassword } from '../src/lib/password';

async function main() {
  const [, , email, password, name] = process.argv;
  if (!email || !password) {
    console.error('Usage: npm run owner:create -- "you@example.com" "A strong password" "Your Name"');
    process.exit(1);
  }
  if (password.length < 12) {
    console.error('✗ Use a longer password (12+ characters) — this account can see every organization on the platform.');
    process.exit(1);
  }

  const existing = await systemPrisma.platformAdmin.findUnique({ where: { email } });
  if (existing) {
    console.log(`Owner account for ${email} already exists — nothing to do.`);
    await disconnectPrisma();
    return;
  }

  const admin = await systemPrisma.platformAdmin.create({
    data: { email, name: name || 'Owner', passwordHash: await hashPassword(password) },
  });
  console.log(`✓ Owner account created: ${admin.email}`);
  console.log('  Log in at /owner on the frontend.');
  await disconnectPrisma();
}

main().catch(async (err) => {
  console.error('✗ Failed to create owner account:', err instanceof Error ? err.message : err);
  await disconnectPrisma();
  process.exit(1);
});
