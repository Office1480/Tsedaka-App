// Reconnaissance vocale (Chrome Android : Web Speech API) et lecture à voix haute.

const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
export const supported = !!SR;

export function listen({ onInterim, onFinal, onError, onEnd } = {}) {
  if (!SR) { onError?.('unsupported'); return () => {}; }
  const r = new SR();
  r.lang = 'fr-FR';
  r.interimResults = true;
  r.continuous = false;
  r.maxAlternatives = 1;
  let final = '';
  r.onresult = (e) => {
    let interim = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const txt = e.results[i][0].transcript;
      if (e.results[i].isFinal) final += txt; else interim += txt;
    }
    onInterim?.((final + ' ' + interim).trim());
  };
  r.onerror = (e) => onError?.(e.error);
  r.onend = () => { if (final.trim()) onFinal?.(final.trim()); onEnd?.(); };
  try { r.start(); } catch (e) { onError?.(e.message); }
  return () => { try { r.abort(); } catch {} };
}

export function speak(text) {
  return new Promise((resolve) => {
    const synth = window.speechSynthesis;
    if (!synth) return resolve();
    synth.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'fr-FR';
    u.rate = 1.05;
    const fr = synth.getVoices().find((v) => v.lang && v.lang.startsWith('fr'));
    if (fr) u.voice = fr;
    const done = () => { clearTimeout(timer); resolve(); };
    const timer = setTimeout(done, 12000);
    u.onend = done;
    u.onerror = done;
    synth.speak(u);
  });
}

export function stopSpeaking() {
  try { window.speechSynthesis?.cancel(); } catch {}
}
