<script setup>
import { ref, onMounted, onUnmounted, computed } from 'vue';
import { taiwanVesselsManager } from '../../../layers/taiwanVessels/taiwanManager.js';
import TaiwanAiAdvisor from './TaiwanAiAdvisor.vue';

const isExpanded = ref(true);
const managerState = ref(taiwanVesselsManager.getState());

let unsubscribe = null;

// 航跡庫狀態徽章（每 60 秒更新）
const trackSummary = ref(null);
const trackSummaryError = ref(false);
let summaryTimer = null;
let summaryAbort = null;

async function refreshTrackSummary() {
  summaryAbort?.abort();
  summaryAbort = new AbortController();
  try {
    const res = await fetch('/api/taiwan-vessel-tracks?mode=summary', {
      signal: summaryAbort.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    trackSummary.value = await res.json();
    trackSummaryError.value = false;
  } catch (err) {
    if (err.name !== 'AbortError') trackSummaryError.value = true;
  }
}

onMounted(() => {
  unsubscribe = taiwanVesselsManager.subscribe((st) => {
    managerState.value = st;
  });
  refreshTrackSummary();
  summaryTimer = setInterval(refreshTrackSummary, 60000);
});

onUnmounted(() => {
  if (unsubscribe) unsubscribe();
  if (summaryTimer) clearInterval(summaryTimer);
  summaryAbort?.abort();
});

const isAllSelected = computed({
  get() {
    return managerState.value.enabledCategories.size === 8 && managerState.value.masterEnabled;
  },
  set(val) {
    if (!managerState.value.masterEnabled) {
      taiwanVesselsManager.setMasterEnabled(true);
    }
    taiwanVesselsManager.setAllCategories(val);
  },
});

const isMasterEnabled = computed({
  get() {
    return managerState.value.masterEnabled;
  },
  set(val) {
    taiwanVesselsManager.setMasterEnabled(val);
  },
});

const stats = computed(() => managerState.value.stats);
const selectedVessel = computed(() => managerState.value.selectedVessel);

// 8 大分類順序（依照官方截圖排序）
const categories = [
  { id: 'unspecified', name: '未具體說明的船舶', color: '#d9d9d9', shape: 'dot' },
  { id: 'pleasure_craft', name: '拖船、帆船、遊艇', color: '#13c2c2', shape: 'sail' },
  { id: 'fishing', name: '漁船', color: '#1d39c4', shape: 'spear' },
  { id: 'highspeed', name: '高速船', color: '#faad14', shape: 'fast' },
  { id: 'special_ops', name: '引水船、搜索船、拖駁船等', color: '#fa8c16', shape: 'diamond' },
  { id: 'passenger', name: '客輪', color: '#eb2f96', shape: 'winged' },
  { id: 'cargo', name: '貨輪', color: '#39d5ff', shape: 'carrier' },
  { id: 'tanker', name: '油輪', color: '#ff4d4f', shape: 'tanker' },
];

function toggleCategory(catId) {
  taiwanVesselsManager.toggleCategory(catId);
}

function isCatChecked(catId) {
  return managerState.value.enabledCategories.has(catId);
}

function toggleExpand() {
  isExpanded.value = !isExpanded.value;
}

const trackRanges = [
  { hours: 6, label: '6h' },
  { hours: 24, label: '24h' },
  { hours: 168, label: '7d' },
];
const track = computed(() => managerState.value.track);
const trackHours = computed(() => managerState.value.trackHours);

function formatSpan(ms) {
  const minutes = Math.round((ms || 0) / 60000);
  if (minutes < 60) return `${minutes} 分`;
  const h = Math.floor(minutes / 60);
  return h < 24 ? `${h} 時 ${minutes % 60} 分` : `${Math.floor(h / 24)} 天 ${h % 24} 時`;
}

function closeSelected() {
  taiwanVesselsManager.selectVessel(null);
}

// 🛣️ 臺灣即時路況與事件 (TISV/警廣)
const trafficEnabled = computed({
  get: () => managerState.value.trafficEnabled,
  set: (val) => taiwanVesselsManager.setTrafficEnabled(val),
});
const trafficStats = computed(() => managerState.value.trafficStats);
const trafficSummary = computed(() => managerState.value.trafficSummary);
const selectedTraffic = computed(() => managerState.value.selectedTraffic);
const trafficBadges = [
  { id: 'accident', name: '事故', color: '#ff3b30' },
  { id: 'roadwork', name: '施工', color: '#ff9500' },
  { id: 'congestion', name: '壅塞', color: '#ffcc00' },
  { id: 'control', name: '管制', color: '#af52de' },
  { id: 'other', name: '其他', color: '#8e8e93' },
];

function closeTraffic() {
  taiwanVesselsManager.selectTraffic(null);
}
</script>

<template>
  <div class="tw-vessels-dock" :class="{ 'dock-collapsed': !isExpanded }">
    <!-- 折疊/展開手柄按鈕 -->
    <button
      class="tw-toggle-tab"
      type="button"
      @click="toggleExpand"
      :title="isExpanded ? '收合船舶顯示面板' : '展開船舶顯示面板'"
    >
      <span class="tab-icon">🚢</span>
      <span class="tab-arrow">{{ isExpanded ? '➔' : '◀' }}</span>
    </button>

    <!-- 船舶顯示主面板 -->
    <div v-show="isExpanded" class="tw-panel-content">
      <div class="tw-panel-header">
        <div class="header-title">
          <span class="icon-layers">❖</span>
          <span>船舶顯示（臺灣海域）</span>
        </div>
        <div class="header-actions">
          <button
            class="tw-btn-overview-2d"
            type="button"
            @click="taiwanVesselsManager.flyToTaiwan2D()"
            title="一鍵重置為 2D 臺灣平面戰術大盤（正垂俯瞰・正北朝上）"
          >
            🇹🇼 2D 大盤
          </button>
          <div class="header-badge">{{ stats.total }} 艘</div>
        </div>
      </div>
      <div class="tw-track-db" data-testid="track-db-badge">
        <template v-if="trackSummary">
          🗄️ 航跡庫：{{ trackSummary.vessels }} 艘 ・ {{ trackSummary.points }} 點 ・
          {{ trackSummary.diskKB }} KB
        </template>
        <template v-else-if="trackSummaryError">🗄️ 航跡庫：無法取得</template>
        <template v-else>🗄️ 航跡庫：載入中…</template>
      </div>

      <div class="tw-panel-body">
        <!-- 標示開關 -->
        <div class="tw-setting-row">
          <label class="tw-checkbox-label">
            <input type="checkbox" v-model="managerState.showLabels" />
            <span class="label-text">顯示船舶標示</span>
          </label>
          <select class="tw-select" v-model="managerState.labelField">
            <option value="mmsi">MMSI</option>
            <option value="name">船名</option>
          </select>
        </div>

        <div class="tw-divider"></div>

        <!-- 母開關：即時船舶位置 (全選 / 全關) -->
        <div class="tw-master-row">
          <label class="tw-checkbox-label master-label">
            <input
              type="checkbox"
              :checked="isAllSelected"
              @change="isAllSelected = $event.target.checked"
            />
            <span class="master-text">即時船舶位置</span>
          </label>
        </div>

        <!-- 8 大分類勾選清單 -->
        <div class="tw-category-list">
          <div
            v-for="cat in categories"
            :key="cat.id"
            class="tw-cat-row"
            :class="{ active: isCatChecked(cat.id) }"
          >
            <label class="tw-cat-label">
              <input
                type="checkbox"
                :checked="isCatChecked(cat.id)"
                @change="toggleCategory(cat.id)"
              />
              <span class="cat-indicator" :style="{ backgroundColor: cat.color }"></span>
              <span class="cat-name">{{ cat.name }}</span>
            </label>
            <span class="cat-count">{{ stats[cat.id] || 0 }}</span>
          </div>
        </div>

        <div class="tw-divider"></div>

        <!-- 🛣️ 臺灣即時路況與事件 (TISV/警廣) -->
        <div class="tw-master-row">
          <label class="tw-checkbox-label master-label">
            <input type="checkbox" v-model="trafficEnabled" />
            <span class="master-text">🛣️ 臺灣即時路況與事件 (TISV/警廣)</span>
          </label>
        </div>
        <div v-if="trafficEnabled" class="tw-traffic-badges">
          <span
            v-for="b in trafficBadges"
            :key="b.id"
            class="tw-badge"
            :style="{ borderColor: b.color }"
          >
            <span class="cat-indicator" :style="{ backgroundColor: b.color }"></span>
            {{ b.name }} {{ trafficStats[b.id] || 0 }}
          </span>
        </div>
        <div v-if="trafficEnabled && trafficSummary" class="tw-traffic-note">
          國道均速 {{ trafficSummary.avgSpeedKmh ?? '—' }} km/h ・ 壅塞路段
          {{ trafficSummary.slowSections }}（≤40）/ {{ trafficSummary.congestedSections }}（≤70）
        </div>
        <div v-if="trafficEnabled && managerState.trafficError" class="tw-traffic-note">
          路況載入失敗：{{ managerState.trafficError }}
        </div>

        <div v-if="selectedTraffic" class="tw-detail-card">
          <div class="detail-header">
            <div class="detail-name" :style="{ color: selectedTraffic.color }">
              {{ selectedTraffic.kind === 'event' ? selectedTraffic.title : selectedTraffic.name }}
            </div>
            <button class="detail-close" @click="closeTraffic">×</button>
          </div>
          <div class="detail-grid">
            <div class="detail-item full-width" v-if="selectedTraffic.description"><span class="k">描述:</span> <span class="v">{{ selectedTraffic.description }}</span></div>
            <div class="detail-item"><span class="k">道路:</span> <span class="v">{{ selectedTraffic.road }}</span></div>
            <div class="detail-item"><span class="k">方向:</span> <span class="v">{{ selectedTraffic.direction || '—' }}</span></div>
            <div class="detail-item"><span class="k">車速:</span> <span class="v">{{ selectedTraffic.speedKmh != null ? selectedTraffic.speedKmh + ' km/h' : '未知' }}</span></div>
            <div class="detail-item" v-if="selectedTraffic.source"><span class="k">來源:</span> <span class="v">{{ selectedTraffic.source }}</span></div>
            <div class="detail-item full-width"><span class="k">座標:</span> <span class="v">{{ selectedTraffic.lat.toFixed(4) }}, {{ selectedTraffic.lon.toFixed(4) }}</span></div>
            <div class="detail-item full-width"><span class="k">時間:</span> <span class="v">{{ selectedTraffic.timestamp }}</span></div>
          </div>
        </div>

        <!-- 選取單一船隻詳細資訊彈出卡片 -->
        <div v-if="selectedVessel" class="tw-detail-card">
          <div class="detail-header">
            <div class="detail-name">{{ selectedVessel.name }}</div>
            <button class="detail-close" @click="closeSelected">×</button>
          </div>
          <div class="detail-grid">
            <div class="detail-item"><span class="k">MMSI:</span> <span class="v">{{ selectedVessel.mmsi }}</span></div>
            <div class="detail-item"><span class="k">類型:</span> <span class="v" :style="{ color: selectedVessel.color }">{{ selectedVessel.categoryName }}</span></div>
            <div class="detail-item" v-if="selectedVessel.imo"><span class="k">IMO:</span> <span class="v">{{ selectedVessel.imo }}</span></div>
            <div class="detail-item" v-if="selectedVessel.callSign"><span class="k">呼號:</span> <span class="v">{{ selectedVessel.callSign }}</span></div>
            <div class="detail-item"><span class="k">航速:</span> <span class="v">{{ selectedVessel.speed != null ? selectedVessel.speed + ' 節' : '未知' }}</span></div>
            <div class="detail-item"><span class="k">航向:</span> <span class="v">{{ selectedVessel.course != null ? selectedVessel.course + '°' : '未知' }}</span></div>
            <div class="detail-item full-width"><span class="k">座標:</span> <span class="v">{{ selectedVessel.lat.toFixed(4) }}, {{ selectedVessel.lon.toFixed(4) }}</span></div>
            <div class="detail-item full-width"><span class="k">時間:</span> <span class="v">{{ selectedVessel.last_position_UTC }}</span></div>
          </div>
          <div class="tw-track-box" data-testid="track-box">
            <div class="track-ranges">
              <button
                v-for="r in trackRanges"
                :key="r.hours"
                type="button"
                class="track-range-btn"
                :class="{ active: trackHours === r.hours }"
                @click="taiwanVesselsManager.setTrackHours(r.hours)"
              >
                {{ r.label }}
              </button>
            </div>
            <div v-if="track.status === 'loading'" class="track-note">🧭 歷史航跡載入中…</div>
            <div v-else-if="track.status === 'error'" class="track-note">🧭 歷史航跡載入失敗</div>
            <div v-else-if="track.status === 'empty'" class="track-note">
              🧭 航跡剛開始累積，尚無足夠的多點紀錄（約每分鐘更新，稍後再看）
            </div>
            <template v-else-if="track.status === 'ready' && track.stats">
              <div class="track-note">
                🧭 歷史航跡：{{ track.stats.count }} 點 ／ {{ track.stats.distanceKm.toFixed(1) }} km ／
                跨度 {{ formatSpan(track.stats.spanMs) }}<span v-if="track.thinned">（已抽稀）</span>
              </div>
              <div v-if="track.stats.loiter" class="track-loiter">⚠️ 疑似徘徊</div>
              <button
                type="button"
                class="track-fly-btn"
                @click="taiwanVesselsManager.flyToTrack()"
              >
                🎥 飛覽航跡
              </button>
            </template>
          </div>
        </div>

        <TaiwanAiAdvisor :selected="selectedVessel || selectedTraffic" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.tw-vessels-dock {
  position: fixed;
  top: 72px;
  right: 18px;
  z-index: 1200;
  display: flex;
  flex-direction: row-reverse;
  align-items: flex-start;
  pointer-events: auto;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang TC", "Microsoft JhengHei", sans-serif;
  transition: transform 0.25s ease-out;
}

.tw-vessels-dock.dock-collapsed {
  transform: translateX(calc(100% - 42px));
}

.tw-toggle-tab {
  width: 40px;
  height: 48px;
  background: rgba(18, 28, 38, 0.9);
  border: 1px solid rgba(57, 213, 255, 0.4);
  border-right: none;
  border-radius: 8px 0 0 8px;
  color: #39d5ff;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow: -4px 4px 16px rgba(0, 0, 0, 0.4);
  transition: all 0.2s ease;
}

.tw-toggle-tab:hover {
  background: rgba(28, 44, 60, 0.95);
  border-color: #39d5ff;
}

.tab-icon {
  font-size: 16px;
  line-height: 1;
}

.tab-arrow {
  font-size: 12px;
  margin-top: 4px;
}

.tw-panel-content {
  width: 290px;
  background: rgba(15, 23, 33, 0.92);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(57, 213, 255, 0.35);
  border-radius: 0 8px 8px 8px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.55);
  color: #e6f7ff;
  font-size: 13px;
  overflow: hidden;
}

.tw-panel-header {
  padding: 10px 14px;
  background: rgba(24, 38, 54, 0.9);
  border-bottom: 1px solid rgba(57, 213, 255, 0.25);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.header-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  letter-spacing: 0.5px;
  color: #39d5ff;
}

.header-badge {
  font-size: 11px;
  padding: 2px 7px;
  background: rgba(57, 213, 255, 0.2);
  border: 1px solid rgba(57, 213, 255, 0.5);
  border-radius: 10px;
  color: #ffffff;
}

.tw-panel-body {
  padding: 12px 14px;
  max-height: calc(100vh - 160px);
  overflow-y: auto;
}

.tw-setting-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.tw-select {
  background: rgba(8, 16, 24, 0.8);
  border: 1px solid rgba(57, 213, 255, 0.3);
  color: #e6f7ff;
  border-radius: 4px;
  padding: 2px 6px;
  font-size: 12px;
  outline: none;
}

.tw-divider {
  height: 1px;
  background: rgba(57, 213, 255, 0.15);
  margin: 8px 0 12px 0;
}

.tw-master-row {
  margin-bottom: 8px;
  padding-bottom: 6px;
  border-bottom: 1px dashed rgba(255, 255, 255, 0.15);
}

.master-text {
  font-weight: 600;
  color: #ffffff;
}

.tw-checkbox-label {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  user-select: none;
}

.tw-category-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding-left: 12px;
}

