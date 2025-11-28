# LibreTV Cloudflare部署指南

本指南将帮助您在Cloudflare Pages上部署LibreTV并配置Cloudflare KV存储，实现真正的跨设备数据同步功能。

## 前提条件

- 已拥有Cloudflare账号
- 已在Cloudflare Pages上部署了LibreTV项目
- 熟悉基本的Git和Cloudflare操作

## 步骤1：创建Cloudflare KV命名空间

1. 登录到Cloudflare控制台
2. 在左侧菜单中，选择您的账户
3. 点击"Workers & Pages"选项
4. 选择"KV"标签页
5. 点击"创建命名空间"按钮
6. 填写以下信息：
   - **命名空间名称**：输入一个有意义的名称，如`libretv_data`
   - **智能合约绑定**（可选）：根据需要选择
7. 点击"创建"按钮

## 步骤2：将KV命名空间绑定到您的Pages项目

1. 在Cloudflare控制台中，导航到您的LibreTV Pages项目
2. 点击"设置"标签页
3. 选择"函数"选项
4. 在"KV命名空间绑定"部分，点击"添加绑定"按钮
5. 填写以下信息：
   - **变量名称**：必须设置为 `LIBRETV_KV`
   - **KV命名空间**：选择您在步骤1中创建的KV命名空间
6. 点击"保存"按钮

## 步骤3：部署修改后的代码

1. 确保您已经将以下修改推送到您的Git仓库：
   - 添加了`functions/user-sync.js`文件
   - 更新了`js/user-sync.js`文件中的同步逻辑

2. Cloudflare Pages将自动检测到您的代码变更并开始部署
3. 等待部署完成

## 步骤4：验证功能

1. 访问您的LibreTV网站
2. 检查用户同步区域是否正常显示
3. 观看一些视频以生成观看历史
4. 等待几分钟，让自动同步功能执行
5. 在另一台设备或浏览器中访问同一个网站
6. 输入相同的用户ID并应用
7. 检查是否能正确加载之前的观看历史和设置

## 常见问题解答

### Q: 为什么我的数据没有同步？
A: 请检查以下几点：
- 确保已正确创建并绑定KV命名空间
- 验证用户ID是否为6位数字格式
- 检查浏览器控制台是否有错误信息
- 等待至少3分钟，让自动同步功能执行

### Q: 我可以在本地开发环境测试这个功能吗？
A: Cloudflare KV功能需要在Cloudflare环境中运行。在本地开发环境中，您可以使用`wrangler`命令行工具进行测试。

### Q: 数据存储有什么限制？
A: Cloudflare KV有以下限制：
- 单个值最大为25MB
- 每日读取操作有限额（免费计划通常为100,000次）
- 数据同步可能有短暂延迟（通常在几秒内）

### Q: 我的数据安全吗？
A: Cloudflare KV提供了高安全性的数据存储，但请注意：
- 数据以JSON格式存储，没有额外加密
- 请不要在同步数据中包含敏感信息
- 用户ID是数据访问的唯一标识，请妥善保管

## 高级配置

### 调整同步间隔

如果您想调整自动同步的时间间隔，可以修改`js/user-sync.js`文件中的以下代码：

```javascript
// 当前设置为每3分钟同步一次
enableAutoSync() {
    // ...
    setInterval(function() {
        // 只在页面可见时执行同步，节省资源
        if (document.visibilityState === 'visible') {
            syncDataToCloud();
        }
    }, 3 * 60 * 1000); // 3分钟
    // ...
}
```

## 故障排除

如果您在配置过程中遇到问题：

1. 检查Cloudflare Pages的"函数"日志，查看是否有错误信息
2. 确认`LIBRETV_KV`变量名完全正确（区分大小写）
3. 确保您的Cloudflare Pages计划支持KV功能
4. 查看浏览器控制台的网络请求，确认`/user-sync`请求是否成功

如有其他问题，请参考[Cloudflare Pages文档](https://developers.cloudflare.com/pages/)或[Cloudflare KV文档](https://developers.cloudflare.com/workers/runtime-apis/kv/)。