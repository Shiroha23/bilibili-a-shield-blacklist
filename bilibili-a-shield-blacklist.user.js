// ==UserScript==
// @name         B站A盾黑名单拉黑助手
// @namespace    http://tampermonkey.net/
// @version      2.0
// @description  自动将A盾黑名单中的用户添加到B站黑名单，支持从 listing.ssrv2.ltd 动态获取数据
// @author       Shiroha23
// @match        https://www.bilibili.com/*
// @grant        GM_xmlhttpRequest
// @grant        GM_registerMenuCommand
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_notification
// @connect      listing.ssrv2.ltd
// @connect      gcore.jsdelivr.net
// @connect      raw.githubusercontent.com
// @run-at       document-end
// ==/UserScript==

(function () {
    'use strict';

    const Config = Object.freeze({
        BATCH_INTERVAL: 2000,
        BATCH_SIZE: 10,
        STORAGE_KEY: 'bilibili_blacklist_progress',
        BLACKLIST_URL: 'https://listing.ssrv2.ltd/',
        BLACKLIST_API_URL: 'https://listing.ssrv2.ltd/api/public-blacklist',
        API_PAGE_SIZE: 50,
        BILI_BLACKS_API_URL: 'https://api.bilibili.com/x/relation/blacks',
        BILI_BLACKS_PAGE_SIZE: 50,
        CACHE_KEY: 'bilibili_blacklist_cache',
        SKIP_ALREADY_BLOCKED: true,
        MY_BLACKS_CACHE_KEY: 'bilibili_my_blacks_cache',
        REFRESH_COOLDOWN: 5000,
        MAX_LOG_ENTRIES: 11037,
        MAX_API_PAGES: 2000,
        DISCLAIMER_KEY: 'bilibili_blacklist_disclaimer_agreed',
        PANEL_ID: 'bl-panel',
        FLOATING_BTN_ID: 'bl-fab',
        TIP_ID: 'bl-tip',
        BLOCKED_TIP_ID: 'bl-blocked-tip',
        STYLE_ID: 'bl-style',
        DETAILS_OVERLAY_ID: 'bl-details-overlay',
        UID_CHECK_OVERLAY_ID: 'bl-uid-check-overlay',
        IMPORT_OVERLAY_ID: 'bl-import-overlay',
        DISCLAIMER_OVERLAY_ID: 'bl-disclaimer',
        GITHUB_URL: 'https://github.com/Shiroha23/bilibili-a-shield-blacklist',
        NYAN_URL: 'https://www.nyan.cat/',
        LOG_CACHE_KEY: 'bilibili_blacklist_log',
    });

    const CSS = `
@keyframes bl-fab-pulse{0%,100%{box-shadow:0 0 0 0 rgba(0,161,214,.4)}50%{box-shadow:0 0 0 12px rgba(0,161,214,0)}}
@keyframes bl-slide-in{from{transform:translateX(110%);opacity:0}to{transform:translateX(0);opacity:1}}
@keyframes bl-slide-out{from{transform:translateX(0);opacity:1}to{transform:translateX(110%);opacity:0}}
@keyframes bl-fade-in{from{opacity:0}to{opacity:1}}
@keyframes bl-scale-in{from{transform:scale(.92);opacity:0}to{transform:scale(1);opacity:1}}
@keyframes bl-scale-out{from{transform:scale(1);opacity:1}to{transform:scale(.92);opacity:0}}
@keyframes bl-progress-stripe{0%{background-position:0 0}100%{background-position:40px 0}}
@keyframes bl-dot-blink{0%,100%{opacity:1}50%{opacity:.3}}
@keyframes bl-spin{to{transform:rotate(360deg)}}

.bl-root{--bl-primary:#00a1d6;--bl-primary-dark:#0088b8;--bl-success:#52c41a;--bl-warning:#faad14;--bl-danger:#f5222d;--bl-purple:#722ed1;--bl-cyan:#13c2c2;--bl-text:#18191c;--bl-text-secondary:#61666d;--bl-text-muted:#9499a0;--bl-bg:#ffffff;--bl-bg-hover:#f6f7f8;--bl-bg-active:#e3e5e7;--bl-border:#e3e5e7;--bl-radius:10px;--bl-radius-sm:6px;--bl-radius-lg:14px;--bl-shadow:0 6px 30px rgba(0,0,0,.12);--bl-shadow-lg:0 12px 48px rgba(0,0,0,.2);--bl-font:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;--bl-mono:"SF Mono",ui-monospace,"Cascadia Code",Menlo,monospace}

.bl-fab{position:fixed;top:120px;right:24px;width:52px;height:52px;border-radius:50%;background:linear-gradient(135deg,var(--bl-primary),#00b5e5);color:#fff;border:none;cursor:pointer;font-size:22px;z-index:99999;box-shadow:0 4px 16px rgba(0,161,214,.35);transition:transform .2s cubic-bezier(.4,0,.2,1),box-shadow .2s;animation:bl-fab-pulse 2.5s ease-in-out infinite;display:flex;align-items:center;justify-content:center;user-select:none}
.bl-fab:hover{transform:scale(1.12);box-shadow:0 6px 24px rgba(0,161,214,.5);animation:none}
.bl-fab:active{transform:scale(.95)}

.bl-panel{position:fixed;top:120px;right:24px;width:320px;background:var(--bl-bg);border-radius:var(--bl-radius-lg);box-shadow:var(--bl-shadow-lg);z-index:99999;font-family:var(--bl-font);animation:bl-scale-in .25s cubic-bezier(.4,0,.2,1);border:1px solid var(--bl-border);transform-origin:top right}
.bl-panel.bl-closing{animation:bl-scale-out .2s cubic-bezier(.4,0,.2,1) forwards}

.bl-panel-header{display:flex;align-items:center;justify-content:space-between;padding:16px 18px 12px;background:var(--bl-bg);color:var(--bl-text);border-radius:var(--bl-radius-lg) var(--bl-radius-lg) 0 0;border-bottom:1px solid var(--bl-border)}
.bl-panel-header h3{margin:0;font-size:15px;font-weight:600;letter-spacing:.3px}
.bl-panel-close{background:var(--bl-bg-hover);border:none;color:var(--bl-text-muted);width:28px;height:28px;border-radius:50%;cursor:pointer;font-size:16px;display:flex;align-items:center;justify-content:center;transition:background .2s}
.bl-panel-close:hover{background:var(--bl-bg-active)}

.bl-panel-body{padding:14px 16px 16px}

.bl-info-card{background:var(--bl-bg-hover);border-radius:var(--bl-radius);padding:12px 14px;margin-bottom:14px}
.bl-info-row{display:flex;justify-content:space-between;align-items:center;font-size:12.5px;color:var(--bl-text-secondary);line-height:1.8}
.bl-info-row strong{color:var(--bl-text);font-weight:600}
.bl-info-row .bl-status-dot{display:inline-block;width:7px;height:7px;border-radius:50%;margin-right:5px;vertical-align:middle}
.bl-status-idle .bl-status-dot{background:var(--bl-text-muted)}
.bl-status-running .bl-status-dot{background:var(--bl-success);animation:bl-dot-blink 1s ease-in-out infinite}
.bl-status-paused .bl-status-dot{background:var(--bl-warning)}
.bl-status-done .bl-status-dot{background:var(--bl-cyan)}

.bl-progress-wrap{margin-bottom:14px}
.bl-progress-label{display:flex;justify-content:space-between;font-size:12px;color:var(--bl-text-secondary);margin-bottom:6px}
.bl-progress-label strong{color:var(--bl-primary);font-weight:600}
.bl-progress-bar{height:8px;background:var(--bg-active,#e3e5e7);border-radius:4px;overflow:hidden;position:relative}
.bl-progress-fill{height:100%;border-radius:4px;background:linear-gradient(90deg,var(--bl-primary),#00b5e5);transition:width .4s cubic-bezier(.4,0,.2,1);position:relative}
.bl-progress-fill.bl-active{background-image:linear-gradient(45deg,rgba(255,255,255,.15) 25%,transparent 25%,transparent 50%,rgba(255,255,255,.15) 50%,rgba(255,255,255,.15) 75%,transparent 75%);background-size:40px 40px;animation:bl-progress-stripe .8s linear infinite}

.bl-section-label{font-size:11px;color:var(--bl-text-muted);text-transform:uppercase;letter-spacing:1px;margin:10px 0 6px;font-weight:600}

.bl-btn{display:flex;align-items:center;justify-content:center;gap:6px;width:100%;padding:9px 12px;border:none;border-radius:var(--bl-radius-sm);cursor:pointer;font-size:13px;font-weight:500;font-family:var(--bl-font);transition:all .15s;user-select:none;position:relative;overflow:hidden}
.bl-btn:active{transform:scale(.97)}
.bl-btn-primary{background:var(--bl-primary);color:#fff}
.bl-btn-primary:hover{background:var(--bl-primary-dark)}
.bl-btn-success{background:var(--bl-success);color:#fff}
.bl-btn-success:hover{background:#45a818}
.bl-btn-warning{background:var(--bl-warning);color:#fff}
.bl-btn-warning:hover{background:#d9950f}
.bl-btn-danger{background:var(--bl-danger);color:#fff}
.bl-btn-danger:hover{background:#d41920}
.bl-btn-purple{background:var(--bl-purple);color:#fff}
.bl-btn-purple:hover{background:#5f1db5}
.bl-btn-ghost{background:var(--bl-bg-hover);color:var(--bl-text-secondary);border:1px solid var(--bl-border)}
.bl-btn-ghost:hover{background:var(--bg-active,#e3e5e7);color:var(--bl-text)}

.bl-btn-row{display:flex;gap:8px;margin-bottom:8px}
.bl-btn-row .bl-btn{flex:1}

.bl-dropdown{position:relative}
.bl-dropdown-menu{position:absolute;top:calc(100% + 4px);left:0;right:0;background:var(--bl-bg);border:1px solid var(--bl-border);border-radius:var(--bl-radius);box-shadow:var(--bl-shadow);z-index:100000;overflow:hidden;opacity:0;transform:translateY(-6px) scaleY(.95);transform-origin:top;pointer-events:none;transition:opacity .15s,transform .15s}
.bl-dropdown-menu.bl-open{opacity:1;transform:translateY(0) scaleY(1);pointer-events:auto}
.bl-dropdown-item{display:flex;align-items:center;gap:8px;padding:9px 14px;border:none;background:none;width:100%;text-align:left;cursor:pointer;font-size:12.5px;color:var(--bl-text-secondary);font-family:var(--bl-font);transition:background .12s,color .12s}
.bl-dropdown-item:hover{background:var(--bl-bg-hover);color:var(--bl-text)}
.bl-dropdown-item+.bl-dropdown-item{border-top:1px solid var(--bl-border)}

.bl-tip-stack{position:fixed;top:120px;right:356px;z-index:100002;display:flex;flex-direction:column;gap:8px;overflow-y:auto;pointer-events:none;scrollbar-width:none}
.bl-tip-stack::-webkit-scrollbar{display:none}
.bl-tip{background:var(--bl-bg);border-radius:var(--bl-radius);box-shadow:var(--bl-shadow-lg);font-family:var(--bl-font);max-width:300px;animation:bl-slide-in .3s cubic-bezier(.4,0,.2,1);border:1px solid var(--bl-border);overflow:hidden;pointer-events:auto;flex-shrink:0}
.bl-tip-title{padding:10px 14px 4px;font-weight:600;font-size:13px;color:var(--bl-text)}
.bl-tip-msg{padding:0 14px 10px;font-size:12px;color:var(--bl-text-secondary);line-height:1.5;white-space:pre-line}
.bl-tip-bar{height:3px;background:linear-gradient(90deg,var(--bl-primary),var(--bl-cyan))}
.bl-tip.bl-out{animation:bl-slide-out .25s cubic-bezier(.4,0,.2,1) forwards}

.bl-overlay{position:fixed;inset:0;z-index:100001;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;padding:20px;box-sizing:border-box;animation:bl-fade-in .2s;backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px)}
.bl-dialog{background:var(--bl-bg);border-radius:var(--bl-radius-lg);box-shadow:var(--bl-shadow-lg);width:100%;display:flex;flex-direction:column;font-family:var(--bl-font);animation:bl-scale-in .2s cubic-bezier(.4,0,.2,1);overflow:hidden}
.bl-dialog-header{display:flex;align-items:center;justify-content:space-between;padding:16px 20px;border-bottom:1px solid var(--bl-border);background:var(--bl-bg-hover)}
.bl-dialog-header h3{margin:0;font-size:15px;color:var(--bl-text);font-weight:600}
.bl-dialog-close{background:none;border:none;cursor:pointer;font-size:20px;color:var(--bl-text-muted);width:30px;height:30px;display:flex;align-items:center;justify-content:center;border-radius:50%;transition:background .15s,color .15s}
.bl-dialog-close:hover{background:var(--bg-active,#e3e5e7);color:var(--bl-text)}
.bl-dialog-body{padding:16px 20px;overflow-y:auto;flex:1}
.bl-dialog-footer{display:flex;justify-content:flex-end;gap:8px;padding:12px 20px;border-top:1px solid var(--bl-border);background:var(--bl-bg-hover)}
.bl-dialog-footer .bl-btn{width:auto;min-width:80px}

.bl-hint{font-size:12px;color:var(--bl-text-muted);line-height:1.5;margin-bottom:10px}
.bl-textarea{width:100%;min-height:120px;padding:10px 12px;border:1px solid var(--bl-border);border-radius:var(--bl-radius-sm);font-size:13px;font-family:var(--bl-mono);resize:vertical;box-sizing:border-box;transition:border-color .2s;outline:none}
.bl-textarea:focus{border-color:var(--bl-primary)}

.bl-log-table{width:100%;border-collapse:collapse;font-size:12.5px}
.bl-log-table th{padding:10px 14px;text-align:left;font-weight:600;color:var(--bl-text-secondary);background:var(--bl-bg-hover);position:sticky;top:0;z-index:1;font-size:11.5px;text-transform:uppercase;letter-spacing:.5px}
.bl-log-table td{padding:8px 14px;border-bottom:1px solid var(--bl-border);color:var(--bl-text-secondary)}
.bl-log-table tr:hover td{background:var(--bl-bg-hover)}
.bl-badge{display:inline-block;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:600}
.bl-badge-success{background:#f6ffed;color:var(--bl-success)}
.bl-badge-failed{background:#fff2f0;color:var(--bl-danger)}
.bl-badge-skipped{background:#e6fffb;color:var(--bl-cyan)}
.bl-badge-error{background:#fffbe6;color:var(--bl-warning)}
.bl-badge-undone{background:#f0f0f0;color:var(--bl-text-muted);text-decoration:line-through}

.bl-filter-bar{display:flex;gap:6px;flex-wrap:wrap;align-items:center}
.bl-filter-btn{padding:5px 12px;border:1px solid var(--bl-border);background:var(--bl-bg);color:var(--bl-text-secondary);border-radius:4px;cursor:pointer;font-size:12px;font-family:var(--bl-font);transition:all .15s}
.bl-filter-btn:hover{border-color:var(--bl-primary);color:var(--bl-primary)}
.bl-filter-btn.bl-active{background:var(--bl-primary);color:#fff;border-color:var(--bl-primary)}

.bl-result-box{padding:12px 14px;border-radius:var(--bl-radius-sm);font-size:12.5px;line-height:1.6;background:var(--bl-bg-hover);color:var(--bl-text);overflow-y:auto}
.bl-result-box.bl-error{background:#fff2f0;color:var(--bl-danger)}

.bl-disclaimer{font-size:13.5px;line-height:1.7;color:var(--bl-text)}
.bl-disclaimer ol{margin:10px 0;padding-left:20px}
.bl-disclaimer li{margin-bottom:4px}

.bl-spinner{display:inline-block;width:14px;height:14px;border:2px solid rgba(255,255,255,.3);border-top-color:#fff;border-radius:50%;animation:bl-spin .6s linear infinite;vertical-align:middle;margin-right:4px}
    `;

    const Store = {
        set(key, value) {
            const str = typeof value === 'string' ? value : JSON.stringify(value);
            if (typeof GM_setValue !== 'undefined') GM_setValue(key, str);
            try { localStorage.setItem(key, str); } catch (_) {}
        },
        get(key) {
            if (typeof GM_getValue !== 'undefined') {
                const v = GM_getValue(key);
                if (v != null) return v;
            }
            try { return localStorage.getItem(key); } catch (_) { return null; }
        },
        setRaw(key, value) {
            if (typeof GM_setValue !== 'undefined') GM_setValue(key, value);
            try { localStorage.setItem(key, value); } catch (_) {}
        },
        getJson(key) {
            const raw = Store.get(key);
            if (!raw) return null;
            try { return JSON.parse(raw); } catch (_) { return null; }
        }
    };

    const Http = {
        fetchText(url, timeout = 60000) {
            if (typeof GM_xmlhttpRequest !== 'undefined') {
                return new Promise((resolve, reject) => {
                    GM_xmlhttpRequest({
                        method: 'GET', url,
                        headers: { 'Accept': 'application/json, text/html;q=0.9, */*;q=0.8' },
                        timeout,
                        onload(res) { if (res.status >= 200 && res.status < 300) resolve(res.responseText); else reject(new Error(`HTTP ${res.status}`)); },
                        onerror() { reject(new Error('网络请求失败')); },
                        ontimeout() { reject(new Error('请求超时')); }
                    });
                });
            }
            const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
            let tid = null;
            if (controller) tid = setTimeout(() => controller.abort(), timeout);
            return fetch(url, { mode: 'cors', credentials: 'omit', headers: { 'Accept': 'application/json, text/html;q=0.9, */*;q=0.8' }, signal: controller ? controller.signal : undefined })
                .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.text(); })
                .catch(err => { if (err && err.name === 'AbortError') throw new Error('请求超时'); throw err; })
                .finally(() => { if (tid !== null) clearTimeout(tid); });
        }
    };

    const Auth = {
        getCsrfToken() { const m = document.cookie.match(/bili_jct=([^;]+)/); return m ? m[1] : ''; },
        getCurrentUid() { const m = document.cookie.match(/DedeUserID=([^;]+)/); return m ? m[1] : ''; },
        isLoggedIn() { return !!Auth.getCurrentUid(); }
    };

    const BlacklistData = {
        uids: [], uidSet: new Set(), source: '无数据', myBlacks: new Set(), xianJunUids: new Set(), xianJunCheckComplete: false,
        syncSet() { BlacklistData.uidSet = new Set(BlacklistData.uids); },
        setUids(uids, source) { BlacklistData.uids = uids; BlacklistData.source = source; BlacklistData.syncSet(); },
        async fetchFromPublicApi() {
            const limit = Config.API_PAGE_SIZE; const seen = new Set(); const uids = []; let offset = 0; let hasMore = true; let pageCount = 0;
            while (hasMore && pageCount < Config.MAX_API_PAGES) {
                pageCount++;
                const url = Config.BLACKLIST_API_URL + '?' + new URLSearchParams({ offset: String(offset), limit: String(limit) }).toString();
                const text = await Http.fetchText(url);
                let data; try { data = JSON.parse(text); } catch (_) { throw new Error('API 返回非 JSON'); }
                if (!data.success || !Array.isArray(data.list)) throw new Error(data.error || '无法解析黑名单 API 响应');
                for (let i = 0; i < data.list.length; i++) { const raw = data.list[i] && data.list[i].uid; const uid = raw != null ? parseInt(String(raw), 10) : NaN; if (Number.isFinite(uid) && !seen.has(uid)) { seen.add(uid); uids.push(uid); } }
                if (data.list.length === 0) break; offset += data.list.length; hasMore = Boolean(data.hasMore) && data.list.length > 0;
            }
            return uids;
        },
        async loadBackupAShield() {
            try {
                const text = await Http.fetchText('https://raw.githubusercontent.com/Shiroha23/bilibili-a-shield-blacklist/main/bilibili-a-shield-blacklist-uids/bilibili-a-shield-blacklist-uids.txt');
                const uids = []; for (const line of text.split('\n')) { const trimmed = line.trim(); if (trimmed && !trimmed.startsWith('#')) { const uid = parseInt(trimmed, 10); if (!isNaN(uid) && uid > 0) uids.push(uid); } }
                console.log(`✅ 备用A盾黑名单列表加载完成，共 ${uids.length} 条`); return uids;
            } catch (e) { console.warn('⚠️ 加载备用A盾黑名单列表失败:', e); return null; }
        },
        async loadXianJunList() {
            try {
                let text; let sourceName = 'XianLists(主源)';
                try { text = await Http.fetchText('https://gcore.jsdelivr.net/gh/Darknights1750/XianLists@main/xianLists.json', 5000); }
                catch (_) { text = await Http.fetchText('https://raw.githubusercontent.com/Shiroha23/bilibili-a-shield-blacklist/main/bilibili-xianLists-uids/xianLists.json', 5000); sourceName = 'XianLists(备用源)'; }
                const data = JSON.parse(text); BlacklistData.xianJunUids.clear();
                const all = [...(data.xianList || []), ...(data.xianLv1List || []), ...(data.xianLv2List || []), ...(data.xianLv3List || [])];
                for (const uid of all) BlacklistData.xianJunUids.add(String(uid));
                console.log(`✅ XianLists列表加载完成，共 ${BlacklistData.xianJunUids.size} 条，来源：${sourceName}`);
                const uids = Array.from(BlacklistData.xianJunUids, uid => parseInt(uid, 10)).filter(uid => Number.isFinite(uid) && uid > 0);
                return { uids, source: sourceName };
            } catch (e) { console.warn('⚠️ 加载XianLists列表失败:', e); return null; }
            finally { BlacklistData.xianJunCheckComplete = true; }
        },
        isCurrentUserXianJun() { const uid = Auth.getCurrentUid(); return uid ? BlacklistData.xianJunUids.has(uid) : false; },
        async loadLiveRoomRobotList() {
            try {
                const text = await Http.fetchText('https://raw.githubusercontent.com/Shiroha23/bilibili-a-shield-blacklist/main/bilibili-live-room-robot-blacklist-uids/bilibili-live-room-robot-blacklist-uids.txt');
                const uids = []; const seen = new Set(); const re = /space\.bilibili\.com\/(\d+)/;
                for (let line of text.split('\n')) { line = line.trim(); if (line && !line.startsWith('#')) { const m = re.exec(line); if (m) { const uid = parseInt(m[1], 10); if (!isNaN(uid) && uid > 0 && !seen.has(uid)) { seen.add(uid); uids.push(uid); } } } }
                console.log(`✅ 直播间机器人列表加载完成，共 ${uids.length} 条`); return uids;
            } catch (e) { console.warn('⚠️ 加载直播间机器人列表失败:', e); return null; }
        },
        async fetchRemote() {
            try {
                console.log('🔄 正在从 listing.ssrv2.ltd API 获取黑名单数据...');
                let uids = await BlacklistData.fetchFromPublicApi(); let sourceName = 'A盾黑名单(主源)';
                if (!uids || uids.length === 0) { console.log('⚠️ 主源失败，尝试备用源...'); uids = await BlacklistData.loadBackupAShield(); sourceName = 'A盾黑名单(备用源)'; }
                if (uids && uids.length > 0) { BlacklistData.setUids(uids, 'A盾黑名单'); Store.set(Config.CACHE_KEY, uids); console.log(`✅ 成功从 ${sourceName} 获取 ${uids.length} 条黑名单数据`); return { success: true, fromRemote: true, count: uids.length }; }
                throw new Error('未找到UID数据');
            } catch (e) {
                console.warn('⚠️ 从远程获取黑名单失败:', e);
                const cached = Store.getJson(Config.CACHE_KEY);
                if (cached && cached.length > 0) { BlacklistData.setUids(cached, '本地缓存'); console.log(`✅ 使用本地缓存数据: ${cached.length} 条`); return { success: true, fromCache: true, count: cached.length }; }
                BlacklistData.setUids([], '无数据'); console.log('⚠️ 无可用数据源'); return { success: false, count: 0 };
            }
        },
        async loadMyBlacklist() {
            BlacklistData.myBlacks.clear(); if (!Auth.isLoggedIn()) return false;
            try { console.log('🔄 正在加载我的黑名单...'); const records = await BiliApi.fetchAllMyBlacks(); for (const item of records) BlacklistData.myBlacks.add(item.uid); console.log(`✅ 我的黑名单加载完成，共 ${BlacklistData.myBlacks.size} 个用户`); return true; }
            catch (e) { console.warn('⚠️ 加载我的黑名单失败:', e); return false; }
        },
        isUserBlocked(uid) { return BlacklistData.myBlacks.has(uid); },
        saveCache() { Store.set(Config.CACHE_KEY, BlacklistData.uids); },
        loadFromCache() { const cached = Store.getJson(Config.CACHE_KEY); if (cached && cached.length > 0) { BlacklistData.setUids(cached, '本地缓存'); return true; } return false; },
        parseUidsFromText(text) {
            const seen = new Set(); const out = [];
            function add(uid) { if (typeof uid === 'number' && Number.isFinite(uid) && uid > 0 && !seen.has(uid)) { seen.add(uid); out.push(uid); } }
            const linkRe = /space\.bilibili\.com\/(\d+)/gi; let m;
            while ((m = linkRe.exec(text)) !== null) add(parseInt(m[1], 10));
            for (const part of text.split(/[\n,;，；\r\t]+/)) { let p = part.trim(); if (!p) continue; p = p.replace(/^UID[:\s：]*/i, '').trim(); const digits = p.match(/^(\d{5,})$/); if (digits) add(parseInt(digits[1], 10)); }
            return out;
        },
        applyImported(uids) { BlacklistData.setUids(uids, '用户导入'); BlacklistData.saveCache(); Progress.clear(); }
    };

    const BiliApi = {
        async blockUser(uid) {
            const result = { success: false, message: '', code: null, data: null };
            const csrf = Auth.getCsrfToken(); if (!csrf) { result.message = '无法获取CSRF Token'; console.error('❌ ' + result.message); return result; }
            try {
                const resp = await fetch('https://api.bilibili.com/x/relation/modify', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'X-Requested-With': 'XMLHttpRequest', 'Referer': `https://space.bilibili.com/${uid}` }, credentials: 'include', body: new URLSearchParams({ fid: uid.toString(), act: '5', re_src: '11', csrf }) });
                const data = await resp.json(); result.code = data.code; result.data = data;
                if (data.code === 0) { result.success = true; result.message = '拉黑成功'; console.log(`✅ 成功拉黑用户: ${uid}`); }
                else if (data.code === -101) { result.message = '未登录或登录已过期'; console.error('❌ ' + result.message); }
                else if (data.code === -102) { result.success = true; result.message = '用户已经在黑名单中'; console.log(`⚠️ 用户 ${uid} 已经在黑名单中`); }
                else { result.message = data.message || data.msg || `错误代码: ${data.code}`; console.error(`❌ 拉黑用户失败，错误代码: ${data.code}`); }
            } catch (e) { result.message = e.message || '网络错误'; console.error(`❌ 拉黑用户时出错:`, e.message); }
            return result;
        },
        async unblockUser(uid) {
            const result = { success: false, message: '', code: null };
            const csrf = Auth.getCsrfToken(); if (!csrf) { result.message = '无法获取CSRF Token'; return result; }
            try {
                const resp = await fetch('https://api.bilibili.com/x/relation/modify', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'X-Requested-With': 'XMLHttpRequest', 'Referer': `https://space.bilibili.com/${uid}` }, credentials: 'include', body: new URLSearchParams({ fid: uid.toString(), act: '6', re_src: '11', csrf }) });
                const data = await resp.json(); result.code = data.code;
                if (data.code === 0) { result.success = true; result.message = '取消拉黑成功'; console.log(`✅ 成功取消拉黑用户: ${uid}`); }
                else { result.message = data.message || data.msg || `错误代码: ${data.code}`; console.error(`❌ 取消拉黑失败: ${data.code}`); }
            } catch (e) { result.message = e.message || '网络错误'; console.error(`❌ 取消拉黑时出错:`, e.message); }
            return result;
        },
        async fetchAllMyBlacks() {
            const ps = Config.BILI_BLACKS_PAGE_SIZE; const seen = new Set(); const out = []; let pn = 1;
            while (pn <= Config.MAX_API_PAGES) {
                const url = Config.BILI_BLACKS_API_URL + '?' + new URLSearchParams({ pn: String(pn), ps: String(ps) }).toString();
                const resp = await fetch(url, { method: 'GET', credentials: 'include', headers: { 'Accept': 'application/json, text/plain, */*' } });
                const data = await resp.json(); if (!resp.ok) throw new Error(`HTTP ${resp.status}`); if (!data || data.code !== 0) throw new Error((data && (data.message || data.msg)) || '接口返回异常');
                const payload = data.data || {}; const list = Array.isArray(payload.list) ? payload.list : []; const total = Number.isFinite(payload.total) ? payload.total : null;
                for (const item of list) { const uid = parseInt(String((item || {}).mid || (item || {}).uid || ''), 10); if (Number.isFinite(uid) && !seen.has(uid)) { seen.add(uid); out.push({ uid, raw: item }); } }
                if (list.length < ps) break; if (total !== null && out.length >= total) break; pn++;
            }
            return out;
        }
    };

    const Progress = {
        save(index) { Store.setRaw(Config.STORAGE_KEY, String(index)); },
        get() { if (typeof GM_getValue !== 'undefined') { const v = GM_getValue(Config.STORAGE_KEY); if (v) return parseInt(v, 10); } const v = localStorage.getItem(Config.STORAGE_KEY); return v ? parseInt(v, 10) : 0; },
        clear() { Store.setRaw(Config.STORAGE_KEY, '0'); },
        normalize(startIndex) { const total = BlacklistData.uids.length; if (total <= 0) return 0; const n = Number.isFinite(startIndex) ? startIndex : parseInt(startIndex, 10); const resolved = Number.isFinite(n) ? n : 0; if (resolved >= total || resolved < 0) { Progress.clear(); return 0; } return resolved; }
    };

    const BlockLog = {
        _entries: [],
        _load() {
            const raw = Store.getJson(Config.LOG_CACHE_KEY);
            if (raw && Array.isArray(raw)) BlockLog._entries = raw;
        },
        _save() {
            Store.set(Config.LOG_CACHE_KEY, BlockLog._entries);
        },
        add(entry) {
            BlockLog._entries.push({ timestamp: new Date().toLocaleString(), uid: entry.uid, status: entry.status, message: entry.message || '', index: entry.index, total: entry.total, undone: false });
            if (BlockLog._entries.length > Config.MAX_LOG_ENTRIES * 2) BlockLog._entries = BlockLog._entries.slice(-Config.MAX_LOG_ENTRIES);
            BlockLog._save();
        },
        clear() { BlockLog._entries = []; BlockLog._save(); },
        getAll() { return BlockLog._entries; },
        getStats() { const s = { success: 0, failed: 0, skipped: 0, error: 0, undone: 0, total: BlockLog._entries.length }; for (const e of BlockLog._entries) { if (s[e.status] !== undefined) s[e.status]++; } return s; }
    };

    const BatchState = {
        running: false, paused: false, finished: false, shouldStop: false, isRefreshing: false, lastRefreshTime: 0, skippedCount: 0,
        reset() { BatchState.running = false; BatchState.paused = false; BatchState.finished = false; BatchState.shouldStop = false; BatchState.skippedCount = 0; },
        canStart(actionLabel) {
            if (BatchState.isRefreshing) { Notify.show('操作被阻止', `${actionLabel}前请等待数据刷新完成`, 'warning'); return false; }
            if (BatchState.running && !BatchState.paused) { Notify.show('操作被阻止', `${actionLabel}前请先暂停或等待当前批量拉黑结束`, 'warning'); return false; }
            return true;
        }
    };

    function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

    async function batchBlock(startIndex = 0) {
        if (BatchState.isRefreshing) { Notify.show('操作被阻止', '开始批量拉黑前请等待数据刷新完成', 'warning'); return; }
        if (BatchState.running) { alert('批量拉黑正在进行中，请等待当前任务结束。'); return; }
        if (!Auth.isLoggedIn()) { alert('请先登录B站账号！'); return; }

        BatchState.running = true; BatchState.finished = false; BatchState.skippedCount = 0;
        startIndex = Progress.normalize(startIndex); const total = BlacklistData.uids.length;
        let success = 0, failed = 0, canSkip = false;

        UI.updateBatchButton(); UI.updateStatusDisplay();

        try {
            if (Config.SKIP_ALREADY_BLOCKED) { canSkip = await BlacklistData.loadMyBlacklist(); if (!canSkip) Notify.show('跳过检测不可用', '未能读取你的B站黑名单，本轮将继续尝试拉黑并自动识别已存在项', 'warning'); }
            console.log(`🚀 开始批量拉黑，从第 ${startIndex + 1} 个用户开始，共 ${total} 个用户，每批 ${Config.BATCH_SIZE} 个并发`);
            BlockLog.clear();

            if (canSkip) {
                const toSkip = []; for (let i = startIndex; i < total; i++) { if (BlacklistData.isUserBlocked(BlacklistData.uids[i])) toSkip.push({ uid: BlacklistData.uids[i], index: i + 1 }); }
                if (toSkip.length > 0) { console.log(`⏩ 预检跳过 ${toSkip.length} 个已在黑名单中的用户`); for (const s of toSkip) { BlockLog.add({ uid: s.uid, status: 'skipped', message: '用户已在黑名单中', index: s.index, total }); BatchState.skippedCount++; } Notify.show('预检完成', `跳过 ${toSkip.length} 个已在黑名单中的用户`); }
            }

            const toProcess = []; for (let i = startIndex; i < total; i++) { const uid = BlacklistData.uids[i]; if (canSkip && BlacklistData.isUserBlocked(uid)) continue; toProcess.push({ uid, globalIndex: i + 1 }); }

            if (toProcess.length === 0) { console.log('✅ 所有用户已在黑名单中，无需操作'); BatchState.finished = true; Notify.show('批量拉黑完成', `总计: ${total}\n跳过: ${BatchState.skippedCount}\n无需新增拉黑`, 'success'); Progress.save(total); return; }
            console.log(`📋 需要拉黑 ${toProcess.length} 个用户（已跳过 ${BatchState.skippedCount} 个）`);

            for (let batchIdx = 0; batchIdx < toProcess.length; batchIdx += Config.BATCH_SIZE) {
                while (BatchState.paused) { if (BatchState.shouldStop) { console.log('🛑 批量拉黑被终止'); return; } console.log('⏸️ 批量拉黑已暂停，等待继续...'); await delay(1000); }
                if (BatchState.shouldStop) { console.log('🛑 批量拉黑被终止'); return; }

                const batchItems = toProcess.slice(batchIdx, batchIdx + Config.BATCH_SIZE);
                const batchResults = await Promise.all(batchItems.map(item => {
                    return BiliApi.blockUser(item.uid).then(r => {
                        if (r.code === -102) { BlacklistData.myBlacks.add(item.uid); return { uid: item.uid, globalIndex: item.globalIndex, status: 'skipped', message: r.message }; }
                        else if (r.success) { BlacklistData.myBlacks.add(item.uid); return { uid: item.uid, globalIndex: item.globalIndex, status: 'success', message: r.message }; }
                        return { uid: item.uid, globalIndex: item.globalIndex, status: 'failed', message: r.message };
                    }).catch(e => ({ uid: item.uid, globalIndex: item.globalIndex, status: 'failed', message: e.message || '未知错误' }));
                }));

                for (const r of batchResults) { BlockLog.add({ uid: r.uid, status: r.status, message: r.message, index: r.globalIndex, total }); if (r.status === 'success') success++; else if (r.status === 'failed') failed++; else if (r.status === 'skipped') BatchState.skippedCount++; }

                const processed = BatchState.skippedCount + success + failed;
                Progress.save(processed); UI.updateProgressDisplay(); UI.updateStatusDisplay();
                Notify.show('批量拉黑进度', `已处理: ${processed}/${total}\n成功: ${success}  失败: ${failed}\n跳过: ${BatchState.skippedCount}`);

                if (batchIdx + Config.BATCH_SIZE < toProcess.length) { console.log(`⏳ 批次完成 (${processed}/${total})，等待 ${Config.BATCH_INTERVAL}ms 后继续...`); await delay(Config.BATCH_INTERVAL); }
            }

            console.log(`✅ 批量拉黑完成！成功: ${success}, 失败: ${failed}, 跳过: ${BatchState.skippedCount}`);
            BatchState.finished = true;
            Notify.show('批量拉黑完成', `总计: ${total}\n成功: ${success}\n失败: ${failed}\n跳过: ${BatchState.skippedCount}`, 'success');
            if (success + failed + BatchState.skippedCount === total) Progress.save(total);
        } finally {
            BatchState.running = false; BatchState.paused = false; BatchState.shouldStop = false;
            UI.updateBatchButton(); UI.updateStatusDisplay();
        }
    }

    const Notify = {
        _container: null,
        _getContainer() {
            if (!Notify._container || !document.body.contains(Notify._container)) {
                Notify._container = document.createElement('div'); Notify._container.className = 'bl-tip-stack bl-root';
                document.body.appendChild(Notify._container);
            }
            const panel = document.getElementById(Config.PANEL_ID);
            if (panel) {
                const panelBottom = panel.getBoundingClientRect().bottom;
                const stackTop = 120;
                Notify._container.style.maxHeight = Math.max(0, panelBottom - stackTop) + 'px';
            }
            return Notify._container;
        },
        show(title, message, type = 'info', displayTime) {
            if (type === 'success' && typeof GM_notification !== 'undefined') GM_notification({ title, text: message });
            Notify._toast(title, message, type, displayTime);
        },
        _toast(title, message, type, displayTime) {
            UI.ensureStyle();
            const container = Notify._getContainer();
            const tip = document.createElement('div'); tip.className = 'bl-tip bl-root';
            const bar = document.createElement('div'); bar.className = 'bl-tip-bar';
            const colors = { info: 'var(--bl-primary)', success: 'var(--bl-success)', warning: 'var(--bl-warning)', error: 'var(--bl-danger)' };
            bar.style.background = `linear-gradient(90deg, ${colors[type] || colors.info}, ${colors[type] || colors.info}88)`;
            const titleEl = document.createElement('div'); titleEl.className = 'bl-tip-title'; titleEl.textContent = title;
            const msgEl = document.createElement('div'); msgEl.className = 'bl-tip-msg'; msgEl.textContent = message;
            tip.appendChild(bar); tip.appendChild(titleEl); tip.appendChild(msgEl); container.appendChild(tip);
            container.scrollTop = container.scrollHeight;
            setTimeout(() => { tip.classList.add('bl-out'); setTimeout(() => { tip.remove(); if (container.children.length === 0) container.remove(); }, 250); }, displayTime || 4000);
        }
    };

    function escapeHtml(str) { const div = document.createElement('div'); div.textContent = String(str); return div.innerHTML; }

    const UI = {
        ensureStyle() { if (document.getElementById(Config.STYLE_ID)) return; const style = document.createElement('style'); style.id = Config.STYLE_ID; style.textContent = CSS; document.head.appendChild(style); },

        _getStatusClass() { return BatchState.running ? (BatchState.paused ? 'bl-status-paused' : 'bl-status-running') : (BatchState.finished ? 'bl-status-done' : 'bl-status-idle'); },
        _getStatusText() { return BatchState.running ? (BatchState.paused ? '已暂停' : '运行中') : (BatchState.finished ? '已完成' : '待运行'); },

        updateStatusDisplay() {
            const el = document.getElementById('bl-status-row'); if (!el) return;
            el.className = 'bl-info-row ' + UI._getStatusClass();
            const dot = el.querySelector('.bl-status-dot'); if (dot) dot.style.background = BatchState.running ? (BatchState.paused ? 'var(--bl-warning)' : 'var(--bl-success)') : (BatchState.finished ? 'var(--bl-cyan)' : 'var(--bl-text-muted)');
            const text = el.querySelector('.bl-status-text'); if (text) text.textContent = UI._getStatusText();
        },

        updateProgressDisplay() {
            const p = Progress.get(); const total = BlacklistData.uids.length; const pct = total > 0 ? Math.min(100, (p / total * 100)).toFixed(1) : 0;
            const fill = document.getElementById('bl-progress-fill'); if (fill) { fill.style.width = pct + '%'; fill.className = 'bl-progress-fill' + (BatchState.running && !BatchState.paused ? ' bl-active' : ''); }
            const num = document.getElementById('bl-progress-num'); if (num) num.textContent = `${p} / ${total}`;
            const pctEl = document.getElementById('bl-progress-pct'); if (pctEl) pctEl.textContent = pct + '%';
        },

        updateBatchButton() {
            const btn = document.getElementById('bl-btn-batch'); if (!btn) return;
            if (!BatchState.running) {
                const p = Progress.get();
                btn.className = 'bl-btn bl-btn-primary';
                btn.innerHTML = BatchState.finished ? '🔄 重新批量拉黑' : (p > 0 ? '▶️ 继续批量拉黑' : '▶️ 开始批量拉黑');
            } else if (BatchState.paused) {
                btn.className = 'bl-btn bl-btn-success';
                btn.innerHTML = '▶️ 继续批量拉黑';
            } else {
                btn.className = 'bl-btn bl-btn-warning';
                btn.innerHTML = '⏸️ 暂停批量拉黑';
            }
        },

        createFloatingButton() {
            if (document.getElementById(Config.FLOATING_BTN_ID)) return;
            UI.ensureStyle();
            const btn = document.createElement('button'); btn.id = Config.FLOATING_BTN_ID; btn.className = 'bl-fab'; btn.innerHTML = '🛡️'; btn.title = 'B站A盾黑名单拉黑助手';
            btn.addEventListener('click', () => { btn.remove(); UI.createControlPanel(); });
            document.body.appendChild(btn);
        },

        createControlPanel() {
            UI.ensureStyle();
            const existing = document.getElementById(Config.PANEL_ID); if (existing) existing.remove();
            const panel = document.createElement('div'); panel.id = Config.PANEL_ID; panel.className = 'bl-panel bl-root';

            const progress = Progress.get(); const total = BlacklistData.uids.length; const pct = total > 0 ? Math.min(100, (progress / total * 100)).toFixed(1) : 0;
            const loggedIn = Auth.isLoggedIn(); const uid = Auth.getCurrentUid();
            const statusClass = UI._getStatusClass();

            panel.innerHTML = `
<div class="bl-panel-header">
    <h3>🛡️ A盾黑名单助手</h3>
    <button class="bl-panel-close" id="bl-btn-close">×</button>
</div>
<div class="bl-panel-body">
    <div class="bl-info-card">
        <div class="bl-info-row"><span>登录状态</span><strong style="color:${loggedIn ? 'var(--bl-success)' : 'var(--bl-danger)'}">${loggedIn ? uid : '未登录'}</strong></div>
        <div class="bl-info-row"><span>数据来源</span><strong>${BlacklistData.source}</strong></div>
        <div class="bl-info-row"><span>UID 总数</span><strong>${total}</strong></div>
        <div class="bl-info-row ${statusClass}" id="bl-status-row"><span>运行状态</span><strong><span class="bl-status-dot"></span><span class="bl-status-text">${UI._getStatusText()}</span></strong></div>
    </div>
    <div class="bl-progress-wrap">
        <div class="bl-progress-label"><span>拉黑进度</span><span><strong id="bl-progress-pct">${pct}%</strong> · <span id="bl-progress-num">${progress} / ${total}</span></span></div>
        <div class="bl-progress-bar"><div class="bl-progress-fill${BatchState.running && !BatchState.paused ? ' bl-active' : ''}" id="bl-progress-fill" style="width:${pct}%"></div></div>
    </div>
    <div class="bl-section-label">操作</div>
    <button class="bl-btn bl-btn-primary" id="bl-btn-batch">${BatchState.finished ? '🔄 重新批量拉黑' : (progress > 0 ? '▶️ 继续批量拉黑' : '▶️ 开始批量拉黑')}</button>
    <div class="bl-section-label">数据源</div>
    <div class="bl-dropdown">
        <button class="bl-btn bl-btn-success" id="bl-btn-refresh">🔄 刷新数据 ▾</button>
        <div class="bl-dropdown-menu" id="bl-menu-refresh">
            <button class="bl-dropdown-item" data-action="refresh-remote">🛡️ A盾黑名单</button>
            <button class="bl-dropdown-item" data-action="refresh-xianlists">👹 XianLists</button>
            <button class="bl-dropdown-item" data-action="refresh-live-robot">🤖 直播间机器人</button>
            <button class="bl-dropdown-item" data-action="refresh-cache">💾 本地缓存</button>
        </div>
    </div>
    <div class="bl-section-label">工具</div>
    <div class="bl-btn-row">
        <button class="bl-btn bl-btn-ghost" id="bl-btn-details">📋 记录</button>
        <button class="bl-btn bl-btn-ghost" id="bl-btn-reset">🔄 重置</button>
    </div>
    <div class="bl-dropdown">
        <button class="bl-btn bl-btn-ghost" id="bl-btn-uid-mgr">🔢 UID 管理 ▾</button>
        <div class="bl-dropdown-menu" id="bl-menu-uid-mgr">
            <button class="bl-dropdown-item" data-action="uid-check">🔍 UID 查重</button>
            <button class="bl-dropdown-item" data-action="import-uids">📥 导入 UID</button>
            <button class="bl-dropdown-item" data-action="export-uids">📤 导出 UID</button>
        </div>
    </div>
    <div class="bl-dropdown" style="margin-top:8px">
        <button class="bl-btn bl-btn-purple" id="bl-btn-manager">📝 黑名单管理 ▾</button>
        <div class="bl-dropdown-menu" id="bl-menu-manager">
            <button class="bl-dropdown-item" data-action="my-blacklist">📝 我的B站黑名单</button>
            <button class="bl-dropdown-item" data-action="export-my-blacklist">🧾 导出我的B站黑名单</button>
        </div>
    </div>
    <div class="bl-dropdown" style="margin-top:8px">
        <button class="bl-btn bl-btn-ghost" id="bl-btn-secret" style="font-size:12px">👀 只有我知道 ▾</button>
        <div class="bl-dropdown-menu" id="bl-menu-secret">
            <button class="bl-dropdown-item" data-action="github">🔗 GitHub</button>
            <button class="bl-dropdown-item" data-action="bilibili">📺 bilibili</button>
        </div>
    </div>
</div>`;

            document.body.appendChild(panel);
            UI._bindPanelEvents(panel);
        },

        _bindPanelEvents(panel) {
            const closeAllMenus = () => { panel.querySelectorAll('.bl-dropdown-menu').forEach(m => m.classList.remove('bl-open')); };
            const toggleMenu = (menuId) => {
                const menu = document.getElementById(menuId); if (!menu) return;
                const isOpen = menu.classList.contains('bl-open');
                closeAllMenus();
                if (!isOpen) menu.classList.add('bl-open');
            };

            document.getElementById('bl-btn-close').addEventListener('click', () => { panel.classList.add('bl-closing'); panel.addEventListener('animationend', () => { panel.remove(); UI.createFloatingButton(); }, { once: true }); });

            document.getElementById('bl-btn-batch').addEventListener('click', () => {
                if (!BatchState.running) {
                    if (!BatchState.canStart('开始批量拉黑')) return;
                    if (!Auth.isLoggedIn()) { alert('请先登录B站账号！'); return; }
                    if (BatchState.finished) { Progress.clear(); BatchState.finished = false; }
                    batchBlock(Progress.normalize(Progress.get()));
                } else {
                    if (BatchState.paused && !BatchState.canStart('继续批量拉黑')) return;
                    BatchState.paused = !BatchState.paused;
                    UI.updateBatchButton(); UI.updateStatusDisplay();
                    Notify.show(BatchState.paused ? '已暂停' : '已继续', BatchState.paused ? '批量拉黑已暂停，可随时点击继续' : '批量拉黑已继续执行');
                }
            });

            document.getElementById('bl-btn-refresh').addEventListener('click', e => { e.stopPropagation(); toggleMenu('bl-menu-refresh'); });
            document.getElementById('bl-btn-manager').addEventListener('click', e => { e.stopPropagation(); toggleMenu('bl-menu-manager'); });
            document.getElementById('bl-btn-uid-mgr').addEventListener('click', e => { e.stopPropagation(); toggleMenu('bl-menu-uid-mgr'); });
            document.getElementById('bl-btn-secret').addEventListener('click', e => { e.stopPropagation(); toggleMenu('bl-menu-secret'); });
            document.addEventListener('click', closeAllMenus);

            panel.querySelectorAll('.bl-dropdown-item').forEach(item => {
                item.addEventListener('click', e => {
                    e.stopPropagation(); closeAllMenus();
                    const action = item.dataset.action;
                    if (action === 'refresh-remote') UI._handleRefresh(async () => { let uids = await BlacklistData.fetchFromPublicApi(); let src = 'A盾黑名单(主源)'; if (!uids || uids.length === 0) { uids = await BlacklistData.loadBackupAShield(); src = 'A盾黑名单(备用源)'; } return { uids, source: src }; }, 'A盾黑名单');
                    else if (action === 'refresh-xianlists') UI._handleRefresh(BlacklistData.loadXianJunList, 'XianLists');
                    else if (action === 'refresh-live-robot') UI._handleRefresh(BlacklistData.loadLiveRoomRobotList, '直播间机器人');
                    else if (action === 'refresh-cache') {
                        const cached = Store.getJson(Config.CACHE_KEY);
                        if (cached && cached.length > 0) { BlacklistData.setUids(cached, '本地缓存'); BatchState.finished = false; BatchState.paused = false; Progress.clear(); panel.remove(); UI.createControlPanel(); Notify.show('数据刷新', `✅ 使用本地缓存数据\n${cached.length} 条数据`); }
                        else Notify.show('数据刷新失败', '❌ 本地缓存为空', 'error');
                    }
                    else if (action === 'uid-check') { if (!BatchState.canStart('UID查重')) return; UI.showUidCheckDialog(); }
                    else if (action === 'import-uids') { if (!BatchState.canStart('导入 UID')) return; UI.showImportUidDialog(); }
                    else if (action === 'export-uids') UI.exportBlacklistUids();
                    else if (action === 'my-blacklist') window.open('https://account.bilibili.com/account/blacklist', '_blank');
                    else if (action === 'export-my-blacklist') UI.exportMyBilibiliBlacklist();
                    else if (action === 'github') window.open(Config.GITHUB_URL, '_blank');
                    else if (action === 'bilibili') window.open('https://space.bilibili.com/454023591', '_blank');
                });
            });

            document.getElementById('bl-btn-details').addEventListener('click', () => UI.showDetailsPanel());
            document.getElementById('bl-btn-reset').addEventListener('click', () => { if (confirm('确定要重置进度吗？这将从第一个用户重新开始。')) { Progress.clear(); location.reload(); } });
        },

        async _handleRefresh(loadFn, sourceLabel) {
            if (!BatchState.canStart('刷新数据')) return;
            const elapsed = Date.now() - BatchState.lastRefreshTime;
            if (elapsed < Config.REFRESH_COOLDOWN) { Notify.show('刷新冷却中', `请等待 ${Math.ceil((Config.REFRESH_COOLDOWN - elapsed) / 1000)} 秒后再刷新`, 'warning'); return; }
            const btn = document.getElementById('bl-btn-refresh');
            const orig = btn.innerHTML; btn.innerHTML = '<span class="bl-spinner"></span>刷新中...'; btn.disabled = true;
            BatchState.isRefreshing = true; BatchState.shouldStop = true;
            try {
                const result = await loadFn();
                const uids = Array.isArray(result) ? result : (result && result.uids);
                if (uids && uids.length > 0) {
                    BlacklistData.setUids(uids, sourceLabel); BatchState.finished = false; BatchState.paused = false;
                    BatchState.lastRefreshTime = Date.now(); BlacklistData.saveCache(); Progress.clear();
                    console.log(`✅ 成功从 ${sourceLabel} 获取 ${uids.length} 条黑名单数据`);
                    const panel = document.getElementById(Config.PANEL_ID); if (panel) panel.remove(); UI.createControlPanel();
                    Notify.show('数据刷新', `✅ 成功从 ${sourceLabel} 获取\n${uids.length} 条数据`, 'success');
                } else throw new Error('未找到UID数据');
            } catch (e) {
                console.warn(`⚠️ 从${sourceLabel}获取黑名单失败:`, e);
                Notify.show('数据刷新失败', `❌ 从${sourceLabel}获取数据失败: ${e.message}`, 'error');
            } finally { btn.innerHTML = orig; btn.disabled = false; BatchState.isRefreshing = false; BatchState.shouldStop = false; }
        },

        exportBlacklistUids() {
            if (!BlacklistData.uids.length) { alert('当前没有可导出的 UID'); return; }
            const blob = new Blob([BlacklistData.uids.join('\n')], { type: 'text/plain;charset=utf-8' });
            const url = URL.createObjectURL(blob); const a = document.createElement('a');
            a.href = url; a.download = 'blacklist-uids-' + new Date().toISOString().slice(0, 10) + '.txt';
            a.style.display = 'none'; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
            Notify.show('导出成功', `已下载 ${BlacklistData.uids.length} 条 UID`, 'success');
        },

        async exportMyBilibiliBlacklist() {
            if (!Auth.isLoggedIn()) { alert('请先登录B站账号！'); return; }
            try {
                const records = await BiliApi.fetchAllMyBlacks(); if (!records.length) { alert('当前账号黑名单为空，未导出文件。'); return; }
                const blob = new Blob([records.map(r => String(r.uid)).join('\n')], { type: 'text/plain;charset=utf-8' });
                const url = URL.createObjectURL(blob); const a = document.createElement('a');
                a.href = url; a.download = 'bilibili-my-blacklist-uids-' + new Date().toISOString().slice(0, 10) + '.txt';
                a.style.display = 'none'; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
                Notify.show('导出成功', `已导出你账号黑名单 ${records.length} 条 UID`, 'success');
            } catch (e) { console.error('❌ 导出 B站账号黑名单失败:', e); alert(`导出失败：${e && e.message ? e.message : '未知错误'}`); }
        },

        showDetailsPanel() {
            const existing = document.getElementById(Config.DETAILS_OVERLAY_ID); if (existing) existing.remove();
            UI.ensureStyle();
            const overlay = document.createElement('div'); overlay.id = Config.DETAILS_OVERLAY_ID; overlay.className = 'bl-overlay bl-root';
            const box = document.createElement('div'); box.className = 'bl-dialog'; box.style.maxWidth = '720px'; box.style.maxHeight = '85vh';
            const stats = BlockLog.getStats();

            const header = document.createElement('div'); header.className = 'bl-dialog-header';
            header.innerHTML = `<h3>📋 拉黑详细记录</h3><button class="bl-dialog-close">×</button>`;
            header.querySelector('.bl-dialog-close').addEventListener('click', () => overlay.remove());

            const statsLine = document.createElement('div'); statsLine.style.cssText = 'padding:8px 20px;font-size:12px;color:var(--bl-text-secondary);border-bottom:1px solid var(--bl-border);background:var(--bl-bg-hover)';
            statsLine.innerHTML = `总计: ${stats.total} · <span style="color:var(--bl-success)">成功: ${stats.success}</span> · <span style="color:var(--bl-danger)">失败: ${stats.failed}</span> · <span style="color:var(--bl-cyan)">跳过: ${stats.skipped}</span> · <span style="color:var(--bl-warning)">错误: ${stats.error}</span> · <span style="color:var(--bl-text-muted)">撤销: ${stats.undone}</span>`;

            const filterBar = document.createElement('div'); filterBar.className = 'bl-filter-bar'; filterBar.style.cssText = 'padding:10px 20px;border-bottom:1px solid var(--bl-border)';
            const filters = [{ key: 'all', label: '全部' }, { key: 'success', label: '成功' }, { key: 'failed', label: '失败' }, { key: 'skipped', label: '跳过' }, { key: 'undone', label: '撤销' }, { key: 'error', label: '错误' }];
            let currentFilter = 'all'; const filterBtns = {};
            const listWrap = document.createElement('div'); listWrap.style.cssText = 'flex:1;overflow-y:auto;max-height:50vh';

            function renderList() {
                listWrap.innerHTML = '';
                const items = (currentFilter === 'all' ? [...BlockLog.getAll()] : BlockLog.getAll().filter(e => e.status === currentFilter)).reverse();
                if (!items.length) { listWrap.innerHTML = '<div style="text-align:center;padding:40px;color:var(--bl-text-muted);font-size:14px">暂无记录</div>'; return; }
                const table = document.createElement('table'); table.className = 'bl-log-table';
                const thead = document.createElement('thead'); thead.innerHTML = `<tr><th>序号</th><th>时间</th><th>UID</th><th>状态</th><th>详情</th></tr>`;
                const tbody = document.createElement('tbody');
                const badgeMap = { success: 'bl-badge-success', failed: 'bl-badge-failed', skipped: 'bl-badge-skipped', error: 'bl-badge-error', undone: 'bl-badge-undone' };
                const labelMap = { success: '成功', failed: '失败', skipped: '跳过', error: '错误', undone: '已撤销' };
                for (const e of items) {
                    const tr = document.createElement('tr');
                    tr.innerHTML = `<td>${e.index}/${e.total}</td><td style="font-size:11px">${e.timestamp}</td><td><a href="https://space.bilibili.com/${e.uid}" target="_blank" rel="noopener" style="font-family:var(--bl-mono);color:var(--bl-primary);text-decoration:none">${e.uid}</a></td><td><span class="bl-badge ${badgeMap[e.status] || ''}">${labelMap[e.status] || e.status}</span></td><td style="font-size:11px">${e.message || '-'}</td>`;
                    tbody.appendChild(tr);
                }
                table.appendChild(thead); table.appendChild(tbody); listWrap.appendChild(table);
            }

            filters.forEach(f => {
                const btn = document.createElement('button'); btn.className = 'bl-filter-btn' + (f.key === 'all' ? ' bl-active' : ''); btn.textContent = f.label;
                btn.addEventListener('click', () => { currentFilter = f.key; Object.keys(filterBtns).forEach(k => filterBtns[k].classList.toggle('bl-active', k === currentFilter)); renderList(); });
                filterBtns[f.key] = btn; filterBar.appendChild(btn);
            });
            const clearBtn = document.createElement('button'); clearBtn.className = 'bl-filter-btn'; clearBtn.textContent = '🗑️ 清空'; clearBtn.style.cssText = 'color:var(--bl-danger);border-color:var(--bl-danger)';
            clearBtn.addEventListener('click', () => { if (confirm('确定要清空所有记录吗？')) { BlockLog.clear(); renderList(); } });
            const undoAllBtn = document.createElement('button'); undoAllBtn.className = 'bl-filter-btn'; undoAllBtn.textContent = '↩ 撤销拉黑'; undoAllBtn.style.cssText = 'margin-left:auto;color:var(--bl-warning);border-color:var(--bl-warning)';
            undoAllBtn.addEventListener('click', async () => {
                if (BatchState.running && !BatchState.paused) { Notify.show('无法撤销', '批量拉黑运行中，请暂停或等待完成后再撤销', 'warning'); return; }
                const successEntries = BlockLog._entries.filter(e => e.status === 'success' && !e.undone);
                if (!successEntries.length) { Notify.show('无可撤销', '没有可以撤销的拉黑记录', 'warning'); return; }
                if (!confirm(`确定要撤销所有 ${successEntries.length} 条拉黑记录吗？（跳过的不会撤销）`)) return;
                undoAllBtn.textContent = '⏳ 撤销中...'; undoAllBtn.disabled = true;
                let undone = 0, failed = 0;
                for (const entry of successEntries) {
                    const result = await BiliApi.unblockUser(entry.uid);
                    if (result.success) { entry.undone = true; entry.status = 'undone'; entry.message = '已取消拉黑'; BlacklistData.myBlacks.delete(entry.uid); undone++; }
                    else { failed++; }
                }
                undoAllBtn.textContent = '↩ 撤销拉黑'; undoAllBtn.disabled = false;
                BlockLog._save();
                Notify.show('批量撤销完成', `撤销成功: ${undone}\n撤销失败: ${failed}`, undone > 0 ? 'success' : 'error');
                renderList();
            });
            filterBar.appendChild(undoAllBtn);
            filterBar.appendChild(clearBtn);
            renderList();

            box.appendChild(header); box.appendChild(statsLine); box.appendChild(filterBar); box.appendChild(listWrap);
            overlay.appendChild(box); document.body.appendChild(overlay);
            overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
        },

        showUidCheckDialog() {
            const existing = document.getElementById(Config.UID_CHECK_OVERLAY_ID); if (existing) existing.remove();
            UI.ensureStyle();
            const overlay = document.createElement('div'); overlay.id = Config.UID_CHECK_OVERLAY_ID; overlay.className = 'bl-overlay bl-root';
            const box = document.createElement('div'); box.className = 'bl-dialog'; box.style.maxWidth = '460px';

            const header = document.createElement('div'); header.className = 'bl-dialog-header';
            header.innerHTML = `<h3>🔍 UID 查重</h3><button class="bl-dialog-close">×</button>`;
            header.querySelector('.bl-dialog-close').addEventListener('click', () => overlay.remove());

            const body = document.createElement('div'); body.className = 'bl-dialog-body';
            const hint = document.createElement('div'); hint.className = 'bl-hint'; hint.textContent = '每行一个UID，或用逗号、分号分隔；也可粘贴个人空间链接，或选择txt文件导入。';
            const ta = document.createElement('textarea'); ta.className = 'bl-textarea'; ta.placeholder = '例如：\n123456789\nhttps://space.bilibili.com/987654321';
            const fileInput = document.createElement('input'); fileInput.type = 'file'; fileInput.accept = '.txt,text/plain'; fileInput.style.display = 'none';
            const resultDiv = document.createElement('div'); resultDiv.className = 'bl-result-box'; resultDiv.style.display = 'none'; resultDiv.style.marginTop = '10px';

            body.appendChild(hint); body.appendChild(ta); body.appendChild(fileInput); body.appendChild(resultDiv);

            const footer = document.createElement('div'); footer.className = 'bl-dialog-footer';
            const pickFileBtn = document.createElement('button'); pickFileBtn.className = 'bl-btn bl-btn-ghost'; pickFileBtn.innerHTML = '📄 选择文件';
            const exportBtn = document.createElement('button'); exportBtn.className = 'bl-btn bl-btn-ghost'; exportBtn.textContent = '📋 导出结果'; exportBtn.disabled = true;
            const checkBtn = document.createElement('button'); checkBtn.className = 'bl-btn bl-btn-primary'; checkBtn.textContent = '检查';

            pickFileBtn.addEventListener('click', () => fileInput.click());
            fileInput.addEventListener('change', function () { const file = this.files && this.files[0]; if (!file) return; const reader = new FileReader(); reader.onload = () => { ta.value = String(reader.result || ''); }; reader.readAsText(file, 'UTF-8'); });

            checkBtn.addEventListener('click', () => {
                const text = ta.value.trim(); resultDiv.style.display = 'block';
                if (!text) { resultDiv.className = 'bl-result-box bl-error'; resultDiv.textContent = '❌ 请输入UID或选择文件'; return; }
                const uids = new Set(); const uidPattern = /(?:space\.bilibili\.com\/|uid[:：]\s*)?(\d+)/gi;
                for (const line of text.split(/[\n\r]+/)) { const trimmed = line.trim(); if (!trimmed || trimmed.startsWith('#')) continue; let m; while ((m = uidPattern.exec(trimmed)) !== null) { const uid = parseInt(m[1], 10); if (!isNaN(uid) && uid > 0) uids.add(uid); } }
                if (uids.size === 0) { resultDiv.className = 'bl-result-box bl-error'; resultDiv.textContent = '❌ 未找到有效的UID'; return; }
                let inBlacklist = 0, notInBlacklist = 0; const inList = [], notInList = [];
                for (const uid of uids) { if (BlacklistData.uidSet.has(uid)) { inBlacklist++; inList.push(uid); } else { notInBlacklist++; notInList.push(uid); } }
                let html = `<strong>检查结果</strong><br>✅ 在黑名单中：<strong style="color:var(--bl-success)">${inBlacklist}</strong> 个<br>❌ 不在黑名单中：<strong style="color:var(--bl-warning)">${notInBlacklist}</strong> 个<br>总计：<strong>${uids.size}</strong> 个`;
                if (inList.length > 0) html += `<div style="margin-top:8px;padding-top:8px;border-top:1px solid var(--bl-border)"><strong>在黑名单中：</strong><div style="font-family:var(--bl-mono);font-size:11px;color:var(--bl-success);word-break:break-all">${inList.map(escapeHtml).join(', ')}</div></div>`;
                if (notInList.length > 0) html += `<div style="margin-top:8px;padding-top:8px;border-top:1px solid var(--bl-border)"><strong>不在黑名单中：</strong><div style="font-family:var(--bl-mono);font-size:11px;color:var(--bl-warning);word-break:break-all">${notInList.map(escapeHtml).join(', ')}</div></div>`;
                resultDiv.className = 'bl-result-box'; resultDiv.innerHTML = html; resultDiv.style.maxHeight = '30vh';
                exportBtn.disabled = false;
                exportBtn.onclick = () => {
                    const lines = ['检查结果', `在黑名单中: ${inBlacklist} 个`, `不在黑名单中: ${notInBlacklist} 个`, `总计: ${uids.size} 个`, ''];
                    if (inList.length > 0) { lines.push('=== 在黑名单中的UID ==='); inList.forEach(uid => lines.push(uid)); lines.push(''); }
                    if (notInList.length > 0) { lines.push('=== 不在黑名单中的UID ==='); notInList.forEach(uid => lines.push(uid)); }
                    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'uid_check_result.txt'; a.click(); URL.revokeObjectURL(url);
                };
            });

            footer.appendChild(pickFileBtn); footer.appendChild(exportBtn); footer.appendChild(checkBtn);
            box.appendChild(header); box.appendChild(body); box.appendChild(footer); overlay.appendChild(box); document.body.appendChild(overlay);
            ta.focus(); overlay.addEventListener('mousedown', e => { if (e.target === overlay) { overlay._blClose = true; } });
            overlay.addEventListener('mouseup', e => { if (e.target === overlay && overlay._blClose) { overlay.remove(); } overlay._blClose = false; });
        },

        showImportUidDialog() {
            const existing = document.getElementById(Config.IMPORT_OVERLAY_ID); if (existing) existing.remove();
            UI.ensureStyle();
            const overlay = document.createElement('div'); overlay.id = Config.IMPORT_OVERLAY_ID; overlay.className = 'bl-overlay bl-root';
            const box = document.createElement('div'); box.className = 'bl-dialog'; box.style.maxWidth = '440px'; box.style.maxHeight = '90vh';

            const header = document.createElement('div'); header.className = 'bl-dialog-header';
            header.innerHTML = `<h3>📥 导入 UID</h3><button class="bl-dialog-close">×</button>`;
            header.querySelector('.bl-dialog-close').addEventListener('click', () => overlay.remove());

            const body = document.createElement('div'); body.className = 'bl-dialog-body';
            const hint = document.createElement('div'); hint.className = 'bl-hint'; hint.textContent = '每行一个 UID，或用逗号、分号分隔；也可粘贴个人空间链接。导入后将替换当前列表并清零拉黑进度。';
            const ta = document.createElement('textarea'); ta.className = 'bl-textarea'; ta.style.minHeight = '160px'; ta.placeholder = '例如：\n123456789\nhttps://space.bilibili.com/987654321';
            const fileInput = document.createElement('input'); fileInput.type = 'file'; fileInput.accept = '.txt,text/plain'; fileInput.style.display = 'none';
            body.appendChild(hint); body.appendChild(ta); body.appendChild(fileInput);

            const footer = document.createElement('div'); footer.className = 'bl-dialog-footer';
            const pickFileBtn = document.createElement('button'); pickFileBtn.className = 'bl-btn bl-btn-ghost'; pickFileBtn.innerHTML = '📄 选择文件';
            const okBtn = document.createElement('button'); okBtn.className = 'bl-btn bl-btn-primary'; okBtn.textContent = '导入';

            pickFileBtn.addEventListener('click', () => fileInput.click());
            fileInput.addEventListener('change', function () { const file = this.files && this.files[0]; if (!file) return; const reader = new FileReader(); reader.onload = () => { ta.value = String(reader.result || ''); }; reader.readAsText(file, 'UTF-8'); this.value = ''; });
            okBtn.addEventListener('click', () => {
                const uids = BlacklistData.parseUidsFromText(ta.value);
                if (uids.length === 0) { alert('未能解析出任何 UID，请检查格式。'); return; }
                if (!confirm(`将使用 ${uids.length} 条 UID 替换当前列表，并清零拉黑进度。确定？`)) return;
                BlacklistData.applyImported(uids); overlay.remove();
                const panel = document.getElementById(Config.PANEL_ID); if (panel) panel.remove(); UI.createControlPanel();
                Notify.show('导入成功', `已载入 ${uids.length} 条 UID`, 'success');
            });

            footer.appendChild(pickFileBtn); footer.appendChild(okBtn);
            box.appendChild(header); box.appendChild(body); box.appendChild(footer); overlay.appendChild(box); document.body.appendChild(overlay);
            ta.focus(); overlay.addEventListener('mousedown', e => { if (e.target === overlay) { overlay._blClose = true; } });
            overlay.addEventListener('mouseup', e => { if (e.target === overlay && overlay._blClose) { overlay.remove(); } overlay._blClose = false; });
        }
    };

    const Disclaimer = {
        hasAgreed() { if (typeof GM_getValue !== 'undefined') { const v = GM_getValue(Config.DISCLAIMER_KEY); if (v === 'true') return true; } return localStorage.getItem(Config.DISCLAIMER_KEY) === 'true'; },
        show() {
            UI.ensureStyle();
            const overlay = document.createElement('div'); overlay.id = Config.DISCLAIMER_OVERLAY_ID; overlay.className = 'bl-overlay bl-root';
            const box = document.createElement('div'); box.className = 'bl-dialog'; box.style.maxWidth = '480px'; box.style.maxHeight = '80vh';

            const header = document.createElement('div'); header.className = 'bl-dialog-header';
            header.innerHTML = `<h3>⚠️ 免责声明</h3>`;

            const body = document.createElement('div'); body.className = 'bl-dialog-body';
            body.innerHTML = `<div class="bl-disclaimer"><p>本脚本仅用于辅助管理 B 站黑名单，请勿用于任何违法或滥用目的。</p><p>使用本脚本时，请遵守以下规则：</p><ol><li>请勿频繁操作，以免触发 B 站风控机制</li><li>仅拉黑确实需要拉黑的用户，避免误操作</li><li>尊重他人合法权益，不进行恶意拉黑</li><li>使用本脚本产生的一切后果由用户自行承担</li></ol><p>请确认您已了解并同意上述声明，否则请不要使用本脚本。</p></div>`;

            return new Promise(resolve => {
                const footer = document.createElement('div'); footer.className = 'bl-dialog-footer';
                const cancelBtn = document.createElement('button'); cancelBtn.className = 'bl-btn bl-btn-ghost'; cancelBtn.textContent = '不同意'; cancelBtn.style.flex = '1';
                cancelBtn.addEventListener('click', () => { overlay.remove(); resolve(false); });
                const agreeBtn = document.createElement('button'); agreeBtn.className = 'bl-btn bl-btn-primary'; agreeBtn.textContent = '我同意'; agreeBtn.style.flex = '1';
                agreeBtn.addEventListener('click', () => { overlay.remove(); Store.setRaw(Config.DISCLAIMER_KEY, 'true'); resolve(true); });
                footer.appendChild(cancelBtn); footer.appendChild(agreeBtn);
                box.appendChild(header); box.appendChild(body); box.appendChild(footer); overlay.appendChild(box); document.body.appendChild(overlay);
                overlay.addEventListener('click', e => { if (e.target === overlay) { overlay.remove(); resolve(false); } });
            });
        }
    };

    async function init() {
        console.log('🛡️ B站A盾黑名单拉黑助手已加载');
        BlockLog._load();
        if (!Disclaimer.hasAgreed()) { const agreed = await Disclaimer.show(); if (!agreed) { console.log('用户不同意免责声明，脚本将不加载'); return; } }
        await BlacklistData.loadXianJunList();
        if (BlacklistData.isCurrentUserXianJun()) { console.log('nyan'); window.open(Config.NYAN_URL, '_blank'); return; }
        if (!BlacklistData.loadFromCache()) { BlacklistData.setUids([], '无数据'); console.log('⚠️ 无本地缓存数据，请手动刷新获取黑名单'); }
        console.log(`📋 数据来源: ${BlacklistData.source}，共 ${BlacklistData.uids.length} 条`);
        UI.createFloatingButton();
        if (typeof GM_registerMenuCommand !== 'undefined') {
            GM_registerMenuCommand('🔄 初始化脚本', () => {
                if (!confirm('确定要初始化脚本吗？这将清除所有本地数据（进度、缓存、免责声明状态）并重新加载页面。')) return;
                const keys = [Config.STORAGE_KEY, Config.CACHE_KEY, Config.DISCLAIMER_KEY, Config.LOG_CACHE_KEY];
                keys.forEach(k => {
                    if (typeof GM_setValue !== 'undefined') { try { GM_setValue(k, ''); } catch (_) {} }
                    try { localStorage.removeItem(k); } catch (_) {}
                });
                location.reload();
            });
        }
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();
