/**
 * TEMP TEST SCRIPT — uses a short-lived token, delete after WhatsApp production
 * setup (Step 2) is verified end-to-end. Do not commit real token values.
 *
 * Isolated smoke test: calls the WhatsApp Graph API directly with a test
 * token. Does NOT go through channels.service.ts, the encryption layer, or
 * any DB/Prisma model — nothing here touches the app's real connection flow.
 *
 * Usage:
 *   npx tsx backend/scripts/test-whatsapp-send.ts 918450044308
 */
import 'dotenv/config';

const GRAPH_VERSION = 'v25.0';

async function main() {
  const to = process.argv[2];
  if (!to) {
    console.error('Usage: npx tsx backend/scripts/test-whatsapp-send.ts <recipient-phone-number>');
    process.exit(1);
  }

  const accessToken = process.env.WHATSAPP_TEST_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_TEST_PHONE_NUMBER_ID;
  if (!accessToken || !phoneNumberId) {
    console.error('Missing WHATSAPP_TEST_ACCESS_TOKEN and/or WHATSAPP_TEST_PHONE_NUMBER_ID in backend/.env');
    process.exit(1);
  }

  const url = `https://graph.facebook.com/${GRAPH_VERSION}/${phoneNumberId}/messages`;
  const body = {
    messaging_product: 'whatsapp',
    to,
    type: 'template',
    template: { name: 'hello_world', language: { code: 'en_US' } },
  };

  console.log(`POST ${url}`);
  console.log('Body:', JSON.stringify(body, null, 2));

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => null);

  console.log(`\nHTTP status: ${res.status}`);
  console.log('Response:', JSON.stringify(data, null, 2));

  if (!res.ok) {
    console.error('\n✗ Send failed.');
    const errorMessage = data?.error?.message ?? '';
    if (/template/i.test(errorMessage)) {
      console.error('→ This looks template-related — "hello_world" may not exist on this WABA. Try a different approved template name.');
    }
    process.exit(1);
  }

  console.log('\n✓ Send succeeded.');
}

main().catch((err) => {
  console.error('FATAL:', err);
  process.exit(1);
});
