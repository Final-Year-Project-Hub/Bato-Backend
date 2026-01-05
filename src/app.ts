import express, { Express } from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import authRoutes from "./routes/auth.routes";
import roadmapRoutes from "./routes/roadmap.routes";
import { errorMiddleware } from "./middlewares/error";
import { errorHandler } from "./middlewares/error-handler";

const app: Express = express();
app.use(
  cors({
    origin: process.env.FRONTEND_URL ,
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());

// Routes
app.use("/auth", authRoutes);
app.use("/api/roadmap", roadmapRoutes);

// Root route
app.get("/", (req, res) => {
  res.json({
    message: "Bato-AI Backend Server",
    version: "1.0.0",
    endpoints: {
      auth: "/auth",
      roadmap: "/api/roadmap",
    },
  });
});

app.use(errorMiddleware);

export default app;