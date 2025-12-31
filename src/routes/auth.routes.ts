import {Router} from 'express';
import { login, signUp } from '../controllers/auth.controller';
import { errorHandler } from '../middlewares/error-handler';

const router:Router = Router();

router.route('/signup').post(errorHandler(signUp));
router.route('/login').post(errorHandler(login))


export default router;