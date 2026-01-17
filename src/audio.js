import ffmpeg from "fluent-ffmpeg";

export async function convertToMp3(tempAudioPath, mp3Path) {
    await new Promise((resolve, reject) => {
        ffmpeg(tempAudioPath)
            .audioCodec("libmp3lame")
            .audioBitrate(192)
            .format("mp3")
            .on("end", resolve)
            .on("error", reject)
            .save(mp3Path);
    });
}

export function convertToPCM(inputPath, outputPath) {
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
