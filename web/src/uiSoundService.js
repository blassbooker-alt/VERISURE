import { primeMessageSounds } from "./messageSoundService.js";

export const UI_SOUND_PREFERENCE_KEY = "fortalfy.interface-sounds.v1";

let audioContext;
let lastSoundAt = 0;

export function isInterfaceSoundEnabled(storage) {
  try {
    storage ||= globalThis.localStorage;
    return storage?.getItem(UI_SOUND_PREFERENCE_KEY) !== "false";
  } catch {
    return true;
  }
}

export function setInterfaceSoundEnabled(enabled, storage) {
  try {
    storage ||= globalThis.localStorage;
    storage?.setItem(UI_SOUND_PREFERENCE_KEY, enabled ? "true" : "false");
  } catch {
    // Keep the in-memory interaction usable when browser storage is unavailable.
  }
}

export function playInterfaceSound(kind = "click") {
  if (!isInterfaceSoundEnabled() || typeof window === "undefined") return;
  const now = performance.now();
  const minimumGap = kind === "typing" ? 38 : 24;
  if (now - lastSoundAt < minimumGap) return;
  lastSoundAt = now;

  try {
    const AudioContextConstructor = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextConstructor) return;
    audioContext ||= new AudioContextConstructor();
    if (audioContext.state === "suspended") void audioContext.resume();

    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    const start = audioContext.currentTime;
    const typing = kind === "typing";
    const volume = typing ? 0.012 : 0.032;
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(typing ? 880 + Math.random() * 120 : 540, start);
    if (!typing) oscillator.frequency.exponentialRampToValueAtTime(420, start + 0.055);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(volume, start + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + (typing ? 0.018 : 0.065));
    oscillator.connect(gain);
    gain.connect(audioContext.destination);
    oscillator.start(start);
    oscillator.stop(start + (typing ? 0.02 : 0.07));
  } catch {
    // Audio is optional; unsupported or locked audio must never block an action.
  }
}

function isTypingSurface(target) {
  const field = target?.closest?.("input, textarea, [contenteditable='true'], [role='textbox']");
  if (!field || field.isContentEditable || field.tagName === "TEXTAREA" || field.getAttribute("role") === "textbox") return Boolean(field);
  return !["button", "checkbox", "radio", "range", "color", "file", "submit", "reset", "image", "hidden", "password"].includes(String(field.type || "text").toLowerCase());
}

function isInteractiveControl(target) {
  return target?.closest?.("button, a[href], [role='button'], [role='option'], [role='tab'], [role='menuitem'], [role='switch'], [role='radio'], [role='checkbox']");
}

export function installInterfaceSoundInteractions(root = document) {
  const onPointerDown = event => {
    if (event.isTrusted) primeMessageSounds();
    if (event.button !== undefined && event.button !== 0) return;
    const control = isInteractiveControl(event.target);
    if (!control || control.disabled || control.getAttribute("aria-disabled") === "true" || control.dataset.uiSound === "off") return;
    playInterfaceSound("click");
  };
  const onChange = event => {
    const field = event.target?.closest?.("select, input[type='checkbox'], input[type='radio']");
    if (field && field.dataset.uiSound !== "off" && !field.disabled) playInterfaceSound("click");
  };
  const onKeyDown = event => {
    if (event.isTrusted) primeMessageSounds();
    if (!event.repeat && ["Enter", " "].includes(event.key) && isInteractiveControl(event.target) && !isTypingSurface(event.target)) {
      const control = isInteractiveControl(event.target);
      if (!control.disabled && control.getAttribute("aria-disabled") !== "true" && control.dataset.uiSound !== "off") playInterfaceSound("click");
    }
  };
  const onBeforeInput = event => {
    if (isTypingSurface(event.target) && ["insertText", "insertCompositionText"].includes(event.inputType)) playInterfaceSound("typing");
  };
  root.addEventListener("pointerdown", onPointerDown, true);
  root.addEventListener("change", onChange, true);
  root.addEventListener("keydown", onKeyDown, true);
  root.addEventListener("beforeinput", onBeforeInput, true);
  return () => {
    root.removeEventListener("pointerdown", onPointerDown, true);
    root.removeEventListener("change", onChange, true);
    root.removeEventListener("keydown", onKeyDown, true);
    root.removeEventListener("beforeinput", onBeforeInput, true);
  };
}