.tw-cat-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 3px 6px;
  border-radius: 4px;
  transition: background 0.15s ease;
}

.tw-cat-row:hover {
  background: rgba(255, 255, 255, 0.05);
}

.tw-cat-label {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  user-select: none;
}

.cat-indicator {
  width: 10px;
  height: 10px;
  border-radius: 2px;
  box-shadow: 0 0 6px rgba(0, 0, 0, 0.5);
}

.cat-name {
  color: #d1e9f7;
  font-size: 12.5px;
}

.cat-count {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.5);
  font-variant-numeric: tabular-nums;
}

.tw-detail-card {
  margin-top: 14px;
  padding: 10px;
  background: rgba(10, 18, 28, 0.95);
  border: 1px solid rgba(57, 213, 255, 0.4);
  border-radius: 6px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
}

.detail-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
  border-bottom: 1px solid rgba(57, 213, 255, 0.2);
  padding-bottom: 4px;
}

.detail-name {
  font-weight: 600;
  color: #39d5ff;
  font-size: 13px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.detail-close {
  background: transparent;
  border: none;
  color: #999;
  cursor: pointer;
  font-size: 16px;
  line-height: 1;
}

.detail-close:hover {
  color: #fff;
}

.detail-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 4px 8px;
  font-size: 11.5px;
}

