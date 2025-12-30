import express,{Express} from "express";
import authRoutes from "./modules/auth.routes";
import { errorMiddleware } from "./middlewares/error";
import { errorHandler } from "./error-handler";

const app:Express = express();
app.use(express.json());
app.use(errorMiddleware);

// Add routes
app.use('/auth', errorHandler(authRoutes));

export default app;