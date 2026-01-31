import { CookieOptions, Router } from "express";
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
import passport from "passport";
import {generateAccessToken, generateRefreshToken } from "../utils/jwt";
import { prisma } from "@/lib/prisma";
const router: Router = Router();

router.route("/signup").post(errorHandler(signUp));
router.route("/login").post(errorHandler(login));
router.route("/logout").post(verifyUser, errorHandler(logout));
router.route("/verifyOtp").post(errorHandler(verifyOtp));
router.route("/resendOtp").post(errorHandler(resendOtp));
router.route("/resetPassword").post(errorHandler(resetPassword));
router.route("/forgotPassword").post(errorHandler(forgotPassword));
router.route("/overViewSummary").get(verifyUser,verifyAdmin, errorHandler(overViewSummary));
router.route("/users").get(verifyAdmin,errorHandler(users))
router.get("/profile", verifyUser, (req, res) => {
  res.json({ message: "Access granted!", user: (req as any).user });
});

//Google Login
router.route("/google").get(passport.authenticate("google", { scope: ["profile", "email"],session: false,prompt: "select_account",}));
router.route("/google/callback").get(passport.authenticate("google", { failureRedirect: `${process.env.FRONTEND_URL}/login`,session: false, }),
  async (req, res, next) => {
    try {
      const user = req.user as any;

      const accessToken = generateAccessToken(user.id);
      const refreshToken = generateRefreshToken(user.id);

      // ✅ Save refreshToken in DB
      await prisma.user.update({
        where: { id: user.id },
        data: { refreshToken },
      });

      const cookieOptions: CookieOptions = {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      };

      res.cookie("accessToken", accessToken, cookieOptions);
      res.cookie("refreshToken", refreshToken, cookieOptions);

      return res.redirect(`${process.env.FRONTEND_URL}/chat`);
    } catch (err) {
      next(err);
    }
  });

export default router;
