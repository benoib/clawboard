import WebSocket from "ws";

const GATEWAY_PORT = process.env.GATEWAY_PORT || "18789";
const GATEWAY_TOKEN = process.env.GATEWAY_TOKEN || "";

function getWsUrl() {
  const base = `ws://127.0.0.1:${GATEWAY_PORT}`;
  return GATEWAY_TOKEN ? `${base}?token=${GATEWAY_TOKEN}` : base;
}

export async function gatewayRpc(method: string, params: Record<string, unknown> = {}): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(getWsUrl());
    const id = crypto.randomUUID();
    const timeout = setTimeout(() => {
      ws.close();
      reject(new Error("Gateway RPC timeout"));
    }, 10_000);

    ws.on("open", () => {
      ws.send(JSON.stringify({ type: "req", id, method, params }));
    });

    ws.on("message", (data) => {
      try {
        const msg = JSON.parse(data.toString());
        if (msg.id === id && msg.type === "res") {
          clearTimeout(timeout);
          ws.close();
          if (msg.ok) resolve(msg.payload);
          else reject(new Error(msg.error?.message || "Gateway RPC error"));
        }
      } catch { /* ignore parse errors */ }
    });

    ws.on("error", (err) => {
      clearTimeout(timeout);
      reject(err);
    });
  });
}

export async function getGatewayStatus() {
  try {
    const result = await gatewayRpc("health");
    return { running: true, port: Number(GATEWAY_PORT), ...(result as Record<string, unknown>) };
  } catch {
    return { running: false, port: Number(GATEWAY_PORT) };
  }
}
