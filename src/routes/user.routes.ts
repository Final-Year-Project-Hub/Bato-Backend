import { Router } from "express";
import { editUser, userProfile } from "../controllers/user.controller";
import { errorHandler } from "../middlewares/error-handler";
import { verifyUser } from "../middlewares/auth.middleware";
import { upload } from "../middlewares/upload";

const router: Router = Router();

// Update user details
router.route("/editUser").put(verifyUser, errorHandler(editUser));
// Update user profile image
router.route("/userProfile").put(verifyUser, upload.single("file"), errorHandler(userProfile));

export default router;
