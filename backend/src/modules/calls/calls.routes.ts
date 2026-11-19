import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../lib/http';
import { validate } from '../../lib/validate';
import { requireAuth } from '../../middleware/auth';
import { requireRole } from '../../middleware/requireRole';
import { viewerOf } from '../../lib/visibility';
import { subscribeToCalls } from './calls.bus';
import * as service from './calls.service';

const router = Router();
router.use(requireAuth);

const idParam = z.object({ id: z.string().uuid('Invalid call id') });
const conversationParam = z.object({ conversationId: z.string().uuid('Invalid conversation id') });
// An SDP is a few KB of text; WhatsApp's own are ~1–3 KB.
const sdpBody = z.object({ sdp: z.string().min(20, 'Missing call audio details').max(20_000) });
const failBody = z.object({ reason: z.string().max(300).default('The call audio could not be set up') });
const permissionBody = z.object({ text: z.string().trim().max(1024).optional() });
const settingsBody = z.object({
  enabled: z.boolean(),
  callIconVisibility: z.enum(['DEFAULT', 'DISABLE_ALL']),
  callbackPermission: z.enum(['ENABLED', 'DISABLED']),
});

/**
 * Live call events for this tab (Server-Sent Events). Kept open; a comment
 * line every 20s stops Nginx (60s read timeout) and browsers dropping it.
 */
router.get('/stream', (req, res) => {
  const { organizationId, userId, role } = req.auth!;
  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no', // Nginx: pass each event straight through
  });
  res.write('retry: 3000\n: connected\n\n');
  const unsubscribe = subscribeToCalls({ organizationId, userId, role, res });
  const heartbeat = setInterval(() => res.write(': ping\n\n'), 20_000);
  req.on('close', () => {
    clearInterval(heartbeat);
    unsubscribe();
  });
});

router.get('/active', asyncHandler(async (req, res) => {
  res.json({ calls: await service.listActiveCalls(req.auth!.organizationId, viewerOf(req)) });
}));

router.get('/settings', requireRole('ADMIN'), asyncHandler(async (req, res) => {
  res.json(await service.getCallingSettings(req.auth!.organizationId));
}));
router.put('/settings', requireRole('ADMIN'), validate({ body: settingsBody }), asyncHandler(async (req, res) => {
  res.json(await service.updateCallingSettings(req.auth!.organizationId, req.body));
}));

router.post('/conversations/:conversationId', validate({ params: conversationParam, body: sdpBody }), asyncHandler(async (req, res) => {
  res.status(201).json(await service.startCall(req.auth!.organizationId, viewerOf(req), req.params.conversationId, req.body.sdp));
}));
router.get('/conversations/:conversationId/permission', validate({ params: conversationParam }), asyncHandler(async (req, res) => {
  res.json(await service.getCallPermission(req.auth!.organizationId, viewerOf(req), req.params.conversationId));
}));
router.post(
  '/conversations/:conversationId/permission',
  validate({ params: conversationParam, body: permissionBody }),
  asyncHandler(async (req, res) => {
    res.status(201).json(await service.requestCallPermission(req.auth!.organizationId, viewerOf(req), req.params.conversationId, req.body.text));
  }),
);

router.get('/:id', validate({ params: idParam }), asyncHandler(async (req, res) => {
  res.json(await service.getCall(req.auth!.organizationId, viewerOf(req), req.params.id));
}));
router.post('/:id/accept', validate({ params: idParam, body: sdpBody }), asyncHandler(async (req, res) => {
  res.json(await service.acceptCall(req.auth!.organizationId, viewerOf(req), req.params.id, req.body.sdp));
}));
router.post('/:id/decline', validate({ params: idParam }), asyncHandler(async (req, res) => {
  await service.declineCall(req.auth!.organizationId, viewerOf(req), req.params.id);
  res.status(204).end();
}));
// Also reached by navigator.sendBeacon when the tab closes mid-call (no JSON body then).
router.post('/:id/hangup', validate({ params: idParam }), asyncHandler(async (req, res) => {
  await service.hangUpCall(req.auth!.organizationId, viewerOf(req), req.params.id);
  res.status(204).end();
}));
router.post('/:id/fail', validate({ params: idParam, body: failBody }), asyncHandler(async (req, res) => {
  await service.failCall(req.auth!.organizationId, viewerOf(req), req.params.id, req.body.reason);
  res.status(204).end();
}));

export default router;
