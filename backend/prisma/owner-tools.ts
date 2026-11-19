/**
 * Owner (Super Admin) account tools — run from your own computer:
 *
 *   npm run owner:list                                   → which owner emails exist (no passwords)
 *   npm run owner:reset-password -- "you@example.com" "New strong password"
 *
 * Passwords are only ever stored hashed, so a forgotten one can't be shown —
 * set a new one instead.
 */
import 'dotenv/config';
import { systemPrisma, disconnectPrisma } from '../src/lib/prisma';
import { hashPassword } from '../src/lib/password';

async function main() {
  const [, , command, email, password] = process.argv;
  if (command === 'list') {
    const owners = await systemPrisma.platformAdmin.findMany({ select: { email: true, name: true, createdAt: true }, orderBy: { createdAt: 'asc' } });
    if (owners.length === 0) console.log('No owner accounts yet — create one with: npm run owner:create -- "you@example.com" "A strong password" "Your Name"');
    for (const o of owners) console.log(`• ${o.email}  (${o.name}, created ${o.createdAt.toISOString().slice(0, 10)})`);
    return;
  }
  if (command === 'reset') {
    if (!email || !password) throw new Error('Usage: npm run owner:reset-password -- "you@example.com" "New strong password"');
    if (password.length < 12) throw new Error('Use a longer password (12+ characters) — this account can see every organization.');
    const owner = await systemPrisma.platformAdmin.findUnique({ where: { email } });
    if (!owner) throw new Error(`No owner account for ${email} — run "npm run owner:list" to see which emails exist.`);
    await systemPrisma.platformAdmin.update({ where: { email }, data: { passwordHash: await hashPassword(password) } });
    console.log(`✓ New password set for ${email}. Log in at /owner.`);
    return;
  }
  throw new Error('Usage: npm run owner:list   |   npm run owner:reset-password -- "you@example.com" "New password"');
}

main()
  .catch((err) => {
    console.error('✗', err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => disconnectPrisma());
