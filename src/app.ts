import express, { Express } from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import authRoutes from "./routes/auth.routes";
import roadmapRoutes from "./routes/roadmap.routes";
import { errorMiddleware } from "./middlewares/error";
import { errorHandler } from "./middlewares/error-handler";

const app: Express = express();
const allowedOrigins = [
  "http://localhost:3000",
  "http://localhost:5173",
].filter(Boolean) as string[];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);

      if (allowedOrigins.indexOf(origin) === -1) {
        const msg =
          "The CORS policy for this site does not allow access from the specified Origin.";
        return callback(new Error(msg), false);
      }
      return callback(null, true);
    },
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