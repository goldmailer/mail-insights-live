import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import gmailRouter from "./gmail";
import accountsRouter from "./accounts";
import adminRouter from "./admin";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(gmailRouter);
router.use(accountsRouter);
router.use(adminRouter);

export default router;