.detail-item {
  display: flex;
  gap: 4px;
}

.detail-item.full-width {
  grid-column: span 2;
}

.detail-item .k {
  color: #88a0b0;
}

.detail-item .v {
  color: #e0f0f8;
  word-break: break-all;
}
.tw-track-db {
  padding: 5px 14px;
  font-size: 11px;
  color: #88a0b0;
  border-bottom: 1px solid rgba(57, 213, 255, 0.15);
  font-variant-numeric: tabular-nums;
}

.tw-track-box {
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid rgba(57, 213, 255, 0.2);
  font-size: 11.5px;
}

.track-ranges {
  display: flex;
  gap: 6px;
  margin-bottom: 6px;
}

.track-range-btn,
.track-fly-btn {
  background: rgba(8, 16, 24, 0.8);
  border: 1px solid rgba(57, 213, 255, 0.3);
  color: #e6f7ff;
  border-radius: 4px;
  padding: 2px 10px;
  font-size: 11.5px;
  cursor: pointer;
}

.track-range-btn.active {
  background: rgba(57, 213, 255, 0.25);
  border-color: #39d5ff;
}

.track-fly-btn {
  margin-top: 6px;
  width: 100%;
  padding: 4px 10px;
}

.track-note {
  color: #d1e9f7;
}

.track-loiter {
  margin-top: 4px;
  color: #faad14;
  font-weight: 600;
}

.tw-traffic-badges {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding-left: 12px;
  margin-bottom: 6px;
}

.tw-badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 2px 8px;
  font-size: 11.5px;
  border: 1px solid;
  border-radius: 10px;
  color: #e6f7ff;
}

.tw-traffic-note {
  padding-left: 12px;
  font-size: 11px;
  color: #88a0b0;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.tw-btn-overview-2d {
  background: rgba(10, 30, 48, 0.85);
  border: 1px solid rgba(57, 213, 255, 0.5);
  color: #39d5ff;
  border-radius: 4px;
  padding: 3px 8px;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;
}

.tw-btn-overview-2d:hover {
  background: rgba(57, 213, 255, 0.25);
  border-color: #39d5ff;
  color: #ffffff;
  box-shadow: 0 0 8px rgba(57, 213, 255, 0.4);
}
</style>
