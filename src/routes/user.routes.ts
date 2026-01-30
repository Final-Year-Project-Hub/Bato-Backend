import { Router } from "express";
import { editUser, deleteUser, userProfileImage, getUserById, getAllUsers } from "../controllers/user.controller";
import { errorHandler } from "../middlewares/error-handler";
import { verifyUser } from "../middlewares/auth.middleware";
import { upload } from "../middlewares/multer.middleware";

const router: Router = Router();

// Update user details
router.route("/editUser").put(verifyUser, errorHandler(editUser));
// Update user profile image
router.route("/userProfileImage").put(verifyUser, upload.single("image"), errorHandler(userProfileImage));
router.route("/getUserById/:id").get(verifyUser, errorHandler(getUserById));
router.route("/getAllUsers").get(verifyUser, errorHandler(getAllUsers));
// Delete user account
router.route("/deleteUser").delete(verifyUser, errorHandler(deleteUser));

export default router;
