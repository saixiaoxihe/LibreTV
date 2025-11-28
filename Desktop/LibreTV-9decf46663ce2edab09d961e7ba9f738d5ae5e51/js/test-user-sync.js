// 用户ID和数据同步功能测试脚本
console.log('开始测试用户ID和数据同步功能...');

// 测试1: 生成用户ID
testGenerateUserId();

// 测试2: 设置和获取用户ID
testSetAndGetUserId();

// 测试3: 同步数据到云端
testSyncDataToCloud();

// 测试4: 从云端加载数据
testLoadSyncedData();

// 测试1: 生成用户ID
function testGenerateUserId() {
    console.log('\n测试1: 生成用户ID');
    try {
        const userId = generateUserId();
        console.log('生成的用户ID:', userId);
        
        if (userId && userId.length === 6 && /^\d+$/.test(userId)) {
            console.log('✓ 测试通过: 成功生成6位纯数字用户ID');
            return true;
        } else {
            console.error('✗ 测试失败: 生成的用户ID不符合要求');
            return false;
        }
    } catch (error) {
        console.error('✗ 测试失败: 生成用户ID时发生错误:', error);
        return false;
    }
}

// 测试2: 设置和获取用户ID
function testSetAndGetUserId() {
    console.log('\n测试2: 设置和获取用户ID');
    try {
        // 保存原始用户ID
        const originalUserId = localStorage.getItem('libreTvUserId');
        
        // 测试设置有效的用户ID
        const testUserId = '123456';
        const setResult = setUserId(testUserId);
        
        if (setResult && getUserId() === testUserId) {
            console.log('✓ 测试通过: 成功设置和获取用户ID:', testUserId);
        } else {
            console.error('✗ 测试失败: 设置或获取用户ID失败');
            // 恢复原始用户ID
            if (originalUserId) {
                localStorage.setItem('libreTvUserId', originalUserId);
            }
            return false;
        }
        
        // 测试设置无效的用户ID
        const invalidResult = setUserId('12345'); // 少于6位
        if (!invalidResult) {
            console.log('✓ 测试通过: 成功拒绝无效的用户ID（少于6位）');
        } else {
            console.error('✗ 测试失败: 未拒绝无效的用户ID（少于6位）');
            // 恢复原始用户ID
            if (originalUserId) {
                localStorage.setItem('libreTvUserId', originalUserId);
            }
            return false;
        }
        
        // 测试设置非数字用户ID
        const nonNumericResult = setUserId('abcdef'); // 非数字
        if (!nonNumericResult) {
            console.log('✓ 测试通过: 成功拒绝非数字用户ID');
        } else {
            console.error('✗ 测试失败: 未拒绝非数字用户ID');
            // 恢复原始用户ID
            if (originalUserId) {
                localStorage.setItem('libreTvUserId', originalUserId);
            }
            return false;
        }
        
        // 恢复原始用户ID
        if (originalUserId) {
            localStorage.setItem('libreTvUserId', originalUserId);
        }
        
        return true;
    } catch (error) {
        console.error('✗ 测试失败: 设置或获取用户ID时发生错误:', error);
        return false;
    }
}

// 测试3: 同步数据到云端
function testSyncDataToCloud() {
    console.log('\n测试3: 同步数据到云端');
    try {
        // 创建测试数据
        const testHistory = [{ title: '测试视频', progress: 120, timestamp: Date.now() }];
        localStorage.setItem('viewingHistory', JSON.stringify(testHistory));
        
        // 执行同步
        const syncResult = syncDataToCloud();
        
        // 验证同步结果
        const userId = getUserId();
        const syncedDataKey = `libreTvSyncedData_${userId}`;
        const syncedData = localStorage.getItem(syncedDataKey);
        
        if (syncResult && syncedData) {
            const parsedData = JSON.parse(syncedData);
            console.log('✓ 测试通过: 成功同步数据到云端');
            console.log('同步的数据:', parsedData);
            return true;
        } else {
            console.error('✗ 测试失败: 同步数据到云端失败');
            return false;
        }
    } catch (error) {
        console.error('✗ 测试失败: 同步数据到云端时发生错误:', error);
        return false;
    }
}

