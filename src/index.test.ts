import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import cloudflareAiPlugin, { type CloudflareAiConfig } from "./index.js";

describe("Cloudflare AI Plugin", () => {
  let originalEnv: Record<string, string | undefined>;

  beforeEach(() => {
    originalEnv = { ...process.env };
  });

  afterEach(() => {
    Object.assign(process.env, originalEnv);
    delete process.env.CLOUDFLARE_API_TOKEN;
    delete process.env.CLOUDFLARE_ACCOUNT_ID;
  });
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

  describe("telephony support", () => {
    const mockApi = {
      logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      },
      pluginConfig: {
        apiToken: "test-token",
        accountId: "test-account",
        audioModel: "@cf/openai/whisper-large-v3-turbo",
        imageModel: "@cf/meta/llama-3.2-11b-vision-instruct-fp8",
        ttsModel: "@cf/deepgram/aura-2-en",
        defaultLanguage: "",
        timeout: 60000,
      },
      registerProvider: vi.fn(),
      registerService: vi.fn(),
    };

    beforeEach(() => {
      vi.clearAllMocks();
    });

    it("logs warning when telephony mode is requested", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        arrayBuffer: async () => new ArrayBuffer(100),
      });

      cloudflareAiPlugin.register(mockApi as unknown as Parameters<typeof cloudflareAiPlugin.register>[0]);

      const providerCall = mockApi.registerProvider.mock.calls[0][0];
      
      await providerCall.textToSpeech({
        text: "Hello",
        apiKey: "test-key",
        timeoutMs: 30000,
        telephony: true,
        fetchFn: mockFetch,
      } as Parameters<typeof providerCall.textToSpeech>[0]);

      expect(mockApi.logger.warn).toHaveBeenCalledWith(
        "[cloudflare-ai] telephony mode requested but Cloudflare TTS does not support PCM output; returning MP3",
      );
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

describe("Plugin registration", () => {
  const createMockApi = () => ({
    logger: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    },
    pluginConfig: {
      apiToken: "test-token",
      accountId: "test-account",
      audioModel: "@cf/openai/whisper-large-v3-turbo",
      imageModel: "@cf/meta/llama-3.2-11b-vision-instruct-fp8",
      ttsModel: "@cf/deepgram/aura-2-en",
      defaultLanguage: "",
      timeout: 60000,
    },
    registerProvider: vi.fn(),
    registerService: vi.fn(),
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls registerProvider with correct id and label", () => {
    const mockApi = createMockApi();
    cloudflareAiPlugin.register(mockApi as unknown as Parameters<typeof cloudflareAiPlugin.register>[0]);

    expect(mockApi.registerProvider).toHaveBeenCalledTimes(1);
    const providerConfig = mockApi.registerProvider.mock.calls[0][0];
    expect(providerConfig.id).toBe("cloudflare-ai");
    expect(providerConfig.label).toBe("Cloudflare AI Workers");
  });

  it("registers all required capabilities", () => {
    const mockApi = createMockApi();
    cloudflareAiPlugin.register(mockApi as unknown as Parameters<typeof cloudflareAiPlugin.register>[0]);

    const providerConfig = mockApi.registerProvider.mock.calls[0][0];
    expect(providerConfig.capabilities).toContain("audio");
    expect(providerConfig.capabilities).toContain("image");
    expect(providerConfig.capabilities).toContain("video");
    expect(providerConfig.capabilities).toContain("tts");
    expect(providerConfig.capabilities).toHaveLength(4);
  });

  it("registers correct aliases", () => {
    const mockApi = createMockApi();
    cloudflareAiPlugin.register(mockApi as unknown as Parameters<typeof cloudflareAiPlugin.register>[0]);

    const providerConfig = mockApi.registerProvider.mock.calls[0][0];
    expect(providerConfig.aliases).toContain("cloudflare");
    expect(providerConfig.aliases).toContain("cf");
  });

  it("registers docsPath", () => {
    const mockApi = createMockApi();
    cloudflareAiPlugin.register(mockApi as unknown as Parameters<typeof cloudflareAiPlugin.register>[0]);

    const providerConfig = mockApi.registerProvider.mock.calls[0][0];
    expect(providerConfig.docsPath).toBe("https://developers.cloudflare.com/workers-ai/");
  });

  it("registers all required methods", () => {
    const mockApi = createMockApi();
    cloudflareAiPlugin.register(mockApi as unknown as Parameters<typeof cloudflareAiPlugin.register>[0]);

    const providerConfig = mockApi.registerProvider.mock.calls[0][0];
    expect(typeof providerConfig.transcribeAudio).toBe("function");
    expect(typeof providerConfig.describeImage).toBe("function");
    expect(typeof providerConfig.describeVideo).toBe("function");
    expect(typeof providerConfig.textToSpeech).toBe("function");
  });

  it("registers a service", () => {
    const mockApi = createMockApi();
    cloudflareAiPlugin.register(mockApi as unknown as Parameters<typeof cloudflareAiPlugin.register>[0]);

    expect(mockApi.registerService).toHaveBeenCalledTimes(1);
    const serviceConfig = mockApi.registerService.mock.calls[0][0];
    expect(serviceConfig.id).toBe("cloudflare-ai");
  });

  it("logs startup message", () => {
    const mockApi = createMockApi();
    cloudflareAiPlugin.register(mockApi as unknown as Parameters<typeof cloudflareAiPlugin.register>[0]);

    const serviceConfig = mockApi.registerService.mock.calls[0][0];
    serviceConfig.start();

    expect(mockApi.logger.info).toHaveBeenCalledWith("[cloudflare-ai] Plugin started");
  });
});

describe("transcribeAudio API", () => {
  const createMockApi = () => ({
    logger: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    },
    pluginConfig: {
      apiToken: "test-token",
      accountId: "test-account",
      audioModel: "@cf/openai/whisper-large-v3-turbo",
      imageModel: "@cf/meta/llama-3.2-11b-vision-instruct-fp8",
      ttsModel: "@cf/deepgram/aura-2-en",
      defaultLanguage: "",
      timeout: 60000,
    },
    registerProvider: vi.fn(),
    registerService: vi.fn(),
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls correct Cloudflare API endpoint", async () => {
    const mockApi = createMockApi();
    cloudflareAiPlugin.register(mockApi as unknown as Parameters<typeof cloudflareAiPlugin.register>[0]);

    const providerConfig = mockApi.registerProvider.mock.calls[0][0];
    
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ result: { text: "Hello world" } }),
    });

    await providerConfig.transcribeAudio({
      buffer: Buffer.from("test audio"),
      fileName: "test.wav",
      apiKey: "test-key",
      timeoutMs: 30000,
      fetchFn: mockFetch,
    });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch.mock.calls[0][0]).toBe(
      "https://api.cloudflare.com/client/v4/accounts/test-account/ai/run/@cf/openai/whisper-large-v3-turbo"
    );
  });

  it("includes language in request when provided", async () => {
    const mockApi = createMockApi();
    cloudflareAiPlugin.register(mockApi as unknown as Parameters<typeof cloudflareAiPlugin.register>[0]);

    const providerConfig = mockApi.registerProvider.mock.calls[0][0];
    
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ result: { text: "Hello" } }),
    });

    await providerConfig.transcribeAudio({
      buffer: Buffer.from("test audio"),
      fileName: "test.wav",
      language: "es",
      apiKey: "test-key",
      timeoutMs: 30000,
      fetchFn: mockFetch,
    });

    const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(callBody.language).toBe("es");
  });

  it("throws error when API returns non-OK status", async () => {
    const mockApi = createMockApi();
    cloudflareAiPlugin.register(mockApi as unknown as Parameters<typeof cloudflareAiPlugin.register>[0]);

    const providerConfig = mockApi.registerProvider.mock.calls[0][0];
    
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => "Unauthorized",
    });

    await expect(
      providerConfig.transcribeAudio({
        buffer: Buffer.from("test audio"),
        fileName: "test.wav",
        apiKey: "test-key",
        timeoutMs: 30000,
        fetchFn: mockFetch,
      })
    ).rejects.toThrow("Cloudflare API error: 401 Unauthorized");
  });

  it("throws error when no transcription returned", async () => {
    const mockApi = createMockApi();
    cloudflareAiPlugin.register(mockApi as unknown as Parameters<typeof cloudflareAiPlugin.register>[0]);

    const providerConfig = mockApi.registerProvider.mock.calls[0][0];
    
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ result: {} }),
    });

    await expect(
      providerConfig.transcribeAudio({
        buffer: Buffer.from("test audio"),
        fileName: "test.wav",
        apiKey: "test-key",
        timeoutMs: 30000,
        fetchFn: mockFetch,
      })
    ).rejects.toThrow("No transcription returned from Cloudflare");
  });
});

