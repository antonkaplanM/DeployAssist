# Text-to-Speech Converter

A Node.js script for converting podcast-style documents (.docx) into audio files using Windows TTS or Google TTS.

## Features

- **Multi-voice support**: Automatically detects speakers in podcast scripts and assigns different voices
- **Two TTS providers**: 
  - Windows TTS (SAPI) - **RECOMMENDED** - Offline, uses system voices
  - Google TTS (gTTS) - Free, requires internet
- **Document parsing**: Extracts text from .docx files using mammoth
- **No API keys required**: Works offline with Windows built-in voices

## Prerequisites

### Required Dependencies

Install the required packages:

```bash
npm install mammoth say gtts
```

## Usage

### Basic Usage

```bash
# Using Windows TTS (default, offline)
node scripts/text-to-speech.js docs/data/podcast.sample.docx

# Using gTTS (requires internet)
node scripts/text-to-speech.js docs/data/podcast.sample.docx --provider=gtts
```

### With npm script

```bash
npm run tts:convert docs/data/podcast.sample.docx
npm run tts:convert docs/data/podcast.sample.docx output.wav
```

### Command Line Options

| Option | Description |
|--------|-------------|
| `<input.docx>` | Path to the input Word document (required) |
| `[output.wav]` | Path for output audio file (default: same name as input with .wav extension) |
| `--provider=windows\|gtts` | Choose TTS provider (default: windows) |
| `--single-voice` | Use single voice instead of multi-voice |
| `--ignore-ssl` | Ignore SSL certificate errors (for gTTS on corporate networks) |
| `--help, -h` | Show help message |

## Podcast Script Format

The script automatically detects speakers in your podcast document. Supported formats:

```
Host: Hello everyone, welcome to the show...
Co-host: Thanks for having me...

[Host] Today we're discussing...
[Narrator] The research shows that...

**Host:** Let me explain this further...
```

### Voice Assignments

For Windows TTS, speakers are automatically assigned voices:

| Speaker | Voice |
|---------|-------|
| host | Microsoft David Desktop (Male) |
| cohost, co-host | Microsoft Zira Desktop (Female) |
| narrator | Microsoft Zira Desktop (Female) |
| speaker1 | Microsoft David Desktop |
| speaker2 | Microsoft Zira Desktop |
| default | Microsoft Zira Desktop |

## Examples

### Convert a research report (Windows TTS - offline)

```bash
node scripts/text-to-speech.js docs/data/podcast.sample.docx podcast-episode.wav
```

### Use Google TTS (requires internet)

```bash
node scripts/text-to-speech.js docs/data/podcast.sample.docx --provider=gtts --ignore-ssl
```

### Single voice narration

```bash
node scripts/text-to-speech.js docs/data/report.docx --single-voice
```

## Output

The script outputs:
- Progress information during conversion
- Preview of extracted text
- Final audio file size
- Success/error status

Example output:

```
🎧 Text-to-Speech Converter
═══════════════════════════════════════

📂 Input:  docs/data/podcast.sample.docx
📂 Output: docs/data/podcast-windows.wav
🔧 Provider: windows

📄 Parsing document: docs/data/podcast.sample.docx
📝 Extracted 5255 characters of text

Preview:
─────────────────────────────────────
Title: Inside the Numbers – Microsoft's Money Machine...

🎙️  Using Windows TTS (SAPI)
   Available voices: Microsoft David Desktop, Microsoft Zira Desktop
   Found 55 segments from 2 speakers
   Speakers: title, host
🔊 Synthesizing audio segments...
   Progress: 55/55 segments
📦 Combining audio segments...
✅ Audio saved to: docs/data/podcast-windows.wav
🧹 Cleaning up temporary files...

📊 Output file size: 17.14 MB

✨ Conversion complete!
```

## Troubleshooting

### Missing dependencies

```bash
npm install mammoth say gtts
```

### SSL Certificate errors (for gTTS on corporate networks)

If you're behind a corporate proxy or firewall with SSL inspection:

```bash
node scripts/text-to-speech.js docs/data/podcast.sample.docx --provider=gtts --ignore-ssl
```

Or set the environment variable:

```bash
set NODE_TLS_REJECT_UNAUTHORIZED=0
node scripts/text-to-speech.js docs/data/podcast.sample.docx --provider=gtts
```

### Windows TTS not working

Ensure you have Windows voices installed:
1. Go to Windows Settings > Time & Language > Speech
2. Check that English voices are installed
3. Default voices: Microsoft David Desktop (Male), Microsoft Zira Desktop (Female)

### Large documents

For very large documents, the script processes segments individually. Consider:
- Breaking the document into chapters
- Using the `--single-voice` option for faster processing

## Output Formats

- **Windows TTS**: Outputs WAV format (uncompressed, larger files)
- **gTTS**: Outputs MP3 format (compressed, smaller files)

## Cost Considerations

- **Windows TTS**: Free, uses built-in Windows voices. Works offline.
- **gTTS**: Free, uses Google Translate's TTS API. Requires internet. May have rate limits.

## Related

- [say.js Documentation](https://github.com/Marak/say.js)
- [mammoth.js Documentation](https://github.com/mwilliamson/mammoth.js)
- [gTTS Documentation](https://github.com/pndurette/gTTS)
