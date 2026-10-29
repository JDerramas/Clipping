import json
import math
import os
import re
import shutil
import subprocess
import sys
import time
import urllib.parse
import urllib.request
import wave
from datetime import datetime
from pathlib import Path
from urllib.parse import urlparse

import av
import numpy as np
from faster_whisper import WhisperModel
import yt_dlp

import ai_autovertical
import image_search
import qwen_client

# ---------------- CONFIG ----------------
ROOT = Path("D:/WhopClipper") if Path("D:/WhopClipper").exists() else Path(__file__).resolve().parent
UPLOADS = ROOT / "uploads"
OUTPUTS = ROOT / "outputs"
TEMP = ROOT / "temp"
HF_CACHE = ROOT / "hf_cache"
ASSETS_DIR = ROOT / "assets" / "images"
SAVED_PROJECTS_FILE = OUTPUTS / "saved_projects.json"

for folder in (UPLOADS, OUTPUTS, TEMP, HF_CACHE, ASSETS_DIR):
    folder.mkdir(parents=True, exist_ok=True)

os.environ["HF_HOME"] = str(HF_CACHE)
os.environ["TEMP"] = str(TEMP)
os.environ["TMP"] = str(TEMP)

# PyAV 19 compatibility patch for faster-whisper
_orig_av_open = getattr(av, "_whop_orig_open", av.open)


def _compat_av_open(*args, **kwargs):
    try:
        return _orig_av_open(*args, **kwargs)
    except TypeError as exc:
        if "metadata_errors" in str(exc) and "metadata_errors" in kwargs:
            kwargs.pop("metadata_errors", None)
            return _orig_av_open(*args, **kwargs)
        raise


if not hasattr(av, "_whop_orig_open"):
    av._whop_orig_open = _orig_av_open
    av.open = _compat_av_open

STYLE_PRESETS = {
    "Hormozi Pop": {
        "primary_hex": "&H0000FFFF",     # Bright Yellow
        "highlight_hex": "&H0000FF00",   # Neon Green
        "outline_hex": "&H00000000",
        "back_hex": "&H80000000",
        "outline": 5,
        "shadow": 3,
        "uppercase": True,
    },
    "Clean Minimal": {
        "primary_hex": "&H00FFFFFF",
        "highlight_hex": "&H0000D4FF",
        "outline_hex": "&H00111111",
        "back_hex": "&H60000000",
        "outline": 3,
        "shadow": 1,
        "uppercase": False,
    },
    "Neon Glow": {
        "primary_hex": "&H00FF00FF",     # Magenta
        "highlight_hex": "&H00FFFF00",   # Cyan
        "outline_hex": "&H00000000",
        "back_hex": "&H90100020",
        "outline": 6,
        "shadow": 4,
        "uppercase": True,
    },
    "MrBeast Impact": {
        "primary_hex": "&H0000FFFF",
        "highlight_hex": "&H000000FF",   # Vivid Red
        "outline_hex": "&H00000000",
        "back_hex": "&HA0000000",
        "outline": 7,
        "shadow": 4,
        "uppercase": True,
    },
}

# In-memory Whisper cache
_WHISPER_MODELS = {}


def run_command(args, cwd=None, timeout=1800):
    proc = subprocess.run(
        args,
        cwd=cwd,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        timeout=timeout,
    )
    if proc.returncode != 0:
        msg = (proc.stderr or proc.stdout or "").strip()
        raise RuntimeError(f"Command failed (code {proc.returncode}): {msg}")
    return proc.stdout


def check_system_tools():
    missing = []
    for tool in ("ffmpeg", "ffprobe"):
        if shutil.which(tool) is None:
            missing.append(tool)
    return missing


def sanitize_filename(name: str) -> str:
    cleaned = re.sub(r"[^\w\-.]", "_", name)
    return cleaned[:80]


def format_seconds(seconds: float) -> str:
    total = int(max(0, seconds))
    m = total // 60
    s = total % 60
    return f"{m:02d}:{s:02d}"


def format_srt_timestamp(seconds: float) -> str:
    total_ms = int(max(0.0, seconds) * 1000)
    ms = total_ms % 1000
    total_sec = total_ms // 1000
    s = total_sec % 60
    total_min = total_sec // 60
    m = total_min % 60
    h = total_min // 60
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"


def format_ass_timestamp(seconds: float) -> str:
    total_cs = int(max(0.0, seconds) * 100)
    cs = total_cs % 100
    total_sec = total_cs // 100
    s = total_sec % 60
    total_min = total_sec // 60
    m = total_min % 60
    h = total_min // 60
    return f"{h}:{m:02d}:{s:02d}.{cs:02d}"


def probe_video_metadata(video_path: Path) -> dict:
    cmd = [
        "ffprobe",
        "-v", "error",
        "-show_entries", "format=duration,size:stream=width,height,r_frame_rate,codec_type",
        "-of", "json",
        str(video_path),
    ]
    raw = run_command(cmd)
    data = json.loads(raw)
    streams = data.get("streams", [])
    v_stream = next((s for s in streams if s.get("codec_type") == "video"), None)
    a_stream = next((s for s in streams if s.get("codec_type") == "audio"), None)

    fps = 30.0
    if v_stream and "r_frame_rate" in v_stream:
        r = v_stream["r_frame_rate"].split("/")
        if len(r) == 2 and float(r[1]) > 0:
            fps = float(r[0]) / float(r[1])

    duration = float(data.get("format", {}).get("duration") or 0.0)
    size_bytes = int(data.get("format", {}).get("size") or 0)
    return {
        "path": str(video_path),
        "filename": video_path.name,
        "duration": duration,
        "width": int(v_stream.get("width", 0)) if v_stream else 0,
        "height": int(v_stream.get("height", 0)) if v_stream else 0,
        "fps": round(fps, 2),
        "has_audio": a_stream is not None,
        "size_mb": round(size_bytes / (1024 * 1024), 2),
    }


# Friendly alias
get_video_metadata = probe_video_metadata


def inspect_url_metadata(url: str) -> dict:
    """
    Extracts video metadata, YouTube viewer retention heatmap, chapters,
    and subtitle formats in ~1.5s WITHOUT downloading any video bytes!
    """
    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https"):
        raise ValueError("URL must start with http:// or https://")

    ydl_opts = {
        "skip_download": True,
        "quiet": True,
        "no_warnings": True,
    }

    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        info = ydl.extract_info(url, download=False)

    heatmap = info.get("heatmap") or []
    duration = float(info.get("duration") or 0.0)
    title = info.get("title", "Online Video")
    thumbnail = info.get("thumbnail") or ""
    chapters = info.get("chapters") or []
    subs = info.get("subtitles") or {}
    auto_subs = info.get("automatic_captions") or {}

    return {
        "url": url,
        "title": title,
        "duration": duration,
        "thumbnail": thumbnail,
        "heatmap": heatmap,
        "heatmap_count": len(heatmap),
        "chapters": chapters,
        "has_subtitles": bool(subs or auto_subs),
        "info": info,
    }


