"use strict";
const os = require("os");
const path = require("path");
const fs = require("fs");
function _interopNamespaceDefault(e) {
    const n = Object.create(null, { [Symbol.toStringTag]: { value: "Module" } });
    if (e) {
        for (const k in e) {
            if (k !== "default") {
                const d = Object.getOwnPropertyDescriptor(e, k);
                Object.defineProperty(n, k, d.get ? d : {
                    enumerable: true,
                    get: () => e[k]
                });
            }
        }
    }
    n.default = e;
    return Object.freeze(n);
}
const fs__namespace = _interopNamespaceDefault(fs);
class AsyncPool {
    constructor(maxParallelCount) {
        this.queue = [];
        this.executing = 0;
        this.down = false;
        this.maxCount = maxParallelCount;
        this.completion = new Promise((res) => this.resolver = res);
    }
    submit(task) {
        if (this.down) {
            throw "Already shutdown";
        }
        this.queue.push(task);
        this.pollNext();
    }
    async pollNext() {
        if (this.executing >= this.maxCount) {
            return;
        }
        if (!this.queue.length) {
            if (!this.executing) {
                this.resolver();
            }
            return;
        }
        this.executing++;
        const task = this.queue.shift();
        const result = task();
        if (result && result instanceof Promise) {
            try {
                await result;
            } catch (err) {
                this.executing--;
                this.pollNext();
                throw err;
            }
        }
        this.executing--;
        this.pollNext();
    }
    shutdown() {
        this.down = true;
    }
}
let cacheIndex;
const cacheDir = path.resolve(os.tmpdir(), "sim-music.ext.ncm", "cache");
const cacheIndexPath = path.join(cacheDir, "index.json");
const caching = [];
if (fs__namespace.existsSync(cacheIndexPath)) {
    cacheIndex = JSON.parse(fs__namespace.readFileSync(cacheIndexPath).toString());
} else {
    initCache();
}
function mkCacheDir() {
    if (fs__namespace.existsSync(cacheDir)) {
        return;
    }
    fs__namespace.mkdirSync(cacheDir, { recursive: true });
}
function saveIndex() {
    fs__namespace.writeFileSync(cacheIndexPath, JSON.stringify(cacheIndex));
}
function purgeExceeded() {
    var _a;
    const removeNum = cacheIndex.length - Number(config.getItem("ext.ncm.maxCacheCount"));
    if (removeNum <= 0) {
        return;
    }
    cacheIndex.sort((a, b) => a.addTime == b.addTime ? 0 : a.addTime > b.addTime ? 1 : -1);
    for (let i = 0; i < removeNum; i++) {
        const id = (_a = cacheIndex.shift()) == null ? void 0 : _a.id;
        fs__namespace.rmSync(path.join(cacheDir, id + ".cache"));
        console.log("Purged cache for NCM song " + id);
    }
}
function initCache() {
    if (fs__namespace.existsSync(cacheDir)) {
        (function rm(where) {
            for (let sub of fs__namespace.readdirSync(where)) {
                const path$1 = path.join(where, sub);
                const stat = fs__namespace.statSync(path$1);
                if (stat.isDirectory()) {
                    rm(path$1);
                    return fs__namespace.rmdirSync(path$1);
                }
                fs__namespace.rmSync(path$1);
            }
        })(cacheDir);
    }
    cacheIndex = [];
}
async function makeCache(id, url) {
    if (caching.includes(id)) {
        return;
    }
    mkCacheDir();
    const cachePath = path.join(cacheDir, id + ".cache");
    let lastErr = null;
    for (let i = 0; i < 3; i++) {
        try {
            const resp = await fetch(url);
            const dataBuffer = new Uint8Array(await resp.arrayBuffer());
            fs__namespace.writeFileSync(cachePath, dataBuffer);
            break;
        } catch (err) {
            lastErr = err;
        }
    }
    if (lastErr) {
        console.error("Failed to make cache for NCM song id " + id + ", we will try it again later:", lastErr);
        return;
    }
    cacheIndex.push({ id, addTime: Date.now() });
    purgeExceeded();
    saveIndex();
    console.log("Successfully cached NCM song " + id);
}
function getCache(id) {
    if (!cacheIndex.some((it) => it.id == id)) {
        return null;
    }
    const path$1 = path.join(cacheDir, id + ".cache");
    return fs__namespace.existsSync(path$1) ? path$1 : null;
}
const regexpCache = {};
[[",", ","], ["?", "\\?"], ["!", "!"]].forEach((it) => {
    regexpCache[it[0]] = new RegExp(it[1] + "(?![\\s" + it[1] + "])", "g");
});
function formatLyric(input) {
    Object.keys(regexpCache).forEach((it) => {
        input = input.replace(regexpCache[it], it + " ");
    });
    return input.replace(new RegExp("(?<!\\d)\\.(?!\\d\\s\\.)", "g"), ". ");
}
let cachedMetadata = {};
let cachedPlayUrl = {};
const cachedLyrics = {};
const elements = {};
Object.assign(defaultConfig, {
    "ext.ncm.apiEndpoint": "",
    "ext.ncm.apiHeaders": "",
    "ext.ncm.searchLimit": 30,
    "ext.ncm.filterInvalid": true,
    "ext.ncm.musicQuality": "standard",
    "ext.ncm.cacheEnabled": true,
    "ext.ncm.maxCacheCount": 50,
    "ext.ncm.formatLrc": true,
    "ext.ncm.maxParallelCount": 8,
    // Internal Data
    "ext.ncm.musicList": []
});
SettingsPage.data.push(
    { type: "title", text: "网易云 NodeJS API 扩展" },
    { type: "input", text: "API 地址", description: "必填，无需最后的斜线（示例： https://api.example.com）。", configItem: "ext.ncm.apiEndpoint" },
    { type: "input", text: "要发送给 API 的 Header 信息", description: "选填，支持多个（格式：a=b&c=d，需要 URL 转义）。", configItem: "ext.ncm.apiHeaders" },
    { type: "input", inputType: "number", text: "搜索时每页歌曲数量", description: "必填，默认为 30，推荐不超过 50，不能超过 100。", configItem: "ext.ncm.searchLimit" },
    { type: "boolean", text: "过滤无效歌曲", description: "开启后搜索结果中将过滤您无法播放的歌曲。", configItem: "ext.ncm.filterInvalid" },
    {
        type: "select",
        text: "歌曲质量",
        description: "选择在线播放、缓存、下载时的音质，若歌曲无此音质或您无相应权限，会自动降级，建议在切换后清除缓存。",
        options: [
            ["low", "低 (192 kbps)"],
            ["standard", "标准 (320 kbps)"],
            ["sq", "SQ (~1000 kbps)"],
            ["hr", "High-Res (~2000 kbps)"]
        ],
        configItem: "ext.ncm.musicQuality"
    },
    { type: "boolean", text: "启用自动缓存", description: "开启后可提升歌单中网易云曲目的加载速度，但会占用更多内存空间。", configItem: "ext.ncm.cacheEnabled" },
    { type: "input", inputType: "number", text: "最大缓存歌曲数量", description: "必填，默认为 50 首，缓存超出部分会自动删除。", configItem: "ext.ncm.maxCacheCount" },
    {
        type: "button",
        text: "清除缓存数据",
        description: "点击按钮可立即清除所有网易云歌曲缓存数据。",
        button: "清除",
        onclick: () => {
            try {
                initCache();
            } catch {
                localStorage.setItem("ext.ncm.clearCache", "1");
            }
            alert("网易云歌曲缓存已全部清除，点击确定以重载应用。", () => ipcRenderer.invoke("restart"));
        }
    },
    { type: "boolean", text: "自动格式化歌词", description: "开启后将会自动在网易云歌曲歌词中的无尾随空格英文标点后添加空格，增加 UI 美观度。", configItem: "ext.ncm.formatLrc" },
    { type: "input", inputType: "number", text: "歌单信息最大并行请求数量", description: "必填，默认为 8，推荐不超过 16。", configItem: "ext.ncm.maxParallelCount" }
);
config.listenChange("ext.ncm.musicQuality", () => cachedPlayUrl = {});
if (localStorage.getItem("ext.ncm.clearCache") == "1") {
    initCache();
    localStorage.removeItem("ext.ncm.clearCache");
}
async function request(path2, query = {}) {
    const formatted = Object.keys(query).map((k) => encodeURI(k) + "=" + encodeURI(query[k])).join("&");
    const headers = {};
    const headersConf = config.getItem("ext.ncm.apiHeaders");
    if (headersConf) {
        headersConf.split("&").map((it) => it.split("=")).forEach((it) => {
            if (decodeURIComponent(decodeURI(it[0])) == "cookie") {
                if (path2.indexOf('?') !== -1) {
                    path2 = "&" + decodeURIComponent(decodeURI(it[1]));
                } else {
                    path2 = "?" + decodeURIComponent(decodeURI(it[1]));
                }
            }
            headers[decodeURIComponent(decodeURI(it[0]))] = decodeURIComponent(decodeURI(it[1]));
        });
    }
    const resp = await fetch(config.getItem("ext.ncm.apiEndpoint") + path2 + "?" + formatted, { headers });
    return await resp.json();
}
function splitArray(arr, chunkSize) {
    const result = [];
    for (let i = 0; i < arr.length; i += chunkSize) {
        result.push(arr.slice(i, i + chunkSize));
    }
    return result;
}
const playableMap = {};
async function fetchMetadata(...ids) {
    const result = {};
    const split = splitArray(ids, 100);
    const pool = new AsyncPool(Math.min(split.length, parseInt(config.getItem("ext.ncm.maxParallelCount"))));
    for (let idsArr of split) {
        pool.submit(async () => {
            const resp = await request("/song/detail", { ids: idsArr.join(",") });
            resp.privileges.forEach((pri) => {
                playableMap[pri.id] = pri.plLevel != "none";
            });
            resp.songs.forEach((obj) => {
                result[obj.id] = {
                    title: obj.name,
                    artist: obj.ar.map((it) => it.name).join(", "),
                    album: obj.al.name,
                    cover: obj.al.picUrl + "?param=360y360",
                    time: obj.dt / 1e3
                };
            });
        });
    }
    pool.shutdown();
    await pool.completion;
    return result;
}
function getBr() {
    switch (config.getItem("ext.ncm.musicQuality")) {
        case "low":
            return 192e3;
        case "standard":
            return 32e4;
        case "sq":
            return 1e6;
    }
    return 1e7;
}
ExtensionConfig.ncm = {
    async readMetadata(path2) {
        const id = "ncm".length + 1;
        if (cachedMetadata[id]) {
            return cachedMetadata[id];
        }
        return (await fetchMetadata(id))[id];
    },
    player: {
        async getPlayUrl(path2, isDownload, count = 0) {
            const id = "ncm".length + 1;
            const cached = getCache(id);
            if (cached) {
                return "file://" + cached;
            }
            if (cachedPlayUrl[id] && (performance.now() - cachedPlayUrl[id].time) / 1e3 < cachedPlayUrl[id].expi - 200) {
                return cachedPlayUrl[id].url;
            }
            const resp = await request("/song/url", { id, br: getBr() });
            const obj = resp.data[0];
            const url = obj.url;
            if (url == null && count < 5) {
                return await this.getPlayUrl(path2, isDownload, count + 1);
            }
            if (!isDownload && config.getItem("ext.ncm.cacheEnabled")) {
                makeCache(id, url);
            }
            cachedPlayUrl[id] = {
                url,
                time: performance.now(),
                expi: obj.expi
            };
            return url;
        },
        async getLyrics(path2) {
            const id =  "ncm".length + 1;
            if (cachedLyrics[id]) {
                return cachedLyrics[id];
            }
            const resp = await request("/lyric", { id });
            cachedLyrics[id] = "";
            if (resp.pureMusic || !resp.lrc) {
                return "";
            }
            let lyric = resp.lrc.lyric;
            if (resp.tlyric) {
                lyric += "\n" + resp.tlyric.lyric;
            }
            if (config.getItem("ext.ncm.formatLrc")) {
                lyric = formatLyric(lyric);
            }
            return cachedLyrics[id] = lyric;
        }
    },
    async search(keywords, page) {
        if (config.getItem("ext.ncm.apiEndpoint") == "") {
            alert("您还未填写 API 地址，请在设置页面中进行配置。");
            return { files: [] };
        }
        try {
            const resp = await request("/search", {
                keywords,
                limit: Math.min(Number(config.getItem("ext.ncm.searchLimit")), 100),
                offset: page * Number(config.getItem("ext.ncm.searchLimit"))
            });
            let ids = resp.result.songs.map((it) => it.id);
            cachedMetadata = await fetchMetadata(...ids);
            if (config.getItem("ext.ncm.filterInvalid")) {
                ids = ids.filter((it) => playableMap[it]);
            }
            return {
                files: ids.map((it) => "ncm:" + it),
                hasMore: resp.result.hasMore,
                menu: [DownloadController.getMenuItems()]
            };
        } catch (err) {
            console.error(err);
            showErrorOverlay(err);
        }
    },
    musicList: {
        async _import(callback, id, isUpdate = false) {
            let list = config.getItem("ext.ncm.musicList");
            if (!isUpdate) {
                for (let entry of list) {
                    if (entry.id == id) {
                        return alert("此歌单（" + entry.name + "）已被添加，请尝试删除后重试。");
                    }
                }
            }
            try {
                const resp = await request("/playlist/detail", { id });
                const name = resp.playlist.name;
                let ids = resp.playlist.tracks.map((it) => it.id);
                let filtered = 0;
                if (config.getItem("ext.ncm.filterInvalid")) {
                    const len = ids.length;
                    resp.privileges.forEach((it) => {
                        playableMap[it.id] = it.plLevel != "none";
                    });
                    ids = ids.filter((it) => playableMap[it]);
                    filtered = len - ids.length;
                }
                const metadata = await fetchMetadata(...ids);
                if (Object.keys(metadata).length != ids.length) {
                    throw "获取歌曲元数据时发生错误。";
                }
                if (isUpdate) {
                    list = list.filter((it) => it.id != id);
                }
                const newEntry = { id, name, songs: metadata };
                list.push(newEntry);
                config.setItem("ext.ncm.musicList", list);
                if (isUpdate) {
                    ExtensionConfig.ncm.musicList.switchList(id);
                }
                alert("成功导入歌单 " + name + "，共导入 " + ids.length + " 首歌曲" + (filtered ? "，" + filtered + " 首因无法播放被过滤" : "") + (ids.length == 1e3 ? "，本次导入可能达到 API 限制" : "") + "。", callback);
            } catch (err) {
                alert("导入歌单失败，请稍后重试：" + err);
            }
        },
        add(callback) {
            prompt("请输入网易云歌单 分享 URL 或 ID 以导入歌单", async (input) => {
                let id;
                try {
                    if (/^\d+$/.test(input)) {
                        id = input;
                    } else if (input.includes("id=")) {
                        if (!input.startsWith("https://")) {
                            const matches = input.match(/https:\/\/(?:[a-zA-Z0-9\-\.]+\.)?music\.163\.com\/[\w\-\/?=&#]+/g);
                            if (!matches || !matches.length) {
                                throw 0;
                            }
                            input = matches[0];
                        }
                        const param = new URL(input).searchParams.get("id");
                        if (!param || !/^\d+$/.test(param)) {
                            throw 0;
                        }
                        id = param;
                    } else {
                        throw 0;
                    }
                } catch {
                    return alert("无法解析歌曲 ID，请检查您输入的内容。");
                }
                await ExtensionConfig.ncm.musicList._import(callback, id);
            });
        },
        renderList(container) {
            const list = config.getItem("ext.ncm.musicList");
            list.forEach((entry) => {
                const element = document.createElement("div");
                element.textContent = entry.name;
                element.onclick = () => this.switchList(entry.id);
                element.oncontextmenu = (event) => {
                    new ContextMenu([
                        { label: "查看歌曲", click: element.click },
                        {
                            label: "重新导入歌单",
                            click() {
                                confirm(`确认重新导入网易云歌单 ${entry.name} 吗？`, () => {
                                    ExtensionConfig.ncm.musicList._import(null, entry.id, true);
                                });
                            }
                        },
                        {
                            label: "从列表中移除",
                            click() {
                                confirm(`确认移除网易云歌单 ${entry.name} 吗？`, () => {
                                    const currentList = config.getItem("ext.ncm.musicList");
                                    config.setItem("ext.ncm.musicList", currentList.filter((it) => it.id != entry.id));
                                    if (element.classList.contains("active")) {
                                        switchRightPage("rightPlaceholder");
                                    }
                                    delete elements[entry.id];
                                    element.remove();
                                });
                            }
                        }
                    ]).popup([event.clientX, event.clientY]);
                };
                elements[entry.id] = element;
                container.appendChild(element);
            });
        },
        switchList(id) {
            const entry = config.getItem("ext.ncm.musicList").find((it) => it.id == id);
            Object.assign(cachedMetadata, entry.songs);
            renderMusicList(Object.keys(entry.songs).map((it) => "ncm:" + it), {
                uniqueId: "ncm-list-" + id,
                errorText: "该歌单为空",
                menuItems: [DownloadController.getMenuItems()],
                musicListInfo: { name: entry.name }
            }, false);
            document.querySelectorAll(".left .leftBar div").forEach((it) => {
                if (it.classList.contains("active")) {
                    it.classList.remove("active");
                }
            });
            elements[id].classList.add("active");
        }
    }
};