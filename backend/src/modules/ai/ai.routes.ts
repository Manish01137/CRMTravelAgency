import { Router } from 'express';
import type { Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { env } from '../../env';
import { asyncHandler } from '../../lib/http';
import { validate } from '../../lib/validate';
import { requireAuth } from '../../middleware/auth';
import { AppError, BadRequest } from '../../lib/errors';
import { geminiClient } from '../../lib/gemini';
/**
 * AI package generation (Google Gemini), using the server's GEMINI_API_KEY —
 * the same platform-level key every AI feature uses. Without it the endpoints
 * return a clear 503 so the UI can show a "not enabled" state.
 */

/** The Gemini client (falls back across models — see lib/gemini.ts), or null without a key. */
function resolveClient(): { genAI: ReturnType<typeof geminiClient>; model: string } | null {
  if (!env.GEMINI_API_KEY?.trim()) return null;
  return { genAI: geminiClient(env.GEMINI_API_KEY.trim()), model: env.GEMINI_MODEL };
}

function notConfigured(): AppError {
  return new AppError(
    503,
    'AI_NOT_CONFIGURED',
    'Gemini API key not configured — add GEMINI_API_KEY to backend/.env on the server and restart the backend.',
  );
}

/** Logs Gemini's real error (model, status, message) server-side; the user sees a short retry message. */
function aiFailed(err: unknown, what: string): AppError {
  console.error(`[ai] ${what} failed:`, err instanceof Error ? err.message : err);
  return new AppError(502, 'AI_FAILED', 'The AI service could not complete the request. Try again in a moment.');
}

// Context for a draft — never a reason to refuse one: long text is trimmed,
// prices are rounded, and anything unreadable is simply left out.
const optionalText = (max: number) =>
  z.preprocess((v) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : undefined), z.string().optional());
const optionalInt = (min: number, max: number) =>
  z.preprocess((v) => {
    const n = typeof v === 'string' ? Number(v.replace(/[^\d.]/g, '')) : typeof v === 'number' ? v : NaN;
    return Number.isFinite(n) && n >= min ? Math.min(Math.round(n), max) : undefined;
  }, z.number().int().optional());

const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: 'RATE_LIMITED', message: 'Slow down — too many AI requests' } },
});

const generateSchema = z.object({
  prompt: optionalText(2000),
  name: optionalText(200),
  destination: optionalText(200),
  nights: optionalInt(0, 365),
  days: optionalInt(1, 366),
  priceAmount: optionalInt(0, 1_000_000_000),
  currency: z.preprocess((v) => (typeof v === 'string' && /^[a-z]{3}$/i.test(v.trim()) ? v.trim().toUpperCase() : undefined), z.string().optional()),
});

// Shape we ask Gemini to return — mirrors the package builder fields.
const RESULT_SHAPE = `{
  "description": "string (2-3 vivid paragraphs, plain text)",
  "highlights": ["4-6 short punchy strings"],
  "inclusions": "string, one item per line",
  "exclusions": "string, one item per line",
  "itinerary": [{ "day": 1, "title": "string", "description": "string (2-4 sentences)" }],
  "faqs": [{ "question": "string", "answer": "string" }]
}`;

const aiResultSchema = z.object({
  description: z.string().max(20000).optional().default(''),
  highlights: z.array(z.string().max(200)).max(12).optional().default([]),
  inclusions: z.string().max(5000).optional().default(''),
  exclusions: z.string().max(5000).optional().default(''),
  itinerary: z
    .array(
      z.object({
        day: z.coerce.number().int().min(1).max(366),
        title: z.string().max(200),
        description: z.string().max(5000).optional().default(''),
      }),
    )
    .max(60)
    .optional()
    .default([]),
  faqs: z
    .array(z.object({ question: z.string().max(300), answer: z.string().max(3000) }))
    .max(30)
    .optional()
    .default([]),
});

const router = Router();

/** Lets the UI show/hide the AI button without a failed request. */
router.get(
  '/status',
  requireAuth,
  asyncHandler(async (_req: Request, res: Response) => {
    const resolved = resolveClient();
    res.json({ enabled: !!resolved, provider: 'gemini', model: env.GEMINI_MODEL });
  }),
);

