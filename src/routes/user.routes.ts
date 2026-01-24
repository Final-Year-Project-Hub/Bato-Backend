import { Router } from "express";
import { editUser, deleteUser } from "../controllers/user.controller";
import { errorHandler } from "../middlewares/error-handler";
import { verifyUser } from "../middlewares/auth.middleware";
import upload from "../middlewares/upload";

const router: Router = Router();

// Update user details
router.route("/editUser").put(verifyUser, errorHandler(editUser));
// Update user profile image
// router.route("/userProfile").put(verifyUser, upload.single("image"), errorHandler(userProfile));
// Delete user account
router.route("/deleteUser").delete(verifyUser, errorHandler(deleteUser));

export default router;
