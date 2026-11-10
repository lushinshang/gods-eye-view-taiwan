// Replaces the mission-picker launcher (firstRunExperience.js, kept for its
// still-tested storage/suppression helpers and FIRST_RUN_MISSIONS config, but
// no longer invoked from startup) with a silent, one-time default: a
// genuinely first-ever visit turns on Live Flights and Military Flights, as
// if the visitor had clicked those two rows themselves. AIS vessels are
// deliberately excluded — Taiwan waters already show live vessels from the
// always-on MOTC MPB layer, and the global AIS layer needs a key the visitor
// has not supplied yet.
//
// "First-ever visit" is judged by the SAME durable key the layer-state
// restore path itself uses (LAYER_STATE_STORAGE_KEY): if it is already set,
// this is a returning browser with its own saved choices (even if those
// choices turned these two layers back off), and nothing here may override
// them. shouldShowFirstRun() is reused as-is so a shared link, `?welcome=0`,
// an embedded globe, or an already-suppressed/this-session-dismissed visitor
// are skipped exactly as the old launcher skipped them.
import { LAYER_STATE_STORAGE_KEY } from './data/layerState.js';
import {
  rememberFirstRunSessionDismissed,
  shouldShowFirstRun,
} from './firstRunExperience.js';

export const DEFAULT_FIRST_RUN_LAYER_IDS = Object.freeze([
  'flights',
  'military',
]);

function resolveLocalStorage(injected) {
  if (injected !== undefined) return injected;
  try {
    return globalThis.localStorage;
  } catch {
    return null;
  }
}

function safeGetItem(storage, key) {
  try {
    return storage?.getItem?.(key) ?? null;
  } catch {
    return null;
  }
}

/**
 * The testable worker: resolves once the decision is made and (if this is a
 * true first run) the default layers have been asked to enable.
 * @param {object} input
 * @param {object} input.dataManager
 * @param {object} [input.styleManager]
 * @param {Storage} [input.storage] Durable (localStorage).
 * @param {Storage} [input.sessionStorageRef] Per-session.
 * @param {Location} [input.location]
 * @returns {Promise<{applied: boolean}>}
 */
export async function runFirstRunDefaultLayers({
  dataManager,
  styleManager,
  storage,
  sessionStorageRef,
  location = globalThis.location,
} = {}) {
  if (!dataManager) return { applied: false };
  if (
    !shouldShowFirstRun({
      hasShareState: styleManager?.hasShareState,
      storage,
      sessionStorageRef,
      location,
    })
  )
    return { applied: false };
  // Consumes the same session flag the old launcher used, so a reload within
  // this tab does not re-evaluate first-run state every time.
  rememberFirstRunSessionDismissed(sessionStorageRef);
  const hasDurableLayerState = Boolean(
    safeGetItem(resolveLocalStorage(storage), LAYER_STATE_STORAGE_KEY),
  );
  if (hasDurableLayerState) return { applied: false };
  await Promise.all(
    DEFAULT_FIRST_RUN_LAYER_IDS.map((layerId) =>
      dataManager.setEnabled(layerId, true, { origin: 'user' }).catch(() => {}),
    ),
  );
  return { applied: true };
}

/**
 * Fire-and-forget production entry point. Matches the synchronous
 * `{destroy()} | null` contract `startApplicationChrome` expects from
 * `initializeWelcome` — there is nothing to tear down here (no listeners, no
 * timers, no DOM), so it always returns null.
 * @param {Parameters<typeof runFirstRunDefaultLayers>[0]} input
 * @returns {null}
 */
export function applyFirstRunDefaultLayers(input) {
  void runFirstRunDefaultLayers(input).catch((error) => {
    console.warn('[First run] Could not apply default layers:', error);
  });
  return null;
}
