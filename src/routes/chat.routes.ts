import { Router } from "express";
import { chatController } from "../controllers/chat.controller";
import { errorHandler } from "../middlewares/error-handler";
import { verifyUser } from "../middlewares/auth.middleware";

const router = Router();

// All chat routes require authentication
router.use(verifyUser);

// Chat session routes
router.post(
  "/",
  errorHandler(chatController.createChatSession.bind(chatController))
);
router.get(
  "/",
  errorHandler(chatController.getChatSessions.bind(chatController))
);
router.get(
  "/:chatId",
  errorHandler(chatController.getChatSession.bind(chatController))
);
router.delete(
  "/:chatId",
  errorHandler(chatController.deleteChatSession.bind(chatController))
);
router.patch(
  "/:chatId",
  errorHandler(chatController.updateChatTitle.bind(chatController))
);

// Message routes
router.get(
  "/:chatId/messages",
  errorHandler(chatController.getChatMessages.bind(chatController))
);
router.post(
  "/:chatId/messages",
  errorHandler(chatController.addMessage.bind(chatController))
);

export default router;
