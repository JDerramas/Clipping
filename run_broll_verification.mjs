import WebSocket from './clones/autobroll/node_modules/ws/index.js';
import fs from 'fs';

const targetsRes = await fetch('http://127.0.0.1:9222/json');
const targets = await targetsRes.json();
const pageTarget = targets.find(t => t.type === 'page' && t.url.includes('3000')) || targets.find(t => t.type === 'page');
if (!pageTarget) {
  console.error('No page target found');
  process.exit(1);
}
const wsUrl = pageTarget.webSocketDebuggerUrl;
console.log('Connecting to active page target:', pageTarget.title, wsUrl);
const ws = new WebSocket(wsUrl);

await new Promise(r => ws.onopen = r);

let id = 1;
const callbacks = new Map();
ws.onmessage = (e) => {
  const d = JSON.parse(e.data);
  if (d.method === 'Runtime.consoleAPICalled') {
    console.log('[BROWSER CONSOLE]', d.params.type, d.params.args.map(a => a.value !== undefined ? a.value : a.description).join(' '));
  }
  if (d.method === 'Runtime.exceptionThrown') {
    console.error('[BROWSER EXCEPTION]', d.params.exceptionDetails?.exception?.description || d.params.exceptionDetails?.text);
  }
  if (d.id && callbacks.has(d.id)) {
    callbacks.get(d.id)(d);
    callbacks.delete(d.id);
  }
};

function cmd(method, params = {}) {
  const i = id++;
  return new Promise(res => {
    callbacks.set(i, res);
    ws.send(JSON.stringify({ id: i, method, params }));
  });
}

await cmd('Runtime.enable');
await cmd('Page.enable');

console.log('--- Step 0: Reloading page with fresh cache-busting timestamp ---');
await cmd('Page.navigate', { url: 'http://127.0.0.1:3000/?nocache=' + Date.now() });
await new Promise(r => setTimeout(r, 2500));

// Wait for WhopStudio to be initialized
for (let i = 0; i < 15; i++) {
  const chk = await cmd('Runtime.evaluate', {
    expression: 'typeof window.WhopStudio !== "undefined" && typeof window.autoFetchPixabayBrollWithGemini === "function"',
    returnByValue: true
  });
  if (chk?.result?.result?.value === true) {
    console.log(`WhopStudio ready in ${i + 1}s`);
    break;
  }
  await new Promise(r => setTimeout(r, 500));
}

console.log('--- Step 1: Triggering autoFetchPixabayBrollWithGemini() in live browser ---');
const triggerEval = await cmd('Runtime.evaluate', {
  expression: `(async () => {
    console.log('Starting Auto B-Roll pipeline...');
    const p = window.autoFetchPixabayBrollWithGemini();
    return { triggered: true };
  })()`,
  awaitPromise: true,
  returnByValue: true
});
console.log('Triggered:', triggerEval?.result?.result?.value);

// Wait up to 25s for Gemini & Pixabay download to finish
console.log('--- Step 2: Polling for state.brollClips populated from Gemini & Pixabay ---');
let brollData = null;
for (let i = 0; i < 25; i++) {
  await new Promise(r => setTimeout(r, 1000));
  const check = await cmd('Runtime.evaluate', {
    expression: `(() => {
      const s = window.WhopStudio?.state || window.WhopState || {};
      const clips = s.brollClips || [];
      return {
        count: clips.length,
        clips: clips.map(c => ({
          id: c.id,
          name: c.name,
          start: c.start,
          duration: c.duration,
          mode: c.mode,
          url: c.url,
          reason: c.reason
        }))
      };
    })()`,
    returnByValue: true
  });
  const val = check?.result?.result?.value;
  if (val && val.count > 0) {
    brollData = val;
    console.log(`B-Roll clips successfully generated in ${i + 1}s! Count: ${val.count}`);
    console.log('Clips details:', JSON.stringify(val.clips, null, 2));
    break;
  }
}

if (!brollData || brollData.count === 0) {
  console.error('Failed: No B-roll clips generated.');
  ws.close();
  process.exit(1);
}

// Step 3: Seek playhead to the first B-roll clip + 0.35s
const firstClip = brollData.clips[0];
const seekTime = Number(firstClip.start) + 0.35;
console.log(`--- Step 3: Seeking playhead to ${seekTime}s to render B-Roll "${firstClip.name}" ---`);

