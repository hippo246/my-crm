/* eslint-disable */

// ═══════════════════════════════════════════════════════════════
// Polyfill Math.imul for old Android browsers (Android 4.x)
if (typeof Math.imul !== "function") {
  Math.imul = function(a, b) {
    const ah = (a >>> 16) & 0xffff, al = a & 0xffff;
    const bh = (b >>> 16) & 0xffff, bl = b & 0xffff;
    return (al * bl + (((ah * bl + al * bh) << 16) >>> 0)) | 0;
  };
}
function hashPw(pw) {
  if (!pw) return "";
  let a = 0x9e3779b9, b = 0x6c62272e;
  for (let i = 0; i < pw.length; i++) {
    a = (Math.imul(a ^ pw.charCodeAt(i), 0x9e3779b9) | 0) >>> 0;
    b = (Math.imul(b ^ pw.charCodeAt(i), 0x517cc1b7) | 0) >>> 0;
  }
  return `h2_${a.toString(16).padStart(8,"0")}_${b.toString(16).padStart(8,"0")}_${pw.length}`;
}
function checkPw(input, stored) {
  if (!stored || !input) return false;
  if (stored.startsWith("h2_")) return hashPw(input) === stored;
  return input === stored; // legacy plain-text fallback
}
const SESSION_TTL = 8 * 60 * 60 * 1000; // 8 hours

// ═══════════════════════════════════════════════════════════════
//  DEVICE & SESSION FINGERPRINTING
// ═══════════════════════════════════════════════════════════════
function getDeviceInfo() {
  const ua = navigator.userAgent || "";
  let browser = "Unknown";
  if (/Edg[/]/.test(ua)) browser = "Edge";
  else if (/OPR[/]|Opera/.test(ua)) browser = "Opera";
  else if (/Brave/.test(ua)) browser = "Brave";
  else if (/Firefox/.test(ua)) browser = "Firefox";
  else if (/Safari/.test(ua) && !/Chrome/.test(ua)) browser = "Safari";
  else if (/Chrome/.test(ua)) browser = "Chrome";
  let os = "Unknown";
  if (/Windows/.test(ua)) os = "Windows";
  else if (/Android/.test(ua)) os = "Android";
  else if (/iPhone|iPad/.test(ua)) os = /iPad/.test(ua) ? "iPadOS" : "iOS";
  else if (/Mac/.test(ua)) os = "macOS";
  else if (/Linux/.test(ua)) os = "Linux";
  let deviceType = "Desktop";
  if (/Mobi|Android|iPhone/.test(ua)) deviceType = "Mobile";
  else if (/iPad|Tablet/.test(ua)) deviceType = "Tablet";
  const screenRes = `${(typeof window!=="undefined"&&window.screen?.width)||0}×${(typeof window!=="undefined"&&window.screen?.height)||0}`;
  const tz = Intl?.DateTimeFormat?.()?.resolvedOptions?.()?.timeZone || "Unknown";
  const lang = navigator.language || "en";
  return { browser, os, deviceType, screenRes, tz, lang, ua: ua.slice(0, 120) };
}
const DEVICE_ID_KEY = "__crm_did__";
function getDeviceId() {
  try {
    let id = sessionStorage.getItem(DEVICE_ID_KEY);
    if (!id) { id = Date.now().toString(36) + Math.random().toString(36).slice(2, 8); sessionStorage.setItem(DEVICE_ID_KEY, id); }
    return id;
  } catch { return "did_" + Math.random().toString(36).slice(2); }
}
const DEVICE_ID = getDeviceId();


export { hashPw, checkPw, SESSION_TTL, getDeviceInfo, getDeviceId, DEVICE_ID };
