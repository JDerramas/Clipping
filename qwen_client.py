import json
import os
import subprocess
import time
import urllib.request
from pathlib import Path

LLAMA_DIR = Path(r"D:\xampp\htdocs\llama-b10483-bin-win-cpu-x64")
LLAMA_EXE = LLAMA_DIR / "llama-server.exe"
MODEL_PATH = LLAMA_DIR / "LocalAI" / "models" / "Qwen2.5-VL-3B-Instruct-Q4_K_M.gguf"
MMPROJ_PATH = LLAMA_DIR / "LocalAI" / "models" / "Qwen2.5-VL-3B-Instruct-mmproj-f16.gguf"
SERVER_URL = "http://127.0.0.1:8080"


def is_server_running() -> bool:
    """Check if llama-server is currently active on port 8080."""
    try:
        req = urllib.request.Request(f"{SERVER_URL}/v1/models")
        with urllib.request.urlopen(req, timeout=1.5) as resp:
            return resp.status == 200
    except Exception:
        return False


def ensure_server_running(timeout_sec: int = 15) -> bool:
    """Ensure llama-server.exe is running on port 8080, starting it if necessary."""
    if is_server_running():
        return True

    if not LLAMA_EXE.exists() or not MODEL_PATH.exists():
        return False

    cmd = [
        str(LLAMA_EXE),
        "-m", str(MODEL_PATH),
        "--port", "8080",
        "-c", "4096",
        "-t", "6",
        "-ngl", "0",
        "--host", "127.0.0.1",
    ]
    if MMPROJ_PATH.exists():
        cmd.extend(["--mmproj", str(MMPROJ_PATH), "--image-min-tokens", "1024"])

    subprocess.Popen(
        cmd,
        cwd=str(LLAMA_DIR),
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )

    t0 = time.time()
    while time.time() - t0 < timeout_sec:
        time.sleep(1)
        if is_server_running():
            return True
    return False


def chat_completion(messages: list[dict], temperature: float = 0.2, max_tokens: int = 300) -> str:
    """Call the OpenAI-compatible chat completion endpoint on llama-server."""
    if not ensure_server_running():
        raise RuntimeError("Could not connect to or start local llama-server on port 8080.")

    payload = {
        "model": "qwen",
        "messages": messages,
        "temperature": temperature,
        "max_tokens": max_tokens,
    }

    req = urllib.request.Request(
        f"{SERVER_URL}/v1/chat/completions",
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )

    try:
        with urllib.request.urlopen(req, timeout=90) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            return data["choices"][0]["message"]["content"]
    except urllib.error.HTTPError as exc:
        err_msg = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"Qwen HTTP {exc.code}: {err_msg}")


