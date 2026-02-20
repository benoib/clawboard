import { Router } from "express";
import {
  getAgents,
  getWorkspaceFiles,
  readWorkspaceFile,
  writeWorkspaceFile,
  getAgentSkills,
  getMemoryFiles,
} from "../lib/openclaw.js";

const router = Router();

router.get("/", async (_req, res) => {
  try {
    res.json(await getAgents());
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const agents = await getAgents();
    const agent = agents.find((a) => a.id === req.params.id);
    if (!agent) return res.status(404).json({ error: "Agent not found" });
    res.json(agent);
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

router.get("/:id/workspace", async (req, res) => {
  try {
    res.json(await getWorkspaceFiles(req.params.id));
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

router.get("/:id/workspace/:file", async (req, res) => {
  try {
    const content = await readWorkspaceFile(req.params.id, req.params.file);
    res.json({ content });
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

router.put("/:id/workspace/:file", async (req, res) => {
  try {
    await writeWorkspaceFile(req.params.id, req.params.file, req.body.content);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

router.get("/:id/skills", async (req, res) => {
  try {
    res.json(await getAgentSkills(req.params.id));
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

router.get("/:id/memory", async (req, res) => {
  try {
    res.json(await getMemoryFiles(req.params.id));
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

export default router;
