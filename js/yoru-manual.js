// ============================================================================
//  Yoru · Manual de instrucciones (modal reutilizable)
//  Lo usan main-2025.js (se muestra la 1ª vez) y perfil.html (botón "Ver manual").
// ============================================================================

const CMDS = [
  ["🔍", "Buscar", "«Endo, busca One Piece»"],
  ["▶️", "Abrir un anime", "«Endo, abre Naruto»"],
  ["🎬", "Poner un episodio", "«Endo, pon el episodio 5 de Naruto»"],
  ["⏭️", "Siguiente episodio", "«Endo, siguiente episodio»"],
  ["⏯️", "Continuar viendo", "«Endo, continuar» (retoma lo último)"],
  ["🎞️", "Ver el tráiler", "«Endo, ver el tráiler de One Piece»"],
  ["🧭", "Navegar", "«Endo, ve a explorar / películas / inicio / favoritos»"],
  ["🎲", "Recomendación", "«Endo, recomiéndame algo»"],
];

// Consejo específico según la plataforma en la que se abre el manual.
function platformTip() {
  const ua = navigator.userAgent || "";
  const isTV = /AllAnimeTV|AFT[A-Z0-9]|Fire\s?TV|Android ?TV|Google ?TV|BRAVIA|leanback/i.test(ua);
  const inApp = /AllAnime(App|TV)/i.test(ua);
  if (isTV) return { icon: "📺", t: "En tu Smart TV / Fire TV",
    d: "El botón de micrófono del <b>control remoto</b> es de <b>Alexa/Google</b>, no de Endo. Para usar Endo, mueve el foco con las flechas hasta el <b>botón 🎙️ de Endo en pantalla</b> y pulsa <b>OK/Select</b>; luego di tu orden. (Si tu TV no trae motor de voz, Endo por voz no estará disponible ahí.)" };
  if (inApp) return { icon: "📱", t: "En la app de Android",
    d: "Toca el <b>botón 🎙️ de Endo</b> (abajo a la derecha) y di tu orden. La 1ª vez acepta el permiso de <b>micrófono</b>." };
  const ua2 = ua.toLowerCase();
  if (/edg\//.test(ua2)) return { icon: "🌐", t: "En Microsoft Edge",
    d: "Endo usa un motor de voz que se <b>descarga una sola vez</b>. Solo di «Endo» y tu orden (sin botón)." };
  if (navigator.brave || /brave/.test(ua2)) return { icon: "🦁", t: "En Brave",
    d: "Endo usa un motor de voz <b>offline</b> que se descarga una vez. Di «Endo» y tu orden. Acepta el permiso del micrófono la 1ª vez." };
  return { icon: "💻", t: "En tu navegador",
    d: "Endo se activa sola. Solo di «Endo» y tu orden. La 1ª vez, acepta el permiso del <b>micrófono</b>." };
}

export function showYoruManual() {
  const old = document.getElementById("yoru-manual");
  if (old) old.remove();
  const tip = platformTip();
  const ov = document.createElement("div");
  ov.id = "yoru-manual";
  ov.setAttribute("role", "dialog");
  ov.style.cssText = "position:fixed;inset:0;z-index:100001;background:rgba(0,0,0,.82);display:flex;align-items:center;justify-content:center;padding:20px;backdrop-filter:blur(3px)";
  const rows = CMDS.map(([i, t, ex]) =>
    `<div style="display:flex;gap:12px;align-items:flex-start;padding:11px 0;border-top:1px solid rgba(255,255,255,.08)">
       <span style="font-size:20px;line-height:1.2;flex:0 0 auto">${i}</span>
       <div><div style="font-weight:700;color:#fff">${t}</div>
       <div style="color:#9aa4b2;font-size:14px;margin-top:2px">${ex}</div></div>
     </div>`).join("");
  ov.innerHTML = `
    <div style="max-width:560px;width:100%;max-height:88vh;overflow:auto;background:#14161b;border:1px solid #2a2f3a;border-radius:18px;padding:26px 24px;color:#e6edf3;font-family:Roboto,system-ui,sans-serif;box-shadow:0 24px 70px rgba(0,0,0,.6)">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:6px">
        <div style="width:44px;height:44px;border-radius:50%;background:linear-gradient(135deg,#ca3030,#e23b3b);display:flex;align-items:center;justify-content:center;font-size:20px">🎙️</div>
        <div>
          <h2 style="font-family:Poppins,sans-serif;margin:0;font-size:20px">Endo · tu asistente de voz</h2>
          <div style="color:#9aa4b2;font-size:13px">Controla la página hablando</div>
        </div>
      </div>
      <p style="color:#cdd5df;font-size:15px;line-height:1.6;margin:14px 0 6px">
        Di <b style="color:#fff">«Endo»</b> y tu orden. Cuando te escuche aparecerá el indicador
        <span style="display:inline-block;vertical-align:middle;background:rgba(226,59,59,.18);border:1px solid rgba(226,59,59,.5);color:#ff8a8a;border-radius:20px;padding:1px 9px;font-size:12px;font-weight:700">● Escuchando</span>.
        La primera vez, tu navegador te pedirá permiso del <b>micrófono</b>: acéptalo.
      </p>
      <div style="margin:12px 0;padding:12px 14px;border-radius:12px;background:rgba(226,59,59,.1);border:1px solid rgba(226,59,59,.3)">
        <div style="font-weight:700;color:#fff;font-size:14px">${tip.icon} ${tip.t}</div>
        <div style="color:#cdd5df;font-size:13.5px;line-height:1.55;margin-top:4px">${tip.d}</div>
      </div>
      <div style="margin:8px 0 4px">${rows}</div>
      <p style="color:#7f8896;font-size:12.5px;line-height:1.5;margin:14px 0 0;border-top:1px solid rgba(255,255,255,.08);padding-top:12px">
        Funciona en todos los navegadores (en Brave/Edge usa un motor de voz que se descarga una sola vez).
        Puedes activar o desactivar a Endo, y volver a ver este manual, desde <b>Perfil → Configuración</b>.
      </p>
      <button id="yoru-manual-close" style="margin-top:18px;width:100%;background:#ca3030;color:#fff;border:none;padding:13px;border-radius:40px;font-weight:700;font-size:15px;cursor:pointer">Entendido</button>
    </div>`;
  document.body.appendChild(ov);
  const close = () => ov.remove();
  ov.querySelector("#yoru-manual-close").addEventListener("click", close);
  ov.addEventListener("click", (e) => { if (e.target === ov) close(); });
}
