/**
 * AI Assistant AI Voice Butler Engine
 * Features:
 * - ElevenLabs Realistic Male Voice TTS (with British/American Butler presets)
 * - Seamless Web Speech API male fallback with British AI Assistant pitch/rate tuning
 * - Speech-to-Text Voice Recognition for hands-free video editing commands
 * - Google AI Integration (Gemma / Gemini 2.5/3.8) for intelligent conversational butler responses
 * - Futuristic Glowing Arc Reactor UI HUD with sound wave audio visualization
 * - Event-driven spoken notifications ("It's done", "Clip split at playhead")
 */
(function (global) {
  'use strict';

  // Default API keys can be supplied via localStorage or the AI Assistant settings UI
  const DEFAULT_ELEVEN_KEY = (typeof localStorage !== 'undefined' && localStorage.getItem('whop_elevenlabs_key')) || '';
  const DEFAULT_GOOGLE_KEY = (typeof localStorage !== 'undefined' && (localStorage.getItem('whop_google_api_key') || localStorage.getItem('whop_ai_api_key') || localStorage.getItem('whop_gemini_key') || localStorage.getItem('gemini_api_key') || localStorage.getItem('jarvis_google_key'))) || '';

  // Famous ElevenLabs Male Voices (George = British articulate butler, Adam = Deep authoritative, Callum = Crisp)
  const ELEVEN_VOICES = {
    'jarvis-british': { id: 'JBFqnCBsd6RMkjVDRZzb', name: 'George (British Butler / Classic AI Assistant)' },
    'jarvis-deep': { id: 'pNInz6obpgDQGcFmaJgB', name: 'Adam (Deep Authoritative Male)' },
    'jarvis-callum': { id: 'N2lVS1w4EtoT3dr4eOWO', name: 'Callum (Crisp Confident Male)' },
  };

  class JarvisEngine {
    constructor() {
      this.elevenKey = (typeof localStorage !== 'undefined' && localStorage.getItem('whop_elevenlabs_key')) || DEFAULT_ELEVEN_KEY;
      this.googleKey = (typeof localStorage !== 'undefined' && localStorage.getItem('whop_google_api_key')) || DEFAULT_GOOGLE_KEY;
      this.voicePreset = 'jarvis-british';
      this.recognitionLang = (typeof localStorage !== 'undefined' && localStorage.getItem('whop_jarvis_lang')) || 'fil-PH';
      this.voiceEnabled = false; // Silent AI Assistant: No spoken voice synthesis
      this.isSpeaking = false;
      this.isListening = false;
      this.currentAudio = null;
      this.recognition = null;
      this.chatHistory = [];
      this.speechSynth = typeof window !== 'undefined' ? window.speechSynthesis : null;
      this.selectedWebVoice = null;
      this.selectedFilipinoVoice = null;
      this.siriWave = null;
      this.silenceTimeoutMs = 2000;
      this.silenceInterval = null;
      this.silenceTimer = null;
      this.accumulatedTranscript = '';
      this.currentInterim = '';
      this._hasSubmittedCurrentUtterance = false;
      this._lastCommandText = '';
      this._lastCommandTime = 0;

      if (typeof localStorage !== 'undefined') {
        const savedDelay = localStorage.getItem('whop_jarvis_silence_delay');
        if (savedDelay) this.silenceTimeoutMs = parseInt(savedDelay, 10) || 2000;
      }

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
          const delaySelect = document.getElementById('jarvisSilenceDelaySelect');
          if (delaySelect) {
            delaySelect.value = String(this.silenceTimeoutMs);
            delaySelect.addEventListener('change', (e) => {
              this.setSilenceTimeout(e.target.value);
            });
          }
          const doneBtn = document.getElementById('jarvisDoneSpeakingBtn');
          if (doneBtn) {
            doneBtn.addEventListener('click', (e) => {
              e.preventDefault();
              this.finishListeningAndSubmit();
            });
          }
          const cancelBtn = document.getElementById('jarvisCancelListenBtn');
          if (cancelBtn) {
            cancelBtn.addEventListener('click', (e) => {
              e.preventDefault();
              this.cancelListening();
            });
          }
        });
      }
    }

    clearSilenceCountdown() {
      if (this.silenceTimer) {
        clearTimeout(this.silenceTimer);
        this.silenceTimer = null;
      }
      if (this.silenceInterval) {
        clearInterval(this.silenceInterval);
        this.silenceInterval = null;
      }
    }

    finishListeningAndSubmit(overrideText = null) {
      if (this._hasSubmittedCurrentUtterance) {
        console.log('[AI Assistant] Utterance already submitted; ignoring redundant finish call.');
        return;
      }
      this._hasSubmittedCurrentUtterance = true;

      this.clearSilenceCountdown();
      const timerBar = document.getElementById('jarvisListeningTimerBar');
      if (timerBar) timerBar.classList.add('hidden');

      const raw = overrideText !== null ? overrideText : (this.accumulatedTranscript + ' ' + (this.currentInterim || ''));
      const finalText = (raw || '').trim();

      // Clear accumulated buffers immediately so no secondary trigger can reuse them
      this.accumulatedTranscript = '';
      this.currentInterim = '';

      this.stopListening();
      if (finalText) {
        if (typeof this.onTextCallback === 'function') this.onTextCallback(finalText);
        this.handleUserCommand(finalText);
      }
    }

    cancelListening() {
      this._hasSubmittedCurrentUtterance = true;
      this.clearSilenceCountdown();
      const timerBar = document.getElementById('jarvisListeningTimerBar');
      if (timerBar) timerBar.classList.add('hidden');
      this.accumulatedTranscript = '';
      this.currentInterim = '';
      this.stopListening();
      this.showVisualSpeechIndicator('Cancelled');
      setTimeout(() => this.hideVisualSpeechIndicator(), 1200);
    }

    setSilenceTimeout(ms) {
      this.silenceTimeoutMs = Math.max(800, parseInt(ms, 10) || 2000);
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('whop_jarvis_silence_delay', String(this.silenceTimeoutMs));
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
        console.warn('[AI Assistant] SiriWave init notice:', e);
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
      // Completely silent: No voice speaking out loud
      this.isSpeaking = false;
      return;
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
            "Scanning video link and audience retention heatmap.",
            "Analyzing video URL and locating viral rewatch peaks.",
            "Inspecting video metadata and viewer retention curves."
          ]));
          break;
        case 'url-download':
          this.speak(pickRandom([
            "Downloading the viral highlight segment now.",
            "Fetching the peak highlight clip directly.",
            "Extracting the thirty-second retention peak."
          ]));
          break;
        case 'url-transcribe':
          this.speak(pickRandom([
            "Transcribing native audio and aligning word-level captions.",
            "Indexing voiceover speech and generating dynamic karaoke subtitles.",
            "Transcribing audio with auto-language detection."
          ]));
          break;
        case 'url-done':
          this.speak(pickRandom([
            "All done! Your clip and accurate captions are ready on the timeline.",
            "Footage imported and synchronized. Your workspace is ready.",
            "Process complete. Timeline and karaoke subtitles are aligned."
          ]));
          break;
        case 'auto-edit-done':
          this.speak(pickRandom([
            "Auto-edit complete. Viral moments indexed and captions synchronized.",
            "All done. I have trimmed the highlight and formatted 9 by 16 vertical layout.",
            "Footage edited to peak engagement specifications."
          ]));
          break;
        case 'split-done':
          this.speak(pickRandom([
            "Clip split at the playhead.",
            "Partitioned cleanly at your current timestamp.",
            "Cut completed. Both segments are independent."
          ]));
          break;
        case 'gap-created':
          this.speak(pickRandom([
            "Timeline shifted. Space reserved for your visual overlay.",
            "Gap created. Ready for your image insertion.",
            "Space cleared on the timeline."
          ]));
          break;
        case 'cut-deleted':
          this.speak(pickRandom([
            "Segment removed from the timeline.",
            "Cut clip deleted. Workspace updated.",
            "Segment excised as requested."
          ]));
          break;
        case 'upload-done':
          this.speak(pickRandom([
            "Footage ingested and indexed. Timeline ready.",
            "Video loaded and speech transcribed."
          ]));
          break;
        case 'render-start':
          this.speak(pickRandom([
            "Render initiated. Compiling your 1080p vertical short now.",
            "Export running. Encoding with server-side FFmpeg acceleration."
          ]));
          break;
        case 'render-done':
          this.speak(pickRandom([
            "Your high-definition viral short is ready for download.",
            "Export complete! 1080p vertical video compiled successfully."
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

        const delaySelect = document.getElementById('jarvisSilenceDelaySelect');
        if (delaySelect && delaySelect.value) {
          this.silenceTimeoutMs = parseInt(delaySelect.value, 10) || 2000;
        } else if (typeof localStorage !== 'undefined') {
          const savedDelay = localStorage.getItem('whop_jarvis_silence_delay');
          if (savedDelay) this.silenceTimeoutMs = parseInt(savedDelay, 10) || 2000;
        }

        this.recognition = new SpeechRec();
        this.recognition.continuous = true;
        this.recognition.interimResults = true;
        this.recognition.lang = this.recognitionLang || 'fil-PH';

        const reactor = document.getElementById('jarvisReactor');
        if (reactor) reactor.classList.add('listening-active');
        this.isListening = true;
        this._hasSubmittedCurrentUtterance = false;
        this.accumulatedTranscript = '';
        this.currentInterim = '';
        this.onTextCallback = onTextCallback;

        const timerBar = document.getElementById('jarvisListeningTimerBar');
        const statusEl = document.getElementById('jarvisListeningStatus');
        const countdownEl = document.getElementById('jarvisSilenceCountdown');
        const progressFill = document.getElementById('jarvisSilenceProgressBar');

        if (timerBar) timerBar.classList.remove('hidden');
        if (statusEl) statusEl.textContent = 'Listening... Speak naturally';
        if (countdownEl) countdownEl.textContent = `⏱️ ${(this.silenceTimeoutMs / 1000).toFixed(1)}s pause`;
        if (progressFill) progressFill.style.width = '100%';

        const resetSilenceCountdown = () => {
          this.clearSilenceCountdown();
          const duration = this.silenceTimeoutMs;
          const startTime = Date.now();
          if (statusEl) statusEl.textContent = 'Speaking detected... ⏱️';

          this.silenceInterval = setInterval(() => {
            const elapsed = Date.now() - startTime;
            const remainingMs = Math.max(0, duration - elapsed);
            const pct = Math.max(0, Math.min(100, (remainingMs / duration) * 100));
            if (countdownEl) {
              countdownEl.textContent = `⏱️ ${(remainingMs / 1000).toFixed(1)}s pause`;
            }
            if (progressFill) {
              progressFill.style.width = `${pct}%`;
            }
            if (remainingMs <= 0) {
              this.clearSilenceCountdown();
              this.finishListeningAndSubmit();
            }
          }, 40);
        };

        this.recognition.onresult = (event) => {
          let interim = '';
          let finalSegments = '';
          for (let i = 0; i < event.results.length; i++) {
            const res = event.results[i];
            if (res.isFinal) {
              finalSegments += res[0].transcript + ' ';
            } else {
              interim += res[0].transcript + ' ';
            }
          }
          this.accumulatedTranscript = finalSegments.trim();
          this.currentInterim = interim.trim();

          const candidate = (this.accumulatedTranscript + ' ' + this.currentInterim).trim();
          if (candidate) {
            this.showVisualSpeechIndicator(`🎙️ ${candidate}`);
            if (typeof onTextCallback === 'function') onTextCallback(candidate);
            resetSilenceCountdown();
          }
        };

        this.recognition.onerror = (e) => {
          console.warn('[AI Assistant] Speech recognition error event:', e);
          this.clearSilenceCountdown();
          if (timerBar) timerBar.classList.add('hidden');
          this.isListening = false;
          if (reactor) reactor.classList.remove('listening-active');
          if (this.siriWave) {
            try {
              this.siriWave.setSpeed(0.12);
              this.siriWave.setAmplitude(0.25);
            } catch (err) {}
          }
        };

        this.recognition.onend = () => {
          this.clearSilenceCountdown();
          if (timerBar) timerBar.classList.add('hidden');
          this.isListening = false;
          if (reactor) reactor.classList.remove('listening-active');
          if (this.siriWave) {
            try {
              this.siriWave.setSpeed(0.12);
              this.siriWave.setAmplitude(0.25);
            } catch (e) {}
          }
          if (!this._hasSubmittedCurrentUtterance) {
            const candidate = (this.accumulatedTranscript + ' ' + this.currentInterim).trim();
            if (candidate) {
              this.finishListeningAndSubmit(candidate);
            }
          }
        };

        this.recognition.start();
        return true;
      } catch (e) {
        console.warn('[AI Assistant] Recognition start error:', e);
        this.isListening = false;
        return false;
      }
    }

    stopListening() {
      this.isListening = false;
      if (typeof this.clearSilenceCountdown === 'function') {
        this.clearSilenceCountdown();
      }
      const timerBar = document.getElementById('jarvisListeningTimerBar');
      if (timerBar) timerBar.classList.add('hidden');

      if (this.recognition) {
        try {
          this.recognition.onend = null;
          this.recognition.stop();
        } catch (e) {}
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
      console.log('[AI Assistant Action Executor] Executing action:', action);

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

      const actionTaskId = `jarvis_${type}_${Date.now()}`;
      if (studio?.updateTaskChecklistStep && type !== 'auto_edit' && type !== 'viral_pack') {
        studio.updateTaskChecklistStep(actionTaskId, {
          status: 'running',
          name: `J.A.R.V.I.S.: ${action.label || type.replace(/_/g, ' ').toUpperCase()}`,
          properties: { Mode: 'Voice/AI Command' }
        });
      }

      let res = false;
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
        case 'set_broll_duration': {
          const d = Math.max(0.1, Number(action.duration) || 0.1);
          if (window.WhopState) {
            window.WhopState.customBrollDuration = d;
            if (Array.isArray(window.WhopState.brollClips)) {
              window.WhopState.brollClips.forEach(bc => bc.duration = d);
            }
          }
          const inp = document.getElementById('customBrollDurInput');
          if (inp) inp.value = d.toFixed(1);
          const chips = document.querySelectorAll('.broll-dur-preset-chip');
          chips.forEach(c => c.classList.toggle('active', Math.abs(parseFloat(c.dataset.dur) - d) < 0.05));
          if (studio?.renderTimelineTracks) studio.renderTimelineTracks();
          if (studio?.renderCanvasFrame) studio.renderCanvasFrame();
          if (typeof showToast === 'function') showToast(`⚡ B-Roll duration set to ${d}s!`, '#38bdf8', 3500);
          return true;
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
          if (window.runMasterOneClickAutoEdit) {
            window.runMasterOneClickAutoEdit();
            return true;
          }
          if (studio?.runMasterOneClickAutoEdit) {
            studio.runMasterOneClickAutoEdit();
            return true;
          }
          const aBtn = document.getElementById('oneClickAutoEditBtn') || document.getElementById('masterAutoEditBtn');
          if (aBtn) { aBtn.click(); return true; }
          break;
        }
        case 'translate_captions': {
          if (window.translateCaptionsWithGemini) {
            window.translateCaptionsWithGemini(action.lang || 'en');
            return true;
          }
          if (studio?.translateCaptionsWithGemini) {
            studio.translateCaptionsWithGemini(action.lang || 'en');
            return true;
          }
          const tBtn = document.getElementById('translateSubtitlesBtn');
          if (tBtn) { tBtn.click(); return true; }
          break;
        }
        case 'regenerate_captions': {
          // Trigger caption regeneration via API
          if (studio?.regenerateCaptions) {
            studio.regenerateCaptions(action.style || 'hormozi-pop', action.language);
            return true;
          }
          // Fallback: call API directly
          const currentVideo = state.customMainFileName || (dom.mainVideoEl?.src ? dom.mainVideoEl.src.split('/').pop() : '');
          if (currentVideo) {
            fetch('/api/regenerate_captions', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                filename: currentVideo,
                style: action.style || 'hormozi-pop',
                language: action.language || null,
                use_gemini_polish: true
              })
            }).then(r => r.json()).then(data => {
              if (data.success) {
                showToast(`✅ Captions regenerated with ${action.style || 'hormozi-pop'} style!`, '#10b981', 4000);
                // Reload the SRT if available
                if (data.srt_path && studio?.loadSRT) {
                  studio.loadSRT(data.srt_path);
                }
              } else {
                showToast(`❌ Caption regeneration failed: ${data.error}`, '#ef4444', 4000);
              }
            }).catch(() => showToast('❌ Caption regeneration error', '#ef4444'));
            return true;
          }
          break;
        }
        case 'auto_broll': {
          if (window.autoFetchPixabayBrollWithGemini) {
            window.autoFetchPixabayBrollWithGemini(true, true);
            return true;
          }
          if (studio?.autoFetchPixabayBrollWithGemini) {
            studio.autoFetchPixabayBrollWithGemini(true, true);
            return true;
          }
          const bBtn = document.getElementById('autoFetchPixabayBrollBtn') || document.getElementById('jarvisQuickBrollBtn');
          if (bBtn) { bBtn.click(); return true; }
          break;
        }
        case 'clear_broll': {
          if (studio?.clearAllBroll) return studio.clearAllBroll();
          if (state) {
            state.brollClips = [];
            if (studio?.renderContextBrollList) studio.renderContextBrollList();
            if (studio?.renderTimelineTracks) studio.renderTimelineTracks();
            if (studio?.renderCanvasFrame) studio.renderCanvasFrame();
            return true;
          }
          break;
        }
        case 'set_broll_mode': {
          const mode = action.mode || 'fullscreen';
          if (studio?.setBrollCutawayMode) return studio.setBrollCutawayMode(mode);
          break;
        }
        case 'ripple_trim_in': {
          if (studio?.rippleTrimIn) return studio.rippleTrimIn();
          const btn = document.getElementById('trimInBtn');
          if (btn) { btn.click(); return true; }
          break;
        }
        case 'ripple_trim_out': {
          if (studio?.rippleTrimOut) return studio.rippleTrimOut();
          const btn = document.getElementById('trimOutBtn');
          if (btn) { btn.click(); return true; }
          break;
        }
        case 'toggle_captions': {
          const enabled = typeof action.enabled === 'boolean' ? action.enabled : null;
          if (studio?.toggleCaptions) {
            return studio.toggleCaptions(enabled);
          } else if (state) {
            state.captionsEnabled = enabled !== null ? enabled : !state.captionsEnabled;
            if (!state.trackVisibility) state.trackVisibility = {};
            state.trackVisibility.captions = state.captionsEnabled;
            if (studio?.renderTimelineTracks) studio.renderTimelineTracks();
            if (studio?.renderCanvasFrame) studio.renderCanvasFrame();
            return true;
          }
          break;
        }
        case 'toggle_broll': {
          const enabled = typeof action.enabled === 'boolean' ? action.enabled : null;
          if (studio?.toggleBroll) {
            return studio.toggleBroll(enabled);
          } else if (state) {
            state.brollEnabled = enabled !== null ? enabled : !state.brollEnabled;
            if (!state.trackVisibility) state.trackVisibility = {};
            state.trackVisibility.broll = state.brollEnabled;
            state.trackVisibility.overlays = state.brollEnabled;
            if (studio?.renderTimelineTracks) studio.renderTimelineTracks();
            if (studio?.renderCanvasFrame) studio.renderCanvasFrame();
            return true;
          }
          break;
        }
        case 'toggle_master_video': {
          const enabled = typeof action.enabled === 'boolean' ? action.enabled : null;
          if (studio?.toggleMasterVideo) {
            return studio.toggleMasterVideo(enabled);
          } else if (state) {
            state.masterVideoEnabled = enabled !== null ? enabled : !state.masterVideoEnabled;
            if (!state.trackVisibility) state.trackVisibility = {};
            state.trackVisibility.video = state.masterVideoEnabled;
            state.trackVisibility.main = state.masterVideoEnabled;
            if (studio?.renderTimelineTracks) studio.renderTimelineTracks();
            if (studio?.renderCanvasFrame) studio.renderCanvasFrame();
            return true;
          }
          break;
        }
        case 'toggle_voice_audio': {
          const enabled = typeof action.enabled === 'boolean' ? action.enabled : null;
          if (studio?.toggleVoiceAudio) {
            return studio.toggleVoiceAudio(enabled);
          } else if (state) {
            const isMuted = enabled !== null ? !enabled : !state.sequence?.mainAudioMuted;
            if (!state.sequence) state.sequence = {};
            state.sequence.mainAudioMuted = isMuted;
            state.mainAudioMuted = isMuted;
            const v = document.getElementById('mainVideo');
            if (v) v.muted = isMuted;
            if (studio?.renderTimelineTracks) studio.renderTimelineTracks();
            return true;
          }
          break;
        }
        case 'ai_review': {
          if (studio?.reviewClipsWithAi) return studio.reviewClipsWithAi();
          const revBtn = document.getElementById('aiReviewClipsBtn');
          if (revBtn) { revBtn.click(); return true; }
          break;
        }
        case 'remove_zoom':
        case 'disable_face_zoom': {
          if (studio?.removeFaceZoom) {
            studio.removeFaceZoom();
            return true;
          }
          if (state) {
            state.disableFaceZoom = true;
            state.videoFitMode = 'fit';
            state.wholeScreenFit = true;
            state.faceTrackingEnabled = false;
            state.highlightZoomMode = 'off';
            state.highlightZoomScale = 1.0;
            state.highlightZooms = [];
            state.cameraZoom = 1.0;
            state.cameraPanX = 0;
            state.cameraPanY = 0;
            if (Array.isArray(state.sequence?.videoClips)) {
              state.sequence.videoClips.forEach(c => { c.zoom = 1.0; c.panX = 0; c.panY = 0; });
            }
            if (studio?.syncContextualInspector) studio.syncContextualInspector();
            if (studio?.renderTimelineTracks) studio.renderTimelineTracks();
            if (studio?.renderCanvasFrame) studio.renderCanvasFrame();
            return true;
          }
          break;
        }
        case 'extract_url': {
          const u = action.url;
          if (u) {
            const uInp = document.getElementById('streamUrlInput') || document.getElementById('urlInput');
            if (uInp) uInp.value = u;
            if (studio?.extractAndAutoEditUrl) {
              studio.extractAndAutoEditUrl(u);
              return true;
            }
          }
          break;
        }
        case 'apply_campaign_rules': {
          const camp = action.campaign;
          if (studio?.applyCampaignRules) {
            studio.applyCampaignRules(camp);
          }
          this.renderCampaignCardInChat(camp);
          return true;
        }
        case 'search_youtube':
        case 'online_search': {
          const q = action.query || action.channel || '@theschoolofhardknocks';
          if (typeof q === 'string' && (q.startsWith('http') || q.includes('youtu.be') || q.includes('youtube.com'))) {
            const uInp = document.getElementById('streamUrlInput') || document.getElementById('urlInput');
            if (uInp) uInp.value = q;
            if (studio?.extractAndAutoEditUrl) {
              studio.extractAndAutoEditUrl(q);
              return true;
            }
          }
          this.performOnlineYouTubeSearch(q);
          return true;
        }
        case 'search_pixabay': {
          const q = action.query || 'sports car';
          if (window.searchPixabayVideos) {
            window.searchPixabayVideos(q);
            return true;
          }
          if (studio?.searchPixabayVideos) {
            studio.searchPixabayVideos(q);
            return true;
          }
          const pInp = document.getElementById('pixabaySearchInput');
          if (pInp) pInp.value = q;
          const pBtn = document.getElementById('pixabaySearchBtn');
          if (pBtn) { pBtn.click(); return true; }
          break;
        }
        case 'set_screen_size': {
          const sz = action.size || 'small';
          if (window.setPreviewStageSize) {
            window.setPreviewStageSize(sz);
            return true;
          }
          const box = document.getElementById('previewCanvasBox');
          if (box) {
            box.classList.remove('stage-size-small', 'stage-size-fit', 'stage-size-large');
            box.classList.add(`stage-size-${sz}`);
            return true;
          }
          break;
        }
        case 'set_mode': {
          const campSel = document.getElementById('campaignSelect');
          if (campSel) {
            campSel.value = action.mode || 'universal';
            campSel.dispatchEvent(new Event('change'));
            return true;
          }
          break;
        }
        case 'whop_rules_check': {
          const rulesModal = document.getElementById('whopRulesModal');
          if (rulesModal) rulesModal.classList.remove('hidden');
          const campBox = document.querySelector('.campaign-rules-box');
          if (campBox) campBox.scrollIntoView({ behavior: 'smooth' });
          return true;
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
        case 'set_clipping_type': {
          const archType = action.archetype || 'reaction';
          if (studio?.setClippingType) {
            studio.setClippingType(archType, action.autoApply !== false);
            return true;
          }
          break;
        }
        case 'post_caption': {
          if (studio?.openExportModal) studio.openExportModal();
          const campSel = document.getElementById('postCampaignSelect');
          if (campSel && action.campaign) campSel.value = action.campaign;
          const platSel = document.getElementById('postPlatformSelect');
          if (platSel && action.platform) platSel.value = action.platform;
          if (studio?.generatePostCaption) {
            studio.generatePostCaption({ useAi: true });
            return true;
          }
          break;
        }
        case 'generate_social_captions': {
          // Trigger the Wayin.ai style social captions modal for the current clip
          const currentVideo = state.customMainFileName || (dom.mainVideoEl?.src ? dom.mainVideoEl.src.split('/').pop() : '');
          if (currentVideo && state.analysis && state.analysis.viralMoments && state.analysis.viralMoments.length > 0) {
            const clip = state.analysis.viralMoments[state.activeClipIndex || 0];
            if (clip) {
              generateClipSocialCaptions(clip, state.activeClipIndex || 0);
              return true;
            }
          }
          showToast('❌ No clip available for caption generation', '#ef4444');
          return true;
        }
        case 'post_timer': {
          if (studio?.startPostSubmitTimer) {
            studio.startPostSubmitTimer();
            return true;
          }
          const timerBtn = document.getElementById('postSubmitTimerBtn');
          if (timerBtn) {
            timerBtn.click();
            return true;
          }
          break;
        }
        case 'auto_pipeline': {
          const scheduleRailBtn = document.querySelector('.rail-btn[data-rail-tab="schedule"]');
          if (scheduleRailBtn) scheduleRailBtn.click();
          if (studio?.execute1ClickAutoPipeline) {
            studio.execute1ClickAutoPipeline();
            return true;
          }
          break;
        }
        case 'schedule_clip': {
          const scheduleRailBtn = document.querySelector('.rail-btn[data-rail-tab="schedule"]');
          if (scheduleRailBtn) scheduleRailBtn.click();
          if (studio?.scheduleCurrentActiveClip) {
            studio.scheduleCurrentActiveClip('next-peak');
            return true;
          }
          break;
        }
        default:
          console.warn('[AI Assistant] Unknown action type:', type);
          if (studio?.updateTaskChecklistStep) {
            studio.updateTaskChecklistStep(actionTaskId, {
              status: 'error',
              properties: { Reason: 'Unknown action type' }
            });
          }
          return false;
      }
      if (studio?.updateTaskChecklistStep && type !== 'auto_edit' && type !== 'viral_pack') {
        studio.updateTaskChecklistStep(actionTaskId, {
          status: 'done',
          properties: {
            Target: String(action.preset || action.text || action.style || action.mode || 'Timeline'),
            Status: 'Executed Successfully'
          }
        });
      }
      return true;
    }

    executeActionList(actions) {
      if (!Array.isArray(actions) || actions.length === 0) return 0;
      let count = 0;
      for (const act of actions) {
        try {
          const ok = this.executeEditorAction(act);
          if (ok !== false) count++;
        } catch (e) {
          console.warn('[AI Assistant] Error executing action:', act, e);
        }
      }
      return count;
    }

    // Process voice/chat command from user
    async handleUserCommand(rawText) {
      if (!rawText) return;
      const text = rawText.trim().toLowerCase();
      const now = Date.now();

      // Debounce duplicate submissions within 1500ms
      if (this._lastCommandText === text && (now - (this._lastCommandTime || 0)) < 1500) {
        console.warn('[AI Assistant] Suppressed duplicate command submission within 1.5s window:', text);
        return;
      }
      this._lastCommandText = text;
      this._lastCommandTime = now;

      const startTs = performance.now();

      // 0. Detect YouTube URL and/or Campaign Brief pasted directly into AI Assistant
      const ytUrlMatch = rawText.match(/https?:\/\/(?:www\.)?(?:youtube\.com\/(?:watch\?v=|shorts\/|live\/)|youtu\.be\/)[a-zA-Z0-9_\-]+(?:\S*)?/i);
      const videoUrl = ytUrlMatch ? ytUrlMatch[0] : null;

      const isCampaignBrief = (
        rawText.includes('WHAT YOU DO') ||
        rawText.includes('CLIPS THAT WORK') ||
        rawText.includes('KEEP IT HONEST') ||
        text.includes('school of hard knocks') ||
        (text.includes('bounty') && text.includes('requirements')) ||
        (text.includes('vertical clips') && text.includes('seconds'))
      );

      if (videoUrl || isCampaignBrief) {
        if (videoUrl) {
          const urlInput = document.getElementById('streamUrlInput') || document.getElementById('urlInput');
          if (urlInput) urlInput.value = videoUrl;
        }

        let parsedCamp = null;
        if (isCampaignBrief) {
          parsedCamp = {
            campaign_name: 'School of Hard Knocks',
            channel_handle: '@theschoolofhardknocks',
            source_url: 'https://youtube.com/@theschoolofhardknocks',
            target_duration_min: 20,
            target_duration_max: 60,
            credit_rule: '@theschoolofhardknocks',
            clips_criteria: [
              '"What do you do for a living?" and the answer that surprises',
              'The net worth reveal, the car, the house',
              'One sharp piece of advice from a millionaire',
              '"I started with $600…" type stories',
              'Funny or unexpected answers'
            ]
          };
          if (window.WhopStudio) {
            window.WhopStudio.applyCampaignRules(parsedCamp);
          }
          this.renderCampaignCardInChat(parsedCamp);
        }

        this.addChatMessage('user', rawText);

        // Query real Gemini AI via /api/jarvis_chat
        let aiSpokenReply = "";
        try {
          const srvRes = await fetch('/api/jarvis_chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              prompt: rawText,
              history: this.chatHistory,
              api_key: this.googleKey
            }),
            signal: AbortSignal.timeout(9000)
          });
          if (srvRes.ok) {
            const srvData = await srvRes.json();
            if (srvData && srvData.reply) {
              aiSpokenReply = srvData.reply;
            }
          }
        } catch (e) {
          console.warn('[AI Assistant] Chat query notice:', e);
        }

        if (!aiSpokenReply) {
          aiSpokenReply = isCampaignBrief
            ? (videoUrl
                ? "Understood! Ingesting the School of Hard Knocks campaign requirements: 20–60s vertical clips, zero face zoom (1.0x wide steady framing so both the interviewer and millionaire are 100% visible), strongest hook in the first 2 seconds, and @theschoolofhardknocks channel credit. I am now downloading and scanning this footage across the entire video timeline to find all candidate interview moments..."
                : "Understood! I have configured the School of Hard Knocks campaign parameters: 20–60s vertical framing, permanent zero face zoom, hook in first 2 seconds, and @theschoolofhardknocks credit. Ready for your video footage.")
            : `Understood! Extracting video from YouTube (${videoUrl}) and scanning the entire video timeline for candidate interview moments with zero face zoom...`;
        }

        this.addChatMessage('jarvis', aiSpokenReply, { engine: 'Gemini 2.5 Flash' });
        await this.speak(aiSpokenReply);

        if (videoUrl && window.WhopStudio?.extractAndAutoEditUrl) {
          window.WhopStudio.extractAndAutoEditUrl(videoUrl);
        }
        return;
      }

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

      // B-Roll Duration adjustment (e.g. "make b-roll 0.1s", "gawing 0.1s broll", "broll 0.1s", "set broll duration 0.1")
      const brollDurMatch = rawText.match(/(?:b-?roll|broll)\s*(?:duration|tagal)?\s*(?:to|na|ng|gawing)?\s*([0-9]+(?:\.[0-9]+)?)\s*(?:s|sec|seconds?)?/i) ||
                            rawText.match(/(?:set|gawing|make)\s*(?:ang\s*)?(?:b-?roll|broll)?\s*(?:to|na|ng)?\s*([0-9]+(?:\.[0-9]+)?)\s*(?:s|sec|seconds?)\s*(?:ang\s*)?(?:b-?roll|broll)?/i);
      if (brollDurMatch && (text.includes('broll') || text.includes('b-roll'))) {
        const dVal = Math.max(0.1, parseFloat(brollDurMatch[1]) || 0.1);
        localActions.push({ action: 'set_broll_duration', duration: dVal });
      }

      // Aspect Ratio
      if (text.includes('16:9') || text.includes('youtube landscape')) {
        localActions.push({ action: 'aspect_ratio', ratio: '16:9' });
      } else if (text.includes('1:1') || text.includes('square')) {
        localActions.push({ action: 'aspect_ratio', ratio: '1:1' });
      } else if (text.includes('9:16')) {
        localActions.push({ action: 'aspect_ratio', ratio: '9:16' });
      }

      // Video Preview Size (make small, fit, large)
      if (text.includes('small screen') || text.includes('make the screen small') || text.includes('make video small') || text.includes('liitan ang video') || text.includes('liitan mo') || text.includes('screens mall') || text.includes('compact screen') || text.includes('make it small')) {
        localActions.push({ action: 'set_screen_size', size: 'small' });
      } else if (text.includes('fit screen') || text.includes('normal screen') || text.includes('fit video')) {
        localActions.push({ action: 'set_screen_size', size: 'fit' });
      } else if (text.includes('large screen') || text.includes('lakihan ang video') || text.includes('big screen')) {
        localActions.push({ action: 'set_screen_size', size: 'large' });
      }

      // Universal All-Around Mode
      if (text.includes('all around') || text.includes('all-around') || text.includes('universal mode') || text.includes('general edit') || text.includes('lahat ng video')) {
        localActions.push({ action: 'set_mode', mode: 'universal' });
      }

      // Track On/Off Toggles (Captions, B-Roll, Master Video, Voice Audio)
      // Only execute if it's a short command (< 70 chars) to prevent false positives in conversation or prompts
      if (text.length < 70) {
        // 1. Captions On / Off
        if (/\b(?:captions?|subtitles?)\b/i.test(text)) {
          if (/\b(?:off|disable|patayin|tanggalin|alisin|hide|itago)\b/i.test(text)) {
            localActions.push({ action: 'toggle_captions', enabled: false });
          } else if (/\b(?:on|enable|buhayin|pakita|show|ibalik|buksan)\b/i.test(text)) {
            localActions.push({ action: 'toggle_captions', enabled: true });
          } else if (text === 'toggle caption' || text === 'toggle captions') {
            localActions.push({ action: 'toggle_captions' });
          }
        }

        // 2. B-Roll On / Off
        if (/\b(?:broll|b-roll|stock video)\b/i.test(text)) {
          if (/\b(?:off|disable|patayin|hide|itago)\b/i.test(text)) {
            localActions.push({ action: 'toggle_broll', enabled: false });
          } else if (/\b(?:on|enable|buhayin|pakita|show|ibalik|buksan)\b/i.test(text)) {
            localActions.push({ action: 'toggle_broll', enabled: true });
          } else if (text === 'toggle broll' || text === 'toggle b-roll') {
            localActions.push({ action: 'toggle_broll' });
          }
        }

        // 3. Master Video On / Off
        if (/\b(?:master video|main video|video layer)\b/i.test(text) || (/\b(?:video|camera)\b/i.test(text) && !text.includes('audio') && !text.includes('boses') && !text.includes('broll') && !text.includes('b-roll') && !text.includes('yt') && !text.includes('youtube'))) {
          if (/\b(?:off|disable|patayin|hide|itago|alisin ang video|tanggalin ang video)\b/i.test(text)) {
            localActions.push({ action: 'toggle_master_video', enabled: false });
          } else if (/\b(?:on|enable|buhayin|pakita|show|ibalik ang video|buksan ang video)\b/i.test(text)) {
            localActions.push({ action: 'toggle_master_video', enabled: true });
          } else if (text === 'toggle video' || text === 'toggle master video') {
            localActions.push({ action: 'toggle_master_video' });
          }
        }

        // 4. Voice Audio On / Off (Mute / Unmute)
        if (/\b(?:voice|boses|audio|tunog)\b/i.test(text)) {
          if (/\b(?:off|mute|disable|patayin|tahimik|pipi|alisin ang boses|tanggalin ang boses)\b/i.test(text)) {
            localActions.push({ action: 'toggle_voice_audio', enabled: false });
          } else if (/\b(?:on|unmute|enable|buhayin|ibalik|marinig|palakasin)\b/i.test(text)) {
            localActions.push({ action: 'toggle_voice_audio', enabled: true });
          } else if (text === 'toggle audio' || text === 'toggle voice') {
            localActions.push({ action: 'toggle_voice_audio' });
          }
        }
      }

      // Split / Cut check
      if (text.includes('hatiin') || text.includes('hati') || text.includes('putulin') || text.includes('split') || text.includes('cut here') || text.includes('slice')) {
        const timeMatch = text.match(/(?:sa|at|to)\s*(\d+(?:\.\d+)?)\s*(?:s|sec|second|segundo)?/i);
        const splitTime = timeMatch ? Number(timeMatch[1]) : null;
        localActions.push({ action: 'split', time: splitTime });
      }

      // Delete cut / segment check
      if (!localActions.some((a) => ['set_watermark', 'toggle_captions', 'toggle_broll', 'toggle_master_video', 'toggle_voice_audio'].includes(a.action)) && (text.includes('tanggalin') || text.includes('burahin') || text.includes('alisin') || text.includes('bura') || text.includes('delete') || text.includes('remove clip') || text.includes('remove cut'))) {
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

      // Post Caption & Hashtag Generator (US/UK audience + Kai Cenat campaign)
            if (text.includes('generate social media caption') || text.includes('generate social media captions') || text.includes('generate social caption') || text.includes('generate social captions') || text.includes('social media caption') || text.includes('social media captions') || text.includes('ai caption') || text.includes('caption for tiktok') || text.includes('caption for shorts') || text.includes('caption for reels') || text.includes('caption for twitter') || text.includes('hashtag generator') || text.includes('generate hashtags') || text.includes('social caption') || text.includes('multi-platform caption') || text.includes('social media caption') || text.includes('generate social media caption') || text.includes('caption generator') || text.includes('generate social captions') || text.includes('generate social media captions')) {
              localActions.push({ action: 'generate_social_captions' });
            } else if (text.includes('kai cenat caption') || text.includes('post caption') || text.includes('us caption') || text.includes('gumawa ng caption') || text.includes('caption generator') || text.includes('caption at hashtag') || text.includes('hashtag') || text.includes('hashtags')) {
              const campaign = (text.includes('generic') || text.includes('general')) ? 'generic' : 'kai-cenat';
              const platform = text.includes('shorts') ? 'shorts' : (text.includes('reels') ? 'reels' : 'tiktok');
              localActions.push({ action: 'post_caption', campaign, platform });
            } else if (text.includes('submit timer') || text.includes('posted') || text.includes('30 min') || text.includes('nag post na') || text.includes('start timer')) {
              localActions.push({ action: 'post_timer' });
      } else if (text.includes('auto assemble') || text.includes('assemble all') || text.includes('gawin mo lahat') || text.includes('assemble everything') || text.includes('full auto pipeline') || text.includes('auto pipeline') || text.includes('auto publish')) {
        localActions.push({ action: 'auto_pipeline' });
      } else if (text.includes('schedule upload') || text.includes('i-schedule') || text.includes('schedule clip') || text.includes('schedule post') || text.includes('upload queue') || text.includes('schedule studio')) {
        localActions.push({ action: 'schedule_clip' });
      }

      // Prompt Director / Client Brief
      if (text.includes('roam') || text.includes('client brief') || text.includes('traxnyc') || text.includes('content cake') || text.includes('prompt to edit') || text.includes('gayahin mo')) {
        localActions.push({ action: 'client_prompt_edit', prompt: rawText });
      }

      // Clipping Archetypes Fast Reflex Intents (KosherPlug UGC Course: reaction, gaming, top-moments, text-on-screen)
      if (text.includes('reaction') || text.includes('reactor') || text.includes('facecam split')) {
        localActions.push({ action: 'set_clipping_type', archetype: 'reaction', autoApply: true });
      } else if (text.includes('gaming') || text.includes('gameplay clip') || text.includes('gamer style') || text.includes('game play')) {
        localActions.push({ action: 'set_clipping_type', archetype: 'gaming', autoApply: true });
      } else if (text.includes('top moment') || text.includes('top moments') || text.includes('top 3') || text.includes('top three') || text.includes('countdown clip')) {
        localActions.push({ action: 'set_clipping_type', archetype: 'top-moments', autoApply: true });
      } else if (text.includes('text on screen') || text.includes('text-on-screen') || text.includes('story time') || text.includes('storytime') || text.includes('silent clip') || text.includes('text onscreen')) {
        localActions.push({ action: 'set_clipping_type', archetype: 'text-on-screen', autoApply: true });
      } else if (text.includes('car phonk') || text.includes('car edit') || text.includes('drift edit') || text.includes('beat edit') || text.includes('cut sa beat') || text.includes('beat sync') || text.includes('music edit') || text.includes('phonk edit') || text.includes('bass drop edit') || text.includes('music clip') || text.includes('phonk') || text.includes('kotse') || text.includes('drift')) {
        localActions.push({ action: 'set_clipping_type', archetype: 'music-edit', autoApply: true });
      }

      // OpenChatCut & autobroll Comprehensive B-Roll Actions
      if (text.includes('broll') || text.includes('b-roll') || text.includes('b roll') || text.includes('stock video') || text.includes('stock footage') || text.includes('stock clip') || text.includes('cutaway')) {
        if (text.includes('alisin') || text.includes('tanggalin') || text.includes('burahin') || text.includes('clear') || text.includes('delete') || text.includes('remove')) {
          localActions.push({ action: 'clear_broll' });
        } else if (text.includes('mode') || text.includes('inset') || text.includes('pip') || text.includes('top') || text.includes('fullscreen')) {
          const m = (text.includes('inset') || text.includes('pip')) ? 'inset' : (text.includes('top') ? 'top' : 'fullscreen');
          localActions.push({ action: 'set_broll_mode', mode: m });
        } else if (text.includes('search') || text.includes('hanap') || text.includes('maghanap')) {
          const qMatch = rawText.match(/(?:search|hanap|maghanap|kuha|kumuha)\s*(?:ng|for|of)?\s*(?:broll|b-roll|b roll|stock video)?\s*(?:about|tungkol sa|na|ng)?\s*[:"]?(.+?)["]?$/i);
          const query = qMatch && qMatch[1] ? qMatch[1].trim() : 'sports car';
          localActions.push({ action: 'search_pixabay', query });
        } else {
          localActions.push({ action: 'auto_broll' });
        }
      }

      // ========================================================================
      // TOPIC-AWARE B-ROLL DETECTION (Enhanced for god/christian, money, sad, gaming, etc.)
      // ========================================================================
      const BROLL_TOPIC_KEYWORDS = {
        'god-christian': {
          keywords: ['god', 'jesus', 'christ', 'lord', 'faith', 'prayer', 'blessing', 'blessed', 'holy', 'bible', 'scripture', 'worship', 'church', 'gospel', 'amen', 'hallelujah', 'praise', 'salvation', 'heaven', 'divine', 'spirit', 'grace', 'miracle', 'testimony', 'anointed', 'providence', 'almighty', 'savior', 'redemption', 'cross', 'catholic', 'christian', 'pastor', 'priest', 'bishop', 'ministry', 'sermon', 'verse', 'psalm', 'proverb'],
          pixabayQueries: ['prayer worship', 'church interior', 'bible open', 'cross sunset', 'holy light', 'faith hands praying', 'spiritual meditation', 'gospel choir', 'heavenly light rays'],
          unsplashQueries: ['prayer', 'church', 'bible', 'cross', 'faith', 'worship', 'spiritual', 'holy', 'blessing']
        },
        'money-wealth': {
          keywords: ['money', 'cash', 'dollar', 'million', 'billion', 'wealth', 'rich', 'income', 'profit', 'revenue', 'business', 'entrepreneur', 'startup', 'investment', 'stocks', 'crypto', 'bitcoin', 'trading', 'financial', 'finance', 'bank', 'net worth', 'earnings', 'salary', 'paycheck', 'commission', 'royalty', 'passive income', 'side hustle', 'freelance', 'ecommerce', 'dropshipping', 'amazon fba', 'shopify', 'affiliate', 'course sales', 'coaching', 'consulting', 'real estate', 'property', 'rental', 'flip'],
          pixabayQueries: ['money counting', 'cash stack', 'wealth luxury', 'business meeting', 'stock market chart', 'gold bars', 'dollar bills', 'financial growth', 'entrepreneur success'],
          unsplashQueries: ['money', 'cash', 'wealth', 'business', 'finance', 'entrepreneur', 'success', 'luxury', 'investment']
        },
        'sad-emotional': {
          keywords: ['sad', 'cry', 'crying', 'tears', 'heartbreak', 'breakup', 'loss', 'grief', 'depression', 'anxiety', 'lonely', 'alone', 'pain', 'hurt', 'suffering', 'struggle', 'hard time', 'difficult', 'tragic', 'devastated', 'broken', 'empty', 'hopeless', 'despair', 'sorrow', 'mourning', 'funeral', 'death', 'died', 'passed away', 'goodbye', 'miss you', 'regret', 'mistake', 'failed', 'failure', 'give up', 'tired', 'exhausted', 'burnout', 'overwhelmed'],
          pixabayQueries: ['sad person', 'crying woman', 'lonely silhouette', 'rain window', 'emotional moment', 'heartbreak', 'grief support', 'dark clouds', 'melancholy atmosphere'],
          unsplashQueries: ['sad', 'crying', 'lonely', 'rain', 'emotional', 'grief', 'heartbreak', 'melancholy', 'solitude']
        },
        'gaming-esports': {
          keywords: ['game', 'gaming', 'gamer', 'play', 'playing', 'stream', 'streamer', 'twitch', 'youtube gaming', 'esports', 'tournament', 'competitive', 'ranked', 'clutch', 'ace', 'pentakill', 'victory', 'defeat', 'fps', 'moba', 'battle royale', 'warzone', 'valorant', 'league of legends', 'lol', 'dota', 'csgo', 'counter strike', 'apex', 'fortnite', 'minecraft', 'roblox', 'genshin', 'elden ring', 'dark souls', 'speedrun', 'world record', 'glitch', 'bug', 'patch', 'update', 'dlc', 'season', 'battle pass', 'skin', 'cosmetic', 'loot', 'drop', 'chest', 'raid', 'dungeon', 'boss', 'level up', 'xp', 'grind', 'farm'],
          pixabayQueries: ['gaming setup', 'rgb keyboard', 'esports arena', 'gamer hands', 'neon gaming', 'twitch stream', 'gaming chair', 'mechanical keyboard', 'gaming monitor'],
          unsplashQueries: ['gaming', 'gamer', 'esports', 'streamer', 'rgb', 'neon', 'keyboard', 'gaming setup', 'video game']
        },
        'motivation-success': {
          keywords: ['motivation', 'motivated', 'inspire', 'inspiring', 'success', 'successful', 'achieve', 'achievement', 'goal', 'goals', 'dream', 'dreams', 'hustle', 'grind', 'work hard', 'discipline', 'consistency', 'habit', 'routine', 'mindset', 'growth', 'progress', 'improve', 'better', 'best', 'champion', 'winner', 'win', 'victory', 'overcome', 'obstacle', 'challenge', 'adversity', 'resilience', 'persistence', 'determination', 'focus', 'dedication', 'commitment', 'sacrifice', 'delayed gratification', 'long term', 'vision', 'purpose', 'why', 'legacy', 'impact', 'change the world'],
          pixabayQueries: ['motivation quote', 'success celebration', 'mountain climbing', 'sunrise achievement', 'business handshake', 'team victory', 'goal setting', 'growth chart', 'champion mindset'],
          unsplashQueries: ['motivation', 'success', 'achievement', 'mountain', 'sunrise', 'victory', 'growth', 'champion', 'inspiration']
        },
        'tech-ai': {
          keywords: ['ai', 'artificial intelligence', 'machine learning', 'ml', 'deep learning', 'neural network', 'llm', 'gpt', 'claude', 'gemini', 'chatgpt', 'openai', 'anthropic', 'google', 'microsoft', 'nvidia', 'cuda', 'gpu', 'tpu', 'training', 'inference', 'prompt', 'prompting', 'fine-tune', 'rag', 'vector database', 'embedding', 'transformer', 'attention', 'generative', 'diffusion', 'stable diffusion', 'midjourney', 'dall-e', 'code', 'coding', 'programming', 'developer', 'software', 'engineer', 'github', 'git', 'api', 'sdk', 'framework', 'react', 'vue', 'nextjs', 'python', 'javascript', 'typescript', 'rust', 'go', 'docker', 'kubernetes', 'cloud', 'aws', 'azure', 'gcp', 'serverless', 'microservices', 'database', 'sql', 'nosql', 'redis', 'postgresql', 'mongodb'],
          pixabayQueries: ['artificial intelligence', 'neural network', 'coding screen', 'data center', 'futuristic technology', 'robot hand', 'hologram interface', 'quantum computing', 'cyber security'],
          unsplashQueries: ['ai', 'technology', 'coding', 'programming', 'artificial intelligence', 'robot', 'futuristic', 'data', 'innovation']
        },
        'fitness-health': {
          keywords: ['gym', 'workout', 'exercise', 'fitness', 'muscle', 'bodybuilding', 'powerlifting', 'weightlifting', 'cardio', 'running', 'marathon', 'sprint', 'hiit', 'crossfit', 'calisthenics', 'pull up', 'push up', 'squat', 'deadlift', 'bench press', 'protein', 'creatine', 'pre-workout', 'bulk', 'cut', 'shred', 'abs', 'six pack', 'physique', 'aesthetic', 'natty', 'steroid', 'natural', 'diet', 'nutrition', 'macro', 'calorie', 'deficit', 'surplus', 'meal prep', 'intermittent fasting', 'keto', 'carnivore', 'vegan', 'supplement', 'recovery', 'sleep', 'mobility', 'stretch', 'yoga', 'pilates'],
          pixabayQueries: ['gym workout', 'fitness motivation', 'muscle training', 'running track', 'healthy food', 'protein shake', 'weight lifting', 'yoga pose', 'athletic performance'],
          unsplashQueries: ['gym', 'fitness', 'workout', 'muscle', 'running', 'healthy', 'nutrition', 'protein', 'athlete']
        },
        'travel-lifestyle': {
          keywords: ['travel', 'trip', 'vacation', 'holiday', 'flight', 'airport', 'hotel', 'resort', 'beach', 'island', 'mountain', 'city', 'country', 'passport', 'visa', 'backpack', 'luggage', 'adventure', 'explore', 'discover', 'culture', 'food', 'cuisine', 'restaurant', 'street food', 'local', 'authentic', 'hidden gem', 'bucket list', 'wanderlust', 'nomad', 'digital nomad', 'remote work', 'work from anywhere', 'airbnb', 'hostel', 'road trip', 'drive', 'scenic', 'view', 'sunset', 'sunrise', 'landscape', 'nature', 'wildlife', 'safari', 'hike', 'trek', 'camp', 'camping', 'glamping'],
          pixabayQueries: ['travel destination', 'beach paradise', 'mountain landscape', 'city skyline', 'airport terminal', 'luxury hotel', 'street food market', 'scenic drive', 'adventure travel'],
          unsplashQueries: ['travel', 'beach', 'mountain', 'city', 'landscape', 'adventure', 'vacation', 'wanderlust', 'digital nomad']
        },
        'education-learning': {
          keywords: ['learn', 'learning', 'study', 'studying', 'course', 'class', 'lesson', 'tutorial', 'guide', 'how to', 'step by step', 'explain', 'understand', 'knowledge', 'skill', 'skills', 'master', 'mastery', 'expert', 'beginner', 'advanced', 'certification', 'degree', 'university', 'college', 'school', 'education', 'teacher', 'professor', 'mentor', 'coach', 'training', 'workshop', 'bootcamp', 'curriculum', 'syllabus', 'assignment', 'homework', 'exam', 'test', 'quiz', 'grade', 'pass', 'fail', 'study tips', 'productivity', 'focus', 'concentration', 'memory', 'retention', 'note taking', 'active recall', 'spaced repetition'],
          pixabayQueries: ['online learning', 'student studying', 'online course', 'educational video', 'teacher classroom', 'books library', 'knowledge sharing', 'skill development', 'certification'],
          unsplashQueries: ['learning', 'study', 'education', 'books', 'knowledge', 'student', 'teacher', 'course', 'skill']
        },
        'comedy-funny': {
          keywords: ['funny', 'hilarious', 'laugh', 'laughing', 'lol', 'lmao', 'rofl', 'joke', 'meme', 'comedy', 'comedian', 'skit', 'sketch', 'prank', 'troll', 'roast', 'burn', 'savage', 'witty', 'humor', 'humorous', 'entertaining', 'viral', 'trending', 'internet', 'social media', 'tiktok', 'reels', 'shorts', 'reaction', 'react', 'response', 'commentary', 'review', 'rating', 'tier list', 'ranking', 'vs', 'versus', 'comparison', 'which is better', 'best', 'worst', 'overrated', 'underrated'],
          pixabayQueries: ['laughing people', 'comedy show', 'funny reaction', 'entertainment', 'viral video', 'social media content', 'happy group', 'stand up comedy', 'improv theater'],
          unsplashQueries: ['funny', 'laugh', 'comedy', 'entertainment', 'happy', 'joy', 'humor', 'viral', 'reaction']
        }
      };

      // Function to detect topic from transcript/text
      function detectBrollTopic(text) {
        if (!text) return 'general';
        const lowerText = text.toLowerCase();
        let bestTopic = 'general';
        let bestScore = 0;

        for (const [topic, data] of Object.entries(BROLL_TOPIC_KEYWORDS)) {
          let score = 0;
          for (const keyword of data.keywords) {
            const regex = new RegExp('\\b' + keyword.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&') + '\\b', 'i');
            const matches = (lowerText.match(regex) || []).length;
            score += matches * (keyword.length > 8 ? 3 : keyword.length > 5 ? 2 : 1);
          }
          if (score > bestScore) {
            bestScore = score;
            bestTopic = topic;
          }
        }
        return bestScore > 0 ? bestTopic : 'general';
      }

      // Expose globally for use in auto_broll
      window.detectBrollTopic = detectBrollTopic;
      window.BROLL_TOPIC_KEYWORDS = BROLL_TOPIC_KEYWORDS;

      // Trimming Reflexes
      if (text.includes('trim in') || text.includes('ripple trim in') || text.includes('alisin ang simula') || text.includes('cut before playhead')) {
        localActions.push({ action: 'ripple_trim_in' });
      } else if (text.includes('trim out') || text.includes('ripple trim out') || text.includes('alisin ang dulo') || text.includes('cut after playhead')) {
        localActions.push({ action: 'ripple_trim_out' });
      }

      // AI Clip & Heatmap Review
      if (text.includes('review clip') || text.includes('review video') || text.includes('ai review') || text.includes('surisuriin') || text.includes('i-review') || text.includes('score this') || text.includes('kamusta ang video')) {
        localActions.push({ action: 'ai_review' });
      }

      // Subtitle visibility toggle
      if (text.includes('hide caption') || text.includes('hide subtitle') || text.includes('alisin ang subtitle') || text.includes('tanggalin ang subtitle') || text.includes('off captions')) {
        localActions.push({ action: 'toggle_captions', enabled: false });
      } else if (text.includes('show caption') || text.includes('show subtitle') || text.includes('ibalik ang subtitle') || text.includes('on captions')) {
        localActions.push({ action: 'toggle_captions', enabled: true });
      }

      if (text.includes('translate') || text.includes('translation') || text.includes('salin') || text.includes('isalin') || text.includes('us english') || text.includes('uk english') || text.includes('english captions') || text.includes('subtitles english')) {
        localActions.push({ action: 'translate_captions', lang: 'en' });
      }

      // Caption Regeneration (AI Re-transcribe + Polish from voice audio)
      if (
        text.includes('regenerate caption') || text.includes('regenerate subtitle') ||
        text.includes('retranscribe') || text.includes('re-transcribe') ||
        text.includes('regenerate caption') || text.includes('regenerate sub') ||
        text.includes('ai caption') || text.includes('polish caption') ||
        text.includes('regenerate caption') || text.includes('fix caption') ||
        text.includes('improve caption') || text.includes('enhance caption') ||
        (text.includes('caption') && (text.includes('regenerate') || text.includes('redo') || text.includes('ibalik') || text.includes('gawin ulit')))
      ) {
        localActions.push({ action: 'regenerate_captions' });
      }

      // Face Zoom Removal (Steady Framing & Dual-Speaker Visibility)
      if (
        text.includes('remove face zoom') || text.includes('zoom face') || text.includes('face zoom') ||
        text.includes('remove zoom') || text.includes('no face zoom') || text.includes('no zoom') ||
        text.includes('alisin ang zoom') || text.includes('alisin face zoom') || text.includes('tanggalin ang zoom') ||
        text.includes('disable zoom') || text.includes('steady framing') || text.includes('di nmn na remove') ||
        text.includes('wala nang zoom') || text.includes('unzoomed') || text.includes('fit all people') ||
        text.includes('wide framing')
      ) {
        localActions.push({ action: 'remove_zoom' });
      }

      // Online YouTube Search
      if (text.includes('search yt') || text.includes('search sa yt') || text.includes('search youtube') || text.includes('mag search sa yt') || text.includes('mag search sa youtube') || text.includes('hanap sa yt') || text.includes('hanap sa youtube') || text.includes('youtube search')) {
        let cleanQ = rawText;
        for (const prefix of ['search yt for', 'search sa yt ng', 'search sa yt', 'search youtube for', 'mag search sa yt ng', 'mag search sa yt', 'mag search sa youtube ng', 'mag search sa youtube', 'hanap sa yt ng', 'hanap sa yt', 'hanap sa youtube ng', 'hanap sa youtube', 'find videos from', 'youtube search']) {
          if (cleanQ.toLowerCase().includes(prefix)) {
            const idx = cleanQ.toLowerCase().indexOf(prefix);
            cleanQ = cleanQ.slice(idx + prefix.length).trim();
            break;
          }
        }
        cleanQ = cleanQ.replace(/^[:"' ]+|[:"' ]+$/g, '') || '@theschoolofhardknocks';
        localActions.push({ action: 'search_youtube', query: cleanQ });
      }

      if (text.includes('whop rules') || text.includes('kai rules') || text.includes('compliance') || (text.includes('requirements') && !text.includes('WHAT YOU DO') && text.length < 60) || text.includes('guidelines') || text.includes('payout')) {
        localActions.push({ action: 'whop_rules_check' });
      }

      // Execute local actions immediately
      if (localActions.length > 0) {
        this.executeActionList(localActions);
      }

      // Check if user is asking a conversational question, giving complex advice, or searching online
      const isQuestionOrComplex = (
        rawText.includes('?') ||
        text.startsWith('how') || text.startsWith('ano') || text.startsWith('paano') ||
        text.startsWith('bakit') || text.startsWith('can you') || text.startsWith('pwede') ||
        text.includes('explain') || text.includes('search online') || text.includes('ano gagawin') ||
        text.includes('ano requirements') || text.length >= 70
      );

      // If it's a direct short command, give immediate fast confirmation; otherwise consult Real AI (Gemini)
      const isSimpleCommand = !isQuestionOrComplex && (
        (text.length < 70 && localActions.length > 0)
      );

      if (isSimpleCommand && localActions.length > 0) {
        let msg = "It is done.";
        const first = localActions[0];
        if (first.action === 'remove_zoom') {
          msg = "Face zoom has been completely eliminated across all cuts and playback. The camera framing will remain clean, stable, and uncropped.";
        } else if (first.action === 'search_youtube') {
          msg = `Searching YouTube online for ${first.query || 'videos'}. Inspecting candidates now.`;
        } else if (first.action === 'split') {
          msg = first.time ? `Split cut at ${first.time} seconds.` : "Split cut at playhead.";
        } else if (first.action === 'ripple_trim_in') {
          msg = "Ripple trimmed in from playhead.";
        } else if (first.action === 'ripple_trim_out') {
          msg = "Ripple trimmed out from playhead.";
        } else if (first.action === 'play') {
          msg = "Timeline playback started.";
        } else if (first.action === 'pause') {
          msg = "Timeline playback paused.";
        } else if (first.action === 'delete') {
          msg = "Removed selected element from your workspace.";
        } else if (first.action === 'add_text') {
          msg = "Added a draggable, editable text layer onto your canvas.";
        } else if (first.action === 'set_watermark') {
          msg = first.enabled === false ? "Creator watermark hidden from canvas." : "Creator watermark restored.";
        } else if (first.action === 'freeze_frame') {
          msg = "Inserted a two-second freeze frame at the playhead.";
        } else if (first.action === 'jump_cuts') {
          msg = "Applied automatic silence jump-cuts across dead air intervals.";
        } else if (first.action === 'undo') {
          msg = "Reverted your previous edit action.";
        } else if (first.action === 'redo') {
          msg = "Restored your edit action.";
        } else if (first.action === 'set_layout') {
          msg = `Switched layout to ${first.mode.replace('-', ' ')}.`;
        } else if (first.action === 'set_broll') {
          msg = `Applied ${first.preset.replace('-', ' ')} gameplay footage.`;
        } else if (first.action === 'set_caption_style') {
          msg = `Updated subtitle style to ${first.style.replace('-', ' ')}.`;
        } else if (first.action === 'toggle_captions') {
          msg = first.enabled === false ? "Subtitles hidden from preview." : "Subtitles restored on preview.";
        } else if (first.action === 'auto_edit') {
          msg = "Executing 1-Click AI Auto-Edit for Kai Cenat Whop clipping. Converting sequence to 9:16 vertical, cutting dead air, translating to US English, and generating matching Pixabay stock B-roll.";
        } else if (first.action === 'translate_captions') {
          msg = "Translating your subtitles into fluent American/British English for 50%+ native reach.";
        } else if (first.action === 'auto_broll') {
          msg = "Scanning speech context and auto-inserting matching HD stock B-roll.";
        } else if (first.action === 'clear_broll') {
          msg = "Cleared all B-roll cutaway clips from the timeline.";
        } else if (first.action === 'set_broll_mode') {
          msg = `Switched B-roll cutaway display framing to ${first.mode}.`;
        } else if (first.action === 'search_pixabay') {
          msg = `Searching Pixabay stock video repository for "${first.query}".`;
        } else if (first.action === 'ai_review') {
          msg = "Running Gemini AI review on all candidate clips across viewer retention heatmaps.";
        } else if (first.action === 'whop_rules_check') {
          msg = "Verified Kai Cenat campaign rules: 50%+ US/UK audience, #KaiCenat tag required, 10.21-10.31 content, no logos, submit within 30 minutes of posting.";
        } else if (first.action === 'set_screen_size') {
          msg = `I've resized the video preview to a sleek, compact ${first.size || 'small'} phone mockup.`;
        } else if (first.action === 'set_mode') {
          msg = "Switched to All-Around Universal AI Creator mode, ready for any video.";
        } else if (first.action === 'set_clipping_type') {
          const names = {
            'reaction': 'Reaction Clip formula with 60/40 Split and Face Tracking',
            'gaming': 'Gaming Clip formula with RGB Neon Border and Speed Lines VFX',
            'top-moments': 'Top Moments Countdown formula with #1/#2/#3 Stickers and Progress Bar',
            'text-on-screen': 'Text-On-Screen formula with Kinetic Subtitles and Story Time Badge',
            'music-edit': 'Car Phonk Edit formula with 140 BPM beat-synced cuts, velocity ramps, and anti-lag exhaust pops'
          };
          msg = `Applied the ${names[first.archetype] || 'Clipping Archetype'} formula across your sequence.`;
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
        "At your service. All neural engines and editing timelines are active. What would you like to create?",
        "Right here. I am monitoring your timeline and ready for your next edit command.",
        "Always at your disposal. How may I assist your video project today?",
        "Systems are primed and operational. Tell me what needs to be cut, captioned, or styled.",
        "Listening intently. Shall we work on the cuts, or perhaps inspect the captions?",
        "Standing by. Let me know which direction you'd like to take this viral edit.",
        "Indeed. Every tool in our editing suite is at your fingertips. What is your command?",
        "Delighted to assist. Your footage is loaded and ready for our next creative move."
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
        console.warn('[AI Assistant] Server chat notice, attempting direct endpoint fallback:', err);
      }

      // Step 2: Direct browser API query if server was unreachable
      if (!aiText && this.googleKey) {
        try {
          const recentHistory = this.chatHistory.slice(-6).map((turn) => `${turn.role === 'user' ? 'User' : 'AI Assistant'}: ${turn.text}`).join('\n');
          const systemPrompt = `You are J.A.R.V.I.S., Tony Stark's witty, polite, sophisticated AI assistant and master video editor.
Always address the user as "Sir" or "sir".
You possess full interactive control over the user's OpenChatCut / autobroll video editor timeline: you can execute 1-click AI auto-edit ('auto_edit'), translate speech/subtitles to fluent US/UK English with Gemini ('translate_captions'), auto-match Pixabay stock B-roll ('auto_broll'), search stock footage ('search_pixabay'), verify Kai Cenat Whop campaign rules ('whop_rules_check'), split clips, delete layers, add editable text overlays, and trigger 1080p vertical exports.
The user speaks to you in Tagalog (Filipino / Taglish) or English.
You understand Tagalog and Taglish 100% fluently.
CRITICAL MANDATE: You MUST ALWAYS speak and reply in fluent, suave British English.
Keep answers concise (1 to 2 spoken sentences) so it sounds like real-time voice speech.
OUTPUT FORMAT: You MUST return a single JSON object:
{"reply": "Your British spoken response here.", "actions": []}
Do NOT include markdown fences, thoughts, or extra explanations outside JSON.

Conversation Context:
${recentHistory}
User: ${prompt}
AI Assistant:`;

          const modelsToTry = ['gemini-3-flash-preview', 'gemini-2.5-flash', 'gemini-3.5-flash', 'gemini-flash-latest'];
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
              console.warn(`[AI Assistant] Client query to ${model} notice:`, mErr);
            }
          }
        } catch (e) {
          console.warn('[AI Assistant] AI client query notice:', e);
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
          const repMatch = clean.match(/"reply"\s*:\s*"([^"]+)"/);
          if (repMatch) {
            clean = repMatch[1];
          } else {
            clean = clean.replace(/^[{\s]*"reply"\s*:\s*"?/, '').replace(/"?[}\s]*$/, '').trim();
          }
        }
        if (clean.startsWith('{"reply":')) {
          clean = clean.replace(/^\{"reply":\s*"?/, '').replace(/"?[}\s]*$/, '').trim();
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
        <div class="msg-author">${role === 'user' ? 'YOU' : 'AI ASSISTANT'}</div>
        <div class="msg-body">${this.escapeHtml(text)}</div>
        ${toolCardsHtml}
        ${xrayHtml}
      `;
      container.appendChild(bubble);
      container.scrollTop = container.scrollHeight;
    }

    async performOnlineYouTubeSearch(query) {
      const container = document.getElementById('jarvisChatMessages');
      if (!container) return;

      const loadingBubble = document.createElement('div');
      loadingBubble.className = 'jarvis-msg msg-jarvis';
      loadingBubble.innerHTML = `
        <div class="msg-author">AI ASSISTANT • ONLINE SEARCH</div>
        <div class="msg-body">
          <div style="display:flex; align-items:center; gap:8px;">
            <span class="spinner" style="width:14px; height:14px; border:2px solid #38bdf8; border-top-color:transparent; border-radius:50%; display:inline-block; animation:spin 0.8s linear infinite;"></span>
            <span>Querying YouTube online for <b>"${this.escapeHtml(query)}"</b>...</span>
          </div>
        </div>
      `;
      container.appendChild(loadingBubble);
      container.scrollTop = container.scrollHeight;

      try {
        const res = await fetch('/api/online_search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query, max_results: 6 })
        });
        const data = await res.json();
        if (loadingBubble.parentNode) loadingBubble.remove();

        if (!data.success || !Array.isArray(data.results) || data.results.length === 0) {
          this.addChatMessage('jarvis', `No online videos found for "${query}". You can try searching another channel or topic.`);
          return;
        }

        const cardsBubble = document.createElement('div');
        cardsBubble.className = 'jarvis-msg msg-jarvis jarvis-yt-results';
        
        let listHtml = `
          <div class="msg-author">AI ASSISTANT • YOUTUBE SEARCH RESULTS (${data.results.length} VIDEOS)</div>
          <div style="font-size:12px; color:#94a3b8; margin-bottom:8px;">Found on YouTube for <b>${this.escapeHtml(query)}</b>:</div>
          <div class="jarvis-yt-cards" style="display:flex; flex-direction:column; gap:8px; max-height:360px; overflow-y:auto; padding-right:4px;">
        `;

        data.results.forEach((v) => {
          listHtml += `
            <div class="yt-video-card" style="display:flex; gap:10px; background:#0f172a; border:1px solid #1e293b; border-radius:8px; padding:8px; align-items:center;">
              <div style="position:relative; width:96px; height:54px; flex-shrink:0; background:#000; border-radius:4px; overflow:hidden;">
                <img src="${this.escapeHtml(v.thumbnail || '')}" style="width:100%; height:100%; object-fit:cover;" onerror="this.style.display='none'">
                <span style="position:absolute; bottom:2px; right:2px; background:rgba(0,0,0,0.8); color:#fff; font-size:10px; padding:1px 4px; border-radius:2px; font-weight:600;">${this.escapeHtml(v.duration_str || '0:00')}</span>
              </div>
              <div style="flex:1; min-width:0;">
                <div style="font-size:12px; font-weight:600; color:#f1f5f9; line-height:1.3; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${this.escapeHtml(v.title)}">${this.escapeHtml(v.title)}</div>
                <div style="font-size:11px; color:#64748b; margin-top:2px;">${this.escapeHtml(v.channel || '')}</div>
                <div style="display:flex; gap:6px; margin-top:6px;">
                  <button type="button" class="jarvis-clip-btn" data-url="${this.escapeHtml(v.url)}" data-title="${this.escapeHtml(v.title)}" style="background:linear-gradient(135deg, #059669, #10b981); color:#fff; border:none; border-radius:4px; font-size:11px; font-weight:600; padding:4px 8px; cursor:pointer;">
                    ⚡ Auto-Clip (20–60s)
                  </button>
                  <button type="button" class="jarvis-load-btn" data-url="${this.escapeHtml(v.url)}" style="background:#1e293b; color:#cbd5e1; border:1px solid #334155; border-radius:4px; font-size:11px; padding:4px 8px; cursor:pointer;">
                    📥 Load
                  </button>
                </div>
              </div>
            </div>
          `;
        });

        listHtml += `</div>`;
        cardsBubble.innerHTML = listHtml;
        container.appendChild(cardsBubble);
        container.scrollTop = container.scrollHeight;

        // Wire click events
        cardsBubble.querySelectorAll('.jarvis-clip-btn').forEach((btn) => {
          btn.addEventListener('click', () => {
            const vUrl = btn.getAttribute('data-url');
            const vTitle = btn.getAttribute('data-title');
            this.addChatMessage('user', `Auto-clip this video: ${vTitle}`);
            this.addChatMessage('jarvis', `Executing 1-Click Auto-Edit for "${vTitle}" matching campaign requirements!`);
            this.speak(`Executing auto-edit for this video.`);
            const studio = window.WhopStudio;
            if (studio?.extractAndAutoEditUrl) {
              studio.extractAndAutoEditUrl(vUrl);
            } else {
              const urlInp = document.getElementById('streamUrlInput');
              const extBtn = document.getElementById('extractUrlBtn');
              if (urlInp) urlInp.value = vUrl;
              if (extBtn) extBtn.click();
            }
          });
        });

        cardsBubble.querySelectorAll('.jarvis-load-btn').forEach((btn) => {
          btn.addEventListener('click', () => {
            const vUrl = btn.getAttribute('data-url');
            const urlInp = document.getElementById('streamUrlInput');
            if (urlInp) urlInp.value = vUrl;
            const extBtn = document.getElementById('extractUrlBtn');
            if (extBtn) extBtn.click();
            this.addChatMessage('user', `Load video: ${vUrl}`);
          });
        });

      } catch (err) {
        if (loadingBubble.parentNode) loadingBubble.remove();
        this.addChatMessage('jarvis', `An error occurred while querying YouTube online: ${err.message}`);
      }
    }

    renderCampaignCardInChat(camp) {
      const container = document.getElementById('jarvisChatMessages');
      if (!container || !camp) return;

      const bubble = document.createElement('div');
      bubble.className = 'jarvis-msg msg-jarvis jarvis-campaign-card';
      
      const criteriaList = Array.isArray(camp.clips_criteria) && camp.clips_criteria.length > 0
        ? camp.clips_criteria.slice(0, 4).map(c => `<li>• ${this.escapeHtml(c)}</li>`).join('')
        : '<li>• Millionaire interview highlights / net worth</li>';

      bubble.innerHTML = `
        <div class="msg-author">AI Assistant • CAMPAIGN BOUNTY ACTIVATED 🎯</div>
        <div style="background:#090d16; border:1px solid #059669; border-radius:8px; padding:10px; margin-top:4px;">
          <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #1e293b; padding-bottom:6px; margin-bottom:8px;">
            <span style="color:#10b981; font-weight:700; font-size:13px;">${this.escapeHtml(camp.campaign_name || 'Creator Bounty')}</span>
            <span style="background:#064e3b; color:#34d399; font-size:10px; font-weight:700; padding:2px 6px; border-radius:4px;">BOUNTY ACTIVE</span>
          </div>
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:6px; font-size:11px; color:#cbd5e1; margin-bottom:8px;">
            <div>⏱️ <b>Duration:</b> ${camp.target_duration_min || 20}–${camp.target_duration_max || 60}s</div>
            <div>⚡ <b>Hook:</b> Best line in first 2s</div>
            <div>🚫 <b>Face Zoom:</b> OFF (Steady 1.0x)</div>
            <div>🏷️ <b>Credit:</b> ${this.escapeHtml(camp.credit_rule || camp.channel_handle || 'Required')}</div>
          </div>
          <div style="font-size:11px; color:#94a3b8; margin-bottom:4px;"><b>CLIPS THAT WORK:</b></div>
          <ul style="margin:0 0 8px 0; padding-left:14px; font-size:11px; color:#cbd5e1; line-height:1.4;">
            ${criteriaList}
          </ul>
          <div style="display:flex; gap:6px; margin-top:8px;">
            <button type="button" class="jarvis-search-source-btn" style="background:#0284c7; color:#fff; border:none; border-radius:4px; font-size:11px; font-weight:600; padding:4px 10px; cursor:pointer;">
              🔍 Search Channel Videos (${this.escapeHtml(camp.channel_handle || 'Source')})
            </button>
          </div>
        </div>
      `;
      container.appendChild(bubble);
      container.scrollTop = container.scrollHeight;

      bubble.querySelector('.jarvis-search-source-btn')?.addEventListener('click', () => {
        this.performOnlineYouTubeSearch(camp.channel_handle || camp.search_query || '@theschoolofhardknocks');
      });
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
