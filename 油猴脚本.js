// ==UserScript==
// @name         LINUXDO 批量组邀请 - 历史记录自动化版
// @namespace    linux.do_GroupInviter
// @version      3.5
// @description  10秒检查一次，自动记录邀请成功的名单和时间，支持悬浮球折叠
// @author       Gemini
// @match        https://linux.do/g/*
// @grant        GM_addStyle
// @run-at       document-end
// ==/UserScript==

(function() {
    'use strict';

    const CONFIG = {
        groupId: "103", //请替换为你的板块id！！你的板块id具体是多少，请在手动邀请时拦截请求查看。
        apiBase: "https://apply.dxde.de/api.php",
        autoInterval: 10000, // 10秒检查一次
        maxLogItems: 20      // 最多保存最近20条记录
    };

    let autoTimer = null;

    // 1. 样式定义
    GM_addStyle(`
        #invite-panel {
            position: fixed !important; top: 120px !important; right: 20px !important; width: 320px !important;
            background: #ffffff !important; border: 2px solid #0088cc !important; border-radius: 12px !important;
            box-shadow: 0 8px 32px rgba(0,0,0,0.3) !important; z-index: 2147483647 !important; padding: 15px !important;
            display: block; color: #333333 !important; font-family: sans-serif;
        }
        #invite-min-btn {
            position: fixed !important; top: 120px !important; right: 20px !important; width: 45px !important; height: 45px !important;
            background: #0088cc !important; color: white !important; border-radius: 50% !important; display: none;
            align-items: center; justify-content: center; cursor: pointer; z-index: 2147483647 !important;
            box-shadow: 0 4px 12px rgba(0,0,0,0.2) !important; font-size: 20px !important;
        }
        .panel-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; border-bottom: 1px solid #eee; padding-bottom: 5px; }
        .panel-btn { width: 100%; padding: 8px; border: none; border-radius: 6px; cursor: pointer; font-weight: bold; margin-bottom: 8px; font-size: 13px; }
        #btn-sync { background: #f39c12; color: white; }
        #btn-start { background: #0088cc; color: white; }

        #username-list { width: 100%; height: 50px; border: 1px solid #ccc; border-radius: 6px; padding: 5px; margin-bottom: 8px; font-size: 12px; resize: none; background: #fafafa; }

        /* 状态与日志样式 */
        #status-msg { font-size: 11px; padding: 5px; border-radius: 4px; background: #f9f9f9; border: 1px solid #eee; color: #666; margin-bottom: 8px; }
        #invite-log {
            max-height: 120px; overflow-y: auto; font-size: 11px; background: #fcfcfc;
            border: 1px solid #f0f0f0; border-radius: 6px; padding: 5px; margin-top: 5px;
        }
        .log-item { margin-bottom: 4px; border-bottom: 1px dashed #eee; padding-bottom: 2px; line-height: 1.4; }
        .log-time { color: #0088cc; font-weight: bold; margin-right: 5px; }
        .log-names { color: #444; }

        .auto-mode-area { margin-bottom: 8px; padding: 8px; background: #f0fdf4; border-radius: 6px; border: 1px dashed #22c55e; font-size: 12px; }
        .close-icon { cursor: pointer; font-size: 18px; color: #999; padding: 0 5px; }
    `);

    function initUI() {
        if (document.getElementById('invite-panel')) return;

        const panel = document.createElement('div');
        panel.id = 'invite-panel';
        panel.innerHTML = `
            <div class="panel-header">
                <span style="font-weight:bold; font-size:14px;">LD 组管助手 v3.5</span>
                <span class="close-icon" title="最小化">−</span>
            </div>

            <div class="auto-mode-area">
                <label style="cursor:pointer; display:flex; align-items:center; gap:5px; color:#166534;">
                    <input type="checkbox" id="auto-mode-switch" checked> 🤖 自动执行中 (10s/次)
                </label>
                <div id="next-check-msg" style="font-size:10px; color:#16a34a; margin-top:2px;">等待首次检查...</div>
            </div>

            <textarea id="username-list" readonly placeholder="待处理名单区域..."></textarea>

            <div id="status-msg">初始化完成</div>

            <div style="font-size:11px; font-weight:bold; color:#666; margin-bottom:3px;">📜 邀请成功日志 (最近):</div>
            <div id="invite-log">
                <div style="color:#ccc; text-align:center; padding-top:10px;">暂无历史记录</div>
            </div>

            <div style="display:flex; gap:5px; margin-top:10px;">
                <button id="btn-sync" class="panel-btn" style="flex:1;">同步</button>
                <button id="btn-start" class="panel-btn" style="flex:2;">手动补发</button>
            </div>
        `;
        document.body.appendChild(panel);

        const minBtn = document.createElement('div');
        minBtn.id = 'invite-min-btn';
        minBtn.innerHTML = '🚀';
        document.body.appendChild(minBtn);

        // 绑定事件
        document.getElementById('btn-sync').onclick = () => fetchFromSrv(true);
        document.getElementById('btn-start').onclick = () => startInvite(true);
        document.getElementById('auto-mode-switch').onchange = toggleAutoMode;

        panel.querySelector('.close-icon').onclick = () => {
            panel.style.display = 'none';
            minBtn.style.display = 'flex';
        };
        minBtn.onclick = () => {
            minBtn.style.display = 'none';
            panel.style.display = 'block';
        };

        toggleAutoMode({ target: { checked: true } });
    }

    // 添加历史日志函数
    function pushToLog(usernames) {
        const logArea = document.getElementById('invite-log');
        if (!logArea) return;

        // 如果是第一条记录，清除“暂无记录”提示
        if (logArea.innerText.includes("暂无历史记录")) logArea.innerHTML = "";

        const now = new Date();
        const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

        const logItem = document.createElement('div');
        logItem.className = 'log-item';
        logItem.innerHTML = `<span class="log-time">[${timeStr}]</span><span class="log-names">${usernames.join(', ')}</span>`;

        logArea.prepend(logItem); // 最新的放在最上面

        // 限制日志数量
        if (logArea.children.length > CONFIG.maxLogItems) {
            logArea.lastElementChild.remove();
        }
    }

    function setMsg(text, color = "#0056b3") {
        const msg = document.getElementById('status-msg');
        if (msg) {
            msg.innerText = text;
            msg.style.color = color;
        }
    }

    async function fetchFromSrv(isManual = false) {
        try {
            const res = await fetch(`${CONFIG.apiBase}?action=fetch_pending`);
            const data = await res.json();
            if (data.usernames && data.usernames.length > 0) {
                document.getElementById('username-list').value = data.usernames.join('\n');
                return data.usernames;
            }
            if (isManual) setMsg("📭 目前服务器没有新申请");
            return [];
        } catch (e) {
            setMsg("❌ 接口连接失败", "#d93025");
            return [];
        }
    }

    async function startInvite(isManual = false) {
        const listText = document.getElementById('username-list').value;
        const usernames = listText.split('\n').map(n => n.trim()).filter(n => n);
        const csrf = document.querySelector("meta[name=csrf-token]")?.content;

        if (!usernames.length || !csrf) return;

        if (isManual) setMsg("正在处理中...");

        try {
            const response = await fetch(`https://linux.do/groups/${CONFIG.groupId}/members.json`, {
                method: "PUT",
                headers: {
                    "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
                    "x-csrf-token": csrf,
                    "x-requested-with": "XMLHttpRequest"
                },
                body: `usernames=${encodeURIComponent(usernames.join(','))}&notify_users=true`
            });

            // 无论结果如何，记录并回传服务器标记已处理
            if (response.ok) {
                setMsg(`✅ 已处理 ${usernames.length} 位用户`);
            } else {
                setMsg(`⚠️ 跳过 ${usernames.length} 位异常用户`, "#92400e");
            }

            // 写入日志区域
            pushToLog(usernames);

            // 通知服务器标记完成
            await fetch(`${CONFIG.apiBase}?action=mark_done`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: `usernames=${encodeURIComponent(usernames.join(','))}`
            });

            document.getElementById('username-list').value = "";

        } catch (error) {
            setMsg("❌ 网络异常", "#d93025");
        }
    }

    async function autoTick() {
        const users = await fetchFromSrv(false);
        if (users && users.length > 0) {
            await startInvite(false);
        }
        const now = new Date();
        const next = new Date(now.getTime() + CONFIG.autoInterval);
        const msg = document.getElementById('next-check-msg');
        if (msg) msg.innerText = `最后检查：${now.toLocaleTimeString()} | 下次：${next.toLocaleTimeString()}`;
    }

    function toggleAutoMode(e) {
        const isEnabled = e.target.checked;
        const nextMsg = document.getElementById('next-check-msg');
        if (!nextMsg) return;

        if (isEnabled) {
            if (autoTimer) clearInterval(autoTimer);
            autoTick();
            autoTimer = setInterval(autoTick, CONFIG.autoInterval);
            nextMsg.style.color = "#16a34a";
        } else {
            if (autoTimer) clearInterval(autoTimer);
            nextMsg.innerText = "自动模式已停用";
            nextMsg.style.color = "#999";
        }
    }

    const observer = new MutationObserver(() => {
        if (document.body && !document.getElementById('invite-panel')) initUI();
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });

})();
