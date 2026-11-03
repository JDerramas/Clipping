#!/usr/bin/env python3
"""
Hermes & OpenAI Bridge for AgentRouter (gpt-6-astra / gpt-6.1-sol / gpt-5.6-sol)
---------------------------------------------------------------------------------
High-performance local proxy with:
  * Full Server-Sent Events (SSE) streaming support (live token streaming)
  * Multi-threaded request handling (never blocks parallel checks)
  * Endpoint compatibility for OpenAI (/v1/models, /v1/models/<id>),
    Ollama (/api/tags, /api/show), and LM Studio (/props, /version)
  * Private network CORS support for Electron / browser clients
  * 120s timeout for complex agent prompts
"""

import os
import sys
import json
import time
import urllib.request
import urllib.error
from urllib.parse import urlparse
from pathlib import Path
from http.server import HTTPServer, BaseHTTPRequestHandler
from socketserver import ThreadingMixIn

PORT = 8318
ROOT_DIR = Path(__file__).resolve().parent

# Default API Key from .env if available
DEFAULT_KEY = "sk-VgxdXqC7zZRza6Cvwp4ExflA6ZK7bFMehAGEQaOlnxXTE4hq"
env_file = ROOT_DIR / ".env"
if env_file.exists():
    for line in env_file.read_text(encoding="utf-8").splitlines():
        if line.startswith("AGENTROUTER_API_KEY="):
            DEFAULT_KEY = line.split("=", 1)[1].strip().strip("'\"")

AVAILABLE_MODELS = ["gpt-6-astra", "gpt-6.1-sol", "gpt-5.6-sol"]

class ThreadedHTTPServer(ThreadingMixIn, HTTPServer):
    daemon_threads = True
    allow_reuse_address = True

