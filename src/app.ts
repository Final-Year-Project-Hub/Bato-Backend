import express,{Express} from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import authRoutes from "./routes/auth.routes";
import { errorMiddleware } from "./middlewares/error";
import { errorHandler } from "./middlewares/error-handler";

const app:Express = express();
app.use(cors({
    origin: process.env.FRONTEND_URL || "http://localhost:5173", // Default Vite port
    credentials: true
}));
app.use(express.json());
app.use(cookieParser());

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