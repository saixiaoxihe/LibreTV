// 用户ID和数据同步功能
// 假设config.js是通过HTML文件全局加载的，这里不再重复导入

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
    
    // 移除自动加载云端数据的逻辑，应用按钮只用来确定和绑定ID
    showToast('用户ID已设置', 'success');
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
    
    // 检查方法3: 手动配置选项
    // 为了解决本地开发环境或自定义域名环境中的同步问题，
    // 我们添加一个手动配置选项，默认值改为true以支持移动设备上的同步
    const forceCloudflareSync = localStorage.getItem('forceCloudflareSync') === 'true';
    return forceCloudflareSync;
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
        
        // 同步搜索历史 - 使用与ui.js相同的键名
        // 先尝试从标准位置获取
        let searchHistory = JSON.parse(localStorage.getItem(SEARCH_HISTORY_KEY) || '[]');
        // 如果没有，尝试从旧位置获取
        if (!searchHistory || searchHistory.length === 0) {
            searchHistory = JSON.parse(localStorage.getItem('videoSearchHistory') || '[]');
        }
        data.searchHistory = searchHistory;
        
        console.log('[同步] 收集到的数据类型:', {
            viewingHistory: data.viewingHistory.length,
            selectedAPIs: data.selectedAPIs.length,
            customAPIs: data.customAPIs.length,
            searchHistory: data.searchHistory.length,
            filters: { yellow: data.yellowFilterEnabled, ad: data.adFilterEnabled, douban: data.doubanEnabled }
        });
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
        
        // 保存搜索历史 - 使用与ui.js相同的键名
        if (data.searchHistory && Array.isArray(data.searchHistory)) {
            // 保存到标准位置
            localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(data.searchHistory));
        }
        
        // 保存同步时间
        localStorage.setItem('lastSyncTime', Date.now().toString());
    } catch (e) {
        console.error('保存同步数据到本地失败:', e);
        return false;
    }
    
    return true;
}

// 辅助函数：检测是否为移动设备
function isMobileDevice() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

// 辅助函数：发送网络请求，带重试机制和超时设置
async function fetchWithRetry(url, options = {}, retries = 2, retryDelay = 1000, timeout = 10000) { // 增加超时设置为10秒
    try {
        // 设置fetch超时
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), timeout);
        
        const response = await fetch(url, {
            ...options,
            signal: controller.signal,
            credentials: 'omit', // 确保跨域请求不带凭证，在移动设备上更稳定
        });
        clearTimeout(id); // 清除超时计时器
        
        if (!response.ok) {
            // 对于非200响应，尝试解析JSON错误信息
            let errorMessage = `HTTP错误: ${response.status}`;
            try {
                const errorData = await response.json();
                if (errorData.message) {
                    errorMessage = errorData.message;
                }
            } catch (e) {
                // 如果无法解析JSON，继续使用原始错误消息
            }
            throw new Error(errorMessage);
        }
        
        // 尝试解析JSON响应
        try {
            return await response.json();
        } catch (jsonError) {
            console.error('解析响应JSON失败:', jsonError);
            // 即使JSON解析失败，也返回一个成功的响应，以便调用者知道请求本身是成功的
            return { success: true, rawData: await response.text() };
        }
    } catch (error) {
        console.warn(`请求失败 (${url}): ${error.message}`);
        
        // 特殊处理网络错误，为移动设备提供更明确的错误信息
        let errorMsg = error.message;
        if (error.name === 'AbortError') {
            errorMsg = '请求超时，请检查网络连接';
        } else if (errorMsg.includes('NetworkError') || errorMsg.includes('Failed to fetch')) {
            errorMsg = '网络连接失败，请检查网络设置';
        }
        
        // 如果还有重试次数，延迟后重试
        if (retries > 0) {
            console.log(`将在${retryDelay}ms后重试，剩余重试次数: ${retries}`);
            await new Promise(resolve => setTimeout(resolve, retryDelay));
            return fetchWithRetry(url, options, retries - 1, retryDelay * 2); // 指数退避
        }
        
        // 所有重试都失败，返回失败的响应对象，而不是抛出错误
        // 这样调用者可以更优雅地处理错误
        return { success: false, message: errorMsg };
    }
}

// 添加一个锁，防止短时间内重复调用
let syncingInProgress = false;
let lastSyncTime = 0;
const MIN_SYNC_INTERVAL = 30000; // 最小同步间隔，30秒

