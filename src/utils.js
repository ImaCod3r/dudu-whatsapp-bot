import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

// Compatibilidade com ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function ensureDir(dirPath) {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath);
    }
}

function createPath() {
    const downloadsDir = path.join(__dirname, "../Downloads");
    ensureDir(downloadsDir);

    const timestamp = Date.now();
    const mp3Path = path.join(downloadsDir, `music-${timestamp}.mp3`);
    const tempAudioPath = path.join(downloadsDir, `music-${timestamp}.webm`);

    return { mp3Path, tempAudioPath }
}

function clearTempFiles(mp3Path, tempAudioPath) {
    [mp3Path, tempAudioPath].forEach((file) => {
        if (fs.existsSync(file)) {
            fs.unlinkSync(file);
            logWithTimestamp(`Arquivo removido: ${file}`);
        }
    });
}

function logWithTimestamp(message) {
    const now = new Date().toISOString();
    console.log(`[${now}] ${message}`);
}

export { ensureDir, createPath, clearTempFiles, logWithTimestamp };