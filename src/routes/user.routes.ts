import { Router } from "express";
import { editUser, deleteUser, userProfileImage } from "../controllers/user.controller";
import { errorHandler } from "../middlewares/error-handler";
import { verifyUser } from "../middlewares/auth.middleware";
import { upload } from "../middlewares/multer.middleware";

const router: Router = Router();

// Update user details
router.route("/editUser").put(verifyUser, errorHandler(editUser));
// Update user profile image
router.route("/userProfileImage").put(verifyUser, upload.single("image"), errorHandler(userProfileImage));
// Delete user account
router.route("/deleteUser").delete(verifyUser, errorHandler(deleteUser));

export default router;
