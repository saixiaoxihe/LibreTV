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

// 检查是否在Cloudflare环境中运行
function isRunningInCloudflare() {
    // 检查方法1: Cloudflare环境变量
    if (window.__CF && window.__CF.Cloudflare) {
        return true;
    }
    
    // 检查方法2: Cloudflare Pages默认域名
    const hostname = window.location.hostname;
    if (hostname.endsWith('.pages.dev') || hostname.endsWith('.workers.dev')) {
        return true;
    }
    
    // 检查方法3: 尝试通过请求头或特定响应特征检测
    // 这个函数在运行时会被多次调用，我们只需要返回一个保守的判断
    // 对于自定义域名，我们采用默认策略：优先尝试云端同步
    // 因为如果尝试失败，系统会自动降级到本地存储
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
        searchHistory: [],
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
        
        // 同步搜索历史
        data.searchHistory = JSON.parse(localStorage.getItem('videoSearchHistory') || '[]');
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
        
        // 保存搜索历史
        if (data.searchHistory && Array.isArray(data.searchHistory)) {
            localStorage.setItem('videoSearchHistory', JSON.stringify(data.searchHistory));
        }
        
        // 保存同步时间
        localStorage.setItem('lastSyncTime', Date.now().toString());
    } catch (e) {
        console.error('保存同步数据到本地失败:', e);
        return false;
    }
    
    return true;
}

// 辅助函数：发送网络请求，带重试机制
async function fetchWithRetry(url, options = {}, retries = 2, retryDelay = 1000) {
    try {
        const response = await fetch(url, options);
        if (!response.ok) {
            throw new Error(`HTTP错误: ${response.status}`);
        }
        return await response.json();
    } catch (error) {
        console.warn(`请求失败 (${url}): ${error.message}`);
        
        // 如果还有重试次数，延迟后重试
        if (retries > 0) {
            console.log(`将在${retryDelay}ms后重试，剩余重试次数: ${retries}`);
            await new Promise(resolve => setTimeout(resolve, retryDelay));
            return fetchWithRetry(url, options, retries - 1, retryDelay * 2); // 指数退避
        }
        
        // 所有重试都失败
        throw error;
    }
}