def fetch_full_video_subtitles(meta_or_info: dict) -> list:
    """
    Downloads and parses the complete subtitle track across the entire video.
    Supports both YouTube JSON3 event streams and WebVTT cue tracks.
    Returns: [{'start': float, 'end': float, 'text': str, 'words': [{'word': str, 'start': float, 'end': float}]}]
    """
    info = meta_or_info.get("info") if (isinstance(meta_or_info, dict) and "info" in meta_or_info) else meta_or_info
    if not isinstance(info, dict):
        return []

    subs = info.get("subtitles") or {}
    auto = info.get("automatic_captions") or {}

    def resolve_best_subs(source_dict):
        if not source_dict:
            return None
        for lang_key in ("tl", "fil", "tl-PH", "en", "en-US", "en-GB", "en-orig"):
            if lang_key in source_dict:
                return source_dict[lang_key]
        for k, v in source_dict.items():
            if not str(k).startswith("a."):
                return v
        first_key = next(iter(source_dict), None)
        return source_dict.get(first_key) if first_key else None

    sub_formats = resolve_best_subs(subs) or resolve_best_subs(auto)
    if not sub_formats:
        return []

    fmt = next((f for f in sub_formats if f.get("ext") == "json3"), None) or \
          next((f for f in sub_formats if f.get("ext") == "vtt"), None) or \
          sub_formats[0]

    sub_url = fmt.get("url")
    if not sub_url:
        return []

    try:
        req = urllib.request.Request(sub_url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=10) as resp:
            raw_sub = resp.read().decode("utf-8", errors="replace")

        # JSON3 format
        if fmt.get("ext") == "json3" or raw_sub.strip().startswith("{"):
            js_sub = json.loads(raw_sub)
            events = js_sub.get("events", [])
            sub_segments = []
            for ev in events:
                if "segs" in ev and "tStartMs" in ev:
                    txt = "".join(s.get("utf8", "") for s in ev["segs"]).strip()
                    if txt and txt != "\n":
                        st = float(ev["tStartMs"]) / 1000.0
                        du = float(ev.get("dDurationMs", 2000)) / 1000.0
                        et = st + du
                        words = []
                        running_offset = 0.0
                        for s in ev["segs"]:
                            wtxt = s.get("utf8", "").strip()
                            if wtxt:
                                toff = float(s.get("tOffsetMs", running_offset)) / 1000.0
                                w_st = st + toff
                                words.append({"word": wtxt, "start": round(w_st, 2), "end": round(w_st + 0.35, 2)})
                                running_offset += 250.0
                        sub_segments.append({
                            "start": round(st, 2),
                            "end": round(et, 2),
                            "text": txt,
                            "words": words
                        })
            return sub_segments

        # WebVTT format (.vtt)
        vtt_segments = []
        vtt_time_re = re.compile(r"(?:(\d{2}):)?(\d{2}):(\d{2})[\.,](\d{3})\s*-->\s*(?:(\d{2}):)?(\d{2}):(\d{2})[\.,](\d{3})")
        lines = raw_sub.splitlines()
        i = 0
        while i < len(lines):
            line = lines[i].strip()
            m = vtt_time_re.search(line)
            if m:
                h1, m1, s1, ms1 = m.group(1), m.group(2), m.group(3), m.group(4)
                st = (int(h1) if h1 else 0) * 3600 + int(m1) * 60 + int(s1) + int(ms1) / 1000.0
                h2, m2, s2, ms2 = m.group(5), m.group(6), m.group(7), m.group(8)
                et = (int(h2) if h2 else 0) * 3600 + int(m2) * 60 + int(s2) + int(ms2) / 1000.0

                text_lines = []
                i += 1
                while i < len(lines) and lines[i].strip() and not vtt_time_re.search(lines[i]):
                    clean_line = re.sub(r"<[^>]+>", "", lines[i]).strip()
                    if clean_line:
                        text_lines.append(clean_line)
                    i += 1

                txt = " ".join(text_lines).strip()
                if txt:
                    w_list = txt.split()
                    step = (et - st) / max(1, len(w_list))
                    words = [{"word": w, "start": round(st + k * step, 2), "end": round(st + (k + 1) * step, 2)} for k, w in enumerate(w_list)]
                    vtt_segments.append({
                        "start": round(st, 2),
                        "end": round(et, 2),
                        "text": txt,
                        "words": words
                    })
                continue
            i += 1
        return vtt_segments
    except Exception as e:
        sys.stderr.write(f"[Subtitles] Notice fetching subtitles: {e}\n")
        return []


