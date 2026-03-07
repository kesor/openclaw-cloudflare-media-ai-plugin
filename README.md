# @openclaw/cloudflare-ai

OpenClaw plugin for **Cloudflare Workers AI** - provides audio transcription capabilities using Whisper models.

## Features

- **Audio Transcription**: Transcribe audio files using Cloudflare Workers AI Whisper models
- **Multiple Models**: Support for various Whisper models:
  - `@cf/openai/whisper` - General-purpose Whisper
  - `@cf/openai/whisper-large-v3-turbo` - Faster large model
  - `@cf/openai/whisper-tiny-en` - English-only tiny model
- **Agent Tools**: Exposes a `cloudflare_ai` tool for OpenClaw agents
- **Configurable**: Adjust model, language, and other parameters

## Requirements

- OpenClaw gateway running
- Cloudflare account with Workers AI enabled
- Cloudflare API token with AI read permissions

## Install (local development)

### Option A: Install via OpenClaw CLI (recommended)

```bash
openclaw plugins install @openclaw/cloudflare-ai
```

Restart the Gateway afterwards.

### Option B: Link for development

```bash
mkdir -p ~/.openclaw/extensions
cp -R /path/to/openclaw-plugin-cloudflare ~/.openclaw/extensions/cloudflare-ai
cd ~/.openclaw/extensions/cloudflare-ai && pnpm install
```

Then configure and restart the Gateway.

## Configuration

Add to your OpenClaw config under `plugins.entries.cloudflare-ai.config`:

```json5
{
  "apiToken": "your_cloudflare_api_token",
  "accountId": "your_cloudflare_account_id",
  "defaultModel": "@cf/openai/whisper-large-v3-turbo",
  "defaultLanguage": "en",
  "timeout": 60000
}
```

### Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `apiToken` | string | (required) | Cloudflare API token with AI read permissions |
| `accountId` | string | (required) | Cloudflare account ID |
| `defaultModel` | string | `@cf/openai/whisper-large-v3-turbo` | Default Whisper model to use |
| `defaultLanguage` | string | `""` (auto-detect) | Language code (e.g., "en", "es") |
| `timeout` | number | `60000` | Request timeout in milliseconds |

### Available Whisper Models

| Model ID | Description | Pricing |
|----------|-------------|---------|
| `@cf/openai/whisper` | General-purpose Whisper | $0.00045/min |
| `@cf/openai/whisper-large-v3-turbo` | Faster large model | $0.00051/min |
| `@cf/openai/whisper-tiny-en` | English-only tiny | Free |

## Usage

### Agent Tool

The plugin exposes a `cloudflare_ai` tool that agents can use:

```typescript
// Tool: cloudflare_ai
// Parameters:
{
  action: "transcribe",      // Action to perform
  audioUrl: "https://example.com/audio.mp3",  // URL to audio file
  // OR
  audioPath: "/path/to/audio.wav",  // Local file path
  model: "@cf/openai/whisper-large-v3-turbo",  // Optional: override default model
  language: "en",  // Optional: override default language
}
```

Example agent prompt usage:
```
Please transcribe the audio file at https://example.com/meeting.mp3 using the cloudflare_ai tool.
```

### CLI Commands

```bash
# Test transcription
openclaw cloudflare transcribe --url "https://example.com/audio.mp3"

# Transcribe with specific model
openclaw cloudflare transcribe --url "https://example.com/audio.mp3" --model "@cf/openai/whisper"

# Check plugin status
openclaw cloudflare status
```

### Gateway RPC

```typescript
// Call from external code via Gateway RPC
const result = await gateway.rpc.cloudflareAi.transcribe({
  audioUrl: "https://example.com/audio.mp3",
  model: "@cf/openai/whisper-large-v3-turbo"
});
```

## How It Differs from Built-in Providers (Deepgram, etc.)

OpenClaw has built-in audio transcription providers (Deepgram, OpenAI, etc.) configured via `tools.media.audio.models`. These work automatically when media is attached to messages.

This plugin works differently:

| Aspect | Built-in Providers (Deepgram) | This Plugin |
|--------|------------------------------|-------------|
| Configuration | `tools.media.audio.models` | `plugins.entries.cloudflare-ai.config` |
| Trigger | Auto on media attachments | Explicit tool call |
| Provider | Hardcoded in core | Cloudflare Workers AI |
| Use case | Automatic transcription | Explicit transcription tasks |

### Using Both Together

You can use both:
1. **Built-in** for automatic transcription when agents receive audio
2. **This plugin** for explicit transcription tasks in skills/agents

Example skill usage:
```markdown
Use the cloudflare_ai tool to transcribe audio files when explicitly asked.
```

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    OpenClaw Gateway                     │
├─────────────────────────────────────────────────────────┤
│  cloudflare-ai plugin                                   │
│  ┌─────────────────────────────────────────────────┐   │
│  │  Tool: cloudflare_ai                            │   │
│  │  ┌───────────────────────────────────────────┐  │   │
│  │  │  Audio Handler                             │  │   │
│  │  │  - Fetch audio from URL or local path     │  │   │
│  │  │  - Convert to base64                       │  │   │
│  │  └───────────────────────────────────────────┘  │   │
│  │  ┌───────────────────────────────────────────┐  │   │
│  │  │  Cloudflare API Client                    │  │   │
│  │  │  - API token authentication               │  │   │
│  │  │  - Account ID routing                    │  │   │
│  │  │  - Model selection                        │  │   │
│  │  └───────────────────────────────────────────┘  │   │
│  └─────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
                         │
                         ▼
              ┌─────────────────────────┐
              │  Cloudflare Workers AI   │
              │  @cf/openai/whisper-*   │
              └─────────────────────────┘
```

### Key Components

1. **Plugin Registration**: Registers `cloudflare_ai` tool and CLI commands
2. **Audio Handler**: Fetches audio from URL or local file, converts to required format
3. **API Client**: Handles Cloudflare API authentication and requests
4. **Response Parser**: Extracts transcription text from Cloudflare response

### Alternative: Using Core's STT Runtime

Plugins can also use `api.runtime.stt.transcribeAudioFile()` which uses the built-in `tools.media.audio` configuration (Deepgram, OpenAI, etc.). This is useful for plugins that want to use the same transcription as the core media understanding system.

## Development

### Prerequisites

- Node.js 22+
- pnpm

### Setup

```bash
cd openclaw-plugin-cloudflare
pnpm install
```

### Testing

```bash
pnpm test
```

### Building

```bash
pnpm build
```

## License

MIT
