import type { OpenClawPluginApi } from "openclaw/plugin-sdk/core";

export interface CloudflareAiConfig {
  apiToken: string;
  accountId: string;
  audioModel: string;
  imageModel: string;
  ttsModel: string;
  defaultLanguage: string;
  timeout: number;
}

const cloudflareAiPlugin = {
  id: "cloudflare-ai",
  name: "Cloudflare AI",
  description: "Media understanding using Cloudflare Workers AI (Whisper, Llama Vision, Deepgram TTS)",
  register(api: OpenClawPluginApi) {
    const config = this.resolveConfig(api.pluginConfig);
    this.validateConfig(config, api);

    api.registerMediaProvider({
      id: "cloudflare-ai",
      label: "Cloudflare AI Workers",
      capabilities: ["audio", "image", "video", "tts"],
      aliases: ["cloudflare", "cf"],
      docsPath: "https://developers.cloudflare.com/workers-ai/",

      async transcribeAudio(req) {
        const apiUrl = `https://api.cloudflare.com/client/v4/accounts/${config.accountId}/ai/run/${config.audioModel}`;

        const input: Record<string, unknown> = {
          audio: req.buffer.toString("base64"),
        };
        if (req.language) {
          input.language = req.language;
        }

        const response = await (req.fetchFn ?? fetch)(apiUrl, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${req.apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(input),
          signal: AbortSignal.timeout(req.timeoutMs),
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Cloudflare API error: ${response.status} ${errorText}`);
        }

        const data = await response.json() as {
          result?: {
            text?: string;
            transcription_info?: { language?: string; duration?: number };
          };
        };

        if (!data.result?.text) {
          throw new Error("No transcription returned from Cloudflare");
        }

        return {
          text: data.result.text,
          model: req.model ?? config.audioModel,
        };
      },

      async describeImage(req) {
        const apiUrl = `https://api.cloudflare.com/client/v4/accounts/${config.accountId}/ai/run/${config.imageModel}`;

        const imageBase64 = req.buffer.toString("base64");

        const input: Record<string, unknown> = {
          messages: [
            {
              role: "user" as const,
              content: [
                { type: "text" as const, text: req.prompt || "Describe this image in detail." },
                {
                  type: "image_url" as const,
                  image_url: { url: `data:${req.mime || "image/jpeg"};base64,${imageBase64}` },
                },
              ],
            },
          ],
          max_tokens: req.maxTokens || 1024,
        };

        const headers: Record<string, string> = {
          Authorization: `Bearer ${req.apiKey}`,
          "Content-Type": "application/json",
        };
        if (req.headers) {
          Object.assign(headers, req.headers);
        }

        const response = await fetch(apiUrl, {
          method: "POST",
          headers,
          body: JSON.stringify(input),
          signal: AbortSignal.timeout(req.timeoutMs),
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Cloudflare API error: ${response.status} ${errorText}`);
        }

        const data = await response.json() as { result?: { response?: string } };

        if (!data.result?.response) {
          throw new Error("No description returned from Cloudflare");
        }

        return {
          text: data.result.response,
          model: req.model ?? config.imageModel,
        };
      },

      async describeVideo(req) {
        const apiUrl = `https://api.cloudflare.com/client/v4/accounts/${config.accountId}/ai/run/${config.imageModel}`;

        const imageBase64 = req.buffer.toString("base64");

        const input: Record<string, unknown> = {
          messages: [
            {
              role: "user" as const,
              content: [
                { type: "text" as const, text: req.prompt || "Describe this video frame in detail." },
                {
                  type: "image_url" as const,
                  image_url: { url: `data:${req.mime || "image/jpeg"};base64,${imageBase64}` },
                },
              ],
            },
          ],
        };

        const response = await (req.fetchFn ?? fetch)(apiUrl, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${req.apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(input),
          signal: AbortSignal.timeout(req.timeoutMs),
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Cloudflare API error: ${response.status} ${errorText}`);
        }

        const data = await response.json() as { result?: { response?: string } };

        if (!data.result?.response) {
          throw new Error("No description returned from Cloudflare");
        }

        return {
          text: data.result.response,
          model: req.model ?? config.imageModel,
        };
      },

      async textToSpeech(req) {
        const apiUrl = `https://api.cloudflare.com/client/v4/accounts/${config.accountId}/ai/run/${config.ttsModel}`;

        const input: Record<string, unknown> = {
          text: req.text,
        };

        if (req.voice) {
          input.speaker = req.voice;
        }

        const response = await (req.fetchFn ?? fetch)(apiUrl, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${req.apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(input),
          signal: AbortSignal.timeout(req.timeoutMs),
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Cloudflare API error: ${response.status} ${errorText}`);
        }

        const audioBuffer = await response.arrayBuffer();

        return {
          audio: Buffer.from(audioBuffer),
          mime: "audio/mp3",
          sampleRate: 24000,
        };
      },
    });

    api.registerService({
      id: "cloudflare-ai",
      start: async () => {
        api.logger.info("[cloudflare-ai] Plugin started");
      },
      stop: async () => {},
    });
  },

  resolveConfig(pluginConfig: unknown): CloudflareAiConfig {
    const raw = pluginConfig as Record<string, unknown> | undefined;
    return {
      apiToken: typeof raw?.apiToken === "string" ? raw.apiToken : process.env.CLOUDFLARE_API_TOKEN || "",
      accountId: typeof raw?.accountId === "string" ? raw.accountId : process.env.CLOUDFLARE_ACCOUNT_ID || "",
      audioModel: typeof raw?.audioModel === "string" ? raw.audioModel : "@cf/openai/whisper-large-v3-turbo",
      imageModel: typeof raw?.imageModel === "string" ? raw.imageModel : "@cf/meta/llama-3.2-11b-vision-instruct-fp8",
      ttsModel: typeof raw?.ttsModel === "string" ? raw.ttsModel : "@cf/deepgram/aura-2-en",
      defaultLanguage: typeof raw?.defaultLanguage === "string" ? raw.defaultLanguage : "",
      timeout: typeof raw?.timeout === "number" ? raw.timeout : 60000,
    };
  },

  validateConfig(config: CloudflareAiConfig, api: OpenClawPluginApi): void {
    if (!config.apiToken) {
      api.logger.warn("[cloudflare-ai] apiToken not configured");
    }
    if (!config.accountId) {
      api.logger.warn("[cloudflare-ai] accountId not configured");
    }
  },
};

export default cloudflareAiPlugin;
