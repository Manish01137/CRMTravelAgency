import type { Response } from 'express';
import type { Role } from '@prisma/client';

/**
 * Live call events (ringing, answered elsewhere, the customer's SDP answer,
 * ended) pushed to the open CRM tabs over Server-Sent Events.
 *
 * In memory on purpose: Meta's webhooks and every browser's stream are
 * handled by the same single API process (see index.ts), so there's nothing
 * to fan out between servers. If the API ever runs as several copies, this is
 * the one place to move onto Redis pub/sub.
 */

export interface CallSubscriber {
  organizationId: string;
  userId: string;
  role: Role;
  res: Response;
}

const subscribers = new Set<CallSubscriber>();

export function subscribeToCalls(sub: CallSubscriber): () => void {
  subscribers.add(sub);
  return () => {
    subscribers.delete(sub);
  };
}

/** Sends one event to every open tab in the organization that `canSee` lets through. */
export function publishCallEvent(
  organizationId: string,
  event: Record<string, unknown>,
  canSee: (sub: { userId: string; role: Role }) => boolean,
): void {
  const frame = `event: call\ndata: ${JSON.stringify(event)}\n\n`;
  for (const sub of subscribers) {
    if (sub.organizationId !== organizationId || !canSee(sub)) continue;
    try {
      sub.res.write(frame);
    } catch {
      subscribers.delete(sub);
    }
  }
}

export function openCallStreams(): number {
  return subscribers.size;
}
