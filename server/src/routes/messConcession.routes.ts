import { Router } from "express";

import {
  createMessConcession,
  deleteMessConcession,
  getMessConcession,
  listMessConcessions,
  updateMessConcession,
} from "../controllers/messConcession.controller";
import { requireAuth } from "../middleware/auth.middleware";

const router = Router();

router.post("/messconcessions", requireAuth, createMessConcession);
router.get("/messconcessions", requireAuth, listMessConcessions);
router.get("/messconcessions/:id", requireAuth, getMessConcession);
router.patch("/messconcessions/:id", requireAuth, updateMessConcession);
router.delete("/messconcessions/:id", requireAuth, deleteMessConcession);

export default router;
