# 環境能力確認記錄（2026-11-09）

記錄 GEV-C-003、GEV-C-004 路徑一（技術驗證）在這個評估環境裡實際卡住的兩個基礎設施缺口，
兩者都經過實測確認，不是假設。這份記錄把「環境不允許」從推論變成可查證的事實，作為路徑一
技術驗證在此環境下的終點狀態。

## C-003：跨使用者（cross-UID）驗證

```
$ whoami
lanss
$ sudo -n true 2>&1; echo "sudo exit: $?"
sudo: a password is required
sudo exit: 1
```

結論：這個執行環境沒有 passwordless sudo，也沒有第二個真實 OS 使用者帳號。
`assertTrustedAncestors` 的 owner 檢查（GEV_PARENT_UNTRUSTED_OWNER）只能用
mock `fs.lstatSync` 驗證邏輯本身是否正確（已驗證），無法做真正跨使用者的端到端
攻擊測試：建立新系統帳號需要管理員密碼，而且是對使用者真實機器的系統層級變更，
不是這次評估工作該自行決定執行的動作。

## C-004：需要外部 API 金鑰的路由

```
$ grep -oE "process\.env\.[A-Z_]+" server/providers/places/google.js \
    server/providers/traffic.js server/providers/mapillary.js \
    server/providers/aircraft/opensky.js server/providers/firms.js \
    server/providers/gemini.js server/providers/openai.js | sort -u \
  | sed 's/.*process\.env\.//' | while read k; do \
    v=$(printenv "$k"); [ -z "$v" ] && echo "$k: 未設定"; done
OPENSKY_AUTH_MODE: 未設定
FIRMS_MAP_KEY: 未設定
GEV_RATELIMIT_GOOGLE_PER_MIN: 未設定
TOMTOM_API_KEY: 未設定
TOMTOM_DAILY_TILE_BUDGET: 未設定
```

結論：Google Places、TomTom、OpenSky、FIRMS 等路由所需的金鑰在這個環境完全沒有
設定（`.env` 裡只有 `AISSTREAM_API_KEY` 一項）。GEV-C-004 的全面覆蓋測試
（`panelRequestRealHandlers.test.mjs`）已對全部40條無獨立門控的路由逐一實測
reachability（確認沒有被任何auth gate或panelRequest denylist擋下），但無法
進一步證明「拿到正確的下游資料」——那需要真實金鑰才能做，不是程式碼或測試
範圍的問題。

## 結論：這是路徑一在此環境下的終點

使用者已確認：把這兩項定為「環境能力所限的最終狀態」，不是「尚未完成的任務」。
`confirmation_status` 對 GEV-C-003、GEV-C-004 繼續維持 `NEEDS_VALIDATION`——
誠實反映「技術上未確認安全」，不因為已經用盡這個環境所有可行手段就偽裝成已解決。
若未來要往下推進，需要：(1) 一個有管理員權限、可建立第二個真實使用者帳號的環境，
或 (2) 使用者自行提供對應服務的真實 API 金鑰。
