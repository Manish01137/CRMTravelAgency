import { SchemaType, type FunctionDeclaration } from '@google/generative-ai';
import { withTenant } from '../../lib/prisma';
import { buildPackageContent } from '../bot-flow/bot-flow.engine';

/**
 * Smart Bot's tool layer. Gemini (via classifyBotIntent in lib/gemini.ts)
 * only decides WHICH of these to call and extracts its arguments — every
 * tool's actual work below is deterministic and calls EXISTING service
 * functions (buildPackageContent — the same package-summary builder Bot
 * Flow's SEND_PACKAGE step uses, package lookups scoped by organizationId)
 * rather than generating anything or duplicating logic. The 4 stubs at the
 * bottom are typed and wired into TOOL_DECLARATIONS/runBotTool so they're
 * easy to fill in next — right now they just return a graceful
 * "not implemented" reply instead of erroring.
 */

export const TOOL_NAMES = [
  'search_package',
  'send_itinerary',
  'send_payment_details',
  'update_lead',
  'assign_agent',
  'create_followup',
  'handoff_to_human',
] as const;
export type ToolName = (typeof TOOL_NAMES)[number];

export interface ToolResult {
  ok: boolean;
  /** Plain text to send back to the traveller — always written here, never by Gemini. */
  reply: string;
}

export const TOOL_DECLARATIONS: FunctionDeclaration[] = [
  {
    name: 'search_package',
    description: 'Find a travel package matching a destination name the traveller mentioned.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        destination: { type: SchemaType.STRING, description: 'The destination they mentioned, e.g. "Manali"' },
      },
      required: ['destination'],
    },
  },
  {
    name: 'send_itinerary',
    description:
      "Send a specific package's itinerary/link. Use once the package is known — either from a prior search_package result in this same conversation, or because the traveller named it directly.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        packageId: { type: SchemaType.STRING, description: 'The exact package id to send the itinerary for' },
      },
      required: ['packageId'],
    },
  },
  {
    name: 'send_payment_details',
    description: "Send the agency's payment details (bank account / QR), e.g. when the traveller asks how to pay.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        packageId: { type: SchemaType.STRING, description: 'The package this payment relates to, if known' },
      },
    },
  },
  // --- Stubs — typed and routed, not implemented yet ---
  {
    name: 'update_lead',
    description: 'Update a field on this lead (e.g. traveler count, travel date) that the traveller mentioned.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: { field: { type: SchemaType.STRING }, value: { type: SchemaType.STRING } },
    },
  },
  {
    name: 'assign_agent',
    description: 'Assign this lead to a specific human agent by name.',
    parameters: { type: SchemaType.OBJECT, properties: { agentName: { type: SchemaType.STRING } } },
  },
  {
    name: 'create_followup',
    description: 'Schedule a follow-up reminder for this lead.',
    parameters: { type: SchemaType.OBJECT, properties: { whenIso: { type: SchemaType.STRING, description: 'ISO datetime for the follow-up' } } },
  },
  {
    name: 'handoff_to_human',
    description: 'Hand this conversation off to a human agent — use when the traveller explicitly asks for a person.',
    parameters: { type: SchemaType.OBJECT, properties: { reason: { type: SchemaType.STRING } } },
  },
];

export interface PackageMatchCandidate {
  id: string;
  name: string;
  destination: string;
}

/**
 * Deterministic, Gemini-free package match against raw free text — checks
 * whether the traveller's message directly names one of the org's own active
 * packages (by package name or destination), e.g. "do you have the Goa
 * package?" or "send me the Manali itinerary". Called BEFORE Gemini in
 * smart-bot.service.ts: a message that already names a real package doesn't
 * need an LLM to route it. Word-boundary matching (not plain substring) so
 * "Goa" doesn't match "Agoda", and terms under 3 chars are skipped as too
 * noisy to match on.
 */
