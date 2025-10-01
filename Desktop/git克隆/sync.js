// Cloudflare Pages 数据同步边缘函数
export async function onRequest(context) {
  const { request, env, next } = context;
  const url = new URL(request.url);
  const action = url.searchParams.get('action');
  const key = url.searchParams.get('key');
  const userId = url.searchParams.get('userId');
  
  // 验证必要参数
  if (!key || !userId) {
    return new Response(JSON.stringify({ error: '缺少必要参数' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  // 构建完整的存储键名，包含用户ID前缀
  const fullKey = `user_${userId}_${key}`;
  
  // 根据操作类型处理请求
  switch (action) {
    case 'get':
      // 获取数据
      try {
        const value = await env.SYNC_KV.get(fullKey, 'json');
        return new Response(JSON.stringify({ value }), {
          headers: { 'Content-Type': 'application/json' }
        });
      } catch (error) {
        console.error('获取数据失败:', error);
        return new Response(JSON.stringify({ error: '获取数据失败' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
    case 'set':
      // 保存数据
      try {
        const requestBody = await request.json();
        const value = requestBody.value;
        
        // 保存数据到KV存储，设置过期时间为1年
        await env.SYNC_KV.put(fullKey, JSON.stringify(value), {
          expirationTtl: 31536000 // 1年的秒数
        });
        
        return new Response(JSON.stringify({ success: true }), {
          headers: { 'Content-Type': 'application/json' }
        });
      } catch (error) {
        console.error('保存数据失败:', error);
        return new Response(JSON.stringify({ error: '保存数据失败' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
    case 'remove':
      // 删除数据
      try {
        await env.SYNC_KV.delete(fullKey);
        return new Response(JSON.stringify({ success: true }), {
          headers: { 'Content-Type': 'application/json' }
        });
      } catch (error) {
        console.error('删除数据失败:', error);
        return new Response(JSON.stringify({ error: '删除数据失败' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
    default:
      return new Response(JSON.stringify({ error: '未知的操作类型' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
  }
}