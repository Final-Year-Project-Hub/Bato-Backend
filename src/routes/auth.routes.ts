import {Router} from 'express';
import { login, logout, signUp } from '../controllers/auth.controller';
import { errorHandler } from '../middlewares/error-handler';
import { verifyUser } from '../middlewares/auth.middleware';
const router:Router = Router();

router.route('/signup').post(errorHandler(signUp));
router.route('/login').post(errorHandler(login))
router.route('/logout').post(verifyUser, errorHandler(logout))
router.get('/profile', verifyUser, (req, res) => {
    res.json({ message: "Access granted!", user: (req as any).user });
});

export default router;