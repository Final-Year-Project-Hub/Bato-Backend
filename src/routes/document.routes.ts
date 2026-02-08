import { Router } from "express";
import multer from "multer";
import { verifyAdmin, verifyUser } from "../middlewares/auth.middleware.js";
import {
  uploadDocument,
  listDocuments,
  getDocument,
  ingestDocument,
  deleteDocument,
} from "../controllers/document.controller.js";

const router = Router();

// Configure multer for file uploads
const upload = multer({
  dest: "uploads/temp/",
  limits: { fileSize: 500 * 1024 * 1024 }, // 500MB
  fileFilter: (req, file, cb) => {
    if (
      file.mimetype === "application/zip" ||
      file.originalname.endsWith(".zip")
    ) {
      cb(null, true);
    } else {
      cb(new Error("Only ZIP files are allowed"));
    }
  },
});

// All routes require user authentication first, then admin access
router.use(verifyUser);
router.use(verifyAdmin);

// Routes
router.post("/upload", upload.single("file"), uploadDocument);
router.get("/", listDocuments);
router.get("/:id", getDocument);
router.post("/ingest/:id", ingestDocument);
router.delete("/:id", deleteDocument);

export default router;
