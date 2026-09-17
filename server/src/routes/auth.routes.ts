import { Router } from "express";
import {
  googleCallback,
  googleStart,
  login,
  me,
  register,
} from "../controllers/auth.controller";
import { authenticate } from "../middleware/authenticate";

const authRouter = Router();

authRouter.post("/login", login);
authRouter.post("/register", register);
authRouter.get("/me", authenticate, me);
authRouter.get("/google", googleStart);
authRouter.get("/google/callback", googleCallback);

export default authRouter;
