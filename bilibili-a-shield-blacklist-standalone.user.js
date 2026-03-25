// ==UserScript==
// @name         B站A盾黑名单拉黑助手（简易版）
// @namespace    http://tampermonkey.net/
// @version      1.2-standalone
// @description  自动将A盾黑名单中的用户添加到B站黑名单，仅使用脚本内置 UID 列表，不访问任何外部公示站
// @author       Shiroha23
// @match        https://space.bilibili.com/*
// @match        https://www.bilibili.com/*
// @grant        GM_registerMenuCommand
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_notification
// @run-at       document-end
// ==/UserScript==

(function() {
    'use strict';

    // ==================== 配置 ====================
    const CONFIG = {
        BATCH_INTERVAL: 2000,
        USER_INTERVAL: 500,
        BATCH_SIZE: 10,
        STORAGE_KEY: 'bilibili_blacklist_progress'
    };

    // ==================== 黑名单数据 ====================
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
    let DATA_SOURCE = '内置列表';
    let batchBlockRunning = false;

    function loadEmbeddedBlacklist() {
        BLACKLIST_UIDS = FALLBACK_UIDS.slice();
        DATA_SOURCE = '内置列表';
    }

    function getCsrfToken() {
        const match = document.cookie.match(/bili_jct=([^;]+)/);
        return match ? match[1] : '';
    }

    function getCurrentUid() {
        const match = document.cookie.match(/DedeUserID=([^;]+)/);
        return match ? match[1] : '';
    }

    function isLoggedIn() {
        return !!getCurrentUid();
    }

    async function blockUser(uid) {
        const csrf = getCsrfToken();
        if (!csrf) {
            console.error('无法获取CSRF Token');
            return false;
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
                    act: '5',
                    re_src: '11',
                    csrf: csrf
                })
            });

            const data = await response.json();

            if (data.code === 0) {
                console.log(`✅ 成功拉黑用户: ${uid}`);
                return true;
            } else if (data.code === -101) {
                console.error('❌ 未登录或登录已过期');
                return false;
            } else if (data.code === -102) {
                console.log(`⚠️ 用户 ${uid} 已经在黑名单中`);
                return true;
            } else {
                console.error(`❌ 拉黑用户 ${uid} 失败:`, data.message || data.msg);
                return false;
            }
        } catch (error) {
            console.error(`❌ 拉黑用户 ${uid} 时出错:`, error);
            return false;
        }
    }

    function delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    function saveProgress(index) {
        if (typeof GM_setValue !== 'undefined') {
            GM_setValue(CONFIG.STORAGE_KEY, index.toString());
        }
        localStorage.setItem(CONFIG.STORAGE_KEY, index.toString());
    }

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

    function clearProgress() {
        if (typeof GM_setValue !== 'undefined') {
            GM_setValue(CONFIG.STORAGE_KEY, '0');
        }
        localStorage.removeItem(CONFIG.STORAGE_KEY);
    }

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
        const total = BLACKLIST_UIDS.length;
        let success = 0;
        let failed = 0;

        try {
            console.log(`🚀 开始批量拉黑，从第 ${startIndex + 1} 个用户开始，共 ${total} 个用户`);

            for (let i = startIndex; i < total; i++) {
                const uid = BLACKLIST_UIDS[i];
                console.log(`[${i + 1}/${total}] 正在处理用户: ${uid}`);

                const result = await blockUser(uid);

                if (result) {
                    success++;
                } else {
                    failed++;
                }

                saveProgress(i + 1);

                if ((i + 1) % CONFIG.BATCH_SIZE === 0 || i === total - 1) {
                    showNotification(
                        '批量拉黑进度',
                        `已处理: ${i + 1}/${total}\n成功: ${success}  失败: ${failed}`
                    );
                }

                if (i < total - 1) {
                    await delay(CONFIG.USER_INTERVAL);
                }

                if ((i + 1) % CONFIG.BATCH_SIZE === 0 && i < total - 1) {
                    console.log(`⏳ 批次完成，等待 ${CONFIG.BATCH_INTERVAL}ms 后继续...`);
                    await delay(CONFIG.BATCH_INTERVAL);
                }
            }

            console.log(`✅ 批量拉黑完成！成功: ${success}, 失败: ${failed}`);
            showNotification(
                '批量拉黑完成',
                `总计: ${total}\n成功: ${success}\n失败: ${failed}`
            );

            if (success + failed === total) {
                clearProgress();
            }
        } finally {
            batchBlockRunning = false;
        }
    }

    function showNotification(title, message) {
        if (typeof GM_notification !== 'undefined') {
            GM_notification({
                title: title,
                text: message,
                timeout: 5000
            });
        }

        showFloatingTip(title, message);
    }

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
        a.download = 'bilibili-a-shield-blacklist-uids-' + new Date().toISOString().slice(0, 10) + '.txt';
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showNotification('导出成功', `已下载 ${BLACKLIST_UIDS.length} 条 UID（每行一个）`);
    }

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

    function applyImportedUids(uids) {
        BLACKLIST_UIDS = uids;
        DATA_SOURCE = '用户导入';
        clearProgress();
    }

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

    function showFloatingTip(title, message) {
        const existing = document.getElementById('bilibili-blacklist-tip');
        if (existing) existing.remove();

        const tip = document.createElement('div');
        tip.id = 'bilibili-blacklist-tip';
        tip.style.cssText = `
            position: fixed;
            top: 100px;
            right: 20px;
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
                <h3 style="margin: 0; font-size: 16px; color: #18191c;">🛡️ B站A盾黑名单拉黑助手（简易版）</h3>
                <button id="bl-close-panel" style="background: none; border: none; cursor: pointer; font-size: 18px; color: #9499a0;">×</button>
            </div>
            <div style="margin-bottom: 15px; padding: 10px; background: #f6f7f8; border-radius: 8px; font-size: 13px; color: #61666d;">
                <div>黑名单总数: <strong style="color: #18191c;">${total}</strong></div>
                <div>当前进度: <strong style="color: #00a1d6;">${progress}</strong> / ${total}</div>
                <div>数据来源: <strong style="color: #18191c;">${DATA_SOURCE}</strong></div>
                <div>登录状态: <strong style="color: ${isLoggedIn() ? '#00aeec' : '#f25d8e'};">${isLoggedIn() ? '已登录' : '未登录'}</strong></div>
            </div>
            <div style="display: flex; flex-direction: column; gap: 8px;">
                <button id="bl-start-batch" style="padding: 10px; background: #00a1d6; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 14px; font-weight: 500; transition: background 0.2s;">
                    ${progress > 0 ? '▶️ 继续批量拉黑' : '▶️ 开始批量拉黑'}
                </button>
                <button id="bl-refresh-data" style="padding: 10px; background: #52c41a; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 14px; font-weight: 500; transition: background 0.2s;">
                    🔄 重新载入内置列表
                </button>
                <button id="bl-export-uids" style="padding: 10px; background: #13c2c2; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 14px; font-weight: 500; transition: background 0.2s;">
                    📤 导出 UID
                </button>
                <button id="bl-import-uids" style="padding: 10px; background: #fa8c16; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 14px; font-weight: 500; transition: background 0.2s;">
                    📥 导入 UID
                </button>
                <button id="bl-reset-progress" style="padding: 10px; background: #f6f7f8; color: #61666d; border: none; border-radius: 6px; cursor: pointer; font-size: 14px; transition: background 0.2s;">
                    🔄 重置进度
                </button>
            </div>
            <div style="margin-top: 12px; font-size: 11px; color: #9499a0; line-height: 1.5;">
                离线版仅使用脚本内 UID。更新列表请替换脚本或同步仓库中的 FALLBACK_UIDS。
            </div>
        `;

        document.body.appendChild(panel);

        document.getElementById('bl-close-panel').addEventListener('click', () => {
            panel.remove();
            createFloatingButton();
        });

        document.getElementById('bl-start-batch').addEventListener('click', () => {
            if (!isLoggedIn()) {
                alert('请先登录B站账号！');
                return;
            }
            const startIndex = getProgress();
            batchBlock(startIndex);
        });

        document.getElementById('bl-refresh-data').addEventListener('click', () => {
            loadEmbeddedBlacklist();
            panel.remove();
            createControlPanel();
            showNotification('已重新载入', `当前内置列表共 ${BLACKLIST_UIDS.length} 条`);
        });

        document.getElementById('bl-export-uids').addEventListener('click', () => {
            exportBlacklistUids();
        });

        document.getElementById('bl-import-uids').addEventListener('click', () => {
            showImportUidDialog();
        });

        document.getElementById('bl-reset-progress').addEventListener('click', () => {
            if (confirm('确定要重置进度吗？这将从第一个用户重新开始。')) {
                clearProgress();
                location.reload();
            }
        });
    }

    function createFloatingButton() {
        const existing = document.getElementById('bilibili-blacklist-btn');
        if (existing) return;

        const btn = document.createElement('button');
        btn.id = 'bilibili-blacklist-btn';
        btn.innerHTML = '🛡️';
        btn.title = '打开B站A盾黑名单拉黑助手（简易版）';
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

    function init() {
        console.log('🛡️ B站A盾黑名单拉黑助手（简易版）已加载');
        loadEmbeddedBlacklist();
        console.log(`📋 黑名单用户总数: ${BLACKLIST_UIDS.length}`);
        createFloatingButton();

        if (typeof GM_registerMenuCommand !== 'undefined') {
            GM_registerMenuCommand('🛡️ 打开B站A盾黑名单拉黑助手（简易版）', () => {
                const panel = document.getElementById('bilibili-blacklist-panel');
                if (panel) {
                    panel.remove();
                    createFloatingButton();
                } else {
                    const b = document.getElementById('bilibili-blacklist-btn');
                    if (b) b.remove();
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
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
