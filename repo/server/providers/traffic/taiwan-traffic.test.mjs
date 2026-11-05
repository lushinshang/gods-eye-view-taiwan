import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it, mock } from 'node:test';
import { __resetForTest, getTaiwanTraffic } from './taiwan-traffic.js';

const SECTION_XML = `<SectionList>
<Section><SectionID>S1</SectionID><SectionName>測試路段</SectionName><RoadName>國道1號</RoadName><RoadDirection>N</RoadDirection><SpeedLimit>100</SpeedLimit></Section>
</SectionList>`;
const SHAPE_XML = `<SectionShapeList>
<SectionShape><SectionID>S1</SectionID><Geometry>LINESTRING(121.0 24.0, 121.1 24.1, 121.2 24.2)</Geometry></SectionShape>
</SectionShapeList>`;
const LIVE_TRAFFIC_XML = `<LiveTrafficList>
<LiveTraffic><SectionID>S1</SectionID><TravelSpeed>85</TravelSpeed><CongestionLevel>1</CongestionLevel><DataCollectTime>2026-11-04T10:00:00+08:00</DataCollectTime></LiveTraffic>
</LiveTrafficList>`;
const LIVE_EVENTS_XML = `<LiveEventList>
<LiveEvent><EventID>E1</EventID><EventType>1</EventType><EventTitle>事故</EventTitle><Road>國道1號</Road><Direction>北向</Direction><Positions>POINT(121.1 24.1)</Positions><PublishTime>2026-11-04T10:00:00+08:00</PublishTime></LiveEvent>
</LiveEventList>`;
const PBS_JSON = JSON.stringify({
  result: { records: [{ UID: 'p1', y: 25.0, x: 121.5, comment: '前方事故' }] },
});

/** 可控的假 fetch：記錄每個 URL 的呼叫次數；各來源行為可個別覆寫。 */
function createFakeFetch() {
  const calls = {};
  const behavior = {
    pbs: () => new Promise(() => {}), // 預設：永不回應（模擬失聯）
    static: () => null, // 回傳 null = 正常；回傳 Error = 失敗
    tisvDown: false, // true = 高公局全部來源失敗
  };
  const reply = (body) => ({ ok: true, status: 200, text: async () => body });
  const fn = async (url) => {
    const key = String(url).split('/').pop().split('?')[0];
    calls[key] = (calls[key] ?? 0) + 1;
    if (url.includes('od.moi.gov.tw')) return behavior.pbs();
    if (behavior.tisvDown) throw new Error('network down');
    if (key === 'Section.xml' || key === 'SectionShape.xml') {
      const err = behavior.static();
      if (err) throw err;
      return reply(key === 'Section.xml' ? SECTION_XML : SHAPE_XML);
    }
    if (key === 'LiveTraffic.xml') return reply(LIVE_TRAFFIC_XML);
    if (key === 'LiveEvents.xml') return reply(LIVE_EVENTS_XML);
    throw new Error(`unexpected url ${url}`);
  };
  const pbsCalls = () => calls['A01010000C-000674-015'] ?? 0;
  return { fn, calls, behavior, pbsCalls, reply };
}

const HOUR = 60 * 60_000;
let fake;

beforeEach(() => {
  mock.timers.enable({ apis: ['Date'], now: 1_800_000_000_000 });
  fake = createFakeFetch();
  __resetForTest({ fetch: fake.fn });
});
afterEach(() => {
  mock.timers.reset();
  __resetForTest();
});

