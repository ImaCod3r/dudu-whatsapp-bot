import { MessageMedia } from "../services/whatsapp.js";
import {
  searchFromYoutube,
  downloadAudioFromYoutube,
} from "../services/youtube.js";
import { convertToMp3 } from "../utils/audioConverter.js";
import {
  createPath,
  clearTempFiles,
  logWithTimestamp,
} from "../utils/logger.js";
import { stateManager } from "../middlewares/stateManager.js";

export async function handleYoutubeSearch(client, chatId, query) {
  await client.sendMessage(chatId, "Pesquisando...");

  try {
    const results = await searchFromYoutube(query);

    if (results.length === 0) {
      await client.sendMessage(chatId, "Nenhum resultado encontrado.");
      stateManager.update(chatId, { step: "init" });
    } else {
      let reply = "Resultados encontrados:\n";
      results.forEach((video, idx) => {
        reply += `[${idx + 1}] - ${video.title}\n`;
      });
      await client.sendMessage(chatId, reply.trim());
      stateManager.update(chatId, {
        youtubeResults: results,
        step: "awaiting_youtube_choice",
      });
    }
  } catch (err) {
    logWithTimestamp(`Erro na pesquisa do YouTube: ${err}`);
    await client.sendMessage(chatId, "Erro ao pesquisar no YouTube.");
    stateManager.update(chatId, { step: "init" });
  }
}

export async function handleYoutubeDownloadAndSend(client, chatId, choice) {
  const state = stateManager.get(chatId);
  const video = state.youtubeResults[choice - 1];

  await client.sendMessage(chatId, `Baixando "${video.title}"...`);
  logWithTimestamp(`Iniciando download: ${video.title}`);

  const { mp3Path, tempAudioPath } = createPath();

  try {
    await downloadAudioFromYoutube(video, tempAudioPath);
    logWithTimestamp(`Download concluído: ${tempAudioPath}`);

    await convertToMp3(tempAudioPath, mp3Path);
    logWithTimestamp(`Áudio convertido para MP3: ${mp3Path}`);

    const media = MessageMedia.fromFilePath(mp3Path);
    await client.sendMessage(chatId, media, { caption: `🎵 ${video.title}` });
    logWithTimestamp(`Áudio enviado para ${chatId}`);

    await client.sendMessage(
      chatId,
      "Deseja fazer outra busca? Envie *start* para começar.",
    );
  } catch (error) {
    logWithTimestamp(`Erro no download/conversão: ${error}`);
    await client.sendMessage(
      chatId,
      "⚠️ Ocorreu um erro ao processar o áudio.",
    );
  } finally {
    clearTempFiles(mp3Path, tempAudioPath);
  }

  stateManager.update(chatId, { step: "init", youtubeResults: undefined });
}
