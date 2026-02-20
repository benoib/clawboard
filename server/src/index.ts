import express from "express";
import cors from "cors";
import path from "path";
import http from "http";
import { fileURLToPath } from "url";
import agentsRouter from "./routes/agents.js";
import configRouter from "./routes/config.js";
import gatewayRouter from "./routes/gateway.js";
import skillsRouter from "./routes/skills.js";
import { attachWarRoom } from "./ws/warroom-handler.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const server = http.createServer(app);
const PORT = Number(process.env.PORT) || 3001;

app.use(cors());
app.use(express.json());

app.use("/api/agents", agentsRouter);
app.use("/api/config", configRouter);
app.use("/api/gateway", gatewayRouter);
app.use("/api/skills", skillsRouter);

const clientDist = path.resolve(__dirname, "../../client/dist");
app.use(express.static(clientDist));
app.get("/{*path}", (_req, res) => {
  res.sendFile(path.join(clientDist, "index.html"));
});

attachWarRoom(server);

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Clawboard API running on :${PORT}`);
});