describe('PBS 解耦與退避', () => {
  it('PBS 永不回應時 getTaiwanTraffic 仍立即完成，且事件／車速正常', async () => {
    const t0 = performance.now();
    const snap = await getTaiwanTraffic();
    const elapsed = performance.now() - t0;
    assert.ok(elapsed < 1000, `應不被 PBS 阻塞，實際 ${elapsed} ms`);
    assert.equal(fake.pbsCalls(), 1);
    assert.equal(snap.events.length, 1);
    assert.equal(snap.speeds.length, 1);
    assert.equal(snap.speeds[0].speedKmh, 85);
    assert.equal(snap.sources.pbs, 'pending');
    assert.equal(snap.data_health.status, 'ok');
  });

  it('PBS 失敗後 1 小時內不重複請求，滿 1 小時才重試', async () => {
    fake.behavior.pbs = async () => {
      throw new Error('connect timeout');
    };
    await getTaiwanTraffic();
    await new Promise((r) => setImmediate(r)); // 讓背景 promise 結算
    assert.equal(fake.pbsCalls(), 1);

    // 之後每 61 秒刷新一次，共 5 次（< 1 小時）
    for (let i = 0; i < 5; i++) {
      mock.timers.tick(61_000);
      const snap = await getTaiwanTraffic();
      assert.match(snap.sources.pbs, /^error: connect timeout/);
    }
    assert.equal(fake.pbsCalls(), 1, '退避期間不得重複打 PBS');

    mock.timers.tick(HOUR);
    await getTaiwanTraffic();
    assert.equal(fake.pbsCalls(), 2, '退避期滿應重試');
  });

  it('PBS 成功後事件併入下一次 build，並快取 60 秒', async () => {
    fake.behavior.pbs = async () => fake.reply(PBS_JSON);
    await getTaiwanTraffic(); // 第一輪：PBS 於背景取得
    await new Promise((r) => setImmediate(r));
    mock.timers.tick(61_000);
    const snap = await getTaiwanTraffic();
    assert.equal(snap.sources.pbs, 'ok');
    assert.ok(snap.events.some((e) => e.source === '警廣 PBS'));
    assert.equal(fake.pbsCalls(), 2, '每個 60 秒週期僅重抓 1 次');
    await getTaiwanTraffic(); // 快取命中，不再觸發 build／PBS
    assert.equal(fake.pbsCalls(), 2, '60 秒內命中快取不應重發 PBS');
  });
});

describe('靜態路網 24 小時快取與過期失敗回退', () => {
  it('24 小時內不重抓 Section/SectionShape', async () => {
    await getTaiwanTraffic();
    for (let i = 0; i < 3; i++) {
      mock.timers.tick(61_000 * (i + 1));
      await getTaiwanTraffic();
    }
    mock.timers.tick(23 * HOUR);
    await getTaiwanTraffic();
    assert.equal(fake.calls['Section.xml'], 1);
    assert.equal(fake.calls['SectionShape.xml'], 1);
  });

  it('超過 24 小時重抓失敗時退回舊 _sections，speeds 不歸零', async () => {
    const first = await getTaiwanTraffic();
    assert.equal(first.speeds.length, 1);

    fake.behavior.static = () => new Error('HTTP 503 Section.xml');
    mock.timers.tick(24 * HOUR + 1_000);
    const snap = await getTaiwanTraffic();
    assert.equal(fake.calls['Section.xml'], 2, '超過 24h 應嘗試重抓');
    assert.equal(snap.speeds.length, 1);
    assert.equal(snap.speeds[0].speedKmh, 85);
    assert.equal(snap.sources.tisvSpeed, 'ok');
  });

  it('從未成功載入路網且抓取失敗時，不應憑空產生車速', async () => {
    fake.behavior.static = () => new Error('down');
    const snap = await getTaiwanTraffic();
    assert.equal(snap.speeds.length, 0);
    assert.match(snap.sources.tisvSpeed, /^error:/);
  });
});

describe('60 秒動態快取與 data_health', () => {
  it('60 秒內命中快取，到期後重抓', async () => {
    await getTaiwanTraffic();
    mock.timers.tick(30_000);
    const hit = await getTaiwanTraffic();
    assert.equal(fake.calls['LiveTraffic.xml'], 1);
    assert.equal(hit.data_health.status, 'ok');
    assert.equal(hit.data_health.ageMs, 30_000);

    mock.timers.tick(31_000);
    await getTaiwanTraffic();
    assert.equal(fake.calls['LiveTraffic.xml'], 2);
    assert.equal(fake.calls['LiveEvents.xml'], 2);
  });

  it('上游全掛時回傳上次成功資料並標示 stale', async () => {
    await getTaiwanTraffic();
    fake.behavior.tisvDown = true;
    mock.timers.tick(61_000);
    const snap = await getTaiwanTraffic();
    assert.equal(snap.stale, true);
    assert.equal(snap.data_health.status, 'stale');
    assert.equal(snap.events.length, 1);
    assert.ok(snap.error);
  });
});