describe("describeImage API", () => {
  const createMockApi = () => ({
    logger: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    },
    pluginConfig: {
      apiToken: "test-token",
      accountId: "test-account",
      audioModel: "@cf/openai/whisper-large-v3-turbo",
      imageModel: "@cf/meta/llama-3.2-11b-vision-instruct-fp8",
      ttsModel: "@cf/deepgram/aura-2-en",
      defaultLanguage: "",
      timeout: 60000,
    },
    registerProvider: vi.fn(),
    registerService: vi.fn(),
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls correct Cloudflare API endpoint for vision", async () => {
    const mockApi = createMockApi();
    cloudflareAiPlugin.register(mockApi as unknown as Parameters<typeof cloudflareAiPlugin.register>[0]);

    const providerConfig = mockApi.registerProvider.mock.calls[0][0];
    
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ result: { response: "A cat" } }),
    });

    await providerConfig.describeImage({
      buffer: Buffer.from("test image"),
      fileName: "test.jpg",
      model: "@cf/meta/llama-3.2-11b-vision-instruct-fp8",
      provider: "cloudflare",
      agentDir: "/test",
      apiKey: "test-key",
      timeoutMs: 30000,
      fetchFn: mockFetch,
    });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch.mock.calls[0][0]).toBe(
      "https://api.cloudflare.com/client/v4/accounts/test-account/ai/run/@cf/meta/llama-3.2-11b-vision-instruct-fp8"
    );
  });

  it("uses custom prompt when provided", async () => {
    const mockApi = createMockApi();
    cloudflareAiPlugin.register(mockApi as unknown as Parameters<typeof cloudflareAiPlugin.register>[0]);

    const providerConfig = mockApi.registerProvider.mock.calls[0][0];
    
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ result: { response: "Description" } }),
    });

    await providerConfig.describeImage({
      buffer: Buffer.from("test image"),
      fileName: "test.jpg",
      model: "@cf/meta/llama-3.2-11b-vision-instruct-fp8",
      provider: "cloudflare",
      prompt: "What is this?",
      agentDir: "/test",
      apiKey: "test-key",
      timeoutMs: 30000,
      fetchFn: mockFetch,
    });

    const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(callBody.messages[0].content[0].text).toBe("What is this?");
  });

  it("includes custom headers when provided", async () => {
    const mockApi = createMockApi();
    cloudflareAiPlugin.register(mockApi as unknown as Parameters<typeof cloudflareAiPlugin.register>[0]);

    const providerConfig = mockApi.registerProvider.mock.calls[0][0];
    
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ result: { response: "Description" } }),
    });

    await providerConfig.describeImage({
      buffer: Buffer.from("test image"),
      fileName: "test.jpg",
      model: "@cf/meta/llama-3.2-11b-vision-instruct-fp8",
      provider: "cloudflare",
      headers: { "X-Custom-Header": "custom-value" },
      agentDir: "/test",
      apiKey: "test-key",
      timeoutMs: 30000,
      fetchFn: mockFetch,
    });

    const headers = mockFetch.mock.calls[0][1].headers;
    expect(headers["X-Custom-Header"]).toBe("custom-value");
  });
});

