// src/index.js
// Entry point of the Worker. Only /api/* requests reach this code
// (see "run_worker_first" in wrangler.jsonc). Static files are served automatically.

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/health") {
      try {
        const row = await env.DB.prepare("SELECT 1 AS ok").first();
        return json({ ok: true, db: row && row.ok === 1 });
      } catch (err) {
        return json({ ok: false, error: "database_error" }, 500);
      }
    }

    return json({ ok: false, error: "not_found" }, 404);
  },
};