// 同步数据到云端（Cloudflare KV）
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
    
    // 获取用户ID和同步数据
    const userId = getUserId();
    const data = getSyncableData();
    
    // 判断是否在Cloudflare环境中运行
    const isCloudflareEnv = isRunningInCloudflare();
    
    if (isCloudflareEnv) {
        // 发送数据到Cloudflare Function
        fetchWithRetry(`/user-sync?userId=${userId}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        })
        .then(result => {
            if (result.success) {
                console.log(`[同步] 用户ID: ${userId}，已将数据保存到Cloudflare KV`);
                
                // 更新同步UI
                updateSyncUI(true);
                
                // 更新最后同步时间
                lastSyncTime = now;
                localStorage.setItem('lastSyncTime', now.toString());
            } else {
                console.error('[同步] 同步数据到云端失败:', result.message);
                showToast(`数据同步失败: ${result.message}`, 'error');
                
                // 降级到localStorage作为备份
                fallbackToLocalStorage(userId, data);
            }
        })
        .catch(error => {
            console.error('[同步] 同步数据到云端网络错误:', error);
            showToast('数据同步失败，请检查网络连接', 'error');
            
            // 降级到localStorage作为备份
            fallbackToLocalStorage(userId, data);
        })
        .finally(() => {
            // 无论成功失败，都要释放锁
            setTimeout(() => {
                syncingInProgress = false;
            }, 1000); // 1秒后释放锁，防止过于频繁的调用
        });
    } else {
        // 非Cloudflare环境，使用localStorage作为备份
        fallbackToLocalStorage(userId, data);
        syncingInProgress = false;
    }
    
    return true;
}

// 从云端加载数据（Cloudflare KV）
function loadSyncedData() {
    // 检查是否正在同步中
    if (syncingInProgress) {
        console.log('[同步] 同步操作正在进行中，跳过加载数据');
        showToast('同步操作正在进行中，请稍后再试', 'info');
        return false;
    }
    
    const userId = getUserId();
    
    // 判断是否在Cloudflare环境中运行
    const isCloudflareEnv = isRunningInCloudflare();
    
    if (isCloudflareEnv) {
        // 发送请求到Cloudflare Function获取数据
        fetchWithRetry(`/user-sync?userId=${userId}`)
        .then(result => {
            if (result.success && result.data) {
                try {
                    if (saveDataToLocal(result.data)) {
                        console.log(`[同步] 用户ID: ${userId}，已从Cloudflare KV加载数据`);
                        
                        // 只在用户主动点击操作时显示提示
                        const event = window.event || window._lastEvent;
                        if (event && event.type === 'click') {
                            showToast('数据同步成功', 'success');
                        }
                        
                        // 不使用location.reload()，而是触发自定义事件让其他组件更新
                        const syncEvent = new CustomEvent('libreTvSyncCompleted', { detail: result.data });
                        document.dispatchEvent(syncEvent);
                        
                        // 更新同步UI状态
                        updateSyncUI(true);
                    }
                } catch (e) {
                    console.error('保存同步数据失败:', e);
                    showToast('数据保存失败', 'error');
                }
            } else {
                console.log(`[同步] 用户ID: ${userId}，云端暂无同步数据`);
                
                // 尝试从localStorage备份加载数据
                loadFromLocalStorageBackup(userId);
                
                // 只在用户主动点击操作时显示提示
                const event = window.event || window._lastEvent;
                if (event && event.type === 'click') {
                    showToast('当前用户无同步数据', 'info');
                }
            }
        })
        .catch(error => {
            console.error('[同步] 从云端加载数据失败:', error);
            // 尝试从localStorage备份加载数据
            loadFromLocalStorageBackup(userId);
            
            // 避免在页面自动加载时显示错误提示
            const event = window.event || window._lastEvent;
            if (event && event.type === 'click') {
                showToast('数据加载失败，请检查网络连接', 'error');
            }
        });
    } else {
        // 非Cloudflare环境，尝试从localStorage备份加载数据
        loadFromLocalStorageBackup(userId);
    }
    
    return true;
}

// 降级到localStorage作为备份
function fallbackToLocalStorage(userId, data) {
    try {
        const syncedDataKey = `${SYNCED_DATA_KEY}_${userId}`;
        localStorage.setItem(syncedDataKey, JSON.stringify(data));
        console.log(`[同步] 用户ID: ${userId}，已将数据保存到localStorage作为备份`);
        
        // 更新同步UI（标记为本地同步）
        updateSyncUI(true, true);
        
        // 更新最后同步时间
        const now = Date.now();
        lastSyncTime = now;
        localStorage.setItem('lastSyncTime', now.toString());
    } catch (error) {
        console.error('[同步] 保存到localStorage备份失败:', error);
    }
}

// 从localStorage备份加载数据
function loadFromLocalStorageBackup(userId) {
    try {
        const syncedDataKey = `${SYNCED_DATA_KEY}_${userId}`;
        const syncedData = localStorage.getItem(syncedDataKey);
        
        if (syncedData) {
            const data = JSON.parse(syncedData);
            if (saveDataToLocal(data)) {
                console.log(`[同步] 用户ID: ${userId}，已从localStorage备份加载数据`);
                
                // 触发自定义事件让其他组件更新
                const syncEvent = new CustomEvent('libreTvSyncCompleted', { detail: data });
                document.dispatchEvent(syncEvent);
                
                // 更新同步UI状态（标记为本地同步）
                updateSyncUI(true, true);
            }
        }
    } catch (error) {
        console.error('[同步] 从localStorage备份加载数据失败:', error);
    }
}

// 更新同步UI状态
function updateSyncUI(isSynced = false, isLocalSync = false) {
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
            if (isLocalSync) {
                syncStatusElement.innerHTML = '<span class="text-green-500">●</span> 已同步 (本地备份)';
            } else {
                syncStatusElement.innerHTML = '<span class="text-green-500">●</span> 已同步';
            }
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
    
    // 添加用户ID应用按钮事件
    const applyIdButton = document.getElementById('applyUserIdButton');
    
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
    
    // 页面加载时自动加载同步数据，确保用户在不同设备上能立即看到数据
    setTimeout(function() {
        loadSyncedData();
    }, 1000); // 延迟1秒执行，确保页面其他元素加载完成
    
    // 启用每三分钟自动同步
    enableAutoSync();
}

// 启用每三分钟自动同步
function enableAutoSync() {
    // 立即执行一次同步
    syncDataToCloud();
    
    // 然后每三分钟执行一次同步
    setInterval(function() {
        // 只在页面可见时执行同步，节省资源
        if (document.visibilityState === 'visible') {
            syncDataToCloud();
        }
    }, 3 * 60 * 1000); // 3分钟
    
    // 监听页面可见性变化，当页面从不可见变为可见时同步一次
    document.addEventListener('visibilitychange', function() {
        if (document.visibilityState === 'visible') {
            // 检查距离上次同步是否超过1分钟，如果是则同步
            const now = Date.now();
            if (now - lastSyncTime > 60000) {
                syncDataToCloud();
            }
        }
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