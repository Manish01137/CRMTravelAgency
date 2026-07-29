import { Router } from 'express';
import type { Request, Response } from 'express';
import { asyncHandler } from '../../lib/http';
import { checkWebhookVerifyToken, verifyWebhookSignature } from '../../lib/meta';
import { Forbidden } from '../../lib/errors';
import { processMetaWebhook } from './webhooks.service';

/**
 * PUBLIC — Meta calls these directly (WhatsApp + Instagram share one webhook
 * URL per Meta App, differentiated by `body.object`). No requireAuth: the
 * request isn't authenticated as a user, it's authenticated as genuinely being
 * FROM Meta via the X-Hub-Signature-256 HMAC check below (rawBody captured by
 * express.json()'s `verify` option in app.ts).
 */
const router = Router();

router.get('/meta', (req: Request, res: Response) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  if (checkWebhookVerifyToken(mode, token)) {
    res.status(200).send(String(challenge));
  } else {
    res.sendStatus(403);
  }
});

router.post(
  '/meta',
  asyncHandler(async (req: Request, res: Response) => {
    const signature = req.headers['x-hub-signature-256'] as string | undefined;
    const rawBody = (req as Request & { rawBody?: Buffer }).rawBody;
    if (!rawBody || !verifyWebhookSignature(rawBody, signature)) {
      throw Forbidden('Invalid webhook signature');
    }
    // Always ack quickly — processing failures are logged, never surfaced to Meta
    // (a 200 here just means "received", not "fully processed").
    res.sendStatus(200);
    await processMetaWebhook(req.body);
  }),
);

export default router;
