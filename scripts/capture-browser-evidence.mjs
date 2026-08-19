import { spawn } from 'node:child_process';
import { writeFile } from 'node:fs/promises';

const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const targetUrl = process.argv[2] || 'http://127.0.0.1:4181';
const outputPath = process.argv[3] || 'docs/review/screenshots/mobile-emulated.png';
const width = Number(process.argv[4] || 390);
const height = Number(process.argv[5] || 844);
const runSmoke = process.argv[6] === 'smoke';
const port = 9331;
const profile = `${process.env.TEMP}\\reflex-growth-cdp-${Date.now()}`;
const browser = spawn(edgePath, ['--headless', '--disable-gpu', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' });
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

async function getPage() {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    try {
      const pages = await fetch(`http://127.0.0.1:${port}/json/list`).then(response => response.json());
      if (pages[0]?.webSocketDebuggerUrl) return pages[0];
    } catch { /* Browser is still starting. */ }
    await wait(100);
  }
  throw new Error('Edge DevTools endpoint did not start.');
}

try {
  const page = await getPage();
  const socket = new WebSocket(page.webSocketDebuggerUrl);
  socket.binaryType = 'arraybuffer';
  await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }); });
  let sequence = 0;
  let runtimeExceptions = 0;
  const pending = new Map();
  socket.addEventListener('message', event => {
    const raw = typeof event.data === 'string' ? event.data : Buffer.from(event.data).toString('utf8');
    const message = JSON.parse(raw);
    if (message.method === 'Runtime.exceptionThrown') runtimeExceptions += 1;
    if (!message.id) return;
    const request = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) request.reject(new Error(message.error.message)); else request.resolve(message.result);
  });
  const send = (method, params = {}, timeoutMs = 5000) => new Promise((resolve, reject) => {
    const id = ++sequence;
    const timeout = setTimeout(() => { pending.delete(id); reject(new Error(`DevTools timeout: ${method}`)); }, timeoutMs);
    pending.set(id, { resolve: value => { clearTimeout(timeout); resolve(value); }, reject: error => { clearTimeout(timeout); reject(error); } });
    socket.send(JSON.stringify({ id, method, params }));
  });
  await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: true, screenWidth: width, screenHeight: height });
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Page.navigate', { url: targetUrl });
  await wait(700);
  if (runSmoke) {
    await send('Runtime.evaluate', { expression: "document.querySelector('#reaction-zone').dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,button:0}))" });
    let signalVisible = false;
    for (let attempt = 0; attempt < 40; attempt += 1) {
      await wait(100);
      const phase = await send('Runtime.evaluate', { expression: "document.querySelector('#game').classList.contains('phase-signal')", returnByValue: true });
      if (phase.result.value) { signalVisible = true; break; }
    }
    if (!signalVisible) throw new Error('Browser smoke test did not reach the signal state.');
    await send('Runtime.evaluate', { expression: "document.querySelector('#reaction-zone').dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,button:0}))" });
    await wait(120);
    const result = await send('Runtime.evaluate', { expression: "({waiting:document.querySelector('#game').classList.contains('phase-waiting'),last:document.querySelector('#last-time').textContent,instruction:document.querySelector('#state-label').textContent})", returnByValue: true });
    if (!result.result.value.waiting || !result.result.value.last.includes('ms') || result.result.value.instruction !== 'WAIT…') throw new Error('Browser smoke test did not record a result and automatically continue waiting.');
    if (runtimeExceptions) throw new Error(`Browser smoke test observed ${runtimeExceptions} runtime exception(s).`);
    console.log(`Browser smoke result: ${result.result.value.last}; runtime exceptions: ${runtimeExceptions}`);
  }
  const screenshot = await send('Page.captureScreenshot', { format: 'png', fromSurface: true, captureBeyondViewport: false }, 20000);
  await writeFile(outputPath, Buffer.from(screenshot.data, 'base64'));
  socket.close();
  console.log(`Captured ${width}x${height} browser evidence at ${outputPath}`);
} finally {
  browser.kill();
}