// 同步数据到云端（Cloudflare KV）
function syncDataToCloud() {
    // 检查是否正在同步中
    if (syncingInProgress) {
        console.log('[同步] 同步操作正在进行中，跳过此次调用');
        showToast('同步操作正在进行中，请稍后再试', 'info');
        return false;
    }
    
    // 检查距离上次同步的时间间隔
    const now = Date.now();
    if (now - lastSyncTime < MIN_SYNC_INTERVAL) {
        console.log('[同步] 距离上次同步时间过短，跳过此次调用');
        showToast('操作过于频繁，请稍后再试', 'info');
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
                
                // 显示成功提示
                showToast('数据上传成功', 'success');
            } else {
                console.error('[同步] 同步数据到云端失败:', result.message);
                showToast(`数据上传失败: ${result.message || '未知错误'}`, 'error');
                
                // 降级到localStorage作为备份
                fallbackToLocalStorage(userId, data);
            }
        })
        .catch(error => {
            console.error('[同步] 同步数据到云端网络错误:', error);
            showToast('数据上传失败，请检查网络连接', 'error');
            
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
        
        // 显示本地备份提示
        showToast('已保存到本地备份', 'info');
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
    
    syncingInProgress = true;
    
    const userId = getUserId();
    
    // 判断是否在Cloudflare环境中运行
    const isCloudflareEnv = isRunningInCloudflare();
    
    if (isCloudflareEnv) {
        console.log(`[同步] 尝试从云端加载数据，用户ID: ${userId}`);
        
        // 发送请求到Cloudflare Function获取数据
        fetchWithRetry(`/user-sync?userId=${userId}`)
        .then(result => {
            console.log('[同步] 云端请求结果:', result);
            
            if (result.success && result.data) {
                try {
                    if (saveDataToLocal(result.data)) {
                        console.log(`[同步] 用户ID: ${userId}，已从Cloudflare KV加载数据`);
                        
                        // 显示成功提示
                        showToast('数据拉取成功', 'success');
                        
                        // 触发自定义事件让其他组件更新
                        const syncEvent = new CustomEvent('libreTvSyncCompleted', { detail: result.data });
                        document.dispatchEvent(syncEvent);
                        
                        // 更新同步UI状态
                        updateSyncUI(true);
                        
                        // 更新数据源选择UI状态
                        updateSelectedApisUI();
                        
                        // 更新搜索历史UI
                        if (typeof renderSearchHistory === 'function') {
                            renderSearchHistory();
                        }
                    }
                } catch (e) {
                    console.error('保存同步数据失败:', e);
                    showToast('数据保存失败', 'error');
                }
            } else {
                console.log(`[同步] 用户ID: ${userId}，云端暂无同步数据或请求失败`, result.message || '未知错误');
                
                // 尝试从localStorage备份加载数据
                loadFromLocalStorageBackup(userId);
                
                showToast(result.message || '当前用户无同步数据', 'info');
            }
        })
        .catch(error => {
            console.error('[同步] 从云端加载数据捕获到异常:', error);
            // 尝试从localStorage备份加载数据
            loadFromLocalStorageBackup(userId);
            
            showToast(`数据拉取失败: ${error.message || '未知错误'}`, 'error');
        })
        .finally(() => {
            // 无论成功失败，都要释放锁
            setTimeout(() => {
                syncingInProgress = false;
            }, 1000);
        });
    } else {
        console.log(`[同步] 非Cloudflare环境，尝试从localStorage备份加载数据，用户ID: ${userId}`);
        
        // 非Cloudflare环境，尝试从localStorage备份加载数据
        loadFromLocalStorageBackup(userId);
        syncingInProgress = false;
        
        // 显示提示信息
        showToast('当前环境不支持云端同步，使用本地备份', 'info');
    }
    
    return true;
}

// 更新数据源选择UI状态
function updateSelectedApisUI() {
    try {
        // 获取保存的selectedAPIs
        const selectedAPIs = JSON.parse(localStorage.getItem('selectedAPIs') || '[]');
        
        // 更新内置API复选框
        const allBuiltInCheckboxes = document.querySelectorAll('#apiCheckboxes input[type="checkbox"]');
        allBuiltInCheckboxes.forEach(checkbox => {
            const apiKey = checkbox.dataset.api;
            checkbox.checked = selectedAPIs.includes(apiKey);
        });
        
        // 更新自定义API复选框
        const allCustomCheckboxes = document.querySelectorAll('#customApisList input[type="checkbox"]');
        allCustomCheckboxes.forEach(checkbox => {
            const customIndex = checkbox.dataset.customIndex;
            const customKey = 'custom_' + customIndex;
            checkbox.checked = selectedAPIs.includes(customKey);
        });
        
        // 更新选中的API数量显示
        if (typeof updateSelectedApiCount === 'function') {
            updateSelectedApiCount();
        }
        
        console.log('[同步] 已更新数据源选择UI');
    } catch (e) {
        console.error('更新数据源选择UI失败:', e);
    }
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
                
                // 只在用户主动点击操作时显示提示
                const event = window._lastEvent;
                if (event && event.type === 'click') {
                    showToast('已从本地备份加载数据', 'success');
                }
            }
        } else {
            console.log(`[同步] 用户ID: ${userId}，本地暂无备份数据`);
            
            // 只在用户主动点击操作时显示提示
            const event = window._lastEvent;
            if (event && event.type === 'click') {
                showToast('暂无备份数据', 'info');
            }
        }
    } catch (error) {
        console.error('[同步] 从localStorage备份加载数据失败:', error);
        
        // 只在用户主动点击操作时显示提示
        const event = window._lastEvent;
        if (event && event.type === 'click') {
            showToast('加载本地备份失败', 'error');
        }
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
    
    // 添加上传数据按钮事件
    const uploadDataButton = document.getElementById('uploadDataButton');
    
    if (uploadDataButton) {
        uploadDataButton.addEventListener('click', function(event) {
            window._lastEvent = event;
            showToast('正在上传数据...', 'info');
            syncDataToCloud();
        });
    }
    
    // 添加拉取数据按钮事件
    const pullDataButton = document.getElementById('pullDataButton');
    
    if (pullDataButton) {
        pullDataButton.addEventListener('click', function(event) {
            window._lastEvent = event;
            showToast('正在拉取数据...', 'info');
            loadSyncedData();
        });
    }
    
    // 添加强制云端同步选项
    const forceCloudflareSyncToggle = document.getElementById('forceCloudflareSyncToggle');
    if (forceCloudflareSyncToggle) {
        // 初始化开关状态 - 默认设置为true，特别是针对移动设备
        let currentState = localStorage.getItem('forceCloudflareSync');
        if (currentState === null) {
            // 如果localStorage中没有设置，默认启用强制云端同步
            currentState = 'true';
            localStorage.setItem('forceCloudflareSync', currentState);
        }
        forceCloudflareSyncToggle.checked = currentState === 'true';
        
        // 添加事件监听器
        forceCloudflareSyncToggle.addEventListener('change', function() {
            const isEnabled = this.checked;
            localStorage.setItem('forceCloudflareSync', isEnabled ? 'true' : 'false');
            showToast(isEnabled ? '已启用强制云端同步' : '已禁用强制云端同步', 'info');
        });
    }
    
    // 添加移动设备特定的同步提示
    if (isMobileDevice()) {
        // 查找同步功能区域 - 由于没有特定ID，我们使用包含特定元素的div
        const syncSection = document.querySelector('div:has(#forceCloudflareSyncToggle)');
        if (syncSection) {
            // 检查是否已经存在移动设备提示
            let mobileHint = document.querySelector('#mobileSyncHint');
            if (!mobileHint) {
                mobileHint = document.createElement('div');
                mobileHint.id = 'mobileSyncHint';
                mobileHint.className = 'text-sm text-blue-600 mt-2 bg-blue-50 p-2 rounded';
                mobileHint.innerHTML = '<i class="fa fa-info-circle mr-1"></i> 移动设备同步提示：请确保已连接到稳定网络，并已启用"强制云端同步"选项';
                syncSection.appendChild(mobileHint);
            }
        }
    }
    
    // 监听libreTvSyncCompleted事件，更新UI
    document.addEventListener('libreTvSyncCompleted', function(event) {
        console.log('[同步] 接收到同步完成事件，更新UI');
        updateSyncUI(true);
        // 这里可以添加其他UI更新逻辑
    });
    
    // 页面加载时不自动加载同步数据，用户需要手动点击拉取数据按钮
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
    // 手动同步模式下，不自动同步数据
    console.log('[同步] 当前为手动同步模式，数据变化时不会自动同步');
}

// 导出必要的函数供其他脚本使用
window.generateUserId = generateUserId;
window.getUserId = getUserId;
window.setUserId = setUserId;
window.syncDataToCloud = syncDataToCloud;
window.loadSyncedData = loadSyncedData;
window.enhanceDataStorageFunctions = enhanceDataStorageFunctions;