# @kesor/openclaw-cloudflare-plugin

OpenClaw plugin for **Cloudflare Workers AI** - provides media understanding capabilities (speech-to-text, image description, video description, text-to-speech) using Cloudflare's AI models.

## v0.2.0 Update

This version updates to use the new unified `registerProvider` API introduced in OpenClaw. The plugin now registers as a provider with explicit capabilities (`audio`, `image`, `video`, `tts`) compatible with OpenClaw's media-understanding pipeline.

## Features

- **Speech-to-Text (Audio Transcription)**: Transcribe audio using Cloudflare Whisper models
- **Image Understanding**: Describe images using vision models (Llama Vision, Llava)
- **Video Understanding**: Describe video frames using vision models
- **Text-to-Speech (TTS)**: Generate speech using Deepgram Aura models
- **Automatic Integration**: Works seamlessly with OpenClaw's media-understanding pipeline
- **Multiple Models**: Configurable models for audio, vision, and TTS tasks

## Requirements

- OpenClaw gateway running
- Cloudflare account with Workers AI enabled
- Cloudflare API token with AI read permissions

### Getting Cloudflare Credentials

1. **Account ID**: Found in your Cloudflare Dashboard URL (e.g., `https://dash.cloudflare.com/your-account-id`)

2. **API Token**: Create one at https://dash.cloudflare.com/profile/api-tokens
   - Click "Create Token"
   - Use the "Edit Workers AI" template or create a custom token with `AI:Read` permission
   - Copy the token (it won't be shown again)

## Installation

**Note**: The `openclaw plugins install` command does not support remote URLs. Use one of the options below.

### Option 1: From npm (recommended)

```bash
openclaw plugins install @kesor/openclaw-cloudflare-plugin
```

### Option 2: From a local path

```bash
# Clone the plugin repo or use local path
openclaw plugins install /path/to/plugin-cloudflare
```

Or use `--link` to create a symlink instead of copying:

```bash
openclaw plugins install /path/to/plugin-cloudflare --link
```

### Option 3: From archive file

```bash
# Build a tarball and install
cd /path/to/plugin-cloudflare
npm pack
# Produces: openclaw-cloudflare-plugin-0.1.0.tgz

openclaw plugins install ./openclaw-cloudflare-plugin-0.1.0.tgz
```

### Option 4: Built into OpenClaw (custom build)

If you're compiling OpenClaw yourself:

```bash
# From your OpenClaw source directory
cp -r /path/to/plugin-cloudflare extensions/cloudflare-ai

# Rebuild OpenClaw
pnpm build
```

After installation, configure the plugin and restart the Gateway.
```

Then configure and restart the Gateway.

## Configuration

You can configure the plugin via OpenClaw config **or** environment variables.

### Option 1: OpenClaw Config

Add to your OpenClaw config under `plugins.entries.openclaw-cloudflare-plugin.config`:

```json5
{
  "apiToken": "your_cloudflare_api_token",
  "accountId": "your_cloudflare_account_id",
  "audioModel": "@cf/openai/whisper-large-v3-turbo",
  "imageModel": "@cf/meta/llama-3.2-11b-vision-instruct-fp8",
  "ttsModel": "@cf/deepgram/aura-2-en",
  "defaultLanguage": "en",
  "timeout": 60000
}
```

### Option 2: Environment Variables

The plugin also supports environment variables as an alternative to config:

```bash
# Required
export CLOUDFLARE_API_TOKEN="your_api_token"
export CLOUDFLARE_ACCOUNT_ID="your_account_id"

# Optional (defaults shown)
export CLOUDFLARE_AI_AUDIO_MODEL="@cf/openai/whisper-large-v3-turbo"
export CLOUDFLARE_AI_IMAGE_MODEL="@cf/meta/llama-3.2-11b-vision-instruct-fp8"
export CLOUDFLARE_AI_TTS_MODEL="@cf/deepgram/aura-2-en"
```

Environment variables take precedence over config values.

### Configuration Options

| Option | Type | Default | Environment Variable | Description |
|--------|------|---------|---------------------|-------------|
| `apiToken` | string | (required) | `CLOUDFLARE_API_TOKEN` | Cloudflare API token with AI read permissions |
| `accountId` | string | (required) | `CLOUDFLARE_ACCOUNT_ID` | Cloudflare account ID |
| `audioModel` | string | `@cf/openai/whisper-large-v3-turbo` | `CLOUDFLARE_AI_AUDIO_MODEL` | Whisper model for STT |
| `imageModel` | string | `@cf/meta/llama-3.2-11b-vision-instruct-fp8` | `CLOUDFLARE_AI_IMAGE_MODEL` | Vision model for image/video |
| `ttsModel` | string | `@cf/deepgram/aura-2-en` | `CLOUDFLARE_AI_TTS_MODEL` | TTS model for speech synthesis |
| `defaultLanguage` | string | `""` (auto-detect) | - | Language code (e.g., "en", "es") |
| `timeout` | number | `60000` | - | Request timeout in milliseconds |

## Available Models

### Speech-to-Text (Audio)

| Model ID | Description | Pricing |
|----------|-------------|---------|
| `@cf/openai/whisper-large-v3-turbo` | Faster large model (recommended) | $0.00051/min |
| `@cf/openai/whisper` | General-purpose Whisper | $0.00045/min |
| `@cf/openai/whisper-tiny-en` | English-only tiny | Free |

### Vision (Image/Video)

| Model ID | Description | Context |
|----------|-------------|---------|
| `@cf/meta/llama-3.2-11b-vision-instruct-fp8` | Llama 3.2 11B Vision (recommended) | 128K |
| `@cf/meta/llama-3.2-90b-vision-instruct-fp8` | Llama 3.2 90B Vision | 128K |
| `@cf/llava-1.5-7b-vision-fp8` | Llava 1.5 7B | 4K |

### Text-to-Speech (TTS)

| Model ID | Description | Pricing |
|----------|-------------|---------|
| `@cf/deepgram/aura-2-en` | Deepgram Aura 2 (English, recommended) | $0.03/1K chars |
| `@cf/deepgram/aura-2-es` | Deepgram Aura 2 (Spanish) | $0.03/1K chars |
| `@cf/deepgram/aura-1` | Deepgram Aura 1 | $0.015/1K chars |
| `@cf/myshellai/melotts` | MeloTTS (multi-lingual) | Free |

**Note**: To use Llama 3.2 Vision models, you must first accept the Meta License and Acceptable Use Policy by sending a request:
```bash
curl https://api.cloudflare.com/client/v4/accounts/$ACCOUNT_ID/ai/run/@cf/meta/llama-3.2-11b-vision-instruct-fp8 \
  -X POST \
  -H "Authorization: Bearer $API_TOKEN" \
  -d '{ "prompt": "agree"}'
```

## Usage

Once configured, the plugin automatically integrates with OpenClaw's media-understanding pipeline. When users send audio, images, or videos:

1. OpenClaw detects the media attachment
2. The media is processed through the configured providers
3. Cloudflare AI Workers is used if configured as the provider

### Setting as Default Provider

To use Cloudflare as your media provider, configure `tools.media` in your OpenClaw config:

```json5
{
  "tools": {
    "media": {
      "audio": {
        "models": [
          { "provider": "cloudflare-ai" }
        ]
      },
      "image": {
        "models": [
          { "provider": "cloudflare-ai" }
        ]
      },
      "video": {
        "models": [
          { "provider": "cloudflare-ai" }
        ]
      }
    }
  }
}
```

**Note**: The `tts` capability is not yet configurable via config - it will use the first available TTS provider.

### Verifying Installation

After configuration, restart the Gateway and check logs for:
```
[cloudflare-ai] Plugin started
```

You can also verify the plugin is registered by checking `openclaw plugins list`.

### How It Works

The plugin uses OpenClaw's `registerProvider` API to register as a media provider with capabilities for audio, image, video, and TTS. When media is attached to incoming messages:

```
User sends audio/image/video
         │
         ▼
OpenClaw media-understanding pipeline
         │
         ▼
Cloudflare AI Workers provider (this plugin)
         │
         ▼
Transcription / Description returned to agent
```

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                   OpenClaw Gateway                       │
├─────────────────────────────────────────────────────────┤
│  cloudflare-ai plugin                                   │
│  ┌─────────────────────────────────────────────────┐   │
│  │  Provider: cloudflare-ai                         │   │
│  │  Capabilities: audio, image, video, tts          │   │
│  │  ┌───────────────────────────────────────────┐  │   │
│  │  │  transcribeAudio()                        │  │   │
│  │  │  - Receives audio buffer                  │  │   │
│  │  │  - Calls Cloudflare Whisper API          │  │   │
│  │  └───────────────────────────────────────────┘  │   │
│  │  ┌───────────────────────────────────────────┐  │   │
│  │  │  describeImage()                          │  │   │
│  │  │  - Receives image buffer                 │  │   │
│  │  │  - Calls Cloudflare Vision API           │  │   │
│  │  └───────────────────────────────────────────┘  │   │
│  │  ┌───────────────────────────────────────────┐  │   │
│  │  │  describeVideo()                          │  │   │
│  │  │  - Receives video frame buffer           │  │   │
│  │  │  - Calls Cloudflare Vision API           │  │   │
│  │  └───────────────────────────────────────────┘  │   │
│  │  ┌───────────────────────────────────────────┐  │   │
│  │  │  textToSpeech()                          │  │   │
│  │  │  - Receives text                         │  │   │
│  │  │  - Calls Cloudflare TTS API              │  │   │
│  │  └───────────────────────────────────────────┘  │   │
│  └─────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
               ┌─────────────────────────┐
               │  Cloudflare Workers AI   │
               │  • Whisper (STT)        │
               │  • Llama Vision         │
               │  • Deepgram Aura (TTS)  │
               └─────────────────────────┘
```

## Development

### Prerequisites

- Node.js 22+
- pnpm

### Setup

```bash
cd plugin-cloudflare
pnpm install
```

### Running Tests

```bash
cd plugin-cloudflare
pnpm test
```

### Type Checking

```bash
cd plugin-cloudflare
pnpm check
```

### Building

```bash
cd plugin-cloudflare
pnpm build
```

## Troubleshooting

### Plugin Not Loading

Check the Gateway logs for errors:
```bash
openclaw doctor
```

### API Errors

- Verify your `accountId` is correct (not the zone ID)
- Ensure the API token has AI:Read permissions
- Check Cloudflare Workers AI is active on your account (free tier works)

### Model Not Available

Some models require acceptance of terms:
- Llama 3.2 Vision: Accept Meta License via API (see above)
- Check [Cloudflare Workers AI Models](https://developers.cloudflare.com/workers-ai/models/) for availability

## License

MIT
