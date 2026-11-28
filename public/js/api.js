// public/js/api.js
// One function for all calls to the server.

let onUnauthorized = () => {};

export function setUnauthorizedHandler(fn) {
  onUnauthorized = fn;
}

// Always returns an object like { ok: true, ... } or { ok: false, error: "code" }.
export async function api(path, method, body) {
  const opts = { method: method || "GET", headers: {}, credentials: "same-origin" };
  if (body !== undefined) {
    opts.headers["content-type"] = "application/json";
    opts.body = JSON.stringify(body);
  }
  let res;
  try {
    res = await fetch(path, opts);
  } catch (e) {
    return { ok: false, error: "network_error" };
  }
  let data;
  try {
    data = await res.json();
  } catch (e) {
    data = { ok: false, error: "server_error" };
  }
  if (res.status === 401 && data.error === "not_logged_in") onUnauthorized();
  return data;
}
