import { Router } from "express";

import { createStaff, createWarden } from "../controllers/staff.controller";
import { requireAuth, requireWarden } from "../middleware/auth.middleware";
import { requireBootstrapSecret } from "../middleware/bootstrap.middleware";

const router = Router();

// Only a WARDEN can create a STAFF.
router.post("/staff", requireAuth, requireWarden, createStaff);

// Create a WARDEN either via an existing WARDEN, or via BOOTSTRAP_SECRET.
router.post("/warden", (req, res, next) => {
  const hasAuth = Boolean(req.header("authorization"));
  return hasAuth ? requireAuth(req, res, next) : requireBootstrapSecret(req, res, next);
}, (req, res, next) => {
  const hasAuth = Boolean(req.header("authorization"));
  return hasAuth ? requireWarden(req, res, next) : next();
}, createWarden);

export default router;
