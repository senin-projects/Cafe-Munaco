import { Router, type IRouter } from "express";
import dashboardRouter from "./dashboard";
import healthRouter from "./health";
import inventoryRouter from "./inventory";
import menuRouter from "./menu";
import ordersRouter from "./orders";
import reservationsRouter from "./reservations";
import staffRouter from "./staff";

const router: IRouter = Router();

router.use(healthRouter);
router.use(staffRouter);
router.use(dashboardRouter);
router.use(menuRouter);
router.use(ordersRouter);
router.use(reservationsRouter);
router.use(inventoryRouter);

export default router;