class AgentRouterBridgeHandler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def _send_cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS, HEAD")
        self.send_header("Access-Control-Allow-Headers", "*")
        self.send_header("Access-Control-Expose-Headers", "*")
        self.send_header("Access-Control-Allow-Private-Network", "true")

    def do_OPTIONS(self):
        self.send_response(204)
        self._send_cors()
        self.end_headers()

    def do_HEAD(self):
        self.send_response(200)
        self._send_cors()
        self.end_headers()

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path.rstrip("/")

        # Health check endpoints
        if path in ("", "/", "/v1"):
            body = b'{"status": "ok", "service": "hermes-agentrouter-bridge", "models_url": "/v1/models"}'
            self.send_response(200)
            self._send_cors()
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return

        # /v1/models list
        if path in ("/v1/models", "/models", "/api/models"):
            models_data = {
                "object": "list",
                "data": [
                    {"id": m, "object": "model", "created": 1793710000, "owned_by": "agentrouter"}
                    for m in AVAILABLE_MODELS
                ]
            }
            body = json.dumps(models_data).encode("utf-8")
            self.send_response(200)
            self._send_cors()
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return

        # Single model endpoint: /v1/models/<model_id> or /models/<model_id>
        if path.startswith("/v1/models/") or path.startswith("/models/"):
            model_id = path.split("/")[-1]
            model_data = {
                "id": model_id,
                "object": "model",
                "created": 1793710000,
                "owned_by": "agentrouter"
            }
            body = json.dumps(model_data).encode("utf-8")
            self.send_response(200)
            self._send_cors()
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return

        # Ollama probe: /api/tags
        if path in ("/api/tags", "/tags"):
            tags_data = {
                "models": [
                    {"name": m, "model": m, "modified_at": "2026-11-03T00:00:00Z", "size": 0}
                    for m in AVAILABLE_MODELS
                ]
            }
            body = json.dumps(tags_data).encode("utf-8")
            self.send_response(200)
            self._send_cors()
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return

        # LM Studio / Ollama probe: /version, /props, /v1/props
        if path in ("/version", "/api/version", "/props", "/v1/props"):
            body = b'{"version": "0.1.0", "status": "ok"}'
            self.send_response(200)
            self._send_cors()
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return

        # Default 404 for unknown GET
        self.send_response(404)
        self._send_cors()
        self.end_headers()

    def do_POST(self):
        parsed = urlparse(self.path)
        path = parsed.path.rstrip("/")

        # Always drain incoming request body to prevent HTTP keep-alive socket corruption
        content_length = int(self.headers.get("Content-Length", 0))
        raw_body = self.rfile.read(content_length) if content_length > 0 else b"{}"

        # Ollama probe: /api/show
        if path in ("/api/show", "/show"):
            show_data = {
                "details": {"format": "gguf", "family": "gpt", "parameter_size": "unknown"},
                "model_info": {"general.architecture": "gpt"}
            }
            body = json.dumps(show_data).encode("utf-8")
            self.send_response(200)
            self._send_cors()
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return

        # Handle chat completions
        if path in ("/v1/chat/completions", "/chat/completions", "/api/chat/completions"):
            try:
                payload = json.loads(raw_body.decode("utf-8", errors="replace"))
            except Exception:
                payload = {}

            # Extract API Key from request header or fallback to default
            auth_header = self.headers.get("Authorization", "")
            key = DEFAULT_KEY
            if auth_header.startswith("Bearer "):
                extracted = auth_header[len("Bearer "):].strip()
                if extracted.startswith("sk-") and len(extracted) > 30 and not extracted.startswith("sk-dummy"):
                    key = extracted

            model = payload.get("model") or "gpt-6-astra"
            is_stream = bool(payload.get("stream", False))
            messages = payload.get("messages", [])

            # Format messages cleanly into unified prompt
            prompt_parts = []
            for m in messages:
                role = str(m.get("role", "user")).capitalize()
                content = m.get("content", "")
                if isinstance(content, list):
                    content = " ".join([c.get("text", "") for c in content if isinstance(c, dict)])
                prompt_parts.append(f"{role}: {content}")
            full_input = "\n\n".join(prompt_parts) if prompt_parts else "Hello"

            print(f"[Bridge] Incoming chat request | model: {model} | stream: {is_stream} | msgs: {len(messages)} | chars: {len(full_input)}")

            ar_url = "https://agentrouter.org/v1/responses"
            ar_headers = {
                "Authorization": f"Bearer {key}",
                "Originator": "codex_cli_rs",
                "User-Agent": "codex_cli_rs/0.101.0 (Windows NT 10.0; Win64; x64)",
                "Content-Type": "application/json"
            }

            completion_id = f"chatcmpl-astra-{int(time.time()*1000)}"
            created_ts = int(time.time())

            # STREAMING MODE (Hermes live tokens)
            if is_stream:
                ar_body = {
                    "model": model,
                    "input": full_input,
                    "stream": True
                }
                try:
                    req = urllib.request.Request(
                        ar_url,
                        data=json.dumps(ar_body).encode("utf-8"),
                        headers=ar_headers
                    )
                    # 120s timeout for initial response
                    resp = urllib.request.urlopen(req, timeout=120)

                    self.send_response(200)
                    self._send_cors()
                    self.send_header("Content-Type", "text/event-stream")
                    self.send_header("Cache-Control", "no-cache")
                    self.send_header("Connection", "keep-alive")
                    self.end_headers()

                    # Send initial role chunk
                    init_chunk = {
                        "id": completion_id,
                        "object": "chat.completion.chunk",
                        "created": created_ts,
                        "model": model,
                        "choices": [{"index": 0, "delta": {"role": "assistant", "content": ""}, "finish_reason": None}]
                    }
                    self.wfile.write(f"data: {json.dumps(init_chunk)}\n\n".encode("utf-8"))
                    self.wfile.flush()

                    # Stream AgentRouter deltas
                    for raw_line in resp:
                        line = raw_line.decode("utf-8", errors="replace").strip()
                        if line.startswith("data: "):
                            raw_data = line[6:].strip()
                            if raw_data in ("[DONE]", ""):
                                continue
                            try:
                                event_data = json.loads(raw_data)
                                # AgentRouter responses emit output_text.delta
                                if event_data.get("type") == "response.output_text.delta":
                                    delta_text = event_data.get("delta", "")
                                    if delta_text:
                                        chunk_obj = {
                                            "id": completion_id,
                                            "object": "chat.completion.chunk",
                                            "created": created_ts,
                                            "model": model,
                                            "choices": [{"index": 0, "delta": {"content": delta_text}, "finish_reason": None}]
                                        }
                                        self.wfile.write(f"data: {json.dumps(chunk_obj)}\n\n".encode("utf-8"))
                                        self.wfile.flush()
                            except Exception:
                                pass

                    # Send stop chunk & [DONE]
                    final_chunk = {
                        "id": completion_id,
                        "object": "chat.completion.chunk",
                        "created": created_ts,
                        "model": model,
                        "choices": [{"index": 0, "delta": {}, "finish_reason": "stop"}]
                    }
                    self.wfile.write(f"data: {json.dumps(final_chunk)}\n\n".encode("utf-8"))
                    self.wfile.write(b"data: [DONE]\n\n")
                    self.wfile.flush()
                    print(f"[Bridge] Stream finished successfully for {model}")
                    return

                except Exception as e:
                    sys.stderr.write(f"[Bridge Stream Error] {e}\n")
                    # If stream hasn't started headers yet, send 500
                    try:
                        err_chunk = {
                            "id": completion_id,
                            "object": "chat.completion.chunk",
                            "created": created_ts,
                            "model": model,
                            "choices": [{"index": 0, "delta": {"content": f"\n\n[Bridge Error: {e}]"}, "finish_reason": "stop"}]
                        }
                        self.wfile.write(f"data: {json.dumps(err_chunk)}\n\n".encode("utf-8"))
                        self.wfile.write(b"data: [DONE]\n\n")
                        self.wfile.flush()
                    except Exception:
                        pass
                    return

            # NON-STREAMING MODE
            ar_body = {
                "model": model,
                "input": full_input,
                "stream": False
            }
            try:
                req = urllib.request.Request(
                    ar_url,
                    data=json.dumps(ar_body).encode("utf-8"),
                    headers=ar_headers
                )
                with urllib.request.urlopen(req, timeout=120) as resp:
                    res = json.loads(resp.read().decode("utf-8", errors="replace"))

                reply_text = ""
                for item in res.get("output", []):
                    if item.get("type") == "message":
                        for c in item.get("content", []):
                            txt = c.get("text", "")
                            if txt:
                                reply_text += txt

                if not reply_text:
                    reply_text = "No response generated."

                openai_res = {
                    "id": completion_id,
                    "object": "chat.completion",
                    "created": created_ts,
                    "model": model,
                    "choices": [
                        {
                            "index": 0,
                            "message": {
                                "role": "assistant",
                                "content": reply_text
                            },
                            "finish_reason": "stop"
                        }
                    ],
                    "usage": {
                        "prompt_tokens": len(full_input.split()),
                        "completion_tokens": len(reply_text.split()),
                        "total_tokens": len(full_input.split()) + len(reply_text.split())
                    }
                }
                out_bytes = json.dumps(openai_res).encode("utf-8")
                self.send_response(200)
                self._send_cors()
                self.send_header("Content-Type", "application/json")
                self.send_header("Content-Length", str(len(out_bytes)))
                self.end_headers()
                self.wfile.write(out_bytes)
                print(f"[Bridge] Successfully served {model} response ({len(reply_text)} chars)")
                return

            except urllib.error.HTTPError as e:
                err_msg = e.read().decode("utf-8", errors="replace")
                safe_err = err_msg.encode("ascii", "replace").decode("ascii")
                sys.stderr.write(f"[Bridge Error] {e.code}: {safe_err}\n")
                self.send_response(e.code)
                self._send_cors()
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps({"error": {"message": safe_err}}).encode("utf-8"))
                return
            except Exception as e:
                sys.stderr.write(f"[Bridge Error] {e}\n")
                self.send_response(500)
                self._send_cors()
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps({"error": {"message": str(e)}}).encode("utf-8"))
                return

        self.send_response(404)
        self._send_cors()
        self.end_headers()

def main():
    server_address = ("0.0.0.0", PORT)
    httpd = ThreadedHTTPServer(server_address, AgentRouterBridgeHandler)
    print("=" * 65)
    print("Hermes & OpenAI Bridge for AgentRouter (gpt-6-astra / gpt-6.1-sol)")
    print(f"Listening on: http://127.0.0.1:{PORT}/v1 (0.0.0.0)")
    print("=" * 65)
    print("Config for Hermes / any OpenAI app:")
    print(f"  * Base URL: http://127.0.0.1:{PORT}/v1")
    print(f"  * API Key:  {DEFAULT_KEY[:12]}...")
    print("  * Models:   gpt-6-astra, gpt-6.1-sol, gpt-5.6-sol")
    print("=" * 65)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping bridge server...")
        httpd.server_close()

if __name__ == "__main__":
    main()