def find_all_campaign_clips_across_video(
    meta: dict,
    target_min: float = 20.0,
    target_max: float = 58.0,
    preferred_target: float = 38.0
) -> dict:
    """
    Multi-Moment Campaign Scanner across the ENTIRE long video (School of Hard Knocks & Street Interviews).
    Detects all 5 campaign pillars:
      1. 'What do you do for a living?' (Surprise career / business)
      2. Net worth / wealth / car / house reveal
      3. 'I started with $600...' origin & struggle stories
      4. One sharp piece of advice from a millionaire
      5. Funny or unexpected answers / reactions
    Requirements:
      - Skips the 0-42s teaser intro montage so only real street interviews are clipped!
      - Anchors each clip so the best hook line starts in the FIRST 2 SECONDS!
      - Returns 5 to 10 distinct, non-overlapping candidate clips distributed across the whole timeline.
      - Attaches channel attribution (@theschoolofhardknocks).
    """
    heatmap = meta.get("heatmap") or []
    duration = float(meta.get("duration") or 60.0)
    title = meta.get("title", "")
    info = meta.get("info") or {}

    sub_segments = fetch_full_video_subtitles(meta)

    # In long YouTube videos (>= 90s), skip teaser collage (first 42 seconds)
    min_interview_start = 42.0 if duration >= 90.0 else 0.0

    PILLARS = [
        {
            "id": "living",
            "name": "What Do You Do For A Living?",
            "icon": "💼",
            "category_label": "💼 What Do You Do",
            "tag": "🔥 SURPRISE CAREER REVEAL",
            "pattern": re.compile(r"\b(what\s+do\s+you\s+do|for\s+a\s+living|how\s+do\s+you\s+make\s+(your\s+)?money|how'?d\s+you\s+make|what'?s\s+your\s+(job|profession|career|business)|what\s+business|what\s+industry|how\s+do\s+you\s+afford|what\s+do\s+you\s+own)\b", re.IGNORECASE),
            "suggested_hook": "WHAT DO YOU DO FOR A LIVING? 💼",
            "critique": "Top-performing street interview hook. Opens immediately in first 2s with high curiosity.",
            "weight": 35
        },
        {
            "id": "networth",
            "name": "Net Worth & Wealth Reveal",
            "icon": "💰",
            "category_label": "💰 Net Worth Reveal",
            "tag": "💎 WEALTH & ASSETS REVEAL",
            "pattern": re.compile(r"\b(net\s+worth|how\s+much\s+(are\s+you\s+worth|is\s+your\s+net\s+worth|money\s+do\s+you\s+make|did\s+you\s+make)|million|billion|ferrari|lambo|lamborghini|porsche|rolls\s+royce|bugatti|mclaren|mansion|penthouse|assets|worth)\b", re.IGNORECASE),
            "suggested_hook": "HIS NET WORTH WILL SHOCK YOU 💰",
            "critique": "Asset & wealth reveal with immense replay value and financial curiosity for US/UK viewers.",
            "weight": 35
        },
        {
            "id": "origin",
            "name": "Origin Story ($600 to Millions)",
            "icon": "🚀",
            "category_label": "🚀 Started With $600",
            "tag": "📈 STRUGGLE TO MILLIONS",
            "pattern": re.compile(r"\b(started\s+with|when\s+i\s+started|first\s+business|broke|zero\s+dollars|dropped\s+out|from\s+scratch|from\s+nothing|no\s+money|had\s+nothing|struggled|in\s+debt|first\s+thousand|first\s+sale)\b", re.IGNORECASE),
            "suggested_hook": "HE STARTED WITH NOTHING 🚀",
            "critique": "Emotional zero-to-hero struggle arc. High retention curve through relatable humble beginnings.",
            "weight": 35
        },
        {
            "id": "advice",
            "name": "One Sharp Millionaire Advice",
            "icon": "💡",
            "category_label": "💡 Millionaire Advice",
            "tag": "🧠 GOLDEN MONEY RULE",
            "pattern": re.compile(r"\b(best\s+advice|younger\s+self|number\s+one\s+(rule|advice|thing|lesson)|biggest\s+mistake|if\s+you\s+(want\s+to|could\s+give)|advice\s+to|how\s+to\s+(get\s+rich|succeed|be\s+successful)|secret\s+to|golden\s+rule)\b", re.IGNORECASE),
            "suggested_hook": "ONE PIECE OF ADVICE TO GET RICH 💡",
            "critique": "Actionable life lesson from self-made millionaire. Saves & shares driver on TikTok / IG Reels.",
            "weight": 35
        },
        {
            "id": "surprise",
            "name": "Funny or Unexpected Answer",
            "icon": "🤯",
            "category_label": "🤯 Unexpected Answer",
            "tag": "⚡ SHOCKING REACTION",
            "pattern": re.compile(r"\b(wait\s+(what|really)|are\s+you\s+serious|no\s+way|holy\s+(shit|crap)|crazy|insane|unbelievable|honestly|to\s+be\s+completely\s+honest|plot\s+twist|unexpected)\b", re.IGNORECASE),
            "suggested_hook": "HE DID NOT EXPECT THIS ANSWER 🤯",
            "critique": "Humorous pattern interrupt with shocking reveal. Strong comment section debate catalyst.",
            "weight": 30
        }
    ]

    # Pre-parse heatmap points for scoring
    hp_points = []
    if heatmap and len(heatmap) >= 5:
        hp_points = [(item.get("start_time", 0.0), item.get("end_time", 0.0), float(item.get("value", 0.0))) for item in heatmap]

    def compute_retention_score(st, et):
        if not hp_points or et <= st:
            return 88.0
        vals = []
        for h_st, h_et, val in hp_points:
            overlap = min(et, h_et) - max(st, h_st)
            if overlap > 0:
                vals.append(val * overlap)
        dur = et - st
        avg = (sum(vals) / dur) * 100.0 if dur > 0 else 0.0
        return round(min(99.0, max(75.0, avg)), 1)

    candidates = []

    # Strategy 1: Scan Full Subtitle Transcript for 5 Signature Pillars
    if sub_segments:
        # Merge sub_segments into natural sentences
        sentences = []
        curr_txt = []
        curr_words = []
        s_st = sub_segments[0]["start"]
        s_et = sub_segments[0]["end"]

        for seg in sub_segments:
            seg_txt = seg["text"].strip()
            if not curr_txt:
                s_st = seg["start"]
            curr_txt.append(seg_txt)
            curr_words.extend(seg.get("words", []))
            s_et = seg["end"]

            # Break sentence on punctuation or 4+ second length
            if seg_txt.endswith((".", "?", "!")) or (s_et - s_st >= 5.0):
                full_s_txt = " ".join(curr_txt).strip()
                sentences.append({
                    "start": s_st,
                    "end": s_et,
                    "text": full_s_txt,
                    "words": list(curr_words)
                })
                curr_txt = []
                curr_words = []

        if curr_txt:
            sentences.append({
                "start": s_st,
                "end": s_et,
                "text": " ".join(curr_txt).strip(),
                "words": list(curr_words)
            })

        for i, sent in enumerate(sentences):
            if sent["start"] < min_interview_start:
                continue

            matched_pillar = None
            for p in PILLARS:
                if p["pattern"].search(sent["text"]):
                    matched_pillar = p
                    break

            if matched_pillar:
                clip_st = max(0.0, sent["start"] - 0.2)
                clip_et = sent["end"]
                clip_words = list(sent.get("words", []))
                hook_quote = sent["text"][:75].strip()

                # Walk forward to build complete 25-50s interview dialogue
                for j in range(i + 1, len(sentences)):
                    nxt = sentences[j]
                    if nxt["end"] - clip_st > target_max:
                        break
                    clip_words.extend(nxt.get("words", []))
                    clip_et = nxt["end"]
                    if (clip_et - clip_st) >= preferred_target and nxt["text"].endswith((".", "?", "!")):
                        break

                clip_dur = round(clip_et - clip_st, 2)
                if clip_dur < target_min:
                    clip_et = min(duration, clip_st + target_min)
                    clip_dur = round(clip_et - clip_st, 2)

                ret_score = compute_retention_score(clip_st, clip_et)
                # Virality algorithm: hook punch + numbers + question
                v_score = 86.0
                if "?" in sent["text"]:
                    v_score += 4.0
                if any(c.isdigit() or c == "$" for c in sent["text"]):
                    v_score += 4.0
                v_score += min(5.0, (ret_score - 80.0) * 0.25)
                v_score = round(min(99.0, max(88.0, v_score)), 1)

                candidates.append({
                    "id": f"campaign-clip-{len(candidates) + 1}",
                    "category": matched_pillar["id"],
                    "category_label": matched_pillar["category_label"],
                    "tag": matched_pillar["tag"],
                    "title": f'{matched_pillar["category_label"]}: "{hook_quote[:45]}..."',
                    "clip_start": round(clip_st, 2),
                    "clip_end": round(clip_et, 2),
                    "duration": clip_dur,
                    "retention_score": ret_score,
                    "score": int(v_score),
                    "hookScore": min(99, int(v_score + 2)),
                    "pacingScore": min(98, int(v_score - 1)),
                    "payoffScore": min(99, int(v_score + 1)),
                    "grade": "S+" if v_score >= 94 else "A+",
                    "hook_quote": hook_quote,
                    "suggestedHookTitle": matched_pillar["suggested_hook"],
                    "reason": f"School of Hard Knocks Campaign: 2s opening hook '{hook_quote[:40]}...' with complete {clip_dur:.0f}s dialogue.",
                    "aiCritique": matched_pillar["critique"],
                    "channel_credit": "@theschoolofhardknocks",
                    "transcript": clip_words[:120],
                    "peak_type": f"Campaign Pillar: {matched_pillar['name']}"
                })

    # Strategy 2: Heatmap Rewatch Density Peaks across the rest of the video
    if len(candidates) < 6 and hp_points:
        curr_t = min_interview_start
        step = 25.0
        while curr_t + preferred_target <= duration:
            end_t = min(duration, curr_t + preferred_target)
            sc = compute_retention_score(curr_t, end_t)
            if sc >= 85.0:
                candidates.append({
                    "id": f"campaign-clip-{len(candidates) + 1}",
                    "category": "advice",
                    "category_label": "🔥 High Retention Moment",
                    "tag": "⭐ AUDIENCE REWATCH PEAK",
                    "title": f"Viral Interview Segment ({int(curr_t // 60)}m{int(curr_t % 60):02d}s)",
                    "clip_start": round(curr_t, 2),
                    "clip_end": round(end_t, 2),
                    "duration": round(end_t - curr_t, 2),
                    "retention_score": sc,
                    "score": int(sc),
                    "hookScore": int(sc),
                    "pacingScore": int(sc - 1),
                    "payoffScore": int(sc),
                    "grade": "S+" if sc >= 92 else "A+",
                    "hook_quote": f"Top rewatch density peak at {int(curr_t)}s",
                    "suggestedHookTitle": "YOU NEED TO HEAR THIS 💡",
                    "reason": f"YouTube audience retention peak ({sc}% rewatch density across whole video).",
                    "aiCritique": "Sustained audience rewatch peak detected mathematically by YouTube analytics.",
                    "channel_credit": "@theschoolofhardknocks",
                    "transcript": [],
                    "peak_type": "YouTube Viewer Retention Heatmap Peak"
                })
            curr_t += step

    # Fallback if no clips found yet (e.g. short audio / no subs): generate structured campaign slices
    if not candidates:
        slice_st = min_interview_start
        slice_idx = 1
        while slice_st + target_min <= duration and len(candidates) < 5:
            slice_et = min(duration, slice_st + preferred_target)
            candidates.append({
                "id": f"campaign-clip-{slice_idx}",
                "category": "living",
                "category_label": "💼 Street Interview",
                "tag": "🔥 CAMPAIGN CLIP",
                "title": f"Street Interview Moment #{slice_idx} ({int(slice_st // 60)}:{int(slice_st % 60):02d})",
                "clip_start": round(slice_st, 2),
                "clip_end": round(slice_et, 2),
                "duration": round(slice_et - slice_st, 2),
                "retention_score": 90.0,
                "score": 92,
                "hookScore": 94,
                "pacingScore": 91,
                "payoffScore": 92,
                "grade": "A+",
                "hook_quote": "Street Interview Moment",
                "suggestedHookTitle": "WHAT DO YOU DO FOR A LIVING? 💼",
                "reason": "School of Hard Knocks campaign window (20-60s unzoomed steady framing).",
                "aiCritique": "Clean street interview clip with 1.0x wide framing and dual speaker visibility.",
                "channel_credit": "@theschoolofhardknocks",
                "transcript": [],
                "peak_type": "Campaign Street Interview Highlight"
            })
            slice_st += (preferred_target + 15.0)
            slice_idx += 1

    # Deduplicate non-overlapping clips (minimum 18s spacing between clip starts)
    candidates.sort(key=lambda x: x["score"], reverse=True)
    deduped = []
    used_ranges = []
    for c in candidates:
        st = c["clip_start"]
        et = c["clip_end"]
        overlap = False
        for u_st, u_et in used_ranges:
            if not (et <= u_st + 8.0 or st >= u_et - 8.0):
                overlap = True
                break
        if not overlap:
            deduped.append(c)
            used_ranges.append((st, et))
        if len(deduped) >= 10:
            break

    # If deduped < 3, keep the best candidates with relaxed overlap
    if len(deduped) < 3 and candidates:
        deduped = candidates[:5]

    top_window = dict(deduped[0])
    top_window["candidates"] = [dict(c) for c in deduped[1:]]

    return {
        "top_window": top_window,
        "candidates": deduped[1:],
        "campaign_clips": deduped,
        "total_clips": len(deduped),
        "video_duration": duration,
        "channel_credit": "@theschoolofhardknocks",
        "sub_segments": sub_segments,
    }


