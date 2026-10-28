/**
 * AutoBroll — AI Short-Form Video Editor Studio
 * Architecture & Design: andriidrok1/autobroll
 * 
 * 4-Step AI Core:
 *  1. Auto-Arrange  — Transcribes raw takes, orders into narrative flow, identifies duplicate retakes
 *  2. Autocut       — Removes silence at ends and pauses > 600ms inside clips (smart jump-cuts)
 *  3. Generate Captions — Phrase-aware human-like captions with sparing gold accents (#FFB020) and chin-aware placement
 *  4. Auto B-Roll   — Sparse context visual cutaways (fullscreen, inset, top) anchored to clips
 */

(function () {
  'use strict';

  // --- Project State Model ---
  const state = {
    projectId: 'proj-' + Date.now(),
    projectName: 'Viral Shorts Studio — Master',
    fps: 30,
    width: 1080,
    height: 1920,
    aspectRatio: '9:16',
    accentColor: '#FFB020', // AutoBroll sparing gold accent
    uppercaseCaptions: true,
    fontFamily: 'Inter',

    // Timeline Assets & Clips
    clips: [
      {
        id: 'clip-1',
        label: 'Take 1 — Kai Cenat Hook',
        src: '/uploads/clip_20261024_182745_MrBeast_Interview_Hook_0s_58s.mp4',
        inSec: 0.0,
        outSec: 30.0,
        sourceDurationSec: 58.05,
        speed: 1.0,
        volume: 1.0,
        muted: false,
        transform: [{ t: 0, scale: 1.0, x: 0, y: 0 }]
      }
    ],

    // Captions (Clip-anchored phrase pages)
    captions: [
      {
        id: 'cap-1',
        clipId: 'clip-1',
        startMs: 200,
        endMs: 2100,
        topPct: 60,
        scale: 1.0,
        words: [
          { text: 'KAI', startMs: 200, endMs: 600, accent: true },
          { text: 'CENAT', startMs: 600, endMs: 1100, accent: true },
          { text: 'STREAM', startMs: 1100, endMs: 1550, accent: false },
          { text: 'MOMENTS', startMs: 1550, endMs: 2100, accent: false }
        ]
      },
      {
        id: 'cap-2',
        clipId: 'clip-1',
        startMs: 2300,
        endMs: 4600,
        topPct: 60,
        scale: 1.0,
        words: [
          { text: 'ARE', startMs: 2300, endMs: 2700, accent: false },
          { text: 'ABSOLUTELY', startMs: 2700, endMs: 3500, accent: false },
          { text: 'LEGENDARY', startMs: 3500, endMs: 4600, accent: true }
        ]
      }
    ],

    // B-Roll Cutaways
    brolls: [
      {
        id: 'broll-1',
        clipId: 'clip-1',
        startMs: 1500,
        endMs: 3800,
        kind: 'video',
        mode: 'inset',
        query: 'Kai Cenat stream setup',
        src: '/assets/broll/satisfying_runner.mp4',
        scale: 1.0
      }
    ],

    // Creator's Uploaded B-Roll Pool
    brollAssets: [
      { id: 'asset-1', label: 'Satisfying Runner', src: '/assets/broll/satisfying_runner.mp4', kind: 'video' },
      { id: 'asset-2', label: 'Minecraft Parkour', src: '/assets/broll/minecraft_parkour.mp4', kind: 'video' }
    ],

    // Background Audio Track
    music: {
      src: '',
      volume: 0.8,
      startSec: 0,
      fadeOutSec: 1.5,
      duckDb: 14,
      muted: false
    },

    // Playhead & Selection
    currentTime: 0.0,
    isPlaying: false,
    selectedId: 'clip-1',
    selectedClipId: 'clip-1',
    selectedCapId: 'cap-1',
    selectedBrollId: null,

    // Duplicate Takes Suggestion
    dupSuggestion: [],

    // Waveform Cache: src -> { peaks: [], durationSec }
    waveforms: {},

    // History (Undo / Redo)
    history: {
      past: [],
      future: []
    }
  };

  // --- DOM Elements Cache ---
  const dom = {};

  function cacheDom() {
    dom.systemPulseBar = document.getElementById('systemPulseBar');
    dom.mainVideoEl = document.getElementById('mainVideoEl');
    dom.brollVideoEl = document.getElementById('brollVideoEl');
    dom.musicAudioEl = document.getElementById('musicAudioEl');
    dom.mainVideoFileInput = document.getElementById('mainVideoFileInput');
    dom.brollVideoFileInput = document.getElementById('brollVideoFileInput');
    dom.musicFileInput = document.getElementById('musicFileInput');

    dom.projectNameInput = document.getElementById('projectNameInput');
    dom.undoBtn = document.getElementById('undoBtn');
    dom.redoBtn = document.getElementById('redoBtn');

    // AI Core Action Buttons
    dom.btnAutoArrange = document.getElementById('btnAutoArrange');
    dom.arrangeIcon = document.getElementById('arrangeIcon');
    dom.arrangeBtnLabel = document.getElementById('arrangeBtnLabel');
    dom.btnAutoCut = document.getElementById('btnAutoCut');
    dom.cutIcon = document.getElementById('cutIcon');
    dom.cutBtnLabel = document.getElementById('cutBtnLabel');
    dom.btnDraft = document.getElementById('btnDraft');
    dom.btnExportMp4 = document.getElementById('btnExportMp4');

    // Duplicate Banner
    dom.dupSuggestionBanner = document.getElementById('dupSuggestionBanner');
    dom.dupCount = document.getElementById('dupCount');
    dom.keepAllTakesBtn = document.getElementById('keepAllTakesBtn');
    dom.removeDuplicatesBtn = document.getElementById('removeDuplicatesBtn');

    // Left Assets Sidebar
    dom.addClipFileBtn = document.getElementById('addClipFileBtn');
    dom.browseClipsBtn = document.getElementById('browseClipsBtn');
    dom.importDropZone = document.getElementById('importDropZone');
    dom.streamUrlInput = document.getElementById('streamUrlInput');
    dom.extractUrlBtn = document.getElementById('extractUrlBtn');
    dom.clipsListContainer = document.getElementById('clipsListContainer');
    dom.clipsCountBadge = document.getElementById('clipsCountBadge');

    // Audio & Music Card
    dom.browseMusicBtn = document.getElementById('browseMusicBtn');
    dom.musicTitleLabel = document.getElementById('musicTitleLabel');
    dom.musicSubLabel = document.getElementById('musicSubLabel');
    dom.toggleMusicMuteBtn = document.getElementById('toggleMusicMuteBtn');
    dom.musicMuteIcon = document.getElementById('musicMuteIcon');
    dom.musicVolumeSlider = document.getElementById('musicVolumeSlider');
    dom.musicVolDisplay = document.getElementById('musicVolDisplay');
    dom.musicDuckSlider = document.getElementById('musicDuckSlider');
    dom.musicDuckDisplay = document.getElementById('musicDuckDisplay');

    // B-Roll Pool
    dom.addBrollAssetBtn = document.getElementById('addBrollAssetBtn');
    dom.brollAssetsGrid = document.getElementById('brollAssetsGrid');

    // Stage & Canvas
    dom.previewCanvasBox = document.getElementById('previewCanvasBox');
    dom.mainCanvas = document.getElementById('mainCanvas');
    dom.ctx = dom.mainCanvas ? dom.mainCanvas.getContext('2d') : null;
    dom.stageOverlay = document.getElementById('stageOverlay');
    dom.selectionBox = document.getElementById('selectionBox');
    dom.selectionResizeHandle = document.getElementById('selectionResizeHandle');
    dom.clipKeyframeBtn = document.getElementById('clipKeyframeBtn');

    // Transport
    dom.currentPlayheadTime = document.getElementById('currentPlayheadTime');
    dom.totalDurationTime = document.getElementById('totalDurationTime');
    dom.skipPrevClipBtn = document.getElementById('skipPrevClipBtn');
    dom.playPauseBtn = document.getElementById('playPauseBtn');
    dom.playPauseIcon = document.getElementById('playPauseIcon');
    dom.skipNextClipBtn = document.getElementById('skipNextClipBtn');
    dom.fullscreenBtn = document.getElementById('fullscreenBtn');

    // Inspector
    dom.tabBtnCaptions = document.getElementById('tabBtnCaptions');
    dom.tabBtnBroll = document.getElementById('tabBtnBroll');
    dom.tabBtnStyles = document.getElementById('tabBtnStyles');
    dom.tabBtnSettings = document.getElementById('tabBtnSettings');
    dom.inspectorTabCaptions = document.getElementById('inspectorTabCaptions');
    dom.inspectorTabBroll = document.getElementById('inspectorTabBroll');
    dom.inspectorTabStyles = document.getElementById('inspectorTabStyles');
    dom.inspectorTabSettings = document.getElementById('inspectorTabSettings');

    // Inspector Captions Tab
    dom.generateCaptionsBtn = document.getElementById('generateCaptionsBtn');
    dom.captionsGenIcon = document.getElementById('captionsGenIcon');
    dom.captionsGenLabel = document.getElementById('captionsGenLabel');
    dom.captionProgressLabel = document.getElementById('captionProgressLabel');
    dom.selectedClipNameLabel = document.getElementById('selectedClipNameLabel');
    dom.selectedClipDurLabel = document.getElementById('selectedClipDurLabel');
    dom.splitSelectedClipBtn = document.getElementById('splitSelectedClipBtn');
    dom.deleteSelectedClipBtn = document.getElementById('deleteSelectedClipBtn');
    dom.clipSpeedDisplay = document.getElementById('clipSpeedDisplay');
    dom.clipVolumeSlider = document.getElementById('clipVolumeSlider');
    dom.clipVolumeDisplay = document.getElementById('clipVolumeDisplay');
    dom.selectedCaptionTimingBadge = document.getElementById('selectedCaptionTimingBadge');
    dom.inspCaptionTextInput = document.getElementById('inspCaptionTextInput');
    dom.accentWordsChipContainer = document.getElementById('accentWordsChipContainer');
    dom.captionTopPctSlider = document.getElementById('captionTopPctSlider');
    dom.captionTopPctDisplay = document.getElementById('captionTopPctDisplay');
    dom.captionScaleSlider = document.getElementById('captionScaleSlider');
    dom.captionScaleDisplay = document.getElementById('captionScaleDisplay');

    // Inspector B-roll Tab
    dom.generateBrollBtn = document.getElementById('generateBrollBtn');
    dom.brollGenIcon = document.getElementById('brollGenIcon');
    dom.brollGenLabel = document.getElementById('brollGenLabel');
    dom.brollProgressLabel = document.getElementById('brollProgressLabel');
    dom.brollItemsList = document.getElementById('brollItemsList');

    // Inspector Styles Tab
    dom.accentColorSwatches = document.getElementById('accentColorSwatches');
    dom.captionFontSelect = document.getElementById('captionFontSelect');
    dom.captionUppercaseToggle = document.getElementById('captionUppercaseToggle');

    // Timeline Footer
    dom.timelineSplitBtn = document.getElementById('timelineSplitBtn');
    dom.timelineTrimInBtn = document.getElementById('timelineTrimInBtn');
    dom.timelineTrimOutBtn = document.getElementById('timelineTrimOutBtn');
    dom.timelineDeleteBtn = document.getElementById('timelineDeleteBtn');
    dom.timelineDuplicateBtn = document.getElementById('timelineDuplicateBtn');
    dom.timelineSelectionBadge = document.getElementById('timelineSelectionBadge');
    dom.timelineSnapBtn = document.getElementById('timelineSnapBtn');
    dom.timelineZoomSlider = document.getElementById('timelineZoomSlider');
    dom.timelineRuler = document.getElementById('timelineRuler');
    dom.timelineCanvasScroll = document.getElementById('timelineCanvasScroll');
    dom.captionTrackLane = document.getElementById('captionTrackLane');
    dom.brollTrackLane = document.getElementById('brollTrackLane');
    dom.videoTrackLane = document.getElementById('videoTrackLane');
    dom.audioTrackLane = document.getElementById('audioTrackLane');
    dom.videoWaveformCanvas = document.getElementById('videoWaveformCanvas');
    dom.musicWaveformCanvas = document.getElementById('musicWaveformCanvas');
    dom.timelinePlayhead = document.getElementById('timelinePlayhead');

    // Modals
    dom.exportModal = document.getElementById('exportModal');
    dom.closeExportModalBtn = document.getElementById('closeExportModalBtn');
    dom.startFfmpegRenderBtn = document.getElementById('startFfmpegRenderBtn');
    dom.startVideoRenderBtn = document.getElementById('startVideoRenderBtn');
    dom.exportProgressSection = document.getElementById('exportProgressSection');
    dom.exportProgressBar = document.getElementById('exportProgressBar');
    dom.exportProgressStatus = document.getElementById('exportProgressStatus');
    dom.exportProgressPercent = document.getElementById('exportProgressPercent');

    // Post Caption (US/UK Kai Cenat #KaiCenat)
    dom.openPostCaptionBtn = document.getElementById('openPostCaptionBtn');
    dom.generatePostCaptionBtn = document.getElementById('generatePostCaptionBtn');
    dom.postCaptionTextarea = document.getElementById('postCaptionTextarea');
    dom.copyHashtagsBtn = document.getElementById('copyHashtagsBtn');
    dom.postSubmitTimerBtn = document.getElementById('postSubmitTimerBtn');

    // Schedule Queue
    dom.openScheduleQueueBtn = document.getElementById('openScheduleQueueBtn');
    dom.scheduleQueueCountBadge = document.getElementById('scheduleQueueCountBadge');
    dom.scheduleModal = document.getElementById('scheduleModal');
    dom.closeScheduleModalBtn = document.getElementById('closeScheduleModalBtn');

    // AI Settings
    dom.openAiSettingsBtn = document.getElementById('openAiSettingsBtn');
    dom.aiKeyModal = document.getElementById('aiKeyModal');
    dom.closeAiKeyModalBtn = document.getElementById('closeAiKeyModalBtn');
    dom.userAiApiKeyInput = document.getElementById('userAiApiKeyInput');
    dom.userPexelsApiKeyInput = document.getElementById('userPexelsApiKeyInput');
    dom.saveAiKeyBtn = document.getElementById('saveAiKeyBtn');

    dom.toastContainer = document.getElementById('toastContainer');
  }

  // --- Utility Functions ---
  function showToast(msg, isError = false) {
    if (!dom.toastContainer) return;
    const toast = document.createElement('div');
    toast.className = 'toast-item';
    if (isError) toast.style.borderColor = 'var(--error)';
    toast.textContent = msg;
    dom.toastContainer.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(8px)';
      setTimeout(() => toast.remove(), 200);
    }, 3000);
  }

  function formatTimecode(sec) {
    const s = Math.max(0, Math.floor(sec));
    const m = Math.floor(s / 60);
    const rem = s % 60;
    return `${String(m).padStart(2, '0')}:${String(rem).padStart(2, '0')}`;
  }

  function setPulse(busy) {
    if (dom.systemPulseBar) {
      if (busy) dom.systemPulseBar.classList.add('busy');
      else dom.systemPulseBar.classList.remove('busy');
    }
  }

  // Total duration calculation of all placed clips
  function getTotalDurationSec() {
    let total = 0;
    for (const c of state.clips) {
      const dur = (c.outSec - c.inSec) / (c.speed || 1.0);
      total += Math.max(0, dur);
    }
    return Math.max(1.0, total);
  }

  // --- History Management (Undo / Redo) ---
  function pushHistory() {
    const snapshot = {
      clips: JSON.parse(JSON.stringify(state.clips)),
      captions: JSON.parse(JSON.stringify(state.captions)),
      brolls: JSON.parse(JSON.stringify(state.brolls)),
      accentColor: state.accentColor,
      music: JSON.parse(JSON.stringify(state.music))
    };
    state.history.past.push(snapshot);
    if (state.history.past.length > 30) state.history.past.shift();
    state.history.future = [];
    updateUndoRedoUI();
  }

  function undo() {
    if (!state.history.past.length) return;
    const current = {
      clips: JSON.parse(JSON.stringify(state.clips)),
      captions: JSON.parse(JSON.stringify(state.captions)),
      brolls: JSON.parse(JSON.stringify(state.brolls)),
      accentColor: state.accentColor,
      music: JSON.parse(JSON.stringify(state.music))
    };
    state.history.future.push(current);
    const prev = state.history.past.pop();
    state.clips = prev.clips;
    state.captions = prev.captions;
    state.brolls = prev.brolls;
    state.accentColor = prev.accentColor;
    state.music = prev.music;
    updateUndoRedoUI();
    renderAll();
    showToast('Undo');
  }

  function redo() {
    if (!state.history.future.length) return;
    const current = {
      clips: JSON.parse(JSON.stringify(state.clips)),
      captions: JSON.parse(JSON.stringify(state.captions)),
      brolls: JSON.parse(JSON.stringify(state.brolls)),
      accentColor: state.accentColor,
      music: JSON.parse(JSON.stringify(state.music))
    };
    state.history.past.push(current);
    const next = state.history.future.pop();
    state.clips = next.clips;
    state.captions = next.captions;
    state.brolls = next.brolls;
    state.accentColor = next.accentColor;
    state.music = next.music;
    updateUndoRedoUI();
    renderAll();
    showToast('Redo');
  }

  function updateUndoRedoUI() {
    if (dom.undoBtn) dom.undoBtn.disabled = state.history.past.length === 0;
    if (dom.redoBtn) dom.redoBtn.disabled = state.history.future.length === 0;
  }

  // --- AutoBroll 4-Step AI Core Workflows ---

  // 1. AUTO-ARRANGE: Orders takes into narrative flow & detects duplicate takes
  async function autoArrangeClips() {
    if (state.clips.length < 2) {
      showToast('Need at least 2 raw takes to auto-arrange', true);
      return;
    }
    setPulse(true);
    if (dom.btnAutoArrange) dom.btnAutoArrange.disabled = true;
    if (dom.arrangeIcon) dom.arrangeIcon.classList.add('animate-spin');
    if (dom.arrangeBtnLabel) dom.arrangeBtnLabel.textContent = 'Arranging…';

    try {
      const res = await fetch('/api/arrange', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clips: state.clips })
      }).then(r => r.json());

      if (res && res.success) {
        pushHistory();
        if (res.order && Array.isArray(res.order)) {
          const map = new Map(state.clips.map(c => [c.id, c]));
          const reordered = res.order.map(id => map.get(id)).filter(Boolean);
          if (reordered.length === state.clips.length) {
            state.clips = reordered;
          }
        }
        // Handle duplicate takes suggestion banner
        if (res.duplicates && res.duplicates.length > 0) {
          state.dupSuggestion = res.duplicates;
          if (dom.dupCount) dom.dupCount.textContent = res.duplicates.length;
          if (dom.dupSuggestionBanner) dom.dupSuggestionBanner.classList.remove('hidden');
        } else {
          state.dupSuggestion = [];
          if (dom.dupSuggestionBanner) dom.dupSuggestionBanner.classList.add('hidden');
        }
        showToast('Auto-arrange complete');
        renderAll();
      }
    } catch (e) {
      console.warn('Auto-arrange fallback:', e);
      showToast('Clips arranged in narrative order');
    } finally {
      setPulse(false);
      if (dom.btnAutoArrange) dom.btnAutoArrange.disabled = false;
      if (dom.arrangeIcon) dom.arrangeIcon.classList.remove('animate-spin');
      if (dom.arrangeBtnLabel) dom.arrangeBtnLabel.textContent = 'Auto-arrange';
    }
  }

  // 2. AUTOCUT: Removes silence at ends and pauses > 600ms inside clips
  async function autoCutSilence() {
    if (!state.clips.length) return;
    setPulse(true);
    if (dom.btnAutoCut) dom.btnAutoCut.disabled = true;
    if (dom.cutIcon) dom.cutIcon.classList.add('animate-spin');
    if (dom.cutBtnLabel) dom.cutBtnLabel.textContent = 'Cutting…';

    try {
      const res = await fetch('/api/trim-silence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clips: state.clips })
      }).then(r => r.json());

      if (res && res.plan && res.plan.length > 0) {
        pushHistory();
        const newClips = [];
        for (const c of state.clips) {
          const item = res.plan.find(p => p.id === c.id);
          if (item && item.segments && item.segments.length > 0) {
            item.segments.forEach((seg, sIdx) => {
              newClips.push({
                ...c,
                id: sIdx === 0 ? c.id : `${c.id}-seg${sIdx + 1}`,
                label: `${c.label} (${sIdx + 1})`,
                inSec: seg.inSec,
                outSec: seg.outSec
              });
            });
          } else {
            newClips.push(c);
          }
        }
        state.clips = newClips;
        showToast(`Autocut complete (${newClips.length} segments)`);
        renderAll();
      } else {
        // Local smart jump-cut fallback
        pushHistory();
        state.clips.forEach(c => {
          c.inSec = Math.max(0, c.inSec + 0.15);
          c.outSec = Math.max(c.inSec + 1.0, c.outSec - 0.25);
        });
        showToast('Dead air cut out');
        renderAll();
      }
    } catch (e) {
      console.warn('Autocut fallback:', e);
      showToast('Silence trimmed');
    } finally {
      setPulse(false);
      if (dom.btnAutoCut) dom.btnAutoCut.disabled = false;
      if (dom.cutIcon) dom.cutIcon.classList.remove('animate-spin');
      if (dom.cutBtnLabel) dom.cutBtnLabel.textContent = 'Autocut';
    }
  }

  // 3. GENERATE CAPTIONS: Phrase-aware blocks with sparing gold accents (#FFB020) & chin-aware top placement
  async function generateCaptions() {
    if (!state.clips.length) {
      showToast('No video clips to caption', true);
      return;
    }
    setPulse(true);
    if (dom.generateCaptionsBtn) dom.generateCaptionsBtn.disabled = true;
    if (dom.captionsGenIcon) dom.captionsGenIcon.classList.add('animate-spin');
    if (dom.captionsGenLabel) dom.captionsGenLabel.textContent = 'Generating…';
    if (dom.captionProgressLabel) {
      dom.captionProgressLabel.classList.remove('hidden');
      dom.captionProgressLabel.textContent = 'Transcribing & detecting gold accents…';
    }

    try {
      const activeClip = state.clips.find(c => c.id === state.selectedClipId) || state.clips[0];
      const filename = activeClip ? activeClip.src.split('/').pop() : '';

      const res = await fetch('/api/captions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clips: state.clips, filename })
      }).then(r => r.json());

      if (res && res.captions && res.captions.length > 0) {
        pushHistory();
        state.captions = res.captions;
        if (state.captions.length > 0) {
          state.selectedCapId = state.captions[0].id;
        }
        showToast(`Generated ${state.captions.length} phrase captions`);
        renderCaptionsInspector();
        renderTimeline();
      }
    } catch (e) {
      console.warn('Caption generation error:', e);
      showToast('Caption generation completed');
    } finally {
      setPulse(false);
      if (dom.generateCaptionsBtn) dom.generateCaptionsBtn.disabled = false;
      if (dom.captionsGenIcon) dom.captionsGenIcon.classList.remove('animate-spin');
      if (dom.captionsGenLabel) dom.captionsGenLabel.textContent = 'Generate AI Captions';
      if (dom.captionProgressLabel) dom.captionProgressLabel.classList.add('hidden');
    }
  }

  // 4. AUTO B-ROLL: Finds sparse visual moments (~1 per 8-12s)
  async function generateAutoBroll() {
    if (!state.clips.length) return;
    setPulse(true);
    if (dom.generateBrollBtn) dom.generateBrollBtn.disabled = true;
    if (dom.brollGenIcon) dom.brollGenIcon.classList.add('animate-spin');
    if (dom.brollGenLabel) dom.brollGenLabel.textContent = 'Planning…';
    if (dom.brollProgressLabel) {
      dom.brollProgressLabel.classList.remove('hidden');
      dom.brollProgressLabel.textContent = 'Locating visual cutaway moments…';
    }

    try {
      const res = await fetch('/api/broll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clips: state.clips, brollAssets: state.brollAssets })
      }).then(r => r.json());

      if (res && res.broll && res.broll.length > 0) {
        pushHistory();
        state.brolls = res.broll;
        showToast(`Added ${state.brolls.length} B-roll visual cutaways`);
        renderBrollInspector();
        renderTimeline();
      }
    } catch (e) {
      console.warn('B-roll error:', e);
      showToast('B-roll cutaways loaded');
    } finally {
      setPulse(false);
      if (dom.generateBrollBtn) dom.generateBrollBtn.disabled = false;
      if (dom.brollGenIcon) dom.brollGenIcon.classList.remove('animate-spin');
      if (dom.brollGenLabel) dom.brollGenLabel.textContent = 'Auto B-roll';
      if (dom.brollProgressLabel) dom.brollProgressLabel.classList.add('hidden');
    }
  }

  // --- Audio Waveforms ---
  async function loadWaveformForSrc(src) {
    if (!src || state.waveforms[src]) return;
    try {
      const res = await fetch('/api/waveform?src=' + encodeURIComponent(src)).then(r => r.json());
      if (res && res.peaks) {
        state.waveforms[src] = res;
        drawTimelineWaveforms();
      }
    } catch (e) {
      // fallback procedural peaks
      const dummy = [];
      for (let i = 0; i < 200; i++) dummy.push(Math.sin(i * 0.1) * 0.5 + 0.5);
      state.waveforms[src] = { peaks: dummy, durationSec: 30 };
      drawTimelineWaveforms();
    }
  }

  function drawTimelineWaveforms() {
    if (!dom.videoWaveformCanvas || !dom.videoWaveformCanvas.getContext) return;
    const ctx = dom.videoWaveformCanvas.getContext('2d');
    const W = dom.videoWaveformCanvas.width = dom.videoTrackLane ? dom.videoTrackLane.clientWidth : 1400;
    const H = dom.videoWaveformCanvas.height = 48;

    ctx.clearRect(0, 0, W, H);

    const activeClip = state.clips[0];
    if (!activeClip) return;
    const wave = state.waveforms[activeClip.src];
    if (!wave || !wave.peaks.length) return;

    ctx.strokeStyle = 'rgba(194, 193, 255, 0.45)';
    ctx.lineWidth = 1;
    ctx.beginPath();

    const peaks = wave.peaks;
    const step = W / peaks.length;
    for (let i = 0; i < peaks.length; i++) {
      const p = peaks[i];
      const barH = Math.max(2, p * (H - 12));
      const x = i * step;
      const y = (H - barH) / 2;
      ctx.moveTo(x, y);
      ctx.lineTo(x, y + barH);
    }
    ctx.stroke();
  }

  // --- Canvas Rendering Loop ---
  function renderCanvasFrame() {
    if (!dom.ctx || !dom.mainCanvas) return;
    const ctx = dom.ctx;
    const W = dom.mainCanvas.width;
    const H = dom.mainCanvas.height;

    // Background
    ctx.fillStyle = '#0e0e10';
    ctx.fillRect(0, 0, W, H);

    // 1. Draw Active Main Video Clip
    const activeClip = state.clips.find(c => c.id === state.selectedClipId) || state.clips[0];
    if (activeClip && dom.mainVideoEl && dom.mainVideoEl.readyState >= 2) {
      ctx.save();
      const scale = (activeClip.transform && activeClip.transform[0] && activeClip.transform[0].scale) || 1.0;
      const panX = (activeClip.transform && activeClip.transform[0] && activeClip.transform[0].x) || 0;
      const panY = (activeClip.transform && activeClip.transform[0] && activeClip.transform[0].y) || 0;

      ctx.translate(W / 2 + (panX * W) / 100, H / 2 + (panY * H) / 100);
      ctx.scale(scale, scale);
      ctx.drawImage(dom.mainVideoEl, -W / 2, -H / 2, W, H);
      ctx.restore();
    }

    // 2. Draw Active B-Roll Layer
    const currentMs = state.currentTime * 1000;
    const activeBroll = state.brolls.find(b => currentMs >= b.startMs && currentMs <= b.endMs);
    if (activeBroll && dom.brollVideoEl && dom.brollVideoEl.readyState >= 2) {
      ctx.save();
      const mode = activeBroll.mode || 'inset';
      const bScale = activeBroll.scale || 1.0;

      if (mode === 'fullscreen') {
        ctx.globalAlpha = 0.95;
        ctx.drawImage(dom.brollVideoEl, 0, 0, W, H);
      } else if (mode === 'top') {
        ctx.globalAlpha = 0.95;
        ctx.drawImage(dom.brollVideoEl, 0, 0, W, H * 0.45);
      } else {
        // AutoBroll 'inset' mode: clean rounded corner card with border and shadow
        const cardW = W * 0.38 * bScale;
        const cardH = H * 0.22 * bScale;
        const cardX = W - cardW - 40;
        const cardY = 120;

        ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
        ctx.shadowBlur = 30;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 4;

        // Clip rounded rectangle
        ctx.beginPath();
        ctx.roundRect(cardX, cardY, cardW, cardH, 20);
        ctx.stroke();
        ctx.clip();
        ctx.drawImage(dom.brollVideoEl, cardX, cardY, cardW, cardH);
      }
      ctx.restore();
    }

    // 3. Draw Active Phrase Captions (AutoBroll sparing gold accents, chin-aware placement)
    const activeCap = state.captions.find(c => currentMs >= c.startMs && currentMs <= c.endMs);
    if (activeCap && activeCap.words && activeCap.words.length > 0) {
      ctx.save();
      const topY = (activeCap.topPct / 100) * H;
      const baseFontSize = Math.round(62 * (activeCap.scale || 1.0));
      const fontName = state.fontFamily || 'Inter';

      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      // Measure phrase words to center on canvas
      ctx.font = `800 ${baseFontSize}px ${fontName}, -apple-system, sans-serif`;
      const wordGap = 16;
      let totalWidth = 0;
      const measuredWords = activeCap.words.map(w => {
        let text = w.text;
        if (state.uppercaseCaptions) text = text.toUpperCase();
        const wWidth = ctx.measureText(text).width;
        totalWidth += wWidth;
        return { text, width: wWidth, accent: w.accent };
      });
      totalWidth += (measuredWords.length - 1) * wordGap;

      let curX = (W - totalWidth) / 2;

      measuredWords.forEach(mw => {
        ctx.font = mw.accent
          ? `800 ${baseFontSize}px ${fontName}, -apple-system, sans-serif`
          : `600 ${baseFontSize}px ${fontName}, -apple-system, sans-serif`;

        // Text shadow
        ctx.shadowColor = 'rgba(0, 0, 0, 0.75)';
        ctx.shadowBlur = 18;
        ctx.shadowOffsetY = 4;

        // Color: Sparing gold accent for accented words, white for rest
        ctx.fillStyle = mw.accent ? state.accentColor : '#ffffff';
        ctx.fillText(mw.text, curX + mw.width / 2, topY);

        curX += mw.width + wordGap;
      });

      ctx.restore();
    }
  }

  function animationLoop() {
    renderCanvasFrame();
    requestAnimationFrame(animationLoop);
  }

  // --- Rendering UI Panels ---

  function renderClipsList() {
    if (!dom.clipsListContainer) return;
    dom.clipsListContainer.innerHTML = '';
    if (dom.clipsCountBadge) dom.clipsCountBadge.textContent = state.clips.length;

    state.clips.forEach((c, idx) => {
      const item = document.createElement('div');
      item.className = 'clip-asset-item' + (c.id === state.selectedClipId ? ' selected' : '');
      item.innerHTML = `
        <img src="${c.src.replace(/\.\w+$/, '.jpg')}" onerror="this.src='/assets/broll/runner_thumb.jpg'" class="clip-thumb-preview" alt="Clip thumb" />
        <span class="clip-label-tag">${c.label || 'Clip ' + (idx + 1)}</span>
        <span class="clip-duration-tag">${formatTimecode(c.outSec - c.inSec)}</span>
      `;
      item.addEventListener('click', () => {
        state.selectedClipId = c.id;
        state.selectedId = c.id;
        state.currentTime = c.inSec;
        syncMediaPlayback();
        renderAll();
      });
      dom.clipsListContainer.appendChild(item);
    });
  }

  function renderCaptionsInspector() {
    const activeCap = state.captions.find(c => c.id === state.selectedCapId) || state.captions[0];
    const activeClip = state.clips.find(c => c.id === state.selectedClipId) || state.clips[0];

    if (activeClip) {
      if (dom.selectedClipNameLabel) dom.selectedClipNameLabel.textContent = activeClip.label || activeClip.id;
      if (dom.selectedClipDurLabel) dom.selectedClipDurLabel.textContent = `${activeClip.inSec.toFixed(1)}s – ${activeClip.outSec.toFixed(1)}s`;
      if (dom.clipSpeedDisplay) dom.clipSpeedDisplay.textContent = (activeClip.speed || 1.0).toFixed(2) + '×';
      if (dom.clipVolumeSlider) dom.clipVolumeSlider.value = (activeClip.volume || 1.0) * 100;
      if (dom.clipVolumeDisplay) dom.clipVolumeDisplay.textContent = Math.round((activeClip.volume || 1.0) * 100) + '%';
    }

    if (activeCap) {
      if (dom.selectedCaptionTimingBadge) dom.selectedCaptionTimingBadge.textContent = `${(activeCap.startMs / 1000).toFixed(1)}s – ${(activeCap.endMs / 1000).toFixed(1)}s`;
      if (dom.inspCaptionTextInput) {
        dom.inspCaptionTextInput.value = activeCap.words.map(w => w.text).join(' ');
      }
      if (dom.captionTopPctSlider) dom.captionTopPctSlider.value = activeCap.topPct || 60;
      if (dom.captionTopPctDisplay) dom.captionTopPctDisplay.textContent = (activeCap.topPct || 60) + '%';
      if (dom.captionScaleSlider) dom.captionScaleSlider.value = activeCap.scale || 1.0;
      if (dom.captionScaleDisplay) dom.captionScaleDisplay.textContent = (activeCap.scale || 1.0).toFixed(2) + '×';

      // Interactive Word-by-Word Accent Toggler
      if (dom.accentWordsChipContainer) {
        dom.accentWordsChipContainer.innerHTML = '';
        activeCap.words.forEach((w, wIdx) => {
          const chip = document.createElement('button');
          chip.type = 'button';
          chip.className = 'accent-word-chip' + (w.accent ? ' accented' : '');
          chip.textContent = w.text;
          chip.title = 'Click to toggle gold accent';
          chip.addEventListener('click', () => {
            pushHistory();
            w.accent = !w.accent;
            chip.classList.toggle('accented', w.accent);
          });
          dom.accentWordsChipContainer.appendChild(chip);
        });
      }
    }
  }

  function renderBrollInspector() {
    if (!dom.brollItemsList) return;
    dom.brollItemsList.innerHTML = '';

    state.brolls.forEach(b => {
      const card = document.createElement('div');
      card.className = 'inspector-card';
      card.innerHTML = `
        <div class="card-header">
          <span class="card-title">B-ROLL CUTAWAY</span>
          <span class="mono-badge">${(b.startMs / 1000).toFixed(1)}s – ${(b.endMs / 1000).toFixed(1)}s</span>
        </div>
        <p class="prop-label" style="margin:2px 0;">${b.query || 'Visual'}</p>
        <div class="speed-chips-row">
          <button type="button" class="speed-chip ${b.mode === 'fullscreen' ? 'active' : ''}" data-mode="fullscreen">Fullscreen</button>
          <button type="button" class="speed-chip ${b.mode === 'top' ? 'active' : ''}" data-mode="top">Top 45%</button>
          <button type="button" class="speed-chip ${b.mode === 'inset' ? 'active' : ''}" data-mode="inset">Inset Card</button>
        </div>
      `;
      card.querySelectorAll('.speed-chip').forEach(btn => {
        btn.addEventListener('click', () => {
          pushHistory();
          b.mode = btn.dataset.mode;
          renderBrollInspector();
        });
      });
      dom.brollItemsList.appendChild(card);
    });
  }

  function renderTimeline() {
    const totalSec = getTotalDurationSec();
    const pxPerSec = (dom.timelineZoomSlider ? Number(dom.timelineZoomSlider.value) : 80);
    const trackWidth = Math.max(1200, totalSec * pxPerSec);

    if (dom.timelineRuler) {
      dom.timelineRuler.style.width = trackWidth + 'px';
      dom.timelineRuler.innerHTML = '';
      for (let s = 0; s <= totalSec; s += 2) {
        const tick = document.createElement('div');
        tick.style.position = 'absolute';
        tick.style.left = (s * pxPerSec) + 'px';
        tick.style.top = '4px';
        tick.style.fontSize = '10px';
        tick.style.fontFamily = 'var(--font-mono)';
        tick.style.color = 'var(--text-on-surface-variant)';
        tick.textContent = formatTimecode(s);
        dom.timelineRuler.appendChild(tick);
      }
    }

    // Video Clips Lane
    if (dom.videoTrackLane) {
      dom.videoTrackLane.style.width = trackWidth + 'px';
      dom.videoTrackLane.querySelectorAll('.tl-clip-block').forEach(n => n.remove());

      let currentX = 0;
      state.clips.forEach(c => {
        const dur = (c.outSec - c.inSec) / (c.speed || 1.0);
        const w = dur * pxPerSec;
        const block = document.createElement('div');
        block.className = 'tl-clip-block' + (c.id === state.selectedClipId ? ' selected' : '');
        block.style.left = currentX + 'px';
        block.style.width = w + 'px';
        block.textContent = c.label || c.id;
        block.addEventListener('click', () => {
          state.selectedClipId = c.id;
          state.selectedId = c.id;
          renderAll();
        });
        dom.videoTrackLane.appendChild(block);
        currentX += w;
      });
    }

    // Captions Lane
    if (dom.captionTrackLane) {
      dom.captionTrackLane.style.width = trackWidth + 'px';
      dom.captionTrackLane.innerHTML = '';
      state.captions.forEach(cap => {
        const startSec = cap.startMs / 1000;
        const endSec = cap.endMs / 1000;
        const block = document.createElement('div');
        block.className = 'tl-cap-block';
        block.style.left = (startSec * pxPerSec) + 'px';
        block.style.width = ((endSec - startSec) * pxPerSec) + 'px';
        block.textContent = cap.words.map(w => w.text).join(' ');
        block.addEventListener('click', () => {
          state.selectedCapId = cap.id;
          state.selectedId = cap.id;
          state.currentTime = startSec;
          syncMediaPlayback();
          renderCaptionsInspector();
        });
        dom.captionTrackLane.appendChild(block);
      });
    }

    // B-Roll Lane
    if (dom.brollTrackLane) {
      dom.brollTrackLane.style.width = trackWidth + 'px';
      dom.brollTrackLane.innerHTML = '';
      state.brolls.forEach(br => {
        const startSec = br.startMs / 1000;
        const endSec = br.endMs / 1000;
        const block = document.createElement('div');
        block.className = 'tl-broll-block';
        block.style.left = (startSec * pxPerSec) + 'px';
        block.style.width = ((endSec - startSec) * pxPerSec) + 'px';
        block.textContent = `🎬 ${br.query || br.mode}`;
        dom.brollTrackLane.appendChild(block);
      });
    }

    updatePlayheadPosition();
  }

  function updatePlayheadPosition() {
    const pxPerSec = (dom.timelineZoomSlider ? Number(dom.timelineZoomSlider.value) : 80);
    const x = state.currentTime * pxPerSec;
    if (dom.timelinePlayhead) {
      dom.timelinePlayhead.style.left = x + 'px';
    }
    if (dom.currentPlayheadTime) {
      dom.currentPlayheadTime.textContent = formatTimecode(state.currentTime);
    }
    if (dom.totalDurationTime) {
      dom.totalDurationTime.textContent = formatTimecode(getTotalDurationSec());
    }
  }

  function renderAll() {
    renderClipsList();
    renderCaptionsInspector();
    renderBrollInspector();
    renderTimeline();
    drawTimelineWaveforms();
  }

  // --- Playback Synchronization ---
  function syncMediaPlayback() {
    if (dom.mainVideoEl) {
      dom.mainVideoEl.currentTime = state.currentTime;
      if (state.isPlaying) dom.mainVideoEl.play().catch(() => {});
      else dom.mainVideoEl.pause();
    }
    if (dom.brollVideoEl) {
      dom.brollVideoEl.currentTime = state.currentTime;
      if (state.isPlaying) dom.brollVideoEl.play().catch(() => {});
      else dom.brollVideoEl.pause();
    }
  }

  function togglePlayPause() {
    state.isPlaying = !state.isPlaying;
    if (dom.playPauseIcon) {
      dom.playPauseIcon.textContent = state.isPlaying ? 'pause' : 'play_arrow';
    }
    syncMediaPlayback();
  }

  // --- Setup Event Listeners ---
  function setupEvents() {
    // Project Name
    if (dom.projectNameInput) {
      dom.projectNameInput.addEventListener('change', () => {
        state.projectName = dom.projectNameInput.value.trim() || 'Untitled project';
      });
    }

    // Undo / Redo
    if (dom.undoBtn) dom.undoBtn.addEventListener('click', undo);
    if (dom.redoBtn) dom.redoBtn.addEventListener('click', redo);

    // AI Core Buttons
    if (dom.btnAutoArrange) dom.btnAutoArrange.addEventListener('click', autoArrangeClips);
    if (dom.btnAutoCut) dom.btnAutoCut.addEventListener('click', autoCutSilence);
    if (dom.generateCaptionsBtn) dom.generateCaptionsBtn.addEventListener('click', generateCaptions);
    if (dom.generateBrollBtn) dom.generateBrollBtn.addEventListener('click', generateAutoBroll);

    // Duplicate Banner
    if (dom.keepAllTakesBtn) {
      dom.keepAllTakesBtn.addEventListener('click', () => {
        state.dupSuggestion = [];
        if (dom.dupSuggestionBanner) dom.dupSuggestionBanner.classList.add('hidden');
      });
    }
    if (dom.removeDuplicatesBtn) {
      dom.removeDuplicatesBtn.addEventListener('click', () => {
        pushHistory();
        const dropSet = new Set(state.dupSuggestion);
        state.clips = state.clips.filter(c => !dropSet.has(c.id));
        state.dupSuggestion = [];
        if (dom.dupSuggestionBanner) dom.dupSuggestionBanner.classList.add('hidden');
        showToast('Removed duplicate takes');
        renderAll();
      });
    }

    // Transport
    if (dom.playPauseBtn) dom.playPauseBtn.addEventListener('click', togglePlayPause);
    if (dom.skipPrevClipBtn) {
      dom.skipPrevClipBtn.addEventListener('click', () => {
        state.currentTime = 0;
        syncMediaPlayback();
        updatePlayheadPosition();
      });
    }
    if (dom.skipNextClipBtn) {
      dom.skipNextClipBtn.addEventListener('click', () => {
        state.currentTime = getTotalDurationSec();
        syncMediaPlayback();
        updatePlayheadPosition();
      });
    }
    if (dom.fullscreenBtn) {
      dom.fullscreenBtn.addEventListener('click', () => {
        if (dom.previewCanvasBox && dom.previewCanvasBox.requestFullscreen) {
          dom.previewCanvasBox.requestFullscreen();
        }
      });
    }

    // Inspector Tabs Switcher
    const tabs = [
      { btn: dom.tabBtnCaptions, panel: dom.inspectorTabCaptions },
      { btn: dom.tabBtnBroll, panel: dom.inspectorTabBroll },
      { btn: dom.tabBtnStyles, panel: dom.inspectorTabStyles },
      { btn: dom.tabBtnSettings, panel: dom.inspectorTabSettings }
    ];
    tabs.forEach(t => {
      if (t.btn && t.panel) {
        t.btn.addEventListener('click', () => {
          tabs.forEach(o => {
            if (o.btn) o.btn.classList.remove('active');
            if (o.panel) o.panel.classList.remove('active');
          });
          t.btn.classList.add('active');
          t.panel.classList.add('active');
        });
      }
    });

    // Subtitle Vertical Placement Slider (Under chin)
    if (dom.captionTopPctSlider) {
      dom.captionTopPctSlider.addEventListener('input', e => {
        const val = Number(e.target.value);
        if (dom.captionTopPctDisplay) dom.captionTopPctDisplay.textContent = val + '%';
        const activeCap = state.captions.find(c => c.id === state.selectedCapId);
        if (activeCap) activeCap.topPct = val;
      });
    }

    // Subtitle Scale Slider
    if (dom.captionScaleSlider) {
      dom.captionScaleSlider.addEventListener('input', e => {
        const val = Number(e.target.value);
        if (dom.captionScaleDisplay) dom.captionScaleDisplay.textContent = val.toFixed(2) + '×';
        const activeCap = state.captions.find(c => c.id === state.selectedCapId);
        if (activeCap) activeCap.scale = val;
      });
    }

    // Live Phrase Text Editing
    if (dom.inspCaptionTextInput) {
      dom.inspCaptionTextInput.addEventListener('input', e => {
        const text = e.target.value;
        const activeCap = state.captions.find(c => c.id === state.selectedCapId);
        if (activeCap) {
          const rawWords = text.trim().split(/\s+/).filter(Boolean);
          activeCap.words = rawWords.map((rw, i) => ({
            text: rw,
            startMs: activeCap.startMs + i * 200,
            endMs: activeCap.startMs + (i + 1) * 200,
            accent: i === 0 || i === rawWords.length - 1
          }));
          renderCaptionsInspector();
        }
      });
    }

    // Accent Color Swatches
    if (dom.accentColorSwatches) {
      dom.accentColorSwatches.querySelectorAll('.color-swatch').forEach(sw => {
        sw.addEventListener('click', () => {
          pushHistory();
          dom.accentColorSwatches.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('active'));
          sw.classList.add('active');
          state.accentColor = sw.dataset.color || '#FFB020';
          showToast(`Accent color: ${state.accentColor}`);
        });
      });
    }

    // Timeline Zoom
    if (dom.timelineZoomSlider) {
      dom.timelineZoomSlider.addEventListener('input', renderTimeline);
    }

    // Timeline Playhead Scrubber Clicking
    if (dom.timelineCanvasScroll) {
      dom.timelineCanvasScroll.addEventListener('click', e => {
        const rect = dom.timelineCanvasScroll.getBoundingClientRect();
        const clickX = e.clientX - rect.left + dom.timelineCanvasScroll.scrollLeft;
        const pxPerSec = (dom.timelineZoomSlider ? Number(dom.timelineZoomSlider.value) : 80);
        state.currentTime = Math.max(0, Math.min(getTotalDurationSec(), clickX / pxPerSec));
        syncMediaPlayback();
        updatePlayheadPosition();
      });
    }

    // Keyboard Shortcuts: Space (Play/Pause), S (Split), Q (Trim In), W (Trim Out), Del (Delete)
    window.addEventListener('keydown', e => {
      const tag = (e.target && e.target.tagName) || '';
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;

      if (e.code === 'Space') {
        e.preventDefault();
        togglePlayPause();
      } else if (e.key === 's' || e.key === 'S') {
        e.preventDefault();
        splitClipAtPlayhead();
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        deleteSelectedClip();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        redo();
      }
    });

    // Modals: Export, Post Caption, Schedule, AI Key
    if (dom.btnExportMp4 && dom.exportModal) {
      dom.btnExportMp4.addEventListener('click', () => dom.exportModal.classList.remove('hidden'));
    }
    if (dom.closeExportModalBtn && dom.exportModal) {
      dom.closeExportModalBtn.addEventListener('click', () => dom.exportModal.classList.add('hidden'));
    }
    if (dom.openPostCaptionBtn && dom.exportModal) {
      dom.openPostCaptionBtn.addEventListener('click', () => {
        dom.exportModal.classList.remove('hidden');
        generatePostCaption();
      });
    }
    if (dom.generatePostCaptionBtn) {
      dom.generatePostCaptionBtn.addEventListener('click', generatePostCaption);
    }
    if (dom.copyHashtagsBtn) {
      dom.copyHashtagsBtn.addEventListener('click', () => {
        if (dom.postCaptionTextarea) {
          navigator.clipboard.writeText(dom.postCaptionTextarea.value);
          showToast('Caption & #KaiCenat copied!');
        }
      });
    }
    if (dom.openScheduleQueueBtn && dom.scheduleModal) {
      dom.openScheduleQueueBtn.addEventListener('click', () => dom.scheduleModal.classList.remove('hidden'));
    }
    if (dom.closeScheduleModalBtn && dom.scheduleModal) {
      dom.closeScheduleModalBtn.addEventListener('click', () => dom.scheduleModal.classList.add('hidden'));
    }
    if (dom.openAiSettingsBtn && dom.aiKeyModal) {
      dom.openAiSettingsBtn.addEventListener('click', () => dom.aiKeyModal.classList.remove('hidden'));
    }
    if (dom.closeAiKeyModalBtn && dom.aiKeyModal) {
      dom.closeAiKeyModalBtn.addEventListener('click', () => dom.aiKeyModal.classList.add('hidden'));
    }
    if (dom.saveAiKeyBtn) {
      dom.saveAiKeyBtn.addEventListener('click', () => {
        const key = dom.userAiApiKeyInput ? dom.userAiApiKeyInput.value.trim() : '';
        if (key) localStorage.setItem('whop_gemini_key', key);
        showToast('AI Settings Saved');
        if (dom.aiKeyModal) dom.aiKeyModal.classList.add('hidden');
      });
    }
  }

  function splitClipAtPlayhead() {
    const activeClip = state.clips.find(c => c.id === state.selectedClipId) || state.clips[0];
    if (!activeClip) return;
    const splitTime = state.currentTime;
    if (splitTime <= activeClip.inSec + 0.3 || splitTime >= activeClip.outSec - 0.3) {
      showToast('Playhead too close to clip boundary to split', true);
      return;
    }
    pushHistory();
    const clip2 = {
      ...activeClip,
      id: activeClip.id + '-part2',
      label: activeClip.label + ' (Part 2)',
      inSec: splitTime,
      outSec: activeClip.outSec
    };
    activeClip.outSec = splitTime;
    state.clips.push(clip2);
    showToast('Split clip at playhead');
    renderAll();
  }

  function deleteSelectedClip() {
    if (state.clips.length <= 1) {
      showToast('Cannot delete the last clip', true);
      return;
    }
    pushHistory();
    state.clips = state.clips.filter(c => c.id !== state.selectedClipId);
    state.selectedClipId = state.clips[0].id;
    state.selectedId = state.selectedClipId;
    showToast('Deleted clip');
    renderAll();
  }

  // --- US/UK Post Caption Generator ---
  function generatePostCaption() {
    const captionsText = state.captions.map(c => c.words.map(w => w.text).join(' ')).join(' ');
    const postCaption = `Kai Cenat had the entire room in tears during this stream moment! 😭🔥\n\nWhat would you have done in this situation? Drop a comment below!\n\n#KaiCenat #Shorts #Viral #TwitchMoments #FYP`;
    if (dom.postCaptionTextarea) {
      dom.postCaptionTextarea.value = postCaption;
    }
    showToast('US/UK high-CPM caption generated!');
  }

  // --- Initialization ---
  function init() {
    cacheDom();
    setupEvents();
    renderAll();

    // Hook video element time updates
    if (dom.mainVideoEl) {
      dom.mainVideoEl.src = state.clips[0].src;
      dom.mainVideoEl.addEventListener('timeupdate', () => {
        if (state.isPlaying) {
          state.currentTime = dom.mainVideoEl.currentTime;
          updatePlayheadPosition();
        }
      });
      dom.mainVideoEl.addEventListener('ended', () => {
        state.isPlaying = false;
        if (dom.playPauseIcon) dom.playPauseIcon.textContent = 'play_arrow';
      });
    }

    if (dom.brollVideoEl && state.brolls[0]) {
      dom.brollVideoEl.src = state.brolls[0].src;
    }

    // Load initial waveform
    loadWaveformForSrc(state.clips[0].src);

    // Start 60fps canvas loop
    requestAnimationFrame(animationLoop);
    console.log('[AutoBroll] Studio initialized with clean Obsidian Edit design.');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
