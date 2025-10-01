# LibreTV - Cloudflare Pages 部署指南

本文档将指导你如何在Cloudflare Pages上部署LibreTV项目。

## 前提条件

1. 一个Cloudflare账号
2. Git安装在本地计算机上
3. 项目代码已克隆到本地

## 步骤1：创建Cloudflare KV命名空间

KV存储用于保存用户的观看历史和播放进度数据。

1. 登录到[Cloudflare Dashboard](https://dash.cloudflare.com/)
2. 在左侧菜单中，选择"Workers & Pages" > "KV"
3. 点击"Create a namespace"按钮
4. 填写以下信息：
   - **Namespace name**: 输入一个名称，例如"LibreTV_Sync"
   - **选择账户**: 选择你的Cloudflare账户
5. 点击"Create"按钮
6. 创建成功后，复制生成的**Namespace ID**（稍后需要用到）

## 步骤2：配置wrangler.toml文件

1. 打开项目根目录下的`wrangler.toml`文件
2. 找到以下行：
   ```toml
   id = "<YOUR_KV_NAMESPACE_ID>" # 替换为你的KV命名空间ID
   preview_id = "<YOUR_KV_NAMESPACE_ID>" # 开发环境也使用相同的KV命名空间
   ```
3. 将`<YOUR_KV_NAMESPACE_ID>`替换为你在步骤1中复制的Namespace ID
4. 保存文件

## 步骤3：创建Cloudflare Pages项目

1. 在Cloudflare Dashboard中，选择"Workers & Pages" > "Pages"
2. 点击"Create a project"按钮
3. 选择"Connect to Git"
4. 选择你的Git提供商（GitHub、GitLab或Bitbucket）并授权Cloudflare访问
5. 找到并选择你的LibreTV项目仓库
6. 点击"Begin setup"

## 步骤4：配置部署设置

1. **Project name**: 保持默认或输入一个自定义名称
2. **Production branch**: 选择你的生产分支（通常是main或master）
3. **Build settings**:
   - **Framework preset**: 选择"None"
   - **Build command**: 留空（不需要构建命令）
   - **Build output directory**: 留空（默认为根目录）
4. 在"Environment variables"部分，不需要添加任何变量
5. 点击"Save and Deploy"

## 步骤5：配置Functions的KV绑定

项目部署后，还需要手动配置Functions与KV命名空间的绑定。

1. 在Pages项目页面中，点击"Settings"选项卡
2. 在左侧菜单中，选择"Functions"
3. 在"KV namespace bindings"部分，点击"Add binding"
4. 填写以下信息：
   - **Variable name**: 输入`SYNC_KV`（必须与functions/sync.js中的名称一致）
   - **KV namespace**: 从下拉列表中选择你在步骤1中创建的KV命名空间
5. 点击"Save"按钮

## 步骤6：验证部署

1. 等待部署完成（通常需要几分钟）
2. 点击"Visit site"按钮访问你的LibreTV网站
3. 测试用户数据同步功能：
   - 打开设置面板
   - 在用户数据同步区域输入一个六位数ID并保存
   - 浏览和观看一些视频
   - 在另一台设备上访问同一网站，并使用相同的用户ID
   - 确认观看历史和播放进度是否已同步

## 注意事项

1. Cloudflare Pages Functions有一定的免费额度限制，请参考[Cloudflare Pages定价](https://developers.cloudflare.com/pages/platform/pricing/)了解详情
2. KV存储也有免费额度限制，超出后可能产生费用
3. 如果需要自定义域名，请在Cloudflare Pages项目的"Custom domains"设置中配置
4. 在本地开发时，你可以使用[Cloudflare Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/)来测试Functions和KV存储

## 故障排除

如果遇到同步问题，请检查以下几点：

1. KV命名空间绑定是否正确（变量名必须是`SYNC_KV`）
2. wrangler.toml文件中的Namespace ID是否正确
3. 浏览器控制台是否有错误信息
4. Cloudflare Dashboard中的"Functions" > "Logs"是否有相关错误

如果问题仍然存在，请参考[Cloudflare Pages文档](https://developers.cloudflare.com/pages/)或联系Cloudflare支持。