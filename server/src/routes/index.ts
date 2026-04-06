import { Router } from "express";

import authRoutes from "./auth.routes";
import messConcessionRoutes from "./messConcession.routes";
import outpassRoutes from "./outpass.routes";
import staffRoutes from "./staff.routes";
import studentRoutes from "./student.routes";
import roomRoutes from "./room.routes";
import fineRoutes from "./fine.routes";

const router = Router();

router.use(authRoutes);
router.use(staffRoutes);
router.use(studentRoutes);
router.use(outpassRoutes);
router.use(messConcessionRoutes);
router.use(roomRoutes);
router.use(fineRoutes);

export default router;
