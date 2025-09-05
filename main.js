require("dotenv").config();
const { Client, LocalAuth, MessageMedia } = require("whatsapp-web.js");
const qrcode = require("qrcode-terminal");

const axios = require("axios");
const ffmpeg = require("fluent-ffmpeg");
const youtube = require("youtube-sr").default;
const ytdl = require("@distube/ytdl-core");

const fs = require("fs");
const path = require("path");

const client = new Client({
    authStrategy: new LocalAuth({
        dataPath: "./session",
    }),
});

const userStates = {}

// Função para converter OGG para WAV PCM mono 16kHz
function convertToPCM(inputPath, outputPath) {
    return new Promise((resolve, reject) => {
        ffmpeg(inputPath)
            .noVideo()
            .audioCodec("pcm_s16le")
            .audioChannels(1)
            .audioFrequency(44100) // precisa ser 44100 Hz
            .format("s16le")       // raw PCM
            .outputOptions(["-t 5"]) // só 5 segundos
            .on("end", () => resolve(outputPath))
            .on("error", reject)
            .save(outputPath);
    });
}

function getUserName(chat) {
    return chat.name || chat.pushname || "usuário";
}

// Função para enviar ao Shazam API (RapidAPI)
async function recogniseSong(base64Audio) {
    const options = {
        method: "POST",
        url: "https://shazam.p.rapidapi.com/songs/v2/detect",
        params: {
            timezone: "Africa/Luanda",
            locale: "pt-AO",
        },
        headers: {
            "x-rapidapi-key": process.env.RAPIDAPI_KEY,
            "x-rapidapi-host": "shazam.p.rapidapi.com",
            "Content-Type": "text/plain",
        },
        data: base64Audio,
    };

    const response = await axios.request(options);
    return response.data;
}

function logWithTimestamp(message) {
    const now = new Date().toISOString();
    console.log(`[${now}] ${message}`);
}

client.on("qr", (qr) => {
    logWithTimestamp("QR code gerado para autenticação.");
    qrcode.generate(qr, { small: true });
});

client.on("ready", () => {
    logWithTimestamp("✅ WhatsApp Bot pronto!");
});

// Cria diretório se não existir
function ensureDir(dirPath) {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath);
        logWithTimestamp(`Diretório criado: ${dirPath}`);
    }
}

// Pesquisa no YouTube e salva resultados no estado
async function handleYoutubeSearch(client, chatId, state, query) {
    await client.sendMessage(chatId, "Pesquisando...");
    const results = await youtube.search(query, { type: "video", limit: 10 });
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

// Baixa, converte e envia música do YouTube
async function handleYoutubeDownloadAndSend(client, chatId, state, choice) {
    const video = state.youtubeResults[choice - 1];
    await client.sendMessage(chatId, `Baixando "${video.title}" (Pode demorar um pouquinho 😁)...`);

    const downloadsDir = path.join(__dirname, "Downloads");
    ensureDir(downloadsDir);

    const timestamp = Date.now();
    const mp3Path = path.join(downloadsDir, `music-${timestamp}.mp3`);
    const tempAudioPath = path.join(downloadsDir, `music-${timestamp}.webm`);

    try {
        // Baixa o áudio do YouTube
        const audioStream = ytdl(video.url, { filter: "audioonly", quality: "highestaudio" });
        const writeStream = fs.createWriteStream(tempAudioPath);
        await new Promise((resolve, reject) => {
            audioStream.pipe(writeStream);
            audioStream.on("end", resolve);
            audioStream.on("error", reject);
        });

        // Converte para MP3
        await new Promise((resolve, reject) => {
            ffmpeg(tempAudioPath)
                .audioCodec("libmp3lame")
                .audioBitrate(192)
                .format("mp3")
                .on("end", resolve)
                .on("error", reject)
                .save(mp3Path);
        });

        // Envia o arquivo MP3
        const media = MessageMedia.fromFilePath(mp3Path);
        await client.sendMessage(chatId, media, { caption: `🎵 ${video.title}` });
        await client.sendMessage(chatId, "Deseja fazer outra busca? Envie *start* para começar.");
        logWithTimestamp(`Música enviada: ${video.title}`);
    } catch (err) {
        logWithTimestamp(`Erro ao baixar/converter/enviar música: ${err}`);
        await client.sendMessage(chatId, "Erro ao baixar ou converter a música.");
    } finally {
        // Limpa arquivos temporários
        [mp3Path, tempAudioPath].forEach((file) => {
            if (fs.existsSync(file)) {
                fs.unlinkSync(file);
                logWithTimestamp(`Arquivo removido: ${file}`);
            }
        });
        state.step = "init";
        state.youtubeResults = undefined;
    }
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
                const response = `🎵 Música reconhecida!\n👉 ${track.title} - ${track.subtitle}`;
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

    // NOVO: Se o usuário enviar "cancelar", reinicia o fluxo
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
            logWithTimestamp(`Usuário ${chatId} iniciou o reconhecimento.`);
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

client.initialize();