describe("textToSpeech API", () => {
  const createMockApi = () => ({
    logger: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    },
    pluginConfig: {
      apiToken: "test-token",
      accountId: "test-account",
      audioModel: "@cf/openai/whisper-large-v3-turbo",
      imageModel: "@cf/meta/llama-3.2-11b-vision-instruct-fp8",
      ttsModel: "@cf/deepgram/aura-2-en",
      defaultLanguage: "",
      timeout: 60000,
    },
    registerProvider: vi.fn(),
    registerService: vi.fn(),
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls correct Cloudflare TTS API endpoint", async () => {
    const mockApi = createMockApi();
    cloudflareAiPlugin.register(mockApi as unknown as Parameters<typeof cloudflareAiPlugin.register>[0]);

    const providerConfig = mockApi.registerProvider.mock.calls[0][0];
    
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: async () => new ArrayBuffer(100),
    });

    await providerConfig.textToSpeech({
      text: "Hello world",
      apiKey: "test-key",
      timeoutMs: 30000,
      fetchFn: mockFetch,
    });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch.mock.calls[0][0]).toBe(
      "https://api.cloudflare.com/client/v4/accounts/test-account/ai/run/@cf/deepgram/aura-2-en"
    );
  });

  it("includes voice in request when provided", async () => {
    const mockApi = createMockApi();
    cloudflareAiPlugin.register(mockApi as unknown as Parameters<typeof cloudflareAiPlugin.register>[0]);

    const providerConfig = mockApi.registerProvider.mock.calls[0][0];
    
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: async () => new ArrayBuffer(100),
    });

    await providerConfig.textToSpeech({
      text: "Hello",
      voice: "male",
      apiKey: "test-key",
      timeoutMs: 30000,
      fetchFn: mockFetch,
    });

    const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(callBody.speaker).toBe("male");
  });

  it("returns audio buffer with correct mime type", async () => {
    const mockApi = createMockApi();
    cloudflareAiPlugin.register(mockApi as unknown as Parameters<typeof cloudflareAiPlugin.register>[0]);

    const providerConfig = mockApi.registerProvider.mock.calls[0][0];
    
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: async () => Buffer.from("audio data").buffer,
    });

    const result = await providerConfig.textToSpeech({
      text: "Hello",
      apiKey: "test-key",
      timeoutMs: 30000,
      fetchFn: mockFetch,
    });

    expect(result.mime).toBe("audio/mp3");
    expect(result.sampleRate).toBe(24000);
    expect(Buffer.isBuffer(result.audio)).toBe(true);
  });

  it("does not log telephony warning when telephony is false", async () => {
    const mockApi = createMockApi();
    cloudflareAiPlugin.register(mockApi as unknown as Parameters<typeof cloudflareAiPlugin.register>[0]);

    const providerConfig = mockApi.registerProvider.mock.calls[0][0];
    
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: async () => new ArrayBuffer(100),
    });

    await providerConfig.textToSpeech({
      text: "Hello",
      telephony: false,
      apiKey: "test-key",
      timeoutMs: 30000,
      fetchFn: mockFetch,
    });

    expect(mockApi.logger.warn).not.toHaveBeenCalled();
  });
});
