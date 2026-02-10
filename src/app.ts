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
import topicRoutes from "./routes/topic.routes";
import quizRoutes from "./routes/quiz.routes";
import documentRoutes from "./routes/document.routes.js";
import { errorMiddleware } from "./middlewares/error";
import { errorHandler } from "./middlewares/error-handler";
import passport from "passport";
import "./lib/passport.ts";
// Better Auth removed - using custom JWT authentication

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app: Express = express();

// Load Swagger documentation
const swaggerDocument = YAML.load(path.join(__dirname, "../swagger.yaml"));

// Swagger API Documentation
app.use(
  "/api-docs",
  swaggerUi.serve,
  swaggerUi.setup(swaggerDocument, {
    customCss: ".swagger-ui .topbar { display: none }",
    customSiteTitle: "Bato-AI API Documentation",
  }),
);

// Parse allowed origins from environment variable
const allowedOrigins = (process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const corsOAuth = cors({
  origin: true,
  credentials: true,
});

// ✅ Strict CORS for API calls (fetch/XHR)
const corsStrict = cors({
  origin: (origin, callback) => {
    // ✅ Allow requests with no Origin (OAuth redirects, browser navigation, server-to-server, Postman)
    // If you want to be extra strict: allow only in GET/HEAD, but simplest is allow.
    if (!origin) return callback(null, true);

    if (!allowedOrigins.includes(origin)) {
      const msg =
        "The CORS policy for this site does not allow access from the specified Origin.";
      return callback(new Error(msg), false);
    }

    return callback(null, true);
  },
  credentials: true,
});

// app.use(
//   cors({
//     origin: (origin, callback) => {
//       // Allow requests with no origin (like mobile apps, curl, postman) only in development
//       if (!origin && process.env.NODE_ENV === "development") {
//         return callback(null, true);
//       }

//       if (!origin || allowedOrigins.indexOf(origin) === -1) {
//         const msg =
//           "The CORS policy for this site does not allow access from the specified Origin.";
//         return callback(new Error(msg), false);
//       }
//       return callback(null, true);
//     },
//     credentials: true,
//   }),
// );

app.use("/auth/google", corsOAuth);
app.use("/auth/google/callback", corsOAuth);

app.use(corsStrict);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(passport.initialize());

// Routes
app.use("/auth", authRoutes);
app.use("/api/roadmap", roadmapRoutes);
app.use("/api/chats", chatRoutes);
app.use("/api/roadmap/:roadmapId/progress", progressRoutes);
app.use("/api/user", userRoutes);
app.use("/api/topic", topicRoutes);
app.use("/api/quiz", quizRoutes);
app.use("/api/admin/documents", documentRoutes);

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

// Force restart to reload swagger.yaml
