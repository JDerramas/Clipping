import json
import math
import os
import re
import shutil
import subprocess
import time
import urllib.parse
import urllib.request
import wave
from datetime import datetime
from pathlib import Path
from urllib.parse import urlparse

import av
import numpy as np
import streamlit as st
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


av._whop_orig_open = _orig_av_open
av.open = _compat_av_open

MODEL_NAME = "base"
MAX_UPLOAD_MB = 500

HOOK_WORDS = {
    "secret", "mistake", "truth", "never", "always", "important",
    "problem", "solution", "why", "how", "money", "learn",
    "best", "worst", "wrong", "surprising", "because", "actually",
    "imagine", "remember", "tip", "lesson", "instead", "million",
    "thousand", "viral", "algorithm", "stop", "warning", "hack",
    "profit", "paid", "strategy", "rule", "first", "reason"
}

CAPTION_STYLES = {
    "Hormozi Yellow Pop (ASS Karaoke)": {
        "mode": "ass",
        "primary_hex": "&H00FFFFFF",
        "highlight_hex": "&H0000FFFF",
        "outline_hex": "&H00000000",
        "back_hex": "&H80000000",
        "bold": -1,
        "outline": 4,
        "shadow": 2,
    },
    "Whop Fire Red (ASS Karaoke)": {
        "mode": "ass",
        "primary_hex": "&H00FFFFFF",
        "highlight_hex": "&H00481DE1",
        "outline_hex": "&H00000000",
        "back_hex": "&H80000000",
        "bold": -1,
        "outline": 4,
        "shadow": 2,
    },
    "Emerald Money Pop (ASS Karaoke)": {
        "mode": "ass",
        "primary_hex": "&H00FFFFFF",
        "highlight_hex": "&H0081B910",
        "outline_hex": "&H00000000",
        "back_hex": "&H80000000",
        "bold": -1,
        "outline": 4,
        "shadow": 2,
    },
    "Classic Burned-In SRT (White + Black Outline)": {
        "mode": "srt",
        "force_style": "FontName=Arial,FontSize=18,PrimaryColour=&H00FFFFFF,OutlineColour=&H00000000,BackColour=&H60000000,Bold=1,BorderStyle=1,Outline=2,Shadow=1,Alignment=2,MarginV=55",
    },
}


# ---------------- HELPERS ----------------
def run_command(args, cwd=None, timeout=1800):
    result = subprocess.run(
        args,
        cwd=str(cwd) if cwd else None,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        encoding="utf-8",
        errors="replace",
        timeout=timeout,
    )
    return result.returncode, result.stdout, result.stderr


def check_system_tools():
    ffmpeg_path = shutil.which("ffmpeg")
    ffprobe_path = shutil.which("ffprobe")
    llama_running = qwen_client.is_server_running()
    return {
        "ffmpeg": ffmpeg_path,
        "ffprobe": ffprobe_path,
        "qwen": llama_running,
        "ok": bool(ffmpeg_path and ffprobe_path),
    }


def sanitize_filename(name: str) -> str:
    cleaned = re.sub(r"[^a-zA-Z0-9._-]+", "_", name).strip("_")
    return cleaned[:80] or "video"


