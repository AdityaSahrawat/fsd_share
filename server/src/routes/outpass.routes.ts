import { Router } from "express";

import {
  createOutPass,
  deleteOutPass,
  getOutPass,
  listOutPasses,
  updateOutPass,
} from "../controllers/outpass.controller";
import { requireAuth } from "../middleware/auth.middleware";
import { asyncHandler } from "../middleware/asyncHandler";

const router = Router();

router.post("/outpasses", requireAuth, asyncHandler(createOutPass));
router.get("/outpasses", requireAuth, asyncHandler(listOutPasses));
router.get("/outpasses/:id", requireAuth, asyncHandler(getOutPass));
router.patch("/outpasses/:id", requireAuth, asyncHandler(updateOutPass));
router.delete("/outpasses/:id", requireAuth, asyncHandler(deleteOutPass));

export default router;
