import { Router } from "express";
import { readConfigSanitized } from "../lib/openclaw.js";

const router = Router();

router.get("/", async (_req, res) => {
  try {
    res.json(await readConfigSanitized());
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

export default router;