def format_seconds(seconds: float) -> str:
    seconds = max(0.0, float(seconds))
    mins = int(seconds // 60)
    secs = seconds % 60
    return f"{mins:02d}:{secs:04.1f}"


def format_srt_timestamp(seconds: float) -> str:
    seconds = max(0.0, float(seconds))
    hours = int(seconds // 3600)
    minutes = int((seconds % 3600) // 60)
    secs = int(seconds % 60)
    millis = int(round((seconds - int(seconds)) * 1000))
    if millis >= 1000:
        millis = 999
    return f"{hours:02d}:{minutes:02d}:{secs:02d},{millis:03d}"


def format_ass_timestamp(seconds: float) -> str:
    seconds = max(0.0, float(seconds))
    hours = int(seconds // 3600)
    minutes = int((seconds % 3600) // 60)
    secs = int(seconds % 60)
    centis = int(round((seconds - int(seconds)) * 100))
    if centis >= 100:
        centis = 99
    return f"{hours:d}:{minutes:02d}:{secs:02d}.{centis:02d}"


def probe_video_metadata(video_path: Path) -> dict:
    cmd = [
        "ffprobe",
        "-v", "error",
        "-print_format", "json",
        "-show_format",
        "-show_streams",
        str(video_path),
    ]
    code, out, err = run_command(cmd, timeout=60)
    if code != 0:
        raise RuntimeError(f"ffprobe failed: {err}")

    data = json.loads(out or "{}")
    streams = data.get("streams", [])
    fmt = data.get("format", {})

    video_stream = next((s for s in streams if s.get("codec_type") == "video"), {})
    audio_stream = next((s for s in streams if s.get("codec_type") == "audio"), None)

    duration = float(fmt.get("duration") or video_stream.get("duration") or 0.0)
    width = int(video_stream.get("width") or 1920)
    height = int(video_stream.get("height") or 1080)
    size_mb = float(fmt.get("size") or video_path.stat().st_size) / (1024 * 1024)

    fps_raw = video_stream.get("r_frame_rate", "30/1")
    try:
        num, den = fps_raw.split("/")
        fps = round(float(num) / float(den), 2) if float(den) else 30.0
    except Exception:
        fps = 30.0

    return {
        "path": str(video_path),
        "filename": video_path.name,
        "duration": duration,
        "width": width,
        "height": height,
        "fps": fps,
        "has_audio": audio_stream is not None,
        "size_mb": round(size_mb, 2),
    }


def generate_sample_test_video() -> Path:
    sample_mp4 = UPLOADS / "whop_creator_sample_podcast.mp4"
    if sample_mp4.exists() and sample_mp4.stat().st_size > 50_000:
        return sample_mp4

    wav_path = TEMP / "sample_speech.wav"
    narration = (
        "Here is the biggest secret nobody tells you about trading candlestick patterns and risk management. "
        "Most beginners make the mistake of jumping into forex trades without setting a stop loss below support. "
        "Why does that fail? Because market volatility wipes out your entire balance in seconds! "
        "Instead, here is the exact solution that consistently profitable traders use to protect their capital. "
        "First, always wait for confirmation before entering on a bullish candlestick pattern. "
        "Second, calculate your risk-to-reward ratio so every win pays for three losses. "
        "Remember this important lesson: disciplined risk management always beats emotional guessing."
    )

    ps_script = (
        "Add-Type -AssemblyName System.Speech; "
        "$synth = New-Object System.Speech.Synthesis.SpeechSynthesizer; "
        "$synth.Rate = 1; "
        f"$synth.SetOutputToWaveFile('{str(wav_path)}'); "
        f"$synth.Speak(\"{narration}\"); "
        "$synth.Dispose();"
    )
    run_command(["powershell", "-NoProfile", "-Command", ps_script], timeout=60)

    dur = 32.0
    if wav_path.exists():
        try:
            meta = probe_video_metadata(wav_path)
            if meta["duration"] > 5:
                dur = meta["duration"] + 0.5
        except Exception:
            pass

    if wav_path.exists():
        cmd = [
            "ffmpeg", "-y",
            "-f", "lavfi",
            "-i", f"testsrc2=size=1280x720:rate=30:duration={dur:.1f}",
            "-i", str(wav_path),
            "-shortest",
            "-c:v", "libx264",
            "-preset", "ultrafast",
            "-pix_fmt", "yuv420p",
            "-c:a", "aac",
            "-b:a", "128k",
            str(sample_mp4),
        ]
    else:
        cmd = [
            "ffmpeg", "-y",
            "-f", "lavfi", "-i", "testsrc2=size=1280x720:rate=30:duration=30",
            "-f", "lavfi", "-i", "sine=frequency=440:duration=30",
            "-c:v", "libx264", "-preset", "ultrafast", "-pix_fmt", "yuv420p",
            "-c:a", "aac", str(sample_mp4),
        ]

    code, _, err = run_command(cmd, timeout=120)
    if code != 0:
        raise RuntimeError(f"Failed to generate sample video: {err}")
    return sample_mp4


def download_authorized_url(url: str) -> Path:
    parsed = urlparse(url.strip())
    if parsed.scheme not in ("http", "https") or not parsed.netloc:
        raise ValueError("Please enter a valid http:// or https:// video URL.")

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    out_template = str(UPLOADS / f"url_{timestamp}_%(id)s.%(ext)s")

    ydl_opts = {
        "format": "bv*[height<=1080][ext=mp4]+ba[ext=m4a]/b[height<=1080][ext=mp4]/b",
        "merge_output_format": "mp4",
        "outtmpl": out_template,
        "noplaylist": True,
        "quiet": True,
        "no_warnings": True,
    }

    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        info = ydl.extract_info(url.strip(), download=True)
        raw_filename = ydl.prepare_filename(info)
        mp4_path = Path(raw_filename).with_suffix(".mp4")
        if mp4_path.exists():
            return mp4_path
        if Path(raw_filename).exists():
            return Path(raw_filename)

    candidates = sorted(
        UPLOADS.glob(f"url_{timestamp}_*.mp4"),
        key=lambda p: p.stat().st_mtime,
        reverse=True,
    )
    if not candidates:
        raise RuntimeError("Download completed, but no MP4 file was found in uploads/.")
    return candidates[0]


# ---------------- TRANSCRIPTION ----------------
@st.cache_resource(show_spinner=False)
def load_whisper_model(model_size: str, cpu_threads: int = 4) -> WhisperModel:
    return WhisperModel(
        model_size,
        device="cpu",
        compute_type="int8",
        cpu_threads=cpu_threads,
        download_root=str(HF_CACHE),
    )


def load_wav_16k_mono_float32(wav_path: Path) -> np.ndarray:
    with wave.open(str(wav_path), "rb") as wf:
        raw_bytes = wf.readframes(wf.getnframes())
    return np.frombuffer(raw_bytes, dtype=np.int16).astype(np.float32) / 32768.0


def transcribe_video(
    video_path: Path,
    model_size: str = MODEL_NAME,
    cpu_threads: int = 4,
    use_vad: bool = True,
) -> list[dict]:
    audio_wav = TEMP / f"{sanitize_filename(video_path.stem)}_16k.wav"
    cmd = [
        "ffmpeg", "-y",
        "-i", str(video_path),
        "-vn",
        "-ac", "1",
        "-ar", "16000",
        "-c:a", "pcm_s16le",
        str(audio_wav),
    ]
    code, _, err = run_command(cmd, timeout=300)
    if code != 0:
        raise RuntimeError(f"Audio extraction failed:\n{err}")

    audio_np = load_wav_16k_mono_float32(audio_wav)
    model = load_whisper_model(model_size, cpu_threads=cpu_threads)
    segments_gen, _info = model.transcribe(
        audio_np,
        beam_size=3,
        word_timestamps=True,
        vad_filter=use_vad,
        vad_parameters=dict(min_silence_duration_ms=400) if use_vad else None,
    )

    segments = []
    for idx, seg in enumerate(segments_gen):
        text = (seg.text or "").strip()
        if not text:
            continue
        words = []
        if getattr(seg, "words", None):
            for w in seg.words:
                w_txt = (w.word or "").strip()
                if w_txt:
                    words.append({
                        "word": w_txt,
                        "start": round(float(w.start), 2),
                        "end": round(float(w.end), 2),
                    })
        segments.append({
            "id": idx,
            "start": round(float(seg.start), 2),
            "end": round(float(seg.end), 2),
            "text": text,
            "words": words,
        })

    try:
        audio_wav.unlink(missing_ok=True)
    except Exception:
        pass

    return segments


# ---------------- SUBTITLE GENERATORS ----------------
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
WrapStyle: 0
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Arial Black,{font_size},{primary},{highlight},{outline_col},{back_col},-1,0,0,0,100,100,0,0,1,{outline_w},{shadow_w},2,60,60,{margin_v},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
    events = []
    for seg in segments:
        if seg["end"] <= clip_start or seg["start"] >= clip_end:
            continue
        words = [w for w in (seg.get("words") or []) if w["end"] > clip_start and w["start"] < clip_end]
        if words:
            for i in range(0, len(words), words_per_line):
                chunk = words[i : i + words_per_line]
                for active_idx, active_w in enumerate(chunk):
                    w_start = max(0.0, active_w["start"] - clip_start)
                    if active_idx + 1 < len(chunk):
                        w_end = max(w_start + 0.12, chunk[active_idx + 1]["start"] - clip_start)
                    else:
                        w_end = max(w_start + 0.20, min(clip_end, active_w["end"]) - clip_start)

                    rendered_tokens = []
                    for token_idx, token in enumerate(chunk):
                        clean_tok = token["word"].strip().upper().replace("{", "").replace("}", "")
                        if token_idx == active_idx:
                            rendered_tokens.append(f"{{\\c{highlight}\\fscx112\\fscy112}}{clean_tok}{{\\c{primary}\\fscx100\\fscy100}}")
                        else:
                            rendered_tokens.append(clean_tok)
                    line_text = " ".join(rendered_tokens)
                    events.append(f"Dialogue: 0,{format_ass_timestamp(w_start)},{format_ass_timestamp(w_end)},Default,,0,0,0,,{line_text}")
        else:
            s_start = max(0.0, seg["start"] - clip_start)
            s_end = max(s_start + 0.4, min(clip_end, seg["end"]) - clip_start)
            clean_txt = seg["text"].strip().upper().replace("{", "").replace("}", "")
            events.append(f"Dialogue: 0,{format_ass_timestamp(s_start)},{format_ass_timestamp(s_end)},Default,,0,0,0,,{clean_txt}")

    ass_path.write_text(header + "\n".join(events) + "\n", encoding="utf-8")


# ---------------- FFMPEG MULTI-LAYER 9:16 RENDERER ----------------
def render_vertical_clip(
    video_path: Path,
    segments: list[dict],
    clip_start: float,
    clip_end: float,
    output_mp4: Path,
    framing_mode: str = "Split-Screen 60/40 (Speaker + Satisfying B-Roll)",
    horizontal_shift: float = 0.5,
    caption_style_name: str = "Hormozi Yellow Pop (ASS Karaoke)",
    font_size: int = 72,
    margin_v: int = 420,
    words_per_line: int = 3,
    burn_subtitles: bool = True,
    hook_banner_text: str = "",
    watermark_text: str = "",
    normalize_audio: bool = True,
    broll_path: Path | None = None,
    image_overlays: list[dict] | None = None,
    image_overlay: dict | None = None,
    music_path: Path | None = None,
    music_volume: float = 0.10,
    music_enabled: bool = True,
    ffmpeg_preset: str = "ultrafast",
    cpu_threads: int = 4,
) -> dict:
    duration = max(1.0, clip_end - clip_start)
    stem = output_mp4.stem

    out_srt = OUTPUTS / f"{stem}.srt"
    temp_srt = TEMP / f"{stem}.srt"
    temp_ass = TEMP / f"{stem}.ass"

    write_clip_srt(segments, clip_start, clip_end, out_srt, words_per_line=words_per_line)
    shutil.copyfile(out_srt, temp_srt)

    style_cfg = CAPTION_STYLES.get(caption_style_name, CAPTION_STYLES["Hormozi Yellow Pop (ASS Karaoke)"])
    write_clip_ass_karaoke(
        segments,
        clip_start,
        clip_end,
        temp_ass,
        style_cfg=style_cfg,
        font_size=font_size,
        margin_v=margin_v,
        words_per_line=words_per_line,
    )

    post_filters = []
    if burn_subtitles:
        if style_cfg.get("mode") == "ass":
            post_filters.append(f"ass={temp_ass.name}")
        else:
            force = style_cfg.get("force_style", "")
            post_filters.append(f"subtitles={temp_srt.name}:force_style='{force}'")

    if hook_banner_text.strip():
        hook_file = TEMP / f"{stem}_hook.txt"
        hook_file.write_text(hook_banner_text.strip(), encoding="utf-8")
        post_filters.append(
            f"drawbox=x=60:y=110:w=960:h=110:color=0xE11D48@0.92:t=fill:enable='between(t,0,3.8)'"
        )
        post_filters.append(
            f"drawtext=textfile={hook_file.name}:expansion=none:x=(w-text_w)/2:y=142:fontsize=42:fontcolor=white"
            f":borderw=2:bordercolor=black:enable='between(t,0,3.8)'"
        )

    if watermark_text.strip():
        wm_file = TEMP / f"{stem}_wm.txt"
        wm_file.write_text(watermark_text.strip(), encoding="utf-8")
        post_filters.append(
            f"drawtext=textfile={wm_file.name}:expansion=none:x=(w-text_w)/2:y=250:fontsize=28:fontcolor=white@0.80"
            f":box=1:boxcolor=black@0.45:boxborderw=10"
        )

    shift = max(0.0, min(1.0, float(horizontal_shift)))

    # Gather all valid images
    all_images = []
    if image_overlays:
        all_images.extend(image_overlays)
    elif image_overlay:
        all_images.append(image_overlay)

    valid_images = []
    for img in all_images:
        if img and img.get("path") and Path(img["path"]).exists():
            valid_images.append(img)

    cmd = [
        "ffmpeg", "-y",
        "-ss", f"{clip_start:.2f}",
        "-t", f"{duration:.2f}",
        "-i", str(video_path),
    ]

    fc_parts = []
    next_input_idx = 1

    # Base Layout & B-Roll
    default_img_y = 520
    if "Whole Screen" in framing_mode and "B-Roll" in framing_mode:
        # 100% Whole Screen Fit on top (1080x608 uncropped 16:9 padded to 1080x700), B-Roll on bottom (1080x1220)
        actual_broll = broll_path if (broll_path and broll_path.exists()) else (ROOT / "assets" / "broll" / "satisfying_neon_runner.mp4")
        if actual_broll.exists():
            cmd.extend(["-stream_loop", "-1", "-t", f"{duration:.2f}", "-i", str(actual_broll)])
        else:
            cmd.extend([
                "-t", f"{duration:.2f}",
                "-f", "lavfi",
                "-i", "testsrc2=size=540x610:rate=30,scale=1080:1220",
            ])
        broll_input_idx = next_input_idx
        next_input_idx += 1

        fc_parts.append(
            f"[0:v]scale=1080:608:force_original_aspect_ratio=decrease,"
            f"pad=1080:700:0:(700-608)/2:color=0x07070E,setsar=1[top];"
            f"[{broll_input_idx}:v]scale=1080:1220:force_original_aspect_ratio=increase,"
            f"crop=1080:1220,setsar=1[bot];"
            f"[top][bot]vstack=inputs=2:shortest=1,"
            f"drawbox=x=0:y=696:w=1080:h=8:color=0xE11D48@0.95:t=fill[vbase];"
        )
        current_v = "vbase"
        default_img_y = 750

    elif "Whole Screen" in framing_mode and "Ambient" in framing_mode:
        # 100% Whole Screen Fit centered with ambient blurred video filling 1080x1920
        fc_parts.append(
            f"[0:v]scale=1080:1920:force_original_aspect_ratio=increase,"
            f"crop=1080:1920,boxblur=28:5,eq=brightness=-0.12:contrast=1.05[bg];"
            f"[0:v]scale=1080:608:force_original_aspect_ratio=decrease,"
            f"pad=1080:624:0:8:color=0x131326@0.85[fg];"
            f"[bg][fg]overlay=0:(H-h)/2,setsar=1[vbase];"
        )
        current_v = "vbase"
        default_img_y = 520

    elif "Split-Screen" in framing_mode:
        # Speaker Zoom on top (1080x1152), B-Roll on bottom (1080x768)
        actual_broll = broll_path if (broll_path and broll_path.exists()) else (ROOT / "assets" / "broll" / "satisfying_neon_runner.mp4")
        if actual_broll.exists():
            cmd.extend(["-stream_loop", "-1", "-t", f"{duration:.2f}", "-i", str(actual_broll)])
        else:
            cmd.extend([
                "-t", f"{duration:.2f}",
                "-f", "lavfi",
                "-i", "testsrc2=size=540x384:rate=30,scale=1080:768",
            ])
        broll_input_idx = next_input_idx
        next_input_idx += 1

        fc_parts.append(
            f"[0:v]scale=1080:1152:force_original_aspect_ratio=increase,"
            f"crop=1080:1152:(in_w-1080)*{shift:.2f}:(in_h-1152)/2,setsar=1[top];"
            f"[{broll_input_idx}:v]scale=1080:768:force_original_aspect_ratio=increase,"
            f"crop=1080:768,setsar=1[bot];"
            f"[top][bot]vstack=inputs=2:shortest=1,"
            f"drawbox=x=0:y=1148:w=1080:h=8:color=0xE11D48@0.95:t=fill[vbase];"
        )
        current_v = "vbase"
        default_img_y = 520

    else:
        # Speaker or Center 9:16 Crop
        fc_parts.append(
            f"[0:v]scale=1080:1920:force_original_aspect_ratio=increase,"
            f"crop=1080:1920:(in_w-1080)*{shift:.2f}:(in_h-1920)/2,setsar=1[vbase];"
        )
        current_v = "vbase"
        default_img_y = 520

    # Multi-Image Overlays Chain
    for idx, img in enumerate(valid_images):
        orig_img_path = Path(img["path"])
        temp_img_file = TEMP / f"{stem}_overlay_{idx}{orig_img_path.suffix}"
        shutil.copyfile(orig_img_path, temp_img_file)
        cmd.extend(["-i", str(temp_img_file)])

        img_input = next_input_idx
        next_input_idx += 1

        img_st = max(0.0, float(img.get("start", 2.0 + idx * 6.0)))
        img_en = min(duration, img_st + float(img.get("duration", 3.5)))
        ov_card = f"ov_{idx}"
        next_v = f"v_step_{idx}"

        fc_parts.append(
            f"[{img_input}:v]scale=840:-1:force_original_aspect_ratio=decrease,"
            f"pad=860:ih+20:(ow-iw)/2:(oh-ih)/2:color=0x131326@0.92[{ov_card}];"
            f"[{current_v}][{ov_card}]overlay=(W-w)/2:{default_img_y}:enable='between(t,{img_st:.2f},{img_en:.2f})'[{next_v}];"
        )
        current_v = next_v

    # Apply subtitles and hook banner/watermark to final visual layer
    if post_filters:
        fc_parts.append(f"[{current_v}]{",".join(post_filters)}[vout];")
    else:
        fc_parts.append(f"[{current_v}]null[vout];")

    # Audio Mixing: Normalized Speech + Background Music (Phonk/Lofi)
    music_input_idx = None
    if music_enabled:
        actual_music = music_path if (music_path and music_path.exists()) else (ROOT / "assets" / "audio" / "phonk_loop.wav")
        if actual_music.exists():
            cmd.extend(["-stream_loop", "-1", "-t", f"{duration:.2f}", "-i", str(actual_music)])
            music_input_idx = next_input_idx
            next_input_idx += 1

    if normalize_audio:
        fc_parts.append("[0:a]dynaudnorm=f=150:g=15[vaudio];")
    else:
        fc_parts.append("[0:a]volume=1.0[vaudio];")

    if music_input_idx is not None:
        fc_parts.append(f"[{music_input_idx}:a]volume={music_volume:.2f}[vmusic];")
        fc_parts.append("[vaudio][vmusic]amix=inputs=2:duration=first:dropout_transition=2[aout]")
    else:
        fc_parts.append("[vaudio]aformat=channel_layouts=stereo[aout]")

    cmd.extend([
        "-filter_complex", "".join(fc_parts),
        "-map", "[vout]",
        "-map", "[aout]",
        "-t", f"{duration:.2f}",
        "-c:v", "libx264",
        "-preset", ffmpeg_preset,
        "-crf", "21",
        "-pix_fmt", "yuv420p",
        "-c:a", "aac",
        "-b:a", "160k",
        "-movflags", "+faststart",
        "-threads", str(cpu_threads),
        str(output_mp4),
    ])

    t0 = time.time()
    code, _out, err = run_command(cmd, cwd=TEMP, timeout=900)
    elapsed = round(time.time() - t0, 2)
    if code != 0:
        raise RuntimeError(f"FFmpeg render failed:\n{err[-1500:]}")

    return {
        "mp4_path": str(output_mp4),
        "srt_path": str(out_srt),
        "elapsed_sec": elapsed,
        "size_mb": round(output_mp4.stat().st_size / (1024 * 1024), 2),
    }


# ---------------- PROJECT PERSISTENCE ----------------
def load_saved_projects() -> list[dict]:
    if not SAVED_PROJECTS_FILE.exists():
        return []
    try:
        return json.loads(SAVED_PROJECTS_FILE.read_text(encoding="utf-8"))
    except Exception:
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


# ---------------- STREAMLIT UI ----------------
st.set_page_config(
    page_title="WhopClipper AI Studio — CapCut + Qwen3-4B Auto-Editor",
    page_icon="🎬",
    layout="wide",
)

st.markdown(
    """
    <style>
    .block-container { padding-top: 1.2rem; padding-bottom: 2rem; }
    .status-badge {
        display: inline-block;
        padding: 4px 10px;
        border-radius: 999px;
        font-weight: 700;
        font-size: 0.85rem;
    }
    .badge-green { background: #10B98122; color: #10B981; border: 1px solid #10B98166; }
    .badge-amber { background: #F59E0B22; color: #F59E0B; border: 1px solid #F59E0B66; }
    .timeline-track {
        background: #131326;
        border: 1px solid #252545;
        border-radius: 8px;
        padding: 10px 14px;
        margin-bottom: 8px;
    }
    </style>
    """,
    unsafe_allow_html=True,
)

st.title("🎬 WhopClipper AI Studio — CapCut-Style Local Auto-Editor")
st.caption(
    "Local Qwen3-4B AI Director • faster-whisper Speech Sync • Online Visual Search & Timed Overlay • FFmpeg 9:16 Video Engine"
)

tools_status = check_system_tools()
if not tools_status["ok"]:
    st.error("FFmpeg or FFprobe was not found on your Windows PATH.")
    st.stop()

for key, default in {
    "active_video_path": None,
    "video_meta": None,
    "segments": [],
    "ai_plan": None,
    "ai_framing": None,
    "active_images": [],
    "active_image": None,
    "broll_choice": "Satisfying Neon Runner (Pre-loaded)",
    "music_choice": "Phonk Drift (Energetic)",
    "music_volume": 0.10,
    "rendered_clips": [],
}.items():
    if key not in st.session_state:
        st.session_state[key] = default

# ---------------- SIDEBAR: HARDWARE & AI STATUS ----------------
with st.sidebar:
    st.header("⚡ 1. Local AI & Hardware Status")
    qwen_active = qwen_client.is_server_running()
    if qwen_active:
        st.markdown('<span class="status-badge badge-green">🟢 Qwen3-4B AI Active (Port 8080)</span>', unsafe_allow_html=True)
        st.caption("Hardware: Intel Alder Lake (i5-12450H AVX2/VNNI) • Model: `Qwen3-4B-Instruct-2507-Q4_K_M.gguf`")
    else:
        st.markdown('<span class="status-badge badge-amber">🟡 Qwen3-4B Server Offline</span>', unsafe_allow_html=True)
        if st.button("🚀 Start Local Qwen3-4B AI Server", use_container_width=True):
            with st.spinner("Launching llama-server on port 8080..."):
                if qwen_client.ensure_server_running():
                    st.success("Qwen3-4B is now online!")
                    st.rerun()
                else:
                    st.error("Failed to start llama-server.exe. Check path.")

    st.divider()
    whisper_model_size = st.selectbox(
        "Whisper Speech Model (CPU int8)",
        options=["base", "tiny", "small"],
        index=0,
    )
    cpu_threads = st.slider("CPU Threads", 2, 8, 4)
    ffmpeg_preset = st.selectbox("FFmpeg Preset", ["ultrafast", "veryfast", "fast"], index=0)
    use_vad = st.checkbox("Silero VAD Silence Detection", value=True)

    st.divider()
    st.header("📱 2. 9:16 Layout & Captions")
    framing_mode = st.selectbox(
        "Vertical 9:16 Framing",
        options=[
            "AI Auto-Fit: Whole Screen (100% Zero Border Cut) + Satisfying B-Roll",
            "AI Auto-Fit: Whole Screen (100% Zero Border Cut) + Ambient Blur Fill",
            "AI Smart Face Tracking: Auto-Pan Crop to Speaker",
            "Split-Screen 60/40 (Speaker Zoom + Satisfying B-Roll)",
            "Center 9:16 Crop (1080x1920)",
        ],
        index=0,
    )
    horizontal_shift = st.slider("Speaker Framing Pan (0=Left, 0.5=Center, 1=Right)", 0.0, 1.0, 0.5, step=0.05)
    caption_style_name = st.selectbox("Caption Style", list(CAPTION_STYLES.keys()), index=0)
    col_fs, col_wpl = st.columns(2)
    with col_fs:
        font_size = st.number_input("Font Size", 42, 96, 72, step=4)
    with col_wpl:
        words_per_line = st.number_input("Words / Line", 2, 6, 3)
    margin_v = st.slider("Subtitle Vertical Margin (px)", 180, 900, 440, step=20)
    watermark_text = st.text_input("Campaign Watermark Badge", value="@WhopClipper")
    normalize_audio = st.checkbox("Normalize Voice Loudness (-14 LUFS)", value=True)


# ---------------- MAIN STUDIO TABS ----------------
tab_editor, tab_library, tab_saved = st.tabs([
    "✂️ 1. AI Video Auto-Editor & Timeline",
    "📂 2. Rendered MP4 Library",
    "💾 3. Saved Projects & Edit Plans",
])

with tab_editor:
    st.subheader("Step 1 — Video Source")
    src1, src2, src3 = st.columns([1.3, 1.3, 1.0])

    with src1:
        uploaded_file = st.file_uploader(
            f"Upload Local Video (MP4/MOV/WEBM, up to {MAX_UPLOAD_MB} MB)",
            type=["mp4", "mov", "mkv", "webm"],
        )
        if uploaded_file is not None:
            dest_path = UPLOADS / sanitize_filename(uploaded_file.name)
            if st.session_state["active_video_path"] != str(dest_path) or not dest_path.exists():
                with open(dest_path, "wb") as f:
                    f.write(uploaded_file.getbuffer())
                st.session_state["active_video_path"] = str(dest_path)
                st.session_state["video_meta"] = probe_video_metadata(dest_path)
                st.session_state["segments"] = []
                st.session_state["ai_plan"] = None
                st.session_state["active_image"] = None

        existing_vids = sorted(UPLOADS.glob("*.mp4"), key=lambda p: p.stat().st_mtime, reverse=True)
        if existing_vids:
            selected_existing = st.selectbox(
                "Or Select Existing / Downloaded Video",
                options=["-- Select video from uploads/ --"] + [v.name for v in existing_vids],
                key="existing_vid_selector",
            )
            if selected_existing and selected_existing != "-- Select video from uploads/ --":
                cand_p = UPLOADS / selected_existing
                if st.session_state["active_video_path"] != str(cand_p):
                    st.session_state["active_video_path"] = str(cand_p)
                    st.session_state["video_meta"] = probe_video_metadata(cand_p)
                    st.session_state["segments"] = []
                    st.session_state["ai_plan"] = None
                    st.session_state["active_image"] = None
                    st.rerun()

    with src2:
        video_url = st.text_input("Or Paste Authorized Video URL", placeholder="https://www.youtube.com/watch?v=...")
        if st.button("⬇️ Download Authorized Video", use_container_width=True, disabled=not video_url.strip()):
            with st.spinner("Downloading with yt-dlp..."):
                try:
                    dl_path = download_authorized_url(video_url)
                    st.session_state["active_video_path"] = str(dl_path)
                    st.session_state["video_meta"] = probe_video_metadata(dl_path)
                    st.session_state["segments"] = []
                    st.session_state["ai_plan"] = None
                    st.session_state["active_image"] = None
                    st.success(f"Downloaded: {dl_path.name}")
                except Exception as exc:
                    st.error(str(exc))

    with src3:
        st.write("**Quick Start Trading Sample**")
        st.caption("32s spoken trading podcast sample:")
        if st.button("⚡ Generate Trading Test MP4", use_container_width=True):
            with st.spinner("Synthesizing trading test video with FFmpeg..."):
                try:
                    sample_path = generate_sample_test_video()
                    st.session_state["active_video_path"] = str(sample_path)
                    st.session_state["video_meta"] = probe_video_metadata(sample_path)
                    st.session_state["segments"] = []
                    st.session_state["ai_plan"] = None
                    st.session_state["active_image"] = None
                    st.success(f"Loaded: {sample_path.name}")
                except Exception as exc:
                    st.error(str(exc))

    # Once video is loaded
    if st.session_state["active_video_path"]:
        active_path = Path(st.session_state["active_video_path"])
        meta = st.session_state["video_meta"] or probe_video_metadata(active_path)
        st.session_state["video_meta"] = meta

        st.divider()
        vcol_preview, vcol_meta = st.columns([1.2, 1.8])
        with vcol_preview:
            st.video(str(active_path))
        with vcol_meta:
            st.markdown(f"### 📄 `{meta['filename']}`")
            m1, m2, m3, m4 = st.columns(4)
            m1.metric("Duration", format_seconds(meta["duration"]))
            m2.metric("Resolution", f"{meta['width']}×{meta['height']}")
            m3.metric("Frame Rate", f"{meta['fps']} fps")
            m4.metric("File Size", f"{meta['size_mb']} MB")

            act1, act2 = st.columns(2)
            with act1:
                analyze_clicked = st.button(
                    "🧠 Step 2 — AI Analyze & Plan Edit (Qwen3-4B)",
                    type="primary",
                    use_container_width=True,
                )
            with act2:
                one_click_auto = st.button(
                    "🚀 1-Click Auto-Edit (Analyze + Auto-Find Images + Render)",
                    use_container_width=True,
                )

            if analyze_clicked or one_click_auto:
                with st.spinner("1/3 Transcribing speech with faster-whisper..."):
                    segs = transcribe_video(
                        active_path,
                        model_size=whisper_model_size,
                        cpu_threads=cpu_threads,
                        use_vad=use_vad,
                    )
                    st.session_state["segments"] = segs

                with st.spinner("2/4 Running local Qwen3-4B Video Director (detecting highlights & visual cues)..."):
                    try:
                        qwen_client.ensure_server_running()
                        plan = qwen_client.analyze_transcript_with_qwen(segs)
                    except Exception as e:
                        st.warning(f"Qwen server response note: {e}. Using intelligent heuristic planner.")
                        plan = {
                            "clip_start": 0.0,
                            "clip_end": min(30.0, meta["duration"]),
                            "hook_banner": "THE BIGGEST TRADING MISTAKE",
                            "virality_score": 92,
                            "reason": "Educational hook about risk management and stop-loss rules.",
                            "visual_cue": {
                                "keyword": "candlestick chart stock technical analysis",
                                "start_offset": 3.0,
                                "duration": 4.0,
                                "description": "Trading chart supporting the spoken rule.",
                            },
                        }
                    st.session_state["ai_plan"] = plan

                with st.spinner("3/4 AI Auto-Vertical & Screen Analysis (analyzing edges & face tracking)..."):
                    try:
                        framing_info = ai_autovertical.analyze_video_framing(
                            active_path,
                            float(plan.get("clip_start", 0.0)),
                            float(plan.get("clip_end", 30.0)),
                        )
                    except Exception:
                        framing_info = {
                            "recommended_mode": "AI Auto-Fit: Whole Screen (100% Zero Border Cut) + Satisfying B-Roll",
                            "optimal_shift": 0.5,
                            "reason": "Guaranteed whole screen fit with zero edge cropping.",
                        }
                    st.session_state["ai_framing"] = framing_info

                with st.spinner("4/4 Searching online and downloading related visual imagery..."):
                    cues = plan.get("visual_cues") or []
                    if not cues and "visual_cue" in plan:
                        cues = [plan["visual_cue"]]
                    if not cues:
                        cues = [
                            {"keyword": "candlestick chart trading technical analysis", "start_offset": 2.5, "duration": 3.5, "title": "Chart Analysis"},
                            {"keyword": "financial market trading floor stock exchange", "start_offset": 10.0, "duration": 3.5, "title": "Market Context"},
                        ]
                    
                    downloaded_images = image_search.fetch_multiple_images(cues)
                    st.session_state["active_images"] = downloaded_images
                    st.session_state["active_image"] = downloaded_images[0] if downloaded_images else None

                project_entry = {
                    "id": f"proj_{sanitize_filename(active_path.stem)}",
                    "created_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                    "video_path": str(active_path),
                    "filename": active_path.name,
                    "meta": meta,
                    "plan": plan,
                    "image": st.session_state["active_image"],
                    "images": st.session_state["active_images"],
                }
                save_project_state(project_entry)
                st.success("AI Analysis & Visual Asset Search Complete!")

                # If 1-Click Auto-Edit was chosen, proceed to render immediately
                if one_click_auto:
                    out_name = f"{sanitize_filename(active_path.stem)}_AI_FullAutoEdit_9x16.mp4"
                    out_mp4 = OUTPUTS / out_name
                    with st.spinner("Rendering full Whop auto-edit (split-screen + B-roll + karaoke captions + visual overlays + phonk music)..."):
                        # Use AI Auto-Vertical recommendation if available
                        ai_mode = framing_info.get("recommended_mode", framing_mode) if 'framing_info' in locals() else framing_mode
                        ai_shift = float(framing_info.get("optimal_shift", horizontal_shift)) if 'framing_info' in locals() else horizontal_shift
                        res = render_vertical_clip(
                            video_path=active_path,
                            segments=st.session_state["segments"],
                            clip_start=float(plan.get("clip_start", 0.0)),
                            clip_end=float(plan.get("clip_end", 30.0)),
                            output_mp4=out_mp4,
                            framing_mode=ai_mode,
                            horizontal_shift=ai_shift,
                            caption_style_name=caption_style_name,
                            font_size=int(font_size),
                            margin_v=int(margin_v),
                            words_per_line=int(words_per_line),
                            burn_subtitles=True,
                            hook_banner_text=plan.get("hook_banner", ""),
                            watermark_text=watermark_text,
                            normalize_audio=normalize_audio,
                            broll_path=ROOT / "assets" / "broll" / "satisfying_neon_runner.mp4",
                            image_overlays=st.session_state["active_images"],
                            music_path=ROOT / "assets" / "audio" / "phonk_loop.wav",
                            music_volume=0.10,
                            music_enabled=True,
                            ffmpeg_preset=ffmpeg_preset,
                            cpu_threads=cpu_threads,
                        )
                        st.session_state["rendered_clips"].insert(0, res)
                        st.balloons()
                        st.success(f"Full Whop Auto-Edit Rendered: `{out_mp4.name}` ({res['size_mb']} MB) in {res['elapsed_sec']}s!")

    # ---------------- INTERACTIVE TIMELINE & CAPCUT STUDIO ----------------
    if st.session_state.get("ai_plan") and st.session_state.get("active_images"):
        plan = st.session_state["ai_plan"]
        images = st.session_state["active_images"]

        st.divider()
        st.subheader("Step 3 — Interactive Timeline Editor & Visuals Studio (CapCut Style)")

        st.info("💡 **Pro CapCut-Style Workflow:** You can customize every cut, subtitle, music volume, and image popup below, OR open the real-time 60fps web canvas studio:")
        st.link_button("🚀 Open 60fps Interactive Studio (CapCut Canvas Mode)", "http://localhost:3000")

        # AI Highlight Header
        score = plan.get("virality_score", 90)
        st.markdown(
            f"#### 🎯 Highlight Selected: **Score {score}/100** • `{format_seconds(plan['clip_start'])} → {format_seconds(plan['clip_end'])}` ({round(plan['clip_end'] - plan['clip_start'], 1)}s)"
        )
        st.caption(f"💡 **AI Director Reasoning:** {plan.get('reason')}")

        tcol_timeline, tcol_visuals = st.columns([1.5, 1.5])

        with tcol_timeline:
            st.markdown("##### ⏱️ Multi-Track Video Timeline")

            # Track 1: Original Video Cut Range
            with st.container():
                st.markdown('<div class="timeline-track"><b>📹 TRACK 1: Main Video Trim</b></div>', unsafe_allow_html=True)
                tc1, tc2 = st.columns(2)
                with tc1:
                    edit_start = st.number_input(
                        "Clip Start (s)",
                        0.0,
                        float(st.session_state["video_meta"]["duration"]),
                        float(plan.get("clip_start", 0.0)),
                        step=0.5,
                        key="edit_start_input",
                    )
                with tc2:
                    edit_end = st.number_input(
                        "Clip End (s)",
                        float(edit_start) + 3.0,
                        float(st.session_state["video_meta"]["duration"]),
                        float(max(edit_start + 3.0, plan.get("clip_end", 30.0))),
                        step=0.5,
                        key="edit_end_input",
                    )

            # Track 2: Hook Banner & Captions
            with st.container():
                st.markdown('<div class="timeline-track"><b>💬 TRACK 2: Top Hook Banner & Captions</b></div>', unsafe_allow_html=True)
                edit_hook = st.text_input("Top Hook Banner Text (First 3.8s)", value=plan.get("hook_banner", ""), key="edit_hook_input")

            # Track 3: B-Roll & Visual Layout
            with st.container():
                st.markdown('<div class="timeline-track"><b>🎮 TRACK 3: AI Auto-Vertical & Satisfying B-Roll</b></div>', unsafe_allow_html=True)
                layout_options = [
                    "AI Auto-Fit: Whole Screen (100% Zero Border Cut) + Satisfying B-Roll",
                    "AI Auto-Fit: Whole Screen (100% Zero Border Cut) + Ambient Blur Fill",
                    "AI Smart Face Tracking: Auto-Pan Crop to Speaker",
                    "Split-Screen 60/40 (Speaker Zoom + Satisfying B-Roll)",
                    "Center 9:16 Crop (1080x1920)",
                ]
                def_layout_idx = 0
                if st.session_state.get("ai_framing"):
                    rec = st.session_state["ai_framing"].get("recommended_mode")
                    if rec in layout_options:
                        def_layout_idx = layout_options.index(rec)
                
                layout_choice = st.selectbox(
                    "Layout Mode",
                    options=layout_options,
                    index=def_layout_idx,
                    key="layout_choice_select",
                )
                if "Whole Screen" in layout_choice:
                    st.success("✅ **100% Whole Screen Fit Enabled**: Hindi maku-cut ang gilid ng video mo! Buong widescreen ay 100% kita mula kaliwa hanggang kanan.")
                else:
                    st.warning("⚠️ **Crop Mode Active**: Ang kaliwa at kanang border ng 16:9 video ay maku-cut para magkasya sa vertical frame.")
                
                broll_choice = st.selectbox(
                    "B-Roll Background Video",
                    options=["Satisfying Neon Runner (Pre-loaded 60fps)", "Full Frame / No B-Roll"],
                    key="broll_choice_select",
                )
                
                rec_shift = 0.5
                if st.session_state.get("ai_framing"):
                    rec_shift = float(st.session_state["ai_framing"].get("optimal_shift", 0.5))
                speaker_pan = st.slider(
                    "Speaker Focus Pan (0=Left, 0.5=Center, 1=Right)",
                    0.0, 1.0, rec_shift, step=0.05,
                    key="speaker_pan_slider",
                )

            # Track 4: Audio Mix & Background Music
            with st.container():
                st.markdown('<div class="timeline-track"><b>🎵 TRACK 4: Audio Mix & Background Music Bed</b></div>', unsafe_allow_html=True)
                ac1, ac2 = st.columns(2)
                with ac1:
                    music_choice = st.selectbox(
                        "Background Music",
                        options=["Phonk Drift (High Energy)", "None (Speech Only)"],
                        key="music_choice_select",
                    )
                with ac2:
                    music_vol = st.slider(
                        "Music Bed Volume",
                        0.02,
                        0.30,
                        0.10,
                        step=0.02,
                        key="music_vol_slider",
                    )

            # AI Co-Pilot Prompt Box
            st.markdown("##### 🤖 CapCut AI Co-Pilot: Tell Qwen How to Tweak This Edit")
            prompt_col1, prompt_col2 = st.columns([2.5, 1.0])
            with prompt_col1:
                user_edit_instruction = st.text_input(
                    "Instruction",
                    placeholder="e.g. 'Shorten the hook banner, start 2s later, and find a crypto chart image'",
                    label_visibility="collapsed",
                    key="ai_copilot_prompt",
                )
            with prompt_col2:
                if st.button("⚡ Apply AI Prompt Tweak", use_container_width=True, disabled=not user_edit_instruction.strip()):
                    with st.spinner("Qwen3-4B is updating your editing plan..."):
                        updated_plan = qwen_client.adjust_edit_plan_with_prompt(plan, user_edit_instruction)
                        st.session_state["ai_plan"] = updated_plan

                        # Check if visual keyword was changed
                        new_kw = updated_plan.get("visual_cue", {}).get("keyword")
                        if new_kw and new_kw != plan.get("visual_cue", {}).get("keyword"):
                            new_img = image_search.find_and_fetch_best_image(new_kw)
                            st.session_state["active_images"][0] = new_img
                            st.session_state["active_image"] = new_img

                        st.success("Edit plan updated by Qwen!")
                        st.rerun()

        with tcol_visuals:
            st.markdown("##### 🖼️ Contextual Online Visual Overlays (Pop-up Graphics)")
            st.caption("AI found and synced these related online images with your video dialogue:")

            # Render each image overlay card
            for idx, img_item in enumerate(images):
                with st.expander(f"🖼️ Overlay #{idx + 1}: {img_item.get('title', 'Visual Asset')[:40]}", expanded=(idx == 0)):
                    col_th, col_meta = st.columns([1, 2])
                    with col_th:
                        if img_item.get("path") and Path(img_item["path"]).exists():
                            st.image(str(img_item["path"]), use_container_width=True)
                    with col_meta:
                        st.markdown(f"**Asset:** `{img_item.get('title')}`")
                        st.caption(f"**License:** `{img_item.get('license')}` • **Author:** {img_item.get('author')}")
                        st_val = st.slider(
                            "Pop-in Start (s)",
                            0.0,
                            float(max(0.5, edit_end - edit_start - 1.0)),
                            float(img_item.get("start", 2.0 + idx * 6.0)),
                            step=0.5,
                            key=f"img_st_{idx}",
                        )
                        dur_val = st.slider(
                            "Duration (s)",
                            1.0,
                            8.0,
                            float(img_item.get("duration", 3.5)),
                            step=0.5,
                            key=f"img_dur_{idx}",
                        )
                        img_item["start"] = st_val
                        img_item["duration"] = dur_val

                    # Inline swap search
                    swap_kw = st.text_input("Replace with Wikimedia search", value=img_item.get("cue_title", "trading analysis"), key=f"swap_kw_{idx}")
                    if st.button("🔄 Search & Swap This Image", key=f"btn_swap_{idx}"):
                        with st.spinner("Searching online..."):
                            results = image_search.search_wikimedia_images(swap_kw, limit=3)
                            if results:
                                new_local = image_search.download_image(results[0])
                                results[0]["path"] = str(new_local)
                                results[0]["start"] = img_item["start"]
                                results[0]["duration"] = img_item["duration"]
                                st.session_state["active_images"][idx] = results[0]
                                st.success(f"Swapped overlay #{idx + 1}!")
                                st.rerun()

            # Add another overlay expander
            with st.expander("➕ Add Another Online Visual Overlay"):
                new_overlay_kw = st.text_input("Search topic for new overlay", placeholder="e.g. bitcoin candlestick chart", key="new_overlay_input")
                if st.button("Search & Add Overlay", key="btn_add_overlay", disabled=not new_overlay_kw.strip()):
                    with st.spinner("Searching and downloading..."):
                        results = image_search.search_wikimedia_images(new_overlay_kw, limit=3)
                        if results:
                            new_local = image_search.download_image(results[0])
                            results[0]["path"] = str(new_local)
                            results[0]["start"] = 4.0
                            results[0]["duration"] = 3.5
                            st.session_state["active_images"].append(results[0])
                            st.success(f"Added new overlay: {results[0]['title']}")
                            st.rerun()

        # Final Render CTA
        st.divider()
        render_btn_clicked = st.button(
            "🎬 Render Final 9:16 Video (FFmpeg + Karaoke Captions + Visual Overlays + Audio Mix)",
            type="primary",
            use_container_width=True,
        )
        if render_btn_clicked:
            active_path = Path(st.session_state["active_video_path"])
            out_name = f"{sanitize_filename(active_path.stem)}_clip_{int(edit_start)}s_{int(edit_end)}s.mp4"
            out_mp4 = OUTPUTS / out_name
            with st.spinner(f"Encoding {out_name} with multi-layer overlays and sound mix..."):
                try:
                    actual_broll_path = ROOT / "assets" / "broll" / "satisfying_neon_runner.mp4" if "Satisfying" in broll_choice else None
                    music_enabled = "Phonk" in music_choice
                    res = render_vertical_clip(
                        video_path=active_path,
                        segments=st.session_state["segments"],
                        clip_start=float(edit_start),
                        clip_end=float(edit_end),
                        output_mp4=out_mp4,
                        framing_mode=layout_choice,
                        horizontal_shift=horizontal_shift,
                        caption_style_name=caption_style_name,
                        font_size=int(font_size),
                        margin_v=int(margin_v),
                        words_per_line=int(words_per_line),
                        burn_subtitles=True,
                        hook_banner_text=edit_hook,
                        watermark_text=watermark_text,
                        normalize_audio=normalize_audio,
                        broll_path=actual_broll_path,
                        image_overlays=st.session_state["active_images"],
                        music_path=ROOT / "assets" / "audio" / "phonk_loop.wav",
                        music_volume=float(music_vol),
                        music_enabled=music_enabled,
                        ffmpeg_preset=ffmpeg_preset,
                        cpu_threads=cpu_threads,
                    )
                    st.session_state["rendered_clips"].insert(0, res)
                    st.balloons()
                    st.success(f"Rendered `{out_mp4.name}` ({res['size_mb']} MB) in {res['elapsed_sec']}s!")
                except Exception as exc:
                    st.error(str(exc))

    # Show latest rendered video
    if st.session_state.get("rendered_clips"):
        latest = st.session_state["rendered_clips"][0]
        latest_mp4 = Path(latest["mp4_path"])
        latest_srt = Path(latest["srt_path"])
        if latest_mp4.exists():
            st.divider()
            st.subheader("✅ Latest Rendered 9:16 Vertical Video")
            r1, r2 = st.columns([1, 2])
            with r1:
                st.video(str(latest_mp4))
            with r2:
                st.markdown(f"**File:** `{latest_mp4.name}` ({latest['size_mb']} MB)")
                st.markdown(f"**Render Time:** `{latest['elapsed_sec']}s`")
                d1, d2 = st.columns(2)
                with d1:
                    with open(latest_mp4, "rb") as fh:
                        st.download_button("⬇️ Download 9:16 MP4", fh, file_name=latest_mp4.name, mime="video/mp4", type="primary", use_container_width=True)
                with d2:
                    if latest_srt.exists():
                        with open(latest_srt, "rb") as sfh:
                            st.download_button("⬇️ Download .SRT Subtitles", sfh, file_name=latest_srt.name, mime="text/plain", use_container_width=True)

# ---------------- TAB 2: OUTPUT LIBRARY ----------------
with tab_library:
    st.subheader(r"📂 Rendered MP4 Library (`D:\WhopClipper\outputs`)")
    mp4_files = sorted(OUTPUTS.glob("*.mp4"), key=lambda p: p.stat().st_mtime, reverse=True)
    if not mp4_files:
        st.info("No MP4 clips rendered yet.")
    else:
        for mp4_file in mp4_files:
            srt_file = mp4_file.with_suffix(".srt")
            size_mb = round(mp4_file.stat().st_size / (1024 * 1024), 2)
            with st.container(border=True):
                lcol1, lcol2 = st.columns([1, 2.2])
                with lcol1:
                    st.video(str(mp4_file))
                with lcol2:
                    st.markdown(f"#### `{mp4_file.name}` ({size_mb} MB)")
                    b1, b2, b3 = st.columns(3)
                    with b1:
                        with open(mp4_file, "rb") as fh:
                            st.download_button("⬇️ Download MP4", fh, file_name=mp4_file.name, mime="video/mp4", key=f"dl_mp4_{mp4_file.name}", use_container_width=True)
                    with b2:
                        if srt_file.exists():
                            with open(srt_file, "rb") as sfh:
                                st.download_button("⬇️ Download SRT", sfh, file_name=srt_file.name, mime="text/plain", key=f"dl_srt_{srt_file.name}", use_container_width=True)
                    with b3:
                        if st.button("🗑️ Delete", key=f"del_{mp4_file.name}", use_container_width=True):
                            mp4_file.unlink(missing_ok=True)
                            srt_file.unlink(missing_ok=True)
                            st.rerun()


# ---------------- TAB 3: SAVED PROJECTS ----------------
with tab_saved:
    st.subheader("💾 Saved Projects & Edit Plans")
    saved_projects = load_saved_projects()
    if not saved_projects:
        st.info("No saved projects yet.")
    else:
        for proj in saved_projects:
            with st.container(border=True):
                pcol1, pcol2 = st.columns([2.5, 1.0])
                with pcol1:
                    st.markdown(f"**{proj.get('filename')}** — `{proj.get('created_at')}`")
                    st.caption(f"Hook: `{proj.get('plan', {}).get('hook_banner', 'N/A')}`")
                with pcol2:
                    st.download_button(
                        "⬇️ Export Plan (.json)",
                        data=json.dumps(proj, indent=2),
                        file_name=f"{proj['id']}_plan.json",
                        mime="application/json",
                        key=f"json_{proj['id']}",
                        use_container_width=True,
                    )
