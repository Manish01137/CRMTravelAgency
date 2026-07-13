import { Router } from 'express';
import type { Request, Response } from 'express';
import { asyncHandler } from '../../lib/http';
import { validate } from '../../lib/validate';
import { requireAuth } from '../../middleware/auth';
import * as service from './packages.service';
import {
  createPackageSchema,
  listPackagesQuerySchema,
  packageIdParam,
  updatePackageSchema,
  type ListPackagesQuery,
} from './packages.schemas';

const router = Router();
router.use(requireAuth);

router.get(
  '/',
  validate({ query: listPackagesQuerySchema }),
  asyncHandler(async (req: Request, res: Response) => {
    res.json(await service.listPackages(req.auth!.organizationId, req.query as unknown as ListPackagesQuery));
  }),
);

router.post(
  '/',
  validate({ body: createPackageSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    res.status(201).json(await service.createPackage(req.auth!.organizationId, req.body));
  }),
);

router.get(
  '/:id',
  validate({ params: packageIdParam }),
  asyncHandler(async (req: Request, res: Response) => {
    res.json(await service.getPackage(req.auth!.organizationId, req.params.id));
  }),
);

router.patch(
  '/:id',
  validate({ params: packageIdParam, body: updatePackageSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    res.json(await service.updatePackage(req.auth!.organizationId, req.params.id, req.body));
  }),
);

router.delete(
  '/:id',
  validate({ params: packageIdParam }),
  asyncHandler(async (req: Request, res: Response) => {
    await service.deletePackage(req.auth!.organizationId, req.params.id);
    res.json({ ok: true });
  }),
);

export default router;
