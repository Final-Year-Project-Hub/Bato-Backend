import { Router } from "express";
import {
  signUp,
  login,
  logout,
  verifyOtp,
  resendOtp,
  overViewSummary,
  users,
  resetPassword,
  forgotPassword,
} from "../controllers/auth.controller";
import {errorHandler } from "../middlewares/error-handler";
import { verifyUser,verifyAdmin } from "../middlewares/auth.middleware";
const router: Router = Router();

router.route("/signup").post(errorHandler(signUp));
router.route("/login").post(errorHandler(login));
router.route("/logout").post(verifyUser, errorHandler(logout));
router.route("/verifyOtp").post(errorHandler(verifyOtp));
router.route("/resendOtp").post(errorHandler(resendOtp));
router.route("/resetPassword").post(verifyUser,errorHandler(resetPassword));
router.route("/forgotPassword").post(errorHandler(forgotPassword));
router.route("/overViewSummary").get(verifyUser,verifyAdmin, errorHandler(overViewSummary));
router.route("/users").get(verifyAdmin,errorHandler(users))
router.get("/profile", verifyUser, (req, res) => {
  res.json({ message: "Access granted!", user: (req as any).user });
});

export default router;
