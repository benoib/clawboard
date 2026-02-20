import { Router } from "express";
import { getGatewayStatus } from "../lib/gateway-proxy.js";
import { exec } from "child_process";

const router = Router();

router.get("/status", async (_req, res) => {
  try {
    res.json(await getGatewayStatus());
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

router.post("/restart", (_req, res) => {
  exec("systemctl --user restart openclaw-gateway.service", (err, stdout, stderr) => {
    if (err) return res.status(500).json({ error: stderr || err.message });
    res.json({ ok: true, stdout });
  });
});

export default router;
