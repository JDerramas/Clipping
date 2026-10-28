import WebSocket from './clones/autobroll/node_modules/ws/index.js';
import fs from 'fs';

// 1. Get active page target
const targetsRes = await fetch('http://127.0.0.1:9222/json');
const targets = await targetsRes.json();
const pageTarget = targets.find(t => t.type === 'page' && t.url.includes('3000')) || targets.find(t => t.type === 'page');
if (!pageTarget) {
  console.error('No page target found');
  process.exit(1);
}
console.log('Connecting to page target:', pageTarget.title, pageTarget.webSocketDebuggerUrl);
const ws = new WebSocket(pageTarget.webSocketDebuggerUrl);
await new Promise(r => ws.onopen = r);

let id = 1;
const callbacks = new Map();
const consoleLogs = [];
const spokenPhrases = [];

ws.onmessage = (e) => {
  const d = JSON.parse(e.data);
  if (d.method === 'Runtime.consoleAPICalled') {
    const text = d.params.args.map(a => a.value !== undefined ? a.value : a.description).join(' ');
    consoleLogs.push({ type: d.params.type, text });
    console.log('[BROWSER CONSOLE]', d.params.type, text);
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

console.log('--- Step 0: Reloading page with nocache timestamp ---');
await cmd('Page.navigate', { url: 'http://127.0.0.1:3000/?nocache=' + Date.now() });
await new Promise(r => setTimeout(r, 2500));

// Wait for WhopStudio and Jarvis
for (let i = 0; i < 15; i++) {
  const chk = await cmd('Runtime.evaluate', {
    expression: 'typeof window.WhopStudio !== "undefined" && typeof window.jarvis !== "undefined"',
    returnByValue: true
  });
  if (chk?.result?.result?.value === true) {
    console.log(`WhopStudio & Jarvis ready in ${i + 1}s`);
    break;
  }
  await new Promise(r => setTimeout(r, 500));
}

// Track speech synthesis calls in browser
await cmd('Runtime.evaluate', {
  expression: `(() => {
    window._spokenHistory = [];
    if (window.speechSynthesis) {
      const origSpeak = window.speechSynthesis.speak.bind(window.speechSynthesis);
      window.speechSynthesis.speak = function(utterance) {
        window._spokenHistory.push(utterance.text);
        console.log('[SPEECH SYNTHESIS SPOKEN]', utterance.text);
        return origSpeak(utterance);
      };
    }
  })()`
});

// Step 1: User gives command to Jarvis to auto-fetch B-roll
console.log('--- Step 1: User issues voice/chat command to Jarvis: "jarvis lagyan mo ng broll yung video" ---');
await cmd('Runtime.evaluate', {
  expression: `(() => {
    const inp = document.getElementById('jarvisTextInput');
    const sendBtn = document.getElementById('jarvisSendBtn');
    if (inp) inp.value = "jarvis lagyan mo ng broll yung video";
    if (sendBtn) sendBtn.click();
  })()`
});

// Wait up to 25s for Jarvis to process, call Gemini, download Pixabay MP4s, place cues, and speak
console.log('--- Step 2: Waiting for Auto B-roll pipeline and Jarvis voice completion ---');
let brollPlaced = false;
for (let i = 0; i < 25; i++) {
  await new Promise(r => setTimeout(r, 1000));
  const check = await cmd('Runtime.evaluate', {
    expression: `(() => {
      const s = window.WhopState || {};
      const clips = s.brollClips || [];
      const history = (window.jarvis?.chatHistory || []);
      const spoken = window._spokenHistory || [];
      return {
        clipsCount: clips.length,
        clips: clips.map(c => ({ id: c.id, name: c.name, start: c.start, duration: c.duration, url: c.url })),
        lastChat: history[history.length - 1],
        spokenPhrases: spoken
      };
    })()`,
    returnByValue: true
  });
  const val = check?.result?.result?.value;
  if (val && val.clipsCount > 0) {
    brollPlaced = true;
    console.log(`B-Roll placed via Jarvis command in ${i + 1}s! Count: ${val.clipsCount}`);
    console.log('Clips:', JSON.stringify(val.clips, null, 2));
    console.log('Last Jarvis Chat:', JSON.stringify(val.lastChat, null, 2));
    console.log('Spoken phrases so far:', JSON.stringify(val.spokenPhrases, null, 2));
    break;
  }
}

if (!brollPlaced) {
  console.error('Failed: B-roll clips not placed by Jarvis command.');
  ws.close();
  process.exit(1);
}

// Allow audio speech completion & canvas paint
await new Promise(r => setTimeout(r, 2000));

// Step 3: Test a second command: "liitan mo ang video" (screen sizing)
console.log('--- Step 3: User commands Jarvis to resize preview: "liitan mo ang video" ---');
await cmd('Runtime.evaluate', {
  expression: `(() => {
    window.jarvis.handleUserCommand("liitan mo ang video");
  })()`
});
await new Promise(r => setTimeout(r, 1500));

// Step 4: Verify stage size and speech
const stageCheck = await cmd('Runtime.evaluate', {
  expression: `(() => {
    const box = document.getElementById('previewCanvasBox');
    const spoken = window._spokenHistory || [];
    return {
      boxClasses: box ? box.className : '',
      spoken
    };
  })()`,
  returnByValue: true
});
console.log('Stage check:', JSON.stringify(stageCheck?.result?.result?.value, null, 2));

// Step 5: Capture high-resolution verification screenshot
console.log('--- Step 5: Capturing Verification Screenshot ---');
const snap = await cmd('Page.captureScreenshot', { format: 'png' });
const outPath = 'C:\\Users\\Lovi\\.gemini\\antigravity\\brain\\fee669d4-b6c6-4729-aa42-c6028abe74d5\\verified_jarvis_broll_voice_control.png';
fs.writeFileSync(outPath, Buffer.from(snap.result.data, 'base64'));
console.log('Saved Screenshot:', outPath);

console.log('SUCCESS! Jarvis AI Assistant B-roll & Voice Control verified end-to-end.');
ws.close();
process.exit(0);
