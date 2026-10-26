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
  const DEFAULT_GOOGLE_KEY = (typeof localStorage !== 'undefined' && (localStorage.getItem('whop_google_api_key') || localStorage.getItem('whop_ai_api_key') || localStorage.getItem('whop_gemini_key') || localStorage.getItem('gemini_api_key') || localStorage.getItem('jarvis_google_key'))) || '';

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

      if (!this.googleKey && typeof fetch !== 'undefined') {
        fetch('/api/keys')
          .then((r) => r.json())
          .then((k) => {
            if (k && k.gemini_api_key) this.setGoogleKey(k.gemini_api_key);
            if (k && k.elevenlabs_api_key) this.setElevenKey(k.elevenlabs_api_key);
          })
          .catch(() => {});
      }

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

      // Attempt 2: High-Quality Web Speech API British Butler Voice
      if (!playedElevenLabs && this.speechSynth) {
        try {
          this.speechSynth.cancel();
          const utter = new SpeechSynthesisUtterance(text);
          if (this.selectedWebVoice) utter.voice = this.selectedWebVoice;
          // Crisp, suave British butler cadence (always English voice as user requested)
          utter.pitch = 0.92;
          utter.rate = 1.03;
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

    // Voice notifications for editor actions (Varied, intelligent English phrasing)
    notify(eventType, detail = '') {
      const pickRandom = (arr) => arr[Math.floor(Math.random() * arr.length)];
      switch (eventType) {
        case 'url-inspect':
          this.speak(pickRandom([
            "Scanning video link and audience retention heatmap, sir.",
            "Analyzing video URL and locating viral rewatch peaks, sir.",
            "Inspecting video metadata and viewer retention curves, sir."
          ]));
          break;
        case 'url-download':
          this.speak(pickRandom([
            "Downloading the viral highlight segment now, sir.",
            "Fetching the peak highlight clip directly, sir.",
            "Extracting the thirty-second retention peak, sir."
          ]));
          break;
        case 'url-transcribe':
          this.speak(pickRandom([
            "Transcribing native audio and aligning word-level captions, sir.",
            "Indexing voiceover speech and generating dynamic karaoke subtitles, sir.",
            "Transcribing audio with auto-language detection, sir."
          ]));
          break;
        case 'url-done':
          this.speak(pickRandom([
            "All done, sir! Your clip and accurate captions are ready on the timeline.",
            "Footage imported and synchronized, sir. Your workspace is ready.",
            "Process complete, sir. Timeline and karaoke subtitles are aligned."
          ]));
          break;
        case 'auto-edit-done':
          this.speak(pickRandom([
            "Auto-edit complete, sir. Viral moments indexed and captions synchronized.",
            "All done, sir. I have trimmed the highlight and formatted 9 by 16 vertical layout.",
            "Footage edited to peak engagement specifications, sir."
          ]));
          break;
        case 'split-done':
          this.speak(pickRandom([
            "Clip split at the playhead, sir.",
            "Partitioned cleanly at your current timestamp, sir.",
            "Cut completed, sir. Both segments are independent."
          ]));
          break;
        case 'gap-created':
          this.speak(pickRandom([
            "Timeline shifted, sir. Space reserved for your visual overlay.",
            "Gap created, sir. Ready for your image insertion.",
            "Space cleared on the timeline, sir."
          ]));
          break;
        case 'cut-deleted':
          this.speak(pickRandom([
            "Segment removed from the timeline, sir.",
            "Cut clip deleted, sir. Workspace updated.",
            "Segment excised as requested, sir."
          ]));
          break;
        case 'upload-done':
          this.speak(pickRandom([
            "Footage ingested and indexed, sir. Timeline ready.",
            "Video loaded and speech transcribed, sir."
          ]));
          break;
        case 'render-start':
          this.speak(pickRandom([
            "Render initiated, sir. Compiling your 1080p vertical short now.",
            "Export running, sir. Encoding with server-side FFmpeg acceleration."
          ]));
          break;
        case 'render-done':
          this.speak(pickRandom([
            "Your high-definition viral short is ready for download, sir.",
            "Export complete, sir! 1080p vertical video compiled successfully."
          ]));
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
        this.recognition.interimResults = true;
        this.recognition.lang = this.recognitionLang || 'fil-PH';

        const reactor = document.getElementById('jarvisReactor');
        if (reactor) reactor.classList.add('listening-active');
        this.isListening = true;
        this.showVisualSpeechIndicator('🎙️ Listening...');

        this.recognition.onresult = (event) => {
          let interim = '';
          let finalTranscript = '';
          for (let i = event.resultIndex; i < event.results.length; i++) {
            const res = event.results[i];
            if (res.isFinal) {
              finalTranscript += res[0].transcript;
            } else {
              interim += res[0].transcript;
            }
          }
          if (interim) {
            this.showVisualSpeechIndicator(`🎙️ ${interim}...`);
            if (typeof onTextCallback === 'function') onTextCallback(interim);
            return;
          }
          if (finalTranscript) {
            const transcript = finalTranscript.trim();
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
          }
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

    // Execute a single editor timeline manipulation action
    executeEditorAction(action) {
      if (!action || !action.action) return false;
      const type = action.action;
      const studio = window.WhopStudio;
      const state = window.WhopState;
      console.log('[JARVIS Action Executor] Executing action:', action);

      if (studio?.setSystemPulse) {
        studio.setSystemPulse(true);
        setTimeout(() => studio.setSystemPulse(false), 750);
      }

      // Trigger glowing arc reactor pulse animation
      const reactor = document.getElementById('jarvisReactor');
      if (reactor) {
        reactor.classList.add('glowing-active');
        setTimeout(() => reactor.classList.remove('glowing-active'), 1500);
      }

      switch (type) {
        case 'split': {
          const t = action.time !== undefined && action.time !== null ? Number(action.time) : null;
          if (studio?.splitClipAtPlayhead) {
            return studio.splitClipAtPlayhead(t);
          }
          break;
        }
        case 'delete': {
          if (studio?.deleteSelectedCapCutItem) {
            return studio.deleteSelectedCapCutItem();
          }
          break;
        }
        case 'add_text': {
          if (studio?.addTextLayer) {
            studio.addTextLayer(action.preset || 'heading', action.text || null);
            return true;
          }
          break;
        }
        case 'set_watermark': {
          if (studio?.setWatermark) {
            return studio.setWatermark(action.text || '', action.enabled !== false);
          }
          break;
        }
        case 'freeze_frame': {
          if (studio?.freezeFrameAtPlayhead) {
            return studio.freezeFrameAtPlayhead(Number(action.duration || 2.0));
          }
          break;
        }
        case 'jump_cuts': {
          if (studio?.applyAutoSilenceJumpCuts) {
            return studio.applyAutoSilenceJumpCuts();
          }
          break;
        }
        case 'aspect_ratio': {
          if (studio?.setCanvasAspectRatio) {
            studio.setCanvasAspectRatio(action.ratio || '9:16');
            return true;
          }
          break;
        }
        case 'undo': {
          if (studio?.undoAction) return studio.undoAction();
          break;
        }
        case 'redo': {
          if (studio?.redoAction) return studio.redoAction();
          break;
        }
        case 'set_layout': {
          const mode = action.mode || 'split-50-50';
          if (studio?.setLayoutMode) {
            return studio.setLayoutMode(mode);
          } else if (state) {
            state.layoutMode = mode;
            if (studio?.renderTimelineTracks) studio.renderTimelineTracks();
            return true;
          }
          break;
        }
        case 'set_broll': {
          const preset = action.preset || 'minecraft-parkour';
          if (studio?.setBrollPreset) {
            return studio.setBrollPreset(preset);
          } else if (state) {
            state.brollPreset = preset;
            if (studio?.renderTimelineTracks) studio.renderTimelineTracks();
            return true;
          }
          break;
        }
        case 'set_caption_style': {
          const style = action.style || 'hormozi-pop';
          if (studio?.setCaptionStyle) {
            return studio.setCaptionStyle(style);
          } else if (state) {
            state.captionStyle = style;
            if (studio?.renderTimelineTracks) studio.renderTimelineTracks();
            return true;
          }
          break;
        }
        case 'set_banner': {
          const text = action.text || '';
          if (studio?.setHookBanner) {
            return studio.setHookBanner(text);
          } else if (state) {
            state.hookBannerText = text;
            const bEl = document.getElementById('previewHookBanner');
            if (bEl) bEl.textContent = text.toUpperCase();
            return true;
          }
          break;
        }
        case 'seek': {
          const sec = Number(action.time || 0);
          if (studio?.seekToTime) {
            return studio.seekToTime(sec);
          }
          break;
        }
        case 'play': {
          if (studio?.playVideo) return studio.playVideo();
          const pBtn = document.getElementById('playPauseBtn');
          if (pBtn && !state?.isPlaying) pBtn.click();
          return true;
        }
        case 'pause': {
          if (studio?.pauseVideo) return studio.pauseVideo();
          const pBtn = document.getElementById('playPauseBtn');
          if (pBtn && state?.isPlaying) pBtn.click();
          return true;
        }
        case 'insert_image': {
          if (studio?.triggerVisualOverlayPicker) return studio.triggerVisualOverlayPicker();
          const inp = document.getElementById('visualOverlayFileInput');
          if (inp) { inp.click(); return true; }
          break;
        }
        case 'auto_edit': {
          if (studio?.runAutoEdit) return studio.runAutoEdit();
          const aBtn = document.getElementById('oneClickAutoEditBtn');
          if (aBtn) { aBtn.click(); return true; }
          break;
        }
        case 'client_prompt_edit': {
          const prompt = action.prompt || '';
          if (studio?.executeClientPromptEdit) {
            return studio.executeClientPromptEdit(prompt);
          }
          break;
        }
        case 'export': {
          if (studio?.openExportModal) return studio.openExportModal();
          const eBtn = document.getElementById('openExportModalBtn');
          if (eBtn) { eBtn.click(); return true; }
          break;
        }
        case 'highlight_zoom': {
          if (studio?.addHighlightZoomAtPlayhead) {
            return studio.addHighlightZoomAtPlayhead(action.scale || 1.24, action.duration || 1.6);
          }
          break;
        }
        case 'auto_curate': {
          if (studio?.runAiAutoCuration) {
            studio.runAiAutoCuration();
            return true;
          }
          break;
        }
        case 'translit': {
          if (studio?.applySubtitleTranslit) {
            if (action.bilingual !== undefined && studio.state) {
              studio.state.bilingualSubs = !!action.bilingual;
            }
            studio.applySubtitleTranslit(action.mode || 'taglish');
            return true;
          }
          break;
        }
        case 'add_sfx': {
          const sfx = action.sfx || 'whoosh';
          if (sfx === 'auto-sync' && studio?.autoSyncTimelineSfx) {
            studio.autoSyncTimelineSfx();
            return true;
          }
          if (studio?.addSfxEventAtTime) {
            studio.addSfxEventAtTime(sfx, studio.state?.currentTime || 0, true);
            return true;
          }
          break;
        }
        case 'face_track': {
          if (studio?.scanAndEnableFaceTracking && action.enabled !== false) {
            studio.scanAndEnableFaceTracking();
            return true;
          } else if (studio?.toggleFaceTracking) {
            studio.toggleFaceTracking(action.enabled);
            return true;
          }
          break;
        }
        case 'hook_title': {
          if (action.style && studio?.setHookTitleStyle) {
            studio.setHookTitleStyle(action.style);
          }
          if (action.text && studio?.setHookBanner) {
            studio.setHookBanner(action.text, true);
          } else if (studio?.generateAiHookSuggestions) {
            studio.generateAiHookSuggestions(true);
          }
          return true;
        }
        case 'add_vfx': {
          const vfx = action.vfx || 'speedLines';
          if (studio?.addTimedVfxAtPlayhead) {
            studio.addTimedVfxAtPlayhead(vfx);
            return true;
          }
          break;
        }
        case 'auto_broll': {
          if ((!action.topic || action.topic === 'auto') && studio?.autoInsertContextBroll) {
            studio.autoInsertContextBroll();
            return true;
          } else if (studio?.addBrollCutaway) {
            studio.addBrollCutaway(action.topic || 'money-counter', studio.state?.currentTime || 0, 2.6);
            return true;
          }
          break;
        }
        case 'viral_pack': {
          if (studio?.applyFullViralSuitePack) {
            studio.applyFullViralSuitePack();
            return true;
          }
          break;
        }
        default:
          console.warn('[JARVIS] Unknown action type:', type);
          return false;
      }
      return false;
    }

    executeActionList(actions) {
      if (!Array.isArray(actions) || actions.length === 0) return 0;
      let count = 0;
      for (const act of actions) {
        try {
          const ok = this.executeEditorAction(act);
          if (ok !== false) count++;
        } catch (e) {
          console.warn('[JARVIS] Error executing action:', act, e);
        }
      }
      return count;
    }

    // Process voice/chat command from user
    async handleUserCommand(rawText) {
      if (!rawText) return;
      const startTs = performance.now();
      const text = rawText.trim().toLowerCase();

      // 1. Extract and immediately execute fast local actions (< 10ms response)
      const localActions = [];

      // Undo / Redo
      if (text === 'undo' || text.includes('i-undo') || text.includes('ibalik')) {
        localActions.push({ action: 'undo' });
      } else if (text === 'redo' || text.includes('i-redo')) {
        localActions.push({ action: 'redo' });
      }

      // Add Text Layer ("T" Tool)
      if (text === 'add-text' || text.includes('add text') || text.includes('lagyan ng text') || text.includes('maglagay ng text')) {
        const txtMatch = rawText.match(/(?:add text|lagyan ng text|maglagay ng text)\s*[:"]?(.+?)["]?$/i);
        localActions.push({ action: 'add_text', preset: 'heading', text: txtMatch && txtMatch[1] ? txtMatch[1].trim() : null });
      }

      // Watermark Hide / Update
      if (text === 'hide-watermark' || ((text.includes('watermark') || text.includes('tag')) && (text.includes('hide') || text.includes('alisin') || text.includes('tanggalin') || text.includes('off')))) {
        localActions.push({ action: 'set_watermark', enabled: false });
      } else if (text.includes('show watermark') || text.includes('ibalik watermark')) {
        localActions.push({ action: 'set_watermark', enabled: true });
      }

      // Freeze Frame
      if (text === 'freeze' || text.includes('freeze frame') || text.includes('i-freeze')) {
        localActions.push({ action: 'freeze_frame', duration: 2.0 });
      }

      // Auto Silence Jump-Cuts
      if (text === 'jump-cuts' || text.includes('jump cut') || text.includes('cut silence') || text.includes('dead air')) {
        localActions.push({ action: 'jump_cuts' });
      }

      // Aspect Ratio
      if (text.includes('16:9') || text.includes('youtube landscape')) {
        localActions.push({ action: 'aspect_ratio', ratio: '16:9' });
      } else if (text.includes('1:1') || text.includes('square')) {
        localActions.push({ action: 'aspect_ratio', ratio: '1:1' });
      } else if (text.includes('9:16')) {
        localActions.push({ action: 'aspect_ratio', ratio: '9:16' });
      }

      // Split / Cut check
      if (text.includes('hatiin') || text.includes('hati') || text.includes('putulin') || text.includes('split') || text.includes('cut here') || text.includes('slice')) {
        const timeMatch = text.match(/(?:sa|at|to)\s*(\d+(?:\.\d+)?)\s*(?:s|sec|second|segundo)?/i);
        const splitTime = timeMatch ? Number(timeMatch[1]) : null;
        localActions.push({ action: 'split', time: splitTime });
      }

      // Delete cut / segment check
      if (!localActions.some((a) => a.action === 'set_watermark') && (text.includes('tanggalin') || text.includes('burahin') || text.includes('alisin') || text.includes('bura') || text.includes('delete') || text.includes('remove clip') || text.includes('remove cut'))) {
        localActions.push({ action: 'delete' });
      }

      // Playback controls
      if (text.includes('patugtugin') || text.includes('i-play') || text.includes('iplay') || text.includes('play') || text.includes('resume') || text.includes('start video')) {
        localActions.push({ action: 'play' });
      } else if (text.includes('ihinto') || text.includes('itigil') || text.includes('tigil') || text.includes('pause') || text.includes('stop')) {
        localActions.push({ action: 'pause' });
      }

      // Layout Modes
      if (text.includes('split 50') || text.includes('split screen') || text.includes('dalawang video') || text.includes('split layout')) {
        localActions.push({ action: 'set_layout', mode: 'split-50-50' });
      } else if (text.includes('split 60') || text.includes('top bottom')) {
        localActions.push({ action: 'set_layout', mode: 'split-60-40' });
      } else if (text.includes('full screen') || text.includes('buong screen') || text.includes('solo video') || text.includes('full main') || text.includes('isang video')) {
        localActions.push({ action: 'set_layout', mode: 'full-main' });
      } else if (text.includes('ambient') || text.includes('blur background')) {
        localActions.push({ action: 'set_layout', mode: 'ambient-blur' });
      }

      // B-Roll presets
      if (text.includes('minecraft')) {
        localActions.push({ action: 'set_broll', preset: 'minecraft-parkour' });
        if (!localActions.some((a) => a.action === 'set_layout')) {
          localActions.push({ action: 'set_layout', mode: 'split-50-50' });
        }
      } else if (text.includes('subway') || text.includes('surfer')) {
        localActions.push({ action: 'set_broll', preset: 'subway-surfers' });
        if (!localActions.some((a) => a.action === 'set_layout')) {
          localActions.push({ action: 'set_layout', mode: 'split-50-50' });
        }
      } else if (text.includes('slime') || text.includes('satisfying')) {
        localActions.push({ action: 'set_broll', preset: 'satisfying-slime' });
      }

      // Caption styles
      if (text.includes('hormozi') || (text.includes('caption') && text.includes('pop'))) {
        localActions.push({ action: 'set_caption_style', style: 'hormozi-pop' });
      } else if (text.includes('mrbeast') || (text.includes('caption') && text.includes('bold'))) {
        localActions.push({ action: 'set_caption_style', style: 'mrbeast-bold' });
      } else if (text.includes('neon') || text.includes('cyber') || (text.includes('caption') && text.includes('glow'))) {
        localActions.push({ action: 'set_caption_style', style: 'neon-cyber' });
      }

      // Seeking
      const seekMatch = text.match(/(?:seek to|jump to|go to|punta sa|punta|timestamp|segundo|second|sec)\s*(\d+(?:\.\d+)?)/i);
      if (seekMatch && seekMatch[1] && !text.includes('split') && !text.includes('hatiin')) {
        localActions.push({ action: 'seek', time: Number(seekMatch[1]) });
      }

      // Hook banner
      const hookMatch = rawText.match(/(?:change hook to|set banner to|set title to|palitan ang title sa|hook banner)\s*(.+)/i);
      if (hookMatch && hookMatch[1]) {
        localActions.push({ action: 'set_banner', text: hookMatch[1].trim() });
      }

      // Visual picture overlay
      if (text.includes('maglagay ng litrato') || text.includes('lagyan ng picture') || text.includes('lagay ng picture') || text.includes('add picture') || text.includes('add image') || text.includes('insert visual') || text.includes('picture')) {
        localActions.push({ action: 'insert_image' });
      }

      // Auto edit
      if (text.includes('auto edit') || text.includes('i-edit mo') || text.includes('make viral') || text.includes('edit video')) {
        localActions.push({ action: 'auto_edit' });
      }

      // Export / render
      if (text.includes('export') || text.includes('render') || text.includes('save video') || text.includes('i-download')) {
        localActions.push({ action: 'export' });
      }

      // Prompt Director / Client Brief
      if (text.includes('roam') || text.includes('client brief') || text.includes('traxnyc') || text.includes('content cake') || text.includes('prompt to edit') || text.includes('gayahin mo')) {
        localActions.push({ action: 'client_prompt_edit', prompt: rawText });
      }

      // 8-Feature Viral AI Pro Suite Fast Reflex Intents
      if (text.includes('viral pack') || text.includes('viral suite') || text.includes('8 engine') || text.includes('full viral')) {
        localActions.push({ action: 'viral_pack' });
      } else {
        if (text.includes('highlight zoom') || text.includes('punch zoom') || text.includes('auto zoom') || text.includes('zoom in')) {
          localActions.push({ action: 'highlight_zoom', scale: 1.25 });
        }
        if (text.includes('curate') || text.includes('auto curation') || text.includes('best clips')) {
          localActions.push({ action: 'auto_curate' });
        }
        if (text.includes('translit') || text.includes('taglish') || text.includes('bilingual') || text.includes('romanize')) {
          const mode = text.includes('romaji') ? 'romaji' : (text.includes('hinglish') ? 'hinglish' : (text.includes('spanish') ? 'es' : 'taglish'));
          localActions.push({ action: 'translit', mode, bilingual: text.includes('bilingual') || text.includes('dual') });
        }
        if (text.includes('sfx') || text.includes('whoosh') || text.includes('sound effect') || text.includes('ka-ching') || text.includes('bass drop')) {
          const sfx = (text.includes('auto') || text.includes('sync')) ? 'auto-sync'
            : (text.includes('cash') || text.includes('ching') ? 'cash'
            : (text.includes('bass') ? 'bass-drop'
            : (text.includes('pop') ? 'pop' : 'whoosh')));
          localActions.push({ action: 'add_sfx', sfx });
        }
        if (text.includes('face track') || text.includes('track face') || text.includes('speaker lock') || text.includes('follow face')) {
          localActions.push({ action: 'face_track', enabled: !text.includes('off') });
        }
        if (text.includes('hook title') || text.includes('ai hook') || text.includes('generate hook') || text.includes('kinetic slam')) {
          const style = text.includes('kinetic') ? 'kinetic-slam' : (text.includes('breaking') ? 'breaking-news' : 'hormozi-tape');
          localActions.push({ action: 'hook_title', style });
        }
        if (text.includes('vfx') || text.includes('speed lines') || text.includes('spotlight') || text.includes('impact flash')) {
          const vfx = text.includes('spot') ? 'spotlight' : (text.includes('impact') || text.includes('flash') ? 'impactFlash' : 'speedLines');
          localActions.push({ action: 'add_vfx', vfx });
        }
        if (text.includes('auto b-roll') || text.includes('insert b-roll') || text.includes('context b-roll') || text.includes('cutaway')) {
          localActions.push({ action: 'auto_broll', topic: 'auto' });
        }
      }

      // Execute local actions immediately
      if (localActions.length > 0) {
        this.executeActionList(localActions);
      }

      // If it's a simple direct command without conversational phrasing, give immediate fast confirmation
      const isSimpleCommand = (
        (text.length < 34 && localActions.length > 0) ||
        ['play', 'pause', 'split', 'hatiin', 'stop', 'delete', 'undo', 'redo', 'add-text', 'jump-cuts', 'freeze', 'hide-watermark'].includes(text)
      );

      if (isSimpleCommand && localActions.length > 0) {
        let msg = "It is done, sir.";
        const first = localActions[0];
        if (first.action === 'split') {
          msg = first.time ? `Split cut at ${first.time} seconds, sir.` : "Split cut at playhead, sir.";
        } else if (first.action === 'play') {
          msg = "Timeline playback started, sir.";
        } else if (first.action === 'pause') {
          msg = "Timeline playback paused, sir.";
        } else if (first.action === 'delete') {
          msg = "Removed selected element from your workspace, sir.";
        } else if (first.action === 'add_text') {
          msg = "Added a draggable, editable text layer onto your canvas, sir.";
        } else if (first.action === 'set_watermark') {
          msg = first.enabled === false ? "Creator watermark hidden from canvas, sir." : "Creator watermark restored, sir.";
        } else if (first.action === 'freeze_frame') {
          msg = "Inserted a two-second freeze frame at the playhead, sir.";
        } else if (first.action === 'jump_cuts') {
          msg = "Applied automatic silence jump-cuts across dead air intervals, sir.";
        } else if (first.action === 'undo') {
          msg = "Reverted your previous edit action, sir.";
        } else if (first.action === 'redo') {
          msg = "Restored your edit action, sir.";
        } else if (first.action === 'set_layout') {
          msg = `Switched layout to ${first.mode.replace('-', ' ')}, sir.`;
        } else if (first.action === 'set_broll') {
          msg = `Applied ${first.preset.replace('-', ' ')} gameplay footage, sir.`;
        } else if (first.action === 'set_caption_style') {
          msg = `Updated subtitle style to ${first.style.replace('-', ' ')}, sir.`;
        } else if (first.action === 'highlight_zoom') {
          msg = "Pinned a smooth highlight zoom punch at the playhead, sir.";
        } else if (first.action === 'auto_curate') {
          msg = "Running four-pillar AI virality curation across your footage, sir.";
        } else if (first.action === 'translit') {
          msg = `Transliterated your subtitles into ${first.mode}, sir.`;
        } else if (first.action === 'add_sfx') {
          msg = first.sfx === 'auto-sync' ? "Auto-synchronized studio sound effects across your timeline, sir." : `Pinned a ${first.sfx} sound effect onto the audio track, sir.`;
        } else if (first.action === 'face_track') {
          msg = "Locked AI speaker face tracking with one-euro camera stabilization, sir.";
        } else if (first.action === 'hook_title') {
          msg = "Generated high-retention curiosity hook titles and styled the banner, sir.";
        } else if (first.action === 'add_vfx') {
          msg = `Dropped a timed ${first.vfx} visual effect burst onto your timeline, sir.`;
        } else if (first.action === 'auto_broll') {
          msg = "Inserted context-aware AI B-roll cutaways across your timeline, sir.";
        } else if (first.action === 'viral_pack') {
          msg = "Activated the full eight-engine viral suite across your sequence, sir.";
        }
        const latencyMs = Math.max(1, Math.round(performance.now() - startTs));
        this.addChatMessage('user', rawText);
        this.addChatMessage('jarvis', msg, { actions: localActions, latencyMs, engine: 'OpenJarvis Local Reflex' });
        await this.speak(msg);
        return;
      }

      // 2. Real-Time Conversational AI (Full Tagalog/Taglish understanding, dynamic British English speech + AI actions)
      await this.askAI(rawText, localActions, startTs);
    }

    async askAI(prompt, alreadyExecuted = [], startTs = performance.now()) {
      this.showVisualSpeechIndicator('Consulting neural core...');
      if (window.WhopStudio?.setSystemPulse) window.WhopStudio.setSystemPulse(true);

      const dynamicFallbacks = [
        "At your service, sir. All neural engines and editing timelines are active. What would you like to create?",
        "Right here, sir. I am monitoring your timeline and ready for your next edit command.",
        "Always at your disposal, sir. How may I assist your video project today?",
        "Systems are primed and operational, sir. Tell me what needs to be cut, captioned, or styled.",
        "Listening intently, sir. Shall we work on the cuts, or perhaps inspect the captions?",
        "Standing by, sir. Let me know which direction you'd like to take this viral edit.",
        "Indeed, sir. Every tool in our editing suite is at your fingertips. What is your command?",
        "Delighted to assist, sir. Your footage is loaded and ready for our next creative move."
      ];
      let responseText = dynamicFallbacks[Math.floor(Math.random() * dynamicFallbacks.length)];
      let aiText = '';
      const executedTools = [...alreadyExecuted];

      // Step 1: Server-side accelerated query via /api/jarvis_chat (uses curl HTTP/2 with ~1.2s latency)
      try {
        const srvRes = await fetch('/api/jarvis_chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt: prompt,
            history: this.chatHistory,
            api_key: this.googleKey
          }),
          signal: AbortSignal.timeout(9000)
        });
        if (srvRes.ok) {
          const srvData = await srvRes.json();
          if (srvData && srvData.reply && srvData.reply.trim()) {
            aiText = srvData.reply.trim();
          }
          if (srvData && Array.isArray(srvData.actions) && srvData.actions.length > 0) {
            const newActions = srvData.actions.filter((a) =>
              !alreadyExecuted.some((ex) => ex.action === a.action)
            );
            if (newActions.length > 0) {
              this.executeActionList(newActions);
              executedTools.push(...newActions);
            }
          }
        }
      } catch (err) {
        console.warn('[JARVIS] Server chat notice, attempting direct endpoint fallback:', err);
      }

      // Step 2: Direct browser API query if server was unreachable
      if (!aiText && this.googleKey) {
        try {
          const recentHistory = this.chatHistory.slice(-6).map((turn) => `${turn.role === 'user' ? 'User' : 'JARVIS'}: ${turn.text}`).join('\n');
          const systemPrompt = `You are J.A.R.V.I.S., Tony Stark's witty, polite, sophisticated AI assistant and master video editor.
Always address the user as "Sir" or "sir".
You possess full interactive control over the user's CapCut Pro video editor timeline: you can split clips, delete layers, add editable text overlays ('add_text'), hide/update watermarks ('set_watermark'), insert freeze frames ('freeze_frame'), auto-cut silences ('jump_cuts'), undo/redo, switch layouts, layer B-rolls, insert clean PIP pictures, style captions, and trigger 1080p exports.
The user speaks to you in Tagalog (Filipino / Taglish) or English.
You understand Tagalog and Taglish 100% fluently.
CRITICAL MANDATE: You MUST ALWAYS speak and reply in fluent, suave British English.
Keep answers concise (1 to 2 spoken sentences) so it sounds like real-time voice speech.
OUTPUT FORMAT: You MUST return a single JSON object:
{"reply": "Your British spoken response here, sir.", "actions": []}
Do NOT include markdown fences, thoughts, or extra explanations outside JSON.

Conversation Context:
${recentHistory}
User: ${prompt}
JARVIS:`;

          const modelsToTry = ['gemini-3.5-flash-lite', 'gemini-3.5-flash', 'gemini-3.6-flash', 'gemma-4-26b-a4b-it'];
          for (const model of modelsToTry) {
            try {
              const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${this.googleKey}`;
              const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  contents: [{ parts: [{ text: systemPrompt }] }],
                  generationConfig: {
                    temperature: 0.7,
                    maxOutputTokens: 200
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
            } catch (mErr) {
              console.warn(`[JARVIS] Client query to ${model} notice:`, mErr);
            }
          }
        } catch (e) {
          console.warn('[JARVIS] AI client query notice:', e);
        }
      }

      if (aiText) {
        let clean = aiText.trim();
        if (clean.includes('</thought>')) {
          clean = clean.split('</thought>')[1].trim();
        }
        if (clean.startsWith('```json')) {
          clean = clean.split('```json')[1].split('```')[0].trim();
        } else if (clean.startsWith('```')) {
          clean = clean.split('```')[1].split('```')[0].trim();
        }

        try {
          const parsed = JSON.parse(clean);
          if (parsed && parsed.reply) {
            clean = parsed.reply;
            if (Array.isArray(parsed.actions) && parsed.actions.length > 0) {
              this.executeActionList(parsed.actions);
              executedTools.push(...parsed.actions);
            }
          }
        } catch (jsonErr) {
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
        }
        if (clean) responseText = clean;
      }

      if (window.WhopStudio?.setSystemPulse) window.WhopStudio.setSystemPulse(false);
      const latencyMs = Math.max(12, Math.round(performance.now() - startTs));
      this.addChatMessage('user', prompt);
      this.addChatMessage('jarvis', responseText, {
        actions: executedTools,
        latencyMs,
        engine: aiText ? 'OpenJarvis Neural Core' : 'OpenJarvis Fallback'
      });
      await this.speak(responseText);
    }

    addChatMessage(role, text, telemetry = null) {
      this.chatHistory.push({ role, text, time: new Date() });
      const container = document.getElementById('jarvisChatMessages');
      if (!container) return;

      let toolCardsHtml = '';
      if (telemetry && Array.isArray(telemetry.actions) && telemetry.actions.length > 0) {
        const badges = telemetry.actions.map((a) => `<code>⚡ ${this.escapeHtml(a.action)}</code>`).join(' ');
        toolCardsHtml = `
          <div class="jarvis-tool-card">
            <span class="jtc-status">✓ EXECUTED</span>
            <span class="jtc-tools">${badges}</span>
          </div>
        `;
      }
      let xrayHtml = '';
      if (telemetry && telemetry.latencyMs !== undefined) {
        xrayHtml = `
          <div class="jarvis-xray-footer">
            <span>🧠 ${this.escapeHtml(telemetry.engine || 'OpenJarvis')}</span>
            <span>⏱️ ${telemetry.latencyMs}ms</span>
          </div>
        `;
      }

      const bubble = document.createElement('div');
      bubble.className = `jarvis-msg ${role === 'user' ? 'msg-user' : 'msg-jarvis'}`;
      bubble.innerHTML = `
        <div class="msg-author">${role === 'user' ? 'YOU' : 'JARVIS • AI CO-DIRECTOR'}</div>
        <div class="msg-body">${this.escapeHtml(text)}</div>
        ${toolCardsHtml}
        ${xrayHtml}
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
