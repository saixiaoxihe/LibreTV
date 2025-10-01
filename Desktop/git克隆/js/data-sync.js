// 设备唯一标识符和数据同步管理模块

// 使用传统的方式导出函数
dataSync = {
    // 生成或获取用户唯一标识符
    getUserId: function() {
        let userId = localStorage.getItem('userId');
        if (!userId) {
            // 生成新的用户唯一标识符
            userId = this.generateUniqueId();
            localStorage.setItem('userId', userId);
            console.log('新用户ID已生成:', userId);
        }
        return userId;
    },

    // 生成唯一ID
    generateUniqueId: function() {
        // 使用时间戳和随机数生成唯一ID
        const timestamp = Date.now();
        const random = Math.random().toString(36).substr(2, 9);
        return `${timestamp}_${random}`;
    },

    // 异步获取远程存储的数据
    getRemoteData: async function(key) {
        try {
            const userId = this.getUserId();
            const url = `/sync?action=get&key=${encodeURIComponent(key)}&userId=${encodeURIComponent(userId)}`;
            const response = await fetch(url, { method: 'GET', credentials: 'same-origin' });
            if (response.ok) {
                const data = await response.json();
                return data.value || null;
            } else {
                console.warn('获取远程数据失败，状态码:', response.status);
            }
        } catch (error) {
            console.error('获取远程数据失败:', error);
        }
        return null;
    },

    // 异步保存数据到远程存储
    setRemoteData: async function(key, value) {
        try {
            const userId = this.getUserId();
            const url = `/sync?action=set&key=${encodeURIComponent(key)}&userId=${encodeURIComponent(userId)}`;
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ value }),
                credentials: 'same-origin'
            });
            if (response.ok) {
                console.log(`数据已成功同步到云端: ${key}`);
            } else {
                console.warn('保存远程数据失败，状态码:', response.status);
            }
            return response.ok;
        } catch (error) {
            console.error('保存远程数据失败:', error);
        }
        return false;
    },

    // 从本地或远程获取数据
    // 优先从本地获取，如果没有则从远程获取
    getData: async function(key) {
        // 优先从本地获取
        try {
            const localValue = localStorage.getItem(key);
            if (localValue) {
                return JSON.parse(localValue);
            }
        } catch (error) {
            console.error('读取本地数据失败:', error);
        }

        // 本地没有则从远程获取
        const remoteValue = await this.getRemoteData(key);
        if (remoteValue !== null) {
            // 将远程数据保存到本地
            try {
                localStorage.setItem(key, JSON.stringify(remoteValue));
            } catch (error) {
                console.error('保存远程数据到本地失败:', error);
            }
            return remoteValue;
        }

        return null;
    },

    // 保存数据到本地和远程
    saveData: async function(key, value) {
        // 保存到本地
        try {
            localStorage.setItem(key, JSON.stringify(value));
        } catch (error) {
            console.error('保存数据到本地失败:', error);
        }

        // 异步保存到远程
        await this.setRemoteData(key, value);
    },

    // 从本地和远程删除数据
    removeData: async function(key) {
        // 从本地删除
        try {
            localStorage.removeItem(key);
        } catch (error) {
            console.error('从本地删除数据失败:', error);
        }

        // 异步从远程删除
        try {
            const userId = this.getUserId();
            const url = `/sync?action=remove&key=${encodeURIComponent(key)}&userId=${encodeURIComponent(userId)}`;
            await fetch(url, { method: 'DELETE', credentials: 'same-origin' });
        } catch (error) {
            console.error('从远程删除数据失败:', error);
        }
    },

    // 从远程删除数据（用于clearData）
    clearRemoteData: async function(key) {
        try {
            const userId = this.getUserId();
            const url = `/sync?action=remove&key=${encodeURIComponent(key)}&userId=${encodeURIComponent(userId)}`;
            const response = await fetch(url, {
                method: 'DELETE',
                credentials: 'same-origin'
            });
            return response.ok;
        } catch (error) {
            console.error('清除远程数据失败:', error);
        }
        return false;
    },

    // 清除数据（本地和远程）
    clearData: async function(key) {
        try {
            localStorage.removeItem(key);
            await this.clearRemoteData(key);
        } catch (error) {
            console.error('清除数据失败:', error);
        }
    },

    // 同步所有本地数据到远程
    syncAllData: async function() {
        try {
            const keys = ['viewingHistory'];
            for (const key of keys) {
                const value = localStorage.getItem(key);
                if (value) {
                    await this.setRemoteData(key, JSON.parse(value));
                }
            }
            console.log('数据同步完成');
        } catch (error) {
            console.error('数据同步失败:', error);
        }
    },

    // 从远程同步所有数据到本地
    fetchAllData: async function() {
        try {
            const keys = ['viewingHistory'];
            for (const key of keys) {
                const value = await this.getRemoteData(key);
                if (value !== null) {
                    localStorage.setItem(key, JSON.stringify(value));
                }
            }
            console.log('数据获取完成');
        } catch (error) {
            console.error('获取远程数据失败:', error);
        }
    },

    // 初始化数据同步系统
    initDataSync: async function() {
        // 确保用户ID存在
        this.getUserId();
        
        // 尝试从远程获取数据（如果本地没有）
        if (!localStorage.getItem('viewingHistory')) {
            await this.fetchAllData();
        }
        
        // 设置定期同步
        setInterval(() => this.syncAllData(), 60000); // 每分钟同步一次
    },

    // 导出用户ID（用于在其他设备上导入）
    exportUserId: function() {
        const userId = this.getUserId();
        return userId;
    },

    // 导入用户ID（用于在其他设备上使用相同的用户ID）
    importUserId: function(userId) {
        if (userId && typeof userId === 'string') {
            localStorage.setItem('userId', userId);
            console.log('用户ID已导入:', userId);
            // 重新获取同步数据
            this.fetchAllData();
            return true;
        }
        return false;
    }
};

// 确保dataSync对象在全局作用域中可用
if (typeof window !== 'undefined') {
    window.dataSync = dataSync;
}