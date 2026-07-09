import type { Request, Response, NextFunction } from 'express';
import { ZodError, type ZodTypeAny } from 'zod';
import { BadRequest } from './errors';

interface Schemas {
  body?: ZodTypeAny;
  query?: ZodTypeAny;
  params?: ZodTypeAny;
}

/**
 * Validates and coerces request parts against zod schemas. On success the parsed
 * (typed, defaulted) values replace req.body / req.query / req.params. On failure
 * it forwards a 400 with field-level details.
 */
export function validate(schemas: Schemas) {
  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      if (schemas.body) req.body = schemas.body.parse(req.body);
      if (schemas.query) Object.assign(req.query, schemas.query.parse(req.query));
      if (schemas.params) Object.assign(req.params, schemas.params.parse(req.params));
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        next(BadRequest('Validation failed', err.flatten().fieldErrors));
      } else {
        next(err);
      }
    }
  };
}
