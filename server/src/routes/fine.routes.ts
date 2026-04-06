import { Router } from "express";
import {requireAuth } from "../middleware/auth.middleware";
import { asyncHandler } from "../middleware/asyncHandler";
import { createFine, listFines, markFinePaid } from "../controllers/fine.controller";

const router = Router();

router.get("/fines", requireAuth, asyncHandler(listFines));
router.post("/fines", requireAuth, asyncHandler(createFine));
router.patch("/fines/:id/pay", requireAuth, asyncHandler(markFinePaid));

export default router;
