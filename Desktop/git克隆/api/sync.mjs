import { createCORS } from 'itty-cors'
const cors = createCORS()
const KV_STORE = Symbol.for('sync-data')

export default {
  async fetch(request, env) {
    const handleRequest = async (req) => {
      try {
        const url = new URL(req.url)
        
        if (req.method === 'POST') {
          const { userId, key, value } = await req.json()
          if (!/^\d{6}$/.test(userId)) return new Response('Invalid userID', { status: 400 })
          
          await env[KV_STORE].put(`${userId}_${key}`, JSON.stringify(value), {
            metadata: { updated: Date.now() }
          })
          return new Response('OK')
        }

        if (req.method === 'GET') {
          const userId = url.searchParams.get('userId')
          const key = url.searchParams.get('key')
          if (!userId || !key) return new Response('Missing params', { status: 400 })

          const data = await env[KV_STORE].get(`${userId}_${key}`)
          return new Response(data || '{}', {
            headers: { 'Content-Type': 'application/json' }
          })
        }

        return new Response('Method not allowed', { status: 405 })
      } catch (e) {
        return new Response(e.message, { status: 500 })
      }
    }
    return cors(request, handleRequest(request))
  }
}