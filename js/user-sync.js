// 用户ID和数据同步功能
const USER_ID_KEY = 'libreTvUserId';
const SYNCED_DATA_KEY = 'libreTvSyncedData';

// 生成六位数纯数字用户ID
function generateUserId() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

// 获取当前用户ID，如果不存在则生成一个新的
function getUserId() {
    let userId = localStorage.getItem(USER_ID_KEY);
    if (!userId) {
        userId = generateUserId();
        localStorage.setItem(USER_ID_KEY, userId);
    }
    return userId;
}

// 设置用户ID并同步数据
function setUserId(newUserId) {
    if (!newUserId || !/^\d{6}$/.test(newUserId)) {
        showToast('请输入有效的6位数字用户ID', 'error');
        return false;
    }
    
    // 保存新的用户ID
    localStorage.setItem(USER_ID_KEY, newUserId);
    
    // 尝试加载云端数据
    loadSyncedData();
    
    showToast('用户ID已设置，正在同步数据...', 'success');
    return true;
}

// 获取需要同步的数据
function getSyncableData() {
    const data = {
        viewingHistory: [],
        selectedAPIs: [],
        customAPIs: [],
        yellowFilterEnabled: false,
        adFilterEnabled: false,
        doubanEnabled: false,
        lastSyncTime: Date.now()
    };
    
    try {
        // 同步观看历史
        const viewingHistory = JSON.parse(localStorage.getItem('viewingHistory') || '[]');
        data.viewingHistory = viewingHistory;
        
        // 同步API设置
        data.selectedAPIs = JSON.parse(localStorage.getItem('selectedAPIs') || '[]');
        data.customAPIs = JSON.parse(localStorage.getItem('customAPIs') || '[]');
        
        // 同步过滤设置
        data.yellowFilterEnabled = localStorage.getItem('yellowFilterEnabled') === 'true';
        data.adFilterEnabled = localStorage.getItem(PLAYER_CONFIG.adFilteringStorage) !== 'false';
        data.doubanEnabled = localStorage.getItem('doubanEnabled') === 'true';
    } catch (e) {
        console.error('获取同步数据失败:', e);
    }
    
    return data;
}

// 保存数据到本地存储
function saveDataToLocal(data) {
    try {
        if (data.viewingHistory && Array.isArray(data.viewingHistory)) {
            localStorage.setItem('viewingHistory', JSON.stringify(data.viewingHistory));
        }
        
        if (data.selectedAPIs && Array.isArray(data.selectedAPIs)) {
            localStorage.setItem('selectedAPIs', JSON.stringify(data.selectedAPIs));
        }
        
        if (data.customAPIs && Array.isArray(data.customAPIs)) {
            localStorage.setItem('customAPIs', JSON.stringify(data.customAPIs));
        }
        
        localStorage.setItem('yellowFilterEnabled', data.yellowFilterEnabled ? 'true' : 'false');
        localStorage.setItem(PLAYER_CONFIG.adFilteringStorage, data.adFilterEnabled ? 'true' : 'false');
        localStorage.setItem('doubanEnabled', data.doubanEnabled ? 'true' : 'false');
        
        // 保存同步时间
        localStorage.setItem('lastSyncTime', Date.now().toString());
    } catch (e) {
        console.error('保存同步数据到本地失败:', e);
        return false;
    }
    
    return true;
}

// 同步数据到云端（模拟）
// 添加一个锁，防止短时间内重复调用
let syncingInProgress = false;
let lastSyncTime = 0;
const MIN_SYNC_INTERVAL = 30000; // 最小同步间隔，30秒

function syncDataToCloud() {
    // 检查是否正在同步中
    if (syncingInProgress) {
        console.log('[同步] 同步操作正在进行中，跳过此次调用');
        return false;
    }
    
    // 检查距离上次同步的时间间隔
    const now = Date.now();
    if (now - lastSyncTime < MIN_SYNC_INTERVAL) {
        console.log('[同步] 距离上次同步时间过短，跳过此次调用');
        return false;
    }
    
    syncingInProgress = true;
    
    try {
        const userId = getUserId();
        const data = getSyncableData();
        
        // 在实际应用中，这里应该发送API请求到服务器
        // 但由于这是一个本地项目，我们将数据存储在localStorage中，并在控制台打印信息
        const syncedDataKey = `${SYNCED_DATA_KEY}_${userId}`;
        localStorage.setItem(syncedDataKey, JSON.stringify(data));
        
        console.log(`[同步] 用户ID: ${userId}，已将数据保存到云端（模拟）`);
        
        // 更新同步UI
        updateSyncUI(true);
        
        // 更新最后同步时间
        lastSyncTime = now;
        
        return true;
    } catch (error) {
        console.error('[同步] 同步数据到云端失败:', error);
        showToast('数据同步失败', 'error');
        return false;
    } finally {
        // 无论成功失败，都要释放锁
        setTimeout(() => {
            syncingInProgress = false;
        }, 1000); // 1秒后释放锁，防止过于频繁的调用
    }
}

