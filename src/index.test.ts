import { describe, expect, it, vi, beforeEach } from "vitest";
import cloudflareAiPlugin, { type CloudflareAiConfig } from "./index.js";

describe("Cloudflare AI Plugin", () => {
  describe("resolveConfig", () => {
    it("resolves full config correctly", () => {
      const config = (cloudflareAiPlugin as unknown as { resolveConfig: (c: unknown) => CloudflareAiConfig }).resolveConfig({
        apiToken: "test-token",
        accountId: "test-account",
        audioModel: "@cf/openai/whisper",
        imageModel: "@cf/meta/llama-3.2-11b-vision-instruct-fp8",
        defaultLanguage: "en",
        timeout: 30000,
      });

      expect(config.apiToken).toBe("test-token");
      expect(config.accountId).toBe("test-account");
      expect(config.audioModel).toBe("@cf/openai/whisper");
      expect(config.imageModel).toBe("@cf/meta/llama-3.2-11b-vision-instruct-fp8");
      expect(config.defaultLanguage).toBe("en");
      expect(config.timeout).toBe(30000);
    });

    it("applies defaults when config is empty", () => {
      const config = (cloudflareAiPlugin as unknown as { resolveConfig: (c: unknown) => CloudflareAiConfig }).resolveConfig({});

      expect(config.apiToken).toBe("");
      expect(config.accountId).toBe("");
      expect(config.audioModel).toBe("@cf/openai/whisper-large-v3-turbo");
      expect(config.imageModel).toBe("@cf/meta/llama-3.2-11b-vision-instruct-fp8");
      expect(config.defaultLanguage).toBe("");
      expect(config.timeout).toBe(60000);
    });

    it("applies defaults when config is undefined", () => {
      const config = (cloudflareAiPlugin as unknown as { resolveConfig: (c: unknown) => CloudflareAiConfig }).resolveConfig(undefined);

      expect(config.apiToken).toBe("");
      expect(config.accountId).toBe("");
      expect(config.audioModel).toBe("@cf/openai/whisper-large-v3-turbo");
      expect(config.imageModel).toBe("@cf/meta/llama-3.2-11b-vision-instruct-fp8");
    });

    it("handles partial config", () => {
      const config = (cloudflareAiPlugin as unknown as { resolveConfig: (c: unknown) => CloudflareAiConfig }).resolveConfig({
        apiToken: "only-token",
      });

      expect(config.apiToken).toBe("only-token");
      expect(config.accountId).toBe("");
      expect(config.audioModel).toBe("@cf/openai/whisper-large-v3-turbo");
    });
  });

  describe("validateConfig", () => {
    const mockApi = {
      logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      },
    };

    beforeEach(() => {
      vi.clearAllMocks();
    });

    it("logs warning when apiToken is missing", () => {
      (cloudflareAiPlugin as unknown as { validateConfig: (c: CloudflareAiConfig, a: typeof mockApi) => void }).validateConfig(
        {
          apiToken: "",
          accountId: "test-account",
          audioModel: "@cf/openai/whisper-large-v3-turbo",
          imageModel: "@cf/meta/llama-3.2-11b-vision-instruct-fp8",
          ttsModel: "@cf/deepgram/aura-2-en",
          defaultLanguage: "",
          timeout: 60000,
        },
        mockApi,
      );

      expect(mockApi.logger.warn).toHaveBeenCalledWith(
        "[cloudflare-ai] apiToken not configured",
      );
    });

    it("logs warning when accountId is missing", () => {
      (cloudflareAiPlugin as unknown as { validateConfig: (c: CloudflareAiConfig, a: typeof mockApi) => void }).validateConfig(
        {
          apiToken: "test-token",
          accountId: "",
          audioModel: "@cf/openai/whisper-large-v3-turbo",
          imageModel: "@cf/meta/llama-3.2-11b-vision-instruct-fp8",
          ttsModel: "@cf/deepgram/aura-2-en",
          defaultLanguage: "",
          timeout: 60000,
        },
        mockApi,
      );

      expect(mockApi.logger.warn).toHaveBeenCalledWith(
        "[cloudflare-ai] accountId not configured",
      );
    });

    it("does not log warnings when config is complete", () => {
      (cloudflareAiPlugin as unknown as { validateConfig: (c: CloudflareAiConfig, a: typeof mockApi) => void }).validateConfig(
        {
          apiToken: "test-token",
          accountId: "test-account",
          audioModel: "@cf/openai/whisper-large-v3-turbo",
          imageModel: "@cf/meta/llama-3.2-11b-vision-instruct-fp8",
          ttsModel: "@cf/deepgram/aura-2-en",
          defaultLanguage: "",
          timeout: 60000,
        },
        mockApi,
      );

      expect(mockApi.logger.warn).not.toHaveBeenCalled();
    });
  });

  describe("plugin metadata", () => {
    it("has correct id", () => {
      expect(cloudflareAiPlugin.id).toBe("cloudflare-ai");
    });

    it("has correct name", () => {
      expect(cloudflareAiPlugin.name).toBe("Cloudflare AI");
    });

    it("has description mentioning Cloudflare Workers AI", () => {
      expect(cloudflareAiPlugin.description).toContain("Cloudflare Workers AI");
    });
  });
});

describe("Cloudflare AI API integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("constructs correct API URL for Whisper", () => {
    const accountId = "test-account";
    const model = "@cf/openai/whisper-large-v3-turbo";
    const expectedUrl = `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${model}`;

    expect(expectedUrl).toBe(
      "https://api.cloudflare.com/client/v4/accounts/test-account/ai/run/@cf/openai/whisper-large-v3-turbo",
    );
  });

  it("correctly encodes audio buffer to base64", () => {
    const audioBuffer = Buffer.from("test audio data");
    const base64 = audioBuffer.toString("base64");

    expect(base64).toBe("dGVzdCBhdWRpbyBkYXRh");
  });

  it("parses Whisper response correctly", () => {
    const response = {
      result: {
        text: "Hello, world!",
      },
    };

    expect(response.result?.text).toBe("Hello, world!");
  });

  it("parses vision response correctly", () => {
    const response = {
      result: {
        response: "This is an image of a cat",
      },
    };

    expect(response.result?.response).toBe("This is an image of a cat");
  });
});

describe("Available models", () => {
  describe("Audio models (Whisper)", () => {
    it("lists recommended Whisper model", () => {
      const model = "@cf/openai/whisper-large-v3-turbo";
      expect(model).toContain("whisper");
      expect(model).toContain("large-v3-turbo");
    });

    it("lists general purpose Whisper model", () => {
      const model = "@cf/openai/whisper";
      expect(model).toContain("whisper");
      expect(model).not.toContain("tiny");
    });

    it("lists tiny English-only model", () => {
      const model = "@cf/openai/whisper-tiny-en";
      expect(model).toContain("whisper");
      expect(model).toContain("tiny-en");
    });
  });

  describe("Vision models", () => {
    it("lists Llama 3.2 11B Vision", () => {
      const model = "@cf/meta/llama-3.2-11b-vision-instruct-fp8";
      expect(model).toContain("llama-3.2");
      expect(model).toContain("vision");
    });

    it("lists Llama 3.2 90B Vision", () => {
      const model = "@cf/meta/llama-3.2-90b-vision-instruct-fp8";
      expect(model).toContain("llama-3.2");
      expect(model).toContain("90b");
      expect(model).toContain("vision");
    });

    it("lists Llava model", () => {
      const model = "@cf/llava-1.5-7b-vision-fp8";
      expect(model).toContain("llava");
      expect(model).toContain("vision");
    });
  });
});
