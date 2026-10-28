/**
 * WhopClipper — Pixabay Stock Media & Autobroll Engine
 * Sourced from https://github.com/andriidrok1/autobroll & Pixabay API
 *
 * Provides:
 *  1. Live stock video search via Pixabay API (Key: 58281434-0199a4345a7540437f190c4d9)
 *  2. AI-driven B-roll keyword extraction & placement from transcripts (Gemini)
 *  3. Seamless 60fps HTML5 Canvas video playback for full cutaways & PIP modes
 *  4. Local caching & download for zero-latency scrubbing and FFmpeg export
 *
 * Attached to `window.WhopBrollEngine` for zero-bundler browser usage.
 */
(function (global) {
  'use strict';

  const PIXABAY_API_KEY = '58281434-0199a4345a7540437f190c4d9';

  // Real curated stock video categories for viral TikTok/Shorts clipping
  const CURATED_CATEGORIES = [
    { id: 'car-phonk', name: 'Car Phonk / Drift', query: 'sports car drift', icon: '🏎️', accent: '#f59e0b' },
    { id: 'streamer-reaction', name: 'Shocked Reaction', query: 'crowd reaction surprise', icon: '😱', accent: '#ef4444' },
    { id: 'money-cash', name: 'Money & Wealth', query: 'counting money cash rich', icon: '💸', accent: '#10b981' },
    { id: 'gaming-energy', name: 'Gaming & Cyber', query: 'gaming neon arcade cyber', icon: '🎮', accent: '#8b5cf6' },
    { id: 'city-night', name: 'Cyber City Night', query: 'city skyline night time lapse', icon: '🌆', accent: '#06b6d4' },
    { id: 'stadium-crowd', name: 'Stadium / Arena Crowd', query: 'stadium cheering crowd concert', icon: '🎉', accent: '#3b82f6' }
  ];

  class WhopBrollEngineClass {
    constructor() {
      this.apiKey = PIXABAY_API_KEY;
      this.cache = new Map();
      this.activeCues = [];
      this.activeVideoEl = null;
    }

    /**
     * Search Pixabay for real stock video clips
     * Calls our local server proxy /api/pixabay_search or direct Pixabay API
     */
    async searchVideos(query = 'car', perPage = 12) {
      const q = String(query || 'action').trim();
      const cacheKey = `${q}_${perPage}`;
      if (this.cache.has(cacheKey)) {
        return this.cache.get(cacheKey);
      }

      try {
        const res = await fetch(`/api/pixabay_search?q=${encodeURIComponent(q)}&per_page=${perPage}`);
        if (res.ok) {
          const data = await res.json();
          if (data && Array.isArray(data.hits)) {
            this.cache.set(cacheKey, data.hits);
            return data.hits;
          }
        }
      } catch (err) {
        console.warn('[BrollEngine] Server search proxy failed, attempting direct Pixabay:', err);
      }

      // Direct fallback
      try {
        const url = `https://pixabay.com/api/videos/?key=${this.apiKey}&q=${encodeURIComponent(q)}&per_page=${perPage}`;
        const res = await fetch(url);
        const data = await res.json();
        const hits = (data.hits || []).map((h) => {
          const v = h.videos?.medium || h.videos?.large || h.videos?.small || {};
          return {
            id: h.id,
            tags: h.tags,
            duration: h.duration,
            width: v.width || 1920,
            height: v.height || 1080,
            url: v.url,
            thumbnail: h.picture_id ? `https://i.vimeocdn.com/video/${h.picture_id}_640x360.jpg` : '',
            user: h.user
          };
        });
        this.cache.set(cacheKey, hits);
        return hits;
      } catch (err) {
        console.error('[BrollEngine] Direct Pixabay search error:', err);
        return [];
      }
    }

    /**
     * Automatically plan and fetch B-roll for a transcript using Gemini (autobroll style)
     */
    async autoPlanBroll(words = []) {
      if (!Array.isArray(words) || words.length === 0) return [];
      try {
        const res = await fetch('/api/auto_broll_gemini', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ words })
        });
        if (res.ok) {
          const data = await res.json();
          if (data && Array.isArray(data.broll_cues)) {
            return data.broll_cues;
          }
        }
      } catch (err) {
        console.error('[BrollEngine] autoPlanBroll error:', err);
      }
      return [];
    }

    /**
     * Download or cache stock video locally for zero-latency scrub & FFmpeg export
     */
    async downloadVideo(videoItem) {
      if (!videoItem || !videoItem.url) return null;
      try {
        const res = await fetch('/api/pixabay_download', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: videoItem.url,
            id: videoItem.id || videoItem.pixabay_id
          })
        });
        if (res.ok) {
          return await res.json();
        }
      } catch (err) {
        console.error('[BrollEngine] downloadVideo error:', err);
      }
      return null;
    }

    /**
     * Backward-compatible getters
     */
    getDemoStreams() {
      // Empty: all demo mock data removed as instructed!
      return [];
    }

    getBrollPresets() {
      return CURATED_CATEGORIES.map((c) => ({
        id: c.id,
        name: c.name,
        icon: c.icon,
        description: `Pixabay Stock: ${c.query}`
      }));
    }

    getContextBrollPresets() {
      return CURATED_CATEGORIES.map((c) => ({
        id: c.id,
        name: c.name,
        icon: c.icon,
        accent: c.accent,
        query: c.query
      }));
    }

    getSpeechEnvelope(t) {
      return 0.5 + 0.3 * Math.sin(t * 4);
    }

    /**
     * Renders active stock video onto canvas stage with cover-crop and mode support
     */
    renderContextBrollCutaway(ctx, rect, relT, topicId, customLabel, videoElement, mode = 'fullscreen') {
      if (!ctx || !rect) return;
      ctx.save();

      const r = rect;
      // If a real video element is provided and has loaded video frames, draw with 9:16 vertical cover-crop!
      if (videoElement && (videoElement.readyState >= 2 || (videoElement.readyState >= 1 && videoElement.currentTime > 0))) {
        const vw = videoElement.videoWidth || 1920;
        const vh = videoElement.videoHeight || 1080;
        const scale = Math.max(r.w / vw, r.h / vh);
        const drawW = vw * scale;
        const drawH = vh * scale;
        const drawX = r.x + (r.w - drawW) / 2;
        const drawY = r.y + (r.h - drawH) / 2;

        ctx.beginPath();
        if (mode === 'inset' || mode === 'pip-card') {
          ctx.roundRect(r.x, r.y, r.w, r.h, 20);
        } else {
          ctx.rect(r.x, r.y, r.w, r.h);
        }
        ctx.clip();
        ctx.drawImage(videoElement, drawX, drawY, drawW, drawH);

        // For inset / PIP mode, draw sleek border
        if (mode === 'inset' || mode === 'pip-card') {
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
          ctx.lineWidth = 3;
          ctx.stroke();
        }
      } else {
        // High-end cinematic glass card while buffering (NEVER a solid black block or raw broken text)
        ctx.fillStyle = 'rgba(15, 23, 42, 0.45)';
        ctx.beginPath();
        if (mode === 'inset' || mode === 'pip-card') {
          ctx.roundRect(r.x, r.y, r.w, r.h, 20);
        } else {
          ctx.rect(r.x, r.y, r.w, r.h);
        }
        ctx.fill();

        // Sleek subtle loading pill badge
        const badgeW = 240;
        const badgeH = 34;
        const bx = r.x + (r.w - badgeW) / 2;
        const by = r.y + (r.h - badgeH) / 2;
        ctx.fillStyle = 'rgba(10, 15, 30, 0.85)';
        ctx.beginPath();
        ctx.roundRect(bx, by, badgeW, badgeH, 17);
        ctx.fill();
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.fillStyle = '#ffffff';
        ctx.font = '600 13px "Plus Jakarta Sans", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`🎬 Loading "${customLabel || 'B-Roll'}"...`, r.x + r.w / 2, by + 22);
      }

      ctx.restore();
    }

    renderBrollPreset(ctx, rect, timeSec, presetId, options) {
      const videoEl = document.getElementById('brollVideoEl');
      this.renderContextBrollCutaway(ctx, rect, timeSec, presetId, 'PIXABAY STOCK B-ROLL', videoEl);
    }

    renderDemoMainFeed() {
      // Empty: real video is rendered directly on video element
    }
  }

  const instance = new WhopBrollEngineClass();
  global.WhopBrollEngine = instance;
})(typeof window !== 'undefined' ? window : globalThis);
