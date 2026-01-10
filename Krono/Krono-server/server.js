// server.js
const WebSocket = require("ws");

const wss = new WebSocket.Server({ port: 8080 });
console.log("✅ Serveur WebSocket lancé sur ws://0.0.0.0:8080");

const clients = new Set();

wss.on("connection", (ws) => {
  clients.add(ws);
  console.log("🔌 Nouveau client connecté");

  ws.on("message", (message) => {
    const msg = message.toString();
    console.log("📩 Message reçu :", msg);

    // Broadcast à tous les autres clients
    clients.forEach((client) => {
      if (client !== ws && client.readyState === WebSocket.OPEN) {
        client.send(msg);
      }
    });
  });

  ws.on("close", () => {
    clients.delete(ws);
    console.log("❌ Client déconnecté");
  });
});