// 从云端加载数据（模拟）
function loadSyncedData() {
    // 检查是否正在同步中
    if (syncingInProgress) {
        console.log('[同步] 同步操作正在进行中，跳过加载数据');
        showToast('同步操作正在进行中，请稍后再试', 'info');
        return false;
    }
    
    const userId = getUserId();
    const syncedDataKey = `${SYNCED_DATA_KEY}_${userId}`;
    
    // 在实际应用中，这里应该发送API请求到服务器获取数据
    // 但由于这是一个本地项目，我们从localStorage中读取数据
    const syncedData = localStorage.getItem(syncedDataKey);
    
    if (syncedData) {
        try {
            const data = JSON.parse(syncedData);
            if (saveDataToLocal(data)) {
                console.log(`[同步] 用户ID: ${userId}，已从云端加载数据（模拟）`);
                
                // 优化：减少提示频率，只在用户主动点击加载按钮时显示
                const event = window.event || window._lastEvent;
                if (event && event.type === 'click' && event.target.closest('#loadSyncedDataButton')) {
                    showToast('数据同步成功', 'success');
                }
                
                // 优化：不使用location.reload()，而是触发自定义事件让其他组件更新
                const syncEvent = new CustomEvent('libreTvSyncCompleted', { detail: data });
                document.dispatchEvent(syncEvent);
                
                // 更新同步UI状态
                updateSyncUI(true);
                
                return true;
            }
        } catch (e) {
            console.error('解析同步数据失败:', e);
            showToast('数据解析失败', 'error');
        }
    }
    
    // 只在用户主动点击加载按钮时显示提示
    const event = window.event || window._lastEvent;
    if (event && event.type === 'click' && event.target.closest('#loadSyncedDataButton')) {
        showToast('当前用户无同步数据', 'info');
    }
    
    return false;
}

// 更新同步UI状态
function updateSyncUI(isSynced = false) {
    const lastSyncTimeElement = document.getElementById('lastSyncTime');
    const syncStatusElement = document.getElementById('syncStatus');
    
    if (lastSyncTimeElement) {
        const lastSyncTime = localStorage.getItem('lastSyncTime');
        if (lastSyncTime) {
            const date = new Date(parseInt(lastSyncTime));
            lastSyncTimeElement.textContent = `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
        } else {
            lastSyncTimeElement.textContent = '从未同步';
        }
    }
    
    if (syncStatusElement) {
        if (isSynced) {
            syncStatusElement.innerHTML = '<span class="text-green-500">●</span> 已同步';
        } else {
            syncStatusElement.innerHTML = '<span class="text-yellow-500">●</span> 未同步';
        }
    }
}

// 初始化用户同步功能
function initUserSync() {
    // 获取并显示用户ID
    const userId = getUserId();
    const userIdElement = document.getElementById('currentUserId');
    const userIdInputElement = document.getElementById('userIdInput');
    
    if (userIdElement) {
        userIdElement.textContent = userId;
    }
    
    if (userIdInputElement) {
        userIdInputElement.value = userId;
    }
    
    // 更新同步状态
    updateSyncUI();
    
    // 添加同步按钮事件
    const syncButton = document.getElementById('syncDataButton');
    const loadButton = document.getElementById('loadSyncedDataButton');
    const applyIdButton = document.getElementById('applyUserIdButton');
    
    if (syncButton) {
        syncButton.addEventListener('click', function(event) {
            // 记录最后一个事件，用于判断是否是用户主动操作
            window._lastEvent = event;
            syncDataToCloud();
        });
    }
    
    if (loadButton) {
        loadButton.addEventListener('click', function(event) {
            // 记录最后一个事件，用于判断是否是用户主动操作
            window._lastEvent = event;
            loadSyncedData();
        });
    }
    
    if (applyIdButton) {
        applyIdButton.addEventListener('click', function(event) {
            // 记录最后一个事件，用于判断是否是用户主动操作
            window._lastEvent = event;
            if (userIdInputElement) {
                setUserId(userIdInputElement.value);
            }
        });
    }
    
    // 监听libreTvSyncCompleted事件，更新UI
    document.addEventListener('libreTvSyncCompleted', function(event) {
        console.log('[同步] 接收到同步完成事件，更新UI');
        updateSyncUI(true);
        // 这里可以添加其他UI更新逻辑
    });
}

// 在页面加载时初始化用户同步功能
document.addEventListener('DOMContentLoaded', function() {
    // 等待其他必要脚本加载完成
    setTimeout(initUserSync, 500);
});

// 重写相关的数据存储函数以支持用户ID
// 由于我们不能直接修改其他文件的函数，我们将提供一个钩子函数来增强这些功能
function enhanceDataStorageFunctions() {
    // 在数据发生变化时自动同步（如果启用了自动同步）
    const autoSyncEnabled = localStorage.getItem('autoSyncEnabled') === 'true';
    if (autoSyncEnabled) {
        // 防抖标志，避免短时间内多次触发
        let syncTimeout = null;
        
        // 监听localStorage变化
        window.addEventListener('storage', function(e) {
            // 避免循环触发：不处理自己写入的数据变化
            if (e.key && e.key !== USER_ID_KEY && !e.key.startsWith(SYNCED_DATA_KEY)) {
                // 清除之前的定时器
                if (syncTimeout) {
                    clearTimeout(syncTimeout);
                }
                
                // 延迟同步，避免频繁同步
                syncTimeout = setTimeout(syncDataToCloud, 5000);
            }
        });
    }
}

// 导出必要的函数供其他脚本使用
window.generateUserId = generateUserId;
window.getUserId = getUserId;
window.setUserId = setUserId;
window.syncDataToCloud = syncDataToCloud;
window.loadSyncedData = loadSyncedData;
window.enhanceDataStorageFunctions = enhanceDataStorageFunctions;