import { Type } from "@sinclair/typebox";
import type { OpenClawPluginApi } from "openclaw/plugin-sdk/core";

export interface CloudflareAiConfig {
  apiToken: string;
  accountId: string;
  defaultModel: string;
  defaultLanguage: string;
  timeout: number;
}

const CloudflareAiToolSchema = Type.Union([
  Type.Object({
    action: Type.Literal("transcribe"),
    audioUrl: Type.Optional(Type.String({ description: "URL to audio file" })),
    audioPath: Type.Optional(Type.String({ description: "Local path to audio file" })),
    model: Type.Optional(Type.String({ description: "Whisper model to use" })),
    language: Type.Optional(Type.String({ description: "Language code (e.g., en, es)" })),
  }),
  Type.Object({
    action: Type.Literal("status"),
  }),
]);

const cloudflareAiPlugin = {
  id: "cloudflare-ai",
  name: "Cloudflare AI",
  description: "Audio transcription using Cloudflare Workers AI Whisper models",
  register(api: OpenClawPluginApi) {
    const config = this.resolveConfig(api.pluginConfig);
    this.validateConfig(config, api);

    let runtimePromise: Promise<CloudflareAiRuntime> | null = null;
    let runtime: CloudflareAiRuntime | null = null;

    const ensureRuntime = async () => {
      if (!config) {
        throw new Error("Cloudflare AI plugin not configured");
      }
      if (runtime) {
        return runtime;
      }
      if (!runtimePromise) {
        runtimePromise = createCloudflareAiRuntime(config, api.logger);
      }
      try {
        runtime = await runtimePromise;
      } catch (err) {
        runtimePromise = null;
        throw err;
      }
      return runtime;
    };

    api.registerTool({
      name: "cloudflare_ai",
      label: "Cloudflare AI",
      description: "Transcribe audio files using Cloudflare Workers AI Whisper models",
      parameters: CloudflareAiToolSchema,
      async execute(_toolCallId, params) {
        const json = (payload: unknown) => ({
          content: [{ type: "text" as const, text: JSON.stringify(payload, null, 2) }],
          details: payload,
        });

        try {
          const rt = await ensureRuntime();

          if (params?.action === "status") {
            return json({
              configured: true,
              accountId: rt.config.accountId,
              defaultModel: rt.config.defaultModel,
            });
          }

          if (params?.action === "transcribe") {
            const audioUrl = typeof params.audioUrl === "string" ? params.audioUrl : undefined;
            const audioPath = typeof params.audioPath === "string" ? params.audioPath : undefined;
            const model = typeof params.model === "string" ? params.model : undefined;
            const language = typeof params.language === "string" ? params.language : undefined;

            if (!audioUrl && !audioPath) {
              throw new Error("audioUrl or audioPath required");
            }

            const result = await rt.transcribe({
              audioUrl,
              audioPath,
              model: model || rt.config.defaultModel,
              language: language || rt.config.defaultLanguage || undefined,
            });

            return json(result);
          }

          throw new Error("Unknown action");
        } catch (err) {
          return json({
            error: err instanceof Error ? err.message : String(err),
          });
        }
      },
    });

    api.registerGatewayMethod(
      "cloudflare-ai.transcribe",
      async ({ params, respond }) => {
        try {
          const rt = await ensureRuntime();
          const audioUrl = typeof params?.audioUrl === "string" ? params.audioUrl : undefined;
          const audioPath = typeof params?.audioPath === "string" ? params.audioPath : undefined;

          if (!audioUrl && !audioPath) {
            respond(false, { error: "audioUrl or audioPath required" });
            return;
          }

          const result = await rt.transcribe({
            audioUrl,
            audioPath,
            model: typeof params?.model === "string" ? params.model : rt.config.defaultModel,
            language: typeof params?.language === "string" ? params.language : rt.config.defaultLanguage || undefined,
          });

          respond(true, result);
        } catch (err) {
          respond(false, { error: err instanceof Error ? err.message : String(err) });
        }
      },
    );

    api.registerGatewayMethod(
      "cloudflare-ai.status",
      async ({ respond }) => {
        try {
          const rt = await ensureRuntime();
          respond(true, {
            configured: true,
            accountId: rt.config.accountId,
            defaultModel: rt.config.defaultModel,
          });
        } catch (err) {
          respond(false, { error: err instanceof Error ? err.message : String(err) });
        }
      },
    );

    api.registerCli(
      ({ program }) => {
        program
          .command("cloudflare")
          .description("Cloudflare AI plugin commands")
          .action(() => {
            program.help();
          });

        program
          .command("cloudflare transcribe")
          .description("Transcribe an audio file")
          .option("-u, --url <url>", "URL to audio file")
          .option("-p, --path <path>", "Local path to audio file")
          .option("-m, --model <model>", "Whisper model to use")
          .option("-l, --language <language>", "Language code")
          .action(async (opts) => {
            const rt = await ensureRuntime();
            const result = await rt.transcribe({
              audioUrl: opts.url,
              audioPath: opts.path,
              model: opts.model || rt.config.defaultModel,
              language: opts.language || rt.config.defaultLanguage || undefined,
            });
            console.log(JSON.stringify(result, null, 2));
          });

        program
          .command("cloudflare status")
          .description("Show plugin status")
          .action(async () => {
            const rt = await ensureRuntime();
            console.log(JSON.stringify({
              configured: true,
              accountId: rt.config.accountId,
              defaultModel: rt.config.defaultModel,
            }, null, 2));
          });
      },
      { commands: ["cloudflare"] },
    );

    api.registerService({
      id: "cloudflare-ai",
      start: async () => {
        api.logger.info("[cloudflare-ai] Plugin started");
      },
      stop: async () => {
        runtimePromise = null;
        runtime = null;
      },
    });
  },

  resolveConfig(pluginConfig: unknown): CloudflareAiConfig {
    const raw = pluginConfig as Record<string, unknown> | undefined;
    return {
      apiToken: typeof raw?.apiToken === "string" ? raw.apiToken : "",
      accountId: typeof raw?.accountId === "string" ? raw.accountId : "",
      defaultModel: typeof raw?.defaultModel === "string" ? raw.defaultModel : "@cf/openai/whisper-large-v3-turbo",
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

interface TranscribeOptions {
  audioUrl?: string;
  audioPath?: string;
  model: string;
  language?: string;
}

interface TranscribeResult {
  text: string;
  model: string;
  language?: string;
}

interface CloudflareAiRuntime {
  config: CloudflareAiConfig;
  transcribe(options: TranscribeOptions): Promise<TranscribeResult>;
}

async function createCloudflareAiRuntime(
  config: CloudflareAiConfig,
  logger: OpenClawPluginApi["logger"],
): Promise<CloudflareAiRuntime> {
  return {
    config,
    async transcribe(options: TranscribeOptions): Promise<TranscribeResult> {
      let audioBuffer: ArrayBuffer;

      if (options.audioUrl) {
        logger.info(`[cloudflare-ai] Fetching audio from ${options.audioUrl}`);
        const response = await fetch(options.audioUrl, {
          signal: AbortSignal.timeout(config.timeout),
        });
        if (!response.ok) {
          throw new Error(`Failed to fetch audio: ${response.status} ${response.statusText}`);
        }
        audioBuffer = await response.arrayBuffer();
      } else if (options.audioPath) {
        logger.info(`[cloudflare-ai] Reading audio from ${options.audioPath}`);
        const fs = await import("node:fs/promises");
        audioBuffer = await fs.readFile(options.audioPath).then((b) => b.buffer);
      } else {
        throw new Error("No audio source provided");
      }

      const audioBase64 = Buffer.from(audioBuffer).toString("base64");

      const input: Record<string, unknown> = {
        audio: audioBase64,
      };
      if (options.language) {
        input.language = options.language;
      }

      const url = `https://api.cloudflare.com/client/v4/accounts/${config.accountId}/ai/run/${options.model}`;
      logger.info(`[cloudflare-ai] Calling Cloudflare AI: ${options.model}`);

      const response = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.apiToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(input),
        signal: AbortSignal.timeout(config.timeout),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Cloudflare API error: ${response.status} ${errorText}`);
      }

      const data = await response.json() as { result?: { text?: string } };
      
      if (!data.result?.text) {
        throw new Error("No transcription returned from Cloudflare");
      }

      return {
        text: data.result.text,
        model: options.model,
        language: options.language,
      };
    },
  };
}

export default cloudflareAiPlugin;
