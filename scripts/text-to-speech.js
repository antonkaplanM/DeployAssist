/**
 * Text-to-Speech Converter for Podcast Scripts
 * 
 * Converts .docx podcast scripts to audio files using:
 * - Windows TTS (SAPI) - offline, uses system voices (RECOMMENDED for corporate networks)
 * - Google TTS (gTTS) - free, requires internet
 * - Microsoft Edge TTS - free neural voices (may be blocked by corporate firewalls)
 * 
 * Usage:
 *   node scripts/text-to-speech.js <input.docx> [output.wav] [--provider=windows|gtts|edge]
 * 
 * Examples:
 *   node scripts/text-to-speech.js docs/data/podcast.sample.docx
 *   node scripts/text-to-speech.js docs/data/podcast.sample.docx output.wav --provider=windows
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mammoth = require('mammoth');

// Handle corporate proxy/self-signed certificates if needed
if (process.env.NODE_TLS_REJECT_UNAUTHORIZED === '0' || process.argv.includes('--ignore-ssl')) {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
    console.log('⚠️  SSL certificate verification disabled');
}

// Configuration
const config = {
    windows: {
        // Voice options for podcast-style dialogue
        voices: {
            host: 'Microsoft David Desktop',     // Male voice
            cohost: 'Microsoft Zira Desktop',    // Female voice
            narrator: 'Microsoft Zira Desktop',  // Female voice
            default: 'Microsoft Zira Desktop'
        },
        speed: 1.0  // Speech rate (0.5 = slow, 1 = normal, 2 = fast)
    },
    gtts: {
        language: 'en',
        slow: false
    },
    output: {
        defaultFormat: 'wav',
        sampleRate: 24000
    }
};

/**
 * Parse .docx file and extract text content
 */
async function parseDocx(filePath) {
    console.log(`📄 Parsing document: ${filePath}`);
    
    const absolutePath = path.resolve(filePath);
    
    if (!fs.existsSync(absolutePath)) {
        throw new Error(`File not found: ${absolutePath}`);
    }
    
    const result = await mammoth.extractRawText({ path: absolutePath });
    
    if (result.messages.length > 0) {
        console.log('⚠️  Document parsing warnings:', result.messages);
    }
    
    return result.value;
}

/**
 * Parse podcast script to identify speakers and their lines
 * Supports formats like:
 * - "Host: Hello everyone..."
 * - "[Host] Hello everyone..."
 * - "**Host:** Hello everyone..."
 */
function parsePodcastScript(text) {
    const lines = text.split('\n').filter(line => line.trim());
    const segments = [];
    
    // Patterns for speaker identification
    const speakerPatterns = [
        /^(\*\*)?([A-Za-z]+)(\*\*)?:\s*(.+)$/,      // Host: text or **Host:** text
        /^\[([A-Za-z]+)\]\s*(.+)$/,                  // [Host] text
        /^([A-Z]+):\s*(.+)$/,                        // HOST: text
    ];
    
    let currentSpeaker = 'narrator';
    
    for (const line of lines) {
        let matched = false;
        
        for (const pattern of speakerPatterns) {
            const match = line.match(pattern);
            if (match) {
                // Extract speaker and text based on pattern
                if (pattern.source.includes('\\*\\*')) {
                    currentSpeaker = match[2].toLowerCase();
                    segments.push({
                        speaker: currentSpeaker,
                        text: match[4]
                    });
                } else if (pattern.source.includes('\\[')) {
                    currentSpeaker = match[1].toLowerCase();
                    segments.push({
                        speaker: currentSpeaker,
                        text: match[2]
                    });
                } else {
                    currentSpeaker = match[1].toLowerCase();
                    segments.push({
                        speaker: currentSpeaker,
                        text: match[2]
                    });
                }
                matched = true;
                break;
            }
        }
        
        if (!matched && line.trim()) {
            // No speaker identified, use current speaker or narrator
            segments.push({
                speaker: currentSpeaker,
                text: line.trim()
            });
        }
    }
    
    return segments;
}

/**
 * Get voice for speaker
 */
function getVoiceForSpeaker(speaker, voices) {
    const voiceMap = {
        'host': voices.host,
        'cohost': voices.cohost,
        'co-host': voices.cohost,
        'narrator': voices.narrator,
        'speaker1': voices.host,
        'speaker2': voices.cohost,
    };
    return voiceMap[speaker] || voices.default;
}

/**
 * Convert text to speech using Windows TTS (SAPI)
 * Works offline - no internet required
 */
async function convertWithWindows(text, outputPath, useMultipleVoices = true) {
    const say = require('say');
    
    console.log('🎙️  Using Windows TTS (SAPI)');
    console.log('   Available voices: Microsoft David Desktop, Microsoft Zira Desktop');
    
    // Ensure output is .wav for Windows TTS
    if (!outputPath.endsWith('.wav')) {
        outputPath = outputPath.replace(/\.[^.]+$/, '.wav');
        console.log(`   Note: Windows TTS outputs WAV format. Output: ${outputPath}`);
    }
    
    if (useMultipleVoices) {
        // Parse script for multiple speakers
        const segments = parsePodcastScript(text);
        const uniqueSpeakers = new Set(segments.map(s => s.speaker));
        console.log(`   Found ${segments.length} segments from ${uniqueSpeakers.size} speakers`);
        console.log(`   Speakers: ${[...uniqueSpeakers].join(', ')}`);
        
        // Synthesize with multiple voices
        return await synthesizeMultiVoiceWindows(segments, outputPath);
    } else {
        // Single voice synthesis
        console.log(`   Voice: ${config.windows.voices.default}`);
        console.log('🔊 Synthesizing audio...');
        
        return new Promise((resolve, reject) => {
            say.export(text, config.windows.voices.default, config.windows.speed, outputPath, (err) => {
                if (err) {
                    reject(err);
                } else {
                    console.log(`✅ Audio saved to: ${outputPath}`);
                    resolve(outputPath);
                }
            });
        });
    }
}

/**
 * Synthesize multi-voice podcast with Windows TTS
 */
async function synthesizeMultiVoiceWindows(segments, outputPath) {
    const say = require('say');
    
    const tempDir = path.join(path.dirname(outputPath), '.tts-temp');
    
    // Create temp directory
    if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
    }
    
    const tempFiles = [];
    
    console.log('🔊 Synthesizing audio segments...');
    
    try {
        for (let i = 0; i < segments.length; i++) {
            const segment = segments[i];
            const voice = getVoiceForSpeaker(segment.speaker, config.windows.voices);
            
            const tempFile = path.join(tempDir, `segment-${i.toString().padStart(4, '0')}.wav`);
            
            await new Promise((resolve, reject) => {
                say.export(segment.text, voice, config.windows.speed, tempFile, (err) => {
                    if (err) reject(err);
                    else resolve();
                });
            });
            
            tempFiles.push(tempFile);
            
            // Progress indicator
            if ((i + 1) % 5 === 0 || i === segments.length - 1) {
                process.stdout.write(`\r   Progress: ${i + 1}/${segments.length} segments`);
            }
        }
        
        console.log('\n📦 Combining audio segments...');
        
        // Combine all WAV files
        await combineWavFiles(tempFiles, outputPath);
        
        console.log(`✅ Audio saved to: ${outputPath}`);
        return outputPath;
        
    } finally {
        // Cleanup temp files
        console.log('🧹 Cleaning up temporary files...');
        for (const file of tempFiles) {
            try {
                if (fs.existsSync(file)) {
                    fs.unlinkSync(file);
                }
            } catch (e) {
                // Ignore cleanup errors
            }
        }
        try {
            if (fs.existsSync(tempDir)) {
                fs.rmdirSync(tempDir);
            }
        } catch (e) {
            // Ignore cleanup errors
        }
    }
}

/**
 * Combine multiple WAV files into one using wavefile library
 */
async function combineWavFiles(inputFiles, outputPath) {
    const { WaveFile } = require('wavefile');
    
    if (inputFiles.length === 0) {
        throw new Error('No audio files to combine');
    }
    
    // Read first file to get format info
    const firstWav = new WaveFile(fs.readFileSync(inputFiles[0]));
    const sampleRate = firstWav.fmt.sampleRate;
    const bitDepth = firstWav.bitDepth;
    const numChannels = firstWav.fmt.numChannels;
    
    // Collect all samples
    const allSamples = [];
    
    for (const file of inputFiles) {
        const wav = new WaveFile(fs.readFileSync(file));
        const samples = wav.getSamples(false, Int16Array);
        
        // Handle mono vs stereo
        if (Array.isArray(samples)) {
            // Stereo - interleave channels
            for (let i = 0; i < samples[0].length; i++) {
                for (let ch = 0; ch < samples.length; ch++) {
                    allSamples.push(samples[ch][i]);
                }
            }
        } else {
            // Mono
            for (let i = 0; i < samples.length; i++) {
                allSamples.push(samples[i]);
            }
        }
        
        // Add a small pause between segments (0.3 seconds of silence)
        const pauseSamples = Math.floor(sampleRate * 0.3) * numChannels;
        for (let i = 0; i < pauseSamples; i++) {
            allSamples.push(0);
        }
    }
    
    // Create combined WAV file
    const combinedWav = new WaveFile();
    combinedWav.fromScratch(numChannels, sampleRate, bitDepth, new Int16Array(allSamples));
    
    // Write to file
    fs.writeFileSync(outputPath, combinedWav.toBuffer());
}