export function matchPackagesInText(text: string, candidates: PackageMatchCandidate[]): PackageMatchCandidate[] {
  const matches: PackageMatchCandidate[] = [];
  for (const pkg of candidates) {
    const terms = [pkg.name, pkg.destination].filter((t): t is string => !!t && t.trim().length >= 3);
    const hit = terms.some((term) => {
      const escaped = term.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      return new RegExp(`\\b${escaped}\\b`, 'i').test(text);
    });
    if (hit) matches.push(pkg);
  }
  return matches;
}

async function toolSearchPackage(organizationId: string, args: Record<string, unknown>): Promise<ToolResult> {
  const destination = String(args.destination ?? '').trim();
  if (!destination) return { ok: false, reply: 'Which destination are you looking for?' };

  const matches = await withTenant(organizationId, (tx) =>
    tx.package.findMany({
      where: {
        organizationId,
        isActive: true,
        OR: [{ name: { contains: destination, mode: 'insensitive' } }, { destination: { contains: destination, mode: 'insensitive' } }],
      },
      select: { id: true, name: true, destination: true },
      take: 5,
    }),
  );

  if (matches.length === 0) {
    return { ok: false, reply: `I couldn't find a package for "${destination}" right now — would you like to speak with an agent?` };
  }
  if (matches.length === 1) {
    const content = await buildPackageContent(organizationId, matches[0].id);
    return { ok: true, reply: content ?? `Found *${matches[0].name}* — ask me for the itinerary anytime!` };
  }
  const list = matches.map((p) => `• ${p.name} — ${p.destination}`).join('\n');
  return { ok: true, reply: `I found a few options for "${destination}":\n${list}\n\nWhich one would you like the itinerary for?` };
}

async function toolSendItinerary(organizationId: string, args: Record<string, unknown>): Promise<ToolResult> {
  const packageId = String(args.packageId ?? '').trim();
  if (!packageId) return { ok: false, reply: 'Which package would you like the itinerary for?' };
  const content = await buildPackageContent(organizationId, packageId);
  if (!content) return { ok: false, reply: "I couldn't find that package — would you like to speak with an agent?" };
  return { ok: true, reply: content };
}

async function toolSendPaymentDetails(organizationId: string, args: Record<string, unknown>): Promise<ToolResult> {
  const org = await withTenant(organizationId, (tx) =>
    tx.organization.findUnique({ where: { id: organizationId }, select: { bankName: true, bankAccountNumber: true, ifscCode: true } }),
  );
  if (!org?.bankAccountNumber) {
    return { ok: false, reply: "Payment details aren't set up yet on our end — would you like to speak with an agent?" };
  }

  const packageId = args.packageId ? String(args.packageId) : undefined;
  const packageLine = packageId ? await buildPackageContent(organizationId, packageId) : null;

  const lines = [
    packageLine,
    '*Payment details*',
    org.bankName ? `Bank: ${org.bankName}` : null,
    `A/C No: ${org.bankAccountNumber}`,
    org.ifscCode ? `IFSC: ${org.ifscCode}` : null,
  ].filter((l): l is string => !!l);
  return { ok: true, reply: lines.join('\n') };
}

async function stub(name: ToolName): Promise<ToolResult> {
  console.warn(`[smart-bot] tool "${name}" matched but is not implemented yet — falling back to handoff.`);
  return { ok: false, reply: "Let me get someone from our team to help you with that — connecting you now." };
}

/** Executes whichever tool Gemini matched. `name` outside TOOL_NAMES falls back to the same graceful reply as "no match". */
export async function runBotTool(organizationId: string, name: string, args: Record<string, unknown>): Promise<ToolResult> {
  switch (name) {
    case 'search_package':
      return toolSearchPackage(organizationId, args);
    case 'send_itinerary':
      return toolSendItinerary(organizationId, args);
    case 'send_payment_details':
      return toolSendPaymentDetails(organizationId, args);
    case 'update_lead':
    case 'assign_agent':
    case 'create_followup':
    case 'handoff_to_human':
      return stub(name);
    default:
      return { ok: false, reply: "Sorry, I didn't quite catch that — would you like to speak with an agent?" };
  }
}
