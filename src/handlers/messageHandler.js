import { logWithTimestamp } from "../utils/logger.js";
import { stateManager } from "../middlewares/stateManager.js";
import { handleAudioRecognition } from "./audioHandler.js";
import {
  handleYoutubeSearch,
  handleYoutubeDownloadAndSend,
} from "./youtubeHandler.js";

function getUserName(chat) {
  return chat.name || chat.pushname || "usuário";
}

export async function messageHandler(client, message) {
  const chat = await message.getChat();
  const chatId = chat.id._serialized;

  logWithTimestamp(`Mensagem recebida de ${chatId}`);

  if (chat.isGroup || chat.isChannel) {
    logWithTimestamp(`Mensagem ignorada (grupo/canal): ${chatId}`);
    return;
  }

  const textMessage = message.body ? message.body.trim() : "";
  const state = stateManager.get(chatId);

  // Se o usuário enviar "cancelar", reinicia o fluxo
  if (textMessage.toLowerCase() === "cancelar") {
    stateManager.reset(chatId);
    await client.sendMessage(
      chatId,
      "Operação cancelada. Para começar novamente, envie *start*.",
    );
    logWithTimestamp(`Usuário ${chatId} cancelou a operação.`);
    return;
  }

  if (textMessage) {
    state.history.push({ from: "user", text: textMessage });
    logWithTimestamp(`Texto recebido de ${chatId}: ${textMessage}`);
  }

  // Lógica principal
  if (state.step === "init") {
    if (textMessage.toLowerCase() === "start") {
      logWithTimestamp(`Usuário ${chatId} iniciou o bot.`);
      await client.sendMessage(
        chatId,
        `Olá, Como deseja encontrar a sua música?\n1 - Gravar um áudio com a música que deseja reconhecer.\n2 - Informar título e artista\n\n*Você pode digitar "cancelar" a qualquer momento para reiniciar o processo.*`,
      );
      stateManager.update(chatId, { step: "awaiting_option" });
    } else {
      await client.sendMessage(chatId, `Envie *start* para começar.`);
    }
    return;
  }

  // Esperando escolha do usuário (1 ou 2)
  if (state.step === "awaiting_option") {
    if (textMessage === "1") {
      await client.sendMessage(
        chatId,
        "Grave um áudio com a música que deseja reconhecer.",
      );
      stateManager.update(chatId, { step: "awaiting_audio" });
      return;
    } else if (textMessage === "2") {
      await client.sendMessage(
        chatId,
        "Envie o título e o artista da música (ex: Shape of You Ed Sheeran)",
      );
      stateManager.update(chatId, { step: "awaiting_title_artist" });
      return;
    } else {
      await client.sendMessage(chatId, "Escolha inválida. Envie 1 ou 2.");
      return;
    }
  }

  // Pesquisa por título e artista no YouTube
  if (state.step === "awaiting_title_artist" && textMessage) {
    await handleYoutubeSearch(client, chatId, textMessage);
    return;
  }

  // Recebe a escolha do usuário e faz o download/conversão/envio
  if (state.step === "awaiting_youtube_choice" && textMessage) {
    const choice = parseInt(textMessage);
    if (
      isNaN(choice) ||
      choice < 1 ||
      !state.youtubeResults ||
      choice > state.youtubeResults.length
    ) {
      await client.sendMessage(
        chatId,
        "Escolha inválida. Envie o número da música desejada.",
      );
      return;
    }
    await handleYoutubeDownloadAndSend(client, chatId, choice);
    return;
  }

  // Se aguardando áudio e recebeu mídia
  if (state.step === "awaiting_audio" && message.hasMedia) {
    await handleAudioRecognition(client, chatId, message);
    return;
  }

  // Se aguardando áudio mas recebeu texto
  if (state.step === "awaiting_audio" && !message.hasMedia) {
    await client.sendMessage(
      chatId,
      `Por favor, envie um áudio com a música que deseja reconhecer.`,
    );
    logWithTimestamp(`Texto recebido enquanto aguardava áudio de ${chatId}.`);
    return;
  }

  // Qualquer outro caso, reinicia
  await client.sendMessage(chatId, `Envie *start* para começar.`);
  stateManager.reset(chatId);
}