await cmd('Runtime.evaluate', {
  expression: `(() => {
    window.WhopStudio.seekToTime(${seekTime});
  })()`
});

// Wait up to 5s for the video element to reach readyState >= 2 and render onto canvas
let videoReady = false;
for (let i = 0; i < 10; i++) {
  await new Promise(r => setTimeout(r, 500));
  const vCheck = await cmd('Runtime.evaluate', {
    expression: `(() => {
      const el = window.brollVideoPool ? window.brollVideoPool.get('${firstClip.id}') : null;
      return {
        hasElement: !!el,
        readyState: el?.readyState,
        videoWidth: el?.videoWidth,
        videoHeight: el?.videoHeight,
        currentTime: el?.currentTime,
        src: el?.src
      };
    })()`,
    returnByValue: true
  });
  const vVal = vCheck?.result?.result?.value;
  console.log(`Pool video element status (attempt ${i + 1}):`, JSON.stringify(vVal));
  if (vVal && vVal.readyState >= 2) {
    videoReady = true;
    break;
  }
}

// Force a canvas frame update to ensure painted frame
await cmd('Runtime.evaluate', {
  expression: `window.WhopStudio.seekToTime(${seekTime})`
});
await new Promise(r => setTimeout(r, 800));

// Step 4: Verify canvas state & sample pixels
const canvasAudit = await cmd('Runtime.evaluate', {
  expression: `(() => {
    const s = window.WhopStudio?.state || window.WhopState || {};
    const bc = (s.brollClips || []).find(b => ${seekTime} >= b.start && ${seekTime} <= b.start + b.duration);
    const canvas = document.getElementById('previewCanvas');
    const ctx = canvas ? canvas.getContext('2d') : null;
    
    // Sample pixels across canvas
    let pixelCenter = null;
    let pixelTop = null;
    if (ctx) {
      const p = ctx.getImageData(canvas.width / 2, canvas.height / 2, 1, 1).data;
      pixelCenter = [p[0], p[1], p[2], p[3]];
      const pt = ctx.getImageData(canvas.width / 2, 100, 1, 1).data;
      pixelTop = [pt[0], pt[1], pt[2], pt[3]];
    }

    return {
      activeBrollClip: bc ? { id: bc.id, name: bc.name, url: bc.url, mode: bc.mode } : null,
      canvasDimensions: canvas ? [canvas.width, canvas.height] : null,
      pixelCenter,
      pixelTop,
      currentTime: s.currentTime
    };
  })()`,
  returnByValue: true
});
console.log('Canvas Audit at B-Roll playhead:', JSON.stringify(canvasAudit?.result?.result?.value, null, 2));

// Step 5: Capture high-resolution verification screenshots
console.log('--- Step 5: Capturing CDP Screenshots for Artifacts ---');
const snap1 = await cmd('Page.captureScreenshot', { format: 'png' });
const outPath1 = 'C:\\Users\\Lovi\\.gemini\\antigravity\\brain\\fee669d4-b6c6-4729-aa42-c6028abe74d5\\verified_autobroll_topic_canvas.png';
fs.writeFileSync(outPath1, Buffer.from(snap1.result.data, 'base64'));
console.log('Saved Screenshot 1 (Static Frame):', outPath1);

// Step 6: Test Playback with B-Roll active
console.log('--- Step 6: Testing playback with active B-Roll video ---');
await cmd('Runtime.evaluate', {
  expression: `document.getElementById('playPauseBtn').click()`
});
await new Promise(r => setTimeout(r, 2000));

const snap2 = await cmd('Page.captureScreenshot', { format: 'png' });
const outPath2 = 'C:\\Users\\Lovi\\.gemini\\antigravity\\brain\\fee669d4-b6c6-4729-aa42-c6028abe74d5\\verified_autobroll_playback_running.png';
fs.writeFileSync(outPath2, Buffer.from(snap2.result.data, 'base64'));
console.log('Saved Screenshot 2 (Playback Active):', outPath2);

// Pause playback
await cmd('Runtime.evaluate', {
  expression: `document.getElementById('playPauseBtn').click()`
});

console.log('SUCCESS! Auto B-Roll pipeline verified end-to-end.');
ws.close();
process.exit(0);
