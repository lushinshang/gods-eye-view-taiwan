<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';

const props = defineProps({
  // 目前選取的船隻 / 路況事件，只送識別碼與座標，後端不採信其遙測欄位
  selected: { type: Object, default: null },
});

const status = ref({ connected: false, ready: false, model: null, busy: false });
const query = ref('');
const think = ref(false);
const loading = ref(false);
const result = ref(null);
const errorMsg = ref('');
const showCitations = ref(false);
const showToken = ref(false);
const tokenInfo = ref({ configured: false, fingerprint: null });
const newToken = ref('');

const quickQuestions = [
  { label: '📊 海陸態勢總結', q: '請總結目前臺灣海域與國道的整體態勢' },
  { label: '🚢 高雄港油輪動態', q: '高雄港附近的油輪動態如何？' },
  { label: '🛣️ 國道壅塞與事故', q: '目前國道有哪些壅塞與事故？' },
];

const statusLight = computed(() => {
  if (!status.value.connected) return { cls: 'off', text: 'Ollama 未連線' };
  if (!status.value.ready) return { cls: 'warn', text: '模型未就緒' };
  return { cls: 'on', text: status.value.model };
});

let timer = null;
let controller = null;

async function refreshStatus() {
  try {
    const r = await fetch('/api/taiwan-ai-status');
    status.value = await r.json();
  } catch {
    status.value = { connected: false, ready: false, model: null, busy: false };
  }
}

async function refreshToken() {
  try {
    const r = await fetch('/api/taiwan-ai-token');
    if (r.ok) tokenInfo.value = await r.json();
  } catch {
    /* 保持原狀 */
  }
}

