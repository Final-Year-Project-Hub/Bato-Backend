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
import { errorHandler } from "../middlewares/error-handler";
import { verifyUser, verifyAdmin } from "../middlewares/auth.middleware";
import { ApiResponse } from "../utils/apiResponse";
import passport from "passport";
import { generateAccessandRefreshToken } from "../controllers/auth.controller";
import { prisma } from "@/lib/prisma";
import jwt, { JwtPayload } from "jsonwebtoken";
const router: Router = Router();

router.route("/signup").post(errorHandler(signUp));
router.route("/login").post(errorHandler(login));
router.route("/logout").post(verifyUser, errorHandler(logout));
router.route("/verifyOtp").post(errorHandler(verifyOtp));
router.route("/resendOtp").post(errorHandler(resendOtp));
router.route("/resetPassword").post(errorHandler(resetPassword));
router.route("/forgotPassword").post(errorHandler(forgotPassword));
router
  .route("/overViewSummary")
  .get(verifyUser, verifyAdmin, errorHandler(overViewSummary));
router.route("/users").get(verifyAdmin, errorHandler(users));
router.get("/profile", verifyUser, (req, res) => {
  res.json({ message: "Access granted!", user: (req as any).user });
});

//Google Login
// router.get("/google/url", (req, res) => {
//   const backendUrl = process.env.BACKEND_URL; // e.g. https://bato-backend-a9x8.onrender.com
//   if (!backendUrl) {
//     return res.status(500).json({ message: "BACKEND_URL is not set" });
//   }

//   const callbackUrl = `${backendUrl.replace(/\/$/, "")}/auth/google/callback`;

//   const params = new URLSearchParams({
//     client_id: process.env.GMAIL_CLIENT_ID || "",
//     redirect_uri: callbackUrl,
//     response_type: "code",
//     scope: "openid email profile",
//     prompt: "select_account",
//     access_type: "offline",
//     include_granted_scopes: "true",
//   });

//   if (!process.env.GMAIL_CLIENT_ID) {
//     return res.status(500).json({ message: "GOOGLE_CLIENT_ID is not set" });
//   }

//   const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;

//   return res.json({
//     success: true,
//     authUrl,
//     callbackUrl, // helpful for debugging (you can remove later)
//   });
// });

/**
 * ✅ 2) Old /google route stays (browser navigation should hit this)
 */
router.get(
  "/google",
  passport.authenticate("google", {
    scope: ["profile", "email"],
    session: false,
    prompt: "select_account",
  }),
);

/**
 * ✅ 3) Callback route - unchanged core logic
 */
router.get(
  "/google/callback",
  passport.authenticate("google", {
    failureRedirect: `${process.env.FRONTEND_URL}/login`,
    session: false,
  }),
  async (req, res, next) => {
    try {
      const user = req.user as any;

      const { accessToken, refreshToken } = await generateAccessandRefreshToken(
        user.id,
      );

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

      return res.redirect(
        `${process.env.FRONTEND_URL}/api/session/set?accessToken=${encodeURIComponent(
          accessToken,
        )}&refreshToken=${encodeURIComponent(refreshToken)}`,
      );
    } catch (err) {
      next(err);
    }
  },
);
export default router;
