# Dudu WhatsApp Bot 🎵

Um bot de WhatsApp multifuncional desenvolvido em Node.js que permite identificar músicas (estilo Shazam) e baixar áudios diretamente do YouTube.

## 🚀 Funcionalidades

-   **Reconhecimento de Música**: Grave/encaminhe um áudio e o bot identificará a música usando a API do Shazam via RapidAPI.
-   **Download do YouTube**: Pesquise por nome de música ou artista, escolha entre os resultados e receba o áudio em MP3 diretamente no chat.
-   **Menu Interativo**: Fluxo de conversa simples e intuitivo.

## 📋 Pré-requisitos

Antes de começar, certifique-se de ter instalado em sua máquina:

-   [Node.js](https://nodejs.org/) (versão 14 ou superior)
-   [FFmpeg](https://ffmpeg.org/download.html) (Necessário para conversão de áudio)
    -   **Importante**: O FFmpeg deve estar configurado na variável de ambiente PATH do seu sistema.

## 🛠️ Instalação

1.  Clone este repositório:
    ```bash
    git clone https://github.com/seu-usuario/Dudu-whatsapp-bot.git
    cd Dudu-whatsapp-bot
    ```

2.  Instale as dependências:
    ```bash
    npm install
    ```

3.  Configure as variáveis de ambiente:
    -   Crie um arquivo `.env` na raiz do projeto.
    -   Adicione sua chave da RapidAPI (necessária para o Shazam):
        ```env
        RAPIDAPI_KEY=sua_chave_da_rapidapi_aqui
        ```
    -   Você pode obter uma chave em: [Shazam API na RapidAPI](https://rapidapi.com/apidojo/api/shazam)

## ▶️ Como Usar

1.  Inicie o bot:
    ```bash
    npm run start
    ```

2.  Um QR Code será exibido no terminal. Abra o WhatsApp no seu celular, vá em **Dispositivos Conectados** e escaneie o código.

3.  Após conectar, envie uma mensagem para o bot (ou use outro número para testar):
    -   Envie **"start"** para ver o menu principal.
    -   Escolha **1** para identificar uma música (depois envie o áudio).
    -   Escolha **2** para baixar uma música (depois digite o nome/artista).

## 📂 Estrutura do Projeto

-   `main.js`: Arquivo principal que gerencia o fluxo de mensagens e estados do usuário.
-   `src/`:
    -   `whatsapp.js`: Configuração do cliente WhatsApp.
    -   `shazam.js`: Integração com a API do Shazam.
    -   `youtube.js`: Integração com pesquisa e download do YouTube.
    -   `audio.js`: Funções de conversão de áudio usando FFmpeg.
    -   `utils.js`: Funções utilitárias (logs, gerenciamento de arquivos).

## ⚠️ Observações

-   Este projeto utiliza a biblioteca `whatsapp-web.js` que simula um navegador para conectar ao WhatsApp Web.
-   O download de vídeos do YouTube é feito via `yt-dlp`.
-   Certifique-se de respeitar os direitos autorais e as políticas de uso das plataformas envolvidas.

## 📄 Licença

Este projeto é de uso educacional.