async function ask(text) {
  const q = (text ?? query.value).trim();
  if (!q || loading.value) return;
  query.value = q;
  loading.value = true;
  errorMsg.value = '';
  result.value = null;
  controller = new AbortController();
  try {
    const body = { query: q, think: think.value };
    if (props.selected) {
      const { mmsi, lat, lon } = props.selected;
      body.selected = { mmsi, lat, lon };
    }
    const r = await fetch('/api/taiwan-ai-advisor', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`);
    result.value = data;
  } catch (e) {
    if (e.name !== 'AbortError') errorMsg.value = e.message;
  } finally {
    loading.value = false;
    refreshStatus();
  }
}

async function generateToken() {
  const r = await fetch('/api/taiwan-ai-token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{}',
  });
  const data = await r.json();
  if (r.ok) {
    newToken.value = data.token; // 僅顯示一次
    tokenInfo.value = { configured: data.configured, fingerprint: data.fingerprint };
  } else errorMsg.value = data.error || '產生權杖失敗';
}

async function revokeToken() {
  const r = await fetch('/api/taiwan-ai-token', { method: 'DELETE' });
  if (r.ok) {
    tokenInfo.value = await r.json();
    newToken.value = '';
  }
}

async function copyToken() {
  try {
    await navigator.clipboard.writeText(newToken.value);
  } catch {
    /* 使用者可手動選取複製 */
  }
}

function toggleToken() {
  showToken.value = !showToken.value;
  if (showToken.value) refreshToken();
  else newToken.value = '';
}

const citationCount = computed(() => {
  const c = result.value?.citations;
  return c ? (c.vessels?.length ?? 0) + (c.events?.length ?? 0) + (c.speeds?.length ?? 0) : 0;
});

onMounted(() => {
  refreshStatus();
  timer = setInterval(refreshStatus, 30000);
});
onUnmounted(() => {
  clearInterval(timer);
  controller?.abort();
});
</script>

<template>
  <section class="ai-advisor">
    <div class="ai-head">
      <span class="ai-title">🧠 AI 戰情參謀</span>
      <span class="ai-light" :class="statusLight.cls" :title="statusLight.text">
        <i class="dot"></i><em>{{ statusLight.text }}</em>
      </span>
    </div>

    <div class="ai-quick">
      <button
        v-for="item in quickQuestions"
        :key="item.label"
        type="button"
        class="ai-chip"
        :disabled="loading"
        @click="ask(item.q)"
      >
        {{ item.label }}
      </button>
    </div>

    <form class="ai-form" @submit.prevent="ask()">
      <input
        v-model="query"
        class="ai-input"
        type="text"
        maxlength="2000"
        placeholder="輸入戰情問題…"
        :disabled="loading"
      />
      <button class="ai-send" type="submit" :disabled="loading || !query.trim()">送出</button>
    </form>

    <label class="ai-think">
      <input v-model="think" type="checkbox" />
      <span>🧠 深度研判 (think)</span>
    </label>

    <div v-if="loading" class="ai-loading">推論中，本機模型約需數十秒…</div>
    <div v-if="errorMsg" class="ai-error">⚠ {{ errorMsg }}</div>

    <div v-if="result" class="ai-answer">
      <div v-if="result.fallback_used" class="ai-badge fb">
        已降級為確定性簡報（{{ result.reason }}）
      </div>
      <div v-else class="ai-badge ok">✔ 已通過 Grounding 核驗・{{ result.model }}</div>
      <pre class="ai-text">{{ result.content }}</pre>

      <button type="button" class="ai-fold" @click="showCitations = !showCitations">
        <span>📚 RAG 檢索來源明細 (Citations) · {{ citationCount }}</span>
        <span>{{ showCitations ? '▾' : '▸' }}</span>
      </button>
      <div v-if="showCitations" class="ai-cites">
        <div class="cite-meta">
          資料健康：{{ JSON.stringify(result.data_health) }}・符合 船 {{ result.matched_total?.vessels }} / 事件 {{ result.matched_total?.events }} / 路段 {{ result.matched_total?.speeds }}
        </div>
        <div v-for="v in result.citations.vessels" :key="'v' + v.mmsi" class="cite-row">
          🚢 {{ v.name || '—' }} <small>{{ v.mmsi }}</small>
        </div>
        <div v-for="(e, i) in result.citations.events" :key="'e' + i" class="cite-row">
          ⚠ {{ e.title || e.road || JSON.stringify(e) }}
        </div>
        <div v-for="(s, i) in result.citations.speeds" :key="'s' + i" class="cite-row">
          🛣️ {{ s.name || s.road || JSON.stringify(s) }}
        </div>
        <div v-if="!citationCount" class="cite-row">（無符合的檢索來源）</div>
      </div>
    </div>

    <button type="button" class="ai-fold" @click="toggleToken">
      <span>🔐 PAT 權杖管理</span>
      <span>{{ showToken ? '▾' : '▸' }}</span>
    </button>
    <div v-if="showToken" class="ai-token">
      <div class="cite-meta">
        狀態：{{ tokenInfo.configured ? '已設定' : '未設定' }}
        <template v-if="tokenInfo.fingerprint">・指紋 <code>{{ tokenInfo.fingerprint }}</code></template>
      </div>
      <div v-if="newToken" class="ai-newtoken">
        <div class="warn">新權杖僅顯示這一次，請立即複製保存：</div>
        <code class="tok">{{ newToken }}</code>
        <button type="button" class="ai-chip" @click="copyToken">複製</button>
      </div>
      <div class="ai-token-actions">
        <button type="button" class="ai-chip" @click="generateToken">
          {{ tokenInfo.configured ? '重新產生' : '產生新權杖' }}
        </button>
        <button
          type="button"
          class="ai-chip danger"
          :disabled="!tokenInfo.configured"
          @click="revokeToken"
        >
          撤銷
        </button>
      </div>
    </div>
  </section>
</template>

<style scoped>
.ai-advisor {
  margin-top: 14px;
  padding: 10px;
  background: rgba(10, 18, 28, 0.78);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(57, 213, 255, 0.35);
  border-radius: 8px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
  color: #e6f7ff;
  font-size: 12.5px;
  box-sizing: border-box;
  max-width: 100%;
  overflow: hidden;
}
.ai-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 6px;
  margin-bottom: 8px;
}
.ai-title {
  font-weight: 600;
  color: #39d5ff;
}
.ai-light {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  min-width: 0;
  font-size: 11px;
  color: #88a0b0;
}
.ai-light em {
  font-style: normal;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 120px;
}
.dot {
  width: 8px;
  height: 8px;
  flex: none;
  border-radius: 50%;
  background: #8e8e93;
}
.on .dot {
  background: #34c759;
  box-shadow: 0 0 8px #34c759;
}
.warn .dot {
  background: #ffcc00;
  box-shadow: 0 0 8px #ffcc00;
}
.off .dot {
  background: #ff3b30;
  box-shadow: 0 0 8px #ff3b30;
}
.ai-quick {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 8px;
}
.ai-chip {
  background: rgba(57, 213, 255, 0.12);
  border: 1px solid rgba(57, 213, 255, 0.45);
  color: #e6f7ff;
  border-radius: 12px;
  padding: 3px 9px;
  font-size: 11.5px;
  cursor: pointer;
}
.ai-chip:hover:not(:disabled) {
  background: rgba(57, 213, 255, 0.28);
}
.ai-chip:disabled,
.ai-send:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
.ai-chip.danger {
  border-color: rgba(255, 59, 48, 0.6);
  background: rgba(255, 59, 48, 0.12);
}
.ai-form {
  display: flex;
  gap: 6px;
  margin-bottom: 6px;
}
.ai-input {
  flex: 1;
  min-width: 0;
  background: rgba(8, 16, 24, 0.8);
  border: 1px solid rgba(57, 213, 255, 0.3);
  color: #e6f7ff;
  border-radius: 4px;
  padding: 4px 6px;
  font-size: 12px;
  outline: none;
}
.ai-input:focus {
  border-color: #39d5ff;
}
.ai-send {
  background: rgba(57, 213, 255, 0.25);
  border: 1px solid #39d5ff;
  color: #fff;
  border-radius: 4px;
  padding: 0 10px;
  cursor: pointer;
}
.ai-think {
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  user-select: none;
  color: #d1e9f7;
  margin-bottom: 6px;
}
.ai-loading {
  color: #ffcc00;
  font-size: 11.5px;
  margin: 4px 0;
}
.ai-error {
  color: #ff6b61;
  font-size: 11.5px;
  margin: 4px 0;
  word-break: break-all;
}
.ai-answer {
  margin-top: 6px;
}
.ai-badge {
  font-size: 11px;
  padding: 2px 6px;
  border-radius: 4px;
  margin-bottom: 4px;
  word-break: break-all;
}
.ai-badge.ok {
  background: rgba(52, 199, 89, 0.15);
  color: #6ee08a;
}
.ai-badge.fb {
  background: rgba(255, 204, 0, 0.15);
  color: #ffd84d;
}
.ai-text {
  margin: 0 0 6px;
  padding: 8px;
  background: rgba(0, 0, 0, 0.35);
  border-radius: 4px;
  font-family: inherit;
  font-size: 12px;
  line-height: 1.55;
  white-space: pre-wrap;
  word-break: break-word;
  max-height: 220px;
  overflow-y: auto;
}
.ai-fold {
  display: flex;
  justify-content: space-between;
  width: 100%;
  margin-top: 6px;
  padding: 4px 6px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(57, 213, 255, 0.2);
  border-radius: 4px;
  color: #d1e9f7;
  font-size: 11.5px;
  cursor: pointer;
  text-align: left;
}
.ai-cites,
.ai-token {
  margin-top: 4px;
  padding: 6px;
  background: rgba(0, 0, 0, 0.3);
  border-radius: 4px;
  font-size: 11px;
  max-height: 180px;
  overflow-y: auto;
}
.cite-meta {
  color: #88a0b0;
  margin-bottom: 4px;
  word-break: break-all;
}
.cite-row {
  padding: 2px 0;
  border-top: 1px dashed rgba(255, 255, 255, 0.1);
  word-break: break-all;
}
.cite-row small {
  color: #88a0b0;
}
.ai-newtoken {
  margin: 6px 0;
  padding: 6px;
  border: 1px solid rgba(255, 204, 0, 0.5);
  border-radius: 4px;
}
.ai-newtoken .warn {
  color: #ffd84d;
  margin-bottom: 4px;
}
.tok {
  display: block;
  word-break: break-all;
  user-select: all;
  margin-bottom: 4px;
  color: #fff;
}
.ai-token-actions {
  display: flex;
  gap: 6px;
  margin-top: 6px;
}
</style>
