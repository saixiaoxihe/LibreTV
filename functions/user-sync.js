/**
 * 用户数据同步到Cloudflare KV存储的Function
 * 此函数处理用户数据的保存和加载操作
 */
export async function onRequest(context) {
  const { request, env, params } = context;
  const url = new URL(request.url);
  
  // 定义KV命名空间 - 需要在Cloudflare Pages设置中绑定
  const KV_NAMESPACE = env.LIBRETV_KV; // 用户需要在Cloudflare中创建并绑定这个KV命名空间
  
  // 获取用户ID
  const userId = url.searchParams.get('userId');
  
  // 验证用户ID
  if (!userId || !/^\d{6}$/.test(userId)) {
    return new Response(JSON.stringify({ success: false, message: '无效的用户ID' }), {
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      },
      status: 400
    });
  }
  
  // 构建KV键名
  const kvKey = `libreTvSyncedData_${userId}`;
  
  // 处理OPTIONS请求（CORS预检）
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      },
      status: 204
    });
  }
  
  // 处理GET请求 - 加载数据
  if (request.method === 'GET') {
    try {
      const data = await KV_NAMESPACE.get(kvKey, { type: 'json' });
      
      if (data) {
        return new Response(JSON.stringify({ success: true, data }), {
          headers: { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type'
          }
        });
      } else {
        return new Response(JSON.stringify({ success: false, message: '未找到同步数据' }), {
          headers: { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type'
          },
          status: 404
        });
      }
    } catch (error) {
      console.error('从KV加载数据失败:', error);
      return new Response(JSON.stringify({ success: false, message: '加载数据失败' }), {
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type'
        },
        status: 500
      });
    }
  }
  
  // 处理POST请求 - 保存数据
  else if (request.method === 'POST') {
    try {
      // 检查Content-Type
      const contentType = request.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        return new Response(JSON.stringify({ success: false, message: '需要JSON格式数据' }), {
          headers: { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type'
          },
          status: 400
        });
      }
      
      const data = await request.json();
      
      // 验证数据格式
      if (!data || typeof data !== 'object') {
        return new Response(JSON.stringify({ success: false, message: '无效的数据格式' }), {
          headers: { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type'
          },
          status: 400
        });
      }
      
      // 添加时间戳
      data.lastSyncTime = Date.now();
      
      // 使用put方法保存到KV，这会自动覆盖该用户ID下的已有数据，实现单条记录覆盖式存储
      // 这样设计可以节省KV存储空间，每个用户只保留最新的同步数据
      console.log(`[KV存储] 用户ID: ${userId}，正在存储同步数据（覆盖模式）`);
      await KV_NAMESPACE.put(kvKey, JSON.stringify(data));
      
      return new Response(JSON.stringify({ success: true, message: '数据同步成功' }), {
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type'
        }
      });
    } catch (error) {
      console.error('保存数据到KV失败:', error);
      return new Response(JSON.stringify({ success: false, message: '保存数据失败' }), {
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type'
        },
        status: 500
      });
    }
  }
  
  // 处理不支持的请求方法
  return new Response(JSON.stringify({ success: false, message: '不支持的请求方法' }), {
    headers: { 
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    },
    status: 405
  });
}