/**
 * Convert text to speech using Google TTS (gTTS)
 * Note: gTTS uses the Google Translate TTS API (free but limited)
 */
async function convertWithGTTS(text, outputPath) {
    const gtts = require('gtts');
    
    console.log('🎙️  Using Google TTS (gTTS)');
    console.log(`   Language: ${config.gtts.language}`);
    
    // Ensure output is .mp3 for gTTS
    if (!outputPath.endsWith('.mp3')) {
        outputPath = outputPath.replace(/\.[^.]+$/, '.mp3');
    }
    
    return new Promise((resolve, reject) => {
        const speech = new gtts(text, config.gtts.language);
        
        console.log('🔊 Synthesizing audio...');
        
        speech.save(outputPath, (err) => {
            if (err) {
                reject(err);
            } else {
                console.log(`✅ Audio saved to: ${outputPath}`);
                resolve(outputPath);
            }
        });
    });
}

/**
 * Main function
 */
async function main() {
    const args = process.argv.slice(2);
    
    if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
        console.log(`
Text-to-Speech Converter for Podcast Scripts

Usage:
  node scripts/text-to-speech.js <input.docx> [output.wav] [options]

Options:
  --provider=windows|gtts   Choose TTS provider (default: windows)
  --single-voice            Use single voice instead of multi-voice
  --ignore-ssl              Ignore SSL certificate errors (for gTTS)
  --help, -h                Show this help message

Providers:
  windows   Windows TTS (SAPI) - OFFLINE, uses system voices (RECOMMENDED)
  gtts      Google TTS - FREE, requires internet

Windows Voices Available:
  Host:     Microsoft David Desktop (Male)
  Co-host:  Microsoft Zira Desktop (Female)

Examples:
  node scripts/text-to-speech.js docs/data/podcast.sample.docx
  node scripts/text-to-speech.js docs/data/podcast.sample.docx podcast.wav
  node scripts/text-to-speech.js docs/data/podcast.sample.docx --provider=gtts
  node scripts/text-to-speech.js docs/data/podcast.sample.docx --single-voice
        `);
        process.exit(0);
    }
    
    // Parse arguments
    const inputFile = args.find(arg => !arg.startsWith('--'));
    let outputFile = args.find((arg, i) => i > 0 && !arg.startsWith('--')) || 
                     inputFile.replace(/\.docx$/i, '.wav');
    const provider = args.find(arg => arg.startsWith('--provider='))?.split('=')[1] || 'windows';
    const singleVoice = args.includes('--single-voice');
    
    console.log('\n🎧 Text-to-Speech Converter');
    console.log('═══════════════════════════════════════\n');
    console.log(`📂 Input:  ${inputFile}`);
    console.log(`📂 Output: ${outputFile}`);
    console.log(`🔧 Provider: ${provider}`);
    console.log('');
    
    try {
        // Parse the document
        const text = await parseDocx(inputFile);
        console.log(`📝 Extracted ${text.length} characters of text\n`);
        
        // Preview first 200 characters
        console.log('Preview:');
        console.log('─────────────────────────────────────');
        console.log(text.substring(0, 200) + '...\n');
        
        // Convert to audio
        if (provider === 'windows') {
            outputFile = await convertWithWindows(text, outputFile, !singleVoice);
        } else if (provider === 'gtts') {
            outputFile = await convertWithGTTS(text, outputFile);
        } else {
            throw new Error(`Unknown provider: ${provider}. Use 'windows' or 'gtts'.`);
        }
        
        // Show file info
        const stats = fs.statSync(outputFile);
        const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);
        console.log(`\n📊 Output file size: ${sizeMB} MB`);
        
        console.log('\n✨ Conversion complete!\n');
        
    } catch (error) {
        console.error('\n❌ Error:', error.message);
        
        if (error.message.includes('Cannot find module')) {
            console.log('\nMissing dependencies. Install them with:');
            console.log('  npm install mammoth say gtts');
        }
        
        process.exit(1);
    }
}

main();
