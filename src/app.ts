import express, { Express } from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import swaggerUi from "swagger-ui-express";
import YAML from "yamljs";
import path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";
import authRoutes from "./routes/auth.routes";
import roadmapRoutes from "./routes/roadmap.routes";
import chatRoutes from "./routes/chat.routes";
import progressRoutes from "./routes/progress.routes";
import userRoutes from "./routes/user.routes";
import { errorMiddleware } from "./middlewares/error";
import { errorHandler } from "./middlewares/error-handler";
// Better Auth removed - using custom JWT authentication

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app: Express = express();

// Load Swagger documentation
const swaggerDocument = YAML.load(path.join(__dirname, "../swagger.yaml"));

// Parse allowed origins from environment variable
const allowedOrigins = (
  process.env.ALLOWED_ORIGINS || ""
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
  }),
);

// Better Auth route handler removed

app.use(express.json());
app.use(cookieParser());

// Swagger API Documentation
app.use(
  "/api-docs",
  swaggerUi.serve,
  swaggerUi.setup(swaggerDocument, {
    customCss: ".swagger-ui .topbar { display: none }",
    customSiteTitle: "Bato-AI API Documentation",
  }),
);

// Routes
app.use("/auth", authRoutes);
app.use("/api/roadmap", roadmapRoutes);
app.use("/api/chats", chatRoutes);
app.use("/api/roadmap/:roadmapId/progress", progressRoutes);
app.use("/api/user", userRoutes);

// Root route
app.get("/", (req, res) => {
  res.json({
    message: "Bato-AI Backend Server",
    version: "1.0.0",
    documentation: "http://localhost:4000/api-docs",
    endpoints: {
      customAuth: "/auth (signup, login, logout, verify-otp, resend-otp)",
      roadmap: "/api/roadmap",
      chat: "/api/chats",
      progress: "/api/roadmap/:roadmapId/progress",
      user: "/api/user (edit, profile-image)",
    },
  });
});

// Error handling middleware must be last
app.use(errorMiddleware);

export default app;
