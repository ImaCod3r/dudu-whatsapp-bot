import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

// Compatibilidade com ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import { client, qrcode } from "./src/services/whatsapp.js";
import { messageHandler } from "./src/handlers/messageHandler.js";
import { logWithTimestamp } from "./src/utils/logger.js";

// Eventos do cliente WhatsApp
client.on("qr", (qr) => {
  logWithTimestamp("QR code gerado para autenticação.");
  qrcode.generate(qr, { small: true });
});

client.on("ready", () => {
  logWithTimestamp("✅ WhatsApp Bot pronto!");
});

// Handler principal de mensagens
client.on("message", async (message) => {
  await messageHandler(client, message);
});

// Inicializa o cliente WhatsApp
client.initialize();