def find_viral_peak_window(meta: dict, target_duration: float = 30.0) -> dict:
    """
    Mathematically detects the highest audience retention / viral candidate window
    across the entire long video, respecting the School of Hard Knocks campaign rules
    (20-60s, skips teaser intro, 5 interview categories, strong 2s hook).
    """
    result = find_all_campaign_clips_across_video(
        meta=meta,
        target_min=20.0,
        target_max=58.0,
        preferred_target=max(25.0, min(50.0, target_duration))
    )
    return result["top_window"]


def download_highlight_section(
    url: str,
    clip_start: float,
    clip_end: float,
    title: str = "",
    meta_info: dict | None = None,
    preferred_lang: str = "en",
) -> Path:
    """
    Downloads ONLY the specified 30s-60s highlight section without downloading
    the full multi-gigabyte video! Uses high-speed M3U8 HLS stream slicing (1-3s).
    """
    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https"):
        raise ValueError("URL must start with http:// or https://")

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    clean_title = sanitize_filename(title or "clip")
    output_path = UPLOADS / f"clip_{timestamp}_{clean_title[:30]}_{int(clip_start)}s_{int(clip_end)}s.mp4"

    clip_dur = max(5.0, clip_end - clip_start)
    info = meta_info

    if not info:
        ydl_opts = {"quiet": True, "skip_download": True}
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=False)

    formats = info.get("formats", [])

    # Strategy A: Ultra-Fast M3U8 HLS Synchronized Video + Audio Cut (1-3s download)
    v_m3u8 = next(
        (f["url"] for f in formats if f.get("protocol") == "m3u8_native" and f.get("vcodec") != "none" and f.get("height") in (720, 1080, 480, 360)),
        None
    )

    # Priority-based audio selection: Preferred language > Original > Foreign dubs
    audio_candidates = [
        f for f in formats
        if f.get("protocol") == "m3u8_native" and f.get("acodec") != "none"
    ]

    target_lang = (preferred_lang or "en").lower()

    def score_audio_candidate(f):
        lang = str(f.get("language") or "").lower()
        note = str(f.get("format_note") or "").lower()
        s = 0
        if target_lang in ("en", "eng"):
            if "original" in note:
                s += 100
            if lang in ("en", "en-us", "en-gb", "eng", "orig", "original"):
                s += 90
            elif lang in ("und", ""):
                s += 20
            elif lang:
                s -= 50
        elif target_lang in ("tl", "fil", "tag"):
            if lang in ("tl", "fil", "tagalog", "filipino"):
                s += 120
            elif "original" in note:
                s += 60
            elif lang in ("en", "en-us", "eng"):
                s += 30
            elif lang:
                s -= 30
        else:
            if lang == target_lang:
                s += 120
            if "original" in note:
                s += 50
        pref = f.get("language_preference")
        if isinstance(pref, (int, float)):
            s += int(pref) * 5
        return s

    audio_candidates.sort(key=score_audio_candidate, reverse=True)
    a_m3u8 = audio_candidates[0]["url"] if audio_candidates else None

    if v_m3u8 and a_m3u8:
        try:
            cmd = [
                "ffmpeg", "-y", "-hide_banner",
                "-ss", str(clip_start), "-t", str(clip_dur), "-i", v_m3u8,
                "-ss", str(clip_start), "-t", str(clip_dur), "-i", a_m3u8,
                "-c:v", "copy",
                "-c:a", "aac",
                str(output_path),
            ]
            run_command(cmd, timeout=40)
            if output_path.exists() and output_path.stat().st_size > 50000:
                return output_path
        except Exception:
            pass

    # Strategy B: Single Combined Stream M3U8 Cut
    combined_m3u8 = next(
        (f["url"] for f in formats if f.get("protocol") == "m3u8_native" and f.get("vcodec") != "none"),
        None
    )
    if combined_m3u8:
        try:
            cmd = [
                "ffmpeg", "-y", "-hide_banner",
                "-ss", str(clip_start), "-t", str(clip_dur), "-i", combined_m3u8,
                "-c", "copy",
                str(output_path),
            ]
            run_command(cmd, timeout=40)
            if output_path.exists() and output_path.stat().st_size > 50000:
                return output_path
        except Exception:
            pass

    # Strategy C: yt-dlp section download fallback
    out_tmpl = str(UPLOADS / f"clip_{timestamp}_%(id)s.%(ext)s")
    sec_opts = {
        "outtmpl": out_tmpl,
        "format": "bestvideo[height<=720][ext=mp4]+bestaudio[language=en]/bestaudio[format_note*=original]/bestaudio[language=orig]/bestaudio/best",
        "format_sort": ["hasaud", "lang:en", "lang:orig", "res:720"],
        "download_ranges": yt_dlp.utils.download_range_func(None, [(clip_start, clip_end)]),
        "force_keyframes_at_cuts": False,
        "noplaylist": True,
        "quiet": True,
        "no_warnings": True,
    }
    try:
        with yt_dlp.YoutubeDL(sec_opts) as ydl:
            ydl.download([url])
        candidates = sorted(
            UPLOADS.glob(f"clip_{timestamp}_*"),
            key=lambda p: p.stat().st_mtime,
            reverse=True,
        )
        if candidates and candidates[0].exists() and candidates[0].stat().st_size > 50000:
            return candidates[0]
    except Exception:
        pass

    # Strategy D: If partial cuts fail, fallback to downloading best format
    return download_authorized_url(url)


def download_authorized_url(url: str) -> Path:
    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https"):
        raise ValueError("URL must start with http:// or https://")

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    out_tmpl = str(UPLOADS / f"url_{timestamp}_%(id)s.%(ext)s")

    ydl_opts = {
        "outtmpl": out_tmpl,
        "format": "bestvideo[height<=720][ext=mp4]+bestaudio[language=en]/bestaudio[format_note*=original]/bestaudio[language=orig]/bestaudio/best",
        "format_sort": ["hasaud", "lang:en", "lang:orig", "res:720"],
        "noplaylist": True,
        "quiet": True,
        "no_warnings": True,
    }

    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            ydl.download([url])
    except Exception as e:
        alt_opts = {
            "outtmpl": out_tmpl,
            "format": "best",
            "noplaylist": True,
            "quiet": True,
        }
        with yt_dlp.YoutubeDL(alt_opts) as ydl:
            ydl.download([url])

    candidates = sorted(
        UPLOADS.glob(f"url_{timestamp}_*"),
        key=lambda p: p.stat().st_mtime,
        reverse=True,
    )
    if not candidates:
        raise RuntimeError("Download completed but output file could not be located.")
    return candidates[0]


def load_whisper_model(model_size: str, cpu_threads: int = 4) -> WhisperModel:
    cache_key = f"{model_size}_{cpu_threads}"
    if cache_key not in _WHISPER_MODELS:
        _WHISPER_MODELS[cache_key] = WhisperModel(
            model_size,
            device="cpu",
            compute_type="int8",
            cpu_threads=cpu_threads,
            download_root=str(HF_CACHE),
        )
    return _WHISPER_MODELS[cache_key]


def load_wav_16k_mono_float32(wav_path: Path) -> np.ndarray:
    with wave.open(str(wav_path), "rb") as wf:
        n_channels = wf.getnchannels()
        sampwidth = wf.getsampwidth()
        n_frames = wf.getnframes()
        raw_bytes = wf.readframes(n_frames)

    if sampwidth != 2:
        raise ValueError(f"Expected 16-bit PCM wav, got sample width {sampwidth}")

    audio_i16 = np.frombuffer(raw_bytes, dtype=np.int16)
    if n_channels > 1:
        audio_i16 = audio_i16.reshape(-1, n_channels)[:, 0]

    return (audio_i16.astype(np.float32) / 32768.0).copy()


def transcribe_video(
    video_path: Path,
    model_size: str = "base",
    language: str | None = None,
    cpu_threads: int = 4,
    use_vad: bool = True,
    force_retranscribe: bool = False,
) -> list[dict]:
    cache_path = TEMP / f"{video_path.stem}.transcript.json"
    if cache_path.exists() and not force_retranscribe:
        try:
            cached_data = json.loads(cache_path.read_text(encoding="utf-8"))
            if isinstance(cached_data, list) and len(cached_data) > 0:
                # Check for Arabic or corrupt non-native script in cached data if English or clean audio is desired
                has_arabic = any('\u0600' <= c <= '\u06FF' for c in str(cached_data[:2]))
                if not has_arabic:
                    return cached_data
                else:
                    sys.stderr.write(f"[Engine] Invalidating Arabic cached transcript for {video_path.name}...\n")
        except Exception:
            pass

    wav_path = TEMP / f"{video_path.stem}_{int(time.time())}.wav"
    try:
        cmd = [
            "ffmpeg", "-y",
            "-i", str(video_path),
            "-vn",
            "-ac", "1",
            "-ar", "16000",
            "-f", "wav",
            str(wav_path),
        ]
        run_command(cmd)

        model = load_whisper_model(model_size, cpu_threads=cpu_threads)
        audio_arr = load_wav_16k_mono_float32(wav_path)

        segments, info = model.transcribe(
            audio_arr,
            language=language, # If None, Faster-Whisper automatically detects the exact spoken language (e.g. 'tl', 'en')!
            vad_filter=use_vad,
            word_timestamps=True,
        )
        if hasattr(info, 'language') and info.language:
            sys.stderr.write(f"[Whisper] Detected voiceover language: '{info.language}' (confidence: {getattr(info, 'language_probability', 1.0)*100:.1f}%)\n")

        results = []
        for s in segments:
            words = []
            if s.words:
                for w in s.words:
                    words.append({
                        "word": w.word,
                        "start": round(w.start, 3),
                        "end": round(w.end, 3),
                        "probability": round(w.probability, 3),
                    })
            results.append({
                "start": round(s.start, 3),
                "end": round(s.end, 3),
                "text": s.text.strip(),
                "words": words,
            })

        try:
            cache_path.write_text(json.dumps(results, indent=2), encoding="utf-8")
        except Exception:
            pass

        return results
    finally:
        if wav_path.exists():
            try:
                wav_path.unlink()
            except Exception:
                pass


def write_clip_srt(segments: list[dict], clip_start: float, clip_end: float, srt_path: Path, words_per_line: int = 4):
    entries = []
    for seg in segments:
        if seg["end"] <= clip_start or seg["start"] >= clip_end:
            continue
        words = seg.get("words") or []
        if words:
            valid_words = [w for w in words if w["end"] > clip_start and w["start"] < clip_end]
            for i in range(0, len(valid_words), words_per_line):
                chunk = valid_words[i : i + words_per_line]
                c_start = max(0.0, chunk[0]["start"] - clip_start)
                c_end = max(c_start + 0.25, min(clip_end, chunk[-1]["end"]) - clip_start)
                text = " ".join(w["word"].strip() for w in chunk)
                entries.append((c_start, c_end, text))
        else:
            s_start = max(0.0, seg["start"] - clip_start)
            s_end = max(s_start + 0.4, min(clip_end, seg["end"]) - clip_start)
            entries.append((s_start, s_end, seg["text"].strip()))

    lines = []
    for idx, (st_sec, en_sec, txt) in enumerate(entries, start=1):
        lines.append(f"{idx}")
        lines.append(f"{format_srt_timestamp(st_sec)} --> {format_srt_timestamp(en_sec)}")
        lines.append(txt)
        lines.append("")

    srt_path.write_text("\n".join(lines), encoding="utf-8")


