import pkg from "whatsapp-web.js";
const { Client, LocalAuth, MessageMedia } = pkg;
import qrcode from "qrcode-terminal";

const defaultChromePath =
    process.platform === "win32"
        ? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
        : process.platform === "darwin"
            ? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
            : "/usr/bin/google-chrome";

const client = new Client({
    authStrategy: new LocalAuth({
        dataPath: "./session",
    }),
    webVersionCache: {
        type: 'none'
    },
    puppeteer: {
        headless: true,
        executablePath: process.env.CHROME_BIN?.trim() || defaultChromePath,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--disable-gpu'
        ]
    }
});

export { client, MessageMedia, qrcode };