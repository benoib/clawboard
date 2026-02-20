import { Router } from "express";
import { getGlobalSkills } from "../lib/openclaw.js";

const router = Router();

router.get("/", async (_req, res) => {
  try {
    res.json(await getGlobalSkills());
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

export default router;
