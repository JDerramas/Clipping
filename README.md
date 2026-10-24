# 🎬 WhopClipper PRO Studio (Ssemble & CapCut AI Auto-Editor)

A high-performance, full-featured AI short-form vertical video editor inspired by **CapCut**, **OpenCut**, and **Ssemble**. Built for rapid viral video clipping, automated 9:16 vertical reframing, word-by-word dynamic karaoke captions, and professional multi-track timeline editing.

---

## ⚡ Key Features

### 🤖 1. AI 1-Click Auto-Edit (4 Connected Engines + Qwen2.5-VL)
- **`auto-video-editor`**: Audio envelope calculation, silence gap detection, and natural speech sentence boundary snapping.
- **`bridgeclip`**: Neural YuNet ONNX face detection (38ms hardware-accelerated OpenCV DNN) for active speaker tracking and dynamic punch-in zoom.
- **`Autoclip`**: Casiez 1-Euro adaptive low-pass filter (`OneEuroFilter`) with deadband jitter suppression and velocity clamping for buttery smooth camera pans.
- **`OpenClipper`**: `NormalizedBox` geometric coordinate mappings and high-contrast dynamic viral subtitle typography.
- **`Qwen2.5-VL-3B-Instruct`**: Multimodal frame-by-frame visual reasoning that evaluates facial expressions, engagement, and synthesizes pattern-interrupt viral hook titles.

---

### ✂️ 2. CapCut & OpenCut Manual Editing Suite
- **Multi-Track Interactive Timeline**:
  - **Video Cuts Track**: Independent video cuts with custom duration, punch zoom, pan X/Y, speed, and transitions.
  - **Captions Track**: Word-level and sentence-level karaoke subtitle chunks.
  - **Overlays Track**: Top pattern-interrupt hook banner and visual cut-in media.
  - **Audio Waveform Track**: 160-bar normalized audio amplitude with silence indicators.
- **NLE Editing Controls**:
  - `✂️ Split (Ctrl+B / C)`: Razor cut active clip at playhead position.
  - `⏪ Cut In (Q)`: Ripple trim left boundary to playhead.
  - `Cut Out (W) ⏩`: Ripple trim right boundary to playhead.
  - `🗑️ Delete (Del / Backspace)`: Ripple delete selected cut with adjacent gap closure.
  - `◀ / ▶ Frame Stepper`: Step frame-by-frame (1/30s) forward or backward.
  - `🔍 Timeline Zoom`: Switch between focused clip view and full video overview.

---

### 🎨 3. Transitions, Color Grading & Visual Effects
- **Cut Transitions**:
  - ⚡ *Strobe White Flash*
  - 👊 *Dynamic Punch Zoom*
  - 🌈 *Chromatic Glitch Hit*
  - ↔ *Whip Pan Left / Right*
  - ✂ *Hard Cut*
- **Aesthetic Presets & Color Grading**:
  - Presets: *Clean Raw*, *Cinematic Teal & Orange*, *Cyberpunk Neon*, *Moody Noir (B&W)*, *Golden Hour*, *Vintage VHS*, *Vivid Pop*.
  - Manual Adjustments: Brightness, Contrast, Saturation, Temperature/Warmth, Vignette.

---

### 💬 4. Dynamic Word-by-Word Subtitles (Karaoke Pop)
- Presets: **Hormozi Pop**, **MrBeast Bold**, **Bounty Emerald**, **Cyber Neon**, **Clean Minimal**.
- Customizable typography, font size, stroke, glow, and auto-emojis.
- Interactive transcript editor: click any word to seek the playhead, or edit words directly.

---

### 🚀 5. Performance & Hardware Acceleration
- **Zero-Seek Hardware Video Clock**: HTML5 video element drives timeline playback naturally without decoder flush lag or buffer drops.
- **Butter-Smooth 60 FPS Real-Time Canvas Rendering**: Optimized 2D canvas pipeline with hardware-accelerated GPU compositing.

---

## 🛠️ Quick Start

### Prerequisites
- Python 3.10+ (tested on Python 3.12)
- FFmpeg installed and available on system `PATH`
- Modern browser (Chrome / Edge / Brave recommended)

### Installation
```bash
# Clone the repository
git clone https://github.com/JDerramas/Clipping.git
cd Clipping

# Create and activate virtual environment
python -m venv .venv
# On Windows:
.venv\Scripts\activate
# On Linux/macOS:
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

### Running the Studio
```bash
# Start the WhopClipper Studio server
python server.py 3000
```
Open **`http://localhost:3000`** in your browser to begin editing!

---

## 📂 Project Architecture

```
WhopClipper/
├── index.html                  # Studio UI layout & CapCut multi-track timeline
├── styles.css                  # UI/UX OLED Dark Studio design system
├── clipper-app.js              # Client-side 60fps canvas engine & timeline state
├── audio-engine.js             # WebAudio mixer, procedural synth & silence analyzer
├── broll-engine.js             # 60fps procedural B-roll renderer (Minecraft, Subway, etc.)
├── server.py                   # High-performance HTTP/REST server & API dispatcher
├── engine.py                   # FFmpeg media engine & Whisper speech transcription
├── auto_clip_pipeline.py       # 4-engine integration (auto-video-editor, Autoclip, bridgeclip, OpenClipper)
├── qwen_client.py              # Local Qwen2.5-VL-3B-Instruct client
├── ai_multimodal_analyzer.py   # Frame-by-frame visual analysis & viral hook detector
└── requirements.txt            # Python dependencies
```

---

## 📜 License
MIT License
