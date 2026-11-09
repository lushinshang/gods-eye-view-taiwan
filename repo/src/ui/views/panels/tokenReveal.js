/**
 * Decide whether a freshly-issued PAT needs to be revealed in the DOM.
 *
 * Pulled out of TaiwanAiAdvisor.vue so the decision is unit-testable without
 * mounting the whole panel. Tries to copy the token straight to the
 * clipboard; on success the caller never renders the raw value at all. On
 * failure (clipboard denied, unavailable, or absent) it falls back to
 * `revealed: true` — the token must be shown somewhere, or the caller has no
 * way to get it at all.
 *
 * @param {string} token
 * @param {{clipboard?: {writeText(text: string): Promise<void>}}} [options]
 * @returns {Promise<{copied: boolean, revealed: boolean}>}
 */
export async function copyNewToken(token, { clipboard = globalThis.navigator?.clipboard } = {}) {
  if (!clipboard?.writeText) return { copied: false, revealed: true };
  try {
    await clipboard.writeText(token);
    return { copied: true, revealed: false };
  } catch {
    return { copied: false, revealed: true };
  }
}
