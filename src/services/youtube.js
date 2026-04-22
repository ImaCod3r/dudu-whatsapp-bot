import { YouTube } from "youtube-sr";
import youtubeDl from "yt-dlp-exec";
import fs from "fs";

export async function searchFromYoutube(query) {
    const results = await YouTube.search(query, { type: "video", limit: 10 });
    return results;
}

export async function downloadAudioFromYoutube(video, tempAudioPath) {
    // Baixa o melhor áudio disponível e salva no caminho temporário
    await youtubeDl(video.url, {
        output: tempAudioPath,
        format: 'bestaudio',
        noPlaylist: true,
    });
}