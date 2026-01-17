import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

// Compatibilidade com ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import { client, MessageMedia, qrcode } from "./src/whatsapp.js";
import { recogniseSong } from "./src/shazam.js";
import { convertToPCM, convertToMp3 } from "./src/audio.js";
import { searchFromYoutube, downloadAudioFromYoutube } from "./src/youtube.js";
import { ensureDir, createPath, clearTempFiles, logWithTimestamp } from "./src/utils.js";

// Estado dos usuários
const userStates = {};

// Função para obter nome do usuário
function getUserName(chat) {
    return chat.name || chat.pushname || "usuário";
}

// Eventos do cliente WhatsApp
client.on("qr", (qr) => {
    logWithTimestamp("QR code gerado para autenticação.");
    qrcode.generate(qr, { small: true });
});

client.on("ready", () => {
    logWithTimestamp("✅ WhatsApp Bot pronto!");
});

// Pesquisa no YouTube e salva resultados no estado
async function handleYoutubeSearch(client, chatId, state, query) {
    await client.sendMessage(chatId, "Pesquisando...");

    const results = await searchFromYoutube(query);

    if (results.length === 0) {
        await client.sendMessage(chatId, "Nenhum resultado encontrado.");
        state.step = "init";
    } else {
        let reply = "Resultados encontrados:\n";
        results.forEach((video, idx) => {
            reply += `[${idx + 1}] - ${video.title}\n`;
        });
        await client.sendMessage(chatId, reply.trim());
        state.youtubeResults = results;
        state.step = "awaiting_youtube_choice";
    }
}

// Faz download e envia áudio do YouTube
async function handleYoutubeDownloadAndSend(client, chatId, state, choice) {
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

        await client.sendMessage(chatId, "Deseja fazer outra busca? Envie *start* para começar.");
    } catch (error) {
        logWithTimestamp(`Erro no download/conversão: ${error}`);
        await client.sendMessage(chatId, "⚠️ Ocorreu um erro ao processar o áudio.");
    } finally {
        clearTempFiles(mp3Path, tempAudioPath);
    }

    state.step = "init";
    state.youtubeResults = undefined;
}

// Lida com reconhecimento de áudio enviado pelo usuário
async function handleAudioRecognition(client, chatId, message, state) {
    const media = await message.downloadMedia();
    if (media.mimetype.startsWith("audio")) {
        logWithTimestamp(`Áudio recebido de ${chatId}.`);
        const audiosDir = path.join(__dirname, 'audios');
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
                const response = `🎵 Música reconhecida!\\n👉 ${track.title} - ${track.subtitle}`;
                const covertArt = track.images ? track.images.coverart : null;

                if (covertArt) {
                    const media = await MessageMedia.fromUrl(covertArt);
                    await client.sendMessage(chatId, media, { caption: response });
                    await client.sendMessage(chatId, "Deseja fazer outra busca? Envie *start* para começar.");
                } else {
                    await client.sendMessage(chatId, response);
                }
                logWithTimestamp(`Música reconhecida: ${track.title} - ${track.subtitle}`);
            } else {
                await client.sendMessage(chatId, "❌ Não consegui reconhecer essa música 😔");
                logWithTimestamp(`Falha ao reconhecer música para ${chatId}`);
            }
        } catch (error) {
            logWithTimestamp(`Erro no reconhecimento para ${chatId}: ${error}`);
            await client.sendMessage(chatId, "⚠️ Ocorreu um erro ao tentar reconhecer o áudio.");
        } finally {
            [oggPath, wavPath].forEach((file) => {
                if (fs.existsSync(file)) {
                    fs.unlinkSync(file);
                    logWithTimestamp(`Arquivo removido: ${file}`);
                }
            });
        }
        state.step = "init";
    } else {
        await client.sendMessage(chatId, "Por favor, envie um áudio válido.");
        logWithTimestamp(`Mídia inválida recebida de ${chatId}.`);
    }
}

// Handler principal de mensagens
client.on("message", async (message) => {
    const chat = await message.getChat();
    const chatId = chat.id._serialized;

    logWithTimestamp(`Mensagem recebida de ${chatId}`);

    if (chat.isGroup || chat.isChannel) {
        logWithTimestamp(`Mensagem ignorada (grupo/canal): ${chatId}`);
        return;
    }

    const textMessage = message.body ? message.body.trim() : "";
    const userName = getUserName(chat);

    if (!userStates[chatId]) {
        userStates[chatId] = { step: "init", history: [] };
        logWithTimestamp(`Novo usuário iniciado: ${chatId}`);
    }

    const state = userStates[chatId];

    // Se o usuário enviar "cancelar", reinicia o fluxo
    if (textMessage.toLowerCase() === "cancelar") {
        state.step = "init";
        state.youtubeResults = undefined;
        await client.sendMessage(chatId, "Operação cancelada. Para começar novamente, envie *start*.");
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
                `Olá, Como deseja encontrar a sua música?\n1 - Gravar um áudio com a música que deseja reconhecer.\n2 - Informar título e artista\n\n*Você pode digitar "cancelar" a qualquer momento para reiniciar o processo.*`
            );
            state.step = "awaiting_option";
        } else {
            await client.sendMessage(chatId, `Envie *start* para começar.`);
        }
        return;
    }

    // Esperando escolha do usuário (1 ou 2)
    if (state.step === "awaiting_option") {
        if (textMessage === "1") {
            await client.sendMessage(chatId, "Grave um áudio com a música que deseja reconhecer.");
            state.step = "awaiting_audio";
            return;
        } else if (textMessage === "2") {
            await client.sendMessage(chatId, "Envie o título e o artista da música (ex: Shape of You Ed Sheeran)");
            state.step = "awaiting_title_artist";
            return;
        } else {
            await client.sendMessage(chatId, "Escolha inválida. Envie 1 ou 2.");
            return;
        }
    }

    // Pesquisa por título e artista no YouTube
    if (state.step === "awaiting_title_artist" && textMessage) {
        try {
            await handleYoutubeSearch(client, chatId, state, textMessage);
        } catch (err) {
            logWithTimestamp(`Erro na pesquisa do YouTube: ${err}`);
            await client.sendMessage(chatId, "Erro ao pesquisar no YouTube.");
            state.step = "init";
        }
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
            await client.sendMessage(chatId, "Escolha inválida. Envie o número da música desejada.");
            return;
        }
        await handleYoutubeDownloadAndSend(client, chatId, state, choice);
        return;
    }

    // Se aguardando áudio e recebeu mídia
    if (state.step === "awaiting_audio" && message.hasMedia) {
        await handleAudioRecognition(client, chatId, message, state);
        return;
    }

    // Se aguardando áudio mas recebeu texto
    if (state.step === "awaiting_audio" && !message.hasMedia) {
        await client.sendMessage(chatId, `Por favor, envie um áudio com a música que deseja reconhecer.`);
        logWithTimestamp(`Texto recebido enquanto aguardava áudio de ${chatId}.`);
        return;
    }

    // Qualquer outro caso, reinicia
    await client.sendMessage(chatId, `Envie *start* para começar.`);
    state.step = "init";
});

// Inicializa o cliente WhatsApp
client.initialize();