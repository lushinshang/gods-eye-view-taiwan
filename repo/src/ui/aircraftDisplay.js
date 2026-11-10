import { useDisplayStore } from './stores/display.js';
import { applicationPinia } from './vueRuntime.js';

/** Own the shared aircraft display preference and its controls. */
export class AircraftDisplay {
  constructor({
    elements,
    readDataManager,
    layout,
    store = useDisplayStore(applicationPinia()),
  }) {
    Object.assign(this, elements, {
      readDataManager,
      store,
      _layoutRightPanels: layout,
    });
    // Both aircraft layers default to models enabled in proximity mode.
    this._models3dEnabled = true;
    this._models3dMode = 'proximity';
    // What the button, mode row and mode segments show; null until first
    // synced, so the initial markup stands. Enabling from the button leaves
    // the row to its own sync, so each is held apart.
    this._models3dPressedShown = null;
    this._models3dRowShown = null;
    this._models3dModeShown = null;
    // Military klass-highlight checkboxes (default off, military layer only).
    this._highlightFastjet = false;
    this._highlightUav = false;
    this._highlightTanker = false;
    this._highlightCounts = { fastjet: 0, uav: 0, tanker: 0 };
    // Counts are independent of the toggles (an operator checks them before
    // flipping one), so they poll on their own cadence rather than riding a
    // toggle/restore event. 2s: frequent enough to feel live without
    // re-deriving them more often than the feed itself actually updates.
    this._highlightCountsTimer = setInterval(
      () => this._refreshHighlightCounts(),
      2000,
    );
    // Node (tests, SSR) must not be held open by this; browsers have no unref.
    this._highlightCountsTimer?.unref?.();
  }

  destroy() {
    clearInterval(this._highlightCountsTimer);
    this._highlightCountsTimer = null;
  }

  _refreshHighlightCounts() {
    const stats = this._dataManager
      ?.getAll?.()
      ?.find((entry) => entry.id === 'military')?.stats;
    const counts = stats?.highlightCounts;
    if (!counts) return;
    if (
      counts.fastjet === this._highlightCounts.fastjet &&
      counts.uav === this._highlightCounts.uav &&
      counts.tanker === this._highlightCounts.tanker
    )
      return;
    this._highlightCounts = counts;
    this._publishKlassHighlight();
  }
  get _dataManager() {
    return this.readDataManager();
  }
  _setModels3dParams(params, { origin = 'user' } = {}) {
    this._dataManager?.setLayerParams('flights', params, { origin });
    this._dataManager?.setLayerParams('military', params, { origin });
  }

  _syncModels3dFromLayerState(state) {
    const options = state?.options?.flights;
    if (!options) return;
    this._models3dEnabled = options.models3d === true;
    this._models3dMode = options.models3dMode === 'all' ? 'all' : 'proximity';
    this._models3dPressedShown = this._models3dEnabled;
    this._models3dRowShown = this._models3dEnabled;
    this._models3dModeShown = this._models3dMode;
    this._publishModels3d();
    this._highlightFastjet = options.highlightFastjet === true;
    this._highlightUav = options.highlightUav === true;
    this._highlightTanker = options.highlightTanker === true;
    this._publishKlassHighlight();
    this._layoutRightPanels();
  }

  /** Military-only — unlike models3d this never reaches the flights layer. */
  _setHighlightParams(params, { origin = 'user' } = {}) {
    this._dataManager?.setLayerParams('military', params, { origin });
  }

  _publishKlassHighlight() {
    this.store.publishKlassHighlight({
      fastjet: this._highlightFastjet,
      uav: this._highlightUav,
      tanker: this._highlightTanker,
      counts: this._highlightCounts,
    });
  }

  _setHighlightFastjet(enabled) {
    this._highlightFastjet = !!enabled;
    this._setHighlightParams({ highlightFastjet: this._highlightFastjet });
    this._publishKlassHighlight();
  }

  _setHighlightUav(enabled) {
    this._highlightUav = !!enabled;
    this._setHighlightParams({ highlightUav: this._highlightUav });
    this._publishKlassHighlight();
  }

  _setHighlightTanker(enabled) {
    this._highlightTanker = !!enabled;
    this._setHighlightParams({ highlightTanker: this._highlightTanker });
    this._publishKlassHighlight();
  }

  _syncModels3dModeRow() {
    this._models3dRowShown = this._models3dEnabled;
    this._publishModels3d();
    this._layoutRightPanels();
  }

  /** Present the 3D aircraft group as its controls show it. */
  _publishModels3d() {
    this.store.publishModels3d({
      pressed: this._models3dPressedShown,
      rowVisible: this._models3dRowShown,
      mode: this._models3dModeShown,
    });
  }

  _initModels3dToggle() {
    if (!this._models3dBtn) return;
    this._syncModels3dButtonState();
    this._syncModels3dModeRow();
  }

  _setModels3dEnabled(enabled) {
    this._models3dEnabled = !!enabled;
    this._setModels3dParams({ models3d: this._models3dEnabled });
    this._syncModels3dButtonState();
  }

  _setModels3dMode(mode) {
    const normalized = mode === 'all' ? 'all' : 'proximity';
    this._models3dMode = normalized;
    this._setModels3dParams({ models3dMode: normalized });
    this._models3dModeShown = normalized;
    this._syncModels3dButtonState();
  }

  _syncModels3dButtonState() {
    // The lit/dark state is a colour to a sighted operator and nothing at all to
    // a screen reader without aria-pressed, which the view renders with it. It
    // matters more now that the button ships ACTIVE from markup (default-on,
    // 2026-08-22): the very first thing assistive tech reported was an
    // unpressed-looking control over an armed layer.
    this._models3dPressedShown = this._models3dEnabled;
    this._publishModels3d();
  }
}