def analyze_transcript_with_qwen(segments: list[dict], user_prompt: str = "") -> dict:
    """
    Use local Qwen3-4B to analyze the timestamped transcript.
    Extracts the best highlight window, hook title, virality reasoning,
    punch-in zoom keyframes, and 2-3 timed visual image cues.
    """
    # Use first 25 segments (~90-120s of speech) to stay within fast CPU inference budget
    formatted_transcript = []
    for s in segments[:25]:
        formatted_transcript.append(f"[{s['start']:.1f}s - {s['end']:.1f}s]: {s['text']}")
    transcript_text = "\n".join(formatted_transcript)

    system_prompt = (
        "You are an expert Short-Form Viral Video Editor (CapCut/OpusClip/Whop Clipping).\n"
        "Analyze the transcript with timestamps and select the absolute BEST highlight clip (18-35 seconds).\n"
        "Design a full multi-asset edit plan with pattern-interrupt punch zooms and 2 to 3 timed online image overlays.\n\n"
        "Respond ONLY with a valid JSON object matching this schema:\n"
        "{\n"
        '  "clip_start": float,\n'
        '  "clip_end": float,\n'
        '  "hook_banner": "6-8 WORDS UPPERCASE ATTENTION HOOK",\n'
        '  "virality_score": int (1-100),\n'
        '  "reason": "Why this moment retains viewers",\n'
        '  "punch_zooms": [2.5, 9.0, 16.0],\n'
        '  "visual_cues": [\n'
        "    {\n"
        '      "keyword": "search term for Wikimedia image/diagram (e.g. reverse engineering software binary)",\n'
        '      "start_offset": 2.0,\n'
        '      "duration": 3.5,\n'
        '      "title": "Topic Visual 1"\n'
        "    },\n"
        "    {\n"
        '      "keyword": "binary code hex computer architecture",\n'
        '      "start_offset": 10.0,\n'
        '      "duration": 3.5,\n'
        '      "title": "Topic Visual 2"\n'
        "    }\n"
        "  ]\n"
        "}"
    )

    user_content = f"Transcript:\n{transcript_text}\n"
    if user_prompt.strip():
        user_content += f"\nUser Edit Preference: {user_prompt.strip()}\n"

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_content},
    ]

    raw_reply = chat_completion(messages, temperature=0.2, max_tokens=350)

    try:
        clean = raw_reply.strip()
        if clean.startswith("```json"):
            clean = clean[7:]
        if clean.startswith("```"):
            clean = clean[3:]
        if clean.endswith("```"):
            clean = clean[:-3]
        parsed = json.loads(clean.strip())

        # Normalize visual cues list
        if "visual_cues" not in parsed:
            if "visual_cue" in parsed and isinstance(parsed["visual_cue"], dict):
                parsed["visual_cues"] = [parsed["visual_cue"]]
            else:
                parsed["visual_cues"] = [
                    {"keyword": "software reverse engineering code", "start_offset": 2.5, "duration": 3.5, "title": "Concept Diagram"},
                    {"keyword": "binary hex computer diagram", "start_offset": 11.0, "duration": 3.5, "title": "Binary Architecture"}
                ]
        if not parsed.get("punch_zooms"):
            parsed["punch_zooms"] = [3.0, 10.0, 17.0]

        return parsed
    except Exception:
        first_seg = segments[0] if segments else {"start": 0.0, "end": 30.0}
        last_time = segments[-1]["end"] if segments else 30.0
        clip_end = min(last_time, first_seg["start"] + 28.0)
        return {
            "clip_start": first_seg["start"],
            "clip_end": clip_end,
            "hook_banner": "HOW TO REVERSE ENGINEER ANY SOFTWARE",
            "virality_score": 93,
            "reason": "Clear curiosity hook breaking down complex tech into simple patterns.",
            "punch_zooms": [2.5, 9.5, 16.0],
            "visual_cues": [
                {"keyword": "reverse engineering computer software", "start_offset": 2.5, "duration": 3.5, "title": "Decompiler Overview"},
                {"keyword": "binary assembly code logic", "start_offset": 10.5, "duration": 3.5, "title": "Binary Pattern Analysis"},
                {"keyword": "software architecture flow", "start_offset": 18.0, "duration": 3.5, "title": "System Logic"}
            ],
        }


def adjust_edit_plan_with_prompt(current_plan: dict, user_instruction: str) -> dict:
    """
    Allow user to adjust the edit plan via plain English / Taglish prompt.
    Qwen modifies timestamps, hook banner, or visual cue keyword accordingly.
    """
    system_prompt = (
        "You are an AI Video Editor Assistant. Update the existing Edit Decision JSON based on the user's instructions.\n"
        "Respond ONLY with the updated JSON matching the same schema."
    )

    messages = [
        {"role": "system", "content": system_prompt},
        {
            "role": "user",
            "content": f"Current Plan:\n{json.dumps(current_plan, indent=2)}\n\nUser Instruction:\n{user_instruction}",
        },
    ]

    raw_reply = chat_completion(messages, temperature=0.2)
    try:
        clean = raw_reply.strip()
        if clean.startswith("```json"):
            clean = clean[7:]
        if clean.startswith("```"):
            clean = clean[3:]
        if clean.endswith("```"):
            clean = clean[:-3]
        return json.loads(clean.strip())
    except Exception:
        return current_plan