// 测试4: 从云端加载数据
function testLoadSyncedData() {
    console.log('\n测试4: 从云端加载数据');
    try {
        // 保存原始数据
        const originalHistory = localStorage.getItem('viewingHistory');
        
        // 创建测试同步数据
        const userId = getUserId();
        const syncedDataKey = `libreTvSyncedData_${userId}`;
        
        const testSyncedData = {
            viewingHistory: [{ title: '从云端加载的测试视频', progress: 300, timestamp: Date.now() }],
            selectedAPIs: ['test1', 'test2'],
            customAPIs: [],
            yellowFilterEnabled: true,
            adFilterEnabled: true,
            doubanEnabled: true,
            lastSyncTime: Date.now()
        };
        
        localStorage.setItem(syncedDataKey, JSON.stringify(testSyncedData));
        
        // 临时修改loadSyncedData函数，避免页面刷新
        const originalLoadSyncedData = window.loadSyncedData;
        window.loadSyncedData = function() {
            const userId = getUserId();
            const syncedDataKey = `libreTvSyncedData_${userId}`;
            
            const syncedData = localStorage.getItem(syncedDataKey);
            
            if (syncedData) {
                try {
                    const data = JSON.parse(syncedData);
                    if (saveDataToLocal(data)) {
                        console.log(`[测试] 用户ID: ${userId}，已从云端加载数据`);
                        return true;
                    }
                } catch (e) {
                    console.error('解析同步数据失败:', e);
                }
            }
            
            return false;
        };
        
        // 执行加载
        const loadResult = loadSyncedData();
        
        // 验证加载结果
        const loadedHistory = JSON.parse(localStorage.getItem('viewingHistory') || '[]');
        
        if (loadResult && loadedHistory && loadedHistory.length > 0 && loadedHistory[0].title === '从云端加载的测试视频') {
            console.log('✓ 测试通过: 成功从云端加载数据');
            console.log('加载的数据:', loadedHistory);
        } else {
            console.error('✗ 测试失败: 从云端加载数据失败');
            // 恢复原始数据
            if (originalHistory) {
                localStorage.setItem('viewingHistory', originalHistory);
            }
            // 恢复原始函数
            window.loadSyncedData = originalLoadSyncedData;
            return false;
        }
        
        // 恢复原始数据
        if (originalHistory) {
            localStorage.setItem('viewingHistory', originalHistory);
        }
        
        // 恢复原始函数
        window.loadSyncedData = originalLoadSyncedData;
        
        return true;
    } catch (error) {
        console.error('✗ 测试失败: 从云端加载数据时发生错误:', error);
        return false;
    }
}

// 汇总测试结果
function summarizeResults() {
    console.log('\n===== 测试结果汇总 =====');
    const tests = [
        { name: '生成用户ID', result: testGenerateUserId() },
        { name: '设置和获取用户ID', result: testSetAndGetUserId() },
        { name: '同步数据到云端', result: testSyncDataToCloud() },
        { name: '从云端加载数据', result: testLoadSyncedData() }
    ];
    
    let passedCount = 0;
    
    tests.forEach(test => {
        if (test.result) {
            passedCount++;
            console.log(`✓ ${test.name}`);
        } else {
            console.log(`✗ ${test.name}`);
        }
    });
    
    console.log(`\n总测试数: ${tests.length}, 通过: ${passedCount}, 失败: ${tests.length - passedCount}`);
    
    if (passedCount === tests.length) {
        console.log('\n🎉 所有测试通过！用户ID和数据同步功能正常工作。');
        return true;
    } else {
        console.log('\n❌ 测试未全部通过，请检查问题并修复。');
        return false;
    }
}

// 延迟执行汇总，等待其他测试完成
setTimeout(summarizeResults, 1000);