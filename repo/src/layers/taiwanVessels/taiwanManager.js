/**
 * Taiwan MOTC MPB Live Vessels Controller & Cesium Primitive Layer
 *
 * Manages fetching, 8-category live filtering, Cesium Billboard rendering, and
 * vessel selection interaction for Taiwan territorial water contacts.
 */

import * as Cesium from 'cesium';
import { getTaiwanVesselIcon } from './taiwanIcons.js';

const MAJOR_CATEGORIES = new Set([
  'cargo',
  'tanker',
  'passenger',
  'special_ops',
  'highspeed',
]);

// 視距抽稀：動態航行船隻與商船全覽可見；靜止小船近景 280km 展開
function getVesselDisplayCondition(v) {
  const isMoving = typeof v.speed === 'number' && v.speed >= 1.5;
  const isMajor = MAJOR_CATEGORIES.has(v.categoryKey);
  if (isMoving || isMajor) {
    return new Cesium.DistanceDisplayCondition(0, 8_000_000);
  }
  return new Cesium.DistanceDisplayCondition(0, 280_000);
}

class TaiwanVesselsManager {
  constructor() {
    this.viewer = null;
    this.collection = null;
    this.billboardMap = new Map(); // mmsi -> Billboard
    this.vessels = [];
    this.selectedVessel = null;

    // Filter states
    this.masterEnabled = true;
    this.enabledCategories = new Set([
      'cargo',
      'tanker',
      'fishing',
      'passenger',
      'highspeed',
      'special_ops',
      'pleasure_craft',
      'unspecified',
    ]);
    this.showLabels = true;
    this.labelField = 'mmsi'; // 'mmsi' | 'name'

    // Statistics per category
    this.stats = {
      total: 0,
      cargo: 0,
      tanker: 0,
      fishing: 0,
      passenger: 0,
      highspeed: 0,
      special_ops: 0,
      pleasure_craft: 0,
      unspecified: 0,
    };

    this.listeners = new Set();
    this.pollTimer = null;
    this.handler = null;
    this.isFetching = false;

    // 歷史航跡尾巴（選取船舶時才載入）
    this.trackHours = 24;
    this.track = { status: 'idle', stats: null, thinned: false };
    this.trackLines = null; // PolylineCollection（無 label）
    this.trackPositions = [];
    this.trackAbort = null;
    this.trackSeq = 0;

    // 臺灣即時路況與事件 (TISV / 警廣) — 預設關閉，開啟後每 60 秒輪詢
    this.trafficEnabled = false;
    this.trafficEvents = [];
    this.trafficSpeeds = [];
    this.trafficSummary = null;
    this.trafficStats = {
      total: 0,
      accident: 0,
      roadwork: 0,
      congestion: 0,
      control: 0,
      other: 0,
    };
    this.trafficCollection = null;
    this.selectedTraffic = null;
    this.trafficTimer = null;
    this.isFetchingTraffic = false;
    this.trafficError = null;
  }

  subscribe(listener) {
    this.listeners.add(listener);
    listener(this.getState());
    return () => this.listeners.delete(listener);
  }

  notify() {
    const state = this.getState();
    for (const l of this.listeners) {
      try {
        l(state);
      } catch (err) {
        console.error('TaiwanVesselsManager listener error:', err);
      }
    }
  }

  getState() {
    return {
      masterEnabled: this.masterEnabled,
      enabledCategories: new Set(this.enabledCategories),
      showLabels: this.showLabels,
      labelField: this.labelField,
      stats: { ...this.stats },
      selectedVessel: this.selectedVessel,
      trackHours: this.trackHours,
      track: this.track,
      trafficEnabled: this.trafficEnabled,
      trafficStats: { ...this.trafficStats },
      trafficSummary: this.trafficSummary,
      selectedTraffic: this.selectedTraffic,
      trafficError: this.trafficError,
    };
  }

  initViewer(viewer) {
    if (!viewer || this.viewer === viewer) return;
    this.viewer = viewer;

    if (!this.collection) {
      this.collection = new Cesium.BillboardCollection({
        blendOption: Cesium.BlendOption.TRANSLUCENT,
      });
      viewer.scene.primitives.add(this.collection);
    }

    this.initInteraction();
    this.startPolling();
  }

  initInteraction() {
    if (!this.viewer || this.handler) return;
    this.handler = new Cesium.ScreenSpaceEventHandler(this.viewer.scene.canvas);

    // Left click to select vessel
    this.handler.setInputAction((click) => {
      const picked = this.viewer.scene.pick(click.position);
      if (this.trafficEnabled && picked?.id?._isTaiwanTraffic) {
        this.selectTraffic(picked.id);
        return;
      }
      if (!picked) this.selectTraffic(null);
      if (!this.masterEnabled) return;
      if (picked && picked.primitive && picked.id?._isTaiwanVessel) {
        this.selectVessel(picked.id);
      } else if (!picked) {
        this.selectVessel(null);
      }
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
  }

  selectVessel(vessel) {
    if (
      this.selectedVessel &&
      this.billboardMap.has(this.selectedVessel.mmsi)
    ) {
      const prevBb = this.billboardMap.get(this.selectedVessel.mmsi);
      prevBb.image = getTaiwanVesselIcon(
        this.selectedVessel.categoryKey,
        this.selectedVessel.color,
        false,
      );
      prevBb.scale = 0.28;
    }

    this.selectedVessel = vessel;

    if (vessel && this.billboardMap.has(vessel.mmsi)) {
      const curBb = this.billboardMap.get(vessel.mmsi);
      curBb.image = getTaiwanVesselIcon(vessel.categoryKey, vessel.color, true);
      curBb.scale = 0.44;
    }

    this.clearTrack();
    if (vessel) this.loadTrack(vessel);
    this.notify();
  }

  // ── 歷史航跡尾巴 ──────────────────────────────────────────────────────
  clearTrack() {
    this.trackSeq++; // 讓進行中的回應過期
    this.trackAbort?.abort();
    this.trackAbort = null;
    this.trackLines?.removeAll();
    this.trackPositions = [];
    this.track = { status: 'idle', stats: null, thinned: false };
    this.viewer?.scene.requestRender?.();
  }

  setTrackHours(hours) {
    if (![6, 24, 168].includes(hours) || hours === this.trackHours) return;
    this.trackHours = hours;
    if (this.selectedVessel) {
      const vessel = this.selectedVessel;
      this.clearTrack();
      this.loadTrack(vessel);
    }
    this.notify();
  }

  async loadTrack(vessel) {
    const seq = ++this.trackSeq;
    const controller = new AbortController();
    this.trackAbort = controller;
    this.track = { status: 'loading', stats: null, thinned: false };
    try {
      const res = await fetch(
        `/api/taiwan-vessel-tracks?mmsi=${encodeURIComponent(vessel.mmsi)}&hours=${this.trackHours}`,
        { signal: controller.signal },
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (seq !== this.trackSeq) return; // 已換船／取消／切換時段
      const points = Array.isArray(data.points) ? data.points : [];
      this.track = {
        status: points.length >= 2 ? 'ready' : 'empty',
        stats: data.stats || null,
        thinned: !!data.thinned,
      };
      if (points.length >= 2) this.drawTrack(points, vessel.color);
    } catch (err) {
      if (err.name === 'AbortError' || seq !== this.trackSeq) return;
      console.warn('[TaiwanVesselsManager] Track fetch error:', err.message);
      this.track = { status: 'error', stats: null, thinned: false };
    }
    this.notify();
  }

  drawTrack(points, color) {
    if (!this.viewer) return;
    if (!this.trackLines) {
      this.trackLines = new Cesium.PolylineCollection();
      this.viewer.scene.primitives.add(this.trackLines);
    }
    this.trackLines.removeAll();
    const flat = points.flatMap((p) => [p.lon, p.lat]);
    this.trackPositions = Cesium.Cartesian3.fromDegreesArray(flat);
    this.trackLines.add({
      positions: this.trackPositions,
      width: 3,
      material: Cesium.Material.fromType('Color', {
        color: Cesium.Color.fromCssColorString(color || '#39d5ff').withAlpha(
          0.9,
        ),
      }),
    });
    this.viewer.scene.requestRender?.();
  }

  flyToTrack() {
    if (!this.viewer || this.trackPositions.length < 2) return;
    const sphere = Cesium.BoundingSphere.fromPoints(this.trackPositions);
    this.viewer.camera.flyToBoundingSphere(sphere, {
      duration: 1.5,
      offset: new Cesium.HeadingPitchRange(
        0,
        Cesium.Math.toRadians(-90),
        Math.max(sphere.radius * 3, 20_000),
      ),
    });
  }

  // ── 臺灣即時路況與事件 ────────────────────────────────────────────────
  selectTraffic(item) {
    this.selectedTraffic = item;
    this.notify();
  }

  setTrafficEnabled(enabled) {
    this.trafficEnabled = enabled;
    if (enabled) {
      if (this.viewer && !this.trafficCollection) {
        this.trafficCollection = new Cesium.PointPrimitiveCollection();
        this.viewer.scene.primitives.add(this.trafficCollection);
      }
      this.fetchTraffic();
      if (!this.trafficTimer) {
        this.trafficTimer = setInterval(() => this.fetchTraffic(), 60000);
      }
    } else {
      if (this.trafficTimer) clearInterval(this.trafficTimer);
      this.trafficTimer = null;
      this.trafficCollection?.removeAll();
      this.selectedTraffic = null;
      this.viewer?.scene.requestRender?.();
    }
    this.notify();
  }

  async fetchTraffic() {
    if (this.isFetchingTraffic || !this.trafficEnabled) return;
    this.isFetchingTraffic = true;
    try {
      const res = await fetch('/api/taiwan-traffic');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      this.trafficEvents = data.events || [];
      this.trafficSpeeds = data.speeds || [];
      this.trafficSummary = data.summary || null;
      const st = {
        total: this.trafficEvents.length,
        accident: 0,
        roadwork: 0,
        congestion: 0,
        control: 0,
        other: 0,
      };
      for (const e of this.trafficEvents) st[e.type] = (st[e.type] ?? 0) + 1;
      this.trafficStats = st;
      this.trafficError = null;
      this.syncTraffic();
    } catch (err) {
      this.trafficError = err.message;
      console.warn('[TaiwanVesselsManager] Traffic fetch error:', err.message);
    } finally {
      this.isFetchingTraffic = false;
      this.notify();
    }
  }

  syncTraffic() {
    const col = this.trafficCollection;
    if (!col || !this.trafficEnabled) return;
    col.removeAll();
    const common = {
      disableDepthTestDistance: Number.POSITIVE_INFINITY,
    };
    // 國道車速：小色點（紅 ≤40 / 黃 ≤70 / 綠）；順暢路段只在近景顯示
    for (const sp of this.trafficSpeeds) {
      if (sp.speedKmh == null) continue;
      const slow = sp.speedKmh <= 70;
      col.add({
        ...common,
        position: Cesium.Cartesian3.fromDegrees(sp.lon, sp.lat, 30),
        color: Cesium.Color.fromCssColorString(sp.color),
        pixelSize: slow ? 7 : 5,
        outlineColor: Cesium.Color.BLACK.withAlpha(0.6),
        outlineWidth: 1,
        distanceDisplayCondition: new Cesium.DistanceDisplayCondition(
          0,
          slow ? 2_500_000 : 700_000,
        ),
        id: { ...sp, _isTaiwanTraffic: true, kind: 'speed' },
      });
    }
    // 事件：大色點 + 白框，全視距可見
    for (const ev of this.trafficEvents) {
      col.add({
        ...common,
        position: Cesium.Cartesian3.fromDegrees(ev.lon, ev.lat, 60),
        color: Cesium.Color.fromCssColorString(ev.color),
        pixelSize: ev.type === 'accident' ? 16 : 12,
        outlineColor: Cesium.Color.WHITE,
        outlineWidth: 2,
        distanceDisplayCondition: new Cesium.DistanceDisplayCondition(
          0,
          6_000_000,
        ),
        id: { ...ev, _isTaiwanTraffic: true, kind: 'event' },
      });
    }
    this.viewer?.scene.requestRender?.();
  }

  async fetchVessels() {
    if (this.isFetching) return;
    this.isFetching = true;
    try {
      const res = await fetch('/api/taiwan-vessels');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      this.vessels = data.rows || [];
      this.recomputeStats();
      this.syncBillboards();
      this.notify();
    } catch (err) {
      console.warn('[TaiwanVesselsManager] Fetch error:', err.message);
    } finally {
      this.isFetching = false;
    }
  }

  recomputeStats() {
    const s = {
      total: this.vessels.length,
      cargo: 0,
      tanker: 0,
      fishing: 0,
      passenger: 0,
      highspeed: 0,
      special_ops: 0,
      pleasure_craft: 0,
      unspecified: 0,
    };
    for (const v of this.vessels) {
      if (s[v.categoryKey] !== undefined) {
        s[v.categoryKey]++;
      } else {
        s.unspecified++;
      }
    }
    this.stats = s;
  }

  syncBillboards() {
    if (!this.collection || !this.viewer) return;

    const currentMmsis = new Set();

    for (const v of this.vessels) {
      const mmsi = String(v.mmsi);
      currentMmsis.add(mmsi);
      const isVisible =
        this.masterEnabled && this.enabledCategories.has(v.categoryKey);

      // Height slightly above ocean datum to avoid terrain z-fighting
      const pos = Cesium.Cartesian3.fromDegrees(v.lon, v.lat, 15);
      const cogDeg = typeof v.course === 'number' ? v.course : 0;
      const rotationRad = Cesium.Math.toRadians(-cogDeg);

      const displayCond = getVesselDisplayCondition(v);

      let bb = this.billboardMap.get(mmsi);
      if (!bb) {
        bb = this.collection.add({
          position: pos,
          image: getTaiwanVesselIcon(v.categoryKey, v.color, false),
          rotation: rotationRad,
          scale: 0.28,
          distanceDisplayCondition: displayCond,
          alignedAxis: Cesium.Cartesian3.ZERO,
          horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
          verticalOrigin: Cesium.VerticalOrigin.CENTER,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
          id: { ...v, _isTaiwanVessel: true },
          show: isVisible,
        });
        this.billboardMap.set(mmsi, bb);
      } else {
        bb.position = pos;
        bb.rotation = rotationRad;
        bb.scale = this.selectedVessel?.mmsi === mmsi ? 0.44 : 0.28;
        bb.distanceDisplayCondition = displayCond;
        bb.show = isVisible;
        bb.id = { ...v, _isTaiwanVessel: true };
      }
    }

    // Prune disappeared vessels
    for (const [mmsi, bb] of this.billboardMap.entries()) {
      if (!currentMmsis.has(mmsi)) {
        this.collection.remove(bb);
        this.billboardMap.delete(mmsi);
      }
    }
    this.viewer?.scene.requestRender?.();
  }

  // Fast toggle without refetching network
  applyFilter() {
    for (const v of this.vessels) {
      const bb = this.billboardMap.get(String(v.mmsi));
      if (bb) {
        bb.show =
          this.masterEnabled && this.enabledCategories.has(v.categoryKey);
      }
    }
    this.notify();
    if (this.viewer) {
      this.viewer.scene.requestRender?.();
    }
  }

  setMasterEnabled(enabled) {
    this.masterEnabled = enabled;
    if (!enabled && this.selectedVessel) this.selectVessel(null);
    if (this.collection) {
      this.collection.show = enabled;
    }
    this.applyFilter();
  }

  toggleCategory(categoryKey, forceVal = null) {
    const next =
      forceVal !== null ? forceVal : !this.enabledCategories.has(categoryKey);
    if (next) {
      this.enabledCategories.add(categoryKey);
    } else {
      this.enabledCategories.delete(categoryKey);
    }
    this.applyFilter();
  }

  setAllCategories(enableAll) {
    const all = [
      'cargo',
      'tanker',
      'fishing',
      'passenger',
      'highspeed',
      'special_ops',
      'pleasure_craft',
      'unspecified',
    ];
    if (enableAll) {
      this.enabledCategories = new Set(all);
    } else {
      this.enabledCategories.clear();
    }
    this.applyFilter();
  }

  startPolling() {
    if (this.pollTimer) return;
    this.fetchVessels();
    this.pollTimer = setInterval(() => this.fetchVessels(), 40000);
  }

  flyToTaiwan2D() {
    if (!this.viewer || this.viewer.isDestroyed()) return;
    this.viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(120.98, 23.85, 850000),
      orientation: {
        heading: Cesium.Math.toRadians(0),
        pitch: Cesium.Math.toRadians(-90),
        roll: 0.0,
      },
      duration: 2.0,
      easingFunction: Cesium.EasingFunction.CUBIC_IN_OUT,
    });
  }

  destroy() {
    this.clearTrack();
    if (this.trackLines && this.viewer) {
      this.viewer.scene.primitives.remove(this.trackLines);
    }
    if (this.pollTimer) clearInterval(this.pollTimer);
    if (this.trafficTimer) clearInterval(this.trafficTimer);
    if (this.trafficCollection && this.viewer) {
      this.viewer.scene.primitives.remove(this.trafficCollection);
    }
    if (this.handler) this.handler.destroy();
    if (this.collection && this.viewer) {
      this.viewer.scene.primitives.remove(this.collection);
    }
    this.billboardMap.clear();
    this.listeners.clear();
  }
}

export const taiwanVesselsManager = new TaiwanVesselsManager();
