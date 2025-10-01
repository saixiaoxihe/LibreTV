// 用户数据同步功能
// 用户数据同步模块

// 生成六位数纯数字用户ID
export function generateUserId() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

// 获取当前用户ID
export function getCurrentUserId() {
    let userId = localStorage.getItem('userId');
    if (!userId) {
        userId = generateUserId();
        localStorage.setItem('userId', userId);
    }
    return userId;
}

// 设置用户ID并同步数据
export async function setUserId(newUserId) {
    // 验证ID格式（六位数纯数字）
    if (!/^\d{6}$/.test(newUserId)) {
        showToast('请输入六位数纯数字ID', 'error');
        return false;
    }

    // 保存新的用户ID
    const oldUserId = localStorage.getItem('userId');
    localStorage.setItem('userId', newUserId);

    // 如果是第一次设置用户ID或ID已更改，则加载云端数据
    if (!oldUserId || oldUserId !== newUserId) {
        showLoading('正在同步数据...');
        try {
            // 尝试加载云端数据
            await syncDataFromCloud();
            showToast('数据同步成功', 'success');
        } catch (error) {
            console.error('同步数据失败:', error);
            showToast('数据同步失败，将使用本地数据', 'warning');
        } finally {
            hideLoading();
        }
    }
    return true;
}

// 从云端同步数据
async function syncDataFromCloud() {
    try {
        const userId = getCurrentUserId();
        
        // 构建sync.js API的URL
        const apiUrl = `/functions/sync.js?action=get&key=viewingHistory&userId=${userId}`;
        
        const response = await fetch(apiUrl);
        const data = await response.json();
        
        if (data.error) {
            // 如果出错，可能是第一次同步，不抛出错误
            console.warn('从云端获取数据时出错:', data.error);
            return false;
        }
        
        // 如果有云端数据，则更新本地存储
        if (data.value) {
            localStorage.setItem('viewingHistory', JSON.stringify(data.value));
        }
        
        // 同步播放进度数据
        const progressKeys = Object.keys(localStorage).filter(key => 
            key.startsWith('videoProgress_')
        );
        
        for (const key of progressKeys) {
            const videoId = key.replace('videoProgress_', '');
            const progressUrl = `/functions/sync.js?action=get&key=progress_${videoId}&userId=${userId}`;
            const progressResponse = await fetch(progressUrl);
            const progressData = await progressResponse.json();
            
            if (progressData.value) {
                localStorage.setItem(key, JSON.stringify(progressData.value));
            }
        }
        
        return true;
    } catch (error) {
        console.error('从云端同步数据失败:', error);
        throw error;
    }
}

// 保存历史记录到云端
export async function syncHistoryToCloud() {
    try {
        const userId = getCurrentUserId();
        const viewingHistory = JSON.parse(localStorage.getItem('viewingHistory') || '[]');
        
        const response = await fetch(`/functions/sync.js?action=set&key=viewingHistory&userId=${userId}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ value: viewingHistory })
        });
        
        const data = await response.json();
        if (data.error) {
            console.error('保存历史记录到云端失败:', data.error);
            return false;
        }
        
        return true;
    } catch (error) {
        console.error('保存历史记录到云端失败:', error);
        // 不抛出错误，因为即使同步失败也不应该影响用户体验
        return false;
    }
}

// 保存播放进度到云端
export async function syncProgressToCloud(videoId, progressData) {
    try {
        const userId = getCurrentUserId();
        const key = `progress_${videoId}`;
        
        if (progressData === null) {
            // 如果progressData为null，则删除云端数据
            const response = await fetch(`/functions/sync.js?action=remove&key=${key}&userId=${userId}`);
            const data = await response.json();
            
            if (data.error) {
                console.error('从云端删除进度数据失败:', data.error);
                return false;
            }
        } else {
            // 否则，保存数据到云端
            const response = await fetch(`/functions/sync.js?action=set&key=${key}&userId=${userId}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ value: progressData })
            });
            
            const data = await response.json();
            if (data.error) {
                console.error('保存进度到云端失败:', data.error);
                return false;
            }
        }
        
        return true;
    } catch (error) {
        console.error('同步进度到云端失败:', error);
        // 不抛出错误，因为即使同步失败也不应该影响用户体验
        return false;
    }
}

// 监听数据变化并自动同步
function setupAutoSync() {
    // 监听观看历史变化并同步
    const originalSaveToHistory = window.saveToHistory;
    if (originalSaveToHistory) {
        window.saveToHistory = function() {
            // 调用原始函数
            const result = originalSaveToHistory.apply(this, arguments);
            // 自动同步到云端
            syncHistoryToCloud();
            return result;
        };
    }
    
    // 监听播放进度变化并同步
    const originalSaveCurrentProgress = window.saveCurrentProgress;
    if (originalSaveCurrentProgress) {
        window.saveCurrentProgress = function() {
            // 调用原始函数
            const result = originalSaveCurrentProgress.apply(this, arguments);
            // 自动同步到云端
            if (window.getCurrentVideoId && window.getCurrentVideoId()) {
                const videoId = window.getCurrentVideoId();
                const progressKey = `videoProgress_${videoId}`;
                const progressData = JSON.parse(localStorage.getItem(progressKey) || 'null');
                if (progressData) {
                    syncProgressToCloud(videoId, progressData);
                }
            }
            return result;
        };
    }
}

// 初始化用户数据同步功能
export function initUserDataSync() {
    // 确保用户有ID
    getCurrentUserId();
    
    // 设置自动同步
    setupAutoSync();
    
    // 定义全局方法以获取当前视频ID（供saveCurrentProgress使用）
    window.getCurrentVideoId = function() {
        if (typeof getVideoId === 'function') {
            return getVideoId();
        }
        return null;
    };
}

// 导出函数供其他模块使用
window.generateUserId = generateUserId;
window.getCurrentUserId = getCurrentUserId;
window.setUserId = setUserId;
window.syncDataFromCloud = syncDataFromCloud;
window.syncHistoryToCloud = syncHistoryToCloud;
window.syncProgressToCloud = syncProgressToCloud;
window.initUserDataSync = initUserDataSync;