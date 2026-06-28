/** Zero-network deterministic turns for clean video recording. */
export function isScriptedMode(): boolean {
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).get("mode") === "scripted";
}
