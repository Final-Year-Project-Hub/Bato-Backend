import express, { Express } from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import authRoutes from "./routes/auth.routes";
import roadmapRoutes from "./routes/roadmap.routes";
import chatRoutes from "./routes/chat.routes";
import progressRoutes from "./routes/progress.routes";
import { errorMiddleware } from "./middlewares/error";
import { errorHandler } from "./middlewares/error-handler";
import { auth } from "./lib/auth";
import { toNodeHandler } from "better-auth/node";

const app: Express = express();

// Parse allowed origins from environment variable
const allowedOrigins = (
  process.env.ALLOWED_ORIGINS || "http://localhost:3000,http://localhost:5173"
)
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, postman) only in development
      if (!origin && process.env.NODE_ENV === "development") {
        return callback(null, true);
      }

      if (!origin || allowedOrigins.indexOf(origin) === -1) {
        const msg =
          "The CORS policy for this site does not allow access from the specified Origin.";
        return callback(new Error(msg), false);
      }
      return callback(null, true);
    },
    credentials: true,
  })
);

app.all("/api/auth/*path", toNodeHandler(auth));

app.use(express.json());
app.use(cookieParser());

// Routes
app.use("/auth", authRoutes);
app.use("/api/roadmap", roadmapRoutes);
app.use("/api/chats", chatRoutes);
app.use("/api/roadmap/:roadmapId/progress", progressRoutes);

// Root route
app.get("/", (req, res) => {
  res.json({
    message: "Bato-AI Backend Server",
    version: "1.0.0",
    endpoints: {
      betterAuth: "/api/auth/ (signup, signin, signout,email)",
      customAuth: "/auth (verify-otp, resend-otp)",
      roadmap: "/api/roadmap",
    },
  });
});

// Error handling middleware must be last
app.use(errorMiddleware);

export default app;
