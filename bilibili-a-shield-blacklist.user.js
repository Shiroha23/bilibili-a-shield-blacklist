// ==UserScript==
// @name         B站A盾黑名单拉黑助手
// @namespace    http://tampermonkey.net/
// @version      1.5
// @description  自动将A盾黑名单中的用户添加到B站黑名单，支持从 listing.ssrv2.ltd 动态获取数据
// @author       Shiroha23
// @match        https://www.bilibili.com/*
// @grant        GM_xmlhttpRequest
// @grant        GM_registerMenuCommand
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_notification
// @connect      listing.ssrv2.ltd
// @run-at       document-end
// ==/UserScript==

(function() {
    'use strict';

    // ==================== 配置 ====================
    const CONFIG = {
        // 每次批量拉黑的间隔(毫秒)
        BATCH_INTERVAL: 2000,
        // 每个用户拉黑的间隔(毫秒)
        USER_INTERVAL: 500,
        // 每批处理的用户数
        BATCH_SIZE: 10,
        // 存储键名
        STORAGE_KEY: 'bilibili_blacklist_progress',
        // 黑名单公示页（浏览器打开）
        BLACKLIST_URL: 'https://listing.ssrv2.ltd/',
        // 公示数据 JSON API（站点已改为前端分页加载，需直接请求此接口）
        BLACKLIST_API_URL: 'https://listing.ssrv2.ltd/api/public-blacklist',
        API_PAGE_SIZE: 50,
        // B站账号黑名单 API（用于导出“我账号当前已拉黑”的 UID）
        BILI_BLACKS_API_URL: 'https://api.bilibili.com/x/relation/blacks',
        BILI_BLACKS_PAGE_SIZE: 50,
        // 缓存键名
        CACHE_KEY: 'bilibili_blacklist_cache',
        // 是否跳过已拉黑的用户
        SKIP_ALREADY_BLOCKED: true,
        // 当前黑名单缓存键名
        MY_BLACKS_CACHE_KEY: 'bilibili_my_blacks_cache',
        // A盾黑名单刷新冷却时间（毫秒）
        REFRESH_COOLDOWN: 5000
    };

    // ==================== 黑名单数据 ====================
    // 备用硬编码UID列表 (646条)
    const FALLBACK_UIDS = [
        3706950491572360, 3706948635593033, 3706948348283346, 3706948197288039, 3706948180511692,
        3706948102916997, 3706948029516671, 3706948023224842, 3706947995962060, 3706947788343961,
        3706947773664008, 3706947712845864, 3706947656222938, 3706947119351882, 3706947083700674,
        3706947031272291, 3706946827848251, 3706946790099568, 3706945189972747, 3706944120425304,
        3706944051219144, 3706942759373216, 3706942694361679, 3706940251179037, 3706939659782920,
        3706939643005611, 3706938726550364, 3706936075749904, 3706936065263756, 3706934383347958,
        3706934282685321, 3706931220842561, 3706931172608653, 3706930902075828, 3706929012542081,
        3706924342183944, 3706923241179455, 3691012910221991, 3691010771126775, 3691010064386367,
        3691009288440677, 3691008883689736, 3691008166464346, 3691006981573262, 3691006161587038,
        3691006096575173, 3691005144468207, 3691003485620964, 3691000060971351, 3690997043170242,
        3690996321749472, 3690996135103164, 3690995382225505, 3690995111692949, 3690993836624804,
        3690993792584507, 3690993759029296, 3690991586380427, 3690991047412423, 3690988434360493,
        3690984552532551, 3690984504298157, 3690983711574697, 3690983319406839, 3690980674898855,
        3690977954892512, 3690975960500846, 3690975761271427, 3690975566236224, 3690975008394178,
        3690974588962916, 3690973250980396, 3690972414217080, 3632317857794484, 3632317562095968,
        3632315240549297, 3632310272395487, 3632310232550227, 3632307669830501, 3632304429730710,
        3632301009274958, 3546982171806122, 3546980353575340, 3546976410929719, 3546973550413852,
        3546972304705942, 3546971077871707, 3546969815386478, 3546969618254304, 3546960407562771,
        3546956750129574, 3546956448139677, 3546952641808805, 3546949777099007, 3546949040998471,
        3546945094158616, 3546941145221371, 3546933041826309, 3546932737739717, 3546929956915540,
        3546929038363141, 3546925057968871, 3546923719986081, 3546923153754838, 3546908664531107,
        3546908576450742, 3546906301041587, 3546904818354565, 3546904046603226, 3546898696768115,
        3546894485686533, 3546894185793910, 3546893619562746, 3546892705204595, 3546887768508617,
        3546887204375175, 3546887143558096, 3546885920918099, 3546884266264929, 3546883588885346,
        3546876341127724, 3546873126194130, 3546873015044963, 3546872937450079, 3546867986073647,
        3546865817618629, 3546861952567527, 3546860262263575, 3546858708273441, 3546854457346479,
        3546845242460279, 3546842417596995, 3546841683593414, 3546839022307640, 3546837176814138,
        3546837050984979, 3546830090537921, 3546827532012126, 3546818006747989, 3546815137843470,
        3546813036497395, 3546812866628228, 3546804427688293, 3546803716753800, 3546801583949995,
        3546800774450136, 3546796831803973, 3546794692709235, 3546782153837391, 3546778458655002,
        3546775782688922, 3546768329411443, 3546767947728995, 3546767622670566, 3546765292734969,
        3546761796782740, 3546758183389249, 3546752084871864, 3546747469040371, 3546742458943972,
        3546738417731679, 3546737104915369, 3546735225867087, 3546715051264659, 3546703990884951,
        3546703303018998, 3546703235910275, 3546702845839589, 3546702361398113, 3546699903535792,
        3546696982202433, 3546696202062455, 3546676704839805, 3546659543845721, 3546659453667825,
        3546651104906203, 3546649886460126, 3546645224491266, 3546641567058455, 3546637743950073,
        3546633918745060, 3546631624460709, 3546631391677215, 3546627316910309, 3546622571055777,
        3546609468050225, 3546607760968558, 3546606706100783, 3546605166791620, 3546601092025038,
        3546601085733775, 3546586915277059, 3546586277742956, 3546567615187488, 3546562061929069,
        3546376168278247, 3546376105363858, 3546375721585380, 3546375287474237, 3546375079856821,
        3537125219764823, 3537115912603949, 3537109038140047, 3537107760974211, 3494379931044716,
        3494379429825030, 3494377114569141, 3494376302971068, 3494361006344863, 3494360033266481,
        3494360014392167, 3494359196502568, 3494354448550497, 3494350841449351, 3493298362649093,
        3493280140495629, 3493273152785234, 3493273152784750, 3493263489108210, 3493260081236479,
        3493143859169860, 3493142844148692, 3493139448859170, 3493137796302932, 3493131165109004,
        3493121042155548, 3493119486069700, 3493118775134548, 3493117237922736, 3493116321466420,
        3493113819564288, 3493107326781990, 3493087261231790, 3493082142083729, 3461578313697453,
        3461575132318041, 3461573414751107, 3461569400801311, 3461569107200530, 295324948528,
        2138929383, 2133994420, 2131643251, 2119535493, 2097530452, 2095520539, 2093095586,
        2085498657, 2081115983, 2080501315, 2055372128, 2049657125, 2048763398, 2034913084,
        2025323195, 2024158970, 2009679595, 2006571384, 1998356989, 1982796117, 1973990683,
        1971665011, 1971646742, 1958617894, 1934862028, 1903716905, 1899665940, 1892602172,
        1885566910, 1855466698, 1853476526, 1842055358, 1839279562, 1779003750, 1754063822,
        1745943693, 1740243450, 1735147056, 1725493699, 1710481420, 1710170587, 1675861151,
        1674841836, 1674304271, 1639803873, 1638653698, 1637836360, 1602800379, 1601618208,
        1595981781, 1595616019, 1569543620, 1564603663, 1559240108, 1537721999, 1521525945,
        1521282487, 1499040833, 1486598309, 1481407533, 1470504154, 1444689344, 1444609351,
        1440688461, 1432074630, 1420280630, 1383344037, 1348115483, 1338195498, 1337864873,
        1330795522, 1327047804, 1275420254, 1266220172, 1255547159, 1237007791, 1235537870,
        1233905841, 1216964566, 1185448500, 1131820054, 1125748274, 1125520516, 1118049019,
        1106737683, 1098514316, 1096717489, 1093716905, 1053600362, 1036832739, 1020085742,
        1009914381, 1005146783, 699720335, 692425677, 689615748, 687363586, 679258408,
        676542562, 672217706, 671341674, 671280077, 670944584, 668400366, 652422218,
        651887366, 650306577, 649078769, 646620681, 632734568, 630626303, 628308532,
        627849091, 617619577, 614653483, 594681068, 594315882, 590197594, 586030840,
        577203014, 555909391, 551232423, 547204414, 547041547, 527652229, 527452131,
        524958708, 522563547, 521420822, 521025515, 519307036, 519221759, 518915122,
        518855579, 515642657, 513357054, 512891285, 511245083, 510937617, 509966928,
        506095751, 504232537, 503678559, 503592198, 500188152, 496478627, 495074598,
        494225469, 492621057, 490020084, 490012117, 488521945, 487324682, 487299719,
        485949457, 484451385, 484010154, 483899818, 478153894, 477670053, 476963973,
        475728479, 475545037, 474031725, 457209019, 456278471, 455845582, 454363823,
        449322534, 449307931, 448574792, 448331360, 445659546, 443163660, 442256253,
        441049298, 438467411, 438463610, 438386316, 437836321, 437712757, 437260776,
        436940840, 436051379, 435968896, 435152837, 434457964, 433986955, 431582836,
        418358098, 418022431, 415385886, 415366380, 413477522, 413134715, 411889694,
        410859642, 409818490, 407080164, 407044333, 404635045, 404567214, 404229189,
        401177297, 399829446, 399822971, 399264706, 398041341, 397170530, 396917599,
        396462588, 389528410, 389123543, 388047114, 386126486, 384576226, 382051373,
        381162346, 372370843, 367826039, 363300086, 359287122, 358724524, 357503301,
        356275560, 356208729, 355774826, 354546067, 350533527, 349300363, 349007692,
        348591192, 348476776, 347066151, 345200010, 342879704, 342416693, 336866345,
        329058164, 327091354, 325758991, 319215883, 319163405, 317997579, 316788785,
        316581750, 305814458, 304321880, 301916181, 293935987, 293276015, 292062188,
        291957754, 290763091, 289507372, 288804279, 288116640, 287007179, 283060751,
        282516252, 282514356, 282501677, 282204203, 280617239, 280433966, 277723686,
        276521307, 262533209, 260638189, 256316789, 255889028, 251118621, 228325094,
        226948912, 223953558, 214317169, 207509299, 200549362, 199390163, 181759643,
        177925560, 174024428, 172512894, 168187546, 167596254, 166094490, 163413521,
        163085600, 162651150, 158912612, 157800146, 157345176, 151037538, 148050147,
        146788900, 145541311, 133702330, 117560566, 115524870, 112017404, 102092676,
        100680137, 95134344, 94745687, 94245663, 93648063, 90049046, 86454011,
        85881543, 85715921, 85663920, 85342976, 85273642, 83924685, 83539478,
        82925509, 71582221, 63273456, 62452497, 62426433, 59925015, 57203552,
        55427454, 54768934, 54409738, 50432071, 49591592, 49583331, 44498964,
        44264187, 42242939, 41166123, 40806309, 40014892, 39584786, 39519449,
        39480939, 39293737, 38608862, 37742542, 37635073, 36837537, 35048119,
        34837579, 34762695, 31436684, 29013534, 28283601, 28151830, 26124997,
        24918013, 23890901, 23694281, 23327927, 23171467, 22965985, 21592362,
        20113643, 19886233, 19406260, 19122398, 18379267, 18249325, 17775253,
        17632907, 17373333, 17116643, 16203551, 15568225, 14694117, 13946449,
        13869782, 13624393, 13214647, 13051577, 11895206, 11717829, 11702912,
        11641327, 10453721, 8558045, 8489048, 7999027, 7519055, 7445941,
        6522561, 6439610, 4921148, 4113441, 3774254, 3253539, 2957307,
        2790899, 2114879, 1915800, 1858271, 1537168, 1528178, 1420255,
        892351, 874754, 762085, 761733, 518556, 512347, 430913
    ];

    let BLACKLIST_UIDS = [];
    let DATA_SOURCE = '备用数据';
    /** 防止重复启动批量拉黑 */
    let batchBlockRunning = false;
    /** 批量拉黑暂停状态 */
    let batchBlockPaused = false;
    /** 批量拉黑完成状态 */
    let batchBlockFinished = false;
    /** A盾黑名单上次刷新时间 */
    let lastRefreshTime = 0;
    /** 我的黑名单UID集合（用于快速检查） */
    let myBlacklistUids = new Set();
    /** 已跳过的用户数量 */
    let skippedCount = 0;
    /** 详细日志记录 */
    let blockDetailsLog = [];
    /** 最大日志条数 */
    const MAX_LOG_ENTRIES = 1000;
    
    /** 更新状态显示 */
    function updateStatusDisplay() {
        const statusEl = document.getElementById('bl-current-status');
        if (statusEl) {
            let statusText = '待运行';
            let statusColor = '#9499a0';
            
            if (batchBlockPaused) {
                statusText = '已暂停';
                statusColor = '#faad14';
            } else if (batchBlockRunning) {
                statusText = '运行中';
                statusColor = '#52c41a';
            } else if (batchBlockFinished) {
                statusText = '已完成';
                statusColor = '#13c2c2';
            }
            
            statusEl.textContent = statusText;
            statusEl.style.color = statusColor;
        }
    }

    /**
     * 加载我的黑名单（用于快速检查）
     */
    async function loadMyBlacklist() {
        if (!isLoggedIn()) {
            console.log('未登录，无法加载我的黑名单');
            return;
        }
        
        try {
            console.log('🔄 正在加载我的黑名单...');
            const records = await fetchAllMyBilibiliBlacks();
            
            myBlacklistUids.clear();
            for (const item of records) {
                myBlacklistUids.add(item.uid);
            }
            
            console.log(`✅ 我的黑名单加载完成，共 ${myBlacklistUids.size} 个用户`);
        } catch (error) {
            console.warn('⚠️ 加载我的黑名单失败:', error);
        }
    }

    /**
     * 检查用户是否已在黑名单中
     * @param {number} uid - 用户UID
     * @returns {boolean}
     */
    function isUserAlreadyBlocked(uid) {
        return myBlacklistUids.has(uid);
    }

    /**
     * 更新跳过计数显示
     */
    function updateSkippedCountDisplay() {
        const skippedEl = document.getElementById('bl-skipped-count');
        if (skippedEl) {
            skippedEl.textContent = String(skippedCount);
        }
    }

    /**
     * 添加详细日志记录
     * @param {Object} entry - 日志条目
     */
    function addBlockLogEntry(entry) {
        const logEntry = {
            timestamp: new Date().toLocaleString(),
            uid: entry.uid,
            status: entry.status, // 'success', 'failed', 'skipped', 'error'
            message: entry.message || '',
            index: entry.index,
            total: entry.total
        };
        
        blockDetailsLog.push(logEntry);
        
        // 限制日志数量
        if (blockDetailsLog.length > MAX_LOG_ENTRIES) {
            blockDetailsLog = blockDetailsLog.slice(-MAX_LOG_ENTRIES);
        }
    }

    /**
     * 清空详细日志
     */
    function clearBlockLog() {
        blockDetailsLog = [];
    }

    /**
     * 获取日志统计信息
     */
    function getBlockLogStats() {
        const stats = {
            success: 0,
            failed: 0,
            skipped: 0,
            error: 0,
            total: blockDetailsLog.length
        };
        
        for (const entry of blockDetailsLog) {
            if (stats[entry.status] !== undefined) {
                stats[entry.status]++;
            }
        }
        
        return stats;
    }

    // ==================== 工具函数 ====================

    /**
     * 跨域拉取文本：优先 GM_xmlhttpRequest（不受页面 CORS 限制），否则回退 fetch
     */
    function fetchText(url) {
        if (typeof GM_xmlhttpRequest !== 'undefined') {
            return new Promise((resolve, reject) => {
                GM_xmlhttpRequest({
                    method: 'GET',
                    url: url,
                    headers: { 'Accept': 'application/json, text/html;q=0.9, */*;q=0.8' },
                    timeout: 60000,
                    onload: function(response) {
                        if (response.status >= 200 && response.status < 300) {
                            resolve(response.responseText);
                        } else {
                            reject(new Error(`HTTP ${response.status}`));
                        }
                    },
                    onerror: function() {
                        reject(new Error('网络请求失败'));
                    },
                    ontimeout: function() {
                        reject(new Error('请求超时'));
                    }
                });
            });
        }
        return fetch(url, {
            mode: 'cors',
            credentials: 'omit',
            headers: { 'Accept': 'application/json, text/html;q=0.9, */*;q=0.8' }
        }).then(function(r) {
            if (!r.ok) {
                throw new Error(`HTTP ${r.status}`);
            }
            return r.text();
        });
    }

    /**
     * 从 listing.ssrv2.ltd 获取黑名单数据
     */
    async function fetchBlacklistFromRemote() {
        let result = {
            success: false,
            fromRemote: false,
            fromCache: false,
            fromFallback: false,
            count: 0,
            error: null
        };

        try {
            console.log('🔄 正在从 listing.ssrv2.ltd API 获取黑名单数据...');

            const uids = await fetchAllUidsFromPublicApi();

            if (uids && uids.length > 0) {
                BLACKLIST_UIDS = uids;
                DATA_SOURCE = 'A盾黑名单';
                saveBlacklistCache(uids);
                console.log(`✅ 成功获取 ${uids.length} 条黑名单数据`);
                result.success = true;
                result.fromRemote = true;
                result.count = uids.length;
                return result;
            } else {
                throw new Error('未找到UID数据');
            }
        } catch (error) {
            console.warn('⚠️ 从远程获取黑名单失败:', error);
            result.error = error;
            
            const cached = getBlacklistCache();
            if (cached && cached.length > 0) {
                BLACKLIST_UIDS = cached;
                DATA_SOURCE = '本地缓存';
                console.log(`✅ 使用本地缓存数据: ${cached.length} 条`);
                result.success = true;
                result.fromCache = true;
                result.count = cached.length;
                return result;
            } else {
                BLACKLIST_UIDS = FALLBACK_UIDS;
                DATA_SOURCE = '备用数据';
                console.log(`⚠️ 使用备用数据: ${FALLBACK_UIDS.length} 条`);
                result.success = true;
                result.fromFallback = true;
                result.count = FALLBACK_UIDS.length;
                return result;
            }
        }
    }

    /**
     * 分页拉取公示站 JSON API，合并为 UID 列表
     */
    async function fetchAllUidsFromPublicApi() {
        const limit = CONFIG.API_PAGE_SIZE;
        const seen = new Set();
        const uids = [];
        let offset = 0;
        let hasMore = true;

        while (hasMore) {
            const apiUrl =
                CONFIG.BLACKLIST_API_URL +
                '?' +
                new URLSearchParams({ offset: String(offset), limit: String(limit) }).toString();
            const text = await fetchText(apiUrl);
            let data;
            try {
                data = JSON.parse(text);
            } catch (e) {
                throw new Error('API 返回非 JSON');
            }
            if (!data.success || !Array.isArray(data.list)) {
                throw new Error(data.error || '无法解析黑名单 API 响应');
            }
            for (let i = 0; i < data.list.length; i++) {
                const raw = data.list[i] && data.list[i].uid;
                const uid = raw != null ? parseInt(String(raw), 10) : NaN;
                if (Number.isFinite(uid) && !seen.has(uid)) {
                    seen.add(uid);
                    uids.push(uid);
                }
            }
            if (data.list.length === 0) {
                break;
            }
            offset += data.list.length;
            hasMore = Boolean(data.hasMore) && data.list.length > 0;
        }

        return uids;
    }

    /**
     * 从HTML中解析UID
     */
    function parseUidsFromHtml(html) {
        const seen = new Set();
        const uidPattern = /space\.bilibili\.com\/(\d+)/g;
        let match;
        while ((match = uidPattern.exec(html)) !== null) {
            const uid = parseInt(match[1], 10);
            if (!seen.has(uid)) {
                seen.add(uid);
            }
        }
        return Array.from(seen);
    }

    /**
     * 保存黑名单缓存（使用 GM 存储实现跨域名共享）
     */
    function saveBlacklistCache(uids) {
        try {
            if (typeof GM_setValue !== 'undefined') {
                GM_setValue(CONFIG.CACHE_KEY, JSON.stringify(uids));
            }
            localStorage.setItem(CONFIG.CACHE_KEY, JSON.stringify(uids));
        } catch (e) {
            console.warn('缓存保存失败:', e);
        }
    }

    /**
     * 获取黑名单缓存（优先使用 GM 存储实现跨域名共享）
     */
    function getBlacklistCache() {
        try {
            if (typeof GM_getValue !== 'undefined') {
                const cached = GM_getValue(CONFIG.CACHE_KEY);
                if (cached) {
                    return JSON.parse(cached);
                }
            }
            const cached = localStorage.getItem(CONFIG.CACHE_KEY);
            return cached ? JSON.parse(cached) : null;
        } catch (e) {
            return null;
        }
    }

    /**
     * 获取CSRF Token
     */
    function getCsrfToken() {
        const match = document.cookie.match(/bili_jct=([^;]+)/);
        return match ? match[1] : '';
    }

    /**
     * 获取当前登录用户的UID
     */
    function getCurrentUid() {
        const match = document.cookie.match(/DedeUserID=([^;]+)/);
        return match ? match[1] : '';
    }

    /**
     * 检查是否已登录
     */
    function isLoggedIn() {
        return !!getCurrentUid();
    }

    /**
     * 拉黑单个用户
     * @param {number} uid - 用户UID
     * @returns {Promise<Object>} 包含成功状态和详细信息的对象
     */
    async function blockUser(uid) {
        const result = {
            success: false,
            message: '',
            code: null,
            data: null
        };

        const csrf = getCsrfToken();
        if (!csrf) {
            result.message = '无法获取CSRF Token';
            console.error('❌ ' + result.message);
            return result;
        }

        try {
            const response = await fetch('https://api.bilibili.com/x/relation/modify', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'X-Requested-With': 'XMLHttpRequest',
                    'Referer': `https://space.bilibili.com/${uid}`
                },
                credentials: 'include',
                body: new URLSearchParams({
                    fid: uid.toString(),
                    act: '5',  // 5 = 加入黑名单
                    re_src: '11',
                    csrf: csrf
                })
            });

            const data = await response.json();
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
                console.error(`❌ 拉黑用户 ${uid} 失败:`, result.message);
            }
        } catch (error) {
            result.message = error.message || '网络错误';
            console.error(`❌ 拉黑用户 ${uid} 时出错:`, error);
        }

        return result;
    }

    /**
     * 延迟函数
     */
    function delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * 保存进度（使用 GM 存储实现跨域名共享）
     */
    function saveProgress(index) {
        if (typeof GM_setValue !== 'undefined') {
            GM_setValue(CONFIG.STORAGE_KEY, index.toString());
        }
        localStorage.setItem(CONFIG.STORAGE_KEY, index.toString());
    }

    /**
     * 获取进度（优先使用 GM 存储实现跨域名共享）
     */
    function getProgress() {
        if (typeof GM_getValue !== 'undefined') {
            const saved = GM_getValue(CONFIG.STORAGE_KEY);
            if (saved) {
                return parseInt(saved, 10);
            }
        }
        const saved = localStorage.getItem(CONFIG.STORAGE_KEY);
        return saved ? parseInt(saved, 10) : 0;
    }

    /**
     * 清除进度
     */
    function clearProgress() {
        if (typeof GM_setValue !== 'undefined') {
            GM_setValue(CONFIG.STORAGE_KEY, '0');
        }
        localStorage.removeItem(CONFIG.STORAGE_KEY);
    }

    // ==================== 批量拉黑功能 ====================

    /**
     * 批量拉黑用户
     * @param {number} startIndex - 开始索引
     */
    async function batchBlock(startIndex = 0) {
        if (batchBlockRunning) {
            alert('批量拉黑正在进行中，请等待当前任务结束。');
            return;
        }
        if (!isLoggedIn()) {
            alert('请先登录B站账号！');
            return;
        }

        batchBlockRunning = true;
        batchBlockFinished = false;
        skippedCount = 0;
        const total = BLACKLIST_UIDS.length;
        let success = 0;
        let failed = 0;
        
        // 更新按钮为暂停状态
        const btn = document.getElementById('bl-control-batch');
        if (btn) {
            btn.innerHTML = '⏸️ 暂停批量拉黑';
            btn.style.background = '#faad14';
        }
        
        // 更新状态显示
        updateStatusDisplay();

        try {
            // 如果启用跳过已拉黑用户，先加载我的黑名单
            if (CONFIG.SKIP_ALREADY_BLOCKED) {
                await loadMyBlacklist();
            }
            
            console.log(`🚀 开始批量拉黑，从第 ${startIndex + 1} 个用户开始，共 ${total} 个用户`);
            
            // 清空之前的日志记录
            clearBlockLog();

            for (let i = startIndex; i < total; i++) {
                // 检查是否暂停
                while (batchBlockPaused) {
                    console.log('⏸️ 批量拉黑已暂停，等待继续...');
                    await delay(1000); // 每秒钟检查一次
                }
                
                const uid = BLACKLIST_UIDS[i];
                
                // 检查是否需要跳过已拉黑的用户
                if (CONFIG.SKIP_ALREADY_BLOCKED && isUserAlreadyBlocked(uid)) {
                    console.log(`⏭️ 跳过已拉黑用户: ${uid}`);
                    skippedCount++;
                    updateSkippedCountDisplay();
                    
                    // 记录跳过日志
                    addBlockLogEntry({
                        uid: uid,
                        status: 'skipped',
                        message: '用户已在黑名单中',
                        index: i + 1,
                        total: total
                    });
                    
                    // 保存进度
                    saveProgress(i + 1);
                    
                    // 显示进度通知
                    if ((i + 1) % CONFIG.BATCH_SIZE === 0 || i === total - 1) {
                        showNotification(
                            '批量拉黑进度',
                            `已处理: ${i + 1}/${total}\n成功: ${success}  失败: ${failed}\n跳过: ${skippedCount}`
                        );
                    }
                    continue;
                }
                
                console.log(`[${i + 1}/${total}] 正在处理用户: ${uid}`);

                let blockResult;
                try {
                    blockResult = await blockUser(uid);
                } catch (error) {
                    blockResult = {
                        success: false,
                        message: error.message || '未知错误'
                    };
                }

                if (blockResult.success) {
                    success++;
                    // 成功拉黑后添加到本地集合，避免重复处理
                    myBlacklistUids.add(uid);
                    
                    // 记录成功日志
                    addBlockLogEntry({
                        uid: uid,
                        status: 'success',
                        message: blockResult.message,
                        index: i + 1,
                        total: total
                    });
                } else {
                    failed++;
                    
                    // 记录失败/错误日志
                    addBlockLogEntry({
                        uid: uid,
                        status: 'failed',
                        message: blockResult.message,
                        index: i + 1,
                        total: total
                    });
                }

                // 保存进度
                saveProgress(i + 1);

                // 显示进度通知
                if ((i + 1) % CONFIG.BATCH_SIZE === 0 || i === total - 1) {
                    showNotification(
                        '批量拉黑进度',
                        `已处理: ${i + 1}/${total}\n成功: ${success}  失败: ${failed}\n跳过: ${skippedCount}`
                    );
                }

                // 延迟处理下一个
                if (i < total - 1) {
                    await delay(CONFIG.USER_INTERVAL);
                }

                // 每批处理后额外延迟
                if ((i + 1) % CONFIG.BATCH_SIZE === 0 && i < total - 1) {
                    console.log(`⏳ 批次完成，等待 ${CONFIG.BATCH_INTERVAL}ms 后继续...`);
                    await delay(CONFIG.BATCH_INTERVAL);
                }
            }

            console.log(`✅ 批量拉黑完成！成功: ${success}, 失败: ${failed}, 跳过: ${skippedCount}`);
            batchBlockFinished = true;
            // 批量拉黑完成时显示系统通知
            showNotification(
                '批量拉黑完成',
                `总计: ${total}\n成功: ${success}\n失败: ${failed}\n跳过: ${skippedCount}`,
                true
            );

            // 完成后将进度设置为总数，显示为满的
            if (success + failed + skippedCount === total) {
                saveProgress(total);
            }
        } finally {
            batchBlockRunning = false;
            batchBlockPaused = false;
            // 更新按钮为开始/继续状态
            if (btn) {
                const progress = getProgress();
                btn.innerHTML = progress > 0 ? '▶️ 继续批量拉黑' : '▶️ 开始批量拉黑';
                btn.style.background = '#00a1d6';
            }
            // 更新状态显示
            updateStatusDisplay();
        }
    }

    /**
     * 显示通知
     * @param {string} title - 通知标题
     * @param {string} message - 通知内容
     * @param {boolean} showSystem - 是否显示系统通知（仅批量拉黑完成时显示）
     */
    function showNotification(title, message, showSystem = false) {
        // 只有批量拉黑完成时才显示系统通知
        if (showSystem && typeof GM_notification !== 'undefined') {
            GM_notification({
                title: title,
                text: message
                // 不设置 timeout，通知将持续显示直到用户手动关闭
            });
        }

        // 始终在页面显示浮动提示
        showFloatingTip(title, message);
    }

    /**
     * 显示浮动提示
     */
    function showFloatingTip(title, message) {
        const existing = document.getElementById('bilibili-blacklist-tip');
        if (existing) existing.remove();

        const tip = document.createElement('div');
        tip.id = 'bilibili-blacklist-tip';
        tip.style.cssText = `
            position: fixed;
            top: 100px;
            right: 320px;
            background: linear-gradient(135deg, #00a1d6, #00b5e5);
            color: white;
            padding: 15px 20px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            z-index: 99999;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            max-width: 300px;
            animation: slideIn 0.3s ease;
        `;
        const titleEl = document.createElement('div');
        titleEl.style.cssText = 'font-weight: bold; margin-bottom: 8px; font-size: 14px;';
        titleEl.textContent = title;
        const msgEl = document.createElement('div');
        msgEl.style.cssText = 'font-size: 13px; line-height: 1.5; white-space: pre-line;';
        msgEl.textContent = message;
        tip.appendChild(titleEl);
        tip.appendChild(msgEl);

        // 添加动画样式
        if (!document.getElementById('bilibili-blacklist-style')) {
            const style = document.createElement('style');
            style.id = 'bilibili-blacklist-style';
            style.textContent = `
                @keyframes slideIn {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
            `;
            document.head.appendChild(style);
        }

        document.body.appendChild(tip);

        setTimeout(() => {
            tip.style.animation = 'slideIn 0.3s ease reverse';
            setTimeout(() => tip.remove(), 300);
        }, 5000);
    }

    // ==================== 控制面板 ====================

    /**
     * 将当前内存中的黑名单 UID 导出为 txt（每行一个）
     */
    function exportBlacklistUids() {
        if (!BLACKLIST_UIDS.length) {
            alert('当前没有可导出的 UID');
            return;
        }
        const text = BLACKLIST_UIDS.join('\n');
        const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'blacklist-uids-' + new Date().toISOString().slice(0, 10) + '.txt';
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showNotification('导出成功', `已下载 ${BLACKLIST_UIDS.length} 条 UID（每行一个）`);
    }

    /**
     * 读取“我账号当前已拉黑”列表并导出 UID
     */
    async function exportMyBilibiliBlacklist() {
        if (!isLoggedIn()) {
            alert('请先登录B站账号！');
            return;
        }

        try {
            const records = await fetchAllMyBilibiliBlacks();
            if (!records.length) {
                alert('当前账号黑名单为空，未导出文件。');
                return;
            }

            const uidLines = records.map(item => String(item.uid));
            const text = uidLines.join('\n');
            const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'bilibili-my-blacklist-uids-' + new Date().toISOString().slice(0, 10) + '.txt';
            a.style.display = 'none';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            showNotification('导出成功', `已导出你账号黑名单 ${records.length} 条 UID`);
        } catch (error) {
            console.error('❌ 导出 B站账号黑名单失败:', error);
            alert(`导出失败：${error && error.message ? error.message : '未知错误'}`);
        }
    }

    /**
     * 拉取 B站账号黑名单（分页）
     */
    async function fetchAllMyBilibiliBlacks() {
        const ps = CONFIG.BILI_BLACKS_PAGE_SIZE;
        const seen = new Set();
        const out = [];
        let pn = 1;
        let keepLoading = true;

        while (keepLoading) {
            const url = CONFIG.BILI_BLACKS_API_URL + '?' + new URLSearchParams({
                pn: String(pn),
                ps: String(ps)
            }).toString();

            const resp = await fetch(url, {
                method: 'GET',
                credentials: 'include',
                headers: { 'Accept': 'application/json, text/plain, */*' }
            });
            const data = await resp.json();
            if (!resp.ok) {
                throw new Error(`HTTP ${resp.status}`);
            }
            if (!data || data.code !== 0) {
                throw new Error((data && (data.message || data.msg)) || '接口返回异常');
            }

            const payload = data.data || {};
            const list = Array.isArray(payload.list) ? payload.list : [];
            const total = Number.isFinite(payload.total) ? payload.total : null;

            for (let i = 0; i < list.length; i++) {
                const item = list[i] || {};
                const uid = parseInt(String(item.mid || item.uid || ''), 10);
                if (Number.isFinite(uid) && !seen.has(uid)) {
                    seen.add(uid);
                    out.push({ uid: uid, raw: item });
                }
            }

            if (list.length < ps) {
                break;
            }
            if (total !== null && out.length >= total) {
                break;
            }
            pn += 1;
            keepLoading = pn <= 200;
        }

        return out;
    }

    /**
     * 从用户粘贴或文件内容中解析 UID（支持每行一个、逗号/分号分隔、space.bilibili.com 链接）
     */
    function parseUidsFromImportText(text) {
        const seen = new Set();
        const out = [];
        function addUid(uid) {
            if (typeof uid !== 'number' || !Number.isFinite(uid) || uid <= 0) {
                return;
            }
            if (!seen.has(uid)) {
                seen.add(uid);
                out.push(uid);
            }
        }
        const linkRe = /space\.bilibili\.com\/(\d+)/gi;
        let m;
        while ((m = linkRe.exec(text)) !== null) {
            addUid(parseInt(m[1], 10));
        }
        const parts = text.split(/[\n,;，；\r\t]+/);
        for (let i = 0; i < parts.length; i++) {
            let part = parts[i].trim();
            if (!part) {
                continue;
            }
            part = part.replace(/^UID[:\s：]*/i, '').trim();
            const digits = part.match(/^(\d{5,})$/);
            if (digits) {
                addUid(parseInt(digits[1], 10));
            }
        }
        return out;
    }

    /**
     * 应用导入的 UID 列表（写入缓存并清空进度）
     */
    function applyImportedUids(uids) {
        BLACKLIST_UIDS = uids;
        DATA_SOURCE = '用户导入';
        batchBlockFinished = false;
        saveBlacklistCache(uids);
        clearProgress();
    }

    /**
     * 显示详细日志查看面板
     */
    function showDetailsPanel() {
        const existing = document.getElementById('bilibili-blacklist-details-overlay');
        if (existing) {
            existing.remove();
        }

        const overlay = document.createElement('div');
        overlay.id = 'bilibili-blacklist-details-overlay';
        overlay.style.cssText = `
            position: fixed;
            inset: 0;
            z-index: 100001;
            background: rgba(0,0,0,0.5);
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
            box-sizing: border-box;
        `;

        const box = document.createElement('div');
        box.style.cssText = `
            background: #fff;
            border-radius: 12px;
            box-shadow: 0 8px 32px rgba(0,0,0,0.3);
            width: 100%;
            max-width: 700px;
            max-height: 85vh;
            display: flex;
            flex-direction: column;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        `;

        // 获取统计数据
        const stats = getBlockLogStats();

        // 标题栏
        const titleRow = document.createElement('div');
        titleRow.style.cssText = 'display: flex; justify-content: space-between; align-items: center; padding: 16px 20px; border-bottom: 1px solid #e3e5e7; background: #f6f7f8; border-radius: 12px 12px 0 0;';
        
        const titleLeft = document.createElement('div');
        titleLeft.innerHTML = `
            <h3 style="margin: 0; font-size: 16px; color: #18191c;">📋 拉黑详细记录</h3>
            <div style="font-size: 12px; color: #61666d; margin-top: 4px;">
                总计: ${stats.total} | 
                <span style="color: #52c41a;">成功: ${stats.success}</span> | 
                <span style="color: #f5222d;">失败: ${stats.failed}</span> | 
                <span style="color: #13c2c2;">跳过: ${stats.skipped}</span> | 
                <span style="color: #faad14;">错误: ${stats.error}</span>
            </div>
        `;

        const closeBtn = document.createElement('button');
        closeBtn.type = 'button';
        closeBtn.textContent = '×';
        closeBtn.style.cssText = 'background: none; border: none; cursor: pointer; font-size: 24px; color: #9499a0; line-height: 1; padding: 0; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center;';
        closeBtn.addEventListener('click', () => overlay.remove());
        
        titleRow.appendChild(titleLeft);
        titleRow.appendChild(closeBtn);

        // 筛选按钮区域
        const filterRow = document.createElement('div');
        filterRow.style.cssText = 'display: flex; gap: 8px; padding: 12px 20px; border-bottom: 1px solid #e3e5e7; background: #fafbfc;';
        
        const filters = [
            { key: 'all', label: '全部', color: '#18191c' },
            { key: 'success', label: '成功', color: '#52c41a' },
            { key: 'failed', label: '失败', color: '#f5222d' },
            { key: 'skipped', label: '跳过', color: '#13c2c2' },
            { key: 'error', label: '错误', color: '#faad14' }
        ];
        
        let currentFilter = 'all';
        const filterButtons = {};
        
        filters.forEach(f => {
            const btn = document.createElement('button');
            btn.textContent = f.label;
            btn.style.cssText = `
                padding: 6px 14px;
                border: 1px solid ${f.key === 'all' ? '#00a1d6' : f.color};
                background: ${f.key === 'all' ? '#00a1d6' : '#fff'};
                color: ${f.key === 'all' ? '#fff' : f.color};
                border-radius: 4px;
                cursor: pointer;
                font-size: 13px;
                transition: all 0.2s;
            `;
            btn.addEventListener('click', () => {
                currentFilter = f.key;
                // 更新按钮样式
                Object.keys(filterButtons).forEach(key => {
                    const b = filterButtons[key];
                    const filterInfo = filters.find(x => x.key === key);
                    if (key === currentFilter) {
                        b.style.background = filterInfo.color;
                        b.style.color = '#fff';
                    } else {
                        b.style.background = '#fff';
                        b.style.color = filterInfo.color;
                    }
                });
                renderLogList();
            });
            filterButtons[f.key] = btn;
            filterRow.appendChild(btn);
        });

        // 清空日志按钮
        const clearBtn = document.createElement('button');
        clearBtn.textContent = '🗑️ 清空记录';
        clearBtn.style.cssText = 'margin-left: auto; padding: 6px 14px; border: 1px solid #ff4d4f; background: #fff; color: #ff4d4f; border-radius: 4px; cursor: pointer; font-size: 13px;';
        clearBtn.addEventListener('click', () => {
            if (confirm('确定要清空所有记录吗？')) {
                clearBlockLog();
                renderLogList();
                // 更新标题统计
                const newStats = getBlockLogStats();
                titleLeft.innerHTML = `
                    <h3 style="margin: 0; font-size: 16px; color: #18191c;">📋 拉黑详细记录</h3>
                    <div style="font-size: 12px; color: #61666d; margin-top: 4px;">
                        总计: ${newStats.total} | 
                        <span style="color: #52c41a;">成功: ${newStats.success}</span> | 
                        <span style="color: #f5222d;">失败: ${newStats.failed}</span> | 
                        <span style="color: #13c2c2;">跳过: ${newStats.skipped}</span> | 
                        <span style="color: #faad14;">错误: ${newStats.error}</span>
                    </div>
                `;
            }
        });
        filterRow.appendChild(clearBtn);

        // 日志列表区域
        const listContainer = document.createElement('div');
        listContainer.style.cssText = 'flex: 1; overflow-y: auto; padding: 0; max-height: 50vh;';

        function renderLogList() {
            listContainer.innerHTML = '';
            
            const filteredLogs = currentFilter === 'all' 
                ? [...blockDetailsLog].reverse()
                : blockDetailsLog.filter(entry => entry.status === currentFilter).reverse();
            
            if (filteredLogs.length === 0) {
                const emptyMsg = document.createElement('div');
                emptyMsg.style.cssText = 'text-align: center; padding: 40px; color: #9499a0; font-size: 14px;';
                emptyMsg.textContent = '暂无记录';
                listContainer.appendChild(emptyMsg);
                return;
            }

            const table = document.createElement('table');
            table.style.cssText = 'width: 100%; border-collapse: collapse; font-size: 13px;';
            
            // 表头
            const thead = document.createElement('thead');
            thead.style.cssText = 'position: sticky; top: 0; background: #fff; z-index: 1;';
            thead.innerHTML = `
                <tr style="border-bottom: 1px solid #e3e5e7;">
                    <th style="padding: 12px 16px; text-align: left; font-weight: 600; color: #18191c; width: 80px;">序号</th>
                    <th style="padding: 12px 16px; text-align: left; font-weight: 600; color: #18191c; width: 140px;">时间</th>
                    <th style="padding: 12px 16px; text-align: left; font-weight: 600; color: #18191c; width: 120px;">UID</th>
                    <th style="padding: 12px 16px; text-align: left; font-weight: 600; color: #18191c; width: 80px;">状态</th>
                    <th style="padding: 12px 16px; text-align: left; font-weight: 600; color: #18191c;">详情</th>
                </tr>
            `;
            table.appendChild(thead);
            
            // 表体
            const tbody = document.createElement('tbody');
            filteredLogs.forEach((entry, idx) => {
                const row = document.createElement('tr');
                row.style.cssText = 'border-bottom: 1px solid #f0f0f0; transition: background 0.2s;';
                row.addEventListener('mouseenter', () => row.style.background = '#f6f7f8');
                row.addEventListener('mouseleave', () => row.style.background = 'transparent');
                
                const statusColors = {
                    success: '#52c41a',
                    failed: '#f5222d',
                    skipped: '#13c2c2',
                    error: '#faad14'
                };
                
                const statusLabels = {
                    success: '成功',
                    failed: '失败',
                    skipped: '跳过',
                    error: '错误'
                };
                
                row.innerHTML = `
                    <td style="padding: 10px 16px; color: #61666d;">${entry.index}/${entry.total}</td>
                    <td style="padding: 10px 16px; color: #61666d; font-size: 12px;">${entry.timestamp}</td>
                    <td style="padding: 10px 16px; color: #18191c; font-family: monospace;">${entry.uid}</td>
                    <td style="padding: 10px 16px;">
                        <span style="display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 12px; background: ${statusColors[entry.status]}20; color: ${statusColors[entry.status]}; font-weight: 500;">
                            ${statusLabels[entry.status]}
                        </span>
                    </td>
                    <td style="padding: 10px 16px; color: #61666d; font-size: 12px;">${entry.message || '-'}</td>
                `;
                tbody.appendChild(row);
            });
            table.appendChild(tbody);
            listContainer.appendChild(table);
        }

        renderLogList();

        // 底部按钮
        const bottomRow = document.createElement('div');
        bottomRow.style.cssText = 'display: flex; justify-content: flex-end; padding: 16px 20px; border-top: 1px solid #e3e5e7; background: #f6f7f8; border-radius: 0 0 12px 12px;';
        
        const closeBottomBtn = document.createElement('button');
        closeBottomBtn.textContent = '关闭';
        closeBottomBtn.style.cssText = 'padding: 8px 24px; background: #00a1d6; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 14px; font-weight: 500;';
        closeBottomBtn.addEventListener('click', () => overlay.remove());
        bottomRow.appendChild(closeBottomBtn);

        box.appendChild(titleRow);
        box.appendChild(filterRow);
        box.appendChild(listContainer);
        box.appendChild(bottomRow);
        overlay.appendChild(box);
        document.body.appendChild(overlay);

        // 点击遮罩关闭
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                overlay.remove();
            }
        });
    }

    /**
     * 显示导入 UID 对话框（文本框 + 可选 txt 文件）
     */
    function showImportUidDialog() {
        const existing = document.getElementById('bilibili-blacklist-import-overlay');
        if (existing) {
            existing.remove();
        }

        const overlay = document.createElement('div');
        overlay.id = 'bilibili-blacklist-import-overlay';
        overlay.style.cssText = `
            position: fixed;
            inset: 0;
            z-index: 100000;
            background: rgba(0,0,0,0.45);
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 16px;
            box-sizing: border-box;
        `;

        const box = document.createElement('div');
        box.style.cssText = `
            background: #fff;
            border-radius: 12px;
            box-shadow: 0 8px 32px rgba(0,0,0,0.2);
            width: 100%;
            max-width: 420px;
            max-height: 90vh;
            display: flex;
            flex-direction: column;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        `;

        const titleRow = document.createElement('div');
        titleRow.style.cssText = 'display: flex; justify-content: space-between; align-items: center; padding: 16px 16px 8px; border-bottom: 1px solid #e3e5e7;';
        const h = document.createElement('h3');
        h.style.cssText = 'margin: 0; font-size: 16px; color: #18191c;';
        h.textContent = '📥 导入 UID';
        const closeBtn = document.createElement('button');
        closeBtn.type = 'button';
        closeBtn.textContent = '×';
        closeBtn.style.cssText = 'background: none; border: none; cursor: pointer; font-size: 20px; color: #9499a0; line-height: 1;';
        closeBtn.addEventListener('click', () => overlay.remove());
        titleRow.appendChild(h);
        titleRow.appendChild(closeBtn);

        const hint = document.createElement('div');
        hint.style.cssText = 'padding: 8px 16px; font-size: 12px; color: #61666d; line-height: 1.5;';
        hint.textContent = '每行一个 UID，或用逗号、分号分隔；也可粘贴个人空间链接。导入后将替换当前列表并清零拉黑进度。';

        const ta = document.createElement('textarea');
        ta.placeholder = '例如：\n123456789\nhttps://space.bilibili.com/987654321';
        ta.style.cssText = `
            margin: 0 16px;
            width: calc(100% - 32px);
            min-height: 160px;
            max-height: 40vh;
            padding: 10px;
            border: 1px solid #e3e5e7;
            border-radius: 8px;
            font-size: 13px;
            font-family: ui-monospace, monospace;
            resize: vertical;
            box-sizing: border-box;
        `;

        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = '.txt,text/plain';
        fileInput.style.display = 'none';

        const btnRow = document.createElement('div');
        btnRow.style.cssText = 'display: flex; flex-wrap: wrap; gap: 8px; padding: 12px 16px;';

        const pickFileBtn = document.createElement('button');
        pickFileBtn.type = 'button';
        pickFileBtn.textContent = '📄 选择 txt 文件';
        pickFileBtn.style.cssText = 'padding: 8px 12px; background: #f6f7f8; color: #18191c; border: 1px solid #e3e5e7; border-radius: 6px; cursor: pointer; font-size: 13px;';

        const cancelBtn = document.createElement('button');
        cancelBtn.type = 'button';
        cancelBtn.textContent = '取消';
        cancelBtn.style.cssText = 'margin-left: auto; padding: 8px 16px; background: #f6f7f8; color: #61666d; border: none; border-radius: 6px; cursor: pointer; font-size: 14px;';

        const okBtn = document.createElement('button');
        okBtn.type = 'button';
        okBtn.textContent = '导入';
        okBtn.style.cssText = 'padding: 8px 16px; background: #00a1d6; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 14px; font-weight: 500;';

        pickFileBtn.addEventListener('click', () => fileInput.click());
        fileInput.addEventListener('change', function() {
            const file = this.files && this.files[0];
            if (!file) {
                return;
            }
            const reader = new FileReader();
            reader.onload = function() {
                ta.value = String(reader.result || '');
            };
            reader.readAsText(file, 'UTF-8');
            this.value = '';
        });

        cancelBtn.addEventListener('click', () => overlay.remove());

        okBtn.addEventListener('click', () => {
            const uids = parseUidsFromImportText(ta.value);
            if (uids.length === 0) {
                alert('未能解析出任何 UID，请检查格式。');
                return;
            }
            if (!confirm(`将使用 ${uids.length} 条 UID 替换当前列表，并清零拉黑进度。确定？`)) {
                return;
            }
            applyImportedUids(uids);
            overlay.remove();
            const panel = document.getElementById('bilibili-blacklist-panel');
            if (panel) {
                panel.remove();
            }
            createControlPanel();
            showNotification('导入成功', `已载入 ${uids.length} 条 UID`);
        });

        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                overlay.remove();
            }
        });

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
    }

    /**
     * 创建控制面板
     */
    function createControlPanel() {
        const panel = document.createElement('div');
        panel.id = 'bilibili-blacklist-panel';
        panel.style.cssText = `
            position: fixed;
            top: 100px;
            right: 20px;
            background: white;
            border-radius: 12px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.15);
            padding: 20px;
            z-index: 99999;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            width: 280px;
            border: 1px solid #e3e5e7;
        `;

        const progress = getProgress();
        const total = BLACKLIST_UIDS.length;

        panel.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                <h3 style="margin: 0; font-size: 16px; color: #18191c;">🛡️ B站A盾黑名单拉黑助手</h3>
                <button id="bl-close-panel" style="background: none; border: none; cursor: pointer; font-size: 18px; color: #9499a0;">×</button>
            </div>
            <div style="margin-bottom: 15px; padding: 10px; background: #f6f7f8; border-radius: 8px; font-size: 13px; color: #61666d;">
                <div>黑名单总数: <strong style="color: #18191c;">${total}</strong></div>
                <div>当前进度: <strong style="color: #00a1d6;">${progress}</strong> / ${total}</div>
                <div>数据来源: <strong style="color: #18191c;">${DATA_SOURCE}</strong></div>
                <div>登录状态: <strong style="color: ${isLoggedIn() ? '#00aeec' : '#f25d8e'};">${isLoggedIn() ? '已登录' : '未登录'}</strong></div>
                <div>当前状态: <strong id="bl-current-status" style="color: ${batchBlockPaused ? '#faad14' : batchBlockRunning ? '#52c41a' : batchBlockFinished ? '#13c2c2' : '#9499a0'};">${batchBlockPaused ? '已暂停' : batchBlockRunning ? '运行中' : batchBlockFinished ? '已完成' : '待运行'}</strong></div>
            </div>
            <div style="display: flex; flex-direction: column; gap: 8px;">
                <button id="bl-control-batch" style="padding: 10px; background: #00a1d6; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 14px; font-weight: 500; transition: background 0.2s;">
                    ${progress > 0 ? '▶️ 继续批量拉黑' : '▶️ 开始批量拉黑'}
                </button>
                <div style="position: relative;">
                    <button id="bl-refresh-data" style="padding: 10px; background: #52c41a; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 14px; font-weight: 500; transition: background 0.2s; width: 100%; text-align: center;">
                        🔄 刷新数据 ▼
                    </button>
                    <div id="bl-refresh-menu" style="position: absolute; top: 100%; left: 0; right: 0; background: white; border: 1px solid #e3e5e7; border-radius: 0 0 6px 6px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); z-index: 100000; display: none;">
                        <button id="bl-refresh-remote" style="padding: 8px 12px; width: 100%; text-align: left; background: none; border: none; cursor: pointer; font-size: 13px; transition: background 0.2s;">
                            🛡️ A盾黑名单
                        </button>
                        <button id="bl-refresh-cache" style="padding: 8px 12px; width: 100%; text-align: left; background: none; border: none; cursor: pointer; font-size: 13px; transition: background 0.2s;">
                            💾 本地缓存
                        </button>
                        <button id="bl-refresh-fallback" style="padding: 8px 12px; width: 100%; text-align: left; background: none; border: none; cursor: pointer; font-size: 13px; transition: background 0.2s;">
                            📦 内置数据
                        </button>
                    </div>
                </div>
                <div style="position: relative;">
                    <button id="bl-data-menu" style="padding: 10px; background: #13c2c2; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 14px; font-weight: 500; transition: background 0.2s; width: 100%; text-align: center;">
                        📤 导入/导出 ▼
                    </button>
                    <div id="bl-data-submenu" style="position: absolute; top: 100%; left: 0; right: 0; background: white; border: 1px solid #e3e5e7; border-radius: 0 0 6px 6px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); z-index: 100000; display: none;">
                        <button id="bl-import-uids" style="padding: 8px 12px; width: 100%; text-align: left; background: none; border: none; cursor: pointer; font-size: 13px; transition: background 0.2s;">
                            📥 导入 UID
                        </button>
                        <button id="bl-export-uids" style="padding: 8px 12px; width: 100%; text-align: left; background: none; border: none; cursor: pointer; font-size: 13px; transition: background 0.2s;">
                            📤 导出 UID
                        </button>
                        <button id="bl-export-my-blacklist" style="padding: 8px 12px; width: 100%; text-align: left; background: none; border: none; cursor: pointer; font-size: 13px; transition: background 0.2s;">
                            🧾 导出我的B站黑名单
                        </button>
                    </div>
                </div>
                <button id="bl-view-details" style="padding: 10px; background: #1890ff; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 14px; font-weight: 500; transition: background 0.2s;">
                    📋 查看详细记录
                </button>
                <button id="bl-blacklist-manager" style="padding: 10px; background: #722ed1; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 14px; font-weight: 500; transition: background 0.2s;">
                    📝 黑名单管理
                </button>
                <button id="bl-reset-progress" style="padding: 10px; background: #f6f7f8; color: #61666d; border: none; border-radius: 6px; cursor: pointer; font-size: 14px; transition: background 0.2s;">
                    🔄 重置进度
                </button>
            </div>
            <div style="margin-top: 12px; font-size: 11px; color: #9499a0; line-height: 1.5;">
                提示: 点击开始后脚本会自动批量拉黑黑名单中的用户。请勿频繁操作以免触发风控。
            </div>
        `;

        document.body.appendChild(panel);

        // 绑定事件
        document.getElementById('bl-close-panel').addEventListener('click', () => {
            panel.remove();
            // 显示悬浮按钮
            createFloatingButton();
        });

        document.getElementById('bl-control-batch').addEventListener('click', () => {
            const btn = document.getElementById('bl-control-batch');
            
            if (!batchBlockRunning) {
                // 未运行状态 - 开始/继续批量拉黑
                if (!isLoggedIn()) {
                    alert('请先登录B站账号！');
                    return;
                }
                const startIndex = getProgress();
                batchBlock(startIndex);
            } else {
                // 运行状态 - 暂停/继续
                batchBlockPaused = !batchBlockPaused;
                if (batchBlockPaused) {
                    btn.innerHTML = '▶️ 继续批量拉黑';
                    btn.style.background = '#52c41a';
                    showNotification('已暂停', '批量拉黑已暂停，可随时点击继续');
                    console.log('⏸️ 批量拉黑已暂停');
                } else {
                    btn.innerHTML = '⏸️ 暂停批量拉黑';
                    btn.style.background = '#faad14';
                    showNotification('已继续', '批量拉黑已继续执行');
                    console.log('▶️ 批量拉黑已继续');
                }
                // 更新状态显示
                updateStatusDisplay();
            }
        });

        // 刷新数据按钮点击事件 - 显示/隐藏菜单
        document.getElementById('bl-refresh-data').addEventListener('click', (e) => {
            e.stopPropagation();
            const menu = document.getElementById('bl-refresh-menu');
            menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
        });

        // 点击页面其他地方关闭菜单
        document.addEventListener('click', () => {
            const menu = document.getElementById('bl-refresh-menu');
            if (menu) {
                menu.style.display = 'none';
            }
        });

        // 子选项点击事件
        document.getElementById('bl-refresh-remote').addEventListener('click', async (e) => {
            e.stopPropagation();
            
            // 检查冷却时间
            const now = Date.now();
            const timeSinceLastRefresh = now - lastRefreshTime;
            if (timeSinceLastRefresh < CONFIG.REFRESH_COOLDOWN) {
                const remainingSeconds = Math.ceil((CONFIG.REFRESH_COOLDOWN - timeSinceLastRefresh) / 1000);
                showNotification('刷新冷却中', `请等待 ${remainingSeconds} 秒后再刷新`);
                const menu = document.getElementById('bl-refresh-menu');
                menu.style.display = 'none';
                return;
            }
            
            const btn = document.getElementById('bl-refresh-data');
            const originalText = btn.innerHTML;
            btn.innerHTML = '⌛ 刷新中...';
            btn.disabled = true;
            
            try {
                console.log('🔄 正在从 listing.ssrv2.ltd API 获取黑名单数据...');
                const uids = await fetchAllUidsFromPublicApi();
                
                if (uids && uids.length > 0) {
                    BLACKLIST_UIDS = uids;
                    DATA_SOURCE = 'A盾黑名单';
                    batchBlockFinished = false;
                    lastRefreshTime = Date.now();
                    saveBlacklistCache(uids);
                    clearProgress();
                    console.log(`✅ 成功获取 ${uids.length} 条黑名单数据`);
                    
                    panel.remove();
                    createControlPanel();
                    showNotification('数据刷新', `✅ 成功从 A盾黑名单 获取\n${uids.length} 条数据`);
                } else {
                    throw new Error('未找到UID数据');
                }
            } catch (error) {
                console.warn('⚠️ 从远程获取黑名单失败:', error);
                showNotification('数据刷新失败', `❌ 从A盾黑名单获取数据失败: ${error.message}`);
            } finally {
                btn.innerHTML = originalText;
                btn.disabled = false;
                const menu = document.getElementById('bl-refresh-menu');
                menu.style.display = 'none';
            }
        });

        document.getElementById('bl-refresh-cache').addEventListener('click', (e) => {
            e.stopPropagation();
            const cached = getBlacklistCache();
            
            if (cached && cached.length > 0) {
                BLACKLIST_UIDS = cached;
                DATA_SOURCE = '本地缓存';
                batchBlockFinished = false;
                clearProgress();
                console.log(`✅ 使用本地缓存数据: ${cached.length} 条`);
                
                panel.remove();
                createControlPanel();
                showNotification('数据刷新', `✅ 使用本地缓存数据\n${cached.length} 条数据`);
            } else {
                showNotification('数据刷新失败', '❌ 本地缓存为空');
            }
            
            const menu = document.getElementById('bl-refresh-menu');
            menu.style.display = 'none';
        });

        document.getElementById('bl-refresh-fallback').addEventListener('click', (e) => {
            e.stopPropagation();
            BLACKLIST_UIDS = FALLBACK_UIDS;
            DATA_SOURCE = '备用数据';
            batchBlockFinished = false;
            clearProgress();
            console.log(`⚠️ 使用备用数据: ${FALLBACK_UIDS.length} 条`);
            
            panel.remove();
            createControlPanel();
            showNotification('数据刷新', `⚠️ 使用内置备用数据\n${FALLBACK_UIDS.length} 条数据`);
            
            const menu = document.getElementById('bl-refresh-menu');
            menu.style.display = 'none';
        });

        // 导入/导出菜单点击事件 - 显示/隐藏子菜单
        document.getElementById('bl-data-menu').addEventListener('click', (e) => {
            e.stopPropagation();
            const menu = document.getElementById('bl-data-submenu');
            menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
        });

        // 子选项点击事件
        document.getElementById('bl-export-uids').addEventListener('click', (e) => {
            e.stopPropagation();
            exportBlacklistUids();
            const menu = document.getElementById('bl-data-submenu');
            menu.style.display = 'none';
        });

        document.getElementById('bl-import-uids').addEventListener('click', (e) => {
            e.stopPropagation();
            showImportUidDialog();
            const menu = document.getElementById('bl-data-submenu');
            menu.style.display = 'none';
        });

        document.getElementById('bl-export-my-blacklist').addEventListener('click', async (e) => {
            e.stopPropagation();
            await exportMyBilibiliBlacklist();
            const menu = document.getElementById('bl-data-submenu');
            menu.style.display = 'none';
        });

        document.getElementById('bl-reset-progress').addEventListener('click', () => {
            if (confirm('确定要重置进度吗？这将从第一个用户重新开始。')) {
                clearProgress();
                location.reload();
            }
        });

        // 查看详细记录按钮
        document.getElementById('bl-view-details').addEventListener('click', () => {
            showDetailsPanel();
        });

        // 黑名单管理按钮
        document.getElementById('bl-blacklist-manager').addEventListener('click', () => {
            window.open('https://account.bilibili.com/account/blacklist', '_blank');
        });
    }

    /**
     * 创建悬浮按钮
     */
    function createFloatingButton() {
        const existing = document.getElementById('bilibili-blacklist-btn');
        if (existing) return;

        const btn = document.createElement('button');
        btn.id = 'bilibili-blacklist-btn';
        btn.innerHTML = '🛡️';
        btn.title = '打开B站A盾黑名单拉黑助手';
        btn.style.cssText = `
            position: fixed;
            top: 100px;
            right: 20px;
            width: 50px;
            height: 50px;
            border-radius: 50%;
            background: linear-gradient(135deg, #00a1d6, #00b5e5);
            color: white;
            border: none;
            cursor: pointer;
            font-size: 24px;
            z-index: 99999;
            box-shadow: 0 4px 12px rgba(0,161,214,0.4);
            transition: transform 0.2s, box-shadow 0.2s;
        `;

        btn.addEventListener('mouseenter', () => {
            btn.style.transform = 'scale(1.1)';
            btn.style.boxShadow = '0 6px 16px rgba(0,161,214,0.5)';
        });

        btn.addEventListener('mouseleave', () => {
            btn.style.transform = 'scale(1)';
            btn.style.boxShadow = '0 4px 12px rgba(0,161,214,0.4)';
        });

        btn.addEventListener('click', () => {
            btn.remove();
            createControlPanel();
        });

        document.body.appendChild(btn);
    }



    // ==================== 免责声明 ====================

    function showDisclaimer() {
        const overlay = document.createElement('div');
        overlay.id = 'bilibili-blacklist-disclaimer';
        overlay.style.cssText = `
            position: fixed;
            inset: 0;
            z-index: 100001;
            background: rgba(0,0,0,0.6);
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
            box-sizing: border-box;
        `;

        const box = document.createElement('div');
        box.style.cssText = `
            background: #fff;
            border-radius: 12px;
            box-shadow: 0 8px 32px rgba(0,0,0,0.3);
            width: 100%;
            max-width: 500px;
            max-height: 80vh;
            display: flex;
            flex-direction: column;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        `;

        const titleRow = document.createElement('div');
        titleRow.style.cssText = 'padding: 20px 20px 10px; border-bottom: 1px solid #e3e5e7; background: #f6f7f8; border-radius: 12px 12px 0 0;';
        const h3 = document.createElement('h3');
        h3.style.cssText = 'margin: 0; font-size: 16px; color: #18191c; text-align: center;';
        h3.textContent = '⚠️ 免责声明';
        titleRow.appendChild(h3);

        const content = document.createElement('div');
        content.style.cssText = 'padding: 20px; overflow-y: auto; flex: 1;';
        content.innerHTML = `
            <div style="font-size: 14px; line-height: 1.6; color: #333;">
                <p>本脚本仅用于辅助管理 B 站黑名单，请勿用于任何违法或滥用目的。</p>
                <p>使用本脚本时，请遵守以下规则：</p>
                <ol style="margin: 10px 0; padding-left: 20px;">
                    <li>请勿频繁操作，以免触发 B 站风控机制</li>
                    <li>仅拉黑确实需要拉黑的用户，避免误操作</li>
                    <li>尊重他人合法权益，不进行恶意拉黑</li>
                    <li>使用本脚本产生的一切后果由用户自行承担</li>
                </ol>
                <p>请确认您已了解并同意上述声明，否则请不要使用本脚本。</p>
            </div>
        `;

        const btnRow = document.createElement('div');
        btnRow.style.cssText = 'display: flex; gap: 10px; padding: 15px 20px; border-top: 1px solid #e3e5e7; background: #fafbfc; border-radius: 0 0 12px 12px;';

        const cancelBtn = document.createElement('button');
        cancelBtn.type = 'button';
        cancelBtn.textContent = '不同意';
        cancelBtn.style.cssText = 'flex: 1; padding: 10px; background: #f6f7f8; color: #61666d; border: 1px solid #e3e5e7; border-radius: 6px; cursor: pointer; font-size: 14px;';

        const agreeBtn = document.createElement('button');
        agreeBtn.type = 'button';
        agreeBtn.textContent = '我同意';
        agreeBtn.style.cssText = 'flex: 1; padding: 10px; background: #00a1d6; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 14px; font-weight: 500;';

        btnRow.appendChild(cancelBtn);
        btnRow.appendChild(agreeBtn);

        box.appendChild(titleRow);
        box.appendChild(content);
        box.appendChild(btnRow);
        overlay.appendChild(box);
        document.body.appendChild(overlay);

        return new Promise((resolve) => {
            cancelBtn.addEventListener('click', () => {
                overlay.remove();
                resolve(false);
            });

            agreeBtn.addEventListener('click', () => {
                overlay.remove();
                // 保存同意状态
                if (typeof GM_setValue !== 'undefined') {
                    GM_setValue('bilibili_blacklist_disclaimer_agreed', 'true');
                }
                localStorage.setItem('bilibili_blacklist_disclaimer_agreed', 'true');
                resolve(true);
            });

            // 点击遮罩关闭
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) {
                    overlay.remove();
                    resolve(false);
                }
            });
        });
    }

    function hasAgreedToDisclaimer() {
        if (typeof GM_getValue !== 'undefined') {
            const agreed = GM_getValue('bilibili_blacklist_disclaimer_agreed');
            if (agreed === 'true') {
                return true;
            }
        }
        const agreed = localStorage.getItem('bilibili_blacklist_disclaimer_agreed');
        return agreed === 'true';
    }

    // ==================== 初始化 ====================

    async function init() {
        console.log('🛡️ B站A盾黑名单拉黑助手已加载');

        // 检查是否已同意免责声明
        if (!hasAgreedToDisclaimer()) {
            const agreed = await showDisclaimer();
            if (!agreed) {
                console.log('用户不同意免责声明，脚本将不加载');
                return;
            }
        }

        // 优先使用本地缓存数据，不从远程自动获取
        const cached = getBlacklistCache();
        if (cached && cached.length > 0) {
            BLACKLIST_UIDS = cached;
            DATA_SOURCE = '本地缓存';
            console.log(`📋 使用本地缓存数据: ${cached.length} 条`);
        } else {
            // 使用内置备用数据
            BLACKLIST_UIDS = FALLBACK_UIDS;
            DATA_SOURCE = '备用数据';
            console.log(`⚠️ 使用内置备用数据: ${FALLBACK_UIDS.length} 条`);
        }

        // 创建悬浮按钮
        createFloatingButton();

        // 注册油猴菜单命令
        if (typeof GM_registerMenuCommand !== 'undefined') {
            GM_registerMenuCommand('🛡️ 打开B站A盾黑名单拉黑助手', () => {
                const panel = document.getElementById('bilibili-blacklist-panel');
                if (panel) {
                    panel.remove();
                    createFloatingButton();
                } else {
                    const btn = document.getElementById('bilibili-blacklist-btn');
                    if (btn) btn.remove();
                    createControlPanel();
                }
            });

            GM_registerMenuCommand('▶️ 开始批量拉黑', () => {
                if (!isLoggedIn()) {
                    alert('请先登录B站账号！');
                    return;
                }
                const startIndex = getProgress();
                batchBlock(startIndex);
            });

            GM_registerMenuCommand('🔄 重置进度', () => {
                if (confirm('确定要重置进度吗？')) {
                    clearProgress();
                    alert('进度已重置！');
                }
            });

            GM_registerMenuCommand('📤 导出 UID 列表', () => {
                exportBlacklistUids();
            });

            GM_registerMenuCommand('📥 导入 UID 列表', () => {
                showImportUidDialog();
            });

            GM_registerMenuCommand('🧾 导出我的B站黑名单', async () => {
                await exportMyBilibiliBlacklist();
            });
        }
    }

    // 等待页面加载完成
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
