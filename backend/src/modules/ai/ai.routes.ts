import { Router } from 'express';
import type { Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { env } from '../../env';
import { asyncHandler } from '../../lib/http';
import { validate } from '../../lib/validate';
import { requireAuth } from '../../middleware/auth';
import { AppError, BadRequest } from '../../lib/errors';

/**
 * AI package generation (Google Gemini). Gated behind GEMINI_API_KEY — when the
 * key is absent the endpoint returns a clear 503 so the UI can show a
 * "not configured yet" state instead of failing mysteriously.
 */

const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: 'RATE_LIMITED', message: 'Slow down — too many AI requests' } },
});

const generateSchema = z.object({
  prompt: z.preprocess((v) => (v === '' ? undefined : v), z.string().max(1000).optional()),
  name: z.string().trim().max(150).optional(),
  destination: z.string().trim().max(120).optional(),
  nights: z.coerce.number().int().min(0).max(365).optional(),
  days: z.coerce.number().int().min(1).max(366).optional(),
  priceAmount: z.coerce.number().int().nonnegative().optional(),
  currency: z.string().trim().max(3).optional(),
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

let client: GoogleGenerativeAI | null = null;
function getClient(): GoogleGenerativeAI | null {
  if (client) return client;
  if (!env.GEMINI_API_KEY) return null;
  client = new GoogleGenerativeAI(env.GEMINI_API_KEY);
  return client;
}

const router = Router();

/** Lets the UI show/hide the AI button without a failed request. */
router.get(
  '/status',
  requireAuth,
  asyncHandler(async (_req: Request, res: Response) => {
    res.json({ enabled: !!env.GEMINI_API_KEY, provider: 'gemini', model: env.GEMINI_MODEL });
  }),
);

router.post(
  '/generate-package',
  requireAuth,
  aiLimiter,
  validate({ body: generateSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const genAI = getClient();
    if (!genAI) {
      throw new AppError(
        503,
        'AI_NOT_CONFIGURED',
        'AI generation is not configured yet. Add a Gemini API key to enable it.',
      );
    }

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
      model: env.GEMINI_MODEL,
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
      throw new AppError(502, 'AI_FAILED', 'The AI service could not complete the request. Try again.');
    }

    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(raw);
    } catch {
      // Occasionally the model wraps JSON in prose/fences — extract the object.
      const match = raw.match(/\{[\s\S]*\}/);
      if (!match) throw BadRequest('AI returned an unexpected response. Please try again.');
      parsedJson = JSON.parse(match[0]);
    }

    const safe = aiResultSchema.safeParse(parsedJson);
    if (!safe.success) throw BadRequest('AI returned malformed content. Please try again.');

    res.json(safe.data);
  }),
);

export default router;
