import {Router} from 'express';
import { verifyOtp,resendOtp  } from '../controllers/auth.controller';
// import { login, logout, signUp, verifyOtp, resendOtp } from '../controllers/auth.controller';
import { errorHandler } from '../middlewares/error-handler';
import { verifyUser } from '../middlewares/auth.middleware';
const router:Router = Router();

// router.route('/signup').post(errorHandler(signUp));
// router.route('/login').post(errorHandler(login))
// router.route('/logout').post(verifyUser, errorHandler(logout))
router.route('/verifyOtp').post(errorHandler(verifyOtp));
router.route('/resendOtp').post(errorHandler(resendOtp));
router.get('/profile', verifyUser, (req, res) => {
    res.json({ message: "Access granted!", user: (req as any).user });
});

export default router;