import express,{Express} from "express";
import authRoutes from "./routes/auth.routes";
import { errorMiddleware } from "./middlewares/error";
import { errorHandler } from "./middlewares/error-handler";

const app:Express = express();
app.use(express.json());

// Add routes
app.use('/auth', authRoutes);

// Root route
app.get('/', (req, res) => {
    res.json(
        {message:"Welcome to the Backend Server - Yunika"}
    );
});

app.use(errorMiddleware);

export default app;