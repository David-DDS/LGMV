import { Router, type IRouter } from "express";
import healthRouter from "./health";
import systemsRouter from "./systems";
import uploadsRouter from "./uploads";

const router: IRouter = Router();

router.use(healthRouter);
router.use(systemsRouter);
router.use(uploadsRouter);

export default router;
