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
        PANEL_ID: 'bilibili-blacklist-panel',
        FLOATING_BTN_ID: 'bilibili-blacklist-btn',
        TIP_ID: 'bilibili-blacklist-tip',
        BLOCKED_TIP_ID: 'bilibili-blacklist-blocked-tip',
        STYLE_ID: 'bilibili-blacklist-style',
        DETAILS_OVERLAY_ID: 'bilibili-blacklist-details-overlay',
        UID_CHECK_OVERLAY_ID: 'bilibili-blacklist-uid-check-overlay',
        IMPORT_OVERLAY_ID: 'bilibili-blacklist-import-overlay',
        DISCLAIMER_OVERLAY_ID: 'bilibili-blacklist-disclaimer',
        GITHUB_URL: 'https://github.com/Shiroha23/bilibili-a-shield-blacklist',
        NYAN_URL: 'https://www.nyan.cat/',
    });

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
                        method: 'GET',
                        url,
                        headers: { 'Accept': 'application/json, text/html;q=0.9, */*;q=0.8' },
                        timeout,
                        onload(res) {
                            if (res.status >= 200 && res.status < 300) resolve(res.responseText);
                            else reject(new Error(`HTTP ${res.status}`));
                        },
                        onerror() { reject(new Error('网络请求失败')); },
                        ontimeout() { reject(new Error('请求超时')); }
                    });
                });
            }
            const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
            let tid = null;
            if (controller) tid = setTimeout(() => controller.abort(), timeout);
            return fetch(url, {
                mode: 'cors', credentials: 'omit',
                headers: { 'Accept': 'application/json, text/html;q=0.9, */*;q=0.8' },
                signal: controller ? controller.signal : undefined
            }).then(r => {
                if (!r.ok) throw new Error(`HTTP ${r.status}`);
                return r.text();
            }).catch(err => {
                if (err && err.name === 'AbortError') throw new Error('请求超时');
                throw err;
            }).finally(() => { if (tid !== null) clearTimeout(tid); });
        }
    };

    const Auth = {
        getCsrfToken() {
            const m = document.cookie.match(/bili_jct=([^;]+)/);
            return m ? m[1] : '';
        },
        getCurrentUid() {
            const m = document.cookie.match(/DedeUserID=([^;]+)/);
            return m ? m[1] : '';
        },
        isLoggedIn() {
            return !!Auth.getCurrentUid();
        }
    };

    const BlacklistData = {
        uids: [],
        uidSet: new Set(),
        source: '无数据',
        myBlacks: new Set(),
        xianJunUids: new Set(),
        xianJunCheckComplete: false,

        syncSet() {
            BlacklistData.uidSet = new Set(BlacklistData.uids);
        },

        setUids(uids, source) {
            BlacklistData.uids = uids;
            BlacklistData.source = source;
            BlacklistData.syncSet();
        },

        async fetchFromPublicApi() {
            const limit = Config.API_PAGE_SIZE;
            const seen = new Set();
            const uids = [];
            let offset = 0;
            let hasMore = true;
            let pageCount = 0;

            while (hasMore && pageCount < Config.MAX_API_PAGES) {
                pageCount++;
                const url = Config.BLACKLIST_API_URL + '?' + new URLSearchParams({ offset: String(offset), limit: String(limit) }).toString();
                const text = await Http.fetchText(url);
                let data;
                try { data = JSON.parse(text); } catch (_) { throw new Error('API 返回非 JSON'); }
                if (!data.success || !Array.isArray(data.list)) {
                    throw new Error(data.error || '无法解析黑名单 API 响应');
                }
                for (let i = 0; i < data.list.length; i++) {
                    const raw = data.list[i] && data.list[i].uid;
                    const uid = raw != null ? parseInt(String(raw), 10) : NaN;
                    if (Number.isFinite(uid) && !seen.has(uid)) { seen.add(uid); uids.push(uid); }
                }
                if (data.list.length === 0) break;
                offset += data.list.length;
                hasMore = Boolean(data.hasMore) && data.list.length > 0;
            }
            return uids;
        },

        async loadBackupAShield() {
            try {
                const text = await Http.fetchText('https://raw.githubusercontent.com/Shiroha23/bilibili-a-shield-blacklist/main/bilibili-a-shield-blacklist-uids/bilibili-a-shield-blacklist-uids.txt');
                const uids = [];
                for (const line of text.split('\n')) {
                    const trimmed = line.trim();
                    if (trimmed && !trimmed.startsWith('#')) {
                        const uid = parseInt(trimmed, 10);
                        if (!isNaN(uid) && uid > 0) uids.push(uid);
                    }
                }
                console.log(`✅ 备用A盾黑名单列表加载完成，共 ${uids.length} 条`);
                return uids;
            } catch (e) {
                console.warn('⚠️ 加载备用A盾黑名单列表失败:', e);
                return null;
            }
        },

        async loadXianJunList() {
            try {
                let text;
                let sourceName = 'XianLists(主源)';
                try {
                    text = await Http.fetchText('https://gcore.jsdelivr.net/gh/Darknights1750/XianLists@main/xianLists.json', 5000);
                } catch (_) {
                    text = await Http.fetchText('https://raw.githubusercontent.com/Shiroha23/bilibili-a-shield-blacklist/main/bilibili-xianLists-uids/xianLists.json', 5000);
                    sourceName = 'XianLists(备用源)';
                }
                const data = JSON.parse(text);
                BlacklistData.xianJunUids.clear();
                const all = [...(data.xianList || []), ...(data.xianLv1List || []), ...(data.xianLv2List || []), ...(data.xianLv3List || [])];
                for (const uid of all) BlacklistData.xianJunUids.add(String(uid));
                console.log(`✅ XianLists列表加载完成，共 ${BlacklistData.xianJunUids.size} 条，来源：${sourceName}`);
                const uids = Array.from(BlacklistData.xianJunUids, uid => parseInt(uid, 10)).filter(uid => Number.isFinite(uid) && uid > 0);
                return { uids, source: sourceName };
            } catch (e) {
                console.warn('⚠️ 加载XianLists列表失败:', e);
                return null;
            } finally {
                BlacklistData.xianJunCheckComplete = true;
            }
        },

        isCurrentUserXianJun() {
            const uid = Auth.getCurrentUid();
            return uid ? BlacklistData.xianJunUids.has(uid) : false;
        },

        async loadLiveRoomRobotList() {
            try {
                const text = await Http.fetchText('https://raw.githubusercontent.com/Shiroha23/bilibili-a-shield-blacklist/main/bilibili-live-room-robot-blacklist-uids/bilibili-live-room-robot-blacklist-uids.txt');
                const uids = [];
                const seen = new Set();
                const re = /space\.bilibili\.com\/(\d+)/;
                for (let line of text.split('\n')) {
                    line = line.trim();
                    if (line && !line.startsWith('#')) {
                        const m = re.exec(line);
                        if (m) {
                            const uid = parseInt(m[1], 10);
                            if (!isNaN(uid) && uid > 0 && !seen.has(uid)) { seen.add(uid); uids.push(uid); }
                        }
                    }
                }
                console.log(`✅ 直播间机器人列表加载完成，共 ${uids.length} 条`);
                return uids;
            } catch (e) {
                console.warn('⚠️ 加载直播间机器人列表失败:', e);
                return null;
            }
        },

        async fetchRemote() {
            try {
                console.log('🔄 正在从 listing.ssrv2.ltd API 获取黑名单数据...');
                let uids = await BlacklistData.fetchFromPublicApi();
                let sourceName = 'A盾黑名单(主源)';
                if (!uids || uids.length === 0) {
                    console.log('⚠️ 主源失败，尝试备用源...');
                    uids = await BlacklistData.loadBackupAShield();
                    sourceName = 'A盾黑名单(备用源)';
                }
                if (uids && uids.length > 0) {
                    BlacklistData.setUids(uids, 'A盾黑名单');
                    Store.set(Config.CACHE_KEY, uids);
                    console.log(`✅ 成功从 ${sourceName} 获取 ${uids.length} 条黑名单数据`);
                    return { success: true, fromRemote: true, count: uids.length };
                }
                throw new Error('未找到UID数据');
            } catch (e) {
                console.warn('⚠️ 从远程获取黑名单失败:', e);
                const cached = Store.getJson(Config.CACHE_KEY);
                if (cached && cached.length > 0) {
                    BlacklistData.setUids(cached, '本地缓存');
                    console.log(`✅ 使用本地缓存数据: ${cached.length} 条`);
                    return { success: true, fromCache: true, count: cached.length };
                }
                BlacklistData.setUids([], '无数据');
                console.log('⚠️ 无可用数据源');
                return { success: false, count: 0 };
            }
        },

        async loadMyBlacklist() {
            BlacklistData.myBlacks.clear();
            if (!Auth.isLoggedIn()) return false;
            try {
                console.log('🔄 正在加载我的黑名单...');
                const records = await BiliApi.fetchAllMyBlacks();
                for (const item of records) BlacklistData.myBlacks.add(item.uid);
                console.log(`✅ 我的黑名单加载完成，共 ${BlacklistData.myBlacks.size} 个用户`);
                return true;
            } catch (e) {
                console.warn('⚠️ 加载我的黑名单失败:', e);
                return false;
            }
        },

        isUserBlocked(uid) {
            return BlacklistData.myBlacks.has(uid);
        },

        saveCache() {
            Store.set(Config.CACHE_KEY, BlacklistData.uids);
        },

        loadFromCache() {
            const cached = Store.getJson(Config.CACHE_KEY);
            if (cached && cached.length > 0) {
                BlacklistData.setUids(cached, '本地缓存');
                return true;
            }
            return false;
        },

        parseUidsFromText(text) {
            const seen = new Set();
            const out = [];
            function add(uid) {
                if (typeof uid === 'number' && Number.isFinite(uid) && uid > 0 && !seen.has(uid)) {
                    seen.add(uid); out.push(uid);
                }
            }
            const linkRe = /space\.bilibili\.com\/(\d+)/gi;
            let m;
            while ((m = linkRe.exec(text)) !== null) add(parseInt(m[1], 10));
            for (const part of text.split(/[\n,;，；\r\t]+/)) {
                let p = part.trim();
                if (!p) continue;
                p = p.replace(/^UID[:\s：]*/i, '').trim();
                const digits = p.match(/^(\d{5,})$/);
                if (digits) add(parseInt(digits[1], 10));
            }
            return out;
        },

        applyImported(uids) {
            BlacklistData.setUids(uids, '用户导入');
            BlacklistData.saveCache();
            Progress.clear();
        }
    };

    const BiliApi = {
        async blockUser(uid) {
            const result = { success: false, message: '', code: null, data: null };
            const csrf = Auth.getCsrfToken();
            if (!csrf) {
                result.message = '无法获取CSRF Token';
                console.error('❌ ' + result.message);
                return result;
            }
            try {
                const resp = await fetch('https://api.bilibili.com/x/relation/modify', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'X-Requested-With': 'XMLHttpRequest', 'Referer': `https://space.bilibili.com/${uid}` },
                    credentials: 'include',
                    body: new URLSearchParams({ fid: uid.toString(), act: '5', re_src: '11', csrf })
                });
                const data = await resp.json();
                result.code = data.code;
                result.data = data;
                if (data.code === 0) {
                    result.success = true;
                    result.message = '拉黑成功';
                    console.log(`✅ 成功拉黑用户: ${uid}`);
                } else if (data.code === -101) {
                    result.message = '未登录或登录已过期';
                    console.error('❌ ' + result.message);
                } else if (data.code === -102) {
                    result.success = true;
                    result.message = '用户已经在黑名单中';
                    console.log(`⚠️ 用户 ${uid} 已经在黑名单中`);
                } else {
                    result.message = data.message || data.msg || `错误代码: ${data.code}`;
                    console.error(`❌ 拉黑用户失败，错误代码: ${data.code}`);
                }
            } catch (e) {
                result.message = e.message || '网络错误';
                console.error(`❌ 拉黑用户时出错:`, e.message);
            }
            return result;
        },

        async fetchAllMyBlacks() {
            const ps = Config.BILI_BLACKS_PAGE_SIZE;
            const seen = new Set();
            const out = [];
            let pn = 1;
            while (pn <= Config.MAX_API_PAGES) {
                const url = Config.BILI_BLACKS_API_URL + '?' + new URLSearchParams({ pn: String(pn), ps: String(ps) }).toString();
                const resp = await fetch(url, { method: 'GET', credentials: 'include', headers: { 'Accept': 'application/json, text/plain, */*' } });
                const data = await resp.json();
                if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
                if (!data || data.code !== 0) throw new Error((data && (data.message || data.msg)) || '接口返回异常');
                const payload = data.data || {};
                const list = Array.isArray(payload.list) ? payload.list : [];
                const total = Number.isFinite(payload.total) ? payload.total : null;
                for (const item of list) {
                    const uid = parseInt(String((item || {}).mid || (item || {}).uid || ''), 10);
                    if (Number.isFinite(uid) && !seen.has(uid)) { seen.add(uid); out.push({ uid, raw: item }); }
                }
                if (list.length < ps) break;
                if (total !== null && out.length >= total) break;
                pn++;
            }
            return out;
        }
    };

    const Progress = {
        save(index) { Store.setRaw(Config.STORAGE_KEY, String(index)); },
        get() {
            if (typeof GM_getValue !== 'undefined') {
                const v = GM_getValue(Config.STORAGE_KEY);
                if (v) return parseInt(v, 10);
            }
            const v = localStorage.getItem(Config.STORAGE_KEY);
            return v ? parseInt(v, 10) : 0;
        },
        clear() { Store.setRaw(Config.STORAGE_KEY, '0'); },
        normalize(startIndex) {
            const total = BlacklistData.uids.length;
            if (total <= 0) return 0;
            const n = Number.isFinite(startIndex) ? startIndex : parseInt(startIndex, 10);
            const resolved = Number.isFinite(n) ? n : 0;
            if (resolved >= total || resolved < 0) { Progress.clear(); return 0; }
            return resolved;
        }
    };

    const BlockLog = {
        _entries: [],
        add(entry) {
            BlockLog._entries.push({
                timestamp: new Date().toLocaleString(),
                uid: entry.uid,
                status: entry.status,
                message: entry.message || '',
                index: entry.index,
                total: entry.total
            });
            if (BlockLog._entries.length > Config.MAX_LOG_ENTRIES * 2) {
                BlockLog._entries = BlockLog._entries.slice(-Config.MAX_LOG_ENTRIES);
            }
        },
        clear() { BlockLog._entries = []; },
        getAll() { return BlockLog._entries; },
        getStats() {
            const s = { success: 0, failed: 0, skipped: 0, error: 0, total: BlockLog._entries.length };
            for (const e of BlockLog._entries) { if (s[e.status] !== undefined) s[e.status]++; }
            return s;
        }
    };

    const BatchState = {
        running: false,
        paused: false,
        finished: false,
        shouldStop: false,
        isRefreshing: false,
        lastRefreshTime: 0,
        skippedCount: 0,

        reset() {
            BatchState.running = false;
            BatchState.paused = false;
            BatchState.finished = false;
            BatchState.shouldStop = false;
            BatchState.skippedCount = 0;
        },

        canStart(actionLabel) {
            if (BatchState.isRefreshing) {
                Notify.show('操作被阻止', `${actionLabel}前请等待数据刷新完成`, false, '200px', Config.BLOCKED_TIP_ID, 5000);
                return false;
            }
            if (BatchState.running && !BatchState.paused) {
                Notify.show('操作被阻止', `${actionLabel}前请先暂停或等待当前批量拉黑结束`, false, '200px', Config.BLOCKED_TIP_ID, 5000);
                return false;
            }
            return true;
        }
    };

    function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

    async function batchBlock(startIndex = 0) {
        if (BatchState.isRefreshing) {
            Notify.show('操作被阻止', '开始批量拉黑前请等待数据刷新完成', false, '200px', Config.BLOCKED_TIP_ID, 5000);
            return;
        }
        if (BatchState.running) { alert('批量拉黑正在进行中，请等待当前任务结束。'); return; }
        if (!Auth.isLoggedIn()) { alert('请先登录B站账号！'); return; }

        BatchState.running = true;
        BatchState.finished = false;
        BatchState.skippedCount = 0;
        startIndex = Progress.normalize(startIndex);
        const total = BlacklistData.uids.length;
        let success = 0, failed = 0;
        let canSkip = false;

        const btn = document.getElementById('bl-control-batch');
        if (btn) { btn.innerHTML = '⏸️ 暂停批量拉黑'; btn.style.background = '#faad14'; }
        UI.updateStatusDisplay();

        try {
            if (Config.SKIP_ALREADY_BLOCKED) {
                canSkip = await BlacklistData.loadMyBlacklist();
                if (!canSkip) Notify.show('跳过检测不可用', '未能读取你的B站黑名单，本轮将继续尝试拉黑并自动识别已存在项');
            }

            console.log(`🚀 开始批量拉黑，从第 ${startIndex + 1} 个用户开始，共 ${total} 个用户，每批 ${Config.BATCH_SIZE} 个并发`);
            BlockLog.clear();

            if (canSkip) {
                const toSkip = [];
                for (let i = startIndex; i < total; i++) {
                    if (BlacklistData.isUserBlocked(BlacklistData.uids[i])) {
                        toSkip.push({ uid: BlacklistData.uids[i], index: i + 1 });
                    }
                }
                if (toSkip.length > 0) {
                    console.log(`⏩ 预检跳过 ${toSkip.length} 个已在黑名单中的用户`);
                    for (const s of toSkip) {
                        BlockLog.add({ uid: s.uid, status: 'skipped', message: '用户已在黑名单中', index: s.index, total });
                        BatchState.skippedCount++;
                    }
                    Notify.show('预检完成', `跳过 ${toSkip.length} 个已在黑名单中的用户`);
                }
            }

            const toProcess = [];
            for (let i = startIndex; i < total; i++) {
                const uid = BlacklistData.uids[i];
                if (canSkip && BlacklistData.isUserBlocked(uid)) continue;
                toProcess.push({ uid, globalIndex: i + 1 });
            }

            if (toProcess.length === 0) {
                console.log('✅ 所有用户已在黑名单中，无需操作');
                BatchState.finished = true;
                Notify.show('批量拉黑完成', `总计: ${total}\n跳过: ${BatchState.skippedCount}\n无需新增拉黑`, true);
                Progress.save(total);
                return;
            }

            console.log(`📋 需要拉黑 ${toProcess.length} 个用户（已跳过 ${BatchState.skippedCount} 个）`);

            for (let batchIdx = 0; batchIdx < toProcess.length; batchIdx += Config.BATCH_SIZE) {
                while (BatchState.paused) {
                    if (BatchState.shouldStop) { console.log('🛑 批量拉黑被终止'); return; }
                    console.log('⏸️ 批量拉黑已暂停，等待继续...');
                    await delay(1000);
                }
                if (BatchState.shouldStop) { console.log('🛑 批量拉黑被终止'); return; }

                const batchItems = toProcess.slice(batchIdx, batchIdx + Config.BATCH_SIZE);

                const batchResults = await Promise.all(batchItems.map(item => {
                    return BiliApi.blockUser(item.uid).then(r => {
                        if (r.code === -102) {
                            BlacklistData.myBlacks.add(item.uid);
                            return { uid: item.uid, globalIndex: item.globalIndex, status: 'skipped', message: r.message };
                        } else if (r.success) {
                            BlacklistData.myBlacks.add(item.uid);
                            return { uid: item.uid, globalIndex: item.globalIndex, status: 'success', message: r.message };
                        }
                        return { uid: item.uid, globalIndex: item.globalIndex, status: 'failed', message: r.message };
                    }).catch(e => ({ uid: item.uid, globalIndex: item.globalIndex, status: 'failed', message: e.message || '未知错误' }));
                }));

                for (const r of batchResults) {
                    BlockLog.add({ uid: r.uid, status: r.status, message: r.message, index: r.globalIndex, total });
                    if (r.status === 'success') success++;
                    else if (r.status === 'failed') failed++;
                    else if (r.status === 'skipped') BatchState.skippedCount++;
                }

                const processed = BatchState.skippedCount + success + failed;
                Progress.save(processed);
                UI.updateProgressDisplay();
                Notify.show('批量拉黑进度', `已处理: ${processed}/${total}\n成功: ${success}  失败: ${failed}\n跳过: ${BatchState.skippedCount}`);

                if (batchIdx + Config.BATCH_SIZE < toProcess.length) {
                    console.log(`⏳ 批次完成 (${processed}/${total})，等待 ${Config.BATCH_INTERVAL}ms 后继续...`);
                    await delay(Config.BATCH_INTERVAL);
                }
            }

            console.log(`✅ 批量拉黑完成！成功: ${success}, 失败: ${failed}, 跳过: ${BatchState.skippedCount}`);
            BatchState.finished = true;
            Notify.show('批量拉黑完成', `总计: ${total}\n成功: ${success}\n失败: ${failed}\n跳过: ${BatchState.skippedCount}`, true);
            if (success + failed + BatchState.skippedCount === total) Progress.save(total);
        } finally {
            BatchState.running = false;
            BatchState.paused = false;
            BatchState.shouldStop = false;
            const tip = document.getElementById(Config.BLOCKED_TIP_ID);
            if (tip) tip.remove();
            if (btn) {
                const p = Progress.get();
                btn.innerHTML = BatchState.finished ? '🔄 重新批量拉黑' : (p > 0 ? '▶️ 继续批量拉黑' : '▶️ 开始批量拉黑');
                btn.style.background = '#00a1d6';
            }
            UI.updateStatusDisplay();
        }
    }

    const Notify = {
        show(title, message, showSystem = false, topPosition, customId, displayTime) {
            if (showSystem && typeof GM_notification !== 'undefined') {
                GM_notification({ title, text: message });
            }
            Notify._floatingTip(title, message, topPosition, customId, displayTime);
        },
        _floatingTip(title, message, topPosition, customId, displayTime) {
            const tipId = customId || Config.TIP_ID;
            const existing = document.getElementById(tipId);
            if (existing) existing.remove();

            UI.ensureAnimationStyle();

            const tip = document.createElement('div');
            tip.id = tipId;
            tip.style.cssText = `position:fixed;top:${topPosition || '100px'};right:320px;background:linear-gradient(135deg,#00a1d6,#00b5e5);color:white;padding:15px 20px;border-radius:8px;box-shadow:0 4px 12px rgba(0,0,0,0.3);z-index:99999;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;max-width:300px;animation:slideIn 0.3s ease;`;

            const titleEl = document.createElement('div');
            titleEl.style.cssText = 'font-weight:bold;margin-bottom:8px;font-size:14px;';
            titleEl.textContent = title;

            const msgEl = document.createElement('div');
            msgEl.style.cssText = 'font-size:13px;line-height:1.5;white-space:pre-line;';
            msgEl.textContent = message;

            tip.appendChild(titleEl);
            tip.appendChild(msgEl);
            document.body.appendChild(tip);

            const timeout = displayTime || 5000;
            setTimeout(() => {
                tip.style.animation = 'slideIn 0.3s ease reverse';
                setTimeout(() => tip.remove(), 300);
            }, timeout);
        }
    };

    function escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = String(str);
        return div.innerHTML;
    }

    const UI = {
        ensureAnimationStyle() {
            if (document.getElementById(Config.STYLE_ID)) return;
            const style = document.createElement('style');
            style.id = Config.STYLE_ID;
            style.textContent = `@keyframes slideIn{from{transform:translateX(100%);opacity:0}to{transform:translateX(0);opacity:1}}`;
            document.head.appendChild(style);
        },

        updateStatusDisplay() {
            const el = document.getElementById('bl-current-status');
            if (!el) return;
            let text = '待运行', color = '#9499a0';
            if (BatchState.paused) { text = '已暂停'; color = '#faad14'; }
            else if (BatchState.running) { text = '运行中'; color = '#52c41a'; }
            else if (BatchState.finished) { text = '已完成'; color = '#13c2c2'; }
            el.textContent = text;
            el.style.color = color;
        },

        updateProgressDisplay() {
            const el = document.getElementById('bl-progress-display');
            if (el) {
                const p = Progress.get();
                el.innerHTML = `当前进度: <strong style="color: #00a1d6;">${p}</strong> / ${BlacklistData.uids.length}`;
            }
        },

        createFloatingButton() {
            if (document.getElementById(Config.FLOATING_BTN_ID)) return;
            const btn = document.createElement('button');
            btn.id = Config.FLOATING_BTN_ID;
            btn.innerHTML = '🛡️';
            btn.title = '打开B站A盾黑名单拉黑助手';
            btn.style.cssText = `position:fixed;top:100px;right:20px;width:50px;height:50px;border-radius:50%;background:linear-gradient(135deg,#00a1d6,#00b5e5);color:white;border:none;cursor:pointer;font-size:24px;z-index:99999;box-shadow:0 4px 12px rgba(0,161,214,0.4);transition:transform 0.2s,box-shadow 0.2s;`;
            btn.addEventListener('mouseenter', () => { btn.style.transform = 'scale(1.1)'; btn.style.boxShadow = '0 6px 16px rgba(0,161,214,0.5)'; });
            btn.addEventListener('mouseleave', () => { btn.style.transform = 'scale(1)'; btn.style.boxShadow = '0 4px 12px rgba(0,161,214,0.4)'; });
            btn.addEventListener('click', () => { btn.remove(); UI.createControlPanel(); });
            document.body.appendChild(btn);
        },

        createControlPanel() {
            const panel = document.createElement('div');
            panel.id = Config.PANEL_ID;
            panel.style.cssText = `position:fixed;top:100px;right:20px;background:white;border-radius:12px;box-shadow:0 4px 20px rgba(0,0,0,0.15);padding:20px;z-index:99999;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;width:280px;border:1px solid #e3e5e7;`;

            const progress = Progress.get();
            const total = BlacklistData.uids.length;
            const loggedIn = Auth.isLoggedIn();
            const uid = Auth.getCurrentUid();
            const statusInfo = BatchState.paused ? { text: '已暂停', color: '#faad14' }
                : BatchState.running ? { text: '运行中', color: '#52c41a' }
                : BatchState.finished ? { text: '已完成', color: '#13c2c2' }
                : { text: '待运行', color: '#9499a0' };

            panel.innerHTML = `
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:15px;">
                    <h3 style="margin:0;font-size:16px;color:#18191c;">🛡️ B站A盾黑名单拉黑助手</h3>
                    <button id="bl-close-panel" style="background:none;border:none;cursor:pointer;font-size:18px;color:#9499a0;">×</button>
                </div>
                <div style="margin-bottom:15px;padding:10px;background:#f6f7f8;border-radius:8px;font-size:13px;color:#61666d;">
                    <div>黑名单总数: <strong style="color:#18191c;">${total}</strong></div>
                    <div id="bl-progress-display">当前进度: <strong style="color:#00a1d6;">${progress}</strong> / ${total}</div>
                    <div>数据来源: <strong style="color:#18191c;">${BlacklistData.source}</strong></div>
                    <div>登录状态: <strong style="color:${loggedIn ? '#00aeec' : '#f25d8e'};">${loggedIn ? '已登录' : '未登录'}</strong>${loggedIn ? ` - ${uid}` : ''}</div>
                    <div>运行状态: <strong id="bl-current-status" style="color:${statusInfo.color};">${statusInfo.text}</strong></div>
                </div>
                <div style="display:flex;flex-direction:column;gap:8px;">
                    <button id="bl-control-batch" style="padding:10px;background:#00a1d6;color:white;border:none;border-radius:6px;cursor:pointer;font-size:14px;font-weight:500;transition:background 0.2s;">
                        ${BatchState.finished ? '🔄 重新批量拉黑' : (progress > 0 ? '▶️ 继续批量拉黑' : '▶️ 开始批量拉黑')}
                    </button>
                    <div style="position:relative;">
                        <button id="bl-refresh-data" style="padding:10px;background:#52c41a;color:white;border:none;border-radius:6px;cursor:pointer;font-size:14px;font-weight:500;transition:background 0.2s;width:100%;text-align:center;">
                            🔄 刷新数据 ▼
                        </button>
                        <div id="bl-refresh-menu" style="position:absolute;top:100%;left:0;right:0;background:white;border:1px solid #e3e5e7;border-radius:0 0 6px 6px;box-shadow:0 4px 12px rgba(0,0,0,0.1);z-index:100000;display:none;">
                            <button id="bl-refresh-remote" class="bl-menu-item" style="padding:8px 12px;width:100%;text-align:left;background:none;border:none;cursor:pointer;font-size:13px;transition:background 0.2s;">🛡️ A盾黑名单</button>
                            <button id="bl-refresh-xianlists" class="bl-menu-item" style="padding:8px 12px;width:100%;text-align:left;background:none;border:none;cursor:pointer;font-size:13px;transition:background 0.2s;">👹 XianLists</button>
                            <button id="bl-refresh-live-robot" class="bl-menu-item" style="padding:8px 12px;width:100%;text-align:left;background:none;border:none;cursor:pointer;font-size:13px;transition:background 0.2s;">🤖 直播间机器人</button>
                            <button id="bl-refresh-cache" class="bl-menu-item" style="padding:8px 12px;width:100%;text-align:left;background:none;border:none;cursor:pointer;font-size:13px;transition:background 0.2s;">💾 本地缓存</button>
                        </div>
                    </div>
                    <button id="bl-view-details" style="padding:10px;background:#1890ff;color:white;border:none;border-radius:6px;cursor:pointer;font-size:14px;font-weight:500;transition:background 0.2s;">📋 查看详细记录</button>
                    <button id="bl-reset-progress" style="padding:10px;background:#f5222d;color:white;border:none;border-radius:6px;cursor:pointer;font-size:14px;font-weight:500;transition:background 0.2s;">🔄 重置进度</button>
                    <div style="position:relative;">
                        <button id="bl-blacklist-manager" style="padding:10px;background:#722ed1;color:white;border:none;border-radius:6px;cursor:pointer;font-size:14px;font-weight:500;transition:background 0.2s;width:100%;text-align:center;">📝 黑名单管理 ▼</button>
                        <div id="bl-blacklist-manager-submenu" style="position:absolute;top:100%;left:0;right:0;background:white;border:1px solid #e3e5e7;border-radius:0 0 6px 6px;box-shadow:0 4px 12px rgba(0,0,0,0.1);z-index:100000;display:none;">
                            <button id="bl-test-uid-check" class="bl-menu-item" style="padding:8px 12px;width:100%;text-align:left;background:none;border:none;cursor:pointer;font-size:13px;transition:background 0.2s;">🔍 UID 查重</button>
                            <button id="bl-import-uids" class="bl-menu-item" style="padding:8px 12px;width:100%;text-align:left;background:none;border:none;cursor:pointer;font-size:13px;transition:background 0.2s;">📥 导入 UID</button>
                            <button id="bl-export-uids" class="bl-menu-item" style="padding:8px 12px;width:100%;text-align:left;background:none;border:none;cursor:pointer;font-size:13px;transition:background 0.2s;">📤 导出 UID</button>
                            <button id="bl-open-my-blacklist" class="bl-menu-item" style="padding:8px 12px;width:100%;text-align:left;background:none;border:none;cursor:pointer;font-size:13px;transition:background 0.2s;">📝 我的B站黑名单</button>
                            <button id="bl-export-my-blacklist" class="bl-menu-item" style="padding:8px 12px;width:100%;text-align:left;background:none;border:none;cursor:pointer;font-size:13px;transition:background 0.2s;">🧾 导出我的B站黑名单</button>
                        </div>
                    </div>
                    <div style="position:relative;">
                        <button id="bl-secret-menu" style="padding:10px;background:#52c41a;color:white;border:none;border-radius:6px;cursor:pointer;font-size:14px;font-weight:500;transition:background 0.2s;width:100%;text-align:center;">👀 只有我知道 ▼</button>
                        <div id="bl-secret-submenu" style="position:absolute;top:100%;left:0;right:0;background:white;border:1px solid #e3e5e7;border-radius:0 0 6px 6px;box-shadow:0 4px 12px rgba(0,0,0,0.1);z-index:100000;display:none;">
                            <button id="bl-open-github" class="bl-menu-item" style="padding:8px 12px;width:100%;text-align:left;background:none;border:none;cursor:pointer;font-size:13px;transition:background 0.2s;">🔗 GitHub</button>
                        </div>
                    </div>
                </div>
                <div style="margin-top:12px;font-size:11px;color:#9499a0;line-height:1.5;">
                    提示: 点击开始后脚本会自动批量拉黑黑名单中的用户。请勿频繁操作以免触发风控。
                </div>
            `;

            document.body.appendChild(panel);
            UI._bindPanelEvents(panel);
        },

        _bindPanelEvents(panel) {
            const closeAllMenus = () => {
                ['bl-refresh-menu', 'bl-blacklist-manager-submenu', 'bl-secret-submenu'].forEach(id => {
                    const el = document.getElementById(id);
                    if (el) el.style.display = 'none';
                });
            };

            const toggleMenu = (menuId, ...otherIds) => {
                const menu = document.getElementById(menuId);
                if (!menu) return;
                otherIds.forEach(id => { const el = document.getElementById(id); if (el) el.style.display = 'none'; });
                menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
            };

            document.getElementById('bl-close-panel').addEventListener('click', () => {
                panel.remove();
                UI.createFloatingButton();
            });

            document.getElementById('bl-control-batch').addEventListener('click', () => {
                const btn = document.getElementById('bl-control-batch');
                if (!BatchState.running) {
                    if (!BatchState.canStart('开始批量拉黑')) return;
                    if (!Auth.isLoggedIn()) { alert('请先登录B站账号！'); return; }
                    if (BatchState.finished) { Progress.clear(); BatchState.finished = false; }
                    batchBlock(Progress.normalize(Progress.get()));
                } else {
                    if (BatchState.paused && !BatchState.canStart('继续批量拉黑')) return;
                    BatchState.paused = !BatchState.paused;
                    if (BatchState.paused) {
                        btn.innerHTML = '▶️ 继续批量拉黑'; btn.style.background = '#52c41a';
                        Notify.show('已暂停', '批量拉黑已暂停，可随时点击继续');
                        const tip = document.getElementById(Config.BLOCKED_TIP_ID);
                        if (tip) tip.remove();
                    } else {
                        btn.innerHTML = '⏸️ 暂停批量拉黑'; btn.style.background = '#faad14';
                        Notify.show('已继续', '批量拉黑已继续执行');
                    }
                    UI.updateStatusDisplay();
                }
            });

            document.getElementById('bl-refresh-data').addEventListener('click', e => { e.stopPropagation(); toggleMenu('bl-refresh-menu', 'bl-blacklist-manager-submenu', 'bl-secret-submenu'); });
            document.getElementById('bl-blacklist-manager').addEventListener('click', e => { e.stopPropagation(); toggleMenu('bl-blacklist-manager-submenu', 'bl-refresh-menu', 'bl-secret-submenu'); });
            document.getElementById('bl-secret-menu').addEventListener('click', e => { e.stopPropagation(); toggleMenu('bl-secret-submenu', 'bl-refresh-menu', 'bl-blacklist-manager-submenu'); });

            document.addEventListener('click', closeAllMenus);

            async function handleRefresh(loadFn, sourceLabel, needCooldown = true) {
                if (!BatchState.canStart('刷新数据')) { closeAllMenus(); return; }
                if (needCooldown) {
                    const elapsed = Date.now() - BatchState.lastRefreshTime;
                    if (elapsed < Config.REFRESH_COOLDOWN) {
                        Notify.show('刷新冷却中', `请等待 ${Math.ceil((Config.REFRESH_COOLDOWN - elapsed) / 1000)} 秒后再刷新`);
                        closeAllMenus(); return;
                    }
                }
                const btn = document.getElementById('bl-refresh-data');
                const orig = btn.innerHTML;
                btn.innerHTML = '⌛ 刷新中...'; btn.disabled = true;
                BatchState.isRefreshing = true; BatchState.shouldStop = true;
                try {
                    const result = await loadFn();
                    const uids = Array.isArray(result) ? result : (result && result.uids);
                    const srcName = (result && result.source) || sourceLabel;
                    if (uids && uids.length > 0) {
                        BlacklistData.setUids(uids, sourceLabel);
                        BatchState.finished = false; BatchState.paused = false;
                        if (needCooldown) BatchState.lastRefreshTime = Date.now();
                        BlacklistData.saveCache(); Progress.clear();
                        console.log(`✅ 成功从 ${srcName} 获取 ${uids.length} 条黑名单数据`);
                        panel.remove(); UI.createControlPanel();
                        Notify.show('数据刷新', `✅ 成功从 ${sourceLabel} 获取\n${uids.length} 条数据`);
                    } else { throw new Error('未找到UID数据'); }
                } catch (e) {
                    console.warn(`⚠️ 从${sourceLabel}获取黑名单失败:`, e);
                    Notify.show('数据刷新失败', `❌ 从${sourceLabel}获取数据失败: ${e.message}`);
                } finally {
                    btn.innerHTML = orig; btn.disabled = false;
                    BatchState.isRefreshing = false; BatchState.shouldStop = false;
                    closeAllMenus();
                }
            }

            document.getElementById('bl-refresh-remote').addEventListener('click', async e => {
                e.stopPropagation();
                await handleRefresh(async () => {
                    let uids = await BlacklistData.fetchFromPublicApi();
                    let src = 'A盾黑名单(主源)';
                    if (!uids || uids.length === 0) { uids = await BlacklistData.loadBackupAShield(); src = 'A盾黑名单(备用源)'; }
                    return { uids, source: src };
                }, 'A盾黑名单');
            });

            document.getElementById('bl-refresh-cache').addEventListener('click', e => {
                e.stopPropagation();
                const cached = Store.getJson(Config.CACHE_KEY);
                if (cached && cached.length > 0) {
                    BlacklistData.setUids(cached, '本地缓存');
                    BatchState.finished = false; BatchState.paused = false; Progress.clear();
                    panel.remove(); UI.createControlPanel();
                    Notify.show('数据刷新', `✅ 使用本地缓存数据\n${cached.length} 条数据`);
                } else { Notify.show('数据刷新失败', '❌ 本地缓存为空'); }
                closeAllMenus();
            });

            document.getElementById('bl-refresh-xianlists').addEventListener('click', async e => {
                e.stopPropagation();
                await handleRefresh(BlacklistData.loadXianJunList, 'XianLists');
            });

            document.getElementById('bl-refresh-live-robot').addEventListener('click', async e => {
                e.stopPropagation();
                await handleRefresh(BlacklistData.loadLiveRoomRobotList, '直播间机器人');
            });

            document.getElementById('bl-open-my-blacklist').addEventListener('click', e => {
                e.stopPropagation();
                window.open('https://account.bilibili.com/account/blacklist', '_blank');
                closeAllMenus();
            });

            document.getElementById('bl-import-uids').addEventListener('click', e => {
                e.stopPropagation();
                if (!BatchState.canStart('导入 UID')) { closeAllMenus(); return; }
                UI.showImportUidDialog(); closeAllMenus();
            });

            document.getElementById('bl-export-uids').addEventListener('click', e => {
                e.stopPropagation(); UI.exportBlacklistUids(); closeAllMenus();
            });

            document.getElementById('bl-export-my-blacklist').addEventListener('click', async e => {
                e.stopPropagation(); await UI.exportMyBilibiliBlacklist(); closeAllMenus();
            });

            document.getElementById('bl-test-uid-check').addEventListener('click', e => {
                e.stopPropagation(); UI.showUidCheckDialog(); closeAllMenus();
            });

            document.getElementById('bl-reset-progress').addEventListener('click', () => {
                if (confirm('确定要重置进度吗？这将从第一个用户重新开始。')) { Progress.clear(); location.reload(); }
            });

            document.getElementById('bl-view-details').addEventListener('click', () => UI.showDetailsPanel());

            document.getElementById('bl-open-github').addEventListener('click', e => {
                e.stopPropagation();
                window.open(Config.GITHUB_URL, '_blank');
                closeAllMenus();
            });
        },

        exportBlacklistUids() {
            if (!BlacklistData.uids.length) { alert('当前没有可导出的 UID'); return; }
            const blob = new Blob([BlacklistData.uids.join('\n')], { type: 'text/plain;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url; a.download = 'blacklist-uids-' + new Date().toISOString().slice(0, 10) + '.txt';
            a.style.display = 'none'; document.body.appendChild(a); a.click();
            document.body.removeChild(a); URL.revokeObjectURL(url);
            Notify.show('导出成功', `已下载 ${BlacklistData.uids.length} 条 UID（每行一个）`);
        },

        async exportMyBilibiliBlacklist() {
            if (!Auth.isLoggedIn()) { alert('请先登录B站账号！'); return; }
            try {
                const records = await BiliApi.fetchAllMyBlacks();
                if (!records.length) { alert('当前账号黑名单为空，未导出文件。'); return; }
                const blob = new Blob([records.map(r => String(r.uid)).join('\n')], { type: 'text/plain;charset=utf-8' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url; a.download = 'bilibili-my-blacklist-uids-' + new Date().toISOString().slice(0, 10) + '.txt';
                a.style.display = 'none'; document.body.appendChild(a); a.click();
                document.body.removeChild(a); URL.revokeObjectURL(url);
                Notify.show('导出成功', `已导出你账号黑名单 ${records.length} 条 UID`);
            } catch (e) {
                console.error('❌ 导出 B站账号黑名单失败:', e);
                alert(`导出失败：${e && e.message ? e.message : '未知错误'}`);
            }
        },

        showDetailsPanel() {
            const existing = document.getElementById(Config.DETAILS_OVERLAY_ID);
            if (existing) existing.remove();

            const overlay = UI._createOverlay(Config.DETAILS_OVERLAY_ID);
            const box = UI._createDialogBox('700px', '85vh');
            const stats = BlockLog.getStats();

            const titleRow = UI._createTitleBar('📋 拉黑详细记录', () => overlay.remove());
            const statsDiv = document.createElement('div');
            statsDiv.style.cssText = 'font-size:12px;color:#61666d;margin-top:4px;';
            statsDiv.innerHTML = `总计: ${stats.total} | <span style="color:#52c41a;">成功: ${stats.success}</span> | <span style="color:#f5222d;">失败: ${stats.failed}</span> | <span style="color:#13c2c2;">跳过: ${stats.skipped}</span> | <span style="color:#faad14;">错误: ${stats.error}</span>`;
            titleRow.querySelector('div').appendChild(statsDiv);

            const filterRow = document.createElement('div');
            filterRow.style.cssText = 'display:flex;gap:8px;padding:12px 20px;border-bottom:1px solid #e3e5e7;background:#fafbfc;';

            const filters = [
                { key: 'all', label: '全部', color: '#18191c' },
                { key: 'success', label: '成功', color: '#52c41a' },
                { key: 'failed', label: '失败', color: '#f5222d' },
                { key: 'skipped', label: '跳过', color: '#13c2c2' },
                { key: 'error', label: '错误', color: '#faad14' }
            ];

            let currentFilter = 'all';
            const filterButtons = {};
            const listContainer = document.createElement('div');
            listContainer.style.cssText = 'flex:1;overflow-y:auto;padding:0;max-height:50vh;';

            function renderLogList() {
                listContainer.innerHTML = '';
                const filtered = currentFilter === 'all' ? [...BlockLog.getAll()].reverse() : BlockLog.getAll().filter(e => e.status === currentFilter).reverse();
                if (filtered.length === 0) {
                    const empty = document.createElement('div');
                    empty.style.cssText = 'text-align:center;padding:40px;color:#9499a0;font-size:14px;';
                    empty.textContent = '暂无记录';
                    listContainer.appendChild(empty);
                    return;
                }
                const table = document.createElement('table');
                table.style.cssText = 'width:100%;border-collapse:collapse;font-size:13px;';
                const thead = document.createElement('thead');
                thead.style.cssText = 'position:sticky;top:0;background:#fff;z-index:1;';
                thead.innerHTML = `<tr style="border-bottom:1px solid #e3e5e7;"><th style="padding:12px 16px;text-align:left;font-weight:600;color:#18191c;width:80px;">序号</th><th style="padding:12px 16px;text-align:left;font-weight:600;color:#18191c;width:140px;">时间</th><th style="padding:12px 16px;text-align:left;font-weight:600;color:#18191c;width:120px;">UID</th><th style="padding:12px 16px;text-align:left;font-weight:600;color:#18191c;width:80px;">状态</th><th style="padding:12px 16px;text-align:left;font-weight:600;color:#18191c;">详情</th></tr>`;
                table.appendChild(thead);
                const tbody = document.createElement('tbody');
                const statusColors = { success: '#52c41a', failed: '#f5222d', skipped: '#13c2c2', error: '#faad14' };
                const statusLabels = { success: '成功', failed: '失败', skipped: '跳过', error: '错误' };
                for (const entry of filtered) {
                    const row = document.createElement('tr');
                    row.style.cssText = 'border-bottom:1px solid #f0f0f0;transition:background 0.2s;';
                    row.addEventListener('mouseenter', () => row.style.background = '#f6f7f8');
                    row.addEventListener('mouseleave', () => row.style.background = 'transparent');
                    row.innerHTML = `<td style="padding:10px 16px;color:#61666d;">${entry.index}/${entry.total}</td><td style="padding:10px 16px;color:#61666d;font-size:12px;">${entry.timestamp}</td><td style="padding:10px 16px;color:#18191c;font-family:monospace;">${entry.uid}</td><td style="padding:10px 16px;"><span style="display:inline-block;padding:2px 8px;border-radius:4px;font-size:12px;background:${statusColors[entry.status]}20;color:${statusColors[entry.status]};font-weight:500;">${statusLabels[entry.status] || entry.status}</span></td><td style="padding:10px 16px;color:#61666d;font-size:12px;">${entry.message || '-'}</td>`;
                    tbody.appendChild(row);
                }
                table.appendChild(tbody);
                listContainer.appendChild(table);
            }

            filters.forEach(f => {
                const btn = document.createElement('button');
                btn.textContent = f.label;
                btn.style.cssText = `padding:6px 14px;border:1px solid ${f.key === 'all' ? '#00a1d6' : f.color};background:${f.key === 'all' ? '#00a1d6' : '#fff'};color:${f.key === 'all' ? '#fff' : f.color};border-radius:4px;cursor:pointer;font-size:13px;transition:all 0.2s;`;
                btn.addEventListener('click', () => {
                    currentFilter = f.key;
                    Object.keys(filterButtons).forEach(key => {
                        const b = filterButtons[key];
                        const info = filters.find(x => x.key === key);
                        b.style.background = key === currentFilter ? info.color : '#fff';
                        b.style.color = key === currentFilter ? '#fff' : info.color;
                    });
                    renderLogList();
                });
                filterButtons[f.key] = btn;
                filterRow.appendChild(btn);
            });

            const clearBtn = document.createElement('button');
            clearBtn.textContent = '🗑️ 清空记录';
            clearBtn.style.cssText = 'margin-left:auto;padding:6px 14px;border:1px solid #ff4d4f;background:#fff;color:#ff4d4f;border-radius:4px;cursor:pointer;font-size:13px;';
            clearBtn.addEventListener('click', () => {
                if (confirm('确定要清空所有记录吗？')) { BlockLog.clear(); renderLogList(); }
            });
            filterRow.appendChild(clearBtn);

            renderLogList();

            const bottomRow = UI._createBottomBar([{ text: '关闭', bg: '#00a1d6', action: () => overlay.remove() }]);

            box.appendChild(titleRow);
            box.appendChild(filterRow);
            box.appendChild(listContainer);
            box.appendChild(bottomRow);
            overlay.appendChild(box);
            document.body.appendChild(overlay);
            overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
        },

        showUidCheckDialog() {
            const existing = document.getElementById(Config.UID_CHECK_OVERLAY_ID);
            if (existing) existing.remove();

            const overlay = UI._createOverlay(Config.UID_CHECK_OVERLAY_ID);
            const box = UI._createDialogBox('450px');

            const titleRow = UI._createTitleBar('🔍 UID 查重', () => overlay.remove());
            const hint = UI._createHint('每行一个UID，或用逗号、分号分隔；也可粘贴个人空间链接，或选择txt文件导入。');
            const ta = UI._createTextarea('例如：\n123456789\nhttps://space.bilibili.com/987654321', '120px');
            const fileInput = UI._createFileInput();
            const resultDiv = document.createElement('div');
            resultDiv.id = 'bl-uid-check-result';
            resultDiv.style.cssText = 'margin:8px 16px 0;padding:12px;border-radius:8px;font-size:13px;line-height:1.6;display:none;';

            const exportBtn = document.createElement('button');
            exportBtn.type = 'button'; exportBtn.textContent = '📋 导出结果'; exportBtn.disabled = true;
            exportBtn.style.cssText = 'padding:8px 12px;background:#f6f7f8;color:#18191c;border:1px solid #e3e5e7;border-radius:6px;cursor:pointer;font-size:13px;';

            const checkBtn = document.createElement('button');
            checkBtn.type = 'button'; checkBtn.textContent = '检查';
            checkBtn.style.cssText = 'padding:8px 16px;background:#00a1d6;color:white;border:none;border-radius:6px;cursor:pointer;font-size:14px;font-weight:500;';

            const cancelBtn = document.createElement('button');
            cancelBtn.type = 'button'; cancelBtn.textContent = '关闭';
            cancelBtn.style.cssText = 'margin-left:auto;padding:8px 16px;background:#f6f7f8;color:#61666d;border:none;border-radius:6px;cursor:pointer;font-size:14px;';

            const pickFileBtn = document.createElement('button');
            pickFileBtn.type = 'button'; pickFileBtn.textContent = '📄 选择 txt 文件';
            pickFileBtn.style.cssText = 'padding:8px 12px;background:#f6f7f8;color:#18191c;border:1px solid #e3e5e7;border-radius:6px;cursor:pointer;font-size:13px;';

            pickFileBtn.addEventListener('click', () => fileInput.click());
            fileInput.addEventListener('change', function () {
                const file = this.files && this.files[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = () => { ta.value = String(reader.result || ''); };
                reader.readAsText(file, 'UTF-8');
            });

            cancelBtn.addEventListener('click', () => overlay.remove());

            checkBtn.addEventListener('click', () => {
                const text = ta.value.trim();
                resultDiv.style.display = 'block';
                if (!text) {
                    resultDiv.style.cssText = 'margin:8px 16px 0;padding:12px;border-radius:8px;font-size:13px;line-height:1.6;background:#fff2f0;color:#f5222d;';
                    resultDiv.textContent = '❌ 请输入UID或选择文件';
                    return;
                }
                const uids = new Set();
                const uidPattern = /(?:space\.bilibili\.com\/|uid[:：]\s*)?(\d+)/gi;
                for (const line of text.split(/[\n\r]+/)) {
                    const trimmed = line.trim();
                    if (!trimmed || trimmed.startsWith('#')) continue;
                    let m;
                    while ((m = uidPattern.exec(trimmed)) !== null) {
                        const uid = parseInt(m[1], 10);
                        if (!isNaN(uid) && uid > 0) uids.add(uid);
                    }
                }
                if (uids.size === 0) {
                    resultDiv.style.cssText = 'margin:8px 16px 0;padding:12px;border-radius:8px;font-size:13px;line-height:1.6;background:#fff2f0;color:#f5222d;';
                    resultDiv.textContent = '❌ 未找到有效的UID';
                    return;
                }
                let inBlacklist = 0, notInBlacklist = 0;
                const inList = [], notInList = [];
                for (const uid of uids) {
                    if (BlacklistData.uidSet.has(uid)) { inBlacklist++; inList.push(uid); }
                    else { notInBlacklist++; notInList.push(uid); }
                }
                let html = `<div style="margin-bottom:8px;"><strong>检查结果：</strong></div>`;
                html += `<div style="margin-bottom:4px;">✅ 在黑名单中：<strong style="color:#52c41a;">${inBlacklist}</strong> 个</div>`;
                html += `<div style="margin-bottom:4px;">❌ 不在黑名单中：<strong style="color:#fa8c16;">${notInBlacklist}</strong> 个</div>`;
                html += `<div>总计：<strong>${uids.size}</strong> 个</div>`;
                if (inList.length > 0) html += `<div style="margin-top:8px;padding-top:8px;border-top:1px solid #e3e5e7;"><div style="margin-bottom:4px;"><strong>在黑名单中的UID：</strong></div><div style="font-family:ui-monospace,monospace;font-size:12px;color:#52c41a;">${inList.map(escapeHtml).join(', ')}</div></div>`;
                if (notInList.length > 0) html += `<div style="margin-top:8px;padding-top:8px;border-top:1px solid #e3e5e7;"><div style="margin-bottom:4px;"><strong>不在黑名单中的UID：</strong></div><div style="font-family:ui-monospace,monospace;font-size:12px;color:#fa8c16;">${notInList.map(escapeHtml).join(', ')}</div></div>`;
                resultDiv.style.cssText = 'margin:8px 16px 0;padding:12px;border-radius:8px;font-size:13px;line-height:1.6;background:#f6f7f8;color:#18191c;max-height:30vh;overflow-y:auto;';
                resultDiv.innerHTML = html;
                exportBtn.disabled = false;
                exportBtn.onclick = () => {
                    const lines = ['检查结果', `在黑名单中: ${inBlacklist} 个`, `不在黑名单中: ${notInBlacklist} 个`, `总计: ${uids.size} 个`, ''];
                    if (inList.length > 0) { lines.push('=== 在黑名单中的UID ==='); inList.forEach(uid => lines.push(uid)); lines.push(''); }
                    if (notInList.length > 0) { lines.push('=== 不在黑名单中的UID ==='); notInList.forEach(uid => lines.push(uid)); }
                    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a'); a.href = url; a.download = 'uid_check_result.txt'; a.click();
                    URL.revokeObjectURL(url);
                };
            });

            const btnRow = document.createElement('div');
            btnRow.style.cssText = 'display:flex;flex-wrap:wrap;gap:8px;padding:12px 16px;';
            btnRow.appendChild(pickFileBtn);
            btnRow.appendChild(exportBtn);
            btnRow.appendChild(cancelBtn);
            btnRow.appendChild(checkBtn);

            box.appendChild(titleRow);
            box.appendChild(hint);
            box.appendChild(ta);
            box.appendChild(fileInput);
            box.appendChild(resultDiv);
            box.appendChild(btnRow);
            overlay.appendChild(box);
            document.body.appendChild(overlay);
            ta.focus();
            overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
        },

        showImportUidDialog() {
            const existing = document.getElementById(Config.IMPORT_OVERLAY_ID);
            if (existing) existing.remove();

            const overlay = UI._createOverlay(Config.IMPORT_OVERLAY_ID);
            const box = UI._createDialogBox('420px', '90vh');

            const titleRow = UI._createTitleBar('📥 导入 UID', () => overlay.remove());
            const hint = UI._createHint('每行一个 UID，或用逗号、分号分隔；也可粘贴个人空间链接。导入后将替换当前列表并清零拉黑进度。');
            const ta = UI._createTextarea('例如：\n123456789\nhttps://space.bilibili.com/987654321', '160px', '40vh');
            const fileInput = UI._createFileInput();

            const pickFileBtn = document.createElement('button');
            pickFileBtn.type = 'button'; pickFileBtn.textContent = '📄 选择 txt 文件';
            pickFileBtn.style.cssText = 'padding:8px 12px;background:#f6f7f8;color:#18191c;border:1px solid #e3e5e7;border-radius:6px;cursor:pointer;font-size:13px;';

            const cancelBtn = document.createElement('button');
            cancelBtn.type = 'button'; cancelBtn.textContent = '取消';
            cancelBtn.style.cssText = 'margin-left:auto;padding:8px 16px;background:#f6f7f8;color:#61666d;border:none;border-radius:6px;cursor:pointer;font-size:14px;';

            const okBtn = document.createElement('button');
            okBtn.type = 'button'; okBtn.textContent = '导入';
            okBtn.style.cssText = 'padding:8px 16px;background:#00a1d6;color:white;border:none;border-radius:6px;cursor:pointer;font-size:14px;font-weight:500;';

            pickFileBtn.addEventListener('click', () => fileInput.click());
            fileInput.addEventListener('change', function () {
                const file = this.files && this.files[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = () => { ta.value = String(reader.result || ''); };
                reader.readAsText(file, 'UTF-8');
                this.value = '';
            });

            cancelBtn.addEventListener('click', () => overlay.remove());
            okBtn.addEventListener('click', () => {
                const uids = BlacklistData.parseUidsFromText(ta.value);
                if (uids.length === 0) { alert('未能解析出任何 UID，请检查格式。'); return; }
                if (!confirm(`将使用 ${uids.length} 条 UID 替换当前列表，并清零拉黑进度。确定？`)) return;
                BlacklistData.applyImported(uids);
                overlay.remove();
                const panel = document.getElementById(Config.PANEL_ID);
                if (panel) panel.remove();
                UI.createControlPanel();
                Notify.show('导入成功', `已载入 ${uids.length} 条 UID`);
            });

            const btnRow = document.createElement('div');
            btnRow.style.cssText = 'display:flex;flex-wrap:wrap;gap:8px;padding:12px 16px;';
            btnRow.appendChild(pickFileBtn);
            btnRow.appendChild(cancelBtn);
            btnRow.appendChild(okBtn);

            box.appendChild(titleRow);
            box.appendChild(hint);
            box.appendChild(ta);
            box.appendChild(fileInput);
            box.appendChild(btnRow);
            overlay.appendChild(box);
            document.body.appendChild(overlay);
            ta.focus();
            overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
        },

        _createOverlay(id) {
            const overlay = document.createElement('div');
            overlay.id = id;
            overlay.style.cssText = 'position:fixed;inset:0;z-index:100001;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;padding:20px;box-sizing:border-box;';
            return overlay;
        },

        _createDialogBox(maxWidth, maxHeight) {
            const box = document.createElement('div');
            box.style.cssText = `background:#fff;border-radius:12px;box-shadow:0 8px 32px rgba(0,0,0,0.3);width:100%;max-width:${maxWidth};${maxHeight ? 'max-height:' + maxHeight + ';' : ''}display:flex;flex-direction:column;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;`;
            return box;
        },

        _createTitleBar(title, onClose) {
            const row = document.createElement('div');
            row.style.cssText = 'display:flex;justify-content:space-between;align-items:center;padding:16px 20px;border-bottom:1px solid #e3e5e7;background:#f6f7f8;border-radius:12px 12px 0 0;';
            const left = document.createElement('div');
            left.innerHTML = `<h3 style="margin:0;font-size:16px;color:#18191c;">${title}</h3>`;
            const closeBtn = document.createElement('button');
            closeBtn.type = 'button'; closeBtn.textContent = '×';
            closeBtn.style.cssText = 'background:none;border:none;cursor:pointer;font-size:24px;color:#9499a0;line-height:1;padding:0;width:32px;height:32px;display:flex;align-items:center;justify-content:center;';
            closeBtn.addEventListener('click', onClose);
            row.appendChild(left);
            row.appendChild(closeBtn);
            return row;
        },

        _createHint(text) {
            const div = document.createElement('div');
            div.style.cssText = 'padding:8px 16px;font-size:12px;color:#61666d;line-height:1.5;';
            div.textContent = text;
            return div;
        },

        _createTextarea(placeholder, minHeight, maxHeight) {
            const ta = document.createElement('textarea');
            ta.placeholder = placeholder;
            ta.style.cssText = `margin:0 16px;width:calc(100% - 32px);min-height:${minHeight || '120px'};${maxHeight ? 'max-height:' + maxHeight + ';' : ''}padding:10px;border:1px solid #e3e5e7;border-radius:8px;font-size:13px;font-family:ui-monospace,monospace;resize:vertical;box-sizing:border-box;`;
            return ta;
        },

        _createFileInput() {
            const input = document.createElement('input');
            input.type = 'file'; input.accept = '.txt,text/plain'; input.style.display = 'none';
            return input;
        },

        _createBottomBar(buttons) {
            const row = document.createElement('div');
            row.style.cssText = 'display:flex;justify-content:flex-end;padding:16px 20px;border-top:1px solid #e3e5e7;background:#f6f7f8;border-radius:0 0 12px 12px;';
            for (const b of buttons) {
                const btn = document.createElement('button');
                btn.textContent = b.text;
                btn.style.cssText = `padding:8px 24px;background:${b.bg || '#00a1d6'};color:white;border:none;border-radius:6px;cursor:pointer;font-size:14px;font-weight:500;margin-left:8px;`;
                btn.addEventListener('click', b.action);
                row.appendChild(btn);
            }
            return row;
        }
    };

    const Disclaimer = {
        hasAgreed() {
            if (typeof GM_getValue !== 'undefined') {
                const v = GM_getValue(Config.DISCLAIMER_KEY);
                if (v === 'true') return true;
            }
            return localStorage.getItem(Config.DISCLAIMER_KEY) === 'true';
        },

        show() {
            const overlay = UI._createOverlay(Config.DISCLAIMER_OVERLAY_ID);
            const box = UI._createDialogBox('500px', '80vh');

            const titleRow = document.createElement('div');
            titleRow.style.cssText = 'padding:20px 20px 10px;border-bottom:1px solid #e3e5e7;background:#f6f7f8;border-radius:12px 12px 0 0;text-align:center;';
            const h3 = document.createElement('h3');
            h3.style.cssText = 'margin:0;font-size:16px;color:#18191c;';
            h3.textContent = '⚠️ 免责声明';
            titleRow.appendChild(h3);

            const content = document.createElement('div');
            content.style.cssText = 'padding:20px;overflow-y:auto;flex:1;';
            content.innerHTML = `<div style="font-size:14px;line-height:1.6;color:#333;"><p>本脚本仅用于辅助管理 B 站黑名单，请勿用于任何违法或滥用目的。</p><p>使用本脚本时，请遵守以下规则：</p><ol style="margin:10px 0;padding-left:20px;"><li>请勿频繁操作，以免触发 B 站风控机制</li><li>仅拉黑确实需要拉黑的用户，避免误操作</li><li>尊重他人合法权益，不进行恶意拉黑</li><li>使用本脚本产生的一切后果由用户自行承担</li></ol><p>请确认您已了解并同意上述声明，否则请不要使用本脚本。</p></div>`;

            return new Promise(resolve => {
                const btnRow = document.createElement('div');
                btnRow.style.cssText = 'display:flex;gap:10px;padding:15px 20px;border-top:1px solid #e3e5e7;background:#fafbfc;border-radius:0 0 12px 12px;';

                const cancelBtn = document.createElement('button');
                cancelBtn.type = 'button'; cancelBtn.textContent = '不同意';
                cancelBtn.style.cssText = 'flex:1;padding:10px;background:#f6f7f8;color:#61666d;border:1px solid #e3e5e7;border-radius:6px;cursor:pointer;font-size:14px;';
                cancelBtn.addEventListener('click', () => { overlay.remove(); resolve(false); });

                const agreeBtn = document.createElement('button');
                agreeBtn.type = 'button'; agreeBtn.textContent = '我同意';
                agreeBtn.style.cssText = 'flex:1;padding:10px;background:#00a1d6;color:white;border:none;border-radius:6px;cursor:pointer;font-size:14px;font-weight:500;';
                agreeBtn.addEventListener('click', () => {
                    overlay.remove();
                    Store.setRaw(Config.DISCLAIMER_KEY, 'true');
                    resolve(true);
                });

                btnRow.appendChild(cancelBtn);
                btnRow.appendChild(agreeBtn);

                box.appendChild(titleRow);
                box.appendChild(content);
                box.appendChild(btnRow);
                overlay.appendChild(box);
                document.body.appendChild(overlay);
                overlay.addEventListener('click', e => { if (e.target === overlay) { overlay.remove(); resolve(false); } });
            });
        }
    };

    async function init() {
        console.log('🛡️ B站A盾黑名单拉黑助手已加载');

        if (!Disclaimer.hasAgreed()) {
            const agreed = await Disclaimer.show();
            if (!agreed) { console.log('用户不同意免责声明，脚本将不加载'); return; }
        }

        await BlacklistData.loadXianJunList();

        if (BlacklistData.isCurrentUserXianJun()) {
            console.log('nyan');
            window.open(Config.NYAN_URL, '_blank');
            return;
        }

        if (!BlacklistData.loadFromCache()) {
            BlacklistData.setUids([], '无数据');
            console.log('⚠️ 无本地缓存数据，请手动刷新获取黑名单');
        }
        console.log(`📋 数据来源: ${BlacklistData.source}，共 ${BlacklistData.uids.length} 条`);

        UI.createFloatingButton();

        if (typeof GM_registerMenuCommand !== 'undefined') {
            GM_registerMenuCommand('🛡️ 打开B站A盾黑名单拉黑助手', () => {
                const panel = document.getElementById(Config.PANEL_ID);
                if (panel) { panel.remove(); UI.createFloatingButton(); }
                else { const btn = document.getElementById(Config.FLOATING_BTN_ID); if (btn) btn.remove(); UI.createControlPanel(); }
            });
            GM_registerMenuCommand('▶️ 开始批量拉黑', () => {
                if (!Auth.isLoggedIn()) { alert('请先登录B站账号！'); return; }
                batchBlock(Progress.normalize(Progress.get()));
            });
            GM_registerMenuCommand('🔄 重置进度', () => {
                if (confirm('确定要重置进度吗？')) { Progress.clear(); alert('进度已重置！'); }
            });
            GM_registerMenuCommand('📤 导出 UID 列表', () => UI.exportBlacklistUids());
            GM_registerMenuCommand('📥 导入 UID 列表', () => {
                if (!BatchState.canStart('导入 UID')) return;
                UI.showImportUidDialog();
            });
            GM_registerMenuCommand('🧾 导出我的B站黑名单', async () => await UI.exportMyBilibiliBlacklist());
        }
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();
