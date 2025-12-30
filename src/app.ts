import express from "express";
import authRoutes from "./modules/auth/auth.routes.js";

const app = express();
app.use(express.json());

// Add routes
// Example: app.use('/auth', authRoutes);
app.use('/auth', authRoutes);
export default app;
