// Read aloud (plan section 6, accessibility: voice help). Uses the phone's own speech engine (Web Speech API), so nothing is
// sent anywhere and it works offline when the phone has a voice for the language. If the phone has no voice, the button is
// not shown (the text stays on screen). Never starts by itself: only after a tap.
export const canSpeak = () => typeof speechSynthesis !== 'undefined' && typeof SpeechSynthesisUtterance !== 'undefined';
export const stopSpeaking = () => { if (canSpeak()) speechSynthesis.cancel(); };
// lines: array of short texts; lang: 'bn' or 'en'. Returns true if speaking started.
export function speak(lines, lang) {
  if (!canSpeak()) return false;
  speechSynthesis.cancel();
  const code = lang === 'en' ? 'en-GB' : 'bn-BD';
  for (const line of lines) {
    const u = new SpeechSynthesisUtterance(String(line));
    u.lang = code; u.rate = 0.95;
    speechSynthesis.speak(u);
  }
  return true;
}
