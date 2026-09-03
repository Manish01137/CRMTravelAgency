import type { TenantTx } from '../../lib/prisma';
import type { TemplateKey } from './bot-flow.schemas';

/**
 * Ready-made starter flows — "easy way to add" a working Bot Flow instead of
 * a blank canvas. Steps reference each other by a local `key` (not a real id,
 * which doesn't exist until the row is created); instantiateTemplate() does
 * the two-pass create-then-link the builder's own drag-a-connection flow does
 * implicitly one step at a time.
 *
 * Deliberately doesn't include SEND_PACKAGE or AI_OPEN steps — both need
 * something org-specific to point at (a real package; a configured AI Agent)
 * that a generic template can't supply, so a template step using either would
 * start out broken. Add those manually once packages/AI are set up.
 */

interface TemplateStepDef {
  key: string;
  type: 'COLLECT' | 'CONFIRM' | 'CLOSING' | 'MESSAGE' | 'HANDOFF';
  question: string;
  leadField?: string;
  options?: { label: string; nextKey: string | null }[];
  nextKey?: string | null;
  col: number;
  row: number;
}

interface TemplateDef {
  key: TemplateKey;
  name: string;
  description: string;
  flowName: string;
  steps: TemplateStepDef[];
}

const GRID_X = 320;
const GRID_Y = 160;

export const BOT_FLOW_TEMPLATES: TemplateDef[] = [
  {
    key: 'travel_enquiry',
    name: 'Travel Enquiry Bot',
    description: 'Greets a new enquiry, collects name/destination/dates/travellers, then hands off to your team.',
    flowName: 'Travel Enquiry Bot',
    steps: [
      { key: 'name', type: 'COLLECT', question: "Hi! I'd love to help plan your trip. What's your name?", leadField: 'name', nextKey: 'destination', col: 0, row: 0 },
      { key: 'destination', type: 'COLLECT', question: 'Nice to meet you! Where are you looking to travel?', leadField: 'destination', nextKey: 'date', col: 1, row: 0 },
      { key: 'date', type: 'COLLECT', question: 'When are you planning to travel?', leadField: 'travelDate', nextKey: 'pax', col: 2, row: 0 },
      { key: 'pax', type: 'COLLECT', question: 'How many travellers in total?', leadField: 'travelerCount', nextKey: 'closing', col: 0, row: 1 },
      { key: 'closing', type: 'CLOSING', question: 'Thanks! Our team will reach out shortly with some great options for you. ✈️', col: 1, row: 1 },
    ],
  },
  {
    key: 'booking_followup',
    name: 'Booking Follow-up',
    description: 'Checks whether an old enquiry is still interested, then either books a callback time or hands off.',
    flowName: 'Booking Follow-up',
    steps: [
      { key: 'greet', type: 'MESSAGE', question: 'Hi again! 👋 Just following up on the trip you enquired about.', nextKey: 'stillInterested', col: 0, row: 0 },
      {
        key: 'stillInterested',
        type: 'CONFIRM',
        question: 'Are you still interested in planning this trip?',
        options: [
          { label: 'Yes', nextKey: 'callTime' },
          { label: 'No', nextKey: 'handoff' },
        ],
        col: 1,
        row: 0,
      },
      { key: 'callTime', type: 'COLLECT', question: "Great! What's the best time to call you?", leadField: 'notes', nextKey: 'closingYes', col: 2, row: 0 },
      { key: 'closingYes', type: 'CLOSING', question: "Perfect — our team will call you then. Thanks for confirming!", col: 2, row: 1 },
      { key: 'handoff', type: 'HANDOFF', question: "No problem — I'll have someone from our team follow up personally.", col: 1, row: 1 },
    ],
  },
];

export function getTemplate(key: TemplateKey): TemplateDef {
  const template = BOT_FLOW_TEMPLATES.find((t) => t.key === key);
  if (!template) throw new Error(`Unknown Bot Flow template: ${key}`);
  return template;
}

/** Creates a real BotFlow + BotFlowSteps from a template, wiring nextStepId/options up in a second pass. */
export async function instantiateTemplate(tx: TenantTx, organizationId: string, templateKey: TemplateKey) {
  const template = getTemplate(templateKey);

  const flow = await tx.botFlow.create({
    data: { organizationId, name: template.flowName },
  });

  const keyToId = new Map<string, string>();
  for (const def of template.steps) {
    const row = await tx.botFlowStep.create({
      data: {
        organizationId,
        flowId: flow.id,
        type: def.type,
        order: 0,
        question: def.question,
        leadField: def.leadField,
        canvasX: 40 + def.col * GRID_X,
        canvasY: 40 + def.row * GRID_Y,
      },
    });
    keyToId.set(def.key, row.id);
  }

  for (const def of template.steps) {
    const id = keyToId.get(def.key)!;
    if (def.options) {
      await tx.botFlowStep.update({
        where: { id },
        data: { options: def.options.map((o) => ({ label: o.label, nextStepId: o.nextKey ? keyToId.get(o.nextKey) ?? null : null })) },
      });
    } else if (def.nextKey) {
      await tx.botFlowStep.update({ where: { id }, data: { nextStepId: keyToId.get(def.nextKey) ?? null } });
    }
  }

  return tx.botFlow.findUniqueOrThrow({ where: { id: flow.id }, include: { steps: { orderBy: { order: 'asc' } } } });
}
