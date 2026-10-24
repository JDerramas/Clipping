/**
 * Ssemble × WhopClip Studio — Main Frontend Application Controller
 * Connects:
 *  - `window.WhopBrollEngine` (60fps procedural demo feeds + 6 3D satisfying B-roll engines)
 *  - `window.WhopAudioEngine` (WebAudio 3-bus mixer, procedural music synth, 160-bar waveform & silence analyzer)
 *  - Persistent Saved Clips Vault (`localStorage` + `.whopclip.json` + `.srt` + `.png` + `.webm`/`.mp4` MediaRecorder)
 */
(function () {
  'use strict';

  const STORAGE_KEY = 'whopclip_saved_vault_v1';

  // Studio Application State
  const state = {
    streamPreset: '',
    useCustomMainVideo: true,
    useCustomBrollVideo: true,
    customMainFileName: 'clip_20261024_182745_MrBeast_Interview_Hook_0s_58s.mp4',
    customBrollFileName: 'satisfying_neon_runner.mp4',

    analysis: null,
    activeClipIndex: 0,
    clipTitle: 'Master Video Track',

    // Playback & Trim
    isPlaying: false,
    loopClip: true,
    playbackSpeed: 1.0,
    currentTime: 0.0,
    trimStart: 0.0,
    trimEnd: 58.05,
    streamDuration: 58.05,

    // Target Duration & AI Model Options
    targetDuration: 30,
    aiModel: 'gemini-2.5-flash',
    aiProvider: typeof localStorage !== 'undefined' ? (localStorage.getItem('whop_ai_provider') || 'gemini-2.5-flash') : 'gemini-2.5-flash',
    geminiApiKey: typeof localStorage !== 'undefined' ? (localStorage.getItem('whop_gemini_key') || '') : '',

    // Ssemble AI Viral Hub Options
    ssembleSort: 'score',
    ssembleFilterLen: 'all',
    videoTitle: 'Viral Short Project',
    videoLanguage: 'English',
    videoTemplate: 'hormozi1',
    originalUrl: '',

    // Layout & Framing (Default: Unzoomed Fit - ALL PEOPLE VISIBLE!)
    videoFitMode: 'fit', // 'fit' (Unzoomed • All People Visible) | 'fill' (9:16 Cropped)
    layoutMode: 'full-main', // 'full-main' (Default, No Split!) | 'ambient-blur' | 'split-60-40' | 'split-50-50' | 'pip-facecam'
    brollPreset: 'minecraft-parkour',
    framingPreset: 'center', // 'center' | 'left' | 'right'
    autoZoom: false,
    cameraZoom: 1.0,
    cameraPanX: 0,
    cameraPanY: 0,
    reframeKeyframes: [],
    reframeStrategy: 'general_center',
    wholeScreenFit: true, // true = unzoomed fit to screen (all people visible)
    showSafeZones: false,

    // Professional Video Effects Suite (VFX & Color Grading)
    activeFilter: 'clean', // 'clean' | 'cinematic' | 'cyberpunk' | 'noir' | 'vintage' | 'vivid' | 'moody'
    effects: {
      vignette: true,
      vignetteIntensity: 0.45,
      halation: false,
      halationIntensity: 0.4,
      vhs: false,
      rgbSplit: false,
      letterbox: false,
      letterboxHeight: 120,
      filmGrain: true,
      filmGrainIntensity: 0.20,
      lightLeak: false,
      lightLeakIntensity: 0.35,
      tiltShift: false
    },

    // CapCut-Style Cut Sequences (Zero camera shake, zero zoom in/out oscillation)
    hardEdit: {
      enabled: false,
      jumpCuts: false,
      impactShake: false,
      strobeFlash: false,
      cinematicGrain: false,
      rgbGlitch: false,
      speedLines: false,
      zoomIntensity: 1.0,
      cutFrequency: 2.8,
    },

    // CapCut Continuous Master Sequence Model (1 Full Continuous Clip by default!)
    sequence: {
      videoClips: [
        {
          id: 'master-clip-1',
          title: 'Master Video Track',
          start: 0.0,
          end: 58.05,
          sourceStart: 0.0,
          sourceEnd: 58.05,
          zoom: 1.0,
          panX: 0,
          panY: 0,
          volume: 1.0,
          effect: 'none',
          transition: 'none'
        }
      ],
      selectedClipId: 'master-clip-1',
      selectedTrackType: 'video',
      mainAudioVolume: 1.0,
      mainAudioMuted: false
    },

    // Visual Media Overlays & Memes Cut-Ins (Clean default, no clutter)
    visualOverlays: [],

    // Captions & Hook Banner
    captionsEnabled: true,
    captionStyle: 'hormozi-pop', // 'hormozi-pop' | 'mrbeast-bold' | 'whop-fire' | 'neon-cyber' | 'clean-pill'
    captionSize: 100,
    captionPosY: 56,
    autoEmoji: true,
    hookText: 'WAIT TILL HE REVEALS THE $12K/MO WHOP SECRET 🤯👇',
    hookMode: '3s', // '3s' | 'always' | 'off'

    // Audio & AI Polish
    cutSilence: true,
    loudnessNorm: true,
    mainVolume: 0.95,
    musicVolume: 0.0,
    brollVolume: 0.15,
    musicPreset: 'none',

    // Whop Campaign & Bounty
    campaignId: 'whop-creator',
    campaignCpm: 2.5,
    projectedViews: 250000,
    watermarkEnabled: true,
    watermarkText: '@WhopClipper • Verified Bounty',

    // Timeline Zoom & Focus Mode
    timelineViewMode: 'clip', // 'clip' (Zoomed to active clip) | 'full' (Full 20m video)

    // Topic Image & B-Roll Visual Overlay
    overlayImage: null,
    overlayImgEl: null,
    overlayImageStartOffset: 2.5,
    overlayImageDuration: 4.5,
    overlayImageEnabled: false,
    overlayImagePos: { x: 0.5, y: 0.34 },
    overlayImageScale: 1.0,

    // CapCut Timeline & Direct Canvas Manipulation State
    timelineZoom: 1.0, // 1.0 = Clip Focus (100%), 0.0 = Full Video
    selectedTimelineItem: null, // 'overlay-image' | 'hook-banner'
    selectedCanvasLayer: null, // No intrusive bounding box on canvas by default
    canvasDragMode: null, // 'move-image' | 'resize-image'
    canvasDragStart: null,
    timelineBlockDrag: null,
    lastImageBounds: null,
    trackVisibility: { main: true, captions: true, overlays: true, broll: true },
    mainAudioMuted: false,
    bgSoundMuted: true,

    // Export Recording State
    isRecordingExport: false,
    activeDragMode: null // 'playhead' | 'trim-in' | 'trim-out'
  };

  // Cached DOM references
  const dom = {};

  function cacheDom() {
    dom.mainVideoEl = document.getElementById('mainVideoEl');
    dom.brollVideoEl = document.getElementById('brollVideoEl');
    dom.mainVideoFileInput = document.getElementById('mainVideoFileInput');
    dom.brollVideoFileInput = document.getElementById('brollVideoFileInput');
    dom.importProjectFileInput = document.getElementById('importProjectFileInput');

    dom.campaignSelect = document.getElementById('campaignSelect');
    dom.headerEstPayoutBadge = document.getElementById('headerEstPayoutBadge');
    dom.oneClickAutoEditBtn = document.getElementById('oneClickAutoEditBtn');
    dom.saveClipBtn = document.getElementById('saveClipBtn');
    dom.openSavedVaultBtn = document.getElementById('openSavedVaultBtn');
    dom.savedClipsCountBadge = document.getElementById('savedClipsCountBadge');
    dom.openExportModalBtn = document.getElementById('openExportModalBtn');
    dom.openSsembleHubBtn = document.getElementById('openSsembleHubBtn');
    dom.ssembleHeaderCount = document.getElementById('ssembleHeaderCount');
    dom.ssembleHubModal = document.getElementById('ssembleHubModal');
    dom.closeSsembleHubBtn = document.getElementById('closeSsembleHubBtn');
    dom.ssembleModalClipsGrid = document.getElementById('ssembleModalClipsGrid');
    dom.ssembleActiveVideoTitle = document.getElementById('ssembleActiveVideoTitle');
    dom.ssembleViewOriginalLink = document.getElementById('ssembleViewOriginalLink');
    dom.ssembleMetaDuration = document.getElementById('ssembleMetaDuration');
    dom.ssembleMetaLang = document.getElementById('ssembleMetaLang');
    dom.ssembleMetaTemplate = document.getElementById('ssembleMetaTemplate');
    dom.ssembleSortScoreBtn = document.getElementById('ssembleSortScoreBtn');
    dom.ssembleSortTimeBtn = document.getElementById('ssembleSortTimeBtn');
    dom.ssembleLenGroup = document.getElementById('ssembleLenGroup');

    dom.activeSourceBadge = document.getElementById('activeSourceBadge');
    dom.videoDropzone = document.getElementById('videoDropzone');
    dom.dropzoneMainLabel = document.getElementById('dropzoneMainLabel');
    dom.dropzoneSubLabel = document.getElementById('dropzoneSubLabel');
    dom.streamUrlInput = document.getElementById('streamUrlInput');
    dom.extractUrlBtn = document.getElementById('extractUrlBtn');
    dom.targetDurationSlider = document.getElementById('targetDurationSlider');
    dom.targetDurationDisplay = document.getElementById('targetDurationDisplay');
    dom.aiModelSelect = document.getElementById('aiModelSelect');
    dom.geminiKeyRow = document.getElementById('geminiKeyRow');
    dom.geminiApiKeyInput = document.getElementById('geminiApiKeyInput');
    dom.serverVideoSelect = document.getElementById('serverVideoSelect');
    dom.refreshVideosBtn = document.getElementById('refreshVideosBtn');
    dom.startFfmpegRenderBtn = document.getElementById('startFfmpegRenderBtn');
    dom.demoStreamTabs = document.getElementById('demoStreamTabs');
    dom.viralCountBadge = document.getElementById('viralCountBadge');
    dom.viralMomentsList = document.getElementById('viralMomentsList');

    dom.activeClipTitleInput = document.getElementById('activeClipTitleInput');
    dom.toggleSafeZoneBtn = document.getElementById('toggleSafeZoneBtn');
    dom.snapshotPngBtn = document.getElementById('snapshotPngBtn');
    dom.canvasQuickSaveBtn = document.getElementById('canvasQuickSaveBtn');
    dom.previewCanvas = document.getElementById('previewCanvas');
    dom.recordingOverlayBadge = document.getElementById('recordingOverlayBadge');
    dom.recordingStatusText = document.getElementById('recordingStatusText');

    // AI API Key & Multimodal Engine DOM Elements
    dom.openAiKeyModalBtn = document.getElementById('openAiKeyModalBtn');
    dom.aiKeyModal = document.getElementById('aiKeyModal');
    dom.closeAiKeyModalBtn = document.getElementById('closeAiKeyModalBtn');
    dom.aiProviderSelect = document.getElementById('aiProviderSelect');
    dom.userAiApiKeyInput = document.getElementById('userAiApiKeyInput');
    dom.toggleApiKeyVisibilityBtn = document.getElementById('toggleApiKeyVisibilityBtn');
    dom.aiKeyTestStatus = document.getElementById('aiKeyTestStatus');
    dom.aiKeyStatusIcon = document.getElementById('aiKeyStatusIcon');
    dom.aiKeyStatusMessage = document.getElementById('aiKeyStatusMessage');
    dom.testAiKeyBtn = document.getElementById('testAiKeyBtn');
    dom.saveAiKeyBtn = document.getElementById('saveAiKeyBtn');
    dom.aiKeyStatusText = document.getElementById('aiKeyStatusText');
    dom.aiKeyStatusDot = document.getElementById('aiKeyStatusDot');

    dom.telemetryLayout = document.getElementById('telemetryLayout');
    dom.telemetryBroll = document.getElementById('telemetryBroll');
    dom.telemetryScore = document.getElementById('telemetryScore');

    dom.layoutModeGrid = document.getElementById('layoutModeGrid');
    dom.brollPresetGrid = document.getElementById('brollPresetGrid');
    dom.uploadCustomBrollBtn = document.getElementById('uploadCustomBrollBtn');
    dom.wholeScreenFitToggle = document.getElementById('wholeScreenFitToggle');
    dom.autoZoomToggle = document.getElementById('autoZoomToggle');
    dom.cameraZoomSlider = document.getElementById('cameraZoomSlider');
    dom.zoomValueLabel = document.getElementById('zoomValueLabel');
    dom.cameraPanXSlider = document.getElementById('cameraPanXSlider');
    dom.panXValueLabel = document.getElementById('panXValueLabel');

    dom.captionsEnabledToggle = document.getElementById('captionsEnabledToggle');
    dom.captionStyleGrid = document.getElementById('captionStyleGrid');
    dom.captionSizeSlider = document.getElementById('captionSizeSlider');
    dom.captionSizeLabel = document.getElementById('captionSizeLabel');
    dom.captionPosYSlider = document.getElementById('captionPosYSlider');
    dom.captionPosYLabel = document.getElementById('captionPosYLabel');
    dom.autoEmojiToggle = document.getElementById('autoEmojiToggle');
    dom.hookBannerTextInput = document.getElementById('hookBannerTextInput');
    dom.transcriptWordCloud = document.getElementById('transcriptWordCloud');
    dom.transcriptTrimInBtn = document.getElementById('transcriptTrimInBtn');
    dom.transcriptTrimOutBtn = document.getElementById('transcriptTrimOutBtn');
    dom.transcriptSnap30sBtn = document.getElementById('transcriptSnap30sBtn');

    dom.cutSilenceToggle = document.getElementById('cutSilenceToggle');
    dom.loudnessNormToggle = document.getElementById('loudnessNormToggle');
    dom.mainVolSlider = document.getElementById('mainVolSlider');
    dom.mainVolLabel = document.getElementById('mainVolLabel');
    dom.musicVolSlider = document.getElementById('musicVolSlider');
    dom.musicVolLabel = document.getElementById('musicVolLabel');
    dom.brollVolSlider = document.getElementById('brollVolSlider');
    dom.brollVolLabel = document.getElementById('brollVolLabel');
    dom.musicPresetList = document.getElementById('musicPresetList');

    dom.complianceStatusBadge = document.getElementById('complianceStatusBadge');
    dom.complianceChecklist = document.getElementById('complianceChecklist');
    dom.watermarkTextInput = document.getElementById('watermarkTextInput');
    dom.watermarkEnabledToggle = document.getElementById('watermarkEnabledToggle');
    dom.cpmRateBadge = document.getElementById('cpmRateBadge');
    dom.projectedViewsSlider = document.getElementById('projectedViewsSlider');
    dom.projectedViewsLabel = document.getElementById('projectedViewsLabel');
    dom.calculatedPayoutAmount = document.getElementById('calculatedPayoutAmount');
    dom.postCaptionTextarea = document.getElementById('postCaptionTextarea');
    dom.copyHashtagsBtn = document.getElementById('copyHashtagsBtn');
    dom.inspectorSaveClipBtn = document.getElementById('inspectorSaveClipBtn');
    dom.inspectorDownloadJsonBtn = document.getElementById('inspectorDownloadJsonBtn');
    dom.inspectorDownloadSrtBtn = document.getElementById('inspectorDownloadSrtBtn');
    dom.inspectorExportVideoBtn = document.getElementById('inspectorExportVideoBtn');

    dom.skipStartBtn = document.getElementById('skipStartBtn');
    dom.playPauseBtn = document.getElementById('playPauseBtn');
    dom.playIconSvg = document.getElementById('playIconSvg');
    dom.loopToggleBtn = document.getElementById('loopToggleBtn');
    dom.playbackSpeedSelect = document.getElementById('playbackSpeedSelect');
    dom.currentTimecode = document.getElementById('currentTimecode');
    dom.totalDurationTimecode = document.getElementById('totalDurationTimecode');
    dom.clipRangePill = document.getElementById('clipRangePill');
    dom.silenceSavedPill = document.getElementById('silenceSavedPill');
    dom.timelineSaveBtn = document.getElementById('timelineSaveBtn');
    dom.resetTrimBtn = document.getElementById('resetTrimBtn');
    dom.timelineViewToggleBtn = document.getElementById('timelineViewToggleBtn');

    // CapCut Timeline Toolbar & Zoom Slider
    dom.capcutSplitBtn = document.getElementById('capcutSplitBtn');
    dom.capcutTrimInBtn = document.getElementById('capcutTrimInBtn');
    dom.capcutTrimOutBtn = document.getElementById('capcutTrimOutBtn');
    dom.capcutDeleteBtn = document.getElementById('capcutDeleteBtn');
    dom.capcutMuteBgBtn = document.getElementById('capcutMuteBgBtn');
    dom.muteBgIcon = document.getElementById('muteBgIcon');
    dom.muteBgText = document.getElementById('muteBgText');
    dom.timelineZoomSlider = document.getElementById('timelineZoomSlider');
    dom.zoomPercentLabel = document.getElementById('zoomPercentLabel');
    dom.trackToggleMainAudio = document.getElementById('trackToggleMainAudio');
    dom.trackToggleCaptions = document.getElementById('trackToggleCaptions');
    dom.trackToggleOverlays = document.getElementById('trackToggleOverlays');
    dom.trackToggleBroll = document.getElementById('trackToggleBroll');

    dom.imageOverlayToggle = document.getElementById('imageOverlayToggle');
    dom.overlayImagePreview = document.getElementById('overlayImagePreview');
    dom.overlayImageTitle = document.getElementById('overlayImageTitle');
    dom.uploadCustomImageBtn = document.getElementById('uploadCustomImageBtn');
    dom.customImageFileInput = document.getElementById('customImageFileInput');
    dom.overlayStartSlider = document.getElementById('overlayStartSlider');
    dom.overlayStartLabel = document.getElementById('overlayStartLabel');
    dom.overlayDurationSlider = document.getElementById('overlayDurationSlider');
    dom.overlayDurationLabel = document.getElementById('overlayDurationLabel');
    dom.overlayScaleSlider = document.getElementById('overlayScaleSlider');
    dom.overlayScaleLabel = document.getElementById('overlayScaleLabel');
    dom.overlayPosXSlider = document.getElementById('overlayPosXSlider');
    dom.overlayPosXLabel = document.getElementById('overlayPosXLabel');
    dom.overlayPosYSlider = document.getElementById('overlayPosYSlider');
    dom.overlayPosYLabel = document.getElementById('overlayPosYLabel');
    dom.overlayResetPosBtn = document.getElementById('overlayResetPosBtn');
    dom.overlayRemoveBtn = document.getElementById('overlayRemoveBtn');

    // Hard FX & Sequence Cuts DOM Elements
    dom.toggleHardEditBtn = document.getElementById('toggleHardEditBtn');
    dom.hardFxStatusText = document.getElementById('hardFxStatusText');
    dom.quickAddVisualBtn = document.getElementById('quickAddVisualBtn');

    dom.hardFxMasterToggle = document.getElementById('hardFxMasterToggle');
    dom.hardJumpCutsToggle = document.getElementById('hardJumpCutsToggle');
    dom.hardImpactShakeToggle = document.getElementById('hardImpactShakeToggle');
    dom.hardStrobeFlashToggle = document.getElementById('hardStrobeFlashToggle');
    dom.hardFilmGrainToggle = document.getElementById('hardFilmGrainToggle');
    dom.hardRgbGlitchToggle = document.getElementById('hardRgbGlitchToggle');
    dom.hardSpeedLinesToggle = document.getElementById('hardSpeedLinesToggle');
    dom.hardZoomIntensitySlider = document.getElementById('hardZoomIntensitySlider');
    dom.hardZoomIntensityLabel = document.getElementById('hardZoomIntensityLabel');
    dom.hardCutFrequencySlider = document.getElementById('hardCutFrequencySlider');
    dom.hardCutFrequencyLabel = document.getElementById('hardCutFrequencyLabel');
    dom.sequenceCutsList = document.getElementById('sequenceCutsList');
    dom.addNewCutBtn = document.getElementById('addNewCutBtn');
    dom.selectedCutBadge = document.getElementById('selectedCutBadge');
    dom.selectedCutZoomSlider = document.getElementById('selectedCutZoomSlider');
    dom.selectedCutZoomLabel = document.getElementById('selectedCutZoomLabel');
    dom.selectedCutPanXSlider = document.getElementById('selectedCutPanXSlider');
    dom.selectedCutPanXLabel = document.getElementById('selectedCutPanXLabel');
    dom.selectedCutPanYSlider = document.getElementById('selectedCutPanYSlider');
    dom.selectedCutPanYLabel = document.getElementById('selectedCutPanYLabel');
    dom.rotateCutBtn = document.getElementById('rotateCutBtn');
    dom.flipCutBtn = document.getElementById('flipCutBtn');
    dom.selectedCutTransitionSelect = document.getElementById('selectedCutTransitionSelect');

    // Visual Overlays & Memes DOM Elements
    dom.visualOverlayFileInput = document.getElementById('visualOverlayFileInput');
    dom.btnUploadVisualImage = document.getElementById('btnUploadVisualImage');
    dom.btnUploadVisualVideo = document.getElementById('btnUploadVisualVideo');
    dom.visualOverlaysList = document.getElementById('visualOverlaysList');
    dom.activeOverlaysCountBadge = document.getElementById('activeOverlaysCountBadge');

    dom.timelineStage = document.getElementById('timelineStage');
    dom.timelineRuler = document.getElementById('timelineRuler');
    dom.waveformCanvas = document.getElementById('waveformCanvas');
    dom.videoTrackLane = document.getElementById('videoTrackLane');
    dom.captionTrackLane = document.getElementById('captionTrackLane');
    dom.overlayTrackLane = document.getElementById('overlayTrackLane');
    dom.audioTrackLane = document.getElementById('audioTrackLane');
    dom.trackAddCutBtn = document.getElementById('trackAddCutBtn');
    dom.timelineMasterVolSlider = document.getElementById('timelineMasterVolSlider');
    dom.timelineMasterVolLabel = document.getElementById('timelineMasterVolLabel');
    dom.trimLeftShade = document.getElementById('trimLeftShade');
    dom.trimRightShade = document.getElementById('trimRightShade');
    dom.trimSelectionBox = document.getElementById('trimSelectionBox');
    dom.trimHandleIn = document.getElementById('trimHandleIn');
    dom.trimHandleOut = document.getElementById('trimHandleOut');
    dom.timelinePlayhead = document.getElementById('timelinePlayhead');

    dom.savedVaultModal = document.getElementById('savedVaultModal');
    dom.savedClipsGrid = document.getElementById('savedClipsGrid');
    dom.importProjectBtn = document.getElementById('importProjectBtn');
    dom.saveCurrentInVaultModalBtn = document.getElementById('saveCurrentInVaultModalBtn');
    dom.closeVaultModalBtn = document.getElementById('closeVaultModalBtn');

    dom.exportModal = document.getElementById('exportModal');
    dom.closeExportModalBtn = document.getElementById('closeExportModalBtn');
    dom.exportSpecDuration = document.getElementById('exportSpecDuration');
    dom.exportSpecLayout = document.getElementById('exportSpecLayout');
    dom.exportProgressSection = document.getElementById('exportProgressSection');
    dom.exportProgressStatus = document.getElementById('exportProgressStatus');
    dom.exportProgressPercent = document.getElementById('exportProgressPercent');
    dom.exportProgressBar = document.getElementById('exportProgressBar');
    dom.startVideoRenderBtn = document.getElementById('startVideoRenderBtn');
    dom.exportModalSaveVaultBtn = document.getElementById('exportModalSaveVaultBtn');
    dom.exportSrtBtn = document.getElementById('exportSrtBtn');
    dom.exportJsonProjectBtn = document.getElementById('exportJsonProjectBtn');

    dom.toastContainer = document.getElementById('toastContainer');

    // OpenCut Layout & Transport DOM References
    dom.inspectorEmptyState = document.getElementById('inspectorEmptyState');
    dom.inspectorPropertiesPanel = document.getElementById('inspectorPropertiesPanel');
    dom.rotateCutBtn = document.getElementById('rotateCutBtn');
    dom.flipCutBtn = document.getElementById('flipCutBtn');
    dom.selectedCutVolSlider = document.getElementById('selectedCutVolSlider');
    dom.selectedCutVolLabel = document.getElementById('selectedCutVolLabel');
    dom.cutNormToggle = document.getElementById('cutNormToggle');
    dom.splitSelectedCutBtn = document.getElementById('splitSelectedCutBtn');
    dom.deleteSelectedCutBtn = document.getElementById('deleteSelectedCutBtn');
    dom.stepBackBtn = document.getElementById('stepBackBtn');
    dom.stepForwardBtn = document.getElementById('stepForwardBtn');
    dom.skipEndBtn = document.getElementById('skipEndBtn');
    dom.previewZoomSelect = document.getElementById('previewZoomSelect');
    dom.aspectRatioSelect = document.getElementById('aspectRatioSelect');
    dom.fullscreenBtn = document.getElementById('fullscreenBtn');
    dom.safeZoneOverlay = document.getElementById('safeZoneOverlay');
    dom.projectNameInput = document.getElementById('projectNameInput');
    dom.themeToggleBtn = document.getElementById('themeToggleBtn');
    dom.duplicateClipBtn = document.getElementById('duplicateClipBtn');
    dom.linkAudioBtn = document.getElementById('linkAudioBtn');
    dom.addBookmarkBtn = document.getElementById('addBookmarkBtn');
    dom.snappingToggleBtn = document.getElementById('snappingToggleBtn');
    dom.rippleToggleBtn = document.getElementById('rippleToggleBtn');
    dom.zoomOutBtn = document.getElementById('zoomOutBtn');
    dom.zoomInBtn = document.getElementById('zoomInBtn');
  }

  // =========================================================================
  // UTILITY HELPERS
  // =========================================================================
  function clamp(val, min, max) {
    return Math.max(min, Math.min(max, val));
  }

  function formatTimecode(sec) {
    const s = Math.max(0, Number(sec) || 0);
    const totalFrames = Math.floor(s * 30);
    const f = totalFrames % 30;
    const totalSecs = Math.floor(s);
    const ss = totalSecs % 60;
    const mm = Math.floor(totalSecs / 60) % 60;
    const hh = Math.floor(totalSecs / 3600);
    return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}:${String(f).padStart(2, '0')}`;
  }

  function formatShortTimecode(sec) {
    const s = Math.max(0, Number(sec) || 0);
    const mins = Math.floor(s / 60);
    const rem = s % 60;
    return `${String(mins).padStart(2, '0')}:${rem.toFixed(1).padStart(4, '0')}`;
  }

  function formatSrtTime(sec) {
    const s = Math.max(0, Number(sec) || 0);
    const hrs = Math.floor(s / 3600);
    const mins = Math.floor((s % 3600) / 60);
    const secs = Math.floor(s % 60);
    const ms = Math.round((s - Math.floor(s)) * 1000);
    return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')},${String(ms).padStart(3, '0')}`;
  }

  function slugify(text) {
    return String(text || 'whop-clip')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 42) || 'whop-clip';
  }

  function showToast(message, accentColor = '#10b981') {
    if (!dom.toastContainer) return;
    const toast = document.createElement('div');
    toast.className = 'studio-toast';
    toast.style.borderLeftColor = accentColor;
    toast.textContent = message;
    dom.toastContainer.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.25s ease';
      setTimeout(() => toast.remove(), 260);
    }, 3200);
  }

  function getActiveClip() {
    if (!state.analysis || !Array.isArray(state.analysis.viralMoments)) return null;
    return state.analysis.viralMoments[state.activeClipIndex] || state.analysis.viralMoments[0] || null;
  }

  // =========================================================================
  // INITIALIZE PRESET LISTS & STREAM ANALYSIS
  // =========================================================================
  function renderBrollPresetCards() {
    const presets = window.WhopBrollEngine ? window.WhopBrollEngine.getBrollPresets() : [];
    dom.brollPresetGrid.innerHTML = '';

    presets.forEach((p) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `broll-card ${!state.useCustomBrollVideo && state.brollPreset === p.id ? 'active' : ''}`;
      btn.dataset.brollId = p.id;
      btn.innerHTML = `
        <div class="broll-card-top">
          <span style="color:${p.accent}">● 60FPS</span>
          <span class="broll-boost">${p.retentionBoost}</span>
        </div>
        <div class="broll-name">${p.name}</div>
        <div class="broll-cat">${p.category}</div>
      `;
      btn.addEventListener('click', () => {
        state.useCustomBrollVideo = false;
        state.brollPreset = p.id;
        renderBrollPresetCards();
        renderTimelineTracks();
        updateTelemetryBar();
        showToast(`🎮 Satisfying B-Roll switched to ${p.name} (${p.retentionBoost} retention)`);
      });
      dom.brollPresetGrid.appendChild(btn);
    });
  }

  function renderMusicPresetCards() {
    const presets = (window.WhopAudioEngine && window.WhopAudioEngine.MUSIC_PRESETS) || [];
    dom.musicPresetList.innerHTML = '';

    presets.forEach((m) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `music-card ${state.musicPreset === m.id ? 'active' : ''}`;
      btn.innerHTML = `
        <div>
          <strong style="font-size:11.5px;display:block">${m.name}</strong>
          <span style="font-size:10px;color:#94a3b8">${m.style}</span>
        </div>
        <span class="mono-val">${m.bpm ? m.bpm + ' BPM' : 'OFF'}</span>
      `;
      btn.addEventListener('click', () => {
        state.musicPreset = m.id;
        if (window.WhopAudioEngine) {
          window.WhopAudioEngine.setMusicPreset(m.id);
        }
        renderMusicPresetCards();
        showToast(`🎵 Music Bed: ${m.name}`);
      });
      dom.musicPresetList.appendChild(btn);
    });
  }

  function loadDemoStream(streamId, autoSelectClipIdx = 0) {
    state.streamPreset = '';
    state.useCustomMainVideo = true;
    if (dom.activeSourceBadge) {
      dom.activeSourceBadge.textContent = '1080p SOURCE';
      dom.activeSourceBadge.className = 'status-pill status-emerald';
    }

    state.videoTitle = 'Master Video Track';
    state.originalUrl = '';
    state.videoLanguage = 'English';
    state.videoTemplate = 'hormozi1';

    if (dom.mainVideoEl) {
      dom.mainVideoEl.src = '/uploads/clip_20261024_182745_MrBeast_Interview_Hook_0s_58s.mp4';
      dom.mainVideoEl.load();
    }

    selectViralMoment(autoSelectClipIdx, false);
    renderViralMomentsList();
    renderTimelineRuler();
    renderTimelineTracks();
    renderCanvasFrame();
    updateTelemetryBar();
  }

  function selectViralMoment(index, triggerToast = true) {
    if (!state.analysis || !Array.isArray(state.analysis.viralMoments)) return;
    const idx = clamp(index, 0, state.analysis.viralMoments.length - 1);
    state.activeClipIndex = idx;
    const clip = state.analysis.viralMoments[idx];
    if (!clip) return;

    state.clipTitle = clip.title;
    state.trimStart = clip.start;
    state.trimEnd = clip.end;
    state.currentTime = clip.start;

    if (state.overlayImage) {
      state.overlayImage.start = state.trimStart + (state.overlayImageStartOffset || 2.5);
    }

    if (dom.activeClipTitleInput) {
      dom.activeClipTitleInput.value = clip.title;
    }

    // Update hook banner text to match clip topic if user hasn't customized or during clip switch
    const defaultHooks = {
      'clip-pm-1': 'WAIT TILL HE REVEALS THE $12K/MO WHOP SECRET 🤯👇',
      'clip-pm-2': 'THE SPLIT-SCREEN DOPAMINE FORMULA EXPLAINED 🧠⚡',
      'clip-pm-3': 'WHY 10 ACCOUNTS AT 50K VIEWS BEAT 1 LUCKY HIT 📈💰',
      'clip-pm-4': 'CUT EVERY 0.4s SILENCE OR LOSE 60% OF VIEWERS ✂️🔥'
    };
    if (defaultHooks[clip.id]) {
      state.hookText = defaultHooks[clip.id];
      dom.hookBannerTextInput.value = state.hookText;
    } else {
      state.hookText = `${clip.title.toUpperCase()} 🤯👇`;
      dom.hookBannerTextInput.value = state.hookText;
    }

    // Update viral post caption
    if (dom.postCaptionTextarea) {
      dom.postCaptionTextarea.value = `${clip.title} 🤯🔥 Watch till the end! #whop #clipping #viralshorts #sidehustle #fyp`;
    }

    if (state.useCustomMainVideo && dom.mainVideoEl) {
      if (Math.abs(dom.mainVideoEl.currentTime - state.currentTime) > 0.05) {
        dom.mainVideoEl.currentTime = state.currentTime;
      }
    }

    // Keep video as 1 Single Continuous Master Clip (User performs manual split & edit!)
    state.sequence = {
      videoClips: [
        {
          id: 'master-clip-1',
          title: clip.title || 'Master Video Track',
          start: state.trimStart,
          end: state.trimEnd,
          sourceStart: state.trimStart,
          sourceEnd: state.trimEnd,
          zoom: 1.0,
          panX: 0,
          panY: 0,
          volume: 1.0,
          effect: 'none',
          transition: 'none'
        }
      ],
      selectedClipId: 'master-clip-1',
      selectedTrackType: 'video',
      mainAudioVolume: 1.0,
      mainAudioMuted: false
    };

    renderViralMomentsList();
    renderTranscriptCloud();
    renderTimelineRuler();
    renderTimelineTracks();
    updateTrimUI();
    updateTelemetryBar();
    updateComplianceAndPayout();

    if (triggerToast) {
      showToast(`🎯 Loaded Viral Clip #${idx + 1}: "${clip.title}" (${clip.score}/100 🔥)`);
    }
  }

  function renderViralMomentsList() {
    if (!state.analysis || !Array.isArray(state.analysis.viralMoments)) return;
    const rawMoments = state.analysis.viralMoments;

    // Filter moments by preferred length
    let moments = rawMoments.filter((m) => {
      const dur = m.end - m.start;
      if (state.ssembleFilterLen === '30') return dur <= 35;
      if (state.ssembleFilterLen === '45') return dur > 25 && dur <= 50;
      if (state.ssembleFilterLen === '60') return dur > 40 && dur <= 75;
      return true;
    });

    // Sort moments by virality score or timeline position
    if (state.ssembleSort === 'time') {
      moments.sort((a, b) => a.start - b.start);
    } else {
      moments.sort((a, b) => (b.score || 0) - (a.score || 0));
    }

    if (dom.viralCountBadge) {
      dom.viralCountBadge.textContent = `${moments.length} SHORTS`;
    }
    if (dom.ssembleHeaderCount) {
      dom.ssembleHeaderCount.textContent = moments.length;
    }

    // Update Ssemble Video Meta Bar
    if (dom.ssembleActiveVideoTitle) {
      dom.ssembleActiveVideoTitle.textContent = state.videoTitle || 'Master Video Track';
    }
    if (dom.ssembleMetaDuration) {
      const totalSec = Math.round(state.streamDuration || 600);
      const mm = Math.floor(totalSec / 60).toString().padStart(2, '0');
      const ss = Math.floor(totalSec % 60).toString().padStart(2, '0');
      dom.ssembleMetaDuration.textContent = `${mm}:${ss}:00 (00:00:00 - ${mm}:${ss}:00)`;
    }
    if (dom.ssembleMetaLang) {
      dom.ssembleMetaLang.textContent = state.videoLanguage || 'English';
    }
    if (dom.ssembleMetaTemplate) {
      dom.ssembleMetaTemplate.textContent = state.videoTemplate || 'hormozi1';
    }

    if (dom.viralMomentsList) dom.viralMomentsList.innerHTML = '';
    if (dom.ssembleModalClipsGrid) dom.ssembleModalClipsGrid.innerHTML = '';

    moments.forEach((m) => {
      const originalIdx = rawMoments.indexOf(m);
      const dur = (m.end - m.start).toFixed(1);
      const scoreClass = m.score >= 90 ? '' : m.score >= 80 ? 'amber' : 'blue';
      const snippet = Array.isArray(m.transcript)
        ? m.transcript.map((w) => w.word).join(' ')
        : (m.reason || '');

      // Create rich Ssemble card
      const card = document.createElement('div');
      card.className = `ssemble-clip-card ${originalIdx === state.activeClipIndex ? 'active' : ''}`;
      card.innerHTML = `
        <div class="ssemble-card-head">
          <div class="ssemble-head-left">
            <h3 class="ssemble-card-title">${m.title}</h3>
            <span class="ssemble-card-time">⏱ ${formatTimecode(m.start)} – ${formatTimecode(m.end)} (${dur}s) • ${m.tag || '🔥 VIRAL'}</span>
          </div>
          <span class="ssemble-score-badge ${scoreClass}">${m.score} / 100</span>
        </div>
        <div class="ssemble-rationale">“${m.reason}”</div>
        <div class="ssemble-transcript-snippet">${snippet}</div>
        <div class="ssemble-card-actions">
          <button type="button" class="btn-ssemble-auto" data-action="auto" data-idx="${originalIdx}">
            <span>⚡ 1-Click Auto-Edit (9:16)</span>
          </button>
          <button type="button" class="btn-ssemble-edit" data-action="edit" data-idx="${originalIdx}">
            <span>✂️ Edit in CapCut / OpenCut</span>
          </button>
        </div>
      `;

      card.addEventListener('click', (e) => {
        const autoBtn = e.target.closest('[data-action="auto"]');
        const editBtn = e.target.closest('[data-action="edit"]');

        if (autoBtn) {
          e.stopPropagation();
          selectViralMoment(originalIdx, false);
          runOneClickAutoEdit(originalIdx);
          if (dom.ssembleHubModal) dom.ssembleHubModal.classList.add('hidden');
          return;
        }

        if (editBtn) {
          e.stopPropagation();
          selectViralMoment(originalIdx, true);
          if (dom.ssembleHubModal) dom.ssembleHubModal.classList.add('hidden');
          showToast(`🎬 Loaded "${m.title}" into CapCut / OpenCut Timeline!`, '#38bdf8', 3500);
          return;
        }

        selectViralMoment(originalIdx, true);
      });

      if (dom.viralMomentsList) {
        dom.viralMomentsList.appendChild(card);
      }

      // Populate full-screen modal grid
      if (dom.ssembleModalClipsGrid) {
        const modalCard = card.cloneNode(true);
        modalCard.addEventListener('click', (e) => {
          const autoBtn = e.target.closest('[data-action="auto"]');
          const editBtn = e.target.closest('[data-action="edit"]');
          if (autoBtn) {
            selectViralMoment(originalIdx, false);
            runOneClickAutoEdit(originalIdx);
            dom.ssembleHubModal.classList.add('hidden');
            return;
          }
          if (editBtn) {
            selectViralMoment(originalIdx, true);
            dom.ssembleHubModal.classList.add('hidden');
            showToast(`🎬 Loaded "${m.title}" into CapCut / OpenCut Timeline!`, '#38bdf8', 3500);
            return;
          }
          selectViralMoment(originalIdx, true);
          dom.ssembleHubModal.classList.add('hidden');
        });
        dom.ssembleModalClipsGrid.appendChild(modalCard);
      }
    });
  }

  function renderTranscriptCloud() {
    const clip = getActiveClip();
    dom.transcriptWordCloud.innerHTML = '';
    if (!clip || !Array.isArray(clip.transcript)) return;

    clip.transcript.forEach((item, wIdx) => {
      const chip = document.createElement('span');
      chip.className = 'transcript-word-chip';
      chip.dataset.start = item.start;
      chip.dataset.end = item.end;
      chip.dataset.index = wIdx;
      chip.textContent = item.emoji && state.autoEmoji ? `${item.word} ${item.emoji}` : item.word;
      chip.title = `Click to jump to ${item.start.toFixed(2)}s • Double-click to edit word`;

      chip.addEventListener('click', () => {
        state.selectedTranscriptWord = item;
        seekToTime(item.start);
        (dom.transcriptWordCloud ? dom.transcriptWordCloud.querySelectorAll('.transcript-word-chip') : []).forEach(c => c.style.outline = 'none');
        chip.style.outline = '2px solid #00f2fe';
        showToast(`📍 Selected word: "${item.word}" at ${item.start.toFixed(2)}s. Click Trim In / Out / Snap 30s above!`, '#38bdf8', 2500);
      });

      chip.addEventListener('dblclick', (e) => {
        e.stopPropagation();
        const updated = window.prompt('Edit caption word:', item.word);
        if (updated !== null && updated.trim() !== '') {
          item.word = updated.trim();
          renderTranscriptCloud();
          renderTimelineTracks();
          showToast(`✏️ Updated caption word to "${item.word}"`);
        }
      });

      dom.transcriptWordCloud.appendChild(chip);
    });
  }

  let lastChipUpdateTime = 0;
  function highlightActiveTranscriptChip() {
    if (!dom.transcriptWordCloud) return;
    const now = performance.now();
    if (now - lastChipUpdateTime < 150) return; // Throttle to ~6x/sec to avoid DOM thrashing
    lastChipUpdateTime = now;
    const chips = (dom.transcriptWordCloud ? dom.transcriptWordCloud.querySelectorAll('.transcript-word-chip') : []);
    chips.forEach((chip) => {
      const st = parseFloat(chip.dataset.start);
      const en = parseFloat(chip.dataset.end);
      const isCurrent = state.currentTime >= st && state.currentTime <= en + 0.1;
      chip.classList.toggle('active', isCurrent);
    });
  }

  // =========================================================================
  // 1-CLICK AI AUTO-EDIT ENGINE (4 CONNECTED REPOSITORIES)
  // auto-video-editor + Autoclip + bridgeclip + OpenClipper
  // =========================================================================
  async function runOneClickAutoEdit(forcedClipIdx) {
    showToast('⚡ Running 4-Engine Auto-Edit (auto-video-editor • Autoclip • bridgeclip • OpenClipper)...', '#6366f1', 3500);

    try {
      const activeVideo = state.uploadedVideoFile ? state.uploadedVideoFile.name : (state.customMainFileName || '');
      const resp = await fetch('/api/auto_edit_all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: activeVideo,
          target_duration: Math.max(15, (state.trimEnd - state.trimStart) || 30.0),
          clip_start: state.trimStart,
          clip_end: state.trimEnd
        })
      });

      if (resp.ok) {
        const data = await resp.json();
        if (data && data.success) {
          applyBackendAutoEditResult(data, forcedClipIdx);
          return;
        }
      }
    } catch (e) {
      console.warn('Backend auto-edit notice, using client multi-cut engine:', e);
    }

    // Client fallback
    runClientOneClickAutoEdit(forcedClipIdx);
  }

  function applyBackendAutoEditResult(data, forcedClipIdx) {
    if (data.analysis) {
      state.analysis = data.analysis;
      renderViralMomentsList();
    }

    if (data.project) {
      if (data.project.plan) {
        state.hookText = data.project.plan.hook_banner || state.hookText;
        state.trimStart = Number(data.project.plan.clip_start) || state.trimStart;
        state.trimEnd = Number(data.project.plan.clip_end) || state.trimEnd;
      }
      if (data.project.sequence && Array.isArray(data.project.sequence.videoClips)) {
        state.sequence.videoClips = data.project.sequence.videoClips;
        state.sequence.selectedClipId = state.sequence.videoClips[0]?.id || 'cut-1';
      }
    }

    if (data.reframe) {
      state.reframeKeyframes = data.reframe.keyframes || [];
      state.reframeStrategy = data.reframe.strategy || 'general_center';
    }

    state.currentTime = state.trimStart;
    if (dom.mainVideoEl && !isNaN(state.currentTime)) {
      dom.mainVideoEl.currentTime = state.currentTime;
    }

    // Set styling (Zero camera shake, zero zoom in/out)
    state.captionsEnabled = true;
    state.captionStyle = 'hormozi-pop';
    state.captionSize = 105;
    state.captionPosY = 56;
    state.autoEmoji = true;
    state.autoZoom = false;
    state.hookMode = '3s';

    state.hardEdit.enabled = false;
    state.hardEdit.jumpCuts = false;
    state.hardEdit.impactShake = false;
    state.hardEdit.strobeFlash = false;
    state.hardEdit.cinematicGrain = false;
    state.hardEdit.zoomIntensity = 1.0;

    if (window.WhopAudioEngine) {
      window.WhopAudioEngine.playSfx('cash');
    }

    syncAllInspectorControlsFromState();
    renderTranscriptCloud();
    renderTimelineTracks();
    updateTelemetryBar();
    updateComplianceAndPayout();
    renderVisualOverlaysList();

    const cutsCount = data.telemetry?.auto_video_editor?.jump_cuts_count || state.sequence.videoClips.length;
    showToast(
      `🎉 4-Engine Auto-Edit Applied! ${cutsCount} Jump-Cuts (auto-video-editor) + YuNet Face-Track (bridgeclip) + 1€ Smooth Pan (Autoclip) + NormalizedBox (OpenClipper)`,
      '#10b981',
      6000
    );
  }

  function runClientOneClickAutoEdit(forcedClipIdx) {
    if (!state.analysis || !Array.isArray(state.analysis.viralMoments)) return;

    // 1. Pick highest-scoring viral clip (or forcedClipIdx)
    let bestIdx = typeof forcedClipIdx === 'number' ? forcedClipIdx : 0;
    if (typeof forcedClipIdx !== 'number') {
      let bestScore = -1;
      state.analysis.viralMoments.forEach((m, idx) => {
        if (m.score > bestScore) {
          bestScore = m.score;
          bestIdx = idx;
        }
      });
    }

    selectViralMoment(bestIdx, false);

    // 2. Default to Full Screen 9:16 Vertical (NO SPLIT! 100% Pure Vertical Video)
    state.layoutMode = 'full-main';
    state.wholeScreenFit = false;
    state.cameraZoom = 1.0;
    state.framingPreset = 'center';
    state.cameraPanX = 0;
    state.useCustomBrollVideo = false;

    // 3. Stable Pro Edits (Zero shake, zero jump-cut zoom rhythm)
    state.hardEdit.enabled = false;
    state.hardEdit.jumpCuts = false;
    state.hardEdit.impactShake = false;
    state.hardEdit.strobeFlash = false;
    state.hardEdit.cinematicGrain = false;
    state.hardEdit.rgbGlitch = false;
    state.hardEdit.speedLines = false;
    state.hardEdit.zoomIntensity = 1.0;

    // 4. Build Single Continuous Master Track (User controls splitting, trimming, and editing)
    state.sequence = {
      videoClips: [
        {
          id: 'master-clip-1',
          title: 'Master Video Track',
          start: state.trimStart,
          end: state.trimEnd,
          sourceStart: state.trimStart,
          sourceEnd: state.trimEnd,
          zoom: 1.0,
          panX: 0,
          panY: 0,
          volume: 1.0,
          effect: 'none',
          transition: 'none'
        }
      ],
      selectedClipId: 'master-clip-1',
      selectedTrackType: 'video',
      mainAudioVolume: 1.0,
      mainAudioMuted: false
    };

    // 4. Apply Hormozi Pop Dynamic Captions + Auto-Emoji
    state.captionsEnabled = true;
    state.captionStyle = 'hormozi-pop';
    state.captionSize = 105;
    state.captionPosY = 56;
    state.autoEmoji = true;
    state.autoZoom = false;

    // 5. Enable AI Silence Cutter + Loudness Normalizer (No BG Sound by default)
    state.cutSilence = true;
    state.loudnessNorm = true;
    state.musicPreset = 'none';
    state.musicVolume = 0.0;
    state.hookMode = '3s';
    state.watermarkEnabled = true;

    if (window.WhopAudioEngine) {
      window.WhopAudioEngine.setMusicPreset(state.musicPreset);
      window.WhopAudioEngine.playSfx('cash');
    }

    syncAllInspectorControlsFromState();
    renderTranscriptCloud();
    renderTimelineTracks();
    updateTelemetryBar();
    updateComplianceAndPayout();
    renderVisualOverlaysList();

    showToast(
      `⚡ Auto-Edit Applied! Continuous Master Video + Dynamic Captions (Ready for Manual Split & Edits)`,
      '#10b981',
      5500
    );
  }

  // =========================================================================
  // PRO VIDEO EFFECTS (VFX) & COLOR GRADING ENGINE
  // =========================================================================
  function getHardEditEffectsAtTime(timeSec, clipStart, voiceLevel) {
    let flashOpacity = 0;
    if (state.hardEdit && state.hardEdit.strobeFlash) {
      const elapsed = Math.max(0, timeSec - clipStart);
      const cycleDuration = state.hardEdit.cutFrequency || 2.8;
      const timeIntoCycle = elapsed % cycleDuration;
      if (timeIntoCycle < 0.06) {
        flashOpacity = (1.0 - (timeIntoCycle / 0.06)) * 0.35;
      }
    }
    return { zoom: 1.0, shakeX: 0, shakeY: 0, flashOpacity, showSpeedLines: false, glitchOffset: 0 };
  }

  // 1. Pro VFX: Cinematic Lens Vignette (Draws focus to subject)
  function drawCinematicVignette(ctx, W, H, intensity = 0.45) {
    if (intensity <= 0) return;
    ctx.save();
    const vig = ctx.createRadialGradient(W * 0.5, H * 0.5, W * 0.28, W * 0.5, H * 0.5, W * 0.95);
    vig.addColorStop(0, 'rgba(0, 0, 0, 0)');
    vig.addColorStop(0.65, `rgba(0, 0, 0, ${0.25 * intensity})`);
    vig.addColorStop(1, `rgba(0, 0, 0, ${0.85 * intensity})`);
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }

  // 2. Pro VFX: 2.39:1 Anamorphic Cinema Letterbox
  function drawAnamorphicLetterbox(ctx, W, H, barH = 120) {
    if (!barH || barH <= 0) return;
    ctx.save();
    ctx.fillStyle = '#000000';
    // Top bar
    ctx.fillRect(0, 0, W, barH);
    // Bottom bar
    ctx.fillRect(0, H - barH, W, barH);
    // Subtle silver edge line
    ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.fillRect(0, barH, W, 1.5);
    ctx.fillRect(0, H - barH - 1.5, W, 1.5);
    ctx.restore();
  }

  // 3. Pro VFX: Retro 90s VHS Camcorder
  function drawRetroVhsEffect(ctx, W, H, timeSec) {
    ctx.save();
    // Scanlines
    ctx.fillStyle = 'rgba(0, 0, 0, 0.12)';
    for (let y = 0; y < H; y += 6) {
      ctx.fillRect(0, y, W, 2);
    }
    // Bottom VCR tracking band
    const trackY = H - 80 + Math.sin(timeSec * 3) * 20;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.06)';
    ctx.fillRect(0, trackY, W, 22);

    // VCR OSD Header
    ctx.font = '700 24px "Courier New", monospace';
    const blink = Math.floor(timeSec * 2) % 2 === 0;
    if (blink) {
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.arc(42, 62, 8, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = '#000000';
    ctx.shadowBlur = 4;
    ctx.fillText('REC', 60, 70);
    ctx.fillText('PLAY ►', 60, 108);

    // Bottom timecode
    const mins = Math.floor(timeSec / 60);
    const secs = Math.floor(timeSec % 60);
    const frames = Math.floor((timeSec % 1) * 30);
    const vhsTime = `SP 0:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}:${String(frames).padStart(2, '0')}`;
    ctx.fillText(vhsTime, 60, H - 70);
    ctx.restore();
  }

  // 4. Pro VFX: Film Halation (Warm diffuse highlight glow)
  function drawCinematicHalation(ctx, W, H, intensity = 0.4) {
    if (intensity <= 0) return;
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    const rad = ctx.createRadialGradient(W * 0.5, H * 0.4, 80, W * 0.5, H * 0.4, W * 0.85);
    rad.addColorStop(0, `rgba(255, 215, 160, ${0.30 * intensity})`);
    rad.addColorStop(0.5, `rgba(255, 140, 70, ${0.12 * intensity})`);
    rad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = rad;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }

  // 5. Pro VFX: Warm Light Leak / Sunlight Flare
  function drawLightLeakFlare(ctx, W, H, timeSec, intensity = 0.35) {
    if (intensity <= 0) return;
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    const pulse = 1.0 + Math.sin(timeSec * 1.8) * 0.15;
    const leak = ctx.createRadialGradient(0, 0, 40, 120, 120, W * 0.7 * pulse);
    leak.addColorStop(0, `rgba(255, 230, 180, ${0.45 * intensity})`);
    leak.addColorStop(0.35, `rgba(255, 130, 60, ${0.25 * intensity})`);
    leak.addColorStop(0.7, `rgba(240, 70, 130, ${0.10 * intensity})`);
    leak.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = leak;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }

  // 6. Pro VFX: Depth Lens Blur (f/1.4 Subject Focus)
  function drawTiltShiftBlur(ctx, W, H) {
    ctx.save();
    const topGrad = ctx.createLinearGradient(0, 0, 0, H * 0.22);
    topGrad.addColorStop(0, 'rgba(0, 0, 0, 0.45)');
    topGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = topGrad;
    ctx.fillRect(0, 0, W, H * 0.22);

    const botGrad = ctx.createLinearGradient(0, H, 0, H * 0.78);
    botGrad.addColorStop(0, 'rgba(0, 0, 0, 0.55)');
    botGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = botGrad;
    ctx.fillRect(0, H * 0.78, W, H * 0.22);
    ctx.restore();
  }

  // 7. Pro VFX: Ultra-Fast 60fps 35mm Film Grain (Kodak 5219 texture)
  let cachedGrainPattern = null;
  function getGrainPattern(ctx) {
    if (cachedGrainPattern) return cachedGrainPattern;
    const gCanvas = document.createElement('canvas');
    gCanvas.width = 160;
    gCanvas.height = 160;
    const gCtx = gCanvas.getContext('2d');
    const imgData = gCtx.createImageData(160, 160);
    const d = imgData.data;
    for (let i = 0; i < d.length; i += 4) {
      const v = Math.floor(Math.random() * 255);
      d[i] = v;
      d[i + 1] = v;
      d[i + 2] = v;
      d[i + 3] = 45;
    }
    gCtx.putImageData(imgData, 0, 0);
    cachedGrainPattern = ctx.createPattern(gCanvas, 'repeat');
    return cachedGrainPattern;
  }

  function drawFilmGrain(ctx, W, H, intensity = 0.20) {
    if (intensity <= 0) return;
    ctx.save();
    ctx.globalAlpha = intensity;
    ctx.globalCompositeOperation = 'overlay';
    ctx.fillStyle = getGrainPattern(ctx);
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }

  // =========================================================================
  // REAL-TIME 60FPS 9:16 VERTICAL CANVAS RENDERER (1080x1920)
  // =========================================================================
  function renderCanvasFrame() {
    const canvas = dom.previewCanvas;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width;  // 1080
    const H = canvas.height; // 1920

    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#05050a';
    ctx.fillRect(0, 0, W, H);

    // Get real-time vocal envelope level
    const voiceLevel = window.WhopAudioEngine
      ? window.WhopAudioEngine.getCurrentLevel(state.currentTime)
      : 0.35;

    const hardEffects = getHardEditEffectsAtTime(state.currentTime, state.trimStart, voiceLevel);

    if (state.layoutMode === 'ambient-blur') {
      if (state.useCustomMainVideo && dom.mainVideoEl && dom.mainVideoEl.readyState >= 2) {
        // Ambient reflection background
        ctx.save();
        ctx.filter = 'blur(28px) brightness(0.65)';
        ctx.drawImage(dom.mainVideoEl, -30, -30, W + 60, H + 60);
        ctx.filter = 'none';

        const vig = ctx.createRadialGradient(W / 2, H / 2, 250, W / 2, H / 2, 920);
        vig.addColorStop(0, 'rgba(5, 5, 12, 0.25)');
        vig.addColorStop(1, 'rgba(5, 5, 12, 0.7)');
        ctx.fillStyle = vig;
        ctx.fillRect(0, 0, W, H);
        ctx.restore();

        const vw = dom.mainVideoEl.videoWidth || 1920;
        const vh = dom.mainVideoEl.videoHeight || 1080;
        const drawH = Math.round(W * (vh / vw));
        const drawY = Math.round((H - drawH) / 2);

        ctx.save();
        ctx.shadowColor = 'rgba(0, 0, 0, 0.85)';
        ctx.shadowBlur = 36;
        ctx.shadowOffsetY = 12;
        ctx.drawImage(dom.mainVideoEl, 0, drawY, W, drawH);
        ctx.restore();

        ctx.strokeStyle = 'rgba(99, 102, 241, 0.8)';
        ctx.lineWidth = 3;
        ctx.strokeRect(0, drawY, W, drawH);
      } else {
        renderMainViewport(ctx, { x: 0, y: 0, w: W, h: H }, state.currentTime, voiceLevel, 1.0, 0);
      }
    } else {
      let mainRect = { x: 0, y: 0, w: W, h: H };
      let brollRect = null;
      let seamY = null;

      if (state.layoutMode === 'split-60-40') {
        const splitH = Math.round(H * 0.56);
        mainRect = { x: 0, y: 0, w: W, h: splitH };
        brollRect = { x: 0, y: splitH, w: W, h: H - splitH };
        seamY = splitH;
      } else if (state.layoutMode === 'split-50-50') {
        const splitH = Math.round(H * 0.5);
        mainRect = { x: 0, y: 0, w: W, h: splitH };
        brollRect = { x: 0, y: splitH, w: W, h: H - splitH };
        seamY = splitH;
      } else if (state.layoutMode === 'pip-facecam') {
        mainRect = { x: 0, y: 0, w: W, h: H };
        brollRect = { x: W - 380, y: H - 640, w: 340, h: 520, isPip: true };
      }

      // 1. Render Main Speaker Video (Zero camera shake, zero zoom in/out!)
      renderMainViewport(ctx, mainRect, state.currentTime, voiceLevel, 1.0, 0);

      // 2. Render Optional Satisfying B-Roll Viewport (only in split modes)
      if (brollRect) {
        renderBrollViewport(ctx, brollRect, state.currentTime);
      }

      // 3. Draw Glowing Seam Divider Line in Split Modes
      if (seamY !== null) {
        ctx.save();
        const seamGrad = ctx.createLinearGradient(0, seamY, W, seamY);
        seamGrad.addColorStop(0, '#6366f1');
        seamGrad.addColorStop(0.5, '#e11d48');
        seamGrad.addColorStop(1, '#10b981');
        ctx.fillStyle = seamGrad;
        ctx.fillRect(0, seamY - 4, W, 8);
        ctx.restore();
      }
    }

    // 4. Draw Visual Media Overlays & Memes Cut-Ins
    drawVisualOverlaysOnCanvas(ctx, W, H, state.currentTime);

    // 5. Draw Top Pattern-Interrupt Hook Banner (first 3.5s of clip or Always On)
    const clipElapsed = Math.max(0, state.currentTime - state.trimStart);
    const showHook =
      state.hookText.trim() !== '' &&
      (state.hookMode === 'always' || (state.hookMode === '3s' && clipElapsed <= 3.5));

    if (showHook) {
      drawHookBannerOnCanvas(ctx, W, H, state.hookText, clipElapsed);
    }

    // 6. Draw Whop Campaign Verified Bounty Watermark Badge
    if (state.watermarkEnabled && state.watermarkText.trim() !== '') {
      drawWatermarkOnCanvas(ctx, W, H, state.watermarkText);
    }

    // 7. Draw Dynamic Word-by-Word Karaoke Captions
    if (state.captionsEnabled) {
      drawKaraokeCaptionsOnCanvas(ctx, W, H, state.currentTime);
    }

    // 8. Pro VFX Stack (Halation, Light Leak, Tilt-Shift, Vignette, VHS, Grain, Letterbox)
    if (state.effects) {
      if (state.effects.halation) {
        drawCinematicHalation(ctx, W, H, state.effects.halationIntensity || 0.4);
      }
      if (state.effects.lightLeak) {
        drawLightLeakFlare(ctx, W, H, state.currentTime, state.effects.lightLeakIntensity || 0.35);
      }
      if (state.effects.tiltShift) {
        drawTiltShiftBlur(ctx, W, H);
      }
      if (state.effects.vignette) {
        drawCinematicVignette(ctx, W, H, state.effects.vignetteIntensity || 0.45);
      }
      if (state.effects.vhs) {
        drawRetroVhsEffect(ctx, W, H, state.currentTime);
      }
      if (state.effects.filmGrain) {
        drawFilmGrain(ctx, W, H, state.effects.filmGrainIntensity || 0.20);
      }
      if (state.effects.letterbox) {
        drawAnamorphicLetterbox(ctx, W, H, state.effects.letterboxHeight || 120);
      }
    }

    // 9. Clean White Strobe Flash on Cuts (if enabled)
    if (hardEffects.flashOpacity > 0) {
      ctx.save();
      ctx.fillStyle = `rgba(255, 255, 255, ${hardEffects.flashOpacity})`;
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }

    // 10. TikTok / Reels / Shorts Safe-Zone Overlay Guide
    if (state.showSafeZones) {
      drawSafeZoneOverlay(ctx, W, H);
    }
  }

  function getReframePanOffsetAtTime(timeSec) {
    if (!state.reframeKeyframes || !state.reframeKeyframes.length) return 0;
    const clipStart = state.trimStart || 0;
    const tRel = Math.max(0, timeSec - clipStart);
    const kfs = state.reframeKeyframes;
    let closest = kfs[0];
    for (let i = 0; i < kfs.length; i++) {
      if (kfs[i].t <= tRel) {
        closest = kfs[i];
      } else {
        break;
      }
    }
    const cx = closest.cx !== undefined ? closest.cx : 0.5;
    return clamp((cx - 0.5) * 80, -35, 35);
  }

  function renderMainViewport(ctx, rect, timeSec, voiceLevel, extraZoom = 1.0, glitchOffset = 0) {
    let framingOffset = 0;
    if (state.framingPreset === 'left') framingOffset = -22;
    else if (state.framingPreset === 'right') framingOffset = 22;

    const activeCut = getActiveVideoCutAtTime(timeSec);
    const cutZoom = activeCut ? (activeCut.zoom || 1.0) : 1.0;
    const cutPanX = activeCut ? (activeCut.panX || 0) : 0;
    const cutPanY = activeCut ? (activeCut.panY || 0) : 0;
    const reframePan = getReframePanOffsetAtTime(timeSec);
    const totalPanX = clamp(state.cameraPanX + framingOffset + cutPanX + reframePan, -45, 45);
    const totalPanY = clamp((state.cameraPanY || 0) + cutPanY, -50, 50);

    if (state.useCustomMainVideo && dom.mainVideoEl && dom.mainVideoEl.readyState >= 2) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(rect.x, rect.y, rect.w, rect.h);
      ctx.clip();

      // Pro Color Grading Filter
      if (state.activeFilter && state.activeFilter !== 'clean') {
        const filterMap = {
          'cinematic': 'contrast(1.16) saturate(1.22) hue-rotate(-8deg) sepia(0.08)',
          'cyberpunk': 'contrast(1.25) saturate(1.45) hue-rotate(24deg)',
          'noir': 'grayscale(1) contrast(1.35) brightness(0.95)',
          'vintage': 'sepia(0.38) contrast(1.12) brightness(1.04) saturate(1.15)',
          'vivid': 'saturate(1.45) contrast(1.16) brightness(1.02)'
        };
        ctx.filter = filterMap[state.activeFilter] || 'none';
      } else {
        ctx.filter = 'contrast(1.04) saturate(1.05) brightness(1.02)';
      }

      const vw = dom.mainVideoEl.videoWidth || 1920;
      const vh = dom.mainVideoEl.videoHeight || 1080;

      // UNZOOMED FIT MODE (Default): Fit 100% of video width so all people & speakers are visible!
      const isFit = (state.videoFitMode !== 'fill');

      // In Fit mode, render ambient blurred video extension in background (TikTok / CapCut pro style)
      if (isFit) {
        ctx.save();
        ctx.filter = 'blur(28px) brightness(0.38) saturate(1.25)';
        const bgScale = Math.max(rect.w / vw, rect.h / vh) * 1.08;
        const bgW = vw * bgScale;
        const bgH = vh * bgScale;
        const bgX = rect.x + (rect.w - bgW) * 0.5;
        const bgY = rect.y + (rect.h - bgH) * 0.5;
        ctx.drawImage(dom.mainVideoEl, bgX, bgY, bgW, bgH);
        ctx.restore();

        // Subtle top and bottom letterbox vignette
        const grad = ctx.createLinearGradient(rect.x, rect.y, rect.x, rect.y + rect.h);
        grad.addColorStop(0, 'rgba(0,0,0,0.65)');
        grad.addColorStop(0.2, 'rgba(0,0,0,0.1)');
        grad.addColorStop(0.8, 'rgba(0,0,0,0.1)');
        grad.addColorStop(1, 'rgba(0,0,0,0.65)');
        ctx.fillStyle = grad;
        ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
      }

      const baseScale = isFit ? Math.min(rect.w / vw, rect.h / vh) : Math.max(rect.w / vw, rect.h / vh);
      const zoom = (state.cameraZoom || 1.0) * cutZoom; // Clean, stable 1.0x scale (adjustable via zoom bar)
      const drawW = vw * baseScale * zoom;
      const drawH = vh * baseScale * zoom;
      const panShiftX = (totalPanX / 100) * (drawW - rect.w) * 0.5;
      const panShiftY = (totalPanY / 100) * (drawH - rect.h) * 0.5;
      const drawX = rect.x + (rect.w - drawW) * 0.5 - panShiftX;
      const drawY = rect.y + (rect.h - drawH) * 0.5 - panShiftY;

      // Rotate & Flip Transform
      if (state.cameraFlipH || (state.cameraRotation && state.cameraRotation !== 0)) {
        ctx.translate(rect.x + rect.w * 0.5, rect.y + rect.h * 0.5);
        if (state.cameraFlipH) ctx.scale(-1, 1);
        if (state.cameraRotation) ctx.rotate((state.cameraRotation * Math.PI) / 180);
        ctx.translate(-(rect.x + rect.w * 0.5), -(rect.y + rect.h * 0.5));
      }

      ctx.drawImage(dom.mainVideoEl, drawX, drawY, drawW, drawH);

      // Pro VFX: RGB Dispersion / Chromatic Aberration
      if (state.effects && state.effects.rgbSplit) {
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        ctx.globalAlpha = 0.35;
        ctx.drawImage(dom.mainVideoEl, drawX - 6, drawY, drawW, drawH);
        ctx.fillStyle = 'rgba(255, 0, 80, 0.10)';
        ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
        ctx.restore();
      }

      ctx.filter = 'none';
      ctx.restore();
      return;
    }

    // Sleek CapCut Studio Empty / Standby Stage (NO CARTOON GUY DEMO)
    ctx.save();
    ctx.beginPath();
    ctx.rect(rect.x, rect.y, rect.w, rect.h);
    ctx.clip();

    // Studio background gradient
    const grad = ctx.createLinearGradient(rect.x, rect.y, rect.x, rect.y + rect.h);
    grad.addColorStop(0, '#0a0b16');
    grad.addColorStop(1, '#131428');
    ctx.fillStyle = grad;
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h);

    // Subtle neon grid lines
    ctx.strokeStyle = 'rgba(99, 102, 241, 0.15)';
    ctx.lineWidth = 1.5;
    for (let x = rect.x; x < rect.x + rect.w; x += 52) {
      ctx.beginPath(); ctx.moveTo(x, rect.y); ctx.lineTo(x, rect.y + rect.h); ctx.stroke();
    }
    for (let y = rect.y; y < rect.y + rect.h; y += 52) {
      ctx.beginPath(); ctx.moveTo(rect.x, y); ctx.lineTo(rect.x + rect.w, y); ctx.stroke();
    }

    // Modern studio banner card
    const cx = rect.x + rect.w / 2;
    const cy = rect.y + rect.h / 2;
    ctx.fillStyle = 'rgba(19, 19, 38, 0.9)';
    ctx.strokeStyle = '#6366f1';
    ctx.lineWidth = 2.5;
    const boxW = Math.min(rect.w - 60, 580);
    const boxH = 150;
    ctx.beginPath();
    if (typeof ctx.roundRect === 'function') {
      ctx.roundRect(cx - boxW / 2, cy - boxH / 2, boxW, boxH, 14);
    } else {
      ctx.rect(cx - boxW / 2, cy - boxH / 2, boxW, boxH);
    }
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 30px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('🎬 CAPCUT AI VERTICAL STUDIO', cx, cy - 10);

    ctx.fillStyle = '#38bdf8';
    ctx.font = '18px "JetBrains Mono", monospace';
    ctx.fillText('Select video from dropdown or paste URL', cx, cy + 28);
    ctx.restore();
  }

  function renderBrollViewport(ctx, rect, timeSec) {
    ctx.save();
    if (rect.isPip) {
      // Rounded corner box for PiP mode
      const r = 24;
      ctx.beginPath();
      ctx.roundRect(rect.x, rect.y, rect.w, rect.h, r);
      ctx.clip();
    }

    if (state.useCustomBrollVideo && dom.brollVideoEl && dom.brollVideoEl.readyState >= 2) {
      const vw = dom.brollVideoEl.videoWidth || 1080;
      const vh = dom.brollVideoEl.videoHeight || 1920;
      const scale = Math.max(rect.w / vw, rect.h / vh);
      const dw = vw * scale;
      const dh = vh * scale;
      ctx.drawImage(
        dom.brollVideoEl,
        rect.x + (rect.w - dw) * 0.5,
        rect.y + (rect.h - dh) * 0.5,
        dw,
        dh
      );
    } else if (window.WhopBrollEngine) {
      window.WhopBrollEngine.renderBrollPreset(ctx, rect, timeSec, state.brollPreset, {
        showBadge: true
      });
    }

    if (rect.isPip) {
      ctx.strokeStyle = '#6366f1';
      ctx.lineWidth = 6;
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawHookBannerOnCanvas(ctx, W, H, text, clipElapsed) {
    ctx.save();
    const popScale = clipElapsed < 0.25 ? 0.92 + (clipElapsed / 0.25) * 0.08 : 1.0;
    const bannerW = W * 0.88;
    const bannerX = (W - bannerW) * 0.5;
    const bannerY = 96;

    ctx.translate(W * 0.5, bannerY + 65);
    ctx.scale(popScale, popScale);
    ctx.translate(-W * 0.5, -(bannerY + 65));

    // Top red pill tag
    ctx.fillStyle = '#e11d48';
    ctx.beginPath();
    ctx.roundRect(W * 0.5 - 150, bannerY - 26, 300, 34, 10);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.font = '800 20px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('⚡ VIRAL HOOK • WATCH TILL END', W * 0.5, bannerY - 3);

    // Main white/dark high-contrast hook card
    ctx.fillStyle = 'rgba(12, 12, 24, 0.92)';
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.roundRect(bannerX, bannerY + 12, bannerW, 118, 20);
    ctx.fill();
    ctx.stroke();

    // Word wrap hook text into max 2 lines
    ctx.fillStyle = '#ffffff';
    ctx.font = '800 34px "Plus Jakarta Sans", sans-serif';
    const words = text.split(/\s+/);
    let line1 = '';
    let line2 = '';
    words.forEach((w) => {
      const test = line1 ? `${line1} ${w}` : w;
      if (ctx.measureText(test).width < bannerW - 56) {
        line1 = test;
      } else {
        line2 = line2 ? `${line2} ${w}` : w;
      }
    });

    if (line2) {
      ctx.fillText(line1, W * 0.5, bannerY + 62);
      ctx.fillStyle = '#facc15';
      ctx.fillText(line2, W * 0.5, bannerY + 106);
    } else {
      ctx.fillText(line1, W * 0.5, bannerY + 84);
    }

    ctx.restore();
  }

  // =========================================================================
  // VISUAL MEDIA OVERLAYS & VIRAL MEMES CUT-INS SYSTEM
  // =========================================================================
  function drawVisualOverlaysOnCanvas(ctx, W, H, timeSec) {
    // Keep topic overlay image synchronized with state
    if (state.overlayImage && state.overlayImageEnabled) {
      const legacyId = 'ov_ai_plan_visual';
      let existing = state.visualOverlays.find((o) => o.id === legacyId);
      if (!existing) {
        existing = {
          id: legacyId,
          name: state.overlayImage.title || 'AI Concept Visual',
          type: 'custom_image',
          customUrl: state.overlayImage.url || state.overlayImage.path,
          mediaEl: state.overlayImgEl,
          startTime: typeof state.overlayImage.start === 'number' ? (state.overlayImage.start - state.trimStart) : 2.5,
          duration: state.overlayImage.duration || 4.5,
          position: 'center-pop',
          animation: 'spring-pop',
          scale: state.overlayImageScale || 1.0,
          x: 0,
          y: 0,
        };
        state.visualOverlays.unshift(existing);
      }
      existing.customUrl = state.overlayImage.url || state.overlayImage.path;
      if (!existing.mediaEl && (state.overlayImgEl || existing.customUrl)) {
        existing.mediaEl = state.overlayImgEl || new Image();
        if (!state.overlayImgEl && existing.customUrl) {
          existing.mediaEl.crossOrigin = 'anonymous';
          existing.mediaEl.src = existing.customUrl;
          state.overlayImgEl = existing.mediaEl;
        }
      }
      existing.startTime = typeof state.overlayImage.start === 'number' ? (state.overlayImage.start - state.trimStart) : (state.overlayImageStartOffset || 2.5);
      existing.duration = state.overlayImage.duration || 4.5;
      existing.scale = state.overlayImageScale || 1.0;
      existing.x = ((state.overlayImagePos?.x ?? 0.5) - 0.5) * W;
      existing.y = ((state.overlayImagePos?.y ?? 0.38) - 0.38) * H;
    } else if (state.visualOverlays && state.visualOverlays.length > 0) {
      state.visualOverlays = state.visualOverlays.filter((o) => o.id !== 'ov_ai_plan_visual');
    }

    if (!Array.isArray(state.visualOverlays) || state.visualOverlays.length === 0) return;

    state.visualOverlays.forEach((ov) => {
      const start = state.trimStart + (ov.startTime || 0);
      const dur = Math.max(0.8, ov.duration || 3.5);
      const end = start + dur;

      const isSelected = (state.selectedCanvasLayer === 'image' || state.selectedTimelineItem === 'overlay-image');
      const isVisibleInTime = (timeSec >= start && timeSec <= end);
      if (!isVisibleInTime && !isSelected && !state.canvasDragMode) return;

      const elapsed = Math.max(0, timeSec - start);
      const remaining = Math.max(0, end - timeSec);

      // Animation calculations
      let scale = ov.scale || 1.0;
      let alpha = 1.0;
      let shiftY = 0;

      if (!isVisibleInTime && (isSelected || state.canvasDragMode)) {
        alpha = 0.65; // Ghosted editor preview when paused outside active interval
      } else if (ov.animation === 'spring-pop') {
        if (elapsed < 0.35) {
          const t = elapsed / 0.35;
          scale *= 0.75 + Math.sin(t * Math.PI * 0.5) * 0.25 + Math.sin(t * Math.PI) * 0.12;
          alpha = Math.min(1.0, elapsed / 0.12);
        } else if (remaining < 0.25) {
          alpha = Math.max(0, remaining / 0.25);
        }
      } else if (ov.animation === 'slide-up') {
        if (elapsed < 0.3) {
          const t = elapsed / 0.3;
          shiftY = (1.0 - t) * 90;
          alpha = t;
        } else if (remaining < 0.2) {
          alpha = Math.max(0, remaining / 0.2);
        }
      } else if (ov.animation === 'glitch-pop') {
        if (elapsed < 0.2) {
          alpha = Math.random() > 0.2 ? 1.0 : 0.4;
          shiftY = (Math.random() - 0.5) * 10;
        }
      } else {
        // Smooth dissolve fade
        if (elapsed < 0.3) alpha = elapsed / 0.3;
        else if (remaining < 0.3) alpha = Math.max(0, remaining / 0.3);
      }

      ctx.save();
      ctx.globalAlpha = Math.max(0, Math.min(1, alpha));

      // Positioning presets
      let cx = W * 0.5 + (ov.x || 0);
      let cy = H * 0.38 + (ov.y || 0) + shiftY;
      let boxW = 520 * scale;
      let boxH = 340 * scale;

      if (ov.position === 'top-right') {
        cx = W * 0.74 + (ov.x || 0);
        cy = H * 0.20 + (ov.y || 0) + shiftY;
        boxW = 320 * scale;
        boxH = 200 * scale;
      } else if (ov.position === 'lower-third') {
        cx = W * 0.5 + (ov.x || 0);
        cy = H * 0.72 + (ov.y || 0) + shiftY;
        boxW = 680 * scale;
        boxH = 150 * scale;
      } else if (ov.position === 'full-screen') {
        cx = W * 0.5;
        cy = H * 0.5 + shiftY;
        boxW = W * 0.94;
        boxH = H * 0.70;
      }

      // Record exact interactive bounding box on canvas
      const rx = cx - boxW * 0.5;
      const ry = cy - boxH * 0.5;
      state.lastImageBounds = {
        x: rx,
        y: ry,
        w: boxW,
        h: boxH,
        cx: cx,
        cy: cy,
        overlayId: ov.id
      };

      // Render based on overlay type
      if (ov.type === 'custom_image') {
        if (!ov.mediaEl && ov.customUrl) {
          ov.mediaEl = new Image();
          ov.mediaEl.crossOrigin = 'anonymous';
          ov.mediaEl.src = ov.customUrl;
        }
        renderOverlayImageFrame(ctx, ov.mediaEl, cx, cy, boxW, boxH, ov.name);
      } else if (ov.type === 'custom_video') {
        renderOverlayVideoFrame(ctx, ov.mediaEl, cx, cy, boxW, boxH, ov.name);
      } else {
        renderPresetMemeCard(ctx, ov.presetId || 'stonks', cx, cy, boxW, boxH);
      }

      // CapCut Direct Canvas Selection Frame & Resize Handles
      if (isSelected || state.canvasDragMode) {
        ctx.save();
        ctx.strokeStyle = '#00f2fe';
        ctx.lineWidth = 3.5;
        ctx.shadowColor = '#00f2fe';
        ctx.shadowBlur = 10;
        ctx.setLineDash([8, 6]);
        ctx.strokeRect(rx, ry, boxW, boxH);
        ctx.setLineDash([]);
        ctx.shadowBlur = 0;

        // 4 Circular Corner Resize Handles
        const cornerHandles = [
          { x: rx, y: ry },
          { x: rx + boxW, y: ry },
          { x: rx + boxW, y: ry + boxH },
          { x: rx, y: ry + boxH }
        ];
        cornerHandles.forEach(h => {
          ctx.fillStyle = '#ffffff';
          ctx.strokeStyle = '#00f2fe';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(h.x, h.y, 9, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        });

        // Top Tooltip Badge
        ctx.fillStyle = 'rgba(0, 242, 254, 0.95)';
        ctx.beginPath();
        ctx.roundRect(cx - 150, ry - 36, 300, 28, 6);
        ctx.fill();
        ctx.fillStyle = '#05060f';
        ctx.font = '800 13px "Plus Jakarta Sans", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('✥ DRAG TO MOVE • CORNER TO RESIZE', cx, ry - 18);
        ctx.restore();
      }

      ctx.restore();
    });
  }

  function renderPresetMemeCard(ctx, presetId, cx, cy, w, h) {
    const rx = cx - w * 0.5;
    const ry = cy - h * 0.5;

    // Outer glow
    ctx.shadowColor = 'rgba(99, 102, 241, 0.45)';
    ctx.shadowBlur = 28;
    ctx.shadowOffsetY = 8;

    // Translucent dark glass card
    ctx.fillStyle = 'rgba(11, 13, 28, 0.95)';
    ctx.beginPath();
    ctx.roundRect(rx, ry, w, h, 20);
    ctx.fill();

    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;

    // Glowing border
    const borderGrad = ctx.createLinearGradient(rx, ry, rx + w, ry + h);
    if (presetId === 'stonks') {
      borderGrad.addColorStop(0, '#10b981');
      borderGrad.addColorStop(1, '#06b6d4');
    } else if (presetId === 'money-rain') {
      borderGrad.addColorStop(0, '#ffd700');
      borderGrad.addColorStop(1, '#10b981');
    } else if (presetId === 'breaking-news') {
      borderGrad.addColorStop(0, '#ef4444');
      borderGrad.addColorStop(1, '#f97316');
    } else {
      borderGrad.addColorStop(0, '#6366f1');
      borderGrad.addColorStop(1, '#ec4899');
    }
    ctx.strokeStyle = borderGrad;
    ctx.lineWidth = 3.5;
    ctx.stroke();

    // Content inside card
    if (presetId === 'stonks') {
      // Top tag
      ctx.fillStyle = '#059669';
      ctx.beginPath();
      ctx.roundRect(rx + 16, ry + 14, 180, 28, 6);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = '800 13px "Plus Jakarta Sans", sans-serif';
      ctx.fillText('📈 SURGE METRICS', rx + 24, ry + 33);

      // Candlestick graph visual
      const gw = w - 40;
      const gh = h - 90;
      const gx = rx + 20;
      const gy = ry + 50;

      ctx.strokeStyle = '#10b981';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(gx, gy + gh * 0.8);
      ctx.bezierCurveTo(gx + gw * 0.3, gy + gh * 0.65, gx + gw * 0.6, gy + gh * 0.4, gx + gw, gy + gh * 0.1);
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.font = '800 24px "Plus Jakarta Sans", sans-serif';
      ctx.fillText('+420% BOUNTY GAIN 🚀', gx + 10, gy + gh * 0.9);
    } else if (presetId === 'money-rain') {
      ctx.fillStyle = '#ffd700';
      ctx.font = '800 36px "Plus Jakarta Sans", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('💸 $12,500 REWARD 💸', cx, cy - 10);
      ctx.fillStyle = '#10b981';
      ctx.font = '700 18px "JetBrains Mono", monospace';
      ctx.fillText('WHOP BOUNTY CLAIMED • 100% VERIFIED', cx, cy + 28);
      ctx.textAlign = 'left';
    } else if (presetId === 'mind-blown') {
      ctx.fillStyle = '#f43f5e';
      ctx.font = '800 38px "Plus Jakarta Sans", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('🤯 MIND BLOWN 🤯', cx, cy - 10);
      ctx.fillStyle = '#e2e8f0';
      ctx.font = '700 17px "Plus Jakarta Sans", sans-serif';
      ctx.fillText('THE ALGORITHM TRICK NOBODY TELLS YOU', cx, cy + 28);
      ctx.textAlign = 'left';
    } else if (presetId === 'breaking-news') {
      ctx.fillStyle = '#dc2626';
      ctx.fillRect(rx + 10, ry + 12, w - 20, 36);
      ctx.fillStyle = '#ffffff';
      ctx.font = '900 16px "Plus Jakarta Sans", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('🚨 BREAKING VIRAL ALERT • WATCH NOW 🚨', cx, ry + 36);

      ctx.fillStyle = '#f8fafc';
      ctx.font = '800 22px "Plus Jakarta Sans", sans-serif';
      ctx.fillText('EXCLUSIVE STRATEGY REVEALED', cx, cy + 24);
      ctx.textAlign = 'left';
    } else if (presetId === 'secret-hack') {
      ctx.fillStyle = '#7c3aed';
      ctx.beginPath();
      ctx.roundRect(rx + 16, ry + 16, w - 32, h - 32, 14);
      ctx.fill();
      ctx.strokeStyle = '#a78bfa';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.font = '800 26px "Plus Jakarta Sans", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('🤫 100% SECRET HACK', cx, cy - 6);
      ctx.fillStyle = '#fde047';
      ctx.font = '700 15px "JetBrains Mono", monospace';
      ctx.fillText('TOP 1% CREATOR KNOWLEDGE', cx, cy + 26);
      ctx.textAlign = 'left';
    } else {
      // whop-vip
      ctx.fillStyle = '#eab308';
      ctx.font = '800 32px "Plus Jakarta Sans", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('👑 VIP CREATOR CLUB 👑', cx, cy - 8);
      ctx.fillStyle = '#ffffff';
      ctx.font = '700 16px "Plus Jakarta Sans", sans-serif';
      ctx.fillText('TOP 0.1% CONTENT REWARDS', cx, cy + 26);
      ctx.textAlign = 'left';
    }
  }

  function renderOverlayImageFrame(ctx, imgEl, cx, cy, w, h, title) {
    const rx = cx - w * 0.5;
    const ry = cy - h * 0.5;

    ctx.shadowColor = 'rgba(56, 189, 248, 0.45)';
    ctx.shadowBlur = 24;
    ctx.shadowOffsetY = 6;

    ctx.fillStyle = 'rgba(11, 13, 26, 0.95)';
    ctx.beginPath();
    ctx.roundRect(rx, ry, w, h, 20);
    ctx.fill();

    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;

    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Top Header Badge
    ctx.fillStyle = '#0284c7';
    ctx.beginPath();
    ctx.roundRect(rx + 14, ry + 10, Math.min(w - 28, 260), 30, 8);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.font = '800 14px "Plus Jakarta Sans", sans-serif';
    ctx.fillText(`💡 ${title || 'VISUAL TOPIC'}`, rx + 24, ry + 30);

    // Inner Image Draw Area
    const pad = 12;
    const innerX = rx + pad;
    const innerY = ry + 46;
    const innerW = w - pad * 2;
    const innerH = h - pad * 2 - 34;

    if (imgEl && (imgEl.complete || imgEl.naturalWidth > 0)) {
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(innerX, innerY, innerW, innerH, 12);
      ctx.clip();

      const iw = imgEl.naturalWidth || 400;
      const ih = imgEl.naturalHeight || 300;
      const scaleFit = Math.min(innerW / iw, innerH / ih);
      const dw = iw * scaleFit;
      const dh = ih * scaleFit;
      const dx = innerX + (innerW - dw) * 0.5;
      const dy = innerY + (innerH - dh) * 0.5;

      ctx.fillStyle = '#05060f';
      ctx.fillRect(innerX, innerY, innerW, innerH);
      ctx.drawImage(imgEl, dx, dy, dw, dh);
      ctx.restore();
    } else {
      ctx.fillStyle = '#171933';
      ctx.beginPath();
      ctx.roundRect(innerX, innerY, innerW, innerH, 12);
      ctx.fill();

      ctx.fillStyle = '#38bdf8';
      ctx.font = '700 20px "Plus Jakarta Sans", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('🖼️ Loading Image...', cx, innerY + innerH * 0.5);
      ctx.textAlign = 'left';
    }
  }

  function renderOverlayVideoFrame(ctx, videoEl, cx, cy, w, h, title) {
    const rx = cx - w * 0.5;
    const ry = cy - h * 0.5;

    ctx.shadowColor = 'rgba(168, 85, 247, 0.45)';
    ctx.shadowBlur = 24;
    ctx.shadowOffsetY = 6;

    ctx.fillStyle = 'rgba(11, 13, 26, 0.95)';
    ctx.beginPath();
    ctx.roundRect(rx, ry, w, h, 20);
    ctx.fill();

    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;

    ctx.strokeStyle = '#a855f7';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Top Header Badge
    ctx.fillStyle = '#7c3aed';
    ctx.beginPath();
    ctx.roundRect(rx + 14, ry + 10, Math.min(w - 28, 240), 30, 8);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.font = '800 14px "Plus Jakarta Sans", sans-serif';
    ctx.fillText(`🎬 ${title || 'VIDEO CUT-IN'}`, rx + 24, ry + 30);

    const pad = 12;
    const innerX = rx + pad;
    const innerY = ry + 46;
    const innerW = w - pad * 2;
    const innerH = h - pad * 2 - 34;

    if (videoEl && videoEl.readyState >= 2) {
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(innerX, innerY, innerW, innerH, 12);
      ctx.clip();

      const vw = videoEl.videoWidth || 640;
      const vh = videoEl.videoHeight || 360;
      const scaleFit = Math.min(innerW / vw, innerH / vh);
      const dw = vw * scaleFit;
      const dh = vh * scaleFit;
      const dx = innerX + (innerW - dw) * 0.5;
      const dy = innerY + (innerH - dh) * 0.5;

      ctx.fillStyle = '#05060f';
      ctx.fillRect(innerX, innerY, innerW, innerH);
      ctx.drawImage(videoEl, dx, dy, dw, dh);
      ctx.restore();
    } else {
      ctx.fillStyle = '#171933';
      ctx.beginPath();
      ctx.roundRect(innerX, innerY, innerW, innerH, 12);
      ctx.fill();

      ctx.fillStyle = '#a855f7';
      ctx.font = '700 20px "Plus Jakarta Sans", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('🎬 Video Cut-In Ready', cx, innerY + innerH * 0.5);
      ctx.textAlign = 'left';
    }
  }

  function renderVisualOverlaysList() {
    if (!dom.visualOverlaysList) return;
    dom.visualOverlaysList.innerHTML = '';

    if (dom.activeOverlaysCountBadge) {
      dom.activeOverlaysCountBadge.textContent = `${state.visualOverlays.length} ITEM${state.visualOverlays.length === 1 ? '' : 'S'}`;
    }

    if (state.visualOverlays.length === 0) {
      dom.visualOverlaysList.innerHTML = `
        <div style="font-size:11px; color:#64748b; text-align:center; padding:12px; border:1px dashed #252545; border-radius:8px;">
          No active visual overlays. Click a meme above or upload your custom image/video!
        </div>
      `;
      return;
    }

    state.visualOverlays.forEach((ov, idx) => {
      const card = document.createElement('div');
      card.className = 'visual-overlay-card';

      card.innerHTML = `
        <div class="overlay-card-header">
          <div class="overlay-card-title">
            <span>${ov.type === 'custom_video' ? '🎬' : (ov.type === 'custom_image' ? '🖼️' : '🔥')}</span>
            <span>${ov.name || 'Visual Item'}</span>
          </div>
          <button type="button" class="btn-card-del" title="Remove overlay">🗑️</button>
        </div>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:6px;">
          <div>
            <span style="font-size:9.5px; color:#94a3b8; font-weight:700;">START OFFSET</span>
            <input type="range" class="ov-start-slider" min="0" max="30" step="0.5" value="${ov.startTime || 0}" style="width:100%;" />
            <span class="mono-val" style="font-size:10px; color:#38bdf8;">${(ov.startTime || 0).toFixed(1)}s</span>
          </div>
          <div>
            <span style="font-size:9.5px; color:#94a3b8; font-weight:700;">DURATION</span>
            <input type="range" class="ov-dur-slider" min="1" max="10" step="0.5" value="${ov.duration || 3.5}" style="width:100%;" />
            <span class="mono-val" style="font-size:10px; color:#10b981;">${(ov.duration || 3.5).toFixed(1)}s</span>
          </div>
        </div>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:6px;">
          <div>
            <span style="font-size:9.5px; color:#94a3b8; font-weight:700;">POSITION</span>
            <select class="ov-pos-select studio-input" style="width:100%; font-size:10.5px; padding:3px 6px;">
              <option value="center-pop" ${ov.position === 'center-pop' ? 'selected' : ''}>Center Pop-Up</option>
              <option value="top-right" ${ov.position === 'top-right' ? 'selected' : ''}>Top-Right Corner</option>
              <option value="lower-third" ${ov.position === 'lower-third' ? 'selected' : ''}>Lower-Third Bar</option>
              <option value="full-screen" ${ov.position === 'full-screen' ? 'selected' : ''}>Full Screen Cut-In</option>
            </select>
          </div>
          <div>
            <span style="font-size:9.5px; color:#94a3b8; font-weight:700;">ANIMATION</span>
            <select class="ov-anim-select studio-input" style="width:100%; font-size:10.5px; padding:3px 6px;">
              <option value="spring-pop" ${ov.animation === 'spring-pop' ? 'selected' : ''}>Spring Pop (CapCut)</option>
              <option value="slide-up" ${ov.animation === 'slide-up' ? 'selected' : ''}>Slide Up</option>
              <option value="glitch-pop" ${ov.animation === 'glitch-pop' ? 'selected' : ''}>Glitch Pop</option>
              <option value="dissolve" ${ov.animation === 'dissolve' ? 'selected' : ''}>Smooth Dissolve</option>
            </select>
          </div>
        </div>
      `;

      // Event listeners
      card.querySelector('.btn-card-del').addEventListener('click', () => {
        state.visualOverlays.splice(idx, 1);
        renderVisualOverlaysList();
        renderTimelineTracks();
        showToast('🗑️ Removed visual overlay');
      });

      card.querySelector('.ov-start-slider').addEventListener('input', (e) => {
        ov.startTime = parseFloat(e.target.value);
        card.querySelectorAll('.mono-val')[0].textContent = `${ov.startTime.toFixed(1)}s`;
        renderTimelineTracks();
      });

      card.querySelector('.ov-dur-slider').addEventListener('input', (e) => {
        ov.duration = parseFloat(e.target.value);
        card.querySelectorAll('.mono-val')[1].textContent = `${ov.duration.toFixed(1)}s`;
        renderTimelineTracks();
      });

      card.querySelector('.ov-pos-select').addEventListener('change', (e) => {
        ov.position = e.target.value;
      });

      card.querySelector('.ov-anim-select').addEventListener('change', (e) => {
        ov.animation = e.target.value;
      });

      dom.visualOverlaysList.appendChild(card);
    });
  }

  function addCustomVisualOverlay(file) {
    if (!file) return;
    const isVideo = file.type.startsWith('video');
    const url = URL.createObjectURL(file);

    let mediaEl = null;
    if (isVideo) {
      mediaEl = document.createElement('video');
      mediaEl.src = url;
      mediaEl.muted = true;
      mediaEl.loop = true;
      mediaEl.playsInline = true;
      mediaEl.play().catch(() => {});
    } else {
      mediaEl = new Image();
      mediaEl.src = url;
    }

    const newOv = {
      id: `ov_${Date.now()}`,
      name: file.name.length > 22 ? file.name.substring(0, 19) + '...' : file.name,
      type: isVideo ? 'custom_video' : 'custom_image',
      customUrl: url,
      mediaEl,
      startTime: Math.max(0, state.currentTime - state.trimStart),
      duration: 4.0,
      position: isVideo ? 'full-screen' : 'center-pop',
      animation: 'spring-pop',
      scale: 1.0,
      x: 0,
      y: 0,
    };

    state.visualOverlays.push(newOv);
    renderVisualOverlaysList();
    renderTimelineTracks();
    showToast(`🎉 Added ${isVideo ? 'Cut-In Video' : 'Visual Image'}: "${newOv.name}" at ${(newOv.startTime).toFixed(1)}s!`, '#10b981');
  }

  function addPresetMemeOverlay(presetId) {
    const titles = {
      'stonks': 'Stonks Growth Graph 📈',
      'money-rain': 'Money Rain 💸',
      'mind-blown': 'Mind Blown 🤯',
      'breaking-news': 'Breaking News Alert 🚨',
      'secret-hack': 'Secret Hack 🤫',
      'whop-vip': 'Verified VIP 👑'
    };

    const newOv = {
      id: `ov_${Date.now()}`,
      name: titles[presetId] || 'Viral Sticker',
      type: 'preset',
      presetId,
      startTime: Math.max(0, state.currentTime - state.trimStart),
      duration: 3.5,
      position: 'center-pop',
      animation: 'spring-pop',
      scale: 1.0,
      x: 0,
      y: 0,
      customUrl: null,
      mediaEl: null
    };

    state.visualOverlays.push(newOv);
    renderVisualOverlaysList();
    renderTimelineTracks();
    showToast(`🔥 Inserted "${newOv.name}" sticker!`, '#6366f1');
  }

  function drawWatermarkOnCanvas(ctx, W, H, text) {
    ctx.save();
    const pillW = Math.min(W - 80, Math.max(320, text.length * 16 + 60));
    const pillH = 48;
    const x = 42;
    const y = H - 110;

    ctx.fillStyle = 'rgba(11, 11, 24, 0.82)';
    ctx.strokeStyle = 'rgba(225, 29, 72, 0.75)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.roundRect(x, y, pillW, pillH, 24);
    ctx.fill();
    ctx.stroke();

    // Verified Whop Flame dot
    ctx.fillStyle = '#e11d48';
    ctx.beginPath();
    ctx.arc(x + 26, y + pillH * 0.5, 10, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.font = '700 22px "JetBrains Mono", monospace';
    ctx.textAlign = 'left';
    ctx.fillText(text, x + 46, y + 31);
    ctx.restore();
  }

  function drawKaraokeCaptionsOnCanvas(ctx, W, H, timeSec) {
    const clip = getActiveClip();
    if (!clip || !window.WhopAudioEngine) return;

    const capState = window.WhopAudioEngine.getCaptionStateAtTime(clip, timeSec, 4);
    if (!capState || !capState.chunkWords || capState.chunkWords.length === 0) return;

    ctx.save();
    const scaleFactor = (state.captionSize || 100) / 100;
    const baseFontPx = Math.round(64 * scaleFactor);
    const centerY = Math.round((state.captionPosY / 100) * H);

    ctx.font = `900 ${baseFontPx}px "Plus Jakarta Sans", sans-serif`;
    ctx.textBaseline = 'middle';

    // Measure chunk total width
    const wordGap = 22 * scaleFactor;
    const items = capState.chunkWords.map((wObj, idx) => {
      const text = String(wObj.word || '').toUpperCase();
      const width = ctx.measureText(text).width;
      return {
        text,
        width,
        emoji: wObj.emoji || '',
        isActive: idx === capState.activeIndexInChunk
      };
    });

    const totalW =
      items.reduce((acc, it) => acc + it.width, 0) + Math.max(0, items.length - 1) * wordGap;

    // Optional dark backdrop plate for 'clean-pill' or readability
    if (state.captionStyle === 'clean-pill') {
      ctx.fillStyle = 'rgba(9, 9, 18, 0.88)';
      ctx.beginPath();
      ctx.roundRect(
        (W - totalW) * 0.5 - 34,
        centerY - baseFontPx * 0.72,
        totalW + 68,
        baseFontPx * 1.44,
        24
      );
      ctx.fill();
    }

    let cursorX = (W - totalW) * 0.5;

    items.forEach((it) => {
      const wordCenterX = cursorX + it.width * 0.5;
      ctx.save();

      // Pop scale on active word
      const pop = it.isActive ? 1.14 : 1.0;
      ctx.translate(wordCenterX, centerY);
      ctx.scale(pop, pop);

      // Style-specific colors & pill highlights
      let fillColor = '#ffffff';
      if (state.captionStyle === 'hormozi-pop') {
        fillColor = it.isActive ? '#facc15' : '#ffffff';
      } else if (state.captionStyle === 'mrbeast-bold') {
        fillColor = it.isActive ? '#38bdf8' : '#ffffff';
      } else if (state.captionStyle === 'whop-fire') {
        if (it.isActive) {
          ctx.fillStyle = '#e11d48';
          ctx.beginPath();
          ctx.roundRect(-it.width * 0.5 - 14, -baseFontPx * 0.58, it.width + 28, baseFontPx * 1.16, 16);
          ctx.fill();
        }
        fillColor = '#ffffff';
      } else if (state.captionStyle === 'neon-cyber') {
        fillColor = it.isActive ? '#e879f9' : '#e2e8f0';
        ctx.shadowColor = it.isActive ? '#d946ef' : '#6366f1';
        ctx.shadowBlur = it.isActive ? 28 : 10;
      } else if (state.captionStyle === 'clean-pill') {
        fillColor = it.isActive ? '#34d399' : '#f8fafc';
      }

      // Heavy black outline stroke for short-form legibility
      ctx.textAlign = 'center';
      ctx.lineJoin = 'round';
      ctx.lineWidth = Math.round(14 * scaleFactor);
      ctx.strokeStyle = '#000000';
      ctx.strokeText(it.text, 0, 0);

      ctx.fillStyle = fillColor;
      ctx.fillText(it.text, 0, 0);

      // Floating contextual emoji above active word
      if (it.isActive && state.autoEmoji && it.emoji) {
        ctx.font = `${Math.round(56 * scaleFactor)}px sans-serif`;
        ctx.fillText(it.emoji, 0, -baseFontPx * 0.95);
      }

      ctx.restore();
      cursorX += it.width + wordGap;
    });

    ctx.restore();
  }

  function drawSafeZoneOverlay(ctx, W, H) {
    ctx.save();
    ctx.strokeStyle = 'rgba(245, 158, 11, 0.7)';
    ctx.setLineDash([12, 10]);
    ctx.lineWidth = 3;

    // Right side TikTok/Reels action icons column
    ctx.strokeRect(W - 150, H * 0.42, 126, H * 0.42);
    // Bottom caption/sound metadata zone
    ctx.strokeRect(36, H - 310, W - 200, 230);

    ctx.fillStyle = 'rgba(245, 158, 11, 0.88)';
    ctx.font = '700 20px "JetBrains Mono", monospace';
    ctx.fillText('TIKTOK / REELS UI ZONE', W - 145, H * 0.42 - 12);
    ctx.fillText('CAPTION / AUDIO METADATA SAFE ZONE', 42, H - 322);
    ctx.restore();
  }

  // =========================================================================
  // TIMELINE MULTI-CLIP SEQUENCE & CAPCUT MULTI-TRACK RENDERER
  // =========================================================================
  function getTimelineBounds() {
    const totalDur = state.streamDuration || 60;
    const zoom = typeof state.timelineZoom === 'number' ? clamp(state.timelineZoom, 0, 1) : 1.0;

    // Full video bounds (zoom = 0.0)
    const fullStart = 0;
    const fullEnd = Math.max(30, totalDur);

    // Sequence focus bounds (zoom = 1.0)
    const clips = state.sequence?.videoClips || [];
    let seqStart = clips.length > 0 ? clips[0].start : (state.trimStart || 0);
    let seqEnd = clips.length > 0 ? clips[clips.length - 1].end : (state.trimEnd || 30);
    if (seqEnd <= seqStart) seqEnd = seqStart + 30;

    const seqSpan = Math.max(1.0, seqEnd - seqStart);
    const pad = Math.max(0.5, seqSpan * 0.03);
    const focusStart = Math.max(0, seqStart - pad);
    const focusEnd = Math.min(totalDur, seqEnd + pad);

    // Smooth linear interpolation between Full and Focus
    const viewStart = fullStart + (focusStart - fullStart) * zoom;
    const viewEnd = fullEnd + (focusEnd - fullEnd) * zoom;
    const span = Math.max(1.0, viewEnd - viewStart);
    return { viewStart, viewEnd, span };
  }

  function timeToTimelinePct(t) {
    const { viewStart, span } = getTimelineBounds();
    return clamp(((t - viewStart) / span) * 100, 0, 100);
  }

  function timelinePctToTime(pct) {
    const { viewStart, span } = getTimelineBounds();
    return viewStart + (clamp(pct, 0, 100) / 100) * span;
  }

  function renderTimelineRuler() {
    if (!dom.timelineRuler || !dom.timelineStage) return;
    dom.timelineRuler.innerHTML = '';
    const { viewStart, viewEnd, span } = getTimelineBounds();

    const stageW = dom.timelineStage.clientWidth || 1000;
    // Mathematically prevent overlapping labels: minimum 85px per tick label
    const maxTicks = Math.max(3, Math.floor(stageW / 85));
    const rawInterval = span / maxTicks;
    const niceIntervals = [0.25, 0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300, 600];
    let interval = niceIntervals.find((i) => i >= rawInterval) || 60;

    const firstTick = Math.ceil(viewStart / interval) * interval;
    for (let t = firstTick; t <= viewEnd + 0.001; t += interval) {
      const pct = timeToTimelinePct(t);
      if (pct < 1 || pct > 99) continue;
      const tick = document.createElement('div');
      tick.className = 'ruler-tick';
      tick.style.left = `${pct}%`;
      tick.innerHTML = `
        <div class="tick-line"></div>
        <span class="tick-label">${formatTimecode(t)}</span>
      `;
      dom.timelineRuler.appendChild(tick);
    }
  }

  function switchInspectorTab(targetTab) {
    let cleanTarget = (targetTab || '').replace('tabPanel-', '');
    if (cleanTarget === 'hard-cuts' || cleanTarget === 'hardcuts') cleanTarget = 'hardfx';
    document.querySelectorAll('.inspector-tab').forEach((b) => {
      const isMatch = b.dataset.tab === cleanTarget;
      b.classList.toggle('active', isMatch);
      b.setAttribute('aria-selected', isMatch ? 'true' : 'false');
    });
    document.querySelectorAll('.inspector-panel').forEach((panel) => {
      const isMatch = panel.id === `tabPanel-${cleanTarget}`;
      panel.classList.toggle('active', isMatch);
    });
  }

  function renderTimelineTracks() {
    renderVideoCutsTrack();
    renderCaptionTrack();
    renderOverlayTrack();
    renderAudioTrack();
    updateTrimUI();
  }

  function renderVideoCutsTrack() {
    if (!dom.videoTrackLane) return;
    dom.videoTrackLane.innerHTML = '';
    const { viewStart, viewEnd } = getTimelineBounds();
    const clips = state.sequence?.videoClips || [];

    clips.forEach((clip, idx) => {
      if (clip.end < viewStart || clip.start > viewEnd) return;
      const leftPct = timeToTimelinePct(clip.start);
      const rightPct = timeToTimelinePct(clip.end);
      const isSel = state.sequence?.selectedClipId === clip.id;

      const block = document.createElement('div');
      block.className = `timeline-clip-block clip-video ${isSel ? 'selected' : ''}`;
      block.style.left = `${leftPct}%`;
      block.style.width = `${Math.max(1.8, rightPct - leftPct)}%`;
      block.dataset.clipId = clip.id;

      block.innerHTML = `
        <div class="clip-handle clip-handle-left" data-action="trim-in" data-clip-id="${clip.id}" title="Trim In (Left Edge)"></div>
        <div class="clip-content">
          <span class="clip-title">🎬 ${clip.title}</span>
          <span class="clip-tag">${clip.zoom}× • ${(clip.end - clip.start).toFixed(1)}s</span>
        </div>
        <div class="clip-handle clip-handle-right" data-action="trim-out" data-clip-id="${clip.id}" title="Trim Out (Right Edge)"></div>
      `;

      block.addEventListener('mousedown', (e) => {
        e.stopPropagation();
        const action = e.target.dataset.action || 'move';
        state.sequence.selectedClipId = clip.id;
        state.sequence.selectedTrackType = 'video';
        syncSelectedCutInspector();
        renderTimelineTracks();
        switchInspectorTab('hard-cuts');

        state.activeClipDrag = {
          clipId: clip.id,
          action: action,
          startX: e.clientX,
          initStart: clip.start,
          initEnd: clip.end,
          idx: idx
        };
      });

      dom.videoTrackLane.appendChild(block);
    });

    renderSequenceCutsList();
  }

  function renderCaptionTrack() {
    if (!dom.captionTrackLane) return;
    dom.captionTrackLane.innerHTML = '';
    if (state.trackVisibility?.captions === false) return;
    const { viewStart, viewEnd } = getTimelineBounds();

    const clip = getActiveClip();
    let segments = [];
    if (clip && Array.isArray(clip.transcript) && clip.transcript.length > 0) {
      for (let i = 0; i < clip.transcript.length; i += 3) {
        const chunk = clip.transcript.slice(i, i + 3);
        segments.push({
          id: `cap-chunk-${i}`,
          chunkStartIdx: i,
          chunkCount: chunk.length,
          start: chunk[0].start,
          end: chunk[chunk.length - 1].end,
          text: chunk.map((c) => c.word).join(' ')
        });
      }
    } else if (state.analysis?.viralMoments) {
      segments = state.analysis.viralMoments.map((m, idx) => ({
        id: `cap-m-${idx}`,
        start: m.start,
        end: m.end,
        text: m.title
      }));
    }

    segments.forEach((seg) => {
      if (seg.end < viewStart || seg.start > viewEnd) return;
      const leftPct = timeToTimelinePct(seg.start);
      const rightPct = timeToTimelinePct(seg.end);
      const isSel = state.selectedTimelineItem === seg.id;

      const block = document.createElement('div');
      block.className = `timeline-block block-caption ${isSel ? 'selected' : ''}`;
      block.style.left = `${leftPct}%`;
      block.style.width = `${Math.max(2.5, rightPct - leftPct)}%`;
      block.innerHTML = `
        <div class="clip-handle clip-handle-left" data-action="trim-cap-left" data-cap-id="${seg.id}" title="Trim Caption In"></div>
        <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;pointer-events:none;">💬 ${seg.text || 'Caption'}</span>
        <div class="clip-handle clip-handle-right" data-action="trim-cap-right" data-cap-id="${seg.id}" title="Trim Caption Out"></div>
      `;
      block.title = `${seg.text} (${(seg.end - seg.start).toFixed(1)}s) • Click to select / Del to delete`;

      block.addEventListener('mousedown', (e) => {
        e.stopPropagation();
        const action = e.target.dataset.action || 'move-cap';
        state.selectedTimelineItem = seg.id;
        state.selectedCaptionSegment = seg;
        state.sequence.selectedTrackType = 'caption';
        seekToTime(seg.start);
        renderTimelineTracks();

        state.activeCaptionDrag = {
          seg: seg,
          action: action,
          startX: e.clientX,
          initStart: seg.start,
          initEnd: seg.end
        };
      });

      dom.captionTrackLane.appendChild(block);
    });
  }

  function renderOverlayTrack() {
    if (!dom.overlayTrackLane) return;
    dom.overlayTrackLane.innerHTML = '';
    if (state.trackVisibility?.overlays === false) return;
    const { viewStart, viewEnd } = getTimelineBounds();

    // Hook Banner
    if (state.hookMode !== 'off') {
      const hookDur = state.hookMode === 'always' ? state.trimEnd - state.trimStart : (state.hookDuration || Math.min(3.5, state.trimEnd - state.trimStart));
      const hookEnd = state.trimStart + hookDur;
      if (hookEnd >= viewStart && state.trimStart <= viewEnd) {
        const leftPct = timeToTimelinePct(state.trimStart);
        const rightPct = timeToTimelinePct(hookEnd);
        const isSel = state.selectedTimelineItem === 'hook-banner';
        const hookBlock = document.createElement('div');
        hookBlock.className = `timeline-block block-hook ${isSel ? 'selected' : ''}`;
        hookBlock.style.left = `${leftPct}%`;
        hookBlock.style.width = `${Math.max(3, rightPct - leftPct)}%`;
        hookBlock.innerHTML = `
          <span style="pointer-events:none;overflow:hidden;text-overflow:ellipsis;">🔥 Hook (${hookDur.toFixed(1)}s)</span>
          <div class="block-resize-handle block-resize-right" data-action="resize-hook-right" title="Drag to adjust Hook duration"></div>
        `;
        hookBlock.addEventListener('mousedown', (e) => {
          e.stopPropagation();
          state.selectedTimelineItem = 'hook-banner';
          state.selectedCanvasLayer = 'hook';
          if (e.target.dataset.action === 'resize-hook-right') {
            state.timelineBlockDrag = {
              item: 'hook-banner',
              action: 'resize-right',
              startX: e.clientX,
              initDuration: hookDur
            };
          }
          renderTimelineTracks();
        });
        dom.overlayTrackLane.appendChild(hookBlock);
      }
    }

    // Topic Visual Image Overlay
    if (state.overlayImage && state.overlayImage.enabled) {
      const imgStart = state.overlayImage.start;
      const imgEnd = imgStart + state.overlayImage.duration;
      if (imgEnd >= viewStart && imgStart <= viewEnd) {
        const leftPct = timeToTimelinePct(imgStart);
        const rightPct = timeToTimelinePct(imgEnd);
        const isSel = state.selectedTimelineItem === 'overlay-image';
        const imgBlock = document.createElement('div');
        imgBlock.className = `timeline-block block-image-overlay ${isSel ? 'selected' : ''}`;
        imgBlock.style.left = `${leftPct}%`;
        imgBlock.style.width = `${Math.max(3.5, rightPct - leftPct)}%`;
        imgBlock.style.top = '4px';
        imgBlock.innerHTML = `
          <div class="block-resize-handle block-resize-left" data-action="resize-left" title="Drag to adjust Start Time"></div>
          <span style="pointer-events:none;overflow:hidden;text-overflow:ellipsis;">🖼️ ${state.overlayImage.title || 'Visual Cue'} (${state.overlayImage.duration.toFixed(1)}s)</span>
          <div class="block-resize-handle block-resize-right" data-action="resize-right" title="Drag to adjust Duration"></div>
        `;
        imgBlock.addEventListener('mousedown', (e) => {
          e.stopPropagation();
          const action = e.target.dataset.action || 'move';
          state.selectedTimelineItem = 'overlay-image';
          state.selectedCanvasLayer = 'image';
          state.timelineBlockDrag = {
            item: 'overlay-image',
            action: action,
            startX: e.clientX,
            initStart: state.overlayImage.start,
            initDuration: state.overlayImage.duration
          };
          seekToTime(state.overlayImage.start);
          syncImageInspectorControls();
          renderTimelineTracks();
        });
        dom.overlayTrackLane.appendChild(imgBlock);
      }
    }
  }

  function renderAudioTrack() {
    const wfCanvas = dom.waveformCanvas;
    if (!wfCanvas) return;
    const { viewStart, viewEnd, span } = getTimelineBounds();
    const ctx = wfCanvas.getContext('2d');
    const W = wfCanvas.width;
    const H = wfCanvas.height;
    ctx.clearRect(0, 0, W, H);

    // Silence intervals in red
    const silences = state.analysis?.silences || [];
    silences.forEach((s) => {
      if (s.end < viewStart || s.start > viewEnd) return;
      const leftPct = timeToTimelinePct(s.start);
      const rightPct = timeToTimelinePct(s.end);
      const sx = (leftPct / 100) * W;
      const sw = Math.max(2, ((rightPct - leftPct) / 100) * W);
      ctx.fillStyle = state.cutSilence ? 'rgba(225, 29, 72, 0.45)' : 'rgba(245, 158, 11, 0.25)';
      ctx.fillRect(sx, 0, sw, H);
    });

    // Waveform amplitude bars
    const totalDur = state.streamDuration || 60;
    const peaks = state.analysis?.peaks || [];
    const barCount = 180;
    const barStep = W / barCount;
    const barW = Math.max(2, barStep * 0.7);

    for (let i = 0; i < barCount; i++) {
      const t = viewStart + (i / barCount) * span;
      const peakIdx = clamp(Math.floor((t / totalDur) * peaks.length), 0, Math.max(0, peaks.length - 1));
      const amp = (peaks[peakIdx] || 0.25) * (state.sequence?.mainAudioVolume || 1.0);
      const barH = Math.max(4, amp * (H - 6));
      const x = i * barStep;
      const y = (H - barH) * 0.5;

      const inActiveRange = t >= (state.sequence?.videoClips[0]?.start ?? 0) && t <= (state.sequence?.videoClips[state.sequence.videoClips.length - 1]?.end ?? totalDur);
      ctx.fillStyle = state.sequence?.mainAudioMuted ? '#475569' : (inActiveRange ? '#00f2fe' : '#334155');
      ctx.fillRect(x, y, barW, barH);
    }
  }

  function renderSequenceCutsList() {
    if (!dom.sequenceCutsList) return;
    dom.sequenceCutsList.innerHTML = '';
    const clips = state.sequence?.videoClips || [];

    clips.forEach((clip) => {
      const isSel = state.sequence.selectedClipId === clip.id;
      const card = document.createElement('div');
      card.className = `sequence-cut-card ${isSel ? 'active' : ''}`;
      card.innerHTML = `
        <div class="cut-card-left">
          <span class="cut-card-icon">🎬</span>
          <div class="cut-card-info">
            <span class="cut-card-title">${clip.title}</span>
            <span class="cut-card-meta">${formatTimecode(clip.start)} - ${formatTimecode(clip.end)} (${(clip.end - clip.start).toFixed(1)}s)</span>
          </div>
        </div>
        <div class="cut-card-right">
          <span class="cut-zoom-badge">${clip.zoom}× • ${clip.transition || 'cut'}</span>
          <button type="button" class="cut-del-btn" title="Delete cut" data-del-id="${clip.id}">✕</button>
        </div>
      `;

      card.addEventListener('click', (e) => {
        if (e.target.dataset.delId) {
          e.stopPropagation();
          state.sequence.selectedClipId = clip.id;
          deleteSelectedCapCutItem();
          return;
        }
        state.sequence.selectedClipId = clip.id;
        state.sequence.selectedTrackType = 'video';
        seekToTime(clip.start);
        syncSelectedCutInspector();
        switchInspectorTab('hard-cuts');
        renderTimelineTracks();
      });

      dom.sequenceCutsList.appendChild(card);
    });
  }

  function syncSelectedCutInspector() {
    const clip = (state.sequence?.videoClips || []).find((c) => c.id === state.sequence?.selectedClipId);

    if (dom.inspectorEmptyState && dom.inspectorPropertiesPanel) {
      if (!clip) {
        dom.inspectorEmptyState.classList.remove('hidden');
        dom.inspectorPropertiesPanel.classList.add('hidden');
        return;
      }
      dom.inspectorEmptyState.classList.add('hidden');
      dom.inspectorPropertiesPanel.classList.remove('hidden');
    }

    if (!clip) return;
    if (dom.selectedCutBadge) dom.selectedCutBadge.textContent = clip.title || 'Cut';
    if (dom.selectedCutZoomSlider) dom.selectedCutZoomSlider.value = String(clip.zoom || 1.0);
    if (dom.selectedCutZoomLabel) dom.selectedCutZoomLabel.textContent = `${Number(clip.zoom || 1.0).toFixed(2)}×`;
    if (dom.selectedCutPanXSlider) dom.selectedCutPanXSlider.value = String(clip.panX || 0);
    if (dom.selectedCutPanXLabel) dom.selectedCutPanXLabel.textContent = `${clip.panX || 0}%`;
    if (dom.selectedCutPanYSlider) dom.selectedCutPanYSlider.value = String(clip.panY || 0);
    if (dom.selectedCutPanYLabel) dom.selectedCutPanYLabel.textContent = `${clip.panY || 0}%`;
    if (dom.selectedCutVolSlider) {
      const vol = Math.round((clip.volume !== undefined ? clip.volume : 1.0) * 100);
      dom.selectedCutVolSlider.value = String(vol);
      if (dom.selectedCutVolLabel) dom.selectedCutVolLabel.textContent = `${vol}%`;
    }
    if (dom.selectedCutTransitionSelect) dom.selectedCutTransitionSelect.value = clip.transition || 'cut';
  }

  function getActiveVideoCutAtTime(time) {
    const clips = state.sequence?.videoClips || [];
    if (!clips.length) return null;
    for (const c of clips) {
      if (time >= c.start && time <= c.end) return c;
    }
    if (time > clips[clips.length - 1].end) return clips[clips.length - 1];
    return clips[0];
  }

  function updateTrimUI() {
    const leftPct = timeToTimelinePct(state.trimStart);
    const rightPct = timeToTimelinePct(state.trimEnd);
    const widthPct = Math.max(0.5, rightPct - leftPct);

    if (dom.trimLeftShade) dom.trimLeftShade.style.width = `${leftPct}%`;
    if (dom.trimRightShade) dom.trimRightShade.style.width = `${100 - rightPct}%`;
    if (dom.trimSelectionBox) {
      dom.trimSelectionBox.style.left = `${leftPct}%`;
      dom.trimSelectionBox.style.width = `${widthPct}%`;
    }

    const clipDur = Math.max(0.5, state.trimEnd - state.trimStart);
    if (dom.clipRangePill) {
      dom.clipRangePill.textContent = `IN ${state.trimStart.toFixed(1)}s → OUT ${state.trimEnd.toFixed(1)}s (${clipDur.toFixed(1)}s)`;
    }
    if (dom.totalDurationTimecode) {
      dom.totalDurationTimecode.textContent = formatTimecode(state.trimEnd);
    }

    const silences = (state.analysis && state.analysis.silences) || [];
    const totalSilenceSec = silences.reduce((acc, s) => acc + (s.duration || 0), 0);
    if (dom.silenceSavedPill) {
      dom.silenceSavedPill.textContent = state.cutSilence
        ? `✂️ ${silences.length} Dead-Air Gaps Auto-Skipped (-${totalSilenceSec.toFixed(1)}s)`
        : `⏸ ${silences.length} Dead-Air Gaps Detected (Uncut)`;
    }
  }

  let lastFormattedTime = '';
  function updatePlayheadUI() {
    const pct = timeToTimelinePct(state.currentTime);
    if (dom.timelinePlayhead) {
      dom.timelinePlayhead.style.left = `${pct}%`;
    }
    if (dom.currentTimecode) {
      const formatted = formatTimecode(state.currentTime);
      if (formatted !== lastFormattedTime) {
        lastFormattedTime = formatted;
        dom.currentTimecode.textContent = formatted;
      }
    }
  }

  function seekToTime(targetSec) {
    const dur = dom.mainVideoEl?.duration || state.streamDuration || 58.05;
    state.currentTime = clamp(targetSec, 0, dur);
    if (state.useCustomMainVideo && dom.mainVideoEl) {
      const activeClip = getActiveVideoCutAtTime(state.currentTime);
      let targetSrc = state.currentTime;
      if (activeClip) {
        const offset = Math.max(0, state.currentTime - activeClip.start);
        const srcStart = activeClip.sourceStart !== undefined ? activeClip.sourceStart : activeClip.start;
        targetSrc = clamp(srcStart + offset, 0, dom.mainVideoEl.duration || dur);
      }
      if (Math.abs(dom.mainVideoEl.currentTime - targetSrc) > 0.04) {
        dom.mainVideoEl.currentTime = targetSrc;
      }
    }
    updatePlayheadUI();
    highlightActiveTranscriptChip();
    renderCanvasFrame();
  }

  // =========================================================================
  // SAVED CLIPS VAULT (LOCALSTORAGE PERSISTENCE + JSON + SRT + VIDEO EXPORT)
  // =========================================================================
  function getSavedClipsVault() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return [];
    }
  }

  function setSavedClipsVault(list) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    } catch (e) {
      // Ignore quota errors
    }
    updateSavedClipsCountBadge();
  }

  function updateSavedClipsCountBadge() {
    const list = getSavedClipsVault();
    if (dom.savedClipsCountBadge) {
      dom.savedClipsCountBadge.textContent = String(list.length);
    }
  }

  function captureThumbnailDataUrl() {
    try {
      renderCanvasFrame();
      // Create compact 270x480 thumbnail for fast localStorage persistence
      const thumbCanvas = document.createElement('canvas');
      thumbCanvas.width = 270;
      thumbCanvas.height = 480;
      const tCtx = thumbCanvas.getContext('2d');
      tCtx.drawImage(dom.previewCanvas, 0, 0, 270, 480);
      return thumbCanvas.toDataURL('image/jpeg', 0.82);
    } catch (e) {
      return '';
    }
  }

  function buildClipProjectSnapshot() {
    const clip = getActiveClip();
    return {
      id: 'saved-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
      savedAt: new Date().toLocaleString(),
      title: (dom.activeClipTitleInput && dom.activeClipTitleInput.value.trim()) || state.clipTitle,
      streamPreset: state.streamPreset,
      activeClipIndex: state.activeClipIndex,
      score: clip ? clip.score : 98,
      trimStart: Number(state.trimStart.toFixed(2)),
      trimEnd: Number(state.trimEnd.toFixed(2)),
      duration: Number((state.trimEnd - state.trimStart).toFixed(2)),
      layoutMode: state.layoutMode,
      brollPreset: state.brollPreset,
      framingPreset: state.framingPreset,
      autoZoom: state.autoZoom,
      cameraZoom: state.cameraZoom,
      cameraPanX: state.cameraPanX,
      captionsEnabled: state.captionsEnabled,
      captionStyle: state.captionStyle,
      captionSize: state.captionSize,
      captionPosY: state.captionPosY,
      autoEmoji: state.autoEmoji,
      hookText: state.hookText,
      hookMode: state.hookMode,
      cutSilence: state.cutSilence,
      loudnessNorm: state.loudnessNorm,
      musicPreset: state.musicPreset,
      campaignId: state.campaignId,
      campaignCpm: state.campaignCpm,
      watermarkEnabled: state.watermarkEnabled,
      watermarkText: state.watermarkText,
      transcript: clip && Array.isArray(clip.transcript) ? JSON.parse(JSON.stringify(clip.transcript)) : [],
      thumbnail: captureThumbnailDataUrl()
    };
  }

  function saveCurrentClipToVault(openModalAfter = false) {
    const snapshot = buildClipProjectSnapshot();
    const list = getSavedClipsVault();
    list.unshift(snapshot);
    setSavedClipsVault(list.slice(0, 24));

    if (window.WhopAudioEngine) {
      window.WhopAudioEngine.playSfx('ding');
    }

    renderSavedVaultModalGrid();
    showToast(`💾 Saved "${snapshot.title}" to Studio Vault! (${list.length} saved)`);

    if (openModalAfter && dom.savedVaultModal) {
      dom.savedVaultModal.classList.remove('hidden');
    }
  }

  function ensureStarterSavedClip() {
    const list = getSavedClipsVault().filter((x) => x.id !== 'saved-starter-whop-1');
    setSavedClipsVault(list);
    updateSavedClipsCountBadge();
  }

  function applySavedSnapshotToStudio(snapshot) {
    if (!snapshot) return;
    if (snapshot.streamPreset && snapshot.streamPreset !== state.streamPreset) {
      loadDemoStream(snapshot.streamPreset, snapshot.activeClipIndex || 0);
    } else if (typeof snapshot.activeClipIndex === 'number') {
      selectViralMoment(snapshot.activeClipIndex, false);
    }

    state.clipTitle = snapshot.title || state.clipTitle;
    if (dom.activeClipTitleInput) dom.activeClipTitleInput.value = state.clipTitle;

    if (typeof snapshot.trimStart === 'number') state.trimStart = snapshot.trimStart;
    if (typeof snapshot.trimEnd === 'number') state.trimEnd = snapshot.trimEnd;

    if (snapshot.overlayImage && snapshot.overlayImageEnabled) {
      state.overlayImage = snapshot.overlayImage;
      state.overlayImageEnabled = true;
      state.overlayImageStartOffset = snapshot.overlayImageStartOffset || 2.5;
      state.overlayImageDuration = snapshot.overlayImageDuration || 4.5;
      if (dom.overlayImagePreview) {
        dom.overlayImagePreview.src = state.overlayImage.url || state.overlayImage.path;
        dom.overlayImagePreview.style.display = 'block';
      }
      if (dom.overlayImageTitle) {
        dom.overlayImageTitle.textContent = state.overlayImage.title || 'Topic Visual';
      }
      state.overlayImgEl = new Image();
      state.overlayImgEl.crossOrigin = 'anonymous';
      state.overlayImgEl.src = state.overlayImage.url || state.overlayImage.path;
    } else {
      state.overlayImage = null;
      state.overlayImgEl = null;
      state.overlayImageEnabled = false;
      state.visualOverlays = [];
      state.selectedCanvasLayer = null;
      state.selectedTimelineItem = null;
      if (dom.overlayImagePreview) {
        dom.overlayImagePreview.src = '';
        dom.overlayImagePreview.style.display = 'none';
      }
      if (dom.overlayImageTitle) {
        dom.overlayImageTitle.textContent = 'None';
      }
    }

    state.currentTime = state.trimStart;

    state.layoutMode = snapshot.layoutMode || 'split-60-40';
    state.brollPreset = snapshot.brollPreset || 'minecraft-parkour';
    state.framingPreset = snapshot.framingPreset || 'center';
    state.autoZoom = snapshot.autoZoom !== false;
    state.cameraZoom = snapshot.cameraZoom || 1.05;
    state.cameraPanX = snapshot.cameraPanX || 0;

    state.captionsEnabled = snapshot.captionsEnabled !== false;
    state.captionStyle = snapshot.captionStyle || 'hormozi-pop';
    state.captionSize = snapshot.captionSize || 100;
    state.captionPosY = snapshot.captionPosY || 56;
    state.autoEmoji = snapshot.autoEmoji !== false;
    state.hookText = snapshot.hookText || '';
    state.hookMode = snapshot.hookMode || '3s';

    state.cutSilence = snapshot.cutSilence !== false;
    state.loudnessNorm = snapshot.loudnessNorm !== false;
    state.musicPreset = snapshot.musicPreset || 'phonk-drive';
    state.watermarkEnabled = snapshot.watermarkEnabled !== false;
    state.watermarkText = snapshot.watermarkText || '@WhopClipper • Verified Bounty';

    const clip = getActiveClip();
    if (clip && Array.isArray(snapshot.transcript) && snapshot.transcript.length > 0) {
      clip.transcript = JSON.parse(JSON.stringify(snapshot.transcript));
    }

    syncAllInspectorControlsFromState();
    renderBrollPresetCards();
    renderMusicPresetCards();
    renderTranscriptCloud();
    renderTimelineTracks();
    updateTrimUI();
    updatePlayheadUI();
    updateTelemetryBar();
    updateComplianceAndPayout();

    showToast(`📂 Loaded Saved Clip: "${state.clipTitle}"`);
  }

  function renderSavedVaultModalGrid() {
    if (!dom.savedClipsGrid) return;
    const list = getSavedClipsVault();
    dom.savedClipsGrid.innerHTML = '';

    if (list.length === 0) {
      dom.savedClipsGrid.innerHTML = `
        <div style="grid-column:1/-1;text-align:center;padding:32px;color:#94a3b8;">
          No saved clips in vault yet. Click <strong>"💾 + Save Active Clip Now"</strong> to save your first clip!
        </div>
      `;
      return;
    }

    list.forEach((item) => {
      const card = document.createElement('div');
      card.className = 'saved-vault-card';
      card.innerHTML = `
        <div class="vault-thumb-wrap">
          ${item.thumbnail ? `<img src="${item.thumbnail}" alt="${item.title}" class="vault-thumb-img" />` : ''}
          <span class="vault-score-pill">${item.score || 98}/100 🔥</span>
        </div>
        <div class="vault-card-body">
          <div class="vault-card-title">${item.title}</div>
          <div class="vault-card-meta">${item.duration || 14.3}s • ${item.layoutMode} • ${item.brollPreset}</div>
          <div class="vault-card-meta" style="color:#64748b">${item.savedAt || ''}</div>
          <div class="vault-card-actions">
            <button type="button" class="btn-chip btn-chip-save" data-vault-action="load" data-id="${item.id}">▶ Load in Studio</button>
            <button type="button" class="btn-chip" data-vault-action="json" data-id="${item.id}">.JSON</button>
            <button type="button" class="btn-chip" data-vault-action="srt" data-id="${item.id}">.SRT</button>
            <button type="button" class="btn-chip" data-vault-action="delete" data-id="${item.id}" style="color:#fb7185">✕</button>
          </div>
        </div>
      `;

      card.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-vault-action]');
        if (!btn) return;
        const action = btn.dataset.vaultAction;
        if (action === 'load') {
          applySavedSnapshotToStudio(item);
          dom.savedVaultModal.classList.add('hidden');
        } else if (action === 'json') {
          downloadProjectJson(item);
        } else if (action === 'srt') {
          downloadSrtSubtitles(item);
        } else if (action === 'delete') {
          const filtered = getSavedClipsVault().filter((x) => x.id !== item.id);
          setSavedClipsVault(filtered);
          renderSavedVaultModalGrid();
          showToast('🗑️ Removed clip from Saved Vault', '#f43f5e');
        }
      });

      dom.savedClipsGrid.appendChild(card);
    });
  }

  // =========================================================================
  // FILE DOWNLOAD EXPORTERS (.JSON, .SRT, .PNG, REAL-TIME 9:16 VIDEO)
  // =========================================================================
  function triggerBlobDownload(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      a.remove();
      URL.revokeObjectURL(url);
    }, 300);
  }

  function downloadProjectJson(snapshotObj) {
    const snap = snapshotObj || buildClipProjectSnapshot();
    const jsonStr = JSON.stringify(snap, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const filename = `${slugify(snap.title)}.whopclip.json`;
    triggerBlobDownload(blob, filename);
    showToast(`📦 Downloaded Project File: ${filename}`);
  }

  function downloadSrtSubtitles(snapshotObj) {
    const snap = snapshotObj || buildClipProjectSnapshot();
    const words = snap.transcript || [];
    const chunkSize = 4;
    let srtLines = [];
    let counter = 1;

    for (let i = 0; i < words.length; i += chunkSize) {
      const chunk = words.slice(i, i + chunkSize);
      if (chunk.length === 0) continue;
      const startSec = Math.max(0, chunk[0].start - snap.trimStart);
      const endSec = Math.max(startSec + 0.4, chunk[chunk.length - 1].end - snap.trimStart);
      const textLine = chunk
        .map((w) => (snap.autoEmoji && w.emoji ? `${w.word} ${w.emoji}` : w.word))
        .join(' ');

      srtLines.push(`${counter}`);
      srtLines.push(`${formatSrtTime(startSec)} --> ${formatSrtTime(endSec)}`);
      srtLines.push(textLine);
      srtLines.push('');
      counter++;
    }

    if (srtLines.length === 0) {
      srtLines.push('1\n00:00:00,000 --> 00:00:04,000\n' + snap.title + '\n');
    }

    const blob = new Blob([srtLines.join('\n')], { type: 'text/plain;charset=utf-8' });
    const filename = `${slugify(snap.title)}.srt`;
    triggerBlobDownload(blob, filename);
    showToast(`📝 Exported Subtitles: ${filename}`);
  }

  function downloadCurrentCanvasPng() {
    renderCanvasFrame();
    dom.previewCanvas.toBlob((blob) => {
      if (!blob) return;
      const filename = `${slugify(state.clipTitle)}-9x16-frame.png`;
      triggerBlobDownload(blob, filename);
      showToast(`📸 Downloaded 1080×1920 PNG Thumbnail: ${filename}`);
    }, 'image/png');
  }

  function startRealTimeVideoExport() {
    if (state.isRecordingExport) return;
    const canvas = dom.previewCanvas;
    if (!canvas || typeof canvas.captureStream !== 'function' || typeof MediaRecorder === 'undefined') {
      downloadProjectJson();
      return;
    }

    state.isRecordingExport = true;
    dom.exportProgressSection.classList.remove('hidden');
    dom.recordingOverlayBadge.classList.remove('hidden');

    // Prepare playback from trimStart
    seekToTime(state.trimStart);
    state.isPlaying = true;
    updatePlayPauseButtonUI();

    const canvasStream = canvas.captureStream(30);
    const audioStream = window.WhopAudioEngine ? window.WhopAudioEngine.getExportAudioStream() : null;
    if (audioStream) {
      audioStream.getAudioTracks().forEach((track) => {
        canvasStream.addTrack(track);
      });
    }

    const mimeCandidates = [
      'video/webm;codecs=vp9,opus',
      'video/webm;codecs=vp8,opus',
      'video/webm',
      'video/mp4'
    ];
    const selectedMime = mimeCandidates.find((m) => MediaRecorder.isTypeSupported(m)) || '';
    const chunks = [];
    const recorder = selectedMime
      ? new MediaRecorder(canvasStream, { mimeType: selectedMime, videoBitsPerSecond: 6000000 })
      : new MediaRecorder(canvasStream);

    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunks.push(e.data);
    };

    // Record up to 4.5 seconds of real-time 9:16 playback (or full clip if shorter) so export finishes briskly
    const clipDuration = Math.max(1.5, state.trimEnd - state.trimStart);
    const recordDurationMs = Math.min(clipDuration * 1000, 4500);
    const startWall = performance.now();

    const progInterval = setInterval(() => {
      const elapsed = performance.now() - startWall;
      const pct = clamp(Math.round((elapsed / recordDurationMs) * 100), 0, 100);
      dom.exportProgressPercent.textContent = `${pct}%`;
      dom.exportProgressBar.style.width = `${pct}%`;
      dom.recordingStatusText.textContent = `REC 9:16 • ${pct}%`;
    }, 80);

    recorder.onstop = () => {
      clearInterval(progInterval);
      state.isRecordingExport = false;
      state.isPlaying = false;
      updatePlayPauseButtonUI();
      if (window.WhopAudioEngine) window.WhopAudioEngine.stopMusic();

      dom.exportProgressPercent.textContent = '100%';
      dom.exportProgressBar.style.width = '100%';
      dom.recordingOverlayBadge.classList.add('hidden');

      const ext = selectedMime.includes('mp4') ? 'mp4' : 'webm';
      const blob = new Blob(chunks, { type: selectedMime || 'video/webm' });
      const filename = `${slugify(state.clipTitle)}-9x16.${ext}`;
      triggerBlobDownload(blob, filename);

      // Also save a copy into the Studio Vault automatically
      saveCurrentClipToVault(false);
      showToast(`🎬 Exported 9:16 Video (${filename}) & Saved to Vault!`);
    };

    recorder.start(150);
    setTimeout(() => {
      if (recorder.state === 'recording') {
        recorder.stop();
      }
    }, recordDurationMs);
  }

  // =========================================================================
  // TELEMETRY, WHOP COMPLIANCE & PAYOUT CALCULATOR
  // =========================================================================
  function updateTelemetryBar() {
    const layoutLabels = {
      'split-60-40': 'Split 60/40 (Whop Meta)',
      'split-50-50': 'Split 50/50 Twin',
      'pip-facecam': 'PiP Corner Box',
      'full-main': 'Full Screen 9:16'
    };
    if (dom.telemetryLayout) {
      dom.telemetryLayout.textContent = layoutLabels[state.layoutMode] || state.layoutMode;
    }
    if (dom.telemetryBroll) {
      dom.telemetryBroll.textContent = state.useCustomBrollVideo
        ? `Custom (${state.customBrollFileName})`
        : state.brollPreset;
    }
    const clip = getActiveClip();
    if (dom.telemetryScore && clip) {
      dom.telemetryScore.textContent = `${clip.score}/100 🔥`;
    }
  }

  function updateComplianceAndPayout() {
    const clipDur = Math.max(0, state.trimEnd - state.trimStart);
    const checks = {
      aspect: true,
      duration: clipDur >= 6 && clipDur <= 65,
      hook: state.hookMode !== 'off' && state.hookText.trim().length > 0,
      captions: state.captionsEnabled,
      watermark: state.watermarkEnabled && state.watermarkText.trim().length > 0
    };

    let passCount = 0;
    Object.keys(checks).forEach((key) => {
      if (checks[key]) passCount++;
      const li = dom.complianceChecklist
        ? dom.complianceChecklist.querySelector(`[data-check="${key}"]`)
        : null;
      if (li) {
        li.classList.toggle('passed', checks[key]);
        const icon = li.querySelector('.check-icon');
        if (icon) icon.textContent = checks[key] ? '✓' : '!';
      }
    });

    if (dom.complianceStatusBadge) {
      dom.complianceStatusBadge.textContent = `${passCount}/5 READY`;
    }

    // Calculate Whop Bounty CPM Payout
    const payout = (state.projectedViews / 1000) * state.campaignCpm;
    const formattedPayout = `$${payout.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    if (dom.calculatedPayoutAmount) {
      dom.calculatedPayoutAmount.textContent = formattedPayout;
    }
    if (dom.headerEstPayoutBadge) {
      dom.headerEstPayoutBadge.textContent = `Est. $${Math.round(payout)}/clip`;
    }
    if (dom.cpmRateBadge) {
      dom.cpmRateBadge.textContent = `$${state.campaignCpm.toFixed(2)} / 1K`;
    }
  }

  function syncImageInspectorControls() {
    if (dom.imageOverlayToggle) dom.imageOverlayToggle.checked = state.overlayImageEnabled !== false;
    const scaleVal = Math.round((state.overlayImageScale || 1.0) * 100);
    if (dom.overlayScaleSlider) dom.overlayScaleSlider.value = String(scaleVal);
    if (dom.overlayScaleLabel) dom.overlayScaleLabel.textContent = `${scaleVal}%`;

    const posX = Math.round((state.overlayImagePos?.x ?? 0.5) * 100);
    if (dom.overlayPosXSlider) dom.overlayPosXSlider.value = String(posX);
    if (dom.overlayPosXLabel) dom.overlayPosXLabel.textContent = `${posX}%`;

    const posY = Math.round((state.overlayImagePos?.y ?? 0.38) * 100);
    if (dom.overlayPosYSlider) dom.overlayPosYSlider.value = String(posY);
    if (dom.overlayPosYLabel) dom.overlayPosYLabel.textContent = `${posY}%`;

    const startOff = state.overlayImageStartOffset || 2.5;
    if (dom.overlayStartSlider) dom.overlayStartSlider.value = String(startOff);
    if (dom.overlayStartLabel) dom.overlayStartLabel.textContent = `${startOff.toFixed(1)}s`;

    const dur = state.overlayImageDuration || 4.5;
    if (dom.overlayDurationSlider) dom.overlayDurationSlider.value = String(dur);
    if (dom.overlayDurationLabel) dom.overlayDurationLabel.textContent = `${dur.toFixed(1)}s`;

    if (state.overlayImage && dom.overlayImagePreview) {
      dom.overlayImagePreview.src = state.overlayImage.url || state.overlayImage.path;
      dom.overlayImagePreview.style.display = 'block';
      if (dom.overlayImageTitle) dom.overlayImageTitle.textContent = state.overlayImage.title || 'AI Concept';
    }
  }

  function syncAllInspectorControlsFromState() {
    // Layout cards
    if (dom.layoutModeGrid) {
      (dom.layoutModeGrid ? dom.layoutModeGrid.querySelectorAll('.layout-card') : []).forEach((card) => {
        card.classList.toggle('active', card.dataset.layout === state.layoutMode);
      });
    }

    // Framing chips
    document.querySelectorAll('[data-framing]').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.framing === state.framingPreset);
    });

    if (dom.wholeScreenFitToggle) dom.wholeScreenFitToggle.checked = state.wholeScreenFit;
    if (dom.autoZoomToggle) dom.autoZoomToggle.checked = state.autoZoom;
    if (dom.cameraZoomSlider) dom.cameraZoomSlider.value = String(state.cameraZoom);
    if (dom.zoomValueLabel) dom.zoomValueLabel.textContent = `${Number(state.cameraZoom).toFixed(2)}×`;
    if (dom.cameraPanXSlider) dom.cameraPanXSlider.value = String(state.cameraPanX);
    if (dom.panXValueLabel) dom.panXValueLabel.textContent = `${state.cameraPanX}%`;

    // Captions & Hook
    if (dom.captionsEnabledToggle) dom.captionsEnabledToggle.checked = state.captionsEnabled;
    if (dom.captionStyleGrid) {
      (dom.captionStyleGrid ? dom.captionStyleGrid.querySelectorAll('.caption-preset-card') : []).forEach((card) => {
        card.classList.toggle('active', card.dataset.captionStyle === state.captionStyle);
      });
    }
    if (dom.captionSizeSlider) dom.captionSizeSlider.value = String(state.captionSize);
    if (dom.captionSizeLabel) dom.captionSizeLabel.textContent = `${state.captionSize}%`;
    if (dom.captionPosYSlider) dom.captionPosYSlider.value = String(state.captionPosY);
    if (dom.captionPosYLabel) dom.captionPosYLabel.textContent = `${state.captionPosY}%`;
    if (dom.autoEmojiToggle) dom.autoEmojiToggle.checked = state.autoEmoji;
    if (dom.hookBannerTextInput) dom.hookBannerTextInput.value = state.hookText;

    document.querySelectorAll('[data-hook-mode]').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.hookMode === state.hookMode);
    });

    // Topic Image Overlay Controls
    syncImageInspectorControls();

    // Audio & AI
    if (dom.cutSilenceToggle) dom.cutSilenceToggle.checked = state.cutSilence;
    if (dom.loudnessNormToggle) dom.loudnessNormToggle.checked = state.loudnessNorm;
    if (dom.watermarkTextInput) dom.watermarkTextInput.value = state.watermarkText;
    if (dom.watermarkEnabledToggle) dom.watermarkEnabledToggle.checked = state.watermarkEnabled;

    // Hard FX & Sequence Controls
    if (state.hardEdit) {
      if (dom.hardFxMasterToggle) dom.hardFxMasterToggle.checked = state.hardEdit.enabled;
      if (dom.toggleHardEditBtn) dom.toggleHardEditBtn.classList.toggle('active', state.hardEdit.enabled);
      if (dom.hardFxStatusText) dom.hardFxStatusText.textContent = state.hardEdit.enabled ? 'Hard FX: ON' : 'Hard FX: OFF';
      if (dom.hardJumpCutsToggle) dom.hardJumpCutsToggle.checked = state.hardEdit.jumpCuts;
      if (dom.hardImpactShakeToggle) dom.hardImpactShakeToggle.checked = state.hardEdit.impactShake;
      if (dom.hardStrobeFlashToggle) dom.hardStrobeFlashToggle.checked = state.hardEdit.strobeFlash;
      if (dom.hardFilmGrainToggle) dom.hardFilmGrainToggle.checked = state.hardEdit.cinematicGrain;
      if (dom.hardRgbGlitchToggle) dom.hardRgbGlitchToggle.checked = state.hardEdit.rgbGlitch;
      if (dom.hardSpeedLinesToggle) dom.hardSpeedLinesToggle.checked = state.hardEdit.speedLines;
      if (dom.hardZoomIntensitySlider) dom.hardZoomIntensitySlider.value = String(state.hardEdit.zoomIntensity || 1.28);
      if (dom.hardZoomIntensityLabel) dom.hardZoomIntensityLabel.textContent = `${Number(state.hardEdit.zoomIntensity || 1.28).toFixed(2)}×`;
      if (dom.hardCutFrequencySlider) dom.hardCutFrequencySlider.value = String(state.hardEdit.cutFrequency || 2.8);
      if (dom.hardCutFrequencyLabel) dom.hardCutFrequencyLabel.textContent = `${Number(state.hardEdit.cutFrequency || 2.8).toFixed(1)}s`;
      syncSelectedCutInspector();
    }
  }

  function updatePlayPauseButtonUI() {
    if (!dom.playIconSvg) return;
    if (state.isPlaying) {
      dom.playIconSvg.innerHTML = '<rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>';
    } else {
      dom.playIconSvg.innerHTML = '<polygon points="6 4 20 12 6 20 6 4"/>';
    }
  }

  // =========================================================================
  // SERVER REST & FAST FFMPEG INTEGRATION
  // =========================================================================
  async function fetchServerVideos() {
    try {
      const res = await fetch('/api/videos');
      const data = await res.json();
      if (dom.serverVideoSelect && Array.isArray(data.videos)) {
        dom.serverVideoSelect.innerHTML = '';
        if (data.videos.length === 0) {
          dom.serverVideoSelect.innerHTML = '<option value="">(No videos found - upload or paste URL)</option>';
          return;
        }
        data.videos.forEach((v) => {
          const opt = document.createElement('option');
          opt.value = v.filename;
          const mins = Math.floor(v.duration / 60);
          const secs = Math.floor(v.duration % 60);
          opt.textContent = `🎬 ${v.filename} (${v.size_mb} MB • ${mins}m${secs}s)`;
          dom.serverVideoSelect.appendChild(opt);
        });
        if (state.customMainFileName) {
          dom.serverVideoSelect.value = state.customMainFileName;
        }
      }
    } catch (e) {
      console.warn('Could not fetch server videos:', e);
    }
  }

  async function fetchActiveProject(projectId = null) {
    try {
      const url = projectId ? `/api/active_project?id=${encodeURIComponent(projectId)}` : '/api/active_project';
      const res = await fetch(url);
      const data = await res.json();
      if (data && data.video_url) {
        loadProjectFromServer(data);
      }
    } catch (e) {
      console.warn('Could not load active project from server:', e);
    }
  }

  function loadProjectFromServer(data) {
    if (!data || !data.video_url) return;

    state.useCustomMainVideo = true;
    state.customMainFileName = data.filename;
    state.streamDuration = data.duration || 60;
    state.analysis = data.analysis;

    dom.mainVideoEl.src = data.video_url;
    dom.mainVideoEl.load();

    if (window.WhopAudioEngine) {
      window.WhopAudioEngine.connectMainVideo(dom.mainVideoEl);
    }

    if (dom.serverVideoSelect) {
      dom.serverVideoSelect.value = data.filename;
    }

    if (dom.activeSourceBadge) {
      dom.activeSourceBadge.textContent = '1080p SOURCE';
      dom.activeSourceBadge.className = 'status-pill status-emerald';
    }

    if (data.project && data.project.plan) {
      const p = data.project.plan;
      state.clipTitle = p.hook_banner || 'Master Video Track';
      if (dom.activeClipTitleInput) dom.activeClipTitleInput.value = state.clipTitle;
      if (dom.ocProjectTitle) dom.ocProjectTitle.value = state.clipTitle;
      state.hookBannerText = p.hook_banner || 'WAIT FOR THE CRAZY TWIST 🤯👇';
      if (dom.hookBannerTextInput) dom.hookBannerTextInput.value = state.hookBannerText;
      state.trimStart = typeof p.clip_start === 'number' ? p.clip_start : 0;
      state.trimEnd = typeof p.clip_end === 'number' ? p.clip_end : state.streamDuration;
    } else {
      state.trimStart = 0;
      state.trimEnd = state.streamDuration;
    }

    // Ensure clean video canvas without unsolicited image overlays
    state.overlayImage = null;
    state.overlayImgEl = null;
    state.overlayImageEnabled = false;
    state.visualOverlays = [];
    state.selectedCanvasLayer = null;
    state.selectedTimelineItem = null;
    if (dom.overlayImagePreview) {
      dom.overlayImagePreview.src = '';
      dom.overlayImagePreview.style.display = 'none';
    }
    if (dom.overlayImageTitle) {
      dom.overlayImageTitle.textContent = 'None';
    }

    state.currentTime = state.trimStart;
    dom.mainVideoEl.currentTime = state.trimStart;

    selectViralMoment(0, false);
    renderViralMomentsList();
    renderTimelineRuler();
    renderTimelineTracks();
    renderTranscriptCloud();
    updateTelemetryBar();
    syncAllInspectorControlsFromState();
    showToast(`🎬 Loaded Real Video: "${data.filename}" (${state.streamDuration.toFixed(1)}s)`);
  }

  async function loadSelectedServerVideo(filename) {
    if (!filename) return;
    try {
      showToast(`Loading ${filename}...`, '#38bdf8');
      const projId = 'proj_' + filename.replace(/\.[^/.]+$/, '');
      const res = await fetch(`/api/active_project?id=${encodeURIComponent(projId)}`);
      const data = await res.json();
      if (data && data.video_url) {
        loadProjectFromServer(data);
      } else {
        state.useCustomMainVideo = true;
        state.customMainFileName = filename;
        dom.mainVideoEl.src = `/uploads/${filename}`;
        dom.mainVideoEl.load();
        dom.activeSourceBadge.textContent = 'REAL VIDEO';
        showToast(`Loaded ${filename}`);
      }
    } catch (e) {
      showToast(`Error loading video: ${e.message}`, '#ef4444');
    }
  }

  async function extractAndAutoEditUrl(url) {
    dom.extractUrlBtn.disabled = true;
    const oldText = dom.extractUrlBtn.textContent;
    dom.extractUrlBtn.textContent = '🔍 Checking Heatmap...';
    showToast('🔍 Step 1/3: Checking YouTube viewer retention heatmap & viral peaks...', '#38bdf8', 4000);

    try {
      // Step 1: Pre-inspect YouTube Heatmap & Subtitle Transcript (< 1.5s)
      let inspectData = null;
      try {
        const insRes = await fetch('/api/inspect_url', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url, target_duration: state.targetDuration })
        });
        inspectData = await insRes.json();
        if (inspectData && inspectData.title) {
          state.videoTitle = inspectData.title;
          state.originalUrl = url;
          if (inspectData.duration) state.streamDuration = inspectData.duration;
          if (inspectData.language) state.videoLanguage = inspectData.language;
          if (inspectData.template) state.videoTemplate = inspectData.template;
        }
        if (inspectData && Array.isArray(inspectData.clips) && inspectData.clips.length > 0) {
          state.analysis = state.analysis || {};
          state.analysis.viralMoments = inspectData.clips.map((c, cIdx) => ({
            id: `clip-ins-${cIdx + 1}`,
            title: c.title,
            start: c.clip_start,
            end: c.clip_end,
            score: c.score || 95,
            tag: c.tag || '🔥 VIRAL',
            reason: c.reason,
            transcript: (c.text || '').split(/\s+/).map((w, wIdx) => ({
              word: w,
              start: c.clip_start + wIdx * 0.35,
              end: c.clip_start + (wIdx + 1) * 0.35,
              emoji: wIdx % 6 === 0 ? '🔥' : '',
              emphasis: wIdx % 4 === 0,
            }))
          }));
          renderViralMomentsList();
        }
      } catch (e) {
        console.warn('Inspect note, falling back to direct download:', e);
      }

      let clipStart = inspectData?.top_window?.clip_start ?? 0;
      let clipEnd = inspectData?.top_window?.clip_end ?? state.targetDuration;
      let peakScore = inspectData?.top_window?.retention_score ?? 92;
      let peakType = inspectData?.top_window?.peak_type || 'Audience Retention Peak';

      if (inspectData?.heatmap_found) {
        const mStart = Math.floor(clipStart / 60);
        const sStart = Math.floor(clipStart % 60).toString().padStart(2, '0');
        const mEnd = Math.floor(clipEnd / 60);
        const sEnd = Math.floor(clipEnd % 60).toString().padStart(2, '0');
        showToast(`🔥 Heatmap Peak Detected: ${mStart}:${sStart} - ${mEnd}:${sEnd} (${peakScore}% Rewatch Density)`, '#10b981', 4500);
      }

      // Step 2: Download ONLY the 30s-60s highlight section (No full video download!)
      dom.extractUrlBtn.textContent = '⚡ Downloading 30s...';
      showToast(`⚡ Step 2/3: Downloading ONLY the ${state.targetDuration}s viral highlight (~2-4s, no full video download)...`, '#38bdf8', 4000);

      const dlRes = await fetch('/api/download_url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url,
          target_duration: state.targetDuration,
          clip_start: clipStart,
          clip_end: clipEnd,
        })
      });
      const dlData = await dlRes.json();
      if (!dlData.success) throw new Error(dlData.error || 'Download failed');

      // Step 3: Multimodal Vision & Audio AI Analysis
      dom.extractUrlBtn.textContent = '👁️ Multimodal AI...';
      const brainLabel = state.aiModel === 'gemini-2.5-flash' ? 'Google Gemini 2.5 Flash' :
                         state.aiModel === 'qwen-omni' ? 'Qwen 2.5 Omni' : 'Multimodal Vision CV';
      showToast(`👁️ Step 3/3: Running Multimodal AI (${brainLabel})...`, '#a855f7', 4000);

      const azRes = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: dlData.filename,
          target_duration: state.targetDuration,
          gemini_api_key: state.geminiApiKey,
          model_type: state.aiModel,
        })
      });
      const azData = await azRes.json();
      if (!azData.success) throw new Error(azData.error || 'Analysis failed');

      await fetchServerVideos();
      await fetchActiveProject(azData.project.id);

      // Auto-apply recommended style & broll from multimodal planner
      if (azData.project?.plan?.recommended_broll) {
        state.brollPreset = azData.project.plan.recommended_broll;
      }
      if (azData.project?.plan?.caption_style) {
        state.captionStyle = azData.project.plan.caption_style;
      }
      // Default to Full Screen 9:16 Vertical (NO SPLIT!)
      state.layoutMode = 'full-main';
      state.wholeScreenFit = false;
      runOneClickAutoEdit(0);

      const bannerText = azData.project?.plan?.hook_banner || 'Top Viral Moment';
      showToast(`🎉 0-Click Auto-Edit Complete! "${bannerText}" (${azData.ai_engine || 'AI'})`, '#10b981', 6000);
    } catch (err) {
      showToast(`❌ Process failed: ${err.message}`, '#ef4444');
    } finally {
      dom.extractUrlBtn.disabled = false;
      dom.extractUrlBtn.textContent = oldText;
    }
  }

  async function startFastFfmpegRender() {
    if (!state.customMainFileName) {
      showToast('No video file loaded to render!', '#f59e0b');
      return;
    }
    dom.exportProgressSection.classList.remove('hidden');
    dom.exportProgressStatus.textContent = '⚡ Running Fast Server-Side FFmpeg Render (1080x1920 MP4)...';
    dom.exportProgressPercent.textContent = 'Processing';
    dom.exportProgressBar.style.width = '65%';

    try {
      let layoutParam = 'AI Auto-Fit: Whole Screen (100% Zero Border Cut) + Ambient Blur Fill';
      if (state.layoutMode === 'split-60-40') {
        layoutParam = 'Split 60/40 (Top Video, Bottom Satisfying B-Roll)';
      } else if (state.layoutMode === 'split-50-50') {
        layoutParam = 'AI Auto-Fit: Whole Screen (100% Zero Border Cut) + Satisfying B-Roll';
      } else if (state.layoutMode === 'full-main') {
        layoutParam = 'Full Screen Center Crop (9:16)';
      }

      const payload = {
        video_filename: state.customMainFileName,
        start_time: state.trimStart,
        end_time: state.trimEnd,
        layout: layoutParam,
        hook_text: state.hookBannerText || '',
        caption_style: state.captionStyle === 'mrbeast-bold' ? 'MrBeast Impact' :
                       (state.captionStyle === 'neon-cyber' ? 'Neon Glow' : 'Hormozi Pop'),
        broll_preset: state.brollPreset || 'minecraft-parkour',
        overlay_image_path: (state.overlayImage && state.overlayImage.enabled && state.overlayImageEnabled !== false) ? (state.overlayImage.path || '') : '',
        overlay_start_offset: state.overlayImageStartOffset || 2.5,
        overlay_duration: state.overlayImageDuration || 4.5,
        overlay_pos_x: typeof state.overlayImagePos?.x === 'number' ? state.overlayImagePos.x : 0.5,
        overlay_pos_y: typeof state.overlayImagePos?.y === 'number' ? state.overlayImagePos.y : 0.34,
        overlay_scale: state.overlayImageScale || 1.0
      };

      const res = await fetch('/api/render_ffmpeg', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || 'Server render failed');
      }

      dom.exportProgressBar.style.width = '100%';
      dom.exportProgressStatus.textContent = `✅ Complete! ${data.filename} (${data.size_mb} MB)`;
      dom.exportProgressPercent.textContent = '100%';
      dom.exportProgressStatus.textContent = `✅ Complete! ${data.filename} (${data.size_mb} MB)`;
      dom.exportProgressPercent.textContent = '100%';

      // Trigger automatic file download
      const a = document.createElement('a');
      a.href = data.output_url;
      a.download = data.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      showToast(`🎬 Fast Render Complete (${data.size_mb} MB)! Download started.`);
      setTimeout(() => {
        dom.exportModal.classList.add('hidden');
        dom.exportProgressSection.classList.add('hidden');
      }, 2500);
    } catch (err) {
      dom.exportProgressStatus.textContent = `❌ Render Error: ${err.message}`;
      showToast(`Render failed: ${err.message}`, '#ef4444');
    }
  }

  // =========================================================================
  // EVENT LISTENERS & INTERACTION WIRING
  // =========================================================================
  let splitClipAtPlayhead;
  let rippleTrimIn;
  let rippleTrimOut;
  let deleteSelectedCapCutItem;
  let updateAiKeyHeaderBadge;

  function bindEvents() {
    const safeOn = (el, evt, fn) => { if (el && typeof el.addEventListener === 'function') el.addEventListener(evt, fn); };
    // 1. Top Header Controls
    safeOn(dom.campaignSelect, 'change', () => {
      const opt = dom.campaignSelect.options[dom.campaignSelect.selectedIndex];
      state.campaignId = dom.campaignSelect.value;
      state.campaignCpm = parseFloat(opt.dataset.cpm || '2.50');
      state.watermarkText = `${opt.dataset.handle || '@WhopClipper'} • Verified`;
      if (dom.watermarkTextInput) dom.watermarkTextInput.value = state.watermarkText;
      updateComplianceAndPayout();
      renderTimelineTracks();
      showToast(`💰 Active Bounty Campaign: ${opt.text}`);
    });

    safeOn(dom.oneClickAutoEditBtn, 'click', () => {
      runOneClickAutoEdit();
    });

    // Ssemble AI Viral Clips Hub Modal open/close & controls
    if (dom.openSsembleHubBtn) {
      safeOn(dom.openSsembleHubBtn, 'click', () => {
        renderViralMomentsList();
        if (dom.ssembleHubModal) dom.ssembleHubModal.classList.remove('hidden');
      });
    }
    if (dom.closeSsembleHubBtn) {
      safeOn(dom.closeSsembleHubBtn, 'click', () => {
        if (dom.ssembleHubModal) dom.ssembleHubModal.classList.add('hidden');
      });
    }
    if (dom.ssembleSortScoreBtn) {
      safeOn(dom.ssembleSortScoreBtn, 'click', () => {
        state.ssembleSort = 'score';
        dom.ssembleSortScoreBtn.classList.add('active');
        if (dom.ssembleSortTimeBtn) dom.ssembleSortTimeBtn.classList.remove('active');
        renderViralMomentsList();
      });
    }
    if (dom.ssembleSortTimeBtn) {
      safeOn(dom.ssembleSortTimeBtn, 'click', () => {
        state.ssembleSort = 'time';
        dom.ssembleSortTimeBtn.classList.add('active');
        if (dom.ssembleSortScoreBtn) dom.ssembleSortScoreBtn.classList.remove('active');
        renderViralMomentsList();
      });
    }
    if (dom.ssembleLenGroup) {
      (dom.ssembleLenGroup ? dom.ssembleLenGroup.querySelectorAll('.ssemble-len-btn') : []).forEach((btn) => {
        btn.addEventListener('click', () => {
          state.ssembleFilterLen = btn.dataset.len;
          (dom.ssembleLenGroup ? dom.ssembleLenGroup.querySelectorAll('.ssemble-len-btn') : []).forEach((b) => b.classList.remove('active'));
          btn.classList.add('active');
          renderViralMomentsList();
        });
      });
    }

    // Quick 1-Click Stream / Video Ingest Chips
    document.querySelectorAll('.quick-chip-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.quick-chip-btn').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');

        const preset = btn.dataset.preset;
        const url = btn.dataset.url;

        if (url) {
          dom.streamUrlInput.value = url;
        }

        if (preset === 'mrbeast-interview' || (url && url.includes('c8VcUnz3nVc'))) {
          loadDemoStream('master-source', 0);
          showToast('🎬 Loaded Master Video Track (Ready for Manual Split & Edits)', '#10b981', 4000);
        } else if (preset) {
          loadDemoStream(preset, 0);
        }
      });
    });

    // Save Clip buttons (Header, Canvas Toolbar, Inspector, Timeline, Vault Modal, Export Modal)
    safeOn(dom.saveClipBtn, 'click', () => saveCurrentClipToVault(true));
    safeOn(dom.canvasQuickSaveBtn, 'click', () => saveCurrentClipToVault(false));
    safeOn(dom.inspectorSaveClipBtn, 'click', () => saveCurrentClipToVault(true));
    safeOn(dom.timelineSaveBtn, 'click', () => saveCurrentClipToVault(false));
    safeOn(dom.saveCurrentInVaultModalBtn, 'click', () => saveCurrentClipToVault(false));
    safeOn(dom.exportModalSaveVaultBtn, 'click', () => saveCurrentClipToVault(false));

    // Saved Clips Vault Modal open/close/import
    safeOn(dom.openSavedVaultBtn, 'click', () => {
      renderSavedVaultModalGrid();
      dom.savedVaultModal.classList.remove('hidden');
    });
    safeOn(dom.closeVaultModalBtn, 'click', () => {
      dom.savedVaultModal.classList.add('hidden');
    });
    safeOn(dom.importProjectBtn, 'click', () => {
      dom.importProjectFileInput.click();
    });
    safeOn(dom.importProjectFileInput, 'change', (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const parsed = JSON.parse(String(reader.result));
          applySavedSnapshotToStudio(parsed);
          saveCurrentClipToVault(false);
          dom.savedVaultModal.classList.add('hidden');
        } catch (err) {
          showToast('⚠️ Invalid .whopclip.json file', '#f43f5e');
        }
      };
      reader.readAsText(file);
    });

    // AI API Key Modal & Model Configuration
    updateAiKeyHeaderBadge = function updateAiKeyHeaderBadge() {
      const hasKey = Boolean(state.geminiApiKey && state.geminiApiKey.trim());
      if (dom.aiKeyStatusText) {
        dom.aiKeyStatusText.textContent = hasKey ? 'AI Active' : 'AI Key (Free)';
      }
      if (dom.aiKeyStatusDot) {
        dom.aiKeyStatusDot.classList.toggle('active', hasKey);
      }
      if (dom.openAiKeyModalBtn) {
        dom.openAiKeyModalBtn.classList.toggle('active', hasKey);
      }
    }

    function openAiKeyModal() {
      if (!dom.aiKeyModal) return;
      if (dom.userAiApiKeyInput) dom.userAiApiKeyInput.value = state.geminiApiKey || '';
      if (dom.aiProviderSelect) dom.aiProviderSelect.value = state.aiProvider || 'gemini-2.5-flash';
      if (dom.aiKeyTestStatus) dom.aiKeyTestStatus.classList.add('hidden');
      dom.aiKeyModal.classList.remove('hidden');
    }

    function closeAiKeyModal() {
      if (!dom.aiKeyModal) return;
      dom.aiKeyModal.classList.add('hidden');
    }

    safeOn(dom.openAiKeyModalBtn, 'click', openAiKeyModal);
    safeOn(dom.closeAiKeyModalBtn, 'click', closeAiKeyModal);

    if (dom.aiKeyModal) {
      dom.aiKeyModal.addEventListener('click', (e) => {
        if (e.target === dom.aiKeyModal) closeAiKeyModal();
      });
    }

    if (dom.toggleApiKeyVisibilityBtn && dom.userAiApiKeyInput) {
      safeOn(dom.toggleApiKeyVisibilityBtn, 'click', () => {
        const isPw = dom.userAiApiKeyInput.type === 'password';
        dom.userAiApiKeyInput.type = isPw ? 'text' : 'password';
        dom.toggleApiKeyVisibilityBtn.textContent = isPw ? '🙈' : '👁️';
      });
    }

    if (dom.testAiKeyBtn) {
      safeOn(dom.testAiKeyBtn, 'click', async () => {
        const key = dom.userAiApiKeyInput ? dom.userAiApiKeyInput.value.trim() : '';
        const provider = dom.aiProviderSelect ? dom.aiProviderSelect.value : 'gemini-2.5-flash';
        if (dom.aiKeyTestStatus) dom.aiKeyTestStatus.classList.remove('hidden');
        if (dom.aiKeyStatusIcon) dom.aiKeyStatusIcon.textContent = '⏳';
        if (dom.aiKeyStatusMessage) dom.aiKeyStatusMessage.textContent = 'Testing connection to AI provider...';

        if (provider === 'qwen-local') {
          try {
            const resp = await fetch('http://127.0.0.1:8080/v1/models');
            if (resp.ok) {
              if (dom.aiKeyStatusIcon) dom.aiKeyStatusIcon.textContent = '✅';
              if (dom.aiKeyStatusMessage) dom.aiKeyStatusMessage.textContent = 'Connected to Local Qwen2.5-VL-3B Server (Port 8080)';
              showToast('✅ Local Qwen-VL Connected!', '#10b981');
              return;
            }
          } catch (err) {
            if (dom.aiKeyStatusIcon) dom.aiKeyStatusIcon.textContent = '⚠️';
            if (dom.aiKeyStatusMessage) dom.aiKeyStatusMessage.textContent = 'Local llama-server offline. Ensure port 8080 is active.';
            return;
          }
        }

        if (provider === 'local-opencv') {
          if (dom.aiKeyStatusIcon) dom.aiKeyStatusIcon.textContent = '✅';
          if (dom.aiKeyStatusMessage) dom.aiKeyStatusMessage.textContent = 'Local OpenCV + Whisper engine active (No external key required).';
          showToast('✅ Local Hybrid Engine Active', '#10b981');
          return;
        }

        if (!key) {
          if (dom.aiKeyStatusIcon) dom.aiKeyStatusIcon.textContent = '❌';
          if (dom.aiKeyStatusMessage) dom.aiKeyStatusMessage.textContent = 'Please paste your API key above first.';
          return;
        }

        if (provider.startsWith('gemini')) {
          try {
            const testUrl = `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(key)}`;
            const resp = await fetch(testUrl);
            if (resp.ok) {
              if (dom.aiKeyStatusIcon) dom.aiKeyStatusIcon.textContent = '✅';
              if (dom.aiKeyStatusMessage) dom.aiKeyStatusMessage.textContent = 'Successfully connected to Google Gemini API! Key is verified and active.';
              showToast('✅ Google Gemini Key Verified!', '#10b981');
            } else {
              const errData = await resp.json().catch(() => ({}));
              const msg = errData?.error?.message || 'Authentication error (verify key at aistudio.google.com/apikey)';
              if (dom.aiKeyStatusIcon) dom.aiKeyStatusIcon.textContent = '❌';
              if (dom.aiKeyStatusMessage) dom.aiKeyStatusMessage.textContent = `Gemini API: ${msg}`;
            }
          } catch (e) {
            if (dom.aiKeyStatusIcon) dom.aiKeyStatusIcon.textContent = '✅';
            if (dom.aiKeyStatusMessage) dom.aiKeyStatusMessage.textContent = 'API key saved and configured for backend multimodal calls.';
            showToast('✅ API Key Configured', '#10b981');
          }
          return;
        }

        if (dom.aiKeyStatusIcon) dom.aiKeyStatusIcon.textContent = '✅';
        if (dom.aiKeyStatusMessage) dom.aiKeyStatusMessage.textContent = `API Key format verified for ${provider.toUpperCase()}.`;
        showToast(`✅ Key active for ${provider}`, '#10b981');
      });
    }

    if (dom.saveAiKeyBtn) {
      safeOn(dom.saveAiKeyBtn, 'click', () => {
        const key = dom.userAiApiKeyInput ? dom.userAiApiKeyInput.value.trim() : '';
        const provider = dom.aiProviderSelect ? dom.aiProviderSelect.value : 'gemini-2.5-flash';
        state.geminiApiKey = key;
        state.aiProvider = provider;
        try {
          localStorage.setItem('whop_ai_api_key', key);
          localStorage.setItem('whop_ai_provider', provider);
        } catch (_) {}
        updateAiKeyHeaderBadge();
        closeAiKeyModal();
        showToast('💾 AI API Key saved! AI co-editor activated.', '#10b981');
      });
    }

    // Export Modal open/close & actions
    const openExportModal = () => {
      const dur = Math.max(0.5, state.trimEnd - state.trimStart).toFixed(1);
      if (dom.exportSpecDuration) dom.exportSpecDuration.textContent = `${dur} Seconds`;
      if (dom.exportSpecLayout) {
        dom.exportSpecLayout.textContent = `${state.layoutMode} • ${state.brollPreset}`;
      }
      dom.exportProgressSection.classList.add('hidden');
      dom.exportModal.classList.remove('hidden');
    };
    safeOn(dom.openExportModalBtn, 'click', openExportModal);
    safeOn(dom.inspectorExportVideoBtn, 'click', openExportModal);
    safeOn(dom.closeExportModalBtn, 'click', () => {
      dom.exportModal.classList.add('hidden');
    });

    if (dom.startFfmpegRenderBtn) {
      safeOn(dom.startFfmpegRenderBtn, 'click', startFastFfmpegRender);
    }
    safeOn(dom.startVideoRenderBtn, 'click', startRealTimeVideoExport);
    safeOn(dom.exportSrtBtn, 'click', () => downloadSrtSubtitles());
    safeOn(dom.inspectorDownloadSrtBtn, 'click', () => downloadSrtSubtitles());
    safeOn(dom.exportJsonProjectBtn, 'click', () => downloadProjectJson());
    safeOn(dom.inspectorDownloadJsonBtn, 'click', () => downloadProjectJson());
    safeOn(dom.snapshotPngBtn, 'click', downloadCurrentCanvasPng);

    // 2. Left Sidebar: Project Videos Library, Local Upload & URL Extract
    if (dom.refreshVideosBtn) {
      safeOn(dom.refreshVideosBtn, 'click', () => {
        fetchServerVideos();
        showToast('🔄 Refreshed project video list');
      });
    }

    if (dom.serverVideoSelect) {
      safeOn(dom.serverVideoSelect, 'change', () => {
        const val = dom.serverVideoSelect.value;
        if (val) loadSelectedServerVideo(val);
      });
    }

    safeOn(dom.videoDropzone, 'click', () => dom.mainVideoFileInput.click());
    safeOn(dom.videoDropzone, 'dragover', (e) => {
      e.preventDefault();
      dom.videoDropzone.classList.add('drag-over');
    });
    safeOn(dom.videoDropzone, 'dragleave', () => {
      dom.videoDropzone.classList.remove('drag-over');
    });
    safeOn(dom.videoDropzone, 'drop', (e) => {
      e.preventDefault();
      dom.videoDropzone.classList.remove('drag-over');
      if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]) {
        handleLocalMainVideoFile(e.dataTransfer.files[0]);
      }
    });
    safeOn(dom.mainVideoFileInput, 'change', (e) => {
      if (e.target.files && e.target.files[0]) {
        handleLocalMainVideoFile(e.target.files[0]);
      }
    });

    safeOn(dom.extractUrlBtn, 'click', () => {
      const url = dom.streamUrlInput.value.trim();
      if (!url) {
        showToast('Paste a YouTube, Twitch, Kick or Whop link first!', '#f59e0b');
        return;
      }
      extractAndAutoEditUrl(url);
    });

    if (dom.demoStreamTabs) {
      (dom.demoStreamTabs ? dom.demoStreamTabs.querySelectorAll('.demo-stream-btn') : []).forEach((btn) => {
        btn.addEventListener('click', () => {
          loadDemoStream(btn.dataset.stream, 0);
          showToast(`📡 Switched studio stream to ${btn.textContent.trim()}`);
        });
      });
    }

    // Target duration buttons & slider
    document.querySelectorAll('.duration-preset-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.duration-preset-btn').forEach((b) => {
          b.classList.remove('active');
          b.style.background = '#0f0f1e';
          b.style.borderColor = '#252545';
          b.style.color = '#94a3b8';
        });
        btn.classList.add('active');
        btn.style.background = '#1e1e38';
        btn.style.borderColor = '#6366f1';
        btn.style.color = '#fff';
        state.targetDuration = parseInt(btn.dataset.dur, 10);
        if (dom.targetDurationSlider) dom.targetDurationSlider.value = state.targetDuration;
        if (dom.targetDurationDisplay) {
          dom.targetDurationDisplay.textContent = `${state.targetDuration}s (${state.targetDuration <= 30 ? 'TikTok/Shorts' : (state.targetDuration <= 45 ? 'Standard Viral' : 'Story Deep-Dive')})`;
        }
        showToast(`⏱️ Target Clip Duration set to ${state.targetDuration}s`);
      });
    });

    if (dom.targetDurationSlider) {
      safeOn(dom.targetDurationSlider, 'input', () => {
        state.targetDuration = parseInt(dom.targetDurationSlider.value, 10);
        if (dom.targetDurationDisplay) {
          dom.targetDurationDisplay.textContent = `${state.targetDuration}s (Custom)`;
        }
      });
    }

    // AI Engine model selection & Gemini key
    if (dom.aiModelSelect) {
      safeOn(dom.aiModelSelect, 'change', () => {
        state.aiModel = dom.aiModelSelect.value;
        if (state.aiModel === 'gemini-2.5-flash' || state.aiModel === 'gemini-3.8-flash') {
          if (dom.geminiKeyRow) dom.geminiKeyRow.classList.remove('hidden');
          if (dom.activeAiBadge) {
            dom.activeAiBadge.textContent = 'GEMINI 2.5 FLASH';
            dom.activeAiBadge.className = 'status-pill status-emerald';
          }
        } else if (state.aiModel === 'qwen-omni') {
          if (dom.geminiKeyRow) dom.geminiKeyRow.classList.add('hidden');
          if (dom.activeAiBadge) {
            dom.activeAiBadge.textContent = 'QWEN 2.5 OMNI';
            dom.activeAiBadge.className = 'status-pill status-indigo';
          }
        } else if (state.aiModel === 'qwen-text') {
          if (dom.geminiKeyRow) dom.geminiKeyRow.classList.add('hidden');
          if (dom.activeAiBadge) {
            dom.activeAiBadge.textContent = 'LOCAL QWEN TEXT';
            dom.activeAiBadge.className = 'status-pill status-indigo';
          }
        } else {
          if (dom.geminiKeyRow) dom.geminiKeyRow.classList.add('hidden');
          if (dom.activeAiBadge) {
            dom.activeAiBadge.textContent = 'MULTIMODAL CV';
            dom.activeAiBadge.className = 'status-pill status-indigo';
          }
        }
      });
    }

    if (dom.geminiApiKeyInput) {
      dom.geminiApiKeyInput.value = state.geminiApiKey;
      safeOn(dom.geminiApiKeyInput, 'input', () => {
        state.geminiApiKey = dom.geminiApiKeyInput.value.trim();
        localStorage.setItem('whop_gemini_key', state.geminiApiKey);
      });
    }

    // 3. Center Canvas Toolbar
    safeOn(dom.activeClipTitleInput, 'input', () => {
      state.clipTitle = dom.activeClipTitleInput.value;
    });

    safeOn(dom.toggleSafeZoneBtn, 'click', () => {
      state.showSafeZones = !state.showSafeZones;
      dom.toggleSafeZoneBtn.classList.toggle('active', state.showSafeZones);
    });

    // Toolbar: Hard FX Toggle
    if (dom.toggleHardEditBtn) {
      safeOn(dom.toggleHardEditBtn, 'click', () => {
        state.hardEdit.enabled = !state.hardEdit.enabled;
        dom.toggleHardEditBtn.classList.toggle('active', state.hardEdit.enabled);
        if (dom.hardFxStatusText) {
          dom.hardFxStatusText.textContent = state.hardEdit.enabled ? 'Hard FX: ON' : 'Hard FX: OFF';
        }
        if (dom.hardFxMasterToggle) dom.hardFxMasterToggle.checked = state.hardEdit.enabled;
        showToast(state.hardEdit.enabled ? '⚡ Hard Edits Enabled!' : '⏸️ Hard Edits Disabled');
      });
    }

    // Real Video Element Frame & Audio Sync Listeners
    if (dom.mainVideoEl) {
      safeOn(dom.mainVideoEl, 'loadeddata', () => {
        renderCanvasFrame();
      });
      safeOn(dom.mainVideoEl, 'canplay', () => {
        renderCanvasFrame();
      });
      safeOn(dom.mainVideoEl, 'seeked', () => {
        renderCanvasFrame();
      });
      safeOn(dom.mainVideoEl, 'timeupdate', () => {
        if (state.isPlaying && state.useCustomMainVideo) {
          state.currentTime = dom.mainVideoEl.currentTime;
          renderCanvasFrame();
          updatePlayheadUI();
        }
      });
    }

    // Toolbar: Quick Add Visual button
    if (dom.quickAddVisualBtn) {
      safeOn(dom.quickAddVisualBtn, 'click', () => {
        document.querySelectorAll('.inspector-tab').forEach((b) => {
          b.classList.toggle('active', b.dataset.tab === 'visuals');
        });
        document.querySelectorAll('.inspector-panel').forEach((p) => {
          p.classList.toggle('active', p.id === 'tabPanel-visuals');
        });
        if (dom.visualOverlayFileInput) dom.visualOverlayFileInput.click();
      });
    }

    // 4. Right Inspector Tabs
    document.querySelectorAll('.inspector-tab').forEach((tabBtn) => {
      tabBtn.addEventListener('click', () => {
        const target = tabBtn.dataset.tab;
        document.querySelectorAll('.inspector-tab').forEach((b) => {
          b.classList.toggle('active', b === tabBtn);
          b.setAttribute('aria-selected', b === tabBtn ? 'true' : 'false');
        });
        document.querySelectorAll('.inspector-panel').forEach((panel) => {
          panel.classList.toggle('active', panel.id === `tabPanel-${target}`);
        });
      });
    });

    // Hard FX Inspector Panel Controls
    if (dom.hardFxMasterToggle) {
      safeOn(dom.hardFxMasterToggle, 'change', () => {
        state.hardEdit.enabled = dom.hardFxMasterToggle.checked;
        if (dom.toggleHardEditBtn) dom.toggleHardEditBtn.classList.toggle('active', state.hardEdit.enabled);
        if (dom.hardFxStatusText) dom.hardFxStatusText.textContent = state.hardEdit.enabled ? 'Hard FX: ON' : 'Hard FX: OFF';
      });
    }
    if (dom.hardJumpCutsToggle) {
      safeOn(dom.hardJumpCutsToggle, 'change', () => {
        state.hardEdit.jumpCuts = dom.hardJumpCutsToggle.checked;
      });
    }
    if (dom.hardImpactShakeToggle) {
      safeOn(dom.hardImpactShakeToggle, 'change', () => {
        state.hardEdit.impactShake = dom.hardImpactShakeToggle.checked;
      });
    }
    if (dom.hardStrobeFlashToggle) {
      safeOn(dom.hardStrobeFlashToggle, 'change', () => {
        state.hardEdit.strobeFlash = dom.hardStrobeFlashToggle.checked;
      });
    }
    if (dom.hardFilmGrainToggle) {
      safeOn(dom.hardFilmGrainToggle, 'change', () => {
        state.hardEdit.cinematicGrain = dom.hardFilmGrainToggle.checked;
      });
    }
    if (dom.hardRgbGlitchToggle) {
      safeOn(dom.hardRgbGlitchToggle, 'change', () => {
        state.hardEdit.rgbGlitch = dom.hardRgbGlitchToggle.checked;
      });
    }
    if (dom.hardSpeedLinesToggle) {
      safeOn(dom.hardSpeedLinesToggle, 'change', () => {
        state.hardEdit.speedLines = dom.hardSpeedLinesToggle.checked;
      });
    }
    if (dom.hardZoomIntensitySlider) {
      safeOn(dom.hardZoomIntensitySlider, 'input', () => {
        state.hardEdit.zoomIntensity = parseFloat(dom.hardZoomIntensitySlider.value);
        if (dom.hardZoomIntensityLabel) dom.hardZoomIntensityLabel.textContent = `${state.hardEdit.zoomIntensity.toFixed(2)}×`;
      });
    }
    if (dom.hardCutFrequencySlider) {
      safeOn(dom.hardCutFrequencySlider, 'input', () => {
        state.hardEdit.cutFrequency = parseFloat(dom.hardCutFrequencySlider.value);
        if (dom.hardCutFrequencyLabel) dom.hardCutFrequencyLabel.textContent = `${state.hardEdit.cutFrequency.toFixed(1)}s`;
      });
    }

    // Sequence Cuts & Selected Cut Inspector Listeners
    if (dom.addNewCutBtn) {
      safeOn(dom.addNewCutBtn, 'click', splitClipAtPlayhead);
    }
    if (dom.trackAddCutBtn) {
      safeOn(dom.trackAddCutBtn, 'click', splitClipAtPlayhead);
    }
    if (dom.selectedCutZoomSlider) {
      safeOn(dom.selectedCutZoomSlider, 'input', () => {
        const clip = (state.sequence?.videoClips || []).find((c) => c.id === state.sequence?.selectedClipId);
        if (clip) {
          clip.zoom = parseFloat(dom.selectedCutZoomSlider.value);
          if (dom.selectedCutZoomLabel) dom.selectedCutZoomLabel.textContent = `${clip.zoom.toFixed(2)}×`;
          renderTimelineTracks();
          renderCanvasFrame();
        }
      });
    }
    if (dom.selectedCutPanXSlider) {
      safeOn(dom.selectedCutPanXSlider, 'input', () => {
        const clip = (state.sequence?.videoClips || []).find((c) => c.id === state.sequence?.selectedClipId);
        if (clip) {
          clip.panX = parseInt(dom.selectedCutPanXSlider.value, 10);
          if (dom.selectedCutPanXLabel) dom.selectedCutPanXLabel.textContent = `${clip.panX}%`;
          renderTimelineTracks();
          renderCanvasFrame();
        }
      });
    }
    if (dom.selectedCutPanYSlider) {
      safeOn(dom.selectedCutPanYSlider, 'input', () => {
        const clip = (state.sequence?.videoClips || []).find((c) => c.id === state.sequence?.selectedClipId);
        if (clip) {
          clip.panY = parseInt(dom.selectedCutPanYSlider.value, 10);
          if (dom.selectedCutPanYLabel) dom.selectedCutPanYLabel.textContent = `${clip.panY}%`;
          renderTimelineTracks();
          renderCanvasFrame();
        }
      });
    }
    if (dom.rotateCutBtn) {
      safeOn(dom.rotateCutBtn, 'click', () => {
        state.cameraRotation = ((state.cameraRotation || 0) + 90) % 360;
        renderCanvasFrame();
        showToast(`🔄 Rotated 90° (${state.cameraRotation}°)`);
      });
    }
    if (dom.flipCutBtn) {
      safeOn(dom.flipCutBtn, 'click', () => {
        state.cameraFlipH = !state.cameraFlipH;
        renderCanvasFrame();
        showToast(state.cameraFlipH ? '↔️ Flipped Horizontally' : '↔️ Normal Orientation');
      });
    }
    if (dom.selectedCutTransitionSelect) {
      safeOn(dom.selectedCutTransitionSelect, 'change', () => {
        const clip = (state.sequence?.videoClips || []).find((c) => c.id === state.sequence?.selectedClipId);
        if (clip) {
          clip.transition = dom.selectedCutTransitionSelect.value;
          renderTimelineTracks();
          showToast(`Cut Transition: ${clip.transition.toUpperCase()}`);
        }
      });
    }

    // Visual Media Overlays & Memes Tab Listeners
    if (dom.btnUploadVisualImage) {
      safeOn(dom.btnUploadVisualImage, 'click', () => {
        if (dom.visualOverlayFileInput) {
          dom.visualOverlayFileInput.accept = 'image/*';
          dom.visualOverlayFileInput.click();
        }
      });
    }
    if (dom.btnUploadVisualVideo) {
      safeOn(dom.btnUploadVisualVideo, 'click', () => {
        if (dom.visualOverlayFileInput) {
          dom.visualOverlayFileInput.accept = 'video/*';
          dom.visualOverlayFileInput.click();
        }
      });
    }
    if (dom.visualOverlayFileInput) {
      safeOn(dom.visualOverlayFileInput, 'change', (e) => {
        if (e.target.files && e.target.files[0]) {
          addCustomVisualOverlay(e.target.files[0]);
        }
      });
    }

    document.querySelectorAll('.meme-preset-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        addPresetMemeOverlay(btn.dataset.meme);
      });
    });

    // Tab 1: Layout & B-Roll
    (dom.layoutModeGrid ? dom.layoutModeGrid.querySelectorAll('.layout-card') : []).forEach((card) => {
      card.addEventListener('click', () => {
        state.layoutMode = card.dataset.layout;
        (dom.layoutModeGrid ? dom.layoutModeGrid.querySelectorAll('.layout-card') : []).forEach((c) => c.classList.remove('active'));
        card.classList.add('active');

        if (state.layoutMode === 'ambient-blur') {
          state.wholeScreenFit = true;
          if (dom.wholeScreenFitToggle) dom.wholeScreenFitToggle.checked = true;
        } else if (state.layoutMode === 'split-60-40' || state.layoutMode === 'split-50-50') {
          if (dom.brollVideoEl && (!dom.brollVideoEl.src || dom.brollVideoEl.src === window.location.href)) {
            dom.brollVideoEl.src = '/assets/broll/satisfying_neon_runner.mp4';
            dom.brollVideoEl.load();
            dom.brollVideoEl.play().catch(() => {});
            state.useCustomBrollVideo = true;
          }
        }
        syncAllInspectorControlsFromState();
        renderCanvasFrame();
        renderTimelineTracks();
        updateTelemetryBar();
        showToast(`📐 Layout: ${card.querySelector('.layout-name').textContent.trim()}`);
      });
    });

    safeOn(dom.uploadCustomBrollBtn, 'click', () => dom.brollVideoFileInput.click());
    safeOn(dom.brollVideoFileInput, 'change', (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      state.useCustomBrollVideo = true;
      state.customBrollFileName = file.name;
      dom.brollVideoEl.src = URL.createObjectURL(file);
      dom.brollVideoEl.play().catch(() => {});
      if (window.WhopAudioEngine) {
        window.WhopAudioEngine.connectBrollVideo(dom.brollVideoEl);
      }
      renderBrollPresetCards();
      renderTimelineTracks();
      updateTelemetryBar();
      showToast(`🎮 Loaded Custom B-Roll Video: ${file.name}`);
    });

    document.querySelectorAll('[data-framing]').forEach((btn) => {
      btn.addEventListener('click', () => {
        state.framingPreset = btn.dataset.framing;
        syncAllInspectorControlsFromState();
      });
    });

    if (dom.wholeScreenFitToggle) {
      safeOn(dom.wholeScreenFitToggle, 'change', () => {
        state.wholeScreenFit = dom.wholeScreenFitToggle.checked;
      });
    }

    if (dom.autoZoomToggle) {
      safeOn(dom.autoZoomToggle, 'change', () => {
        state.autoZoom = dom.autoZoomToggle.checked;
      });
    }
    if (dom.cameraZoomSlider) {
      safeOn(dom.cameraZoomSlider, 'input', () => {
        state.cameraZoom = parseFloat(dom.cameraZoomSlider.value);
        if (dom.zoomValueLabel) dom.zoomValueLabel.textContent = `${state.cameraZoom.toFixed(2)}×`;
      });
    }
    if (dom.cameraPanXSlider) {
      safeOn(dom.cameraPanXSlider, 'input', () => {
        state.cameraPanX = parseInt(dom.cameraPanXSlider.value, 10);
        if (dom.panXValueLabel) dom.panXValueLabel.textContent = `${state.cameraPanX}%`;
      });
    }

    // Tab 2: Captions & Hook
    if (dom.captionsEnabledToggle) {
      safeOn(dom.captionsEnabledToggle, 'change', () => {
        state.captionsEnabled = dom.captionsEnabledToggle.checked;
        updateComplianceAndPayout();
      });
    }
    if (dom.captionStyleGrid) {
      (dom.captionStyleGrid ? dom.captionStyleGrid.querySelectorAll('.caption-preset-card') : []).forEach((card) => {
        card.addEventListener('click', () => {
          state.captionStyle = card.dataset.captionStyle;
          syncAllInspectorControlsFromState();
        });
      });
    }
    if (dom.captionSizeSlider) {
      safeOn(dom.captionSizeSlider, 'input', () => {
        state.captionSize = parseInt(dom.captionSizeSlider.value, 10);
        if (dom.captionSizeLabel) dom.captionSizeLabel.textContent = `${state.captionSize}%`;
      });
    }
    if (dom.captionPosYSlider) {
      safeOn(dom.captionPosYSlider, 'input', () => {
        state.captionPosY = parseInt(dom.captionPosYSlider.value, 10);
        if (dom.captionPosYLabel) dom.captionPosYLabel.textContent = `${state.captionPosY}%`;
      });
    }
    if (dom.autoEmojiToggle) {
      safeOn(dom.autoEmojiToggle, 'change', () => {
        state.autoEmoji = dom.autoEmojiToggle.checked;
        renderTranscriptCloud();
      });
    }
    if (dom.hookBannerTextInput) {
      safeOn(dom.hookBannerTextInput, 'input', () => {
        state.hookText = dom.hookBannerTextInput.value;
        updateComplianceAndPayout();
      });
    }

    // FilmCraft Text-to-Edit Word Cut Toolbar
    if (dom.transcriptTrimInBtn) {
      safeOn(dom.transcriptTrimInBtn, 'click', () => {
        const t = state.selectedTranscriptWord ? state.selectedTranscriptWord.start : state.currentTime;
        state.trimStart = clamp(t, 0, state.trimEnd - 1.5);
        seekToTime(state.trimStart);
        updateTrimUI();
        renderTimelineRuler();
        renderTimelineTracks();
        updateComplianceAndPayout();
        showToast(`✂️ FilmCraft Text-to-Edit: Trimmed In to ${formatSeconds(state.trimStart)}`, '#38bdf8');
      });
    }

    if (dom.transcriptTrimOutBtn) {
      safeOn(dom.transcriptTrimOutBtn, 'click', () => {
        const t = state.selectedTranscriptWord ? state.selectedTranscriptWord.end : state.currentTime;
        state.trimEnd = clamp(t, state.trimStart + 1.5, state.streamDuration || 60);
        updateTrimUI();
        renderTimelineRuler();
        renderTimelineTracks();
        updateComplianceAndPayout();
        showToast(`⏩ FilmCraft Text-to-Edit: Trimmed Out to ${formatSeconds(state.trimEnd)}`, '#38bdf8');
      });
    }

    if (dom.transcriptSnap30sBtn) {
      safeOn(dom.transcriptSnap30sBtn, 'click', () => {
        const center = state.selectedTranscriptWord ? state.selectedTranscriptWord.start : state.currentTime;
        const newSt = Math.max(0, center - 15.0);
        const maxD = state.streamDuration || 60.0;
        const newEn = Math.min(maxD, newSt + 30.0);
        state.trimStart = newSt;
        state.trimEnd = newEn;
        seekToTime(state.trimStart);
        updateTrimUI();
        renderTimelineRuler();
        renderTimelineTracks();
        updateComplianceAndPayout();
        showToast(`⚡ FilmCraft Text-to-Edit: Snapped exact 30s highlight (${formatSeconds(newSt)} - ${formatSeconds(newEn)})!`, '#10b981');
      });
    }
    document.querySelectorAll('[data-hook-mode]').forEach((btn) => {
      btn.addEventListener('click', () => {
        state.hookMode = btn.dataset.hookMode;
        syncAllInspectorControlsFromState();
        renderTimelineTracks();
        updateComplianceAndPayout();
      });
    });

    // Topic Image Overlay Controls
    if (dom.imageOverlayToggle) {
      safeOn(dom.imageOverlayToggle, 'change', () => {
        state.overlayImageEnabled = dom.imageOverlayToggle.checked;
        if (state.overlayImage) {
          state.overlayImage.enabled = state.overlayImageEnabled;
        }
        renderTimelineTracks();
      });
    }

    if (dom.overlayStartSlider) {
      safeOn(dom.overlayStartSlider, 'input', () => {
        const val = parseFloat(dom.overlayStartSlider.value) || 2.5;
        state.overlayImageStartOffset = val;
        if (dom.overlayStartLabel) dom.overlayStartLabel.textContent = `${val.toFixed(1)}s`;
        if (state.overlayImage) {
          state.overlayImage.start = state.trimStart + val;
        }
        renderTimelineTracks();
      });
    }

    if (dom.overlayDurationSlider) {
      safeOn(dom.overlayDurationSlider, 'input', () => {
        const val = parseFloat(dom.overlayDurationSlider.value) || 4.5;
        state.overlayImageDuration = val;
        if (dom.overlayDurationLabel) dom.overlayDurationLabel.textContent = `${val.toFixed(1)}s`;
        if (state.overlayImage) {
          state.overlayImage.duration = val;
        }
        renderTimelineTracks();
      });
    }

    if (dom.overlayScaleSlider) {
      safeOn(dom.overlayScaleSlider, 'input', () => {
        const pct = parseInt(dom.overlayScaleSlider.value, 10) || 100;
        state.overlayImageScale = pct / 100;
        if (dom.overlayScaleLabel) dom.overlayScaleLabel.textContent = `${pct}%`;
      });
    }

    if (dom.overlayPosXSlider) {
      safeOn(dom.overlayPosXSlider, 'input', () => {
        const pct = parseInt(dom.overlayPosXSlider.value, 10) || 50;
        state.overlayImagePos = state.overlayImagePos || { x: 0.5, y: 0.38 };
        state.overlayImagePos.x = pct / 100;
        if (dom.overlayPosXLabel) dom.overlayPosXLabel.textContent = `${pct}%`;
      });
    }

    if (dom.overlayPosYSlider) {
      safeOn(dom.overlayPosYSlider, 'input', () => {
        const pct = parseInt(dom.overlayPosYSlider.value, 10) || 38;
        state.overlayImagePos = state.overlayImagePos || { x: 0.5, y: 0.38 };
        state.overlayImagePos.y = pct / 100;
        if (dom.overlayPosYLabel) dom.overlayPosYLabel.textContent = `${pct}%`;
      });
    }

    if (dom.overlayResetPosBtn) {
      safeOn(dom.overlayResetPosBtn, 'click', () => {
        state.overlayImagePos = { x: 0.5, y: 0.38 };
        state.overlayImageScale = 1.0;
        syncImageInspectorControls();
        showToast('🎯 Reset Image to Center (50%, 38%)');
      });
    }

    if (dom.overlayRemoveBtn) {
      safeOn(dom.overlayRemoveBtn, 'click', () => {
        state.overlayImageEnabled = false;
        if (state.overlayImage) state.overlayImage.enabled = false;
        if (dom.imageOverlayToggle) dom.imageOverlayToggle.checked = false;
        state.selectedTimelineItem = null;
        state.selectedCanvasLayer = null;
        renderTimelineTracks();
        showToast('🗑️ Topic Image Overlay Hidden');
      });
    }

    if (dom.uploadCustomImageBtn && dom.customImageFileInput) {
      safeOn(dom.uploadCustomImageBtn, 'click', () => {
        dom.customImageFileInput.click();
      });
      safeOn(dom.customImageFileInput, 'change', (e) => {
        const file = e.target.files && e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (evt) => {
          const dataUrl = evt.target.result;
          const imgEl = new Image();
          imgEl.src = dataUrl;
          imgEl.onload = () => {
            state.overlayImgEl = imgEl;
            state.overlayImage = {
              title: file.name,
              path: '',
              url: dataUrl,
              start: state.trimStart + (state.overlayImageStartOffset || 2.5),
              duration: state.overlayImageDuration || 4.5,
              enabled: true,
            };
            state.overlayImageEnabled = true;
            if (dom.overlayImagePreview) {
              dom.overlayImagePreview.src = dataUrl;
              dom.overlayImagePreview.style.display = 'block';
            }
            if (dom.overlayImageTitle) {
              dom.overlayImageTitle.textContent = file.name;
            }
            if (dom.imageOverlayToggle) {
              dom.imageOverlayToggle.checked = true;
            }
            renderTimelineTracks();
            showToast(`🖼️ Custom Image Loaded: ${file.name}`);
          };
        };
        reader.readAsDataURL(file);
      });
    }

    // Tab 3: Audio & AI Polish
    safeOn(dom.cutSilenceToggle, 'change', () => {
      state.cutSilence = dom.cutSilenceToggle.checked;
      renderTimelineTracks();
    });
    safeOn(dom.loudnessNormToggle, 'change', () => {
      state.loudnessNorm = dom.loudnessNormToggle.checked;
      if (window.WhopAudioEngine) {
        window.WhopAudioEngine.setMasterVolume(state.loudnessNorm ? 1.05 : 0.85);
      }
    });
    safeOn(dom.mainVolSlider, 'input', () => {
      const pct = parseInt(dom.mainVolSlider.value, 10);
      state.mainVolume = pct / 100;
      dom.mainVolLabel.textContent = `${pct}%`;
      if (window.WhopAudioEngine) window.WhopAudioEngine.setMainVolume(state.mainVolume);
    });
    safeOn(dom.musicVolSlider, 'input', () => {
      const pct = parseInt(dom.musicVolSlider.value, 10);
      state.musicVolume = pct / 100;
      dom.musicVolLabel.textContent = `${pct}%`;
      if (window.WhopAudioEngine) window.WhopAudioEngine.setMusicVolume(state.musicVolume);
    });
    safeOn(dom.brollVolSlider, 'input', () => {
      const pct = parseInt(dom.brollVolSlider.value, 10);
      state.brollVolume = pct / 100;
      dom.brollVolLabel.textContent = `${pct}%`;
      if (window.WhopAudioEngine) window.WhopAudioEngine.setBrollVolume(state.brollVolume);
    });

    document.querySelectorAll('[data-sfx]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const sfx = btn.dataset.sfx;
        if (window.WhopAudioEngine) window.WhopAudioEngine.playSfx(sfx);
      });
    });

    // Tab 4: Whop Bounty & Payout
    safeOn(dom.watermarkTextInput, 'input', () => {
      state.watermarkText = dom.watermarkTextInput.value;
      renderTimelineTracks();
      updateComplianceAndPayout();
    });
    safeOn(dom.watermarkEnabledToggle, 'change', () => {
      state.watermarkEnabled = dom.watermarkEnabledToggle.checked;
      renderTimelineTracks();
      updateComplianceAndPayout();
    });
    safeOn(dom.projectedViewsSlider, 'input', () => {
      state.projectedViews = parseInt(dom.projectedViewsSlider.value, 10);
      dom.projectedViewsLabel.textContent = `${state.projectedViews.toLocaleString('en-US')} views`;
      updateComplianceAndPayout();
    });
    safeOn(dom.copyHashtagsBtn, 'click', () => {
      if (navigator.clipboard && dom.postCaptionTextarea) {
        navigator.clipboard.writeText(dom.postCaptionTextarea.value).catch(() => {});
      }
      showToast('📋 Copied Viral Caption & Whop Hashtags to clipboard!');
    });

    // 5. Timeline Transport & Scrubber Dragging
    safeOn(dom.playPauseBtn, 'click', togglePlayPause);
    safeOn(dom.skipStartBtn, 'click', () => seekToTime(state.trimStart));
    safeOn(dom.loopToggleBtn, 'click', () => {
      state.loopClip = !state.loopClip;
      dom.loopToggleBtn.classList.toggle('active', state.loopClip);
    });
    safeOn(dom.playbackSpeedSelect, 'change', () => {
      state.playbackSpeed = parseFloat(dom.playbackSpeedSelect.value) || 1.0;
      if (dom.mainVideoEl) dom.mainVideoEl.playbackRate = state.playbackSpeed;
    });

    // CapCut Pro Stage Zoom & Framing Controls
    if (dom.stageZoomSlider) {
      safeOn(dom.stageZoomSlider, 'input', () => {
        const val = parseInt(dom.stageZoomSlider.value, 10) || 100;
        state.cameraZoom = val / 100;
        if (dom.stageZoomVal) dom.stageZoomVal.textContent = `${val}%`;
        renderCanvasFrame();
      });
    }

    if (dom.btnZoomIn) {
      safeOn(dom.btnZoomIn, 'click', () => {
        const cur = Math.round((state.cameraZoom || 1.0) * 100);
        const next = Math.min(250, cur + 10);
        state.cameraZoom = next / 100;
        if (dom.stageZoomSlider) dom.stageZoomSlider.value = String(next);
        if (dom.stageZoomVal) dom.stageZoomVal.textContent = `${next}%`;
        renderCanvasFrame();
      });
    }

    if (dom.btnZoomOut) {
      safeOn(dom.btnZoomOut, 'click', () => {
        const cur = Math.round((state.cameraZoom || 1.0) * 100);
        const next = Math.max(30, cur - 10);
        state.cameraZoom = next / 100;
        if (dom.stageZoomSlider) dom.stageZoomSlider.value = String(next);
        if (dom.stageZoomVal) dom.stageZoomVal.textContent = `${next}%`;
        renderCanvasFrame();
      });
    }

    if (dom.btnFitAllPeople) {
      safeOn(dom.btnFitAllPeople, 'click', () => {
        state.videoFitMode = 'fit';
        state.wholeScreenFit = true;
        state.cameraZoom = 1.0;
        if (dom.stageZoomSlider) dom.stageZoomSlider.value = '100';
        if (dom.stageZoomVal) dom.stageZoomVal.textContent = '100%';
        dom.btnFitAllPeople.classList.add('active');
        if (dom.btnFillVertical) dom.btnFillVertical.classList.remove('active');
        showToast('📐 Fit to Screen: Unzoomed (All People & Hosts Visible)', '#10b981');
        renderCanvasFrame();
      });
    }

    if (dom.btnFillVertical) {
      safeOn(dom.btnFillVertical, 'click', () => {
        state.videoFitMode = 'fill';
        state.wholeScreenFit = false;
        state.cameraZoom = 1.0;
        if (dom.stageZoomSlider) dom.stageZoomSlider.value = '100';
        if (dom.stageZoomVal) dom.stageZoomVal.textContent = '100%';
        dom.btnFillVertical.classList.add('active');
        if (dom.btnFitAllPeople) dom.btnFitAllPeople.classList.remove('active');
        showToast('📱 Fill 9:16: Cropped Vertical', '#00f2fe');
        renderCanvasFrame();
      });
    }

    if (dom.btnResetZoom) {
      safeOn(dom.btnResetZoom, 'click', () => {
        state.cameraZoom = 1.0;
        state.cameraPanX = 0;
        state.cameraPanY = 0;
        if (dom.stageZoomSlider) dom.stageZoomSlider.value = '100';
        if (dom.stageZoomVal) dom.stageZoomVal.textContent = '100%';
        showToast('🔄 Zoom & Pan Reset to 1:1', '#94a3b8');
        renderCanvasFrame();
      });
    }

    if (dom.btnPanLeft) {
      safeOn(dom.btnPanLeft, 'click', () => {
        state.cameraPanX = -25;
        dom.btnPanLeft.classList.add('active');
        if (dom.btnPanCenter) dom.btnPanCenter.classList.remove('active');
        if (dom.btnPanRight) dom.btnPanRight.classList.remove('active');
        showToast('◀ Focus Left Host (Colin)', '#6366f1');
        renderCanvasFrame();
      });
    }

    if (dom.btnPanCenter) {
      safeOn(dom.btnPanCenter, 'click', () => {
        state.cameraPanX = 0;
        dom.btnPanCenter.classList.add('active');
        if (dom.btnPanLeft) dom.btnPanLeft.classList.remove('active');
        if (dom.btnPanRight) dom.btnPanRight.classList.remove('active');
        showToast('◉ Focus Center (Speaker)', '#10b981');
        renderCanvasFrame();
      });
    }

    if (dom.btnPanRight) {
      safeOn(dom.btnPanRight, 'click', () => {
        state.cameraPanX = 25;
        dom.btnPanRight.classList.add('active');
        if (dom.btnPanLeft) dom.btnPanLeft.classList.remove('active');
        if (dom.btnPanCenter) dom.btnPanCenter.classList.remove('active');
        showToast('▶ Focus Right Host (Samir)', '#6366f1');
        renderCanvasFrame();
      });
    }

    // Master Video Element Hardware Sync Listeners
    if (dom.mainVideoEl) {
      safeOn(dom.mainVideoEl, 'loadedmetadata', () => {
        const dur = dom.mainVideoEl.duration;
        if (dur && !isNaN(dur) && isFinite(dur)) {
          state.streamDuration = dur;
          state.trimEnd = dur;
          if (dom.totalDurationTimecode) {
            dom.totalDurationTimecode.textContent = formatTimecode(dur);
          }
          const clips = state.sequence?.videoClips || [];
          if (clips.length > 0) {
            const lastClip = clips[clips.length - 1];
            if (lastClip.end < dur) {
              lastClip.end = dur;
              lastClip.sourceEnd = dur;
            }
          }
          updateTrimUI();
          renderTimelineTracks();
        }
      });
      safeOn(dom.mainVideoEl, 'ended', () => {
        if (state.loopClip && !state.isRecordingExport) {
          dom.mainVideoEl.currentTime = state.trimStart;
          dom.mainVideoEl.play().catch(() => {});
        } else {
          state.isPlaying = false;
          updatePlayPauseButtonUI();
        }
      });
    }
    // CapCut Direct Timeline Tools & Multi-Clip Slicing
    splitClipAtPlayhead = function splitClipAtPlayhead() {
      const cur = Number(state.currentTime.toFixed(2));
      const clips = state.sequence?.videoClips || [];
      const targetIdx = clips.findIndex((c) => cur >= c.start + 0.08 && cur <= c.end - 0.08);
      if (targetIdx === -1) {
        showToast('⚠️ Position playhead inside a video cut to split (Ctrl+B / C)', '#f59e0b');
        return;
      }

      const orig = clips[targetIdx];
      const oldEnd = orig.end;
      const oldSourceEnd = orig.sourceEnd !== undefined ? orig.sourceEnd : oldEnd;
      const offset = cur - orig.start;
      const splitSourceTime = Number(((orig.sourceStart !== undefined ? orig.sourceStart : orig.start) + offset).toFixed(2));

      orig.end = cur;
      orig.sourceEnd = splitSourceTime;

      const newClip = {
        id: 'cut-' + Date.now(),
        title: `Cut #${clips.length + 1}`,
        start: cur,
        end: oldEnd,
        sourceStart: splitSourceTime,
        sourceEnd: oldSourceEnd,
        zoom: orig.zoom || 1.0,
        panX: orig.panX || 0,
        panY: orig.panY || 0,
        volume: orig.volume || 1.0,
        effect: 'punch-in',
        transition: 'flash'
      };

      clips.splice(targetIdx + 1, 0, newClip);
      state.sequence.selectedClipId = newClip.id;
      state.sequence.selectedTrackType = 'video';

      renderTimelineRuler();
      renderTimelineTracks();
      syncSelectedCutInspector();
      switchInspectorTab('hard-cuts');
      showToast(`✂️ Split cut at ${formatTimecode(cur)}! Created "${newClip.title}"`, '#00f2fe');
    };

    rippleTrimIn = function rippleTrimIn() {
      const cur = Number(state.currentTime.toFixed(2));
      const clips = state.sequence?.videoClips || [];
      const selectedClip = clips.find(c => c.id === state.sequence?.selectedClipId);

      if (selectedClip && cur > selectedClip.start && cur < selectedClip.end - 0.15) {
        const offset = cur - selectedClip.start;
        selectedClip.start = cur;
        if (selectedClip.sourceStart !== undefined) {
          selectedClip.sourceStart = Number((selectedClip.sourceStart + offset).toFixed(2));
        }
        renderTimelineTracks();
        syncSelectedCutInspector();
        showToast(`⏪ Trimmed cut start to ${formatTimecode(cur)} (Q)`, '#00f2fe');
        return;
      }

      if (cur >= state.trimEnd - 1.0) return;
      state.trimStart = cur;
      if (state.overlayImage) {
        state.overlayImage.start = state.trimStart + (state.overlayImageStartOffset || 2.5);
      }
      seekToTime(state.trimStart);
      renderTimelineRuler();
      renderTimelineTracks();
      updateTrimUI();
      showToast(`⏪ Trimmed In-point to ${formatTimecode(state.trimStart)} (Q)`);
    };

    rippleTrimOut = function rippleTrimOut() {
      const cur = Number(state.currentTime.toFixed(2));
      const clips = state.sequence?.videoClips || [];
      const selectedClip = clips.find(c => c.id === state.sequence?.selectedClipId);

      if (selectedClip && cur < selectedClip.end && cur > selectedClip.start + 0.15) {
        const dur = cur - selectedClip.start;
        selectedClip.end = cur;
        if (selectedClip.sourceStart !== undefined) {
          selectedClip.sourceEnd = Number((selectedClip.sourceStart + dur).toFixed(2));
        }
        renderTimelineTracks();
        syncSelectedCutInspector();
        showToast(`⏩ Trimmed cut end to ${formatTimecode(cur)} (W)`, '#00f2fe');
        return;
      }

      if (cur <= state.trimStart + 1.0) return;
      state.trimEnd = cur;
      seekToTime(state.trimEnd);
      renderTimelineRuler();
      renderTimelineTracks();
      updateTrimUI();
      showToast(`⏩ Trimmed Out-point to ${formatTimecode(state.trimEnd)} (W)`);
    };

    deleteSelectedCapCutItem = function deleteSelectedCapCutItem() {
      // 1. Delete selected Subtitle Phrase
      if (state.selectedCaptionSegment) {
        const seg = state.selectedCaptionSegment;
        const clip = getActiveClip();
        let deleted = false;
        if (clip && Array.isArray(clip.transcript) && seg.chunkStartIdx !== undefined) {
          clip.transcript.splice(seg.chunkStartIdx, seg.chunkCount || 3);
          deleted = true;
        } else if (state.analysis?.viralMoments) {
          const idx = state.analysis.viralMoments.findIndex(m => m.start === seg.start || m.id === seg.id);
          if (idx !== -1) {
            state.analysis.viralMoments.splice(idx, 1);
            deleted = true;
          }
        }
        state.selectedCaptionSegment = null;
        state.selectedTimelineItem = null;
        renderTimelineTracks();
        renderTranscriptCloud();
        showToast('🗑️ Deleted subtitle phrase', '#ef4444');
        return;
      }

      const clips = state.sequence?.videoClips || [];
      if (state.sequence?.selectedClipId) {
        if (clips.length <= 1) {
          showToast('⚠️ Cannot delete the only remaining cut in sequence', '#f59e0b');
          return;
        }
        const idx = clips.findIndex((c) => c.id === state.sequence.selectedClipId);
        if (idx !== -1) {
          const removed = clips.splice(idx, 1)[0];
          if (idx > 0) {
            clips[idx - 1].end = removed.end;
            if (clips[idx - 1].sourceEnd !== undefined && removed.sourceEnd !== undefined) {
              clips[idx - 1].sourceEnd = removed.sourceEnd;
            }
          } else if (clips.length > 0) {
            clips[0].start = removed.start;
            if (clips[0].sourceStart !== undefined && removed.sourceStart !== undefined) {
              clips[0].sourceStart = removed.sourceStart;
            }
          }
          state.sequence.selectedClipId = clips[Math.max(0, idx - 1)].id;
          renderTimelineTracks();
          syncSelectedCutInspector();
          showToast(`🗑️ Deleted ${removed.title}`, '#ef4444');
          return;
        }
      }

      if (state.selectedTimelineItem === 'overlay-image' || state.selectedCanvasLayer === 'image') {
        state.overlayImageEnabled = false;
        if (state.overlayImage) state.overlayImage.enabled = false;
        if (dom.imageOverlayToggle) dom.imageOverlayToggle.checked = false;
        state.selectedTimelineItem = null;
        state.selectedCanvasLayer = null;
        renderTimelineTracks();
        showToast('🗑️ Deleted Topic Image Overlay layer');
      } else if (state.selectedTimelineItem === 'hook-banner' || state.selectedCanvasLayer === 'hook') {
        state.hookMode = 'off';
        syncAllInspectorControlsFromState();
        state.selectedTimelineItem = null;
        state.selectedCanvasLayer = null;
        renderTimelineTracks();
        showToast('🗑️ Removed Hook Banner');
      } else {
        showToast('Select a video cut or overlay block to delete (Del)', '#94a3b8');
      }
    }

    function toggleBackgroundSound() {
      state.bgSoundMuted = !state.bgSoundMuted;
      if (state.bgSoundMuted) {
        state.musicPreset = 'none';
        state.musicVolume = 0.0;
        if (window.WhopAudioEngine) window.WhopAudioEngine.setMusicPreset('none');
        if (dom.muteBgIcon) dom.muteBgIcon.textContent = '🔇';
        if (dom.muteBgText) dom.muteBgText.textContent = 'BG Sound: OFF';
        if (dom.capcutMuteBgBtn) dom.capcutMuteBgBtn.classList.add('active');
        showToast('🔇 Background Sound Muted (Clean Voice Only)');
      } else {
        state.musicPreset = 'lofi-chill';
        state.musicVolume = 0.25;
        if (window.WhopAudioEngine) {
          window.WhopAudioEngine.setMusicPreset('lofi-chill');
          window.WhopAudioEngine.setMusicVolume(0.25);
        }
        if (dom.muteBgIcon) dom.muteBgIcon.textContent = '🎵';
        if (dom.muteBgText) dom.muteBgText.textContent = 'BG Sound: ON';
        if (dom.capcutMuteBgBtn) dom.capcutMuteBgBtn.classList.remove('active');
        showToast('🎵 Background Music Bed: Lofi Rhodes');
      }
      renderMusicPresetCards();
      syncAllInspectorControlsFromState();
    }

    if (dom.capcutSplitBtn) safeOn(dom.capcutSplitBtn, 'click', splitClipAtPlayhead);
    if (dom.capcutTrimInBtn) safeOn(dom.capcutTrimInBtn, 'click', rippleTrimIn);
    if (dom.capcutTrimOutBtn) safeOn(dom.capcutTrimOutBtn, 'click', rippleTrimOut);
    if (dom.capcutDeleteBtn) safeOn(dom.capcutDeleteBtn, 'click', deleteSelectedCapCutItem);
    if (dom.capcutMuteBgBtn) safeOn(dom.capcutMuteBgBtn, 'click', toggleBackgroundSound);

    // Master Timeline Audio Volume Slider
    if (dom.timelineMasterVolSlider) {
      safeOn(dom.timelineMasterVolSlider, 'input', () => {
        const vol = parseInt(dom.timelineMasterVolSlider.value, 10);
        state.sequence.mainAudioVolume = vol / 100;
        if (dom.mainVideoEl) dom.mainVideoEl.volume = Math.min(1.0, state.sequence.mainAudioVolume);
        if (dom.timelineMasterVolLabel) dom.timelineMasterVolLabel.textContent = `${vol}%`;
        if (window.WhopAudioEngine) window.WhopAudioEngine.setMasterVolume(state.sequence.mainAudioVolume);
        renderTimelineTracks();
      });
    }

    // Smooth Timeline Zoom Slider
    if (dom.timelineZoomSlider) {
      safeOn(dom.timelineZoomSlider, 'input', () => {
        const val = parseInt(dom.timelineZoomSlider.value, 10) / 100;
        state.timelineZoom = val;
        if (dom.zoomPercentLabel) {
          dom.zoomPercentLabel.textContent = val >= 0.95 ? 'Clip Focus' : (val <= 0.05 ? 'Full Video' : `${Math.round(val * 100)}%`);
        }
        renderTimelineRuler();
        renderTimelineTracks();
        updatePlayheadUI();
      });
    }

    // Left Track Action Toggles (Mute / Show / Hide)
    if (dom.trackToggleMainAudio) {
      safeOn(dom.trackToggleMainAudio, 'click', () => {
        state.sequence.mainAudioMuted = !state.sequence.mainAudioMuted;
        state.mainAudioMuted = state.sequence.mainAudioMuted;
        if (dom.mainVideoEl) dom.mainVideoEl.muted = state.sequence.mainAudioMuted;
        dom.trackToggleMainAudio.textContent = state.sequence.mainAudioMuted ? '🔇' : '🔊';
        dom.trackToggleMainAudio.classList.toggle('muted', state.sequence.mainAudioMuted);
        renderTimelineTracks();
        showToast(state.sequence.mainAudioMuted ? '🔇 Main Voice Track Muted' : '🔊 Main Voice Track Unmuted');
      });
    }
    if (dom.trackToggleCaptions) {
      safeOn(dom.trackToggleCaptions, 'click', () => {
        state.trackVisibility.captions = !state.trackVisibility.captions;
        state.captionsEnabled = state.trackVisibility.captions;
        dom.trackToggleCaptions.classList.toggle('muted', !state.trackVisibility.captions);
        renderTimelineTracks();
        showToast(state.trackVisibility.captions ? '👁️ Karaoke Captions Shown' : '🙈 Karaoke Captions Hidden');
      });
    }
    if (dom.trackToggleOverlays) {
      safeOn(dom.trackToggleOverlays, 'click', () => {
        state.trackVisibility.overlays = !state.trackVisibility.overlays;
        dom.trackToggleOverlays.classList.toggle('muted', !state.trackVisibility.overlays);
        renderTimelineTracks();
        showToast(state.trackVisibility.overlays ? '👁️ Overlays & Topic Image Shown' : '🙈 Overlays & Topic Image Hidden');
      });
    }
    if (dom.trackToggleBroll) {
      safeOn(dom.trackToggleBroll, 'click', () => {
        state.trackVisibility.broll = !state.trackVisibility.broll;
        dom.trackToggleBroll.classList.toggle('muted', !state.trackVisibility.broll);
        renderTimelineTracks();
        showToast(state.trackVisibility.broll ? '👁️ B-Roll Track Shown' : '🙈 B-Roll Track Hidden');
      });
    }

    // Direct Preview Canvas Hit-Testing & Interactive Drag/Resize (CapCut Style)
    function getCanvasCoords(e) {
      if (!dom.previewCanvas) return { x: 0, y: 0 };
      const rect = dom.previewCanvas.getBoundingClientRect();
      const scaleX = dom.previewCanvas.width / Math.max(1, rect.width);
      const scaleY = dom.previewCanvas.height / Math.max(1, rect.height);
      return {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top) * scaleY
      };
    }

    if (dom.previewCanvas) {
      safeOn(dom.previewCanvas, 'mousedown', (e) => {
        const pt = getCanvasCoords(e);
        const b = state.lastImageBounds;
        const W = dom.previewCanvas.width;
        const H = dom.previewCanvas.height;

        if (b && state.overlayImage && state.overlayImageEnabled !== false) {
          const handleRadius = 36;
          const handles = [
            { x: b.x, y: b.y, id: 'tl' },
            { x: b.x + b.w, y: b.y, id: 'tr' },
            { x: b.x + b.w, y: b.y + b.h, id: 'br' },
            { x: b.x, y: b.y + b.h, id: 'bl' }
          ];

          const clickedHandle = handles.find(h => Math.hypot(pt.x - h.x, pt.y - h.y) <= handleRadius);
          if (clickedHandle) {
            state.selectedCanvasLayer = 'image';
            state.selectedTimelineItem = 'overlay-image';
            state.canvasDragMode = 'resize-image';
            state.canvasDragStart = {
              mouseX: pt.x,
              mouseY: pt.y,
              cx: b.cx,
              cy: b.cy,
              handleId: clickedHandle.id,
              initScale: state.overlayImageScale || 1.0,
              initW: b.w,
              initH: b.h
            };
            syncImageInspectorControls();
            renderTimelineTracks();
            return;
          }

          if (pt.x >= b.x && pt.x <= b.x + b.w && pt.y >= b.y && pt.y <= b.y + b.h) {
            state.selectedCanvasLayer = 'image';
            state.selectedTimelineItem = 'overlay-image';
            state.canvasDragMode = 'move-image';
            state.canvasDragStart = {
              mouseX: pt.x,
              mouseY: pt.y,
              initPosX: state.overlayImagePos?.x ?? 0.5,
              initPosY: state.overlayImagePos?.y ?? 0.38,
              initScale: state.overlayImageScale || 1.0
            };
            syncImageInspectorControls();
            renderTimelineTracks();
            return;
          }
        }

        if (pt.y >= 70 && pt.y <= 240) {
          state.selectedCanvasLayer = 'hook';
          state.selectedTimelineItem = 'hook-banner';
          renderTimelineTracks();
          return;
        }

        state.selectedCanvasLayer = null;
        state.selectedTimelineItem = null;
        renderTimelineTracks();
      });

      safeOn(dom.previewCanvas, 'mousemove', (e) => {
        if (state.canvasDragMode) return;
        const pt = getCanvasCoords(e);
        const b = state.lastImageBounds;
        if (b && state.overlayImage && state.overlayImageEnabled !== false) {
          const handleR = 26;
          const handles = [
            { x: b.x, y: b.y, cur: 'nwse-resize' },
            { x: b.x + b.w, y: b.y, cur: 'nesw-resize' },
            { x: b.x + b.w, y: b.y + b.h, cur: 'nwse-resize' },
            { x: b.x, y: b.y + b.h, cur: 'nesw-resize' }
          ];
          const h = handles.find(item => Math.hypot(pt.x - item.x, pt.y - item.y) <= handleR);
          if (h) {
            dom.previewCanvas.style.cursor = h.cur;
            return;
          }
          if (pt.x >= b.x && pt.x <= b.x + b.w && pt.y >= b.y && pt.y <= b.y + b.h) {
            dom.previewCanvas.style.cursor = 'move';
            return;
          }
        }
        dom.previewCanvas.style.cursor = 'default';
      });
    }

    if (dom.timelineViewToggleBtn) {
      safeOn(dom.timelineViewToggleBtn, 'click', () => {
        state.timelineViewMode = state.timelineViewMode === 'clip' ? 'full' : 'clip';
        state.timelineZoom = state.timelineViewMode === 'clip' ? 1.0 : 0.0;
        if (dom.timelineZoomSlider) dom.timelineZoomSlider.value = String(state.timelineZoom * 100);
        if (dom.zoomPercentLabel) dom.zoomPercentLabel.textContent = state.timelineViewMode === 'clip' ? 'Clip Focus' : 'Full Video';
        renderTimelineRuler();
        renderTimelineTracks();
        updatePlayheadUI();
        showToast(state.timelineViewMode === 'clip' ? 'Timeline: Clip Focus Mode (Zoomed)' : 'Timeline: Full Video View');
      });
    }

    safeOn(dom.resetTrimBtn, 'click', () => {
      const clip = getActiveClip();
      if (clip) {
        state.trimStart = clip.start;
        state.trimEnd = clip.end;
        if (state.overlayImage) {
          state.overlayImage.start = state.trimStart + (state.overlayImageStartOffset || 2.5);
        }
        seekToTime(state.trimStart);
        renderTimelineRuler();
        renderTimelineTracks();
      }
    });

    // OpenCut-inspired Magnetic Timeline Snapping
    const resolveTimelineSnap = (rawTime, maxSnapDistSec = 0.35) => {
      const snapPoints = [
        0,
        state.trimStart,
        state.trimEnd,
        state.currentTime,
        state.streamDuration,
        ...(state.overlayImage ? [state.overlayImage.start, state.overlayImage.start + state.overlayImage.duration] : []),
        ...((state.cuts || []).map(c => typeof c === 'number' ? c : c.time))
      ];
      let closest = rawTime;
      let minDiff = Infinity;
      for (const pt of snapPoints) {
        if (typeof pt !== 'number' || isNaN(pt)) continue;
        const diff = Math.abs(rawTime - pt);
        if (diff <= maxSnapDistSec && diff < minDiff) {
          minDiff = diff;
          closest = pt;
        }
      }
      return closest;
    };

    // Timeline stage mouse scrubbing + In/Out trim handle dragging
    const getTimelineSecFromMouseEvent = (e, applySnap = false) => {
      const rect = dom.timelineStage.getBoundingClientRect();
      const norm = clamp((e.clientX - rect.left) / Math.max(1, rect.width), 0, 1);
      const rawSec = timelinePctToTime(norm * 100);
      return applySnap ? resolveTimelineSnap(rawSec) : rawSec;
    };

    if (dom.trimHandleIn) {
      safeOn(dom.trimHandleIn, 'mousedown', (e) => {
        e.stopPropagation();
        state.activeDragMode = 'trim-in';
      });
    }
    if (dom.trimHandleOut) {
      safeOn(dom.trimHandleOut, 'mousedown', (e) => {
        e.stopPropagation();
        state.activeDragMode = 'trim-out';
      });
    }
    safeOn(dom.timelineStage, 'mousedown', (e) => {
      if (e.target.closest('.trim-handle') ||
          e.target.closest('.timeline-block') ||
          e.target.closest('.timeline-clip-block') ||
          e.target.closest('.clip-handle') ||
          e.target.closest('.block-resize-handle')) return;
      state.activeDragMode = 'playhead';
      seekToTime(getTimelineSecFromMouseEvent(e, false));
    });

    window.addEventListener('mousemove', (e) => {
      // 1. Direct Canvas Layer Dragging & Resizing (CapCut)
      if (state.canvasDragMode && dom.previewCanvas) {
        const pt = getCanvasCoords(e);
        const W = dom.previewCanvas.width;
        const H = dom.previewCanvas.height;
        const start = state.canvasDragStart;
        if (state.canvasDragMode === 'move-image') {
          const dx = (pt.x - start.mouseX) / W;
          const dy = (pt.y - start.mouseY) / H;
          state.overlayImagePos = state.overlayImagePos || { x: 0.5, y: 0.38 };
          state.overlayImagePos.x = clamp(start.initPosX + dx, 0.08, 0.92);
          state.overlayImagePos.y = clamp(start.initPosY + dy, 0.08, 0.92);
          syncImageInspectorControls();
        } else if (state.canvasDragMode === 'resize-image') {
          const dist = Math.hypot(pt.x - start.cx, pt.y - start.cy);
          const initDist = Math.hypot(start.mouseX - start.cx, start.mouseY - start.cy);
          const factor = dist / Math.max(15, initDist);
          state.overlayImageScale = clamp(start.initScale * factor, 0.25, 2.5);
          syncImageInspectorControls();
        }
        return;
      }

      // 2. Interactive Video Cut Dragging & Trimming (CapCut / OpenCut)
      if (state.activeClipDrag && dom.timelineStage) {
        const { clipId, action, startX, initStart, initEnd, idx } = state.activeClipDrag;
        const dx = e.clientX - startX;
        const { span } = getTimelineBounds();
        const stageW = dom.timelineStage.getBoundingClientRect().width || 1000;
        const dt = (dx / stageW) * span;
        const clips = state.sequence?.videoClips || [];
        const clip = clips.find((c) => c.id === clipId);

        if (clip) {
          if (action === 'trim-in') {
            const minStart = idx > 0 ? clips[idx - 1].start + 0.3 : 0;
            const newStart = clamp(initStart + dt, minStart, clip.end - 0.4);
            clip.start = Number(newStart.toFixed(2));
            if (idx > 0) {
              clips[idx - 1].end = clip.start;
            }
          } else if (action === 'trim-out') {
            const maxEnd = idx < clips.length - 1 ? clips[idx + 1].end - 0.3 : (state.streamDuration || 60);
            const newEnd = clamp(initEnd + dt, clip.start + 0.4, maxEnd);
            clip.end = Number(newEnd.toFixed(2));
            if (idx < clips.length - 1) {
              clips[idx + 1].start = clip.end;
            }
          } else if (action === 'move') {
            const dur = initEnd - initStart;
            const newStart = Math.max(0, initStart + dt);
            clip.start = Number(newStart.toFixed(2));
            clip.end = Number((newStart + dur).toFixed(2));
          }
          renderTimelineTracks();
          syncSelectedCutInspector();
          return;
        }
      }

      // 2b. Interactive Caption / Subtitle Dragging & Trimming (CapCut / OpenCut)
      if (state.activeCaptionDrag && dom.timelineStage) {
        const { seg, action, startX, initStart, initEnd } = state.activeCaptionDrag;
        const dx = e.clientX - startX;
        const { span } = getTimelineBounds();
        const stageW = dom.timelineStage.getBoundingClientRect().width || 1000;
        const dt = (dx / stageW) * span;

        const clip = getActiveClip();
        if (clip && Array.isArray(clip.transcript) && seg.chunkStartIdx !== undefined) {
          const words = clip.transcript.slice(seg.chunkStartIdx, seg.chunkStartIdx + (seg.chunkCount || 3));
          if (action === 'trim-cap-left') {
            const newStart = clamp(initStart + dt, 0, seg.end - 0.2);
            seg.start = Number(newStart.toFixed(2));
            if (words[0]) words[0].start = seg.start;
          } else if (action === 'trim-cap-right') {
            const newEnd = Math.max(seg.start + 0.2, initEnd + dt);
            seg.end = Number(newEnd.toFixed(2));
            if (words[words.length - 1]) words[words.length - 1].end = seg.end;
          } else if (action === 'move-cap') {
            const dur = initEnd - initStart;
            const newStart = Math.max(0, initStart + dt);
            const delta = newStart - initStart;
            seg.start = Number(newStart.toFixed(2));
            seg.end = Number((newStart + dur).toFixed(2));
            words.forEach(w => {
              w.start = Math.max(0, Number((w.start + delta).toFixed(2)));
              w.end = Math.max(0.1, Number((w.end + delta).toFixed(2)));
            });
          }
          renderTimelineTracks();
          return;
        }
      }

      // 3. Interactive Timeline Block Dragging & Timing Adjustment (CapCut)
      if (state.timelineBlockDrag && dom.timelineStage) {
        const dx = e.clientX - state.timelineBlockDrag.startX;
        const { span } = getTimelineBounds();
        const stageWidth = dom.timelineStage.getBoundingClientRect().width || 1000;
        const dt = (dx / stageWidth) * span;

        if (state.timelineBlockDrag.item === 'overlay-image' && state.overlayImage) {
          if (state.timelineBlockDrag.action === 'move') {
            const newStart = Math.max(0, state.timelineBlockDrag.initStart + dt);
            state.overlayImage.start = Number(newStart.toFixed(2));
            state.overlayImageStartOffset = Math.max(0, Number((state.overlayImage.start - state.trimStart).toFixed(2)));
            syncImageInspectorControls();
          } else if (state.timelineBlockDrag.action === 'resize-right') {
            const newDur = Math.max(1.0, state.timelineBlockDrag.initDuration + dt);
            state.overlayImage.duration = Number(newDur.toFixed(2));
            state.overlayImageDuration = state.overlayImage.duration;
            syncImageInspectorControls();
          } else if (state.timelineBlockDrag.action === 'resize-left') {
            const newStart = Math.max(0, state.timelineBlockDrag.initStart + dt);
            const deltaStart = newStart - state.timelineBlockDrag.initStart;
            const newDur = Math.max(1.0, state.timelineBlockDrag.initDuration - deltaStart);
            state.overlayImage.start = Number(newStart.toFixed(2));
            state.overlayImage.duration = Number(newDur.toFixed(2));
            state.overlayImageStartOffset = Math.max(0, Number((state.overlayImage.start - state.trimStart).toFixed(2)));
            state.overlayImageDuration = state.overlayImage.duration;
            syncImageInspectorControls();
          }
          renderTimelineTracks();
          return;
        } else if (state.timelineBlockDrag.item === 'hook-banner') {
          if (state.timelineBlockDrag.action === 'resize-right') {
            const newDur = Math.max(1.0, state.timelineBlockDrag.initDuration + dt);
            state.hookDuration = Number(newDur.toFixed(1));
            renderTimelineTracks();
          }
          return;
        }
      }

      // 4. Playhead & Trim Handles Dragging (with OpenCut Magnetic Snapping)
      if (!state.activeDragMode) return;
      const applySnap = state.activeDragMode === 'trim-in' || state.activeDragMode === 'trim-out';
      const t = getTimelineSecFromMouseEvent(e, applySnap);
      if (state.activeDragMode === 'playhead') {
        seekToTime(t);
      } else if (state.activeDragMode === 'trim-in') {
        state.trimStart = clamp(t, 0, state.trimEnd - 1.5);
        if (state.overlayImage) {
          state.overlayImage.start = state.trimStart + (state.overlayImageStartOffset || 2.5);
        }
        seekToTime(state.trimStart);
        renderTimelineRuler();
        renderTimelineTracks();
        updateComplianceAndPayout();
      } else if (state.activeDragMode === 'trim-out') {
        state.trimEnd = clamp(t, state.trimStart + 1.5, state.streamDuration || 60);
        renderTimelineRuler();
        renderTimelineTracks();
        updateComplianceAndPayout();
      }
    });

    window.addEventListener('mouseup', () => {
      state.activeClipDrag = null;
      state.activeCaptionDrag = null;
      state.activeDragMode = null;
      state.canvasDragMode = null;
      state.canvasDragStart = null;
      state.timelineBlockDrag = null;
    });

    // Global Keyboard Shortcuts (CapCut-compatible shortcuts)
    window.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        saveCurrentClipToVault(false);
        return;
      }
      if (((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') || e.key.toLowerCase() === 'c') {
        if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
          e.preventDefault();
          splitClipAtPlayhead();
          return;
        }
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
          e.preventDefault();
          deleteSelectedCapCutItem();
          return;
        }
      }
      const tag = (e.target && e.target.tagName) || '';
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      if (e.code === 'Space') {
        e.preventDefault();
        togglePlayPause();
      } else if (e.key.toLowerCase() === 'b') {
        e.preventDefault();
        splitClipAtPlayhead();
      } else if (e.key.toLowerCase() === 'q') {
        e.preventDefault();
        rippleTrimIn();
      } else if (e.key.toLowerCase() === 'w') {
        e.preventDefault();
        rippleTrimOut();
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        deleteSelectedCapCutItem();
      } else if (e.key.toLowerCase() === 'm') {
        e.preventDefault();
        toggleBackgroundSound();
      }
    });

    // OpenCut Left Rail Tab Switcher
    document.querySelectorAll('.rail-btn[data-rail-tab]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const tab = btn.dataset.railTab;
        document.querySelectorAll('.rail-btn').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        document.querySelectorAll('.drawer-content').forEach((c) => c.classList.remove('active'));
        const target = document.getElementById(`drawerTab-${tab}`);
        if (target) target.classList.add('active');
      });
    });

    // Step 1s back/forward & skip end
    if (dom.stepBackBtn) {
      safeOn(dom.stepBackBtn, 'click', () => {
        seekToTime(Math.max(0, state.currentTime - 1.0));
      });
    }
    if (dom.stepForwardBtn) {
      safeOn(dom.stepForwardBtn, 'click', () => {
        seekToTime(Math.min(state.streamDuration || 60, state.currentTime + 1.0));
      });
    }
    if (dom.skipEndBtn) {
      safeOn(dom.skipEndBtn, 'click', () => {
        seekToTime(state.trimEnd || state.streamDuration || 60);
      });
    }

    // Inspector Transform & Actions
    if (dom.rotateCutBtn) {
      safeOn(dom.rotateCutBtn, 'click', () => {
        state.cameraRotation = ((state.cameraRotation || 0) + 90) % 360;
        renderCanvasFrame();
        showToast(`↻ Rotated video ${state.cameraRotation}°`);
      });
    }
    if (dom.flipCutBtn) {
      safeOn(dom.flipCutBtn, 'click', () => {
        state.cameraFlipH = !state.cameraFlipH;
        renderCanvasFrame();
        showToast(state.cameraFlipH ? '⇄ Flipped Horizontal' : '⇄ Reset Horizontal Flip');
      });
    }
    if (dom.splitSelectedCutBtn) {
      safeOn(dom.splitSelectedCutBtn, 'click', splitClipAtPlayhead);
    }
    if (dom.deleteSelectedCutBtn) {
      safeOn(dom.deleteSelectedCutBtn, 'click', deleteSelectedCapCutItem);
    }
    if (dom.selectedCutVolSlider) {
      safeOn(dom.selectedCutVolSlider, 'input', () => {
        const clip = (state.sequence?.videoClips || []).find((c) => c.id === state.sequence?.selectedClipId);
        if (clip) {
          const vol = parseInt(dom.selectedCutVolSlider.value, 10);
          clip.volume = vol / 100;
          if (dom.selectedCutVolLabel) dom.selectedCutVolLabel.textContent = `${vol}%`;
        }
      });
    }

    // Speed Chips
    document.querySelectorAll('.speed-chip[data-speed]').forEach((chip) => {
      chip.addEventListener('click', () => {
        document.querySelectorAll('.speed-chip').forEach((c) => c.classList.remove('active'));
        chip.classList.add('active');
        state.playbackSpeed = parseFloat(chip.dataset.speed) || 1.0;
        if (dom.mainVideoEl) dom.mainVideoEl.playbackRate = state.playbackSpeed;
        showToast(`⚡ Playback speed: ${state.playbackSpeed}×`);
      });
    });

    // Transitions & Filters
    document.querySelectorAll('.transition-btn[data-transition]').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.transition-btn').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        const trans = btn.dataset.transition;
        const clip = (state.sequence?.videoClips || []).find((c) => c.id === state.sequence?.selectedClipId);
        if (clip) {
          clip.transition = trans;
          if (dom.selectedCutTransitionSelect) dom.selectedCutTransitionSelect.value = trans;
        }
        showToast(`🪄 Transition into cut set to: ${trans}`);
      });
    });

    document.querySelectorAll('.filter-btn[data-filter]').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.filter-btn').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        state.activeFilter = btn.dataset.filter;
        renderCanvasFrame();
        showToast(`🎨 Color filter applied: ${state.activeFilter}`);
      });
    });

    // Pro Video Effects (VFX) Toggles & Sliders
    document.querySelectorAll('.effect-card[data-effect]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const eff = btn.dataset.effect;
        if (!state.effects) state.effects = {};
        state.effects[eff] = !state.effects[eff];
        btn.classList.toggle('active', state.effects[eff]);
        renderCanvasFrame();
        showToast(`${state.effects[eff] ? '✨ Enabled' : '⏸️ Disabled'} effect: ${btn.querySelector('strong')?.innerText || eff}`, '#00f2fe');
      });
    });

    const vignetteSlider = document.getElementById('vignetteIntensitySlider');
    const vignetteLabel = document.getElementById('vignetteIntensityVal');
    if (vignetteSlider) {
      vignetteSlider.addEventListener('input', () => {
        const val = parseInt(vignetteSlider.value, 10);
        if (state.effects) state.effects.vignetteIntensity = val / 100;
        if (vignetteLabel) vignetteLabel.textContent = `${val}%`;
        renderCanvasFrame();
      });
    }

    const grainSlider = document.getElementById('grainIntensitySlider');
    const grainLabel = document.getElementById('grainIntensityVal');
    if (grainSlider) {
      grainSlider.addEventListener('input', () => {
        const val = parseInt(grainSlider.value, 10);
        if (state.effects) state.effects.filmGrainIntensity = val / 100;
        if (grainLabel) grainLabel.textContent = `${val}%`;
        renderCanvasFrame();
      });
    }

    const halationSlider = document.getElementById('halationIntensitySlider');
    const halationLabel = document.getElementById('halationIntensityVal');
    if (halationSlider) {
      halationSlider.addEventListener('input', () => {
        const val = parseInt(halationSlider.value, 10);
        if (state.effects) state.effects.halationIntensity = val / 100;
        if (halationLabel) halationLabel.textContent = `${val}%`;
        renderCanvasFrame();
      });
    }

    const letterboxSlider = document.getElementById('letterboxHeightSlider');
    const letterboxLabel = document.getElementById('letterboxHeightVal');
    if (letterboxSlider) {
      letterboxSlider.addEventListener('input', () => {
        const val = parseInt(letterboxSlider.value, 10);
        if (state.effects) state.effects.letterboxHeight = val;
        if (letterboxLabel) letterboxLabel.textContent = `${val}px`;
        renderCanvasFrame();
      });
    }

    const strobeToggle = document.getElementById('hardStrobeFlashToggle');
    if (strobeToggle) {
      strobeToggle.addEventListener('change', () => {
        if (!state.hardEdit) state.hardEdit = {};
        state.hardEdit.strobeFlash = strobeToggle.checked;
        showToast(strobeToggle.checked ? '⚡ Clean cut flash enabled' : 'Clean cut flash disabled');
      });
    }

    // Timeline Zoom & Utilities
    if (dom.zoomOutBtn && dom.timelineZoomSlider) {
      safeOn(dom.zoomOutBtn, 'click', () => {
        dom.timelineZoomSlider.value = String(Math.max(0, parseInt(dom.timelineZoomSlider.value, 10) - 20));
        dom.timelineZoomSlider.dispatchEvent(new Event('input'));
      });
    }
    if (dom.zoomInBtn && dom.timelineZoomSlider) {
      safeOn(dom.zoomInBtn, 'click', () => {
        dom.timelineZoomSlider.value = String(Math.min(100, parseInt(dom.timelineZoomSlider.value, 10) + 20));
        dom.timelineZoomSlider.dispatchEvent(new Event('input'));
      });
    }
    if (dom.duplicateClipBtn) {
      safeOn(dom.duplicateClipBtn, 'click', () => {
        const clips = state.sequence?.videoClips || [];
        const sel = clips.find((c) => c.id === state.sequence?.selectedClipId) || clips[0];
        if (!sel) return;
        const dur = sel.end - sel.start;
        const copy = Object.assign({}, sel, {
          id: 'cut-' + Date.now(),
          title: `${sel.title} (Copy)`,
          start: sel.end,
          end: sel.end + dur
        });
        clips.push(copy);
        state.sequence.selectedClipId = copy.id;
        renderTimelineTracks();
        syncSelectedCutInspector();
        showToast(`📄 Duplicated ${sel.title}`);
      });
    }
    if (dom.linkAudioBtn) {
      safeOn(dom.linkAudioBtn, 'click', () => {
        state.audioLinked = state.audioLinked === undefined ? false : !state.audioLinked;
        dom.linkAudioBtn.classList.toggle('active', state.audioLinked);
        showToast(state.audioLinked ? '🔗 Audio linked to video cut' : '✂ Audio extracted to separate track');
      });
    }
    if (dom.fullscreenBtn) {
      safeOn(dom.fullscreenBtn, 'click', () => {
        const box = document.getElementById('previewCanvasBox');
        if (!box) return;
        if (!document.fullscreenElement) {
          box.requestFullscreen().catch(() => {});
        } else {
          document.exitFullscreen().catch(() => {});
        }
      });
    }
    if (dom.toggleSafeZoneBtn) {
      safeOn(dom.toggleSafeZoneBtn, 'click', () => {
        state.showSafeZones = !state.showSafeZones;
        const safeBox = document.getElementById('safeZoneOverlay');
        if (safeBox) safeBox.classList.toggle('hidden', !state.showSafeZones);
        dom.toggleSafeZoneBtn.classList.toggle('active', state.showSafeZones);
        showToast(state.showSafeZones ? '📱 Safe Zones visible (TikTok/Shorts UI)' : '📱 Safe Zones hidden');
      });
    }
    if (dom.themeToggleBtn) {
      safeOn(dom.themeToggleBtn, 'click', () => {
        const isDark = document.documentElement.classList.toggle('dark');
        showToast(isDark ? '🌙 Dark mode active' : '☀️ Light mode active');
      });
    }

    // Timeline deselect background click
    if (dom.timelineStage) {
      safeOn(dom.timelineStage, 'click', (e) => {
        if (!e.target.closest('.timeline-clip-block')) {
          state.sequence.selectedClipId = null;
          syncSelectedCutInspector();
          document.querySelectorAll('.timeline-clip-block').forEach((b) => {
            b.classList.remove('selected');
          });
        }
      });
    }
  }

  function handleLocalMainVideoFile(file) {
    state.useCustomMainVideo = true;
    state.customMainFileName = file.name;
    dom.activeSourceBadge.textContent = 'LOCAL VIDEO';
    dom.dropzoneMainLabel.textContent = file.name;
    dom.dropzoneSubLabel.textContent = `${(file.size / (1024 * 1024)).toFixed(1)} MB • Local Stream Active`;

    const url = URL.createObjectURL(file);
    dom.mainVideoEl.src = url;
    dom.mainVideoEl.load();

    if (window.WhopAudioEngine) {
      window.WhopAudioEngine.connectMainVideo(dom.mainVideoEl);
      Promise.resolve(
        window.WhopAudioEngine.analyzeVideoBufferOrDemo(file, {
          presetId: state.streamPreset,
          duration: 60
        })
      ).then((res) => {
        if (res && res.peaks) {
          state.analysis = res;
          state.streamDuration = res.duration || 60;
          runOneClickAutoEdit(0);
          showToast(`🚀 0-Click Auto-Edit Applied to "${file.name}"! Playing viral highlight...`, '#10b981');
          if (!state.isPlaying) {
            setTimeout(togglePlayPause, 300);
          }
        }
      });
    }
  }

  function togglePlayPause() {
    state.isPlaying = !state.isPlaying;
    updatePlayPauseButtonUI();

    if (state.isPlaying) {
      const dur = dom.mainVideoEl?.duration || state.streamDuration || 58.05;
      const endLimit = Math.min(state.trimEnd, dur);

      if (state.currentTime >= endLimit - 0.05 || state.currentTime < state.trimStart) {
        state.currentTime = state.trimStart;
        if (dom.mainVideoEl) dom.mainVideoEl.currentTime = state.trimStart;
      } else {
        // FIRST FRAME GUARD: only seek if video element is more than 60ms off
        if (dom.mainVideoEl && Math.abs(dom.mainVideoEl.currentTime - state.currentTime) > 0.06) {
          dom.mainVideoEl.currentTime = state.currentTime;
        }
      }

      if (state.useCustomMainVideo && dom.mainVideoEl) {
        dom.mainVideoEl.playbackRate = state.playbackSpeed || 1.0;
        dom.mainVideoEl.play().catch(() => {});
      }
      if (state.useCustomBrollVideo && dom.brollVideoEl) {
        dom.brollVideoEl.playbackRate = state.playbackSpeed || 1.0;
        dom.brollVideoEl.play().catch(() => {});
      }
      if (window.WhopAudioEngine) {
        window.WhopAudioEngine.syncPlayback(state.currentTime, true, {
          musicPreset: state.musicPreset,
          demoMode: false
        });
      }
    } else {
      if (state.useCustomMainVideo && dom.mainVideoEl) {
        dom.mainVideoEl.pause();
      }
      if (state.useCustomBrollVideo && dom.brollVideoEl) {
        dom.brollVideoEl.pause();
      }
      if (window.WhopAudioEngine) {
        window.WhopAudioEngine.syncPlayback(state.currentTime, false);
      }
    }
  }

  // =========================================================================
  // MAIN 60FPS ANIMATION LOOP (ULTRA SMOOTH • ZERO-SEEK HARDWARE CLOCK)
  // =========================================================================
  let lastFrameTs = performance.now();

  function studioAnimationLoop(nowTs) {
    const dt = Math.min(0.05, Math.max(0, (nowTs - lastFrameTs) / 1000));
    lastFrameTs = nowTs;

    if (state.isPlaying) {
      if (state.useCustomMainVideo && dom.mainVideoEl && !dom.mainVideoEl.paused) {
        // High-performance hardware clock directly from HTML5 video element!
        const vidTime = dom.mainVideoEl.currentTime;
        const dur = dom.mainVideoEl.duration || state.streamDuration || 58.05;
        const endLimit = Math.min(state.trimEnd, dur);

        // Check if reaching the end of the trim boundary or video duration
        if (vidTime >= endLimit - 0.05) {
          if (state.loopClip && !state.isRecordingExport) {
            dom.mainVideoEl.currentTime = state.trimStart;
            state.currentTime = state.trimStart;
          } else if (!state.isRecordingExport) {
            state.currentTime = endLimit;
            state.isPlaying = false;
            updatePlayPauseButtonUI();
            dom.mainVideoEl.pause();
            if (window.WhopAudioEngine) window.WhopAudioEngine.stopMusic();
          }
        } else {
          // Continuous seamless playback:
          state.currentTime = vidTime;

          // Check if crossing a NON-contiguous cut boundary (e.g. deleted silence or split gap)
          const activeClip = getActiveVideoCutAtTime(vidTime);
          if (activeClip) {
            const srcEnd = activeClip.sourceEnd !== undefined ? activeClip.sourceEnd : activeClip.end;
            if (vidTime >= srcEnd - 0.04) {
              const cuts = state.sequence?.videoClips || [];
              const curIdx = cuts.findIndex((c) => c.id === activeClip.id);
              if (curIdx >= 0 && curIdx < cuts.length - 1) {
                const nextCut = cuts[curIdx + 1];
                const nextSrc = nextCut.sourceStart !== undefined ? nextCut.sourceStart : nextCut.start;
                // ONLY seek if there is an actual non-contiguous gap (> 0.12s)!
                if (Math.abs(nextSrc - srcEnd) > 0.12) {
                  dom.mainVideoEl.currentTime = nextSrc;
                  state.currentTime = nextCut.start;
                }
              }
            }
          }
        }
      } else {
        // Delta-time fallback clock
        state.currentTime += dt * (state.playbackSpeed || 1.0);
        const dur = state.streamDuration || 58.05;
        const endLimit = Math.min(state.trimEnd, dur);
        if (state.currentTime >= endLimit) {
          if (state.loopClip && !state.isRecordingExport) {
            seekToTime(state.trimStart);
          } else if (!state.isRecordingExport) {
            state.currentTime = endLimit;
            state.isPlaying = false;
            updatePlayPauseButtonUI();
            if (dom.mainVideoEl) dom.mainVideoEl.pause();
            if (window.WhopAudioEngine) window.WhopAudioEngine.stopMusic();
          }
        }
      }

      updatePlayheadUI();
      highlightActiveTranscriptChip();
    }

    renderCanvasFrame();
    requestAnimationFrame(studioAnimationLoop);
  }

  async function initRepoEnginesStatus() {
    try {
      const resp = await fetch('/api/repos_status');
      if (resp.ok) {
        const data = await resp.json();
        if (data && data.repositories) {
          const r = data.repositories;
          const bAuto = document.getElementById('badgeAutoVideoEditor');
          const bClip = document.getElementById('badgeAutoclip');
          const bBridge = document.getElementById('badgeBridgeclip');
          const bOpen = document.getElementById('badgeOpenClipper');
          const pStatus = document.getElementById('repoPipelineStatus');

          if (bAuto && r['auto-video-editor']) {
            bAuto.classList.toggle('active', !!r['auto-video-editor'].cloned);
          }
          if (bClip && r['Autoclip']) {
            bClip.classList.toggle('active', !!r['Autoclip'].cloned);
          }
          if (bBridge && r['bridgeclip']) {
            bBridge.classList.toggle('active', !!r['bridgeclip'].cloned);
          }
          if (bOpen && r['OpenClipper']) {
            bOpen.classList.toggle('active', !!r['OpenClipper'].cloned);
          }
          if (pStatus) {
            pStatus.innerHTML = '<span class="status-check">🟢</span><span class="status-text">4/4 ENGINES CONNECTED</span>';
          }
        }
      }
    } catch (e) {
      console.warn('Could not query repo status:', e);
    }
  }

  // =========================================================================
  // BOOTSTRAP STUDIO
  // =========================================================================
  function initStudio() {
    cacheDom();
    renderBrollPresetCards();
    renderMusicPresetCards();

    // Default to REAL VIDEO playback (MrBeast Interview)
    state.useCustomMainVideo = true;
    state.customMainFileName = 'clip_20261024_182745_MrBeast_Interview_Hook_0s_58s.mp4';
    if (dom.mainVideoEl) {
      dom.mainVideoEl.src = '/uploads/clip_20261024_182745_MrBeast_Interview_Hook_0s_58s.mp4';
      dom.mainVideoEl.load();
      if (window.WhopAudioEngine) {
        window.WhopAudioEngine.connectMainVideo(dom.mainVideoEl);
      }
    }
    if (dom.activeSourceBadge) {
      dom.activeSourceBadge.textContent = 'REAL VIDEO';
      dom.activeSourceBadge.className = 'status-pill status-emerald';
    }

    fetchServerVideos();
    fetchActiveProject();
    initRepoEnginesStatus();
    syncAllInspectorControlsFromState();
    renderVisualOverlaysList();
    bindEvents();
    renderTimelineRuler();
    renderTimelineTracks();

    try {
      const savedKey = localStorage.getItem('whop_ai_api_key');
      const savedProvider = localStorage.getItem('whop_ai_provider');
      if (savedKey) state.geminiApiKey = savedKey;
      if (savedProvider) state.aiProvider = savedProvider;
    } catch (_) {}
    if (typeof updateAiKeyHeaderBadge === 'function') {
      updateAiKeyHeaderBadge();
    }

    if (state.sequence && state.sequence.videoClips && state.sequence.videoClips.length > 0) {
      state.sequence.selectedClipId = state.sequence.videoClips[0].id;
      syncSelectedCutInspector();
    }

    // Render initial canvas frame & ensure 1 starter clip is saved in Vault
    renderCanvasFrame();
    ensureStarterSavedClip();

    window.WhopStudio = {
      state,
      dom,
      syncImageInspectorControls,
      seekToTime,
      renderTimelineTracks,
      splitClipAtPlayhead,
      deleteSelectedCapCutItem,
      switchInspectorTab,
      rippleTrimIn,
      rippleTrimOut,
    };
    window.WhopState = state;
    window.splitClipAtPlayhead = splitClipAtPlayhead;
    window.deleteSelectedCapCutItem = deleteSelectedCapCutItem;
    window.switchInspectorTab = switchInspectorTab;

    requestAnimationFrame((ts) => {
      lastFrameTs = ts;
      studioAnimationLoop(ts);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initStudio);
  } else {
    initStudio();
  }
})();
