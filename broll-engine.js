/**
 * WhopClip Studio — Procedural 60fps Video & Satisfying B-Roll Canvas Engine
 * Provides:
 *  1. Three hyper-detailed 60fps Demo Studio Main Video Feeds:
 *     - 'podcast-millionaire'
 *     - 'streamer-alpha'
 *     - 'founder-breakdown'
 *  2. Six 3D-perspective Procedural Satisfying B-Roll Engines:
 *     - 'minecraft-parkour'
 *     - 'subway-runner'
 *     - 'gta-stunt-ramp'
 *     - 'kinetic-slicer'
 *     - 'hydraulic-press'
 *     - 'synthwave-drive'
 *
 * Attached to `window.WhopBrollEngine` for zero-bundler browser usage.
 */
(function (global) {
  'use strict';

  const DEMO_STREAMS = [
    {
      id: 'podcast-millionaire',
      name: 'Millionaire Clipper Podcast',
      title: 'Ep. 142: How Whop Clippers Make $12k/Mo From 30-Sec Shorts',
      subtitle: 'WHOP CREATORS PODCAST • EPISODE 142',
      hosts: ['Alex Hormo-Style', 'Marcus Vance'],
      duration: 60,
      accent: '#ff5722',
      secondaryAccent: '#ffb300',
      badge: '4K STUDIO CAM'
    },
    {
      id: 'streamer-alpha',
      name: 'Alpha Streamer Live',
      title: 'LIVE STREAM: The Secret Algorithm Hook Nobody Talks About',
      subtitle: 'KAI / SPEED ENERGY • 14.8K WATCHING NOW',
      hosts: ['ZackLiveTV'],
      duration: 60,
      accent: '#00f2fe',
      secondaryAccent: '#ff0844',
      badge: 'LIVE 60FPS'
    },
    {
      id: 'founder-breakdown',
      name: 'SaaS Founder Breakdown',
      title: 'SaaS Breakdown: Why 99% of Short-Form Editors Fail in 3 Seconds',
      subtitle: 'RETENTION LABS • KEYNOTE BREAKDOWN',
      hosts: ['Devon K. (Founder)'],
      duration: 60,
      accent: '#10b981',
      secondaryAccent: '#6366f1',
      badge: 'RETENTION TELEMETRY'
    },
    {
      id: 'mrbeast-interview',
      name: 'The Full Story of MrBeast',
      title: '72 Hours with MrBeast (Colin and Samir Interview)',
      subtitle: 'MRBEAST STUDIO • 100M CREATOR INTERVIEW',
      hosts: ['Colin & Samir', 'Jimmy (MrBeast)'],
      duration: 600,
      accent: '#00e5ff',
      secondaryAccent: '#ff007f',
      badge: 'MRBEAST 4K'
    }
  ];

  const BROLL_PRESETS = [
    {
      id: 'minecraft-parkour',
      name: 'Minecraft Sky Parkour',
      category: 'Gaming Retention',
      retentionBoost: '+38%',
      accent: '#4ade80'
    },
    {
      id: 'subway-runner',
      name: 'Subway Neon Surfers',
      category: 'Hyper Runner',
      retentionBoost: '+42%',
      accent: '#38bdf8'
    },
    {
      id: 'gta-stunt-ramp',
      name: 'GTA Mega Stunt Ramp',
      category: 'High Velocity',
      retentionBoost: '+35%',
      accent: '#f97316'
    },
    {
      id: 'kinetic-slicer',
      name: 'Kinetic Sand Slicer ASMR',
      category: 'Oddly Satisfying',
      retentionBoost: '+31%',
      accent: '#f43f5e'
    },
    {
      id: 'hydraulic-press',
      name: '300T Hydraulic Press',
      category: 'Destruction Physics',
      retentionBoost: '+34%',
      accent: '#eab308'
    },
    {
      id: 'synthwave-drive',
      name: 'Synthwave Outrun Drive',
      category: 'Aesthetic Loop',
      retentionBoost: '+27%',
      accent: '#c084fc'
    }
  ];

  // Deterministic pseudo-random helper
  function hashNoise(n) {
    const x = Math.sin(n * 127.1 + 311.7) * 43758.5453123;
    return x - Math.floor(x);
  }

  function clamp(val, min, max) {
    return Math.max(min, Math.min(max, val));
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function normalizeRect(ctx, rect) {
    if (!rect) {
      return {
        x: 0,
        y: 0,
        w: ctx && ctx.canvas ? ctx.canvas.width : 540,
        h: ctx && ctx.canvas ? ctx.canvas.height : 960
      };
    }
    return {
      x: Number.isFinite(rect.x) ? rect.x : 0,
      y: Number.isFinite(rect.y) ? rect.y : 0,
      w: Number.isFinite(rect.w) ? rect.w : (Number.isFinite(rect.width) ? rect.width : 540),
      h: Number.isFinite(rect.h) ? rect.h : (Number.isFinite(rect.height) ? rect.height : 960)
    };
  }

  function drawRoundedRect(ctx, x, y, w, h, r) {
    const radius = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + w, y, x + w, y + h, radius);
    ctx.arcTo(x + w, y + h, x, y + h, radius);
    ctx.arcTo(x, y + h, x, y, radius);
    ctx.arcTo(x, y, x + w, y, radius);
    ctx.closePath();
  }

  /**
   * Computes simulated voice activity envelope (0..1) at any timestamp
   * so speaker lips, hands, and studio VU meters react realistically.
   */
  function getSpeechEnvelope(timeSec, presetId) {
    // Match natural speech cadence with brief dead-air pauses
    const silenceWindows = [
      [5.4, 6.5],
      [14.2, 15.5],
      [25.8, 27.1],
      [38.0, 39.4],
      [49.2, 50.5]
    ];
    for (let i = 0; i < silenceWindows.length; i++) {
      const [s, e] = silenceWindows[i];
      if (timeSec >= s && timeSec <= e) {
        return 0.03;
      }
    }
    const seed = presetId === 'streamer-alpha' ? 1.7 : presetId === 'founder-breakdown' ? 3.1 : 0.0;
    const syllabic = Math.abs(Math.sin((timeSec + seed) * 14.5)) * 0.55;
    const phrase = (Math.sin((timeSec + seed) * 3.8) * 0.5 + 0.5) * 0.35;
    const burst = Math.pow(Math.max(0, Math.sin((timeSec + seed) * 7.2)), 3) * 0.25;
    return clamp(syllabic + phrase + burst, 0.08, 1.0);
  }

  /**
   * Shared helper: Renders a detailed animated human speaker avatar
   * with studio rim lighting, facial expressions, blinking, lip sync, and microphone.
   */
  function drawAnimatedSpeaker(ctx, cfg) {
    const {
      cx,
      cy,
      scale,
      timeSec,
      voiceLevel,
      skinColor = '#e0ac8b',
      hairColor = '#1a191e',
      shirtColor = '#18181b',
      rimColor = '#ff5722',
      accentColor = '#ffb300',
      hasHeadset = false,
      hasGlasses = false,
      hasBeard = true,
      isActive = true,
      facing = 1
    } = cfg;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(scale, scale);

    const breath = Math.sin(timeSec * 2.6) * 2.5;
    const talkBob = isActive ? Math.sin(timeSec * 11) * voiceLevel * 3.2 : 0;
    const headTilt = isActive
      ? Math.sin(timeSec * 1.9) * 0.045 + Math.cos(timeSec * 4.3) * voiceLevel * 0.03
      : Math.sin(timeSec * 1.1) * 0.015;

    // Back rim glow behind shoulders & head
    const rimGrad = ctx.createRadialGradient(0, -35, 10, 0, -35, 145);
    rimGrad.addColorStop(0, isActive ? rimColor + '55' : rimColor + '22');
    rimGrad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = rimGrad;
    ctx.beginPath();
    ctx.arc(0, -35, 145, 0, Math.PI * 2);
    ctx.fill();

    // Torso / Shoulders
    ctx.save();
    ctx.translate(0, breath);
    const torsoGrad = ctx.createLinearGradient(-90, 10, 90, 140);
    torsoGrad.addColorStop(0, shirtColor);
    torsoGrad.addColorStop(1, '#09090d');
    ctx.fillStyle = torsoGrad;
    ctx.beginPath();
    ctx.moveTo(-105, 130);
    ctx.quadraticCurveTo(-98, 28, -42, 16);
    ctx.lineTo(42, 16);
    ctx.quadraticCurveTo(98, 28, 105, 130);
    ctx.closePath();
    ctx.fill();

    // Rim highlight on shoulder edge
    ctx.strokeStyle = isActive ? rimColor : 'rgba(255,255,255,0.18)';
    ctx.lineWidth = 2.8;
    ctx.beginPath();
    ctx.moveTo(-102, 118);
    ctx.quadraticCurveTo(-94, 30, -40, 17);
    ctx.moveTo(40, 17);
    ctx.quadraticCurveTo(94, 30, 102, 118);
    ctx.stroke();

    // Hoodie / Collar detail
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-28, 18);
    ctx.quadraticCurveTo(0, 44, 28, 18);
    ctx.stroke();

    // Neck
    ctx.fillStyle = skinColor;
    drawRoundedRect(ctx, -18, -14, 36, 38, 12);
    ctx.fill();
    // Neck shadow
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.beginPath();
    ctx.ellipse(0, -4, 18, 9, 0, 0, Math.PI);
    ctx.fill();
    ctx.restore();

    // Head group
    ctx.save();
    ctx.translate(0, -48 + breath * 0.7 + talkBob);
    ctx.rotate(headTilt);

    // Gaming Headset band (if streamer)
    if (hasHeadset) {
      ctx.strokeStyle = '#27272a';
      ctx.lineWidth = 10;
      ctx.beginPath();
      ctx.arc(0, -6, 56, Math.PI * 1.08, Math.PI * 1.92);
      ctx.stroke();
      ctx.strokeStyle = accentColor;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, -6, 59, Math.PI * 1.15, Math.PI * 1.85);
      ctx.stroke();
    }

    // Ears
    ctx.fillStyle = skinColor;
    ctx.beginPath();
    ctx.ellipse(-46, 2, 8, 14, -0.1, 0, Math.PI * 2);
    ctx.ellipse(46, 2, 8, 14, 0.1, 0, Math.PI * 2);
    ctx.fill();

    // Headset earcups
    if (hasHeadset) {
      ctx.fillStyle = '#18181b';
      drawRoundedRect(ctx, -58, -16, 16, 36, 7);
      ctx.fill();
      drawRoundedRect(ctx, 42, -16, 16, 36, 7);
      ctx.fill();
      ctx.strokeStyle = rimColor;
      ctx.lineWidth = 2.2;
      ctx.strokeRect(-55, -10, 10, 24);
      ctx.strokeRect(45, -10, 10, 24);
    }

    // Head base
    ctx.fillStyle = skinColor;
    drawRoundedRect(ctx, -44, -52, 88, 96, 38);
    ctx.fill();

    // Studio key/rim light shading on face
    const faceShadow = ctx.createLinearGradient(-44, -40, 44, 40);
    faceShadow.addColorStop(0, 'rgba(255,255,255,0.12)');
    faceShadow.addColorStop(0.55, 'rgba(0,0,0,0)');
    faceShadow.addColorStop(1, 'rgba(0,0,0,0.26)');
    ctx.fillStyle = faceShadow;
    drawRoundedRect(ctx, -44, -52, 88, 96, 38);
    ctx.fill();

    // Beard / Jaw contour
    if (hasBeard) {
      ctx.fillStyle = 'rgba(24, 24, 30, 0.78)';
      ctx.beginPath();
      ctx.moveTo(-43, 4);
      ctx.quadraticCurveTo(-42, 44, 0, 46);
      ctx.quadraticCurveTo(42, 44, 43, 4);
      ctx.quadraticCurveTo(34, 18, 20, 20);
      ctx.quadraticCurveTo(0, 14, -20, 20);
      ctx.quadraticCurveTo(-34, 18, -43, 4);
      ctx.closePath();
      ctx.fill();
    }

    // Hair
    ctx.fillStyle = hairColor;
    ctx.beginPath();
    ctx.moveTo(-45, -14);
    ctx.quadraticCurveTo(-48, -58, 0, -60);
    ctx.quadraticCurveTo(48, -58, 45, -14);
    ctx.quadraticCurveTo(32, -38, 0, -36);
    ctx.quadraticCurveTo(-32, -38, -45, -14);
    ctx.closePath();
    ctx.fill();

    // Eyebrows (expressive lift with speech)
    const browLift = isActive ? voiceLevel * 4.5 : 0;
    ctx.strokeStyle = hairColor;
    ctx.lineWidth = 3.8;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-28, -15 - browLift);
    ctx.quadraticCurveTo(-18, -20 - browLift, -8, -16 - browLift * 0.5);
    ctx.moveTo(8, -16 - browLift * 0.5);
    ctx.quadraticCurveTo(18, -20 - browLift, 28, -15 - browLift);
    ctx.stroke();

    // Eyes with periodic natural blinking
    const blinkCycle = (timeSec * 0.37) % 1;
    const isBlinking = blinkCycle > 0.94;
    const eyeLookX = Math.sin(timeSec * 0.9) * 1.8 * facing;
    if (isBlinking) {
      ctx.strokeStyle = '#1f1f28';
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      ctx.moveTo(-26, -5);
      ctx.lineTo(-10, -5);
      ctx.moveTo(10, -5);
      ctx.lineTo(26, -5);
      ctx.stroke();
    } else {
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.ellipse(-18, -5, 8.5, 5.5, 0, 0, Math.PI * 2);
      ctx.ellipse(18, -5, 8.5, 5.5, 0, 0, Math.PI * 2);
      ctx.fill();

      // Pupils
      ctx.fillStyle = '#18181b';
      ctx.beginPath();
      ctx.arc(-18 + eyeLookX, -5, 3.8, 0, Math.PI * 2);
      ctx.arc(18 + eyeLookX, -5, 3.8, 0, Math.PI * 2);
      ctx.fill();

      // Catchlights
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(-19.5 + eyeLookX, -6.5, 1.3, 0, Math.PI * 2);
      ctx.arc(16.5 + eyeLookX, -6.5, 1.3, 0, Math.PI * 2);
      ctx.fill();
    }

    // Designer Glasses (for founder breakdown)
    if (hasGlasses) {
      ctx.strokeStyle = '#e4e4e7';
      ctx.lineWidth = 2.2;
      drawRoundedRect(ctx, -31, -14, 25, 18, 4);
      ctx.stroke();
      drawRoundedRect(ctx, 6, -14, 25, 18, 4);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-6, -6);
      ctx.lineTo(6, -6);
      ctx.stroke();
      // Subtle screen reflection on lenses
      ctx.fillStyle = 'rgba(56, 189, 248, 0.14)';
      drawRoundedRect(ctx, -30, -13, 23, 16, 3);
      ctx.fill();
      drawRoundedRect(ctx, 7, -13, 23, 16, 3);
      ctx.fill();
    }

    // Nose
    ctx.strokeStyle = 'rgba(0,0,0,0.28)';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(0, -4);
    ctx.lineTo(-3 * facing, 9);
    ctx.lineTo(3, 11);
    ctx.stroke();

    // Animated Lip-Sync Mouth
    const mouthOpen = isActive ? clamp(voiceLevel * 14, 1.5, 13) : 1.5;
    const mouthWidth = isActive ? 11 + voiceLevel * 5 : 10;
    ctx.fillStyle = '#3b0d11';
    ctx.beginPath();
    ctx.ellipse(0, 24, mouthWidth, mouthOpen, 0, 0, Math.PI * 2);
    ctx.fill();

    // Upper teeth & tongue when mouth opens
    if (mouthOpen > 4) {
      ctx.fillStyle = '#f4f4f5';
      ctx.beginPath();
      ctx.rect(-mouthWidth * 0.7, 24 - mouthOpen * 0.85, mouthWidth * 1.4, 3.2);
      ctx.fill();

      ctx.fillStyle = '#e11d48';
      ctx.beginPath();
      ctx.ellipse(0, 24 + mouthOpen * 0.45, mouthWidth * 0.55, mouthOpen * 0.35, 0, 0, Math.PI);
      ctx.fill();
    }

    ctx.restore(); // End head

    // Expressive gesturing hand when actively speaking
    if (isActive) {
      const handX = 52 * facing + Math.sin(timeSec * 5.2) * 10;
      const handY = 58 - voiceLevel * 22 + Math.cos(timeSec * 6.4) * 6;
      ctx.fillStyle = skinColor;
      ctx.beginPath();
      ctx.ellipse(handX, handY, 13, 9, -0.3 * facing, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  /**
   * Renders a studio Shure SM7B / Broadcast Microphone on boom arm
   */
  function drawStudioMicrophone(ctx, x, y, scale, side, accentColor, voiceLevel) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale * side, scale);

    // Articulated boom arm
    ctx.strokeStyle = '#27272a';
    ctx.lineWidth = 8;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(95, 75);
    ctx.lineTo(35, 22);
    ctx.lineTo(6, 4);
    ctx.stroke();

    ctx.strokeStyle = '#52525b';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(90, 68);
    ctx.lineTo(35, 16);
    ctx.stroke();

    // Mic yoke mount
    ctx.strokeStyle = '#3f3f46';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(0, 0, 18, -0.4, Math.PI * 0.8);
    ctx.stroke();

    // Capsule body
    ctx.save();
    ctx.rotate(-0.28);
    ctx.fillStyle = '#18181b';
    drawRoundedRect(ctx, -34, -13, 46, 26, 12);
    ctx.fill();
    ctx.strokeStyle = '#3f3f46';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Foam windscreen cap
    ctx.fillStyle = '#09090b';
    drawRoundedRect(ctx, -50, -15, 24, 30, 14);
    ctx.fill();

    // Glowing audio reactive ring on mic
    ctx.strokeStyle = accentColor;
    ctx.globalAlpha = 0.45 + voiceLevel * 0.55;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(-24, -13);
    ctx.lineTo(-24, 13);
    ctx.stroke();
    ctx.restore();

    ctx.restore();
  }

  /**
   * Shared helper: Renders a live multi-segment studio VU meter + dB readout
   */
  function drawStudioVuMeter(ctx, x, y, w, h, voiceLevel, timeSec, accentColor) {
    ctx.save();
    ctx.fillStyle = 'rgba(9, 9, 13, 0.82)';
    drawRoundedRect(ctx, x, y, w, h, 8);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Label
    ctx.fillStyle = '#a1a1aa';
    ctx.font = '700 9px "Inter", system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('VU MASTER', x + 8, y + 13);

    const dbVal = (-18 + voiceLevel * 16.8).toFixed(1);
    ctx.fillStyle = voiceLevel > 0.82 ? '#ef4444' : accentColor;
    ctx.textAlign = 'right';
    ctx.fillText(`${dbVal} dB`, x + w - 8, y + 13);

    // Stereo LED bars (L & R)
    const bars = 18;
    const barStartX = x + 8;
    const barAreaW = w - 16;
    const barW = (barAreaW - (bars - 1) * 2) / bars;

    for (let ch = 0; ch < 2; ch++) {
      const chLevel = clamp(
        voiceLevel * (ch === 0 ? 1 : 0.94 + Math.sin(timeSec * 19) * 0.08),
        0.05,
        1
      );
      const activeBars = Math.round(chLevel * bars);
      const rowY = y + 19 + ch * 7;

      for (let i = 0; i < bars; i++) {
        const ratio = i / bars;
        let color = '#22c55e';
        if (ratio > 0.82) color = '#ef4444';
        else if (ratio > 0.62) color = '#eab308';

        ctx.fillStyle = i < activeBars ? color : 'rgba(255,255,255,0.08)';
        ctx.fillRect(barStartX + i * (barW + 2), rowY, barW, 4.5);
      }
    }
    ctx.restore();
  }

  /**
   * Shared helper: Renders lower-third broadcast overlay banner inside main video feed
   */
  function drawLowerThirdOverlay(ctx, rect, streamMeta, timeSec) {
    const padX = Math.max(12, rect.w * 0.04);
    const boxW = rect.w - padX * 2;
    const boxH = Math.min(54, Math.max(40, rect.h * 0.11));
    const boxX = rect.x + padX;
    const boxY = rect.y + rect.h - boxH - Math.max(10, rect.h * 0.03);

    ctx.save();
    // Glassmorphic dark banner
    const bgGrad = ctx.createLinearGradient(boxX, boxY, boxX + boxW, boxY + boxH);
    bgGrad.addColorStop(0, 'rgba(9, 9, 15, 0.88)');
    bgGrad.addColorStop(1, 'rgba(18, 18, 28, 0.78)');
    ctx.fillStyle = bgGrad;
    drawRoundedRect(ctx, boxX, boxY, boxW, boxH, 10);
    ctx.fill();

    // Accent left pill bar
    ctx.fillStyle = streamMeta.accent;
    drawRoundedRect(ctx, boxX, boxY, 5, boxH, 3);
    ctx.fill();

    ctx.strokeStyle = 'rgba(255,255,255,0.14)';
    ctx.lineWidth = 1;
    drawRoundedRect(ctx, boxX, boxY, boxW, boxH, 10);
    ctx.stroke();

    // Pulsing live dot + subtitle
    const pulse = 0.5 + 0.5 * Math.sin(timeSec * 6);
    ctx.fillStyle = streamMeta.accent;
    ctx.beginPath();
    ctx.arc(boxX + 16, boxY + 14, 3.5 + pulse * 1.2, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#d4d4d8';
    ctx.font = '700 9px "Inter", system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(streamMeta.subtitle, boxX + 25, boxY + 17);

    // Main episode/stream topic title (clipped neatly)
    ctx.fillStyle = '#ffffff';
    const titleFontPx = Math.max(10, Math.min(13, Math.floor(rect.w * 0.028)));
    ctx.font = `700 ${titleFontPx}px "Inter", system-ui, sans-serif`;
    const maxChars = Math.floor((boxW - 28) / (titleFontPx * 0.52));
    const titleText =
      streamMeta.title.length > maxChars
        ? streamMeta.title.slice(0, Math.max(18, maxChars - 1)) + '…'
        : streamMeta.title;
    ctx.fillText(titleText, boxX + 14, boxY + boxH - 11);

    ctx.restore();
  }

  // ============================================================================
  // 1. DEMO MAIN VIDEO FEEDS
  // ============================================================================

  function renderPodcastMillionaire(ctx, rect, timeSec, state, voiceLevel) {
    const { x, y, w, h } = rect;
    const streamMeta = DEMO_STREAMS[0];

    // Background acoustic foam studio wall
    const bgGrad = ctx.createLinearGradient(x, y, x, y + h);
    bgGrad.addColorStop(0, '#120d10');
    bgGrad.addColorStop(0.5, '#1b1216');
    bgGrad.addColorStop(1, '#0b080c');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(x, y, w, h);

    // Acoustic pyramid foam grid pattern
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.035)';
    ctx.lineWidth = 1;
    const cellSize = 28;
    for (let gx = x; gx < x + w; gx += cellSize) {
      for (let gy = y; gy < y + h * 0.78; gy += cellSize) {
        ctx.strokeRect(gx, gy, cellSize - 2, cellSize - 2);
      }
    }

    // Warm tungsten key light + orange neon tube strips
    const leftGlow = ctx.createRadialGradient(
      x + w * 0.22,
      y + h * 0.25,
      10,
      x + w * 0.22,
      y + h * 0.25,
      w * 0.55
    );
    leftGlow.addColorStop(0, 'rgba(255, 87, 34, 0.26)');
    leftGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = leftGlow;
    ctx.fillRect(x, y, w, h);

    const rightGlow = ctx.createRadialGradient(
      x + w * 0.78,
      y + h * 0.28,
      10,
      x + w * 0.78,
      y + h * 0.28,
      w * 0.5
    );
    rightGlow.addColorStop(0, 'rgba(255, 179, 0, 0.2)');
    rightGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = rightGlow;
    ctx.fillRect(x, y, w, h);

    // Glowing vertical LED tube lights on studio wall
    const tubeY1 = y + h * 0.1;
    const tubeY2 = y + h * 0.62;
    [x + w * 0.08, x + w * 0.92].forEach((tx, idx) => {
      ctx.save();
      ctx.strokeStyle = idx === 0 ? '#ff5722' : '#ffb300';
      ctx.shadowColor = idx === 0 ? '#ff5722' : '#ffb300';
      ctx.shadowBlur = 14;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(tx, tubeY1);
      ctx.lineTo(tx, tubeY2);
      ctx.stroke();
      ctx.restore();
    });

    // Center Neon "WHOP PODCAST // $12K/MO" wall plaque
    const plaqueW = Math.min(200, w * 0.44);
    const plaqueH = 32;
    const plaqueX = x + (w - plaqueW) / 2;
    const plaqueY = y + h * 0.08;
    ctx.fillStyle = 'rgba(15, 12, 18, 0.85)';
    drawRoundedRect(ctx, plaqueX, plaqueY, plaqueW, plaqueH, 8);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 87, 34, 0.55)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = '#ff7043';
    ctx.font = '800 10px "Inter", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('WHOP CLIPPERS STUDIO • ON AIR', x + w * 0.5, plaqueY + 20);

    // Determine active speaker based on phrase cadence
    const activeHost = Math.floor(timeSec / 4.5) % 2; // Alternates between Host 0 (left) and Host 1 (right)
    const avatarScale = Math.min(w / 340, h / 320) * 0.88;
    const speakerY = y + h * 0.56;

    // Host 1 (Left - Alex)
    drawAnimatedSpeaker(ctx, {
      cx: x + w * 0.3,
      cy: speakerY,
      scale: avatarScale * (activeHost === 0 ? 1.04 : 0.95),
      timeSec,
      voiceLevel: activeHost === 0 ? voiceLevel : 0.05,
      skinColor: '#e2ab87',
      hairColor: '#18181b',
      shirtColor: '#111827',
      rimColor: '#ff5722',
      accentColor: '#ffb300',
      hasBeard: true,
      isActive: activeHost === 0,
      facing: 1
    });

    // Host 2 (Right - Marcus)
    drawAnimatedSpeaker(ctx, {
      cx: x + w * 0.72,
      cy: speakerY,
      scale: avatarScale * (activeHost === 1 ? 1.04 : 0.95),
      timeSec: timeSec + 1.7,
      voiceLevel: activeHost === 1 ? voiceLevel : 0.05,
      skinColor: '#c6865c',
      hairColor: '#09090b',
      shirtColor: '#27171c',
      rimColor: '#ffb300',
      accentColor: '#ff5722',
      hasBeard: true,
      isActive: activeHost === 1,
      facing: -1
    });

    // Mahogany Podcast Table across lower foreground
    const deskY = y + h * 0.72;
    const deskGrad = ctx.createLinearGradient(x, deskY, x, y + h);
    deskGrad.addColorStop(0, '#2a1812');
    deskGrad.addColorStop(0.18, '#1a0f0c');
    deskGrad.addColorStop(1, '#090607');
    ctx.fillStyle = deskGrad;
    ctx.fillRect(x, deskY, w, y + h - deskY);

    ctx.strokeStyle = 'rgba(255, 179, 0, 0.35)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, deskY);
    ctx.lineTo(x + w, deskY);
    ctx.stroke();

    // Two Shure SM7B Microphones on boom arms
    drawStudioMicrophone(
      ctx,
      x + w * 0.38,
      y + h * 0.56,
      avatarScale * 0.85,
      -1,
      '#ff5722',
      activeHost === 0 ? voiceLevel : 0.1
    );
    drawStudioMicrophone(
      ctx,
      x + w * 0.62,
      y + h * 0.56,
      avatarScale * 0.85,
      1,
      '#ffb300',
      activeHost === 1 ? voiceLevel : 0.1
    );

    // Active Speaker Framing Tag + VU Meter
    const vuW = Math.min(132, w * 0.36);
    drawStudioVuMeter(ctx, x + 12, y + 12, vuW, 36, voiceLevel, timeSec, '#ff5722');

    // Active cam indicator pill top-right
    ctx.fillStyle = 'rgba(9, 9, 13, 0.82)';
    drawRoundedRect(ctx, x + w - 118, y + 12, 106, 26, 13);
    ctx.fill();
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.arc(x + w - 103, y + 25, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f4f4f5';
    ctx.font = '700 10px "Inter", system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(activeHost === 0 ? 'CAM A • ALEX' : 'CAM B • MARCUS', x + w - 93, y + 28);

    // Lower third topic overlay
    drawLowerThirdOverlay(ctx, rect, streamMeta, timeSec);
  }

  function renderStreamerAlpha(ctx, rect, timeSec, state, voiceLevel) {
    const { x, y, w, h } = rect;
    const streamMeta = DEMO_STREAMS[1];

    // Dark cyber streamer bedroom background
    const bgGrad = ctx.createLinearGradient(x, y, x + w, y + h);
    bgGrad.addColorStop(0, '#070714');
    bgGrad.addColorStop(0.5, '#120924');
    bgGrad.addColorStop(1, '#051329');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(x, y, w, h);

    // Animated RGB LED Ceiling Strip & Nanoleaf Hexagons on wall
    const hueShift = (timeSec * 45) % 360;
    const ledGrad = ctx.createLinearGradient(x, y, x + w, y);
    ledGrad.addColorStop(0, `hsl(${hueShift}, 95%, 55%)`);
    ledGrad.addColorStop(0.5, `hsl(${(hueShift + 110) % 360}, 95%, 55%)`);
    ledGrad.addColorStop(1, `hsl(${(hueShift + 220) % 360}, 95%, 55%)`);
    ctx.fillStyle = ledGrad;
    ctx.fillRect(x, y, w, 5);

    // Glowing RGB Nanoleaf triangles/hexagons on back wall
    const hexCenters = [
      [0.18, 0.22],
      [0.25, 0.16],
      [0.32, 0.22],
      [0.25, 0.28],
      [0.78, 0.18],
      [0.85, 0.24]
    ];
    hexCenters.forEach(([rx, ry], idx) => {
      const hx = x + w * rx;
      const hy = y + h * ry;
      const r = Math.min(w, h) * 0.048;
      const hColor = `hsl(${(hueShift + idx * 45) % 360}, 92%, 58%)`;
      ctx.save();
      ctx.strokeStyle = hColor;
      ctx.fillStyle = `hsla(${(hueShift + idx * 45) % 360}, 92%, 50%, 0.18)`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let s = 0; s < 6; s++) {
        const ang = (s * Math.PI) / 3;
        const px = hx + Math.cos(ang) * r;
        const py = hy + Math.sin(ang) * r;
        if (s === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    });

    // Racing Gaming Chair silhouette behind streamer
    const chairX = x + w * 0.44;
    const chairY = y + h * 0.52;
    const avatarScale = Math.min(w / 320, h / 300) * 0.96;
    ctx.save();
    ctx.translate(chairX, chairY);
    ctx.scale(avatarScale, avatarScale);
    ctx.fillStyle = '#181824';
    drawRoundedRect(ctx, -78, -95, 156, 200, 28);
    ctx.fill();
    ctx.strokeStyle = '#00f2fe';
    ctx.lineWidth = 3.5;
    drawRoundedRect(ctx, -72, -88, 144, 188, 24);
    ctx.stroke();
    ctx.restore();

    // Animated Streamer Avatar with RGB Headset
    drawAnimatedSpeaker(ctx, {
      cx: chairX,
      cy: chairY + 12,
      scale: avatarScale,
      timeSec,
      voiceLevel,
      skinColor: '#eab696',
      hairColor: '#111827',
      shirtColor: '#1e1b4b',
      rimColor: '#00f2fe',
      accentColor: '#ff0844',
      hasHeadset: true,
      hasBeard: false,
      isActive: true,
      facing: 1
    });

    // Glowing Red HyperX QuadCast-style Mic in foreground
    drawStudioMicrophone(
      ctx,
      chairX - 55 * avatarScale,
      chairY + 18 * avatarScale,
      avatarScale * 0.92,
      1,
      '#ff0844',
      voiceLevel
    );

    // Live scrolling Stream Chat Box overlay on right side
    const chatW = Math.min(148, w * 0.34);
    const chatH = Math.min(130, h * 0.34);
    const chatX = x + w - chatW - 10;
    const chatY = y + 44;

    ctx.save();
    ctx.fillStyle = 'rgba(8, 8, 18, 0.76)';
    drawRoundedRect(ctx, chatX, chatY, chatW, chatH, 10);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0, 242, 254, 0.32)';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = '#00f2fe';
    ctx.font = '800 9px "Inter", system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('LIVE CHAT • 14.8K', chatX + 8, chatY + 14);

    const chatMessages = [
      { u: 'clipgod99', c: '#4ade80', m: 'THIS HOOK IS INSANE 🔥' },
      { u: 'whop_king', c: '#f97316', m: '$12k/mo from shorts?!' },
      { u: 'editor_x', c: '#38bdf8', m: 'W SAUCE DROP' },
      { u: 'viral_kai', c: '#f43f5e', m: 'CLIP THAT RIGHT NOW!!' },
      { u: 'sniper_fx', c: '#eab308', m: '100% retention hack' },
      { u: 'nyx_media', c: '#c084fc', m: 'BOUNTY CLAIMED 💰' }
    ];

    const scrollIdx = Math.floor(timeSec * 2.2);
    for (let i = 0; i < 4; i++) {
      const msg = chatMessages[(scrollIdx + i) % chatMessages.length];
      const my = chatY + 30 + i * 23;
      ctx.fillStyle = msg.c;
      ctx.font = '700 8.5px "Inter", system-ui, sans-serif';
      ctx.fillText(msg.u + ':', chatX + 8, my);
      ctx.fillStyle = '#f4f4f5';
      ctx.font = '500 8.5px "Inter", system-ui, sans-serif';
      ctx.fillText(msg.m, chatX + 8, my + 10);
    }
    ctx.restore();

    // Top-left VU meter + Viewer count pill
    const vuW = Math.min(132, w * 0.36);
    drawStudioVuMeter(ctx, x + 12, y + 12, vuW, 36, voiceLevel, timeSec, '#00f2fe');

    // Lower third topic overlay
    drawLowerThirdOverlay(ctx, rect, streamMeta, timeSec);
  }

  function renderFounderBreakdown(ctx, rect, timeSec, state, voiceLevel) {
    const { x, y, w, h } = rect;
    const streamMeta = DEMO_STREAMS[2];

    // Clean dark Apple/Linear keynote studio
    const bgGrad = ctx.createLinearGradient(x, y, x, y + h);
    bgGrad.addColorStop(0, '#060a0e');
    bgGrad.addColorStop(0.6, '#0b131e');
    bgGrad.addColorStop(1, '#05070b');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(x, y, w, h);

    // Subtle architectural dot grid
    ctx.fillStyle = 'rgba(16, 185, 129, 0.12)';
    for (let gx = x + 20; gx < x + w; gx += 26) {
      for (let gy = y + 20; gy < y + h * 0.75; gy += 26) {
        ctx.fillRect(gx, gy, 1.5, 1.5);
      }
    }

    // Interactive Floating Retention Graph Telemetry Card on right side of studio
    const cardW = Math.min(210, w * 0.48);
    const cardH = Math.min(130, h * 0.36);
    const cardX = x + w - cardW - Math.max(12, w * 0.04);
    const cardY = y + h * 0.16;

    ctx.save();
    ctx.fillStyle = 'rgba(9, 14, 23, 0.88)';
    drawRoundedRect(ctx, cardX, cardY, cardW, cardH, 12);
    ctx.fill();
    ctx.strokeStyle = 'rgba(16, 185, 129, 0.4)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = '#10b981';
    ctx.font = '800 9px "Inter", system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('3-SEC RETENTION TELEMETRY', cardX + 12, cardY + 18);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '600 8px "Inter", system-ui, sans-serif';
    ctx.fillText('WHOP B-ROLL SPLIT VS RAW', cardX + 12, cardY + 30);

    // Plot area
    const gx = cardX + 12;
    const gy = cardY + 38;
    const gw = cardW - 24;
    const gh = cardH - 52;

    // Red curve: 99% editors failing in 3 seconds
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i <= 24; i++) {
      const t = i / 24;
      const px = gx + t * gw;
      const drop = Math.pow(1 - t, 2.8) * 0.75 + 0.12;
      const py = gy + gh * (1 - drop);
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();

    // Emerald curve: Whop Split-Screen Hook (84% hold)
    ctx.strokeStyle = '#10b981';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    const scanT = (timeSec % 5) / 5;
    for (let i = 0; i <= 24; i++) {
      const t = i / 24;
      const px = gx + t * gw;
      const hold = 0.92 - t * 0.14 + Math.sin(t * 8 + timeSec * 2) * 0.03;
      const py = gy + gh * (1 - hold);
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();

    // Animated scan playhead on graph
    const playX = gx + scanT * gw;
    ctx.strokeStyle = 'rgba(255,255,255,0.45)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(playX, gy);
    ctx.lineTo(playX, gy + gh);
    ctx.stroke();

    ctx.fillStyle = '#10b981';
    ctx.font = '700 9px "Inter", system-ui, sans-serif';
    ctx.fillText('84% HOLD', gx + gw - 52, gy + 14);
    ctx.fillStyle = '#ef4444';
    ctx.fillText('19% RAW', gx + gw - 50, gy + gh - 4);
    ctx.restore();

    // Founder Speaker on left-center with glasses
    const avatarScale = Math.min(w / 320, h / 300) * 0.95;
    const founderX = x + w * 0.31;
    const founderY = y + h * 0.55;

    drawAnimatedSpeaker(ctx, {
      cx: founderX,
      cy: founderY,
      scale: avatarScale,
      timeSec,
      voiceLevel,
      skinColor: '#dfb191',
      hairColor: '#1f2937',
      shirtColor: '#0f172a',
      rimColor: '#10b981',
      accentColor: '#6366f1',
      hasGlasses: true,
      hasBeard: true,
      isActive: true,
      facing: 1
    });

    // Sleek Low-Profile Studio Mic
    drawStudioMicrophone(
      ctx,
      founderX + 52 * avatarScale,
      founderY + 18 * avatarScale,
      avatarScale * 0.85,
      -1,
      '#10b981',
      voiceLevel
    );

    // Top-left VU meter
    const vuW = Math.min(132, w * 0.36);
    drawStudioVuMeter(ctx, x + 12, y + 12, vuW, 36, voiceLevel, timeSec, '#10b981');

    // Lower third topic overlay
    drawLowerThirdOverlay(ctx, rect, streamMeta, timeSec);
  }

  function renderMrBeastInterview(ctx, rect, timeSec, state, voiceLevel) {
    const { x, y, w, h } = rect;
    const streamMeta = DEMO_STREAMS.find((s) => s.id === 'mrbeast-interview') || {
      name: 'The Full Story of MrBeast',
      title: '72 Hours with MrBeast (Colin and Samir Interview)',
      subtitle: 'MRBEAST STUDIO • 100M CREATOR INTERVIEW',
      accent: '#00e5ff',
      secondaryAccent: '#ff007f',
      badge: 'MRBEAST 4K'
    };

    // Dark sleek high-production studio background with neon blue & magenta ambient backlight
    const bgGrad = ctx.createLinearGradient(x, y, x, y + h);
    bgGrad.addColorStop(0, '#060a14');
    bgGrad.addColorStop(0.5, '#0c1527');
    bgGrad.addColorStop(1, '#050811');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(x, y, w, h);

    // Ambient Neon Blue/Cyan Light Glow behind MrBeast (right)
    const glowRad = Math.min(w, h) * 0.44;
    const glowGrad = ctx.createRadialGradient(x + w * 0.72, y + h * 0.35, 10, x + w * 0.72, y + h * 0.35, glowRad);
    glowGrad.addColorStop(0, 'rgba(0, 229, 255, 0.22)');
    glowGrad.addColorStop(0.6, 'rgba(0, 160, 255, 0.08)');
    glowGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = glowGrad;
    ctx.beginPath();
    ctx.arc(x + w * 0.72, y + h * 0.35, glowRad, 0, Math.PI * 2);
    ctx.fill();

    // Ambient Magenta Light Glow behind Colin & Samir (left)
    const glowLeft = ctx.createRadialGradient(x + w * 0.28, y + h * 0.35, 10, x + w * 0.28, y + h * 0.35, glowRad);
    glowLeft.addColorStop(0, 'rgba(255, 0, 127, 0.18)');
    glowLeft.addColorStop(0.6, 'rgba(255, 0, 127, 0.05)');
    glowLeft.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = glowLeft;
    ctx.beginPath();
    ctx.arc(x + w * 0.28, y + h * 0.35, glowRad, 0, Math.PI * 2);
    ctx.fill();

    // 100M Play Button plaque on back studio wall
    const plaqueW = Math.min(w * 0.18, 70);
    const plaqueH = plaqueW * 1.25;
    const plaqueX = x + w * 0.5 - plaqueW * 0.5;
    const plaqueY = y + h * 0.16;
    ctx.save();
    ctx.fillStyle = '#0f172a';
    ctx.strokeStyle = '#00e5ff';
    ctx.lineWidth = 1.8;
    drawRoundedRect(ctx, plaqueX, plaqueY, plaqueW, plaqueH, 6);
    ctx.fill();
    ctx.stroke();

    // Red Diamond YouTube Triangle inside plaque
    ctx.fillStyle = '#ff0033';
    ctx.beginPath();
    const triX = plaqueX + plaqueW * 0.5;
    const triY = plaqueY + plaqueH * 0.45;
    const triS = plaqueW * 0.28;
    ctx.moveTo(triX - triS * 0.5, triY - triS * 0.6);
    ctx.lineTo(triX + triS * 0.6, triY);
    ctx.lineTo(triX - triS * 0.5, triY + triS * 0.6);
    ctx.closePath();
    ctx.fill();

    // "100M" text on plaque
    ctx.fillStyle = '#f8fafc';
    ctx.font = `bold ${Math.max(8, plaqueW * 0.22)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('100M', triX, plaqueY + plaqueH * 0.85);
    ctx.restore();

    // Studio Sound Acoustic Foam Wall Panels
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
    ctx.lineWidth = 1;
    const slatStep = Math.max(12, w * 0.045);
    for (let sx = x + 10; sx < x + w - 10; sx += slatStep) {
      ctx.beginPath();
      ctx.moveTo(sx, y + h * 0.05);
      ctx.lineTo(sx, y + h * 0.55);
      ctx.stroke();
    }

    // Heavy Studio Podcast Desk
    const deskY = y + h * 0.58;
    const deskH = h * 0.42;
    const deskGrad = ctx.createLinearGradient(x, deskY, x, deskY + deskH);
    deskGrad.addColorStop(0, '#151b2e');
    deskGrad.addColorStop(0.12, '#0d111d');
    deskGrad.addColorStop(1, '#05070c');
    ctx.fillStyle = deskGrad;
    ctx.fillRect(x, deskY, w, deskH);

    // Desk Edge Highlight (Cyan / Blue Neon Trim)
    ctx.strokeStyle = '#00e5ff';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(x, deskY);
    ctx.lineTo(x + w, deskY);
    ctx.stroke();

    // Dynamic Speaker Switch: Host vs MrBeast
    const isMrBeastSpeaking = voiceLevel > 0.12;
    const hostActive = !isMrBeastSpeaking;
    const avatarScale = Math.min(w / 340, h / 320) * 0.94;

    // LEFT: Colin & Samir (Interviewer)
    const hostX = x + w * 0.28;
    const hostY = y + h * 0.54;
    drawSpeakerAvatar(ctx, hostX, hostY, avatarScale * 0.92, timeSec, hostActive ? voiceLevel : 0.05, {
      skinTone: '#f3c49e',
      hairColor: '#2b1d0c',
      shirtColor: '#1e293b',
      accentColor: '#ff007f',
      hasGlasses: true,
      hasBeard: true,
      isActive: hostActive,
      facing: 1
    });

    // RIGHT: Jimmy Donaldson (MrBeast)
    const beastX = x + w * 0.72;
    const beastY = y + h * 0.54;
    drawSpeakerAvatar(ctx, beastX, beastY, avatarScale, timeSec, isMrBeastSpeaking ? voiceLevel : 0.05, {
      skinTone: '#fcd3b0',
      hairColor: '#4a3728',
      shirtColor: '#0284c7', // MrBeast Blue Hoodie / Tee
      accentColor: '#00e5ff',
      hasGlasses: false,
      hasBeard: true,
      isActive: isMrBeastSpeaking,
      facing: -1
    });

    // Studio Shure SM7B Mic in front of MrBeast
    drawStudioMicrophone(
      ctx,
      beastX - 32 * avatarScale,
      beastY + 8 * avatarScale,
      avatarScale,
      1,
      '#00e5ff',
      isMrBeastSpeaking ? voiceLevel : 0.05
    );

    // Studio Shure SM7B Mic in front of Colin & Samir
    drawStudioMicrophone(
      ctx,
      hostX + 32 * avatarScale,
      hostY + 12 * avatarScale,
      avatarScale * 0.9,
      -1,
      '#ff007f',
      hostActive ? voiceLevel : 0.05
    );

    // Top-left Studio VU Meter
    const vuW = Math.min(136, w * 0.36);
    drawStudioVuMeter(ctx, x + 12, y + 12, vuW, 36, voiceLevel, timeSec, '#00e5ff');

    // Lower third topic overlay
    drawLowerThirdOverlay(ctx, rect, streamMeta, timeSec);
  }

  /**
   * Public API 1: Render Demo Main Video Feed
   * @param {CanvasRenderingContext2D} ctx
   * @param {{x:number, y:number, w:number, h:number}} rect
   * @param {number} timeSec
   * @param {string} presetId
   * @param {object} [state]
   */
  function renderDemoMainFeed(ctx, rect, timeSec = 0, presetId = 'podcast-millionaire', state = {}) {
    if (!ctx) return;
    const r = normalizeRect(ctx, rect);
    const t = Number.isFinite(timeSec) ? timeSec : 0;
    const voiceLevel =
      state && typeof state.voiceLevel === 'number'
        ? clamp(state.voiceLevel, 0.04, 1)
        : getSpeechEnvelope(t, presetId);

    ctx.save();
    ctx.beginPath();
    ctx.rect(r.x, r.y, r.w, r.h);
    ctx.clip();

    // Dynamic camera punch-in zoom on emphasis beats or when zoomPunch is enabled
    const zoomEnabled = state && state.autoZoom !== false;
    const beatCycle = Math.sin(t * 1.85);
    const punchBoost = zoomEnabled && beatCycle > 0.65 ? (beatCycle - 0.65) * 0.22 : 0;
    const manualZoom = state && typeof state.zoom === 'number' ? state.zoom : 1;
    const totalZoom = clamp(manualZoom + punchBoost + voiceLevel * 0.025, 1, 1.25);

    if (totalZoom > 1.001) {
      const cx = r.x + r.w * 0.5;
      const cy = r.y + r.h * 0.48;
      ctx.translate(cx, cy);
      ctx.scale(totalZoom, totalZoom);
      ctx.translate(-cx, -cy);
    }

    const id = String(presetId || 'podcast-millionaire').toLowerCase();
    if (id.includes('beast') || id.includes('mrbeast') || id.includes('c8vcunz3nvc')) {
      renderMrBeastInterview(ctx, r, t, state, voiceLevel);
    } else if (id.includes('streamer')) {
      renderStreamerAlpha(ctx, r, t, state, voiceLevel);
    } else if (id.includes('founder') || id.includes('saas')) {
      renderFounderBreakdown(ctx, r, t, state, voiceLevel);
    } else {
      renderPodcastMillionaire(ctx, r, t, state, voiceLevel);
    }

    ctx.restore();
  }

  // ============================================================================
  // 2. SIX PROCEDURAL 60FPS SATISFYING B-ROLL ENGINES
  // ============================================================================

  /**
   * B-Roll 1: Minecraft Sky Parkour
   * 3D perspective voxel sky-parkour blocks, jumping camera bob, clouds, sprint FOV, XP bar & hearts.
   */
  function renderMinecraftParkour(ctx, r, timeSec) {
    const { x, y, w, h } = r;

    // Sky gradient
    const skyGrad = ctx.createLinearGradient(x, y, x, y + h);
    skyGrad.addColorStop(0, '#1d4ed8');
    skyGrad.addColorStop(0.55, '#60a5fa');
    skyGrad.addColorStop(1, '#dbeafe');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(x, y, w, h);

    // Jump physics cycle: 1.8 jumps per second
    const speed = 3.2;
    const progress = timeSec * speed;
    const jumpPhase = progress % 1;
    const jumpArc = 4 * jumpPhase * (1 - jumpPhase); // 0 -> 1 -> 0 parabola
    const camRoll = Math.sin(progress * Math.PI) * 0.025;

    // Blocky voxel sun
    const sunSize = Math.min(w, h) * 0.11;
    ctx.fillStyle = '#fef08a';
    ctx.fillRect(x + w * 0.76, y + h * 0.08 + jumpArc * 8, sunSize, sunSize);
    ctx.fillStyle = 'rgba(254, 240, 138, 0.25)';
    ctx.fillRect(x + w * 0.76 - 6, y + h * 0.08 + jumpArc * 8 - 6, sunSize + 12, sunSize + 12);

    // Drifting voxel clouds
    ctx.fillStyle = 'rgba(255, 255, 255, 0.82)';
    for (let c = 0; c < 6; c++) {
      const cx = x + ((c * 130 - timeSec * 22) % (w + 140) + (w + 140)) % (w + 140) - 70;
      const cy = y + h * (0.12 + (c % 3) * 0.07) + jumpArc * 6;
      ctx.fillRect(cx, cy, 68, 16);
      ctx.fillRect(cx + 12, cy - 8, 42, 8);
    }

    // 3D Perspective Voxel Parkour Blocks
    const vpX = x + w * 0.5 + Math.sin(timeSec * 1.4) * (w * 0.06);
    const vpY = y + h * 0.34 + jumpArc * (h * 0.08);

    ctx.save();
    ctx.translate(vpX, vpY);
    ctx.rotate(camRoll);

    const baseBlockIdx = Math.floor(progress);
    // Draw from farthest block to nearest block (painter's algorithm)
    for (let i = 10; i >= 0; i--) {
      const blockNum = baseBlockIdx + i;
      const zDist = i - jumpPhase + 0.85;
      if (zDist <= 0.25) continue;

      const persp = 1 / zDist;
      // Winding path offset
      const laneOffset = Math.sin(blockNum * 0.85) * (w * 0.28);
      const stepHeightOffset = Math.cos(blockNum * 0.6) * (h * 0.06);

      const bx = laneOffset * persp;
      const by = (h * 0.34 + stepHeightOffset - jumpArc * (h * 0.14)) * persp;
      const bw = Math.max(12, w * 0.22 * persp);
      const bh = Math.max(10, bw * 0.72);
      const topDepth = bh * 0.38;

      // Choose block type (Grass, Gold, Diamond, Quartz)
      const type = blockNum % 5;
      let topColor = '#4ade80';
      let frontColor = '#854d0e';
      let sideColor = '#713f12';
      let trimColor = '#22c55e';

      if (type === 2) {
        // Gold block
        topColor = '#facc15';
        frontColor = '#eab308';
        sideColor = '#ca8a04';
        trimColor = '#fef08a';
      } else if (type === 4) {
        // Diamond block
        topColor = '#67e8f9';
        frontColor = '#06b6d4';
        sideColor = '#0891b2';
        trimColor = '#cffafe';
      }

      // Draw Top Face
      ctx.fillStyle = topColor;
      ctx.beginPath();
      ctx.moveTo(bx - bw * 0.5, by);
      ctx.lineTo(bx + bw * 0.5, by);
      ctx.lineTo(bx + bw * 0.38, by - topDepth);
      ctx.lineTo(bx - bw * 0.38, by - topDepth);
      ctx.closePath();
      ctx.fill();

      // Front Face
      ctx.fillStyle = frontColor;
      ctx.fillRect(bx - bw * 0.5, by, bw, bh);

      // Grass trim on front face
      ctx.fillStyle = trimColor;
      ctx.fillRect(bx - bw * 0.5, by, bw, Math.max(3, bh * 0.22));

      // Right 3D Side Face when block is left of center (or left side when right)
      ctx.fillStyle = sideColor;
      if (bx < 0) {
        ctx.beginPath();
        ctx.moveTo(bx + bw * 0.5, by);
        ctx.lineTo(bx + bw * 0.38, by - topDepth);
        ctx.lineTo(bx + bw * 0.38, by - topDepth + bh);
        ctx.lineTo(bx + bw * 0.5, by + bh);
        ctx.closePath();
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.moveTo(bx - bw * 0.5, by);
        ctx.lineTo(bx - bw * 0.38, by - topDepth);
        ctx.lineTo(bx - bw * 0.38, by - topDepth + bh);
        ctx.lineTo(bx - bw * 0.5, by + bh);
        ctx.closePath();
        ctx.fill();
      }

      // Crisp voxel outline
      ctx.strokeStyle = 'rgba(0,0,0,0.32)';
      ctx.lineWidth = 1.2;
      ctx.strokeRect(bx - bw * 0.5, by, bw, bh);
    }

    // Sprint FOV speed lines around edges
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.28)';
    ctx.lineWidth = 1.5;
    for (let s = 0; s < 10; s++) {
      const ang = (s / 10) * Math.PI * 2 + timeSec * 0.5;
      const r1 = Math.min(w, h) * 0.32;
      const r2 = Math.min(w, h) * (0.48 + ((timeSec * 4 + s * 0.3) % 0.2));
      ctx.beginPath();
      ctx.moveTo(Math.cos(ang) * r1, Math.sin(ang) * r1);
      ctx.lineTo(Math.cos(ang) * r2, Math.sin(ang) * r2);
      ctx.stroke();
    }
    ctx.restore();

    // First-person held Diamond Sword bobbing in bottom-right
    const handX = x + w * 0.82 + Math.sin(progress * Math.PI) * 10;
    const handY = y + h * 0.78 + Math.abs(Math.cos(progress * Math.PI)) * 12;
    ctx.save();
    ctx.translate(handX, handY);
    ctx.rotate(-0.45 + Math.sin(progress * Math.PI) * 0.12);
    ctx.fillStyle = '#0891b2';
    ctx.fillRect(-6, -48, 12, 42);
    ctx.fillStyle = '#67e8f9';
    ctx.fillRect(-3, -44, 6, 36);
    ctx.fillStyle = '#78350f';
    ctx.fillRect(-14, -8, 28, 6);
    ctx.fillRect(-4, -2, 8, 16);
    ctx.restore();

    // Authentic Minecraft HUD at bottom (Hearts, XP Level, XP Bar, Hotbar)
    const hudW = Math.min(w * 0.84, 260);
    const hudX = x + (w - hudW) / 2;
    const hudY = y + h - 42;

    // Hearts row
    for (let hIdx = 0; hIdx < 8; hIdx++) {
      const hx = hudX + hIdx * 13;
      const hy = hudY - 12;
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(hx, hy, 10, 9);
      ctx.fillStyle = '#fca5a5';
      ctx.fillRect(hx + 1, hy + 1, 3, 3);
    }

    // XP Bar
    ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
    ctx.fillRect(hudX, hudY, hudW, 7);
    const xpFill = ((timeSec * 0.25) % 1) * hudW;
    ctx.fillStyle = '#84cc16';
    ctx.fillRect(hudX, hudY, xpFill, 7);

    // XP Level number
    ctx.fillStyle = '#bef264';
    ctx.font = '800 11px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('42', x + w * 0.5, hudY - 3);

    // Hotbar slots
    const slots = 9;
    const slotSize = hudW / slots;
    ctx.fillStyle = 'rgba(15, 23, 42, 0.78)';
    ctx.fillRect(hudX, hudY + 10, hudW, 22);
    for (let s = 0; s < slots; s++) {
      ctx.strokeStyle = s === 0 ? '#f8fafc' : 'rgba(255,255,255,0.25)';
      ctx.lineWidth = s === 0 ? 2 : 1;
      ctx.strokeRect(hudX + s * slotSize, hudY + 10, slotSize, 22);
    }
  }

  /**
   * B-Roll 2: Subway Neon Runner
   * 3-lane neon hoverboard/train runner with oncoming trains, spinning gold coins, lane switches.
   */
  function renderSubwayRunner(ctx, r, timeSec) {
    const { x, y, w, h } = r;

    // Night cyber-tunnel sky
    const bgGrad = ctx.createLinearGradient(x, y, x, y + h);
    bgGrad.addColorStop(0, '#090518');
    bgGrad.addColorStop(0.35, '#1e103c');
    bgGrad.addColorStop(0.36, '#141229');
    bgGrad.addColorStop(1, '#090814');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(x, y, w, h);

    const vpX = x + w * 0.5;
    const vpY = y + h * 0.28;
    const groundH = y + h - vpY;

    // Glowing overhead neon tunnel arches rushing forward
    for (let a = 0; a < 7; a++) {
      const z = ((a - (timeSec * 2.8) % 1) + 7) % 7;
      if (z < 0.3) continue;
      const p = 1 / z;
      const archW = w * 0.9 * p;
      const archH = h * 0.35 * p;
      ctx.strokeStyle = a % 2 === 0 ? 'rgba(56, 189, 248, 0.38)' : 'rgba(244, 63, 94, 0.38)';
      ctx.lineWidth = Math.max(1, 3 * p);
      ctx.strokeRect(vpX - archW * 0.5, vpY - archH, archW, archH + groundH * p * 0.4);
    }

    // 3-Lane Track Rails converging to vanishing point
    const lanes = [-1, 0, 1];
    lanes.forEach((lane) => {
      const topX = vpX + lane * (w * 0.04);
      const botX = vpX + lane * (w * 0.31);

      ctx.strokeStyle = 'rgba(56, 189, 248, 0.55)';
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(topX - 4, vpY);
      ctx.lineTo(botX - w * 0.08, y + h);
      ctx.moveTo(topX + 4, vpY);
      ctx.lineTo(botX + w * 0.08, y + h);
      ctx.stroke();
    });

    // Horizontal railway ties scrolling rapidly
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.25)';
    for (let tie = 0; tie < 14; tie++) {
      const tz = ((tie - (timeSec * 8) % 1) + 14) % 14;
      const tNorm = Math.pow(tz / 14, 2.1);
      const ty = vpY + tNorm * groundH;
      const tw = lerp(w * 0.14, w * 0.95, tNorm);
      ctx.lineWidth = Math.max(1, tNorm * 4);
      ctx.beginPath();
      ctx.moveTo(vpX - tw * 0.5, ty);
      ctx.lineTo(vpX + tw * 0.5, ty);
      ctx.stroke();
    }

    // Runner smoothly switching lanes (-1, 0, 1) to dodge oncoming trains
    const targetLane = Math.round(Math.sin(timeSec * 1.9));
    const runnerLane = lerp(Math.sin(timeSec * 1.9), targetLane, 0.65);

    // Oncoming 3D Trains in non-runner lanes
    for (let tIdx = 0; tIdx < 3; tIdx++) {
      const cycle = (timeSec * 0.85 + tIdx * 0.33) % 1;
      const trainLane = tIdx === 0 ? -1 : tIdx === 1 ? 1 : 0;
      if (Math.abs(trainLane - runnerLane) < 0.45 && cycle > 0.68) continue;

      const p = Math.pow(cycle, 2.2);
      const tx = vpX + trainLane * lerp(w * 0.03, w * 0.3, p);
      const ty = vpY + p * groundH * 0.88;
      const tw = lerp(14, w * 0.22, p);
      const th = lerp(18, h * 0.26, p);

      // Train carriage body
      ctx.fillStyle = '#1e293b';
      drawRoundedRect(ctx, tx - tw * 0.5, ty - th, tw, th, 6 * p + 2);
      ctx.fill();
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Windshield
      ctx.fillStyle = '#0ea5e9';
      drawRoundedRect(ctx, tx - tw * 0.38, ty - th * 0.85, tw * 0.76, th * 0.32, 3);
      ctx.fill();

      // Glowing Headlights
      ctx.fillStyle = '#fef08a';
      ctx.beginPath();
      ctx.arc(tx - tw * 0.28, ty - th * 0.18, Math.max(2, 5 * p), 0, Math.PI * 2);
      ctx.arc(tx + tw * 0.28, ty - th * 0.18, Math.max(2, 5 * p), 0, Math.PI * 2);
      ctx.fill();
    }

    // Spinning Gold Coins along runner lane
    for (let c = 0; c < 6; c++) {
      const cProg = ((c * 0.16 - timeSec * 0.9) % 1 + 1) % 1;
      if (cProg > 0.84) continue;
      const p = Math.pow(cProg, 2);
      const cx = vpX + runnerLane * lerp(w * 0.03, w * 0.28, p);
      const cy = vpY + p * groundH * 0.85 - Math.sin(cProg * Math.PI) * 18 * p;
      const cr = Math.max(3, 13 * p);
      const spinX = Math.max(0.25, Math.abs(Math.cos(timeSec * 8 + c)));

      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(spinX, 1);
      ctx.fillStyle = '#facc15';
      ctx.beginPath();
      ctx.arc(0, 0, cr, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ca8a04';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();
    }

    // Hoverboard Surfer Character in foreground
    const charX = vpX + runnerLane * (w * 0.26);
    const jumpBob = Math.abs(Math.sin(timeSec * 5.2)) * 18;
    const charY = y + h * 0.82 - jumpBob;

    ctx.save();
    ctx.translate(charX, charY);
    ctx.rotate((runnerLane - Math.sin(timeSec * 1.9)) * 0.25);

    // Neon Hoverboard + Thruster Glow
    ctx.fillStyle = '#f43f5e';
    ctx.beginPath();
    ctx.ellipse(0, 18, 26, 9, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Runner silhouette with glowing hoodie trim
    ctx.fillStyle = '#0f172a';
    drawRoundedRect(ctx, -14, -28, 28, 38, 10);
    ctx.fill();
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Runner head / cap
    ctx.fillStyle = '#f43f5e';
    ctx.beginPath();
    ctx.arc(0, -38, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Coin Score Counter HUD top-right
    ctx.fillStyle = 'rgba(15, 23, 42, 0.8)';
    drawRoundedRect(ctx, x + w - 104, y + 10, 92, 24, 12);
    ctx.fill();
    ctx.fillStyle = '#facc15';
    ctx.font = '800 11px "Inter", system-ui, sans-serif';
    ctx.textAlign = 'right';
    const score = 14820 + Math.floor(timeSec * 145);
    ctx.fillText(`🪙 ${score}`, x + w - 20, y + 26);
  }

  /**
   * B-Roll 3: GTA Mega Stunt Ramp
   * Sky-high neon mega-ramp with sports car physics, turbo flames, checkpoints, and rotating skybox.
   */
  function renderGtaStuntRamp(ctx, r, timeSec) {
    const { x, y, w, h } = r;

    // Sunset Vice-City / Los Santos skybox gradient
    const skyGrad = ctx.createLinearGradient(x, y, x, y + h);
    skyGrad.addColorStop(0, '#1e1b4b');
    skyGrad.addColorStop(0.32, '#7c2d12');
    skyGrad.addColorStop(0.52, '#f97316');
    skyGrad.addColorStop(1, '#0f172a');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(x, y, w, h);

    const sway = Math.sin(timeSec * 1.6) * (w * 0.08);
    const vpX = x + w * 0.5 + sway;
    const vpY = y + h * 0.26;

    // Mega-Ramp 3D Surface polygon
    const rampGrad = ctx.createLinearGradient(vpX, vpY, vpX, y + h);
    rampGrad.addColorStop(0, '#334155');
    rampGrad.addColorStop(0.5, '#1e293b');
    rampGrad.addColorStop(1, '#0f172a');
    ctx.fillStyle = rampGrad;
    ctx.beginPath();
    ctx.moveTo(vpX - w * 0.05, vpY);
    ctx.lineTo(vpX + w * 0.05, vpY);
    ctx.lineTo(x + w * 0.94, y + h);
    ctx.lineTo(x + w * 0.06, y + h);
    ctx.closePath();
    ctx.fill();

    // Neon Boost Chevron Pads & Side Barriers on Mega-Ramp
    for (let seg = 0; seg < 12; seg++) {
      const sNorm = Math.pow(((seg - (timeSec * 6.5) % 1 + 12) % 12) / 12, 2);
      const sy = lerp(vpY, y + h, sNorm);
      const rw = lerp(w * 0.1, w * 0.88, sNorm);
      const rx = lerp(vpX, x + w * 0.5, sNorm);

      // Orange/Cyan side guardrails
      ctx.fillStyle = seg % 2 === 0 ? '#f97316' : '#f8fafc';
      ctx.fillRect(rx - rw * 0.5 - 6 * sNorm, sy, 6 * sNorm + 1, 10 * sNorm + 2);
      ctx.fillRect(rx + rw * 0.5, sy, 6 * sNorm + 1, 10 * sNorm + 2);

      // Glowing green nitro boost chevron in center
      if (seg % 3 === 0) {
        ctx.strokeStyle = '#22c55e';
        ctx.lineWidth = Math.max(1.5, 5 * sNorm);
        ctx.beginPath();
        ctx.moveTo(rx - rw * 0.22, sy + 10 * sNorm);
        ctx.lineTo(rx, sy - 8 * sNorm);
        ctx.lineTo(rx + rw * 0.22, sy + 10 * sNorm);
        ctx.stroke();
      }
    }

    // Glowing Circular Stunt Checkpoint Rings
    for (let ring = 0; ring < 3; ring++) {
      const rProg = ((ring * 0.33 - timeSec * 0.55) % 1 + 1) % 1;
      const p = Math.pow(rProg, 2);
      const rx = lerp(vpX, x + w * 0.5, p);
      const ry = lerp(vpY, y + h * 0.72, p);
      const rad = lerp(12, w * 0.42, p);

      ctx.strokeStyle = 'rgba(250, 204, 21, 0.75)';
      ctx.lineWidth = Math.max(2, 7 * p);
      ctx.beginPath();
      ctx.arc(rx, ry, rad, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Supercar with suspension bounce, spoiler, and twin turbo exhaust flames
    const carX = x + w * 0.5 - sway * 0.45;
    const jumpCycle = Math.max(0, Math.sin(timeSec * 2.1));
    const carY = y + h * 0.78 - jumpCycle * 26;
    const carW = Math.min(136, w * 0.38);
    const carH = carW * 0.46;

    ctx.save();
    ctx.translate(carX, carY);
    ctx.rotate(Math.sin(timeSec * 3.2) * 0.04);

    // Shadow under car
    ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
    ctx.beginPath();
    ctx.ellipse(0, carH * 0.55 + jumpCycle * 18, carW * 0.55, 10, 0, 0, Math.PI * 2);
    ctx.fill();

    // Tires
    ctx.fillStyle = '#09090b';
    drawRoundedRect(ctx, -carW * 0.48, carH * 0.05, carW * 0.18, carH * 0.45, 4);
    ctx.fill();
    drawRoundedRect(ctx, carW * 0.3, carH * 0.05, carW * 0.18, carH * 0.45, 4);
    ctx.fill();

    // Aerodynamic Supercar Chassis
    const bodyGrad = ctx.createLinearGradient(-carW * 0.5, -carH * 0.5, carW * 0.5, carH * 0.4);
    bodyGrad.addColorStop(0, '#ef4444');
    bodyGrad.addColorStop(0.5, '#dc2626');
    bodyGrad.addColorStop(1, '#7f1d1d');
    ctx.fillStyle = bodyGrad;
    drawRoundedRect(ctx, -carW * 0.46, -carH * 0.25, carW * 0.92, carH * 0.62, 10);
    ctx.fill();

    // Cabin / Rear louver window
    ctx.fillStyle = '#18181b';
    ctx.beginPath();
    ctx.moveTo(-carW * 0.28, -carH * 0.25);
    ctx.lineTo(carW * 0.28, -carH * 0.25);
    ctx.lineTo(carW * 0.18, -carH * 0.62);
    ctx.lineTo(-carW * 0.18, -carH * 0.62);
    ctx.closePath();
    ctx.fill();

    // Carbon Fiber GT Wing Spoiler
    ctx.fillStyle = '#09090b';
    ctx.fillRect(-carW * 0.44, -carH * 0.52, carW * 0.88, 5);
    ctx.fillRect(-carW * 0.24, -carH * 0.48, 4, 14);
    ctx.fillRect(carW * 0.2, -carH * 0.48, 4, 14);

    // LED Taillight Strip
    ctx.fillStyle = '#fca5a5';
    ctx.fillRect(-carW * 0.4, -carH * 0.08, carW * 0.24, 5);
    ctx.fillRect(carW * 0.16, -carH * 0.08, carW * 0.24, 5);

    // Twin Nitro Exhaust Flames
    const flameLen = 14 + Math.abs(Math.sin(timeSec * 28)) * 18;
    [-carW * 0.16, carW * 0.16].forEach((ex) => {
      const fGrad = ctx.createLinearGradient(ex, carH * 0.25, ex, carH * 0.25 + flameLen);
      fGrad.addColorStop(0, '#ffffff');
      fGrad.addColorStop(0.35, '#38bdf8');
      fGrad.addColorStop(1, 'rgba(59, 130, 246, 0)');
      ctx.fillStyle = fGrad;
      ctx.beginPath();
      ctx.moveTo(ex - 5, carH * 0.24);
      ctx.lineTo(ex + 5, carH * 0.24);
      ctx.lineTo(ex, carH * 0.24 + flameLen);
      ctx.closePath();
      ctx.fill();
    });
    ctx.restore();

    // Speedometer HUD bottom-right
    const mph = 238 + Math.floor(Math.sin(timeSec * 3.4) * 14);
    ctx.fillStyle = 'rgba(9, 9, 13, 0.78)';
    drawRoundedRect(ctx, x + w - 98, y + h - 38, 86, 28, 8);
    ctx.fill();
    ctx.fillStyle = '#f97316';
    ctx.font = '800 12px "Inter", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${mph} MPH`, x + w - 55, y + h - 20);
  }

  /**
   * B-Roll 4: Kinetic Sand / Soap Slicer ASMR
   * Satisfying 3D layered kinetic sand/soap grid being sliced cleanly by a glowing blade with falling particles.
   */
  function renderKineticSlicer(ctx, r, timeSec) {
    const { x, y, w, h } = r;

    // Soft pastel studio backdrop
    const bgGrad = ctx.createLinearGradient(x, y, x + w, y + h);
    bgGrad.addColorStop(0, '#181024');
    bgGrad.addColorStop(0.5, '#2b1438');
    bgGrad.addColorStop(1, '#120b1d');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(x, y, w, h);

    const cx = x + w * 0.5;
    const cy = y + h * 0.52;
    const sliceCycle = (timeSec * 1.15) % 1; // One clean slice every ~0.87s
    const sliceNum = Math.floor(timeSec * 1.15);

    const rainbowColors = ['#f43f5e', '#fb7185', '#f97316', '#facc15', '#4ade80', '#38bdf8', '#a855f7'];
    const blockW = Math.min(180, w * 0.52);
    const blockH = Math.min(130, h * 0.34);

    // Draw 3D Layered Kinetic Sand Loaf being pushed toward the slicing plane
    const layers = 7;
    const layerH = blockH / layers;

    for (let l = layers - 1; l >= 0; l--) {
      const ly = cy - blockH * 0.5 + l * layerH;
      const color = rainbowColors[(l + sliceNum) % rainbowColors.length];

      // Isometric depth side
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(cx - blockW * 0.5, ly);
      ctx.lineTo(cx - blockW * 0.32, ly - 18);
      ctx.lineTo(cx + blockW * 0.38, ly - 18);
      ctx.lineTo(cx + blockW * 0.2, ly);
      ctx.closePath();
      ctx.fill();

      // Main front block face with scored waffle grid lines
      ctx.fillStyle = color;
      ctx.fillRect(cx - blockW * 0.5, ly, blockW * 0.7, layerH - 1);

      // Tactile kinetic sand / soap cube score lines
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
      ctx.lineWidth = 1;
      for (let gx = cx - blockW * 0.5; gx < cx + blockW * 0.2; gx += 14) {
        ctx.beginPath();
        ctx.moveTo(gx, ly);
        ctx.lineTo(gx, ly + layerH);
        ctx.stroke();
      }
    }

    // Sliced cross-section slab curling & falling off the right edge
    const fallY = cy - blockH * 0.4 + Math.pow(sliceCycle, 1.7) * (h * 0.45);
    const curlRot = sliceCycle * 0.65;
    ctx.save();
    ctx.translate(cx + blockW * 0.26 + sliceCycle * 28, fallY);
    ctx.rotate(curlRot);
    for (let l = 0; l < layers; l++) {
      ctx.fillStyle = rainbowColors[(l + sliceNum) % rainbowColors.length];
      ctx.fillRect(-10, (l - layers * 0.5) * layerH * 0.9, 20, layerH * 0.85);
    }
    ctx.restore();

    // Cascade of satisfying falling soap/sand cubes & particles
    for (let p = 0; p < 32; p++) {
      const pSeed = hashNoise(p + sliceNum * 13);
      const pPhase = (sliceCycle + p * 0.03) % 1;
      const px = cx + blockW * 0.2 + (pSeed - 0.3) * 85 + pPhase * 24;
      const py = cy - blockH * 0.35 + Math.pow(pPhase, 1.6) * (h * 0.52);
      const pSize = 4 + (p % 4) * 2;
      ctx.fillStyle = rainbowColors[p % rainbowColors.length];
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(pPhase * 4 + p);
      ctx.fillRect(-pSize * 0.5, -pSize * 0.5, pSize, pSize);
      ctx.restore();
    }

    // Gleaming Heated Slicer Blade descending through the kinetic block
    const bladeY = lerp(cy - blockH * 0.72, cy + blockH * 0.55, Math.sin(sliceCycle * Math.PI));
    ctx.save();
    ctx.translate(cx + blockW * 0.2, bladeY);
    ctx.rotate(-0.12);

    const bladeGrad = ctx.createLinearGradient(-15, -18, 85, 18);
    bladeGrad.addColorStop(0, '#f8fafc');
    bladeGrad.addColorStop(0.5, '#cbd5e1');
    bladeGrad.addColorStop(1, '#f43f5e');
    ctx.fillStyle = bladeGrad;
    drawRoundedRect(ctx, -12, -14, 110, 22, 4);
    ctx.fill();

    // Glowing cutting edge
    ctx.strokeStyle = '#fda4af';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(-12, 8);
    ctx.lineTo(98, 8);
    ctx.stroke();
    ctx.restore();
  }

  /**
   * B-Roll 5: 300T Hydraulic Press
   * Industrial hydraulic press crushing glowing geometric objects with sparks and pressure gauge.
   */
  function renderHydraulicPress(ctx, r, timeSec) {
    const { x, y, w, h } = r;

    // Industrial workshop steel background
    const bgGrad = ctx.createLinearGradient(x, y, x, y + h);
    bgGrad.addColorStop(0, '#090a0f');
    bgGrad.addColorStop(0.5, '#18181b');
    bgGrad.addColorStop(1, '#09090b');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(x, y, w, h);

    const cx = x + w * 0.5;
    const anvilY = y + h * 0.74;

    // Crush cycle (every 2.5 seconds)
    const cycle = (timeSec * 0.4) % 1;
    const objIndex = Math.floor(timeSec * 0.4);
    // Piston descends 0..0.7, holds crushed 0.7..0.85, retracts 0.85..1.0
    let crushFactor = 0;
    if (cycle < 0.7) {
      crushFactor = Math.pow(cycle / 0.7, 1.4);
    } else if (cycle < 0.85) {
      crushFactor = 1;
    } else {
      crushFactor = 1 - (cycle - 0.85) / 0.15;
    }

    const baseObjH = Math.min(95, h * 0.25);
    const currentObjH = Math.max(14, baseObjH * (1 - crushFactor * 0.82));
    const currentObjW = Math.min(w * 0.68, (baseObjH * 0.95) * (1 + crushFactor * 1.15));
    const pistonBottomY = anvilY - currentObjH;

    // Backlight heat glow behind anvil
    const heatGlow = ctx.createRadialGradient(
      cx,
      anvilY - currentObjH * 0.5,
      10,
      cx,
      anvilY - currentObjH * 0.5,
      w * 0.48
    );
    heatGlow.addColorStop(0, `rgba(249, 115, 22, ${0.2 + crushFactor * 0.45})`);
    heatGlow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = heatGlow;
    ctx.fillRect(x, y, w, h);

    // Glowing Geometric Object being crushed (alternates Neon Crystal, Molten Gold Sphere, Cyber Cube)
    const objHue = (objIndex * 115 + crushFactor * 40) % 360;
    ctx.save();
    const objGrad = ctx.createLinearGradient(
      cx - currentObjW * 0.5,
      pistonBottomY,
      cx + currentObjW * 0.5,
      anvilY
    );
    objGrad.addColorStop(0, `hsl(${objHue}, 95%, ${55 + crushFactor * 20}%)`);
    objGrad.addColorStop(0.5, `hsl(${(objHue + 35) % 360}, 95%, 50%)`);
    objGrad.addColorStop(1, `hsl(${objHue}, 90%, 38%)`);
    ctx.fillStyle = objGrad;

    drawRoundedRect(
      ctx,
      cx - currentObjW * 0.5,
      pistonBottomY,
      currentObjW,
      currentObjH,
      Math.max(6, 22 * (1 - crushFactor * 0.6))
    );
    ctx.fill();

    // Glowing internal stress fracture lines under high pressure
    if (crushFactor > 0.25) {
      ctx.strokeStyle = '#fef08a';
      ctx.lineWidth = 1.5 + crushFactor * 2;
      for (let f = -2; f <= 2; f++) {
        ctx.beginPath();
        ctx.moveTo(cx + f * (currentObjW * 0.15), pistonBottomY + 2);
        ctx.lineTo(
          cx + f * (currentObjW * 0.2) + Math.sin(timeSec * 30 + f) * 5,
          anvilY - 2
        );
        ctx.stroke();
      }
    }
    ctx.restore();

    // High-velocity sparks shooting outward during compression
    if (crushFactor > 0.2 && cycle < 0.85) {
      for (let s = 0; s < 24; s++) {
        const sSeed = hashNoise(s + objIndex * 7);
        const sProg = ((timeSec * 3.5 + sSeed) % 1);
        const dir = s % 2 === 0 ? -1 : 1;
        const sx = cx + dir * (currentObjW * 0.45 + sProg * w * 0.38);
        const sy =
          anvilY -
          currentObjH * (0.2 + sSeed * 0.6) -
          Math.sin(sProg * Math.PI) * 28 +
          sProg * sProg * 45;

        ctx.strokeStyle = s % 3 === 0 ? '#ffffff' : '#facc15';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(sx - dir * 8, sy - 3);
        ctx.stroke();
      }
    }

    // Upper Hydraulic Ram & Warning Hazard Stripes
    const ramW = Math.min(180, w * 0.56);
    const shaftW = ramW * 0.52;
    ctx.fillStyle = '#52525b';
    ctx.fillRect(cx - shaftW * 0.5, y, shaftW, Math.max(0, pistonBottomY - y - 28));

    // Heavy Ram Head
    const ramGrad = ctx.createLinearGradient(cx - ramW * 0.5, 0, cx + ramW * 0.5, 0);
    ramGrad.addColorStop(0, '#27272a');
    ramGrad.addColorStop(0.5, '#71717a');
    ramGrad.addColorStop(1, '#18181b');
    ctx.fillStyle = ramGrad;
    drawRoundedRect(ctx, cx - ramW * 0.5, pistonBottomY - 32, ramW, 32, 4);
    ctx.fill();

    // Yellow/Black Hazard Stripe band on Ram
    ctx.save();
    ctx.beginPath();
    ctx.rect(cx - ramW * 0.46, pistonBottomY - 24, ramW * 0.92, 12);
    ctx.clip();
    ctx.fillStyle = '#eab308';
    ctx.fillRect(cx - ramW * 0.46, pistonBottomY - 24, ramW * 0.92, 12);
    ctx.fillStyle = '#18181b';
    for (let hx = cx - ramW * 0.5; hx < cx + ramW * 0.5; hx += 18) {
      ctx.beginPath();
      ctx.moveTo(hx, pistonBottomY - 24);
      ctx.lineTo(hx + 9, pistonBottomY - 24);
      ctx.lineTo(hx + 3, pistonBottomY - 12);
      ctx.lineTo(hx - 6, pistonBottomY - 12);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();

    // Lower Steel Anvil Base
    ctx.fillStyle = '#27272a';
    ctx.fillRect(x + w * 0.12, anvilY, w * 0.76, y + h - anvilY);
    ctx.fillStyle = '#52525b';
    ctx.fillRect(x + w * 0.08, anvilY, w * 0.84, 10);

    // Live Digital Tonnage Pressure Gauge HUD
    const tons = Math.round(crushFactor * 340);
    ctx.fillStyle = 'rgba(9, 9, 13, 0.85)';
    drawRoundedRect(ctx, x + 12, y + 12, 112, 28, 8);
    ctx.fill();
    ctx.strokeStyle = crushFactor > 0.75 ? '#ef4444' : '#eab308';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = crushFactor > 0.75 ? '#ef4444' : '#facc15';
    ctx.font = '800 11px "Inter", system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`⚡ ${tons} TONS PSI`, x + 20, y + 30);
  }

  /**
   * B-Roll 6: Synthwave Outrun Drive
   * Retro-futuristic outrun wireframe mountains, sun grid, and speeding cyber car.
   */
  function renderSynthwaveDrive(ctx, r, timeSec) {
    const { x, y, w, h } = r;
    const horizonY = y + h * 0.44;
    const cx = x + w * 0.5;

    // Deep synthwave starfield sky
    const skyGrad = ctx.createLinearGradient(x, y, x, horizonY);
    skyGrad.addColorStop(0, '#070312');
    skyGrad.addColorStop(0.55, '#2e0854');
    skyGrad.addColorStop(1, '#be185d');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(x, y, w, horizonY - y);

    // Twinkling retro stars
    ctx.fillStyle = '#ffffff';
    for (let s = 0; s < 24; s++) {
      const sx = x + hashNoise(s * 3.1) * w;
      const sy = y + hashNoise(s * 7.7) * (horizonY - y) * 0.75;
      const alpha = 0.3 + 0.7 * Math.abs(Math.sin(timeSec * 2 + s));
      ctx.globalAlpha = alpha;
      ctx.fillRect(sx, sy, 2, 2);
    }
    ctx.globalAlpha = 1;

    // Segmented Outrun Sunset Sun
    const sunR = Math.min(w, h) * 0.22;
    const sunY = horizonY - sunR * 0.28;
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, sunY, sunR, Math.PI, 0, false);
    ctx.lineTo(cx + sunR, horizonY);
    ctx.lineTo(cx - sunR, horizonY);
    ctx.closePath();
    ctx.clip();

    const sunGrad = ctx.createLinearGradient(cx, sunY - sunR, cx, horizonY);
    sunGrad.addColorStop(0, '#fef08a');
    sunGrad.addColorStop(0.45, '#f97316');
    sunGrad.addColorStop(1, '#ec4899');
    ctx.fillStyle = sunGrad;
    ctx.fillRect(cx - sunR, sunY - sunR, sunR * 2, sunR * 2);

    // Horizontal scanline cutouts on sun
    ctx.fillStyle = '#2e0854';
    for (let sl = 0; sl < 6; sl++) {
      const ly = sunY - sunR * 0.15 + sl * (sunR * 0.14);
      ctx.fillRect(cx - sunR, ly, sunR * 2, 2 + sl * 1.1);
    }
    ctx.restore();

    // Wireframe Procedural Mountains on left & right of horizon
    ctx.fillStyle = '#14052b';
    ctx.strokeStyle = '#06b6d4';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x, horizonY);
    for (let mx = 0; mx <= 16; mx++) {
      const t = mx / 16;
      const px = x + t * w;
      const centerDip = Math.abs(t - 0.5) * 2;
      const peak =
        Math.pow(centerDip, 1.3) *
        (28 + Math.sin(mx * 1.9 + timeSec * 1.2) * 14 + Math.cos(mx * 3.1) * 10);
      ctx.lineTo(px, horizonY - peak);
    }
    ctx.lineTo(x + w, horizonY);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Lower Neon Perspective Grid Floor
    const floorGrad = ctx.createLinearGradient(x, horizonY, x, y + h);
    floorGrad.addColorStop(0, '#1e0538');
    floorGrad.addColorStop(1, '#070210');
    ctx.fillStyle = floorGrad;
    ctx.fillRect(x, horizonY, w, y + h - horizonY);

    ctx.save();
    ctx.beginPath();
    ctx.rect(x, horizonY, w, y + h - horizonY);
    ctx.clip();

    // Radial perspective grid lines
    ctx.strokeStyle = 'rgba(236, 72, 153, 0.55)';
    ctx.lineWidth = 1.4;
    for (let g = -8; g <= 8; g++) {
      ctx.beginPath();
      ctx.moveTo(cx + g * (w * 0.025), horizonY);
      ctx.lineTo(cx + g * (w * 0.22), y + h);
      ctx.stroke();
    }

    // Scrolling horizontal grid lines
    const floorH = y + h - horizonY;
    for (let hz = 0; hz < 14; hz++) {
      const zNorm = Math.pow(((hz + (timeSec * 4.5) % 1) / 14), 2.1);
      const hy = horizonY + zNorm * floorH;
      ctx.strokeStyle = `rgba(6, 182, 212, ${0.25 + zNorm * 0.65})`;
      ctx.lineWidth = 1 + zNorm * 2;
      ctx.beginPath();
      ctx.moveTo(x, hy);
      ctx.lineTo(x + w, hy);
      ctx.stroke();
    }

    // Cyber DeLorean / Outrun Car in foreground
    const carX = cx + Math.sin(timeSec * 1.8) * (w * 0.08);
    const carY = y + h * 0.82;
    const carW = Math.min(130, w * 0.36);
    const carH = carW * 0.42;

    ctx.translate(carX, carY);
    ctx.fillStyle = '#0f172a';
    drawRoundedRect(ctx, -carW * 0.5, -carH * 0.35, carW, carH * 0.7, 8);
    ctx.fill();
    ctx.strokeStyle = '#06b6d4';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Louvered rear window
    ctx.fillStyle = '#1e1b4b';
    ctx.beginPath();
    ctx.moveTo(-carW * 0.34, -carH * 0.35);
    ctx.lineTo(carW * 0.34, -carH * 0.35);
    ctx.lineTo(carW * 0.22, -carH * 0.75);
    ctx.lineTo(-carW * 0.22, -carH * 0.75);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Glowing Magenta/Red Outrun Taillights
    ctx.fillStyle = '#f43f5e';
    ctx.fillRect(-carW * 0.44, -carH * 0.14, carW * 0.28, 7);
    ctx.fillRect(carW * 0.16, -carH * 0.14, carW * 0.28, 7);

    // License plate "WHOP 88"
    ctx.fillStyle = '#facc15';
    ctx.fillRect(-16, -carH * 0.12, 32, 9);
    ctx.restore();
  }

  /**
   * Public API 2: Render Procedural 60fps Satisfying B-Roll Preset
   * @param {CanvasRenderingContext2D} ctx
   * @param {{x:number, y:number, w:number, h:number}} rect
   * @param {number} timeSec
   * @param {string} brollId
   * @param {object} [options]
   */
  function renderBrollPreset(ctx, rect, timeSec = 0, brollId = 'minecraft-parkour', options = {}) {
    if (!ctx) return;
    const r = normalizeRect(ctx, rect);
    const t = Number.isFinite(timeSec) ? timeSec : 0;
    const id = String(brollId || 'minecraft-parkour').toLowerCase();

    ctx.save();
    ctx.beginPath();
    ctx.rect(r.x, r.y, r.w, r.h);
    ctx.clip();

    if (id.includes('subway')) {
      renderSubwayRunner(ctx, r, t);
    } else if (id.includes('gta') || id.includes('ramp') || id.includes('stunt')) {
      renderGtaStuntRamp(ctx, r, t);
    } else if (id.includes('kinetic') || id.includes('slicer') || id.includes('sand') || id.includes('soap')) {
      renderKineticSlicer(ctx, r, t);
    } else if (id.includes('hydraulic') || id.includes('press')) {
      renderHydraulicPress(ctx, r, t);
    } else if (id.includes('synthwave') || id.includes('outrun') || id.includes('drive')) {
      renderSynthwaveDrive(ctx, r, t);
    } else {
      renderMinecraftParkour(ctx, r, t);
    }

    // Subtle top-left B-Roll retention tag badge (unless hidden by options)
    if (!options || options.showBadge !== false) {
      const presetMeta =
        BROLL_PRESETS.find((p) => id.includes(p.id.split('-')[0])) || BROLL_PRESETS[0];
      const badgeX = r.x + r.w - 114;
      const badgeY = r.y + r.h - 28;
      ctx.fillStyle = 'rgba(9, 9, 15, 0.76)';
      drawRoundedRect(ctx, badgeX, badgeY, 104, 20, 10);
      ctx.fill();
      ctx.fillStyle = presetMeta.accent;
      ctx.font = '800 9px "Inter", system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`RETENTION ${presetMeta.retentionBoost}`, badgeX + 52, badgeY + 13);
    }

    ctx.restore();
  }

  /**
   * Constructor / Namespace hybrid so `window.WhopBrollEngine` works both
   * via static methods (`WhopBrollEngine.renderBrollPreset(...)`) AND `new WhopBrollEngine()`.
   */
  function WhopBrollEngine() {}

  const api = {
    DEMO_STREAMS,
    BROLL_PRESETS,
    getDemoStreams: function () {
      return DEMO_STREAMS.slice();
    },
    getBrollPresets: function () {
      return BROLL_PRESETS.slice();
    },
    getSpeechEnvelope,
    renderDemoMainFeed,
    renderBrollPreset
  };

  Object.assign(WhopBrollEngine, api);
  Object.assign(WhopBrollEngine.prototype, api);

  global.WhopBrollEngine = WhopBrollEngine;
})(typeof window !== 'undefined' ? window : globalThis);
