// ============================================================================
//  Yoru · Reconocedor de voz OFFLINE (Vosk WASM)
//  Funciona en TODOS los navegadores (Brave, Edge, Firefox, etc.) SIN depender
//  del servicio de voz de Google (que Brave/Edge quitan → error "network").
//  Descarga el modelo español UNA sola vez (~40 MB) y el navegador lo cachea;
//  después funciona offline y al instante. Todo el reconocimiento es local.
// ============================================================================

const VOSK_JS = "https://cdn.jsdelivr.net/npm/vosk-browser@0.0.8/dist/vosk.js";
const MODEL_URL = "/vosk/model-es.tar.gz";

let _lib = null, _model = null, _rec = null;
let _ctx = null, _node = null, _source = null, _stream = null, _running = false;

function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (window.Vosk) return resolve(window.Vosk);
    const s = document.createElement("script");
    s.src = src; s.async = true;
    s.onload = () => (window.Vosk ? resolve(window.Vosk) : reject(new Error("vosk no cargó")));
    s.onerror = () => reject(new Error("no se pudo descargar vosk.js"));
    document.head.appendChild(s);
  });
}

// ¿El navegador puede correr Vosk? (contexto seguro + micrófono + WebAssembly)
export function voskAvailable() {
  return !!(
    (window.isSecureContext || location.protocol === "https:") &&
    navigator.mediaDevices && navigator.mediaDevices.getUserMedia &&
    typeof WebAssembly === "object" &&
    (window.AudioContext || window.webkitAudioContext)
  );
}

// Carga el motor + el modelo (una sola vez). onStatus(texto) para avisar progreso.
export async function voskInit(onStatus) {
  if (_model) return;
  onStatus && onStatus("Cargando motor de voz…");
  _lib = await loadScript(VOSK_JS);
  onStatus && onStatus("Descargando voz en español (solo la 1ª vez)…");
  _model = await _lib.createModel(MODEL_URL);
}

// Arranca la escucha continua. onText(frase) por cada frase final; onPartial(txt) en vivo.
// grammar (opcional): JSON string con el vocabulario permitido → más precisión con modelo pequeño.
export async function voskStart(onText, onError, onStatus, onPartial, grammar) {
  if (_running) return;
  await voskInit(onStatus);
  _stream = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 },
  });
  _ctx = new (window.AudioContext || window.webkitAudioContext)();
  // Con gramática (vocabulario acotado) el modelo pequeño acierta mucho más; si el motor no la
  // acepta, cae a reconocimiento libre.
  try { _rec = grammar ? new _model.KaldiRecognizer(_ctx.sampleRate, grammar) : new _model.KaldiRecognizer(_ctx.sampleRate); }
  catch (e) { _rec = new _model.KaldiRecognizer(_ctx.sampleRate); }
  try { _rec.setWords(false); } catch (e) {}
  _rec.on("result", (msg) => {
    const txt = msg && msg.result && msg.result.text;
    if (txt && txt.trim()) onText(txt.trim());
  });
  _rec.on("partialresult", (msg) => {
    const p = msg && msg.result && msg.result.partial;
    if (p && p.trim() && onPartial) onPartial(p.trim());
  });
  _rec.on("error", (e) => { if (onError) onError((e && e.message) || "error de voz"); });
  _source = _ctx.createMediaStreamSource(_stream);
  // ScriptProcessor: compatible con TODOS los navegadores. Solo LEE el audio de entrada
  // (no escribe salida), así que conectarlo al destino no produce eco.
  _node = _ctx.createScriptProcessor(4096, 1, 1);
  _node.onaudioprocess = (ev) => { try { _rec.acceptWaveform(ev.inputBuffer); } catch (e) {} };
  _source.connect(_node);
  _node.connect(_ctx.destination);
  _running = true;
  onStatus && onStatus("listo");
}

export function voskStop() {
  _running = false;
  try { if (_node) { _node.onaudioprocess = null; _node.disconnect(); } } catch (e) {}
  try { if (_source) _source.disconnect(); } catch (e) {}
  try { if (_stream) _stream.getTracks().forEach((t) => t.stop()); } catch (e) {}
  try { if (_ctx) _ctx.close(); } catch (e) {}
  _node = _source = _stream = _ctx = null;
  try { if (_rec) _rec.remove(); } catch (e) {}
  _rec = null;   // el modelo (_model) queda cacheado para reactivar rápido
}

export function voskRunning() { return _running; }
