export default {
  async fetch(request, env) {
    const cors = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS, GET',
      'Access-Control-Allow-Headers': 'Content-Type',
    };
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (request.method === 'GET') return new Response(JSON.stringify({ status: 'ok' }), { headers: { ...cors, 'Content-Type': 'application/json' } });
    if (request.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: cors });

    try {
      const body = await request.json();
      const rawParse = body._rawParse || false;
      delete body._rawParse;

      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
          'anthropic-beta': 'pdfs-2024-09-25',
        },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      const rawText = (data.content || []).map(b => b.text || '').join('');

      // Raw mode — just return the content blocks for client to parse
      if (rawParse) {
        return new Response(JSON.stringify({ content: data.content || [], raw: rawText }), {
          headers: { ...cors, 'Content-Type': 'application/json' },
        });
      }

      // Standard mode — parse JSON array from response
      let employees = null;
      let cleaned = rawText.replace(/```json|```/gi, '').trim().replace(/^[\s\-]+/, '').trim();
      const start = cleaned.indexOf('[');
      const end = cleaned.lastIndexOf(']');
      if (start !== -1 && end > start) {
        try { employees = JSON.parse(cleaned.substring(start, end + 1)); } catch(e) {
          try { employees = JSON.parse(cleaned.substring(start, end + 1).replace(/\\"/g, '"')); } catch(e2) {}
        }
      }

      if (employees) {
        return new Response(JSON.stringify({ success: true, employees }), {
          headers: { ...cors, 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({ success: false, raw: rawText }), {
        headers: { ...cors, 'Content-Type': 'application/json' },
      });

    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: 500, headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }
  },
};
