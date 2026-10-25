/**
 * JARVIS AI Voice Butler Engine
 * Features:
 * - ElevenLabs Realistic Male Voice TTS (with British/American Butler presets)
 * - Seamless Web Speech API male fallback with British JARVIS pitch/rate tuning
 * - Speech-to-Text Voice Recognition for hands-free video editing commands
 * - Google AI Integration (Gemma / Gemini 2.5/3.8) for intelligent conversational butler responses
 * - Futuristic Glowing Arc Reactor UI HUD with sound wave audio visualization
 * - Event-driven spoken notifications ("It's done, sir", "Clip split at playhead, sir")
 */
(function (global) {
  'use strict';

  // Default API keys can be supplied via localStorage or the JARVIS settings UI
  const DEFAULT_ELEVEN_KEY = (typeof localStorage !== 'undefined' && localStorage.getItem('whop_elevenlabs_key')) || '';
  const DEFAULT_GOOGLE_KEY = (typeof localStorage !== 'undefined' && (localStorage.getItem('whop_google_api_key') || localStorage.getItem('whop_ai_api_key'))) || '';

  // Famous ElevenLabs Male Voices (George = British articulate butler, Adam = Deep authoritative, Callum = Crisp)
  const ELEVEN_VOICES = {
    'jarvis-british': { id: 'JBFqnCBsd6RMkjVDRZzb', name: 'George (British Butler / Classic JARVIS)' },
    'jarvis-deep': { id: 'pNInz6obpgDQGcFmaJgB', name: 'Adam (Deep Authoritative Male)' },
    'jarvis-callum': { id: 'N2lVS1w4EtoT3dr4eOWO', name: 'Callum (Crisp Confident Male)' },
  };

  class JarvisEngine {
    constructor() {
      this.elevenKey = (typeof localStorage !== 'undefined' && localStorage.getItem('whop_elevenlabs_key')) || DEFAULT_ELEVEN_KEY;
      this.googleKey = (typeof localStorage !== 'undefined' && localStorage.getItem('whop_google_api_key')) || DEFAULT_GOOGLE_KEY;
      this.voicePreset = 'jarvis-british';
      this.recognitionLang = (typeof localStorage !== 'undefined' && localStorage.getItem('whop_jarvis_lang')) || 'fil-PH';
      this.voiceEnabled = true;
      this.isSpeaking = false;
      this.isListening = false;
      this.currentAudio = null;
      this.recognition = null;
      this.chatHistory = [];
      this.speechSynth = typeof window !== 'undefined' ? window.speechSynthesis : null;
      this.selectedWebVoice = null;
      this.selectedFilipinoVoice = null;
      this.siriWave = null;

      this.initWebVoice();
      if (typeof window !== 'undefined') {
        window.addEventListener('DOMContentLoaded', () => {
          this.initSiriWave();
        });
      }
    }

    setRecognitionLang(lang) {
      if (!lang) return;
      this.recognitionLang = lang.trim();
      if (typeof localStorage !== 'undefined') localStorage.setItem('whop_jarvis_lang', this.recognitionLang);
    }

    playStartSound() {
      try {
        const audio = new Audio('/assets/audio/jarvis_start.mp3');
        audio.volume = 0.5;
        audio.play().catch(() => {});
      } catch (e) {}
    }

    initSiriWave() {
      if (typeof SiriWave === 'undefined') return;
      const container = document.getElementById('jarvisSiriContainer');
      if (!container) return;
      if (this.siriWave) {
        try { this.siriWave.start(); } catch (e) {}
        return;
      }
      try {
        container.innerHTML = '';
        this.siriWave = new SiriWave({
          container: container,
          width: container.clientWidth || 520,
          height: 65,
          style: 'ios9',
          amplitude: 0.25,
          speed: 0.12,
          autostart: true,
          cover: true
        });
      } catch (e) {
        console.warn('[JARVIS] SiriWave init notice:', e);
      }
    }

    initWebVoice() {
      if (!this.speechSynth) return;
      const loadVoices = () => {
        const voices = this.speechSynth.getVoices();
        // Look for Filipino / Tagalog voice
        this.selectedFilipinoVoice =
          voices.find((v) => v.lang.startsWith('fil') || v.lang.startsWith('tl')) || null;
        // Look for British or sophisticated English male voice
        this.selectedWebVoice =
          voices.find((v) => (v.name.includes('George') || v.name.includes('Daniel') || v.name.includes('UK English Male') || v.name.includes('Oliver') || v.name.includes('Arthur')) && v.lang.startsWith('en')) ||
          voices.find((v) => (v.name.includes('David') || v.name.includes('Guy') || v.name.includes('Male')) && v.lang.startsWith('en')) ||
          voices.find((v) => v.lang.startsWith('en-GB')) ||
          voices.find((v) => v.lang.startsWith('en')) ||
          voices[0];
      };
      loadVoices();
      if (this.speechSynth.onvoiceschanged !== undefined) {
        this.speechSynth.onvoiceschanged = loadVoices;
      }
    }

    setElevenKey(key) {
      if (!key) return;
      this.elevenKey = key.trim();
      if (typeof localStorage !== 'undefined') localStorage.setItem('whop_elevenlabs_key', this.elevenKey);
    }

    setGoogleKey(key) {
      if (!key) return;
      this.googleKey = key.trim();
      if (typeof localStorage !== 'undefined') localStorage.setItem('whop_google_api_key', this.googleKey);
    }

    showVisualSpeechIndicator(text) {
      const reactor = document.getElementById('jarvisReactor');
      const wave = document.getElementById('jarvisVoiceWave');
      const bubble = document.getElementById('jarvisFloatingBubble');
      const bubbleText = document.getElementById('jarvisBubbleText');

      if (reactor) reactor.classList.add('glowing-active');
      if (wave) wave.classList.add('wave-active');

      if (this.siriWave) {
        try {
          this.siriWave.setSpeed(0.35);
          this.siriWave.setAmplitude(1.35);
        } catch (e) {}
      }

      if (bubble && bubbleText) {
        bubbleText.textContent = `"${text}"`;
        bubble.classList.remove('hidden');
        bubble.classList.add('visible');
      }
    }

    hideVisualSpeechIndicator() {
      const reactor = document.getElementById('jarvisReactor');
      const wave = document.getElementById('jarvisVoiceWave');
      const bubble = document.getElementById('jarvisFloatingBubble');

      if (reactor) reactor.classList.remove('glowing-active');
      if (wave) wave.classList.remove('wave-active');

      if (this.siriWave) {
        try {
          this.siriWave.setSpeed(0.12);
          this.siriWave.setAmplitude(0.22);
        } catch (e) {}
      }

      if (bubble) {
        bubble.classList.remove('visible');
        setTimeout(() => {
          if (!this.isSpeaking) bubble.classList.add('hidden');
        }, 350);
      }
    }

    async speak(text, priority = false) {
      if (!this.voiceEnabled || !text) return;

      // Stop any existing speech
      this.stopSpeaking();
      this.isSpeaking = true;
      this.showVisualSpeechIndicator(text);

      // Attempt 1: ElevenLabs Male TTS
      let playedElevenLabs = false;
      if (this.elevenKey && this.elevenKey.startsWith('sk_')) {
        try {
          const voiceId = ELEVEN_VOICES[this.voicePreset]?.id || ELEVEN_VOICES['jarvis-british'].id;
          const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`;
          const res = await fetch(url, {
            method: 'POST',
            headers: {
              'xi-api-key': this.elevenKey,
              'Content-Type': 'application/json',
              'Accept': 'audio/mpeg'
            },
            body: JSON.stringify({
              text: text,
              model_id: 'eleven_multilingual_v2',
              voice_settings: {
                stability: 0.65,
                similarity_boost: 0.85,
                style: 0.35,
                use_speaker_boost: true
              }
            })
          });

          if (res.ok) {
            const blob = await res.blob();
            const audioUrl = URL.createObjectURL(blob);
            const audio = new Audio(audioUrl);
            this.currentAudio = audio;

            await new Promise((resolve) => {
              const safetyTimer = setTimeout(() => {
                this.isSpeaking = false;
                this.hideVisualSpeechIndicator();
                resolve();
              }, Math.min(8000, Math.max(2000, text.length * 70)));

              audio.onended = () => {
                clearTimeout(safetyTimer);
                this.isSpeaking = false;
                this.hideVisualSpeechIndicator();
                resolve();
              };
              audio.onerror = () => {
                clearTimeout(safetyTimer);
                resolve();
              };
              audio.play().catch(() => {
                clearTimeout(safetyTimer);
                resolve();
              });
            });
            playedElevenLabs = true;
          }
        } catch (e) {
          console.warn('[JARVIS] ElevenLabs TTS notice, falling back to Web Speech:', e);
        }
      }

      // Attempt 2: High-Quality Web Speech API Male Voice Fallback
      if (!playedElevenLabs && this.speechSynth) {
        try {
          this.speechSynth.cancel();
          const utter = new SpeechSynthesisUtterance(text);
          const isTagalogText = /\b(po|opo|kamusta|kumusta|mabuti|nandito|ako|ikaw|atin|natin|salamat|pwede|paborito|pelikula|kwentuhan|magandang|araw|hapon|gabi|umaga|bura|hati|hatiin)\b/i.test(text);
          if (isTagalogText && this.selectedFilipinoVoice) {
            utter.voice = this.selectedFilipinoVoice;
            utter.lang = 'fil-PH';
            utter.pitch = 0.95;
            utter.rate = 1.0;
          } else {
            if (this.selectedWebVoice) utter.voice = this.selectedWebVoice;
            // Calm, measured British butler cadence
            utter.pitch = 0.90;
            utter.rate = isTagalogText ? 0.98 : 1.04;
          }
          utter.volume = 1.0;

          await new Promise((resolve) => {
            const safetyTimer = setTimeout(() => {
              this.isSpeaking = false;
              this.hideVisualSpeechIndicator();
              resolve();
            }, Math.min(6000, Math.max(1200, text.length * 50)));

            utter.onend = () => {
              clearTimeout(safetyTimer);
              this.isSpeaking = false;
              this.hideVisualSpeechIndicator();
              resolve();
            };
            utter.onerror = () => {
              clearTimeout(safetyTimer);
              this.isSpeaking = false;
              this.hideVisualSpeechIndicator();
              resolve();
            };
            this.speechSynth.speak(utter);
          });
        } catch (err) {
          console.warn('[JARVIS] Web Speech error:', err);
          this.isSpeaking = false;
          this.hideVisualSpeechIndicator();
        }
      } else if (!playedElevenLabs) {
        this.isSpeaking = false;
        this.hideVisualSpeechIndicator();
      }
    }

    stopSpeaking() {
      this.isSpeaking = false;
      if (this.currentAudio) {
        try {
          this.currentAudio.pause();
          this.currentAudio.currentTime = 0;
        } catch (e) {}
        this.currentAudio = null;
      }
      if (this.speechSynth) {
        try {
          this.speechSynth.cancel();
        } catch (e) {}
      }
      this.hideVisualSpeechIndicator();
    }

    // Voice notifications for editor actions
    notify(eventType, detail = '') {
      switch (eventType) {
        case 'auto-edit-done':
          this.speak("It's done, sir. I have analyzed the footage, detected viral moments, and generated karaoke captions.");
          break;
        case 'split-done':
          this.speak("Clip split at the playhead, sir.");
          break;
        case 'gap-created':
          this.speak("Timeline adjusted, sir. Space cleared for your visual overlay.");
          break;
        case 'cut-deleted':
          this.speak("Cut segment removed from the timeline, sir.");
          break;
        case 'upload-done':
          this.speak("Footage ingested and transcribed, sir. All speech is indexed.");
          break;
        case 'render-start':
          this.speak("Render initiated, sir. Compiling your 1080p vertical short now.");
          break;
        case 'render-done':
          this.speak("It's done, sir. Your high-definition viral short is ready for download.");
          break;
        case 'custom':
          if (detail) this.speak(detail);
          break;
        default:
          break;
      }
    }

    // Voice recognition for interactive voice commands
    toggleListening(onTextCallback) {
      const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SpeechRec) {
        if (typeof showToast === 'function') {
          showToast('Voice input requires a Chromium-based browser with SpeechRecognition support.', '#f59e0b');
        }
        return false;
      }

      if (this.isListening) {
        this.stopListening();
        return false;
      }

      try {
        this.playStartSound();
        this.initSiriWave();
        if (this.siriWave) {
          try {
            this.siriWave.setSpeed(0.38);
            this.siriWave.setAmplitude(1.5);
          } catch (e) {}
        }

        this.recognition = new SpeechRec();
        this.recognition.continuous = false;
        this.recognition.interimResults = false;
        this.recognition.lang = this.recognitionLang || 'fil-PH';

        const reactor = document.getElementById('jarvisReactor');
        if (reactor) reactor.classList.add('listening-active');
        this.isListening = true;

        this.recognition.onresult = (event) => {
          const transcript = event.results[0][0].transcript;
          this.isListening = false;
          if (reactor) reactor.classList.remove('listening-active');
          if (this.siriWave) {
            try {
              this.siriWave.setSpeed(0.12);
              this.siriWave.setAmplitude(0.25);
            } catch (e) {}
          }
          if (typeof onTextCallback === 'function') onTextCallback(transcript);
          this.handleUserCommand(transcript);
        };

        this.recognition.onerror = () => {
          this.isListening = false;
          if (reactor) reactor.classList.remove('listening-active');
          if (this.siriWave) {
            try {
              this.siriWave.setSpeed(0.12);
              this.siriWave.setAmplitude(0.25);
            } catch (e) {}
          }
        };

        this.recognition.onend = () => {
          this.isListening = false;
          if (reactor) reactor.classList.remove('listening-active');
          if (this.siriWave) {
            try {
              this.siriWave.setSpeed(0.12);
              this.siriWave.setAmplitude(0.25);
            } catch (e) {}
          }
        };

        this.recognition.start();
        return true;
      } catch (e) {
        console.warn('[JARVIS] Recognition start error:', e);
        this.isListening = false;
        return false;
      }
    }

    stopListening() {
      this.isListening = false;
      if (this.recognition) {
        try { this.recognition.stop(); } catch (e) {}
        this.recognition = null;
      }
      const reactor = document.getElementById('jarvisReactor');
      if (reactor) reactor.classList.remove('listening-active');
    }

    // Process voice/chat command from user
    async handleUserCommand(rawText) {
      if (!rawText) return;
      const text = rawText.trim().toLowerCase();

      // 1. Direct Editor Control Commands (English & Tagalog)
      if (text.includes('hatiin') || text.includes('hati') || text.includes('putulin') || text.includes('split') || text.includes('cut here') || text.includes('slice')) {
        if (window.WhopStudio?.splitClipAtPlayhead) {
          window.WhopStudio.splitClipAtPlayhead();
          await this.speak("Hahatiin ko na po ang video sa inyong playhead, sir.");
          return;
        }
      }

      if (text.includes('patugtugin') || text.includes('i-play') || text.includes('iplay') || text.includes('play') || text.includes('resume') || text.includes('start video')) {
        const playBtn = document.getElementById('playPauseBtn');
        if (playBtn && !window.WhopState?.isPlaying) playBtn.click();
        await this.speak("Pinapatugtog na po ang video, sir.");
        return;
      }

      if (text.includes('ihinto') || text.includes('itigil') || text.includes('tigil') || text.includes('pause') || text.includes('stop')) {
        const playBtn = document.getElementById('playPauseBtn');
        if (playBtn && window.WhopState?.isPlaying) playBtn.click();
        await this.speak("Nakahinto na po ang playback, sir.");
        return;
      }

      if (text.includes('tanggalin') || text.includes('burahin') || text.includes('bura') || text.includes('delete') || text.includes('remove clip') || text.includes('remove cut')) {
        if (window.WhopStudio?.deleteSelectedCapCutItem) {
          window.WhopStudio.deleteSelectedCapCutItem();
          await this.speak("Tinanggal ko na po ang napiling clip sa timeline, sir.");
          return;
        }
      }

      if (text.includes('auto edit') || text.includes('i-edit mo') || text.includes('make viral') || text.includes('edit video')) {
        const autoBtn = document.getElementById('oneClickAutoEditBtn');
        if (autoBtn) autoBtn.click();
        await this.speak("Sinisimulan ko na po ang 1-click multi-engine auto edit para sa inyo, sir.");
        return;
      }

      if (text.includes('export') || text.includes('render') || text.includes('save video') || text.includes('i-download')) {
        const expBtn = document.getElementById('openExportModalBtn');
        if (expBtn) expBtn.click();
        await this.speak("Binubuksan ko na po ang export configuration para sa inyong 1080p short, sir.");
        return;
      }

      if (text.includes('maglagay ng litrato') || text.includes('lagyan ng picture') || text.includes('lagay ng picture') || text.includes('add picture') || text.includes('add image') || text.includes('insert visual') || text.includes('picture')) {
        const imgInput = document.getElementById('visualOverlayFileInput');
        if (imgInput) {
          imgInput.accept = 'image/*';
          imgInput.click();
          await this.speak("Binubuksan ko na po ang file selector para sa inyong visual overlay o picture, sir.");
          return;
        }
      }

      if (text.includes('caption') && (text.includes('hormozi') || text.includes('pop'))) {
        if (window.WhopState) window.WhopState.captionStyle = 'hormozi-pop';
        if (window.WhopStudio?.renderTimelineTracks) window.WhopStudio.renderTimelineTracks();
        await this.speak("Pinalitan ko na po ang caption style sa Hormozi Pop, sir.");
        return;
      }

      if (text.includes('caption') && (text.includes('mrbeast') || text.includes('bold'))) {
        if (window.WhopState) window.WhopState.captionStyle = 'mrbeast-bold';
        if (window.WhopStudio?.renderTimelineTracks) window.WhopStudio.renderTimelineTracks();
        await this.speak("Pinalitan ko na po ang caption style sa MrBeast Bold, sir.");
        return;
      }

      // Greetings check: Instant suave response with zero latency
      const cleanLower = text.replace(/[?!.,]/g, '').trim();
      const isGreeting =
        cleanLower === 'hello' ||
        cleanLower === 'hi' ||
        cleanLower === 'hello jarvis' ||
        cleanLower === 'hi jarvis' ||
        cleanLower === 'hey jarvis' ||
        cleanLower === 'kamusta' ||
        cleanLower === 'kumusta' ||
        cleanLower === 'kamusta ka' ||
        cleanLower === 'kamusta ka na' ||
        cleanLower === 'kamusta jarvis' ||
        cleanLower === 'kumusta jarvis' ||
        cleanLower === 'musta' ||
        cleanLower === 'magandang araw' ||
        cleanLower === 'magandang umaga' ||
        cleanLower === 'magandang hapon' ||
        cleanLower === 'magandang gabi';

      if (isGreeting) {
        const isTagalog = cleanLower.includes('kamusta') || cleanLower.includes('kumusta') || cleanLower.includes('musta') || cleanLower.includes('magandang') || this.recognitionLang === 'fil-PH';
        const greetingText = isTagalog
          ? "Hello Sir! Mabuti naman po ako at nasa peak efficiency ang ating editing suites. Kumusta po kayo, Sir? Handa na po akong makipag-chitchat at tumulong sa inyong video."
          : "Hello Sir. Always a pleasure. All systems and editing suites are operating at peak efficiency. How may I assist your edit today, sir?";
        this.addChatMessage('user', rawText);
        this.addChatMessage('jarvis', greetingText);
        await this.speak(greetingText);
        return;
      }

      // 2. Conversational Assistant via Google Gemini / Gemma AI (Full Tagalog & English Chitchat)
      await this.askAI(rawText);
    }

    async askAI(prompt) {
      this.showVisualSpeechIndicator('Consulting neural core...');

      let responseText = "At your service, sir. Handa na po ang ating systems at neural models. Ano po ang maitutulong ko sa inyo, sir?";

      if (this.googleKey) {
        try {
          const recentHistory = this.chatHistory.slice(-6).map((turn) => `${turn.role === 'user' ? 'User' : 'JARVIS'}: ${turn.text}`).join('\n');

          const systemPrompt = `You are J.A.R.V.I.S., Tony Stark's witty, polite, sophisticated AI butler and master video editor assistant.
Always address the user as "Sir" or "sir".
You are completely bilingual and speak both Tagalog (Filipino / Taglish) and English fluently.
If the user talks to you in Tagalog or Taglish, understand them perfectly and reply in polite, natural, suave Tagalog or Taglish butler tone (e.g. "Mabuti naman po ako, Sir! Handa na po ang ating editing suite. Ano po ang maitutulong ko sa inyo ngayon?").
If they speak in English, reply in suave British English.
You love to chitchat, talk about their day, answer questions, make witty remarks, and help with their video editing (cuts, splits, visuals, B-rolls, captions).
Keep responses concise (1 to 2 sentences max) so it sounds natural when spoken aloud.
CRITICAL: Output ONLY your spoken response. Do not include thought processes, outlines, or bullet points.

Conversation Context:
${recentHistory}
User: ${prompt}
JARVIS:`;

          // Try Gemini 3.8 Flash first for pristine spoken response, then fallback to Gemma 4
          const modelsToTry = ['gemini-3.8-flash', 'gemma-4-26b-a4b-it'];
          let aiText = '';

          for (const model of modelsToTry) {
            try {
              const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${this.googleKey}`;
              const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  contents: [{ parts: [{ text: systemPrompt }] }],
                  generationConfig: {
                    temperature: 0.75,
                    maxOutputTokens: 300
                  }
                }),
                signal: AbortSignal.timeout(6500)
              });
              if (res.ok) {
                const data = await res.json();
                const rawCandidate = data.candidates?.[0]?.content?.parts?.[0]?.text;
                if (rawCandidate) {
                  aiText = rawCandidate;
                  break;
                }
              }
            } catch (err) {
              console.warn(`[JARVIS] Model ${model} query attempt failed:`, err);
            }
          }

          if (aiText) {
            let clean = aiText.trim();
            if (clean.includes('</thought>')) {
              clean = clean.split('</thought>')[1].trim();
            }
            const quotes = [...clean.matchAll(/["“]([^"”]{8,})["”]/g)];
            if (quotes.length > 0) {
              clean = quotes[quotes.length - 1][1].trim();
            } else {
              const lines = clean.split('\n')
                .map((l) => l.trim())
                .filter((l) => l &&
                  !l.startsWith('*') &&
                  !l.startsWith('-') &&
                  !l.startsWith('#') &&
                  !l.toLowerCase().startsWith('draft') &&
                  !l.toLowerCase().startsWith('option') &&
                  !l.toLowerCase().startsWith('persona') &&
                  !l.toLowerCase().startsWith('input') &&
                  !l.toLowerCase().startsWith('constraint') &&
                  !l.toLowerCase().startsWith('user:') &&
                  !l.toLowerCase().startsWith('jarvis:'));
              if (lines.length > 0) {
                clean = lines[lines.length - 1].replace(/^["'“]|["'”]$/g, '').trim();
              } else {
                clean = clean.replace(/[*#]/g, '').trim();
              }
            }
            if (clean) responseText = clean;
          }
        } catch (e) {
          console.warn('[JARVIS] AI query notice:', e);
        }
      }

      this.addChatMessage('user', prompt);
      this.addChatMessage('jarvis', responseText);
      await this.speak(responseText);
    }

    addChatMessage(role, text) {
      this.chatHistory.push({ role, text, time: new Date() });
      const container = document.getElementById('jarvisChatMessages');
      if (!container) return;

      const bubble = document.createElement('div');
      bubble.className = `jarvis-msg ${role === 'user' ? 'msg-user' : 'msg-jarvis'}`;
      bubble.innerHTML = `
        <div class="msg-author">${role === 'user' ? 'YOU' : 'JARVIS • AI BUTLER'}</div>
        <div class="msg-body">${this.escapeHtml(text)}</div>
      `;
      container.appendChild(bubble);
      container.scrollTop = container.scrollHeight;
    }

    escapeHtml(str) {
      return String(str).replace(/[&<>'"]/g, (tag) => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        "'": '&#39;',
        '"': '&quot;'
      }[tag] || tag));
    }
  }

  global.JarvisEngine = JarvisEngine;
  global.jarvis = new JarvisEngine();

  if (typeof window !== 'undefined') {
    window.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'j' || e.key === 'J')) {
        e.preventDefault();
        const modal = document.getElementById('jarvisModal');
        const hudBtn = document.getElementById('jarvisHudBtn');
        if (modal && modal.classList.contains('hidden') && hudBtn) {
          hudBtn.click();
        } else if (global.jarvis) {
          global.jarvis.toggleListening();
        }
      }
    });
  }

})(typeof window !== 'undefined' ? window : globalThis);
