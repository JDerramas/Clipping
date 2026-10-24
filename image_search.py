import json
import os
import re
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path("D:/WhopClipper") if Path("D:/WhopClipper").exists() else Path(__file__).resolve().parent
ASSETS_DIR = ROOT / "assets" / "images"
ASSETS_DIR.mkdir(parents=True, exist_ok=True)

USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko)"


def clean_filename(name: str) -> str:
    cleaned = re.sub(r"[^a-zA-Z0-9._-]+", "_", name).strip("_")
    return cleaned[:60] or "image"


def search_wikimedia_images(query: str, limit: int = 5) -> list[dict]:
    """
    Query Wikimedia Commons for public domain or Creative Commons images.
    Returns list of dicts: {title, url, thumbnail, license, author, description}
    """
    clean_query = query.strip()
    if not clean_query:
        clean_query = "trading financial chart"

    url = (
        f"https://commons.wikimedia.org/w/api.php?action=query&generator=search"
        f"&gsrsearch={urllib.parse.quote(clean_query)}"
        f"&gsrnamespace=6&gsrlimit={limit}"
        f"&prop=imageinfo&iiprop=url|size|extmetadata"
        f"&format=json"
    )

    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode("utf-8"))
    except Exception:
        return []

    pages = data.get("query", {}).get("pages", {})
    results = []
    for pid, pdata in pages.items():
        title = pdata.get("title", "").replace("File:", "")
        img_info_list = pdata.get("imageinfo", [])
        if not img_info_list:
            continue
        info = img_info_list[0]
        img_url = info.get("url")
        if not img_url:
            continue

        clean_path = urllib.parse.urlparse(img_url).path
        ext = Path(clean_path).suffix.lower()
        if ext not in [".png", ".jpg", ".jpeg", ".webp"]:
            continue

        extmeta = info.get("extmetadata", {})
        license_name = extmeta.get("LicenseShortName", {}).get("value", "Public Domain / CC")
        artist = extmeta.get("Artist", {}).get("value", "Wikimedia Contributor")
        artist_clean = re.sub(r"<[^>]+>", "", artist).strip()[:50]

        results.append({
            "title": title,
            "url": img_url,
            "thumbnail": img_url,
            "license": license_name,
            "author": artist_clean or "Wikimedia Commons",
            "width": info.get("width", 800),
            "height": info.get("height", 600),
        })

    return results


def download_image(img_info: dict, dest_dir: Path = ASSETS_DIR) -> Path:
    """Download the remote image to a local directory."""
    dest_dir.mkdir(parents=True, exist_ok=True)
    clean_path = urllib.parse.urlparse(img_info["url"]).path
    ext = Path(clean_path).suffix.lower() or ".jpg"
    filename = f"{clean_filename(img_info['title'])}{ext}"
    dest_path = dest_dir / filename

    if dest_path.exists() and dest_path.stat().st_size > 5000:
        return dest_path

    req = urllib.request.Request(img_info["url"], headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=15) as resp, open(dest_path, "wb") as f:
        f.write(resp.read())

    return dest_path


def create_procedural_fallback_chart() -> Path:
    """Generate a clean procedural trading visual fallback if offline."""
    chart_path = ASSETS_DIR / "candlestick_chart_sample.png"
    if chart_path.exists() and chart_path.stat().st_size > 2000:
        return chart_path

    import subprocess
    cmd = [
        "ffmpeg", "-y",
        "-f", "lavfi",
        "-i", "color=c=0x131326:s=800x600:d=1",
        "-vf",
        "drawbox=x=80:y=80:w=640:h=440:color=0x252545:t=fill,"
        "drawbox=x=160:y=240:w=40:h=180:color=0x10B981:t=fill,"
        "drawbox=x=178:y=180:w=4:h=300:color=0x10B981:t=fill,"
        "drawbox=x=280:y=300:w=40:h=120:color=0xE11D48:t=fill,"
        "drawbox=x=298:y=220:w=4:h=240:color=0xE11D48:t=fill,"
        "drawbox=x=400:y=160:w=40:h=220:color=0x10B981:t=fill,"
        "drawbox=x=418:y=120:w=4:h=310:color=0x10B981:t=fill,"
        "drawtext=text='CANDLESTICK TECHNICAL ANALYSIS':x=(w-text_w)/2:y=110:fontsize=26:fontcolor=white:borderw=2:bordercolor=black,"
        "drawtext=text='SUPPORT / RESISTANCE ZONE':x=(w-text_w)/2:y=535:fontsize=20:fontcolor=0x10B981",
        "-vframes", "1",
        str(chart_path),
    ]
    subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    return chart_path


def find_and_fetch_best_image(query: str) -> dict:
    """
    Search and download the #1 best matching image for the video visual cue.
    Returns complete metadata including the local file path.
    """
    candidates = search_wikimedia_images(query, limit=5)
    if not candidates:
        candidates = search_wikimedia_images("trading candlestick chart", limit=3)

    if not candidates:
        fallback_path = create_procedural_fallback_chart()
        return {
            "title": "Trading Candlestick Chart",
            "path": str(fallback_path),
            "url": "",
            "license": "Public Domain (Procedural)",
            "author": "WhopClipper AI Studio",
            "candidates": [],
        }

    best = dict(candidates[0])
    local_path = download_image(best)
    best["path"] = str(local_path)
    return best


def fetch_multiple_images(visual_cues: list[dict]) -> list[dict]:
    """
    Search and download multiple timed visual imagery assets for a clip.
    Returns a list of dicts with local file paths and display timestamps.
    """
    downloaded = []
    for idx, cue in enumerate(visual_cues):
        kw = cue.get("keyword", "software reverse engineering")
        img_info = find_and_fetch_best_image(kw)
        img_info["start"] = float(cue.get("start_offset", 2.0 + idx * 8.0))
        img_info["duration"] = float(cue.get("duration", 3.5))
        img_info["cue_title"] = cue.get("title", f"Visual #{idx + 1}")
        downloaded.append(img_info)
    return downloaded