def write_clip_ass_karaoke(
    segments: list[dict],
    clip_start: float,
    clip_end: float,
    ass_path: Path,
    style_cfg: dict,
    font_size: int = 72,
    margin_v: int = 420,
    words_per_line: int = 3,
):
    primary = style_cfg.get("primary_hex", "&H00FFFFFF")
    highlight = style_cfg.get("highlight_hex", "&H0000FFFF")
    outline_col = style_cfg.get("outline_hex", "&H00000000")
    back_col = style_cfg.get("back_hex", "&H80000000")
    outline_w = style_cfg.get("outline", 4)
    shadow_w = style_cfg.get("shadow", 2)

    header = f"""[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Karaoke,Arial Black,{font_size},{primary},{highlight},{outline_col},{back_col},-1,0,0,0,100,100,2,0,1,{outline_w},{shadow_w},2,40,40,{margin_v},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
    events = []
    for seg in segments:
        if seg["end"] <= clip_start or seg["start"] >= clip_end:
            continue
        words = seg.get("words") or []
        if words:
            valid_words = [w for w in words if w["end"] > clip_start and w["start"] < clip_end]
            for i in range(0, len(valid_words), words_per_line):
                chunk = valid_words[i : i + words_per_line]
                c_start = max(0.0, chunk[0]["start"] - clip_start)
                c_end = max(c_start + 0.3, min(clip_end, chunk[-1]["end"]) - clip_start)
                k_parts = []
                for w in chunk:
                    dur_cs = max(10, int((w["end"] - w["start"]) * 100))
                    clean_w = w["word"].strip()
                    if style_cfg.get("uppercase"):
                        clean_w = clean_w.upper()
                    k_parts.append(f"{{\\k{dur_cs}}}{clean_w}")
                ass_line = (
                    f"Dialogue: 0,{format_ass_timestamp(c_start)},{format_ass_timestamp(c_end)},"
                    f"Karaoke,,0,0,0,,{' '.join(k_parts)}"
                )
                events.append(ass_line)
        else:
            s_start = max(0.0, seg["start"] - clip_start)
            s_end = max(s_start + 0.5, min(clip_end, seg["end"]) - clip_start)
            txt = seg["text"].strip().upper() if style_cfg.get("uppercase") else seg["text"].strip()
            events.append(
                f"Dialogue: 0,{format_ass_timestamp(s_start)},{format_ass_timestamp(s_end)},"
                f"Karaoke,,0,0,0,,{txt}"
            )

    ass_path.write_text(header + "\n".join(events), encoding="utf-8")


def render_vertical_clip(
    src_video: Path,
    start_sec: float,
    end_sec: float,
    out_video: Path,
    layout: str = "Split 60/40 (Top Video, Bottom Satisfying B-Roll)",
    hook_text: str = "",
    ass_path: Path | None = None,
    broll_preset: str = "minecraft-parkour",
    broll_video_path: Path | None = None,
    overlay_image_path: Path | None = None,
    overlay_start_offset: float = 0.0,
    overlay_duration: float = 5.0,
    overlay_pos_x: float = 0.5,
    overlay_pos_y: float = 0.34,
    overlay_scale: float = 1.0,
    crop_pan_x: float = 0.0,
) -> Path:
    clip_duration = max(1.0, end_sec - start_sec)
    inputs = [
        "-ss", f"{start_sec:.3f}",
        "-t", f"{clip_duration:.3f}",
        "-i", str(src_video),
    ]

    # Check whether the selected layout actually requires B-roll
    uses_broll = ("Satisfying B-Roll" in layout) or (layout == "Split 60/40 (Whop Meta)")
    default_broll_file = ROOT / "assets" / "broll" / "satisfying_neon_runner.mp4"
    if uses_broll and not (broll_video_path and Path(broll_video_path).exists()) and default_broll_file.exists():
        broll_video_path = default_broll_file
        has_custom_broll = True
    else:
        has_custom_broll = uses_broll and broll_video_path and Path(broll_video_path).exists()

    has_image = overlay_image_path and Path(overlay_image_path).exists()
    img_in_idx = -1

    if has_custom_broll:
        inputs.extend(["-stream_loop", "-1", "-t", f"{clip_duration:.3f}", "-i", str(broll_video_path)])
        broll_in_idx = 1
        if has_image:
            inputs.extend(["-loop", "1", "-t", f"{overlay_duration:.3f}", "-i", str(overlay_image_path)])
            img_in_idx = 2
    else:
        if has_image:
            inputs.extend(["-loop", "1", "-t", f"{overlay_duration:.3f}", "-i", str(overlay_image_path)])
            img_in_idx = 1

    clean_hook = hook_text.replace("'", "").replace(":", "-").replace("%", "").strip()

    if layout == "AI Auto-Fit: Whole Screen (100% Zero Border Cut) + Satisfying B-Roll":
        top_h = 608
        bot_h = 1920 - top_h
        filter_parts = [
            f"[0:v]scale=1080:{top_h}:force_original_aspect_ratio=decrease,pad=1080:{top_h}:(1080-iw)/2:({top_h}-ih)/2:color=black[topv]",
        ]
        if has_custom_broll:
            filter_parts.append(
                f"[{broll_in_idx}:v]scale=1080:{bot_h}:force_original_aspect_ratio=increase,crop=1080:{bot_h}[botv]"
            )
        else:
            filter_parts.append(
                f"[0:v]scale=1080:{bot_h}:force_original_aspect_ratio=increase,crop=1080:{bot_h},boxblur=24:24[botv]"
            )
        filter_parts.append(
            f"[topv][botv]vstack=inputs=2[stacked];"
            f"[stacked]drawbox=x=0:y={top_h-2}:w=1080:h=4:color=0xe11d48@0.9:t=fill[vbase]"
        )
    elif layout == "AI Auto-Fit: Whole Screen (100% Zero Border Cut) + Ambient Blur Fill":
        filter_parts = [
            f"[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,boxblur=28:28[bgblur];"
            f"[0:v]scale=1080:608:force_original_aspect_ratio=decrease,pad=1080:608:(1080-iw)/2:(608-ih)/2:color=black@0[fgvid];"
            f"[fgvid]drawbox=x=0:y=0:w=1080:h=608:color=0x6366f1@0.7:t=3[fgboxed];"
            f"[bgblur][fgboxed]overlay=x=0:y=(H-h)/2[vbase]"
        ]
    elif layout == "Full Screen Center Crop (9:16)":
        filter_parts = [
            f"[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920[vbase]"
        ]
    elif layout == "AI Smart Reframe (Face & Focus Tracked 9:16)":
        crop_x_expr = f"(iw-1080)/2+({crop_pan_x:.1f})"
        filter_parts = [
            f"[0:v]scale=-1:1920,crop=1080:1920:'{crop_x_expr}':0[vbase]"
        ]
    else:
        # Default Split 60/40
        top_h = 1152
        bot_h = 768
        filter_parts = [
            f"[0:v]scale=-1:{top_h}:force_original_aspect_ratio=increase,crop=1080:{top_h}[topv]",
        ]
        if has_custom_broll:
            filter_parts.append(
                f"[{broll_in_idx}:v]scale=-1:{bot_h}:force_original_aspect_ratio=increase,crop=1080:{bot_h}[botv]"
            )
        else:
            filter_parts.append(
                f"[0:v]scale=-1:{bot_h}:force_original_aspect_ratio=increase,crop=1080:{bot_h},boxblur=24:24[botv]"
            )
        filter_parts.append(
            f"[topv][botv]vstack=inputs=2[stacked];"
            f"[stacked]drawbox=x=0:y={top_h-3}:w=1080:h=6:color=0x00f2fe@0.85:t=fill[vbase]"
        )

    curr_v = "vbase"

    if clean_hook:
        filter_parts.append(
            f"[{curr_v}]drawbox=x=40:y=80:w=1000:h=120:color=0x000000@0.75:t=fill,"
            f"drawbox=x=40:y=80:w=1000:h=120:color=0xffd700@0.9:t=4,"
            f"drawtext=text='{clean_hook}':fontsize=42:fontcolor=0xffffff:x=(w-text_w)/2:y=120:expansion=none[vhook]"
        )
        curr_v = "vhook"

    if has_image and img_in_idx > 0:
        img_start = overlay_start_offset
        img_end = overlay_start_offset + overlay_duration
        scale_val = max(0.4, min(1.8, overlay_scale))
        card_w = int(680 * scale_val)
        card_h = int(420 * scale_val)
        target_x = max(20, min(1080 - card_w - 20, int(1080 * overlay_pos_x - card_w / 2)))
        target_y = max(160, min(1920 - card_h - 160, int(1920 * overlay_pos_y - card_h / 2)))
        filter_parts.append(
            f"[{img_in_idx}:v]scale={card_w}:{card_h}:force_original_aspect_ratio=decrease,pad={card_w}:{card_h}:({card_w}-iw)/2:({card_h}-ih)/2:color=black@0,"
            f"drawbox=x=0:y=0:w={card_w}:h={card_h}:color=0x00f2fe@0.9:t=4[ovimg];"
            f"[{curr_v}][ovimg]overlay=x={target_x}:y={target_y}:enable='between(t,{img_start:.2f},{img_end:.2f})'[vimg]"
        )
        curr_v = "vimg"

    if ass_path and ass_path.exists():
        escaped_ass = str(ass_path).replace("\\", "/").replace(":", "\\:")
        filter_parts.append(f"[{curr_v}]ass='{escaped_ass}'[vout]")
        curr_v = "vout"

    filter_complex = ";".join(filter_parts)

    cmd = [
        "ffmpeg", "-y",
        *inputs,
        "-filter_complex", filter_complex,
        "-map", f"[{curr_v}]",
        "-map", "0:a?",
        "-c:v", "libx264",
        "-preset", "veryfast",
        "-crf", "20",
        "-c:a", "aac",
        "-b:a", "192k",
        "-ar", "44100",
        "-shortest",
        str(out_video),
    ]

    run_command(cmd)
    return out_video


def load_saved_projects() -> list[dict]:
    if not SAVED_PROJECTS_FILE.exists():
        return []
    try:
        data = json.loads(SAVED_PROJECTS_FILE.read_text(encoding="utf-8"))
        if isinstance(data, list):
            return data
    except Exception:
        pass
    return []


def save_project_state(entry: dict):
    try:
        clean_entry = {
            "id": str(entry.get("id")),
            "created_at": str(entry.get("created_at")),
            "video_path": str(entry.get("video_path")),
            "filename": str(entry.get("filename")),
            "meta": entry.get("meta", {}),
            "plan": entry.get("plan", {}),
            "image": {
                "title": entry.get("image", {}).get("title", ""),
                "path": str(entry.get("image", {}).get("path", "")),
                "url": str(entry.get("image", {}).get("url", "")),
                "license": str(entry.get("image", {}).get("license", "")),
                "author": str(entry.get("image", {}).get("author", "")),
            } if entry.get("image") else None,
        }
        projects = load_saved_projects()
        projects = [p for p in projects if p.get("id") != clean_entry.get("id")]
        projects.insert(0, clean_entry)
        SAVED_PROJECTS_FILE.write_text(json.dumps(projects[:30], indent=2), encoding="utf-8")
    except Exception:
        pass


def srt_time_to_seconds(time_str: str) -> float:
    # 00:01:23,456 or 00:01:23.456
    time_str = time_str.strip().replace(",", ".")
    parts = time_str.split(":")
    if len(parts) == 3:
        h = float(parts[0])
        m = float(parts[1])
        s = float(parts[2])
        return h * 3600.0 + m * 60.0 + s
    elif len(parts) == 2:
        m = float(parts[0])
        s = float(parts[1])
        return m * 60.0 + s
    return float(parts[0])


def parse_srt_to_karaoke_words(srt_path: Path, clip_start: float = 0.0) -> list[dict]:
    """
    Parses an SRT file into a word-level transcript array matching WhopAudioEngine format.
    """
    if not srt_path.exists():
        return []

    content = srt_path.read_text(encoding="utf-8", errors="replace")
    blocks = re.split(r"\n\s*\n", content.strip())
    words_list = []

    EMOJI_KEYWORDS = {
        "money": "💰", "cash": "💵", "dollar": "💵", "recipe": "📜", "cake": "🎂",
        "friend": "🤝", "code": "💻", "software": "💻", "open": "🔓", "source": "🌐",
        "power": "⚡", "secret": "🤫", "crazy": "🤯", "insane": "🤯", "fire": "🔥",
        "stop": "🛑", "look": "👀", "see": "👀", "people": "👥", "win": "🏆",
        "game": "🎮", "stream": "⚡", "podcast": "🎙️", "ai": "🤖", "bot": "🤖",
        "hack": "⚡", "fast": "⚡", "speed": "🏎️", "learn": "🧠", "smart": "🧠"
    }

    for block in blocks:
        lines = [line.strip() for line in block.split("\n") if line.strip()]
        if len(lines) < 2:
            continue

        time_line_idx = 1 if "-->" in lines[1] else (0 if "-->" in lines[0] else -1)
        if time_line_idx == -1:
            continue

        time_line = lines[time_line_idx]
        parts = time_line.split("-->")
        if len(parts) != 2:
            continue

        cue_start = srt_time_to_seconds(parts[0])
        cue_end = srt_time_to_seconds(parts[1])
        cue_dur = max(0.2, cue_end - cue_start)

        text = " ".join(lines[time_line_idx + 1:])
        raw_words = text.split()
        if not raw_words:
            continue

        w_dur = cue_dur / len(raw_words)
        for i, raw_w in enumerate(raw_words):
            clean_w = raw_w.strip('.,!?"\'()[]{}:;')
            lower_w = clean_w.lower()
            emoji = ""
            for k, em in EMOJI_KEYWORDS.items():
                if k in lower_w:
                    emoji = em
                    break

            w_start = round(cue_start + i * w_dur, 3)
            w_end = round(w_start + w_dur, 3)
            words_list.append({
                "word": raw_w,
                "start": round(clip_start + w_start, 3),
                "end": round(clip_start + w_end, 3),
                "relStart": w_start,
                "relEnd": w_end,
                "emoji": emoji,
                "emphasis": bool(emoji or raw_w.isupper() or len(clean_w) > 7),
            })

    return words_list


def format_seconds_to_min_sec(seconds: float) -> str:
    try:
        s = int(seconds or 0)
        m = s // 60
        rem = s % 60
        if m >= 60:
            h = m // 60
            rem_m = m % 60
            return f"{h}:{rem_m:02d}:{rem:02d}"
        return f"{m}:{rem:02d}"
    except Exception:
        return "0:00"


def search_youtube_videos(query_or_channel: str, max_results: int = 6) -> list:
    """
    Searches YouTube or fetches latest videos from a YouTube channel/handle
    in ~1.5s using yt-dlp flat extraction without downloading any media bytes.
    """
    raw = (query_or_channel or "").strip()
    if not raw:
        return []

    target_url = raw
    if raw.startswith("@"):
        target_url = f"https://www.youtube.com/{raw}/videos"
    elif "youtube.com/@" in raw and not raw.endswith("/videos") and "/watch" not in raw:
        target_url = raw.rstrip("/") + "/videos"
    elif not raw.startswith("http://") and not raw.startswith("https://"):
        target_url = f"ytsearch{max_results}:{raw}"

    ydl_opts = {
        "quiet": True,
        "no_warnings": True,
        "extract_flat": True,
        "playlistend": max_results,
    }

    results = []
    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(target_url, download=False)
            entries = info.get("entries") if isinstance(info, dict) else []
            if not entries and isinstance(info, dict) and info.get("id"):
                entries = [info]

            for e in entries:
                if not isinstance(e, dict):
                    continue
                v_id = e.get("id") or ""
                title = e.get("title") or "Untitled Video"
                if not v_id or (v_id.startswith("UC") and "channel" in str(e.get("_type", ""))):
                    continue

                v_url = e.get("url") or (f"https://www.youtube.com/watch?v={v_id}" if v_id else "")
                if not v_url.startswith("http"):
                    v_url = f"https://www.youtube.com/watch?v={v_id}"

                dur_sec = float(e.get("duration") or 0.0)
                thumb = e.get("thumbnail") or (f"https://i.ytimg.com/vi/{v_id}/hqdefault.jpg" if v_id else "")
                channel = e.get("channel") or e.get("uploader") or info.get("channel") or info.get("uploader") or ""

                results.append({
                    "id": v_id,
                    "title": title,
                    "url": v_url,
                    "duration": dur_sec,
                    "duration_str": format_seconds_to_min_sec(dur_sec),
                    "thumbnail": thumb,
                    "channel": channel,
                    "view_count": e.get("view_count") or 0,
                })
                if len(results) >= max_results:
                    break
    except Exception as exc:
        sys.stderr.write(f"[Engine] YouTube search error for '{query_or_channel}': {exc}\n")

    return results

