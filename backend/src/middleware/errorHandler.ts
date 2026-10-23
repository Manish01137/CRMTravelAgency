import type { ErrorRequestHandler, RequestHandler } from 'express';
import { Prisma } from '@prisma/client';
import { AppError } from '../lib/errors';
import { isProd } from '../env';

export const notFoundHandler: RequestHandler = (req, res) => {
  res.status(404).json({
    error: { code: 'NOT_FOUND', message: `Route ${req.method} ${req.path} not found` },
  });
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  if (res.headersSent) return;

  if (err instanceof AppError) {
    res.status(err.status).json({
      error: { code: err.code, message: err.message, details: err.details ?? undefined },
    });
    return;
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      res.status(409).json({
        error: { code: 'CONFLICT', message: 'That record already exists', details: err.meta?.target },
      });
      return;
    }
    if (err.code === 'P2025') {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Record not found' } });
      return;
    }
  }

  // Message + stack so it shows up in `docker compose logs` — never the request body or headers (tokens).
  // eslint-disable-next-line no-console
  console.error(
    `Unhandled error on ${req.method} ${req.path}:`,
    err instanceof Error ? `${err.name}: ${err.message}\n${err.stack ?? ''}` : String(err),
    err instanceof Prisma.PrismaClientKnownRequestError ? `(Prisma ${err.code})` : '',
  );
  res.status(500).json({
    error: {
      code: 'INTERNAL',
      message: 'Something went wrong on our side',
      ...(isProd ? {} : { details: err instanceof Error ? err.message : String(err) }),
    },
  });
};
