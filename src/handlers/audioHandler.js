import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { MessageMedia } from "../services/whatsapp.js";
import { recogniseSong } from "../services/shazam.js";
import { convertToPCM } from "../utils/audioConverter.js";
import { ensureDir, logWithTimestamp } from "../utils/logger.js";
import { stateManager } from "../middlewares/stateManager.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function handleAudioRecognition(client, chatId, message) {
  const state = stateManager.get(chatId);
  const media = await message.downloadMedia();

  if (media.mimetype.startsWith("audio")) {
    logWithTimestamp(`Áudio recebido de ${chatId}.`);
    const audiosDir = path.join(__dirname, "../../audios");
    ensureDir(audiosDir);

    const timestamp = Date.now();
    const oggPath = path.join(audiosDir, `audio-${timestamp}.ogg`);
    const wavPath = path.join(audiosDir, `audio-${timestamp}.wav`);

    fs.writeFileSync(oggPath, media.data, "base64");
    logWithTimestamp(`Áudio salvo em ${oggPath}`);

    try {
      await convertToPCM(oggPath, wavPath);
      logWithTimestamp(`Áudio convertido para PCM: ${wavPath}`);

      const audioBuffer = fs.readFileSync(wavPath);
      const base64Audio = audioBuffer.toString("base64");

      logWithTimestamp(`Enviando áudio para reconhecimento (Shazam API)...`);
      const result = await recogniseSong(base64Audio);

      const track = result.track;
      if (track) {
        const response = `🎵 Música reconhecida!\n👉 ${track.title} - ${track.subtitle}`;
        const coverArt = track.images ? track.images.coverart : null;

        if (coverArt) {
          const media = await MessageMedia.fromUrl(coverArt);
          await client.sendMessage(chatId, media, { caption: response });
        } else {
          await client.sendMessage(chatId, response);
        }
        await client.sendMessage(
          chatId,
          "Deseja fazer outra busca? Envie *start* para começar.",
        );
        logWithTimestamp(
          `Música reconhecida: ${track.title} - ${track.subtitle}`,
        );
      } else {
        await client.sendMessage(
          chatId,
          "❌ Não consegui reconhecer essa música 😔",
        );
        logWithTimestamp(`Falha ao reconhecer música para ${chatId}`);
      }
    } catch (error) {
      logWithTimestamp(`Erro no reconhecimento para ${chatId}: ${error}`);
      await client.sendMessage(
        chatId,
        "⚠️ Ocorreu um erro ao tentar reconhecer o áudio.",
      );
    } finally {
      [oggPath, wavPath].forEach((file) => {
        if (fs.existsSync(file)) {
          fs.unlinkSync(file);
          logWithTimestamp(`Arquivo removido: ${file}`);
        }
      });
    }
    stateManager.update(chatId, { step: "init" });
  } else {
    await client.sendMessage(chatId, "Por favor, envie um áudio válido.");
    logWithTimestamp(`Mídia inválida recebida de ${chatId}.`);
  }
}