router.post(
  '/generate-package',
  requireAuth,
  aiLimiter,
  validate({ body: generateSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const resolved = resolveClient();
    if (!resolved) throw notConfigured();
    const { genAI, model: modelName } = resolved;

    const input = req.body as z.infer<typeof generateSchema>;
    const context = [
      input.name && `Package name: ${input.name}`,
      input.destination && `Destination: ${input.destination}`,
      (input.nights != null || input.days != null) && `Duration: ${input.nights ?? '?'} nights / ${input.days ?? '?'} days`,
      input.priceAmount != null && `Price: ${input.priceAmount} ${input.currency ?? 'INR'} per person`,
      input.prompt && `Extra instructions: ${input.prompt}`,
    ]
      .filter(Boolean)
      .join('\n');

    const model = genAI.getGenerativeModel({
      model: modelName,
      generationConfig: { responseMimeType: 'application/json', temperature: 0.8 },
    });

    const promptText = `You are an expert travel-package copywriter for a travel agency CRM.
Write compelling, accurate, sales-ready content for this trip package.

${context || 'A general travel package (infer sensible defaults).'}

Return ONLY valid JSON exactly matching this shape (no markdown, no commentary):
${RESULT_SHAPE}

Rules:
- Make the itinerary match the number of days if given; otherwise 3-5 days.
- Keep it realistic for the destination. Currency stays as given.
- Plain text only inside strings (no markdown).`;

    let raw: string;
    try {
      const result = await model.generateContent(promptText);
      raw = result.response.text();
    } catch (err) {
      throw aiFailed(err, 'generate-package');
    }

    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(raw);
    } catch {
      // Occasionally the model wraps JSON in prose/fences — extract the object.
      const match = raw.match(/\{[\s\S]*\}/);
      try {
        parsedJson = match ? JSON.parse(match[0]) : null;
      } catch {
        parsedJson = null;
      }
      if (!parsedJson) {
        console.error('[ai] generate-package: unreadable response:', raw.slice(0, 300));
        throw new AppError(502, 'AI_FAILED', 'AI returned an unexpected response. Please try again.');
      }
    }

    const safe = aiResultSchema.safeParse(parsedJson);
    if (!safe.success) {
      console.error('[ai] generate-package: response failed the shape check:', JSON.stringify(safe.error.flatten().fieldErrors).slice(0, 300));
      throw new AppError(502, 'AI_FAILED', 'AI returned malformed content. Please try again.');
    }

    res.json(safe.data);
  }),
);

const itineraryDaySchema = z.object({
  destination: z.preprocess((v) => (v === '' ? undefined : v), z.string().trim().max(120).optional()),
  dayNumber: z.coerce.number().int().min(1).max(366),
  dayTitle: z.string().trim().min(1, 'Add a day title first').max(200),
  packageContext: z.preprocess((v) => (v === '' ? undefined : v), z.string().trim().max(150).optional()),
});

/** Single-day itinerary description — the per-day "Generate with AI" button in the package builder's Itinerary step. */
router.post(
  '/itinerary-day',
  requireAuth,
  aiLimiter,
  validate({ body: itineraryDaySchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const resolved = resolveClient();
    if (!resolved) throw notConfigured();
    const { genAI, model: modelName } = resolved;

    const input = req.body as z.infer<typeof itineraryDaySchema>;
    const context = [
      input.packageContext && `Package: ${input.packageContext}`,
      input.destination && `Destination: ${input.destination}`,
      `Day ${input.dayNumber} title: ${input.dayTitle}`,
    ]
      .filter(Boolean)
      .join('\n');

    const model = genAI.getGenerativeModel({ model: modelName, generationConfig: { temperature: 0.8 } });

    const promptText = `You are an expert travel-package copywriter for a travel agency CRM.
Write a short, vivid plan for ONE day of a trip itinerary.

${context}

Return ONLY the day's description text — 2-4 sentences, plain text, no markdown, no surrounding quotes, no preamble like "Here is...".`;

    let raw: string;
    try {
      const result = await model.generateContent(promptText);
      raw = result.response.text();
    } catch (err) {
      throw aiFailed(err, 'itinerary-day');
    }

    // Models occasionally wrap the answer in quotes or a stray markdown fence despite instructions.
    const description = raw.trim().replace(/^["'`]+|["'`]+$/g, '').trim();
    if (!description) throw BadRequest('AI returned an empty response. Please try again.');

    res.json({ description });
  }),
);

export default router;
