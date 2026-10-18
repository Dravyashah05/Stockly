function scriptUrl() {
  return (process.env.ADMIN_SCRIPT_URL || "").trim();
}
function scriptToken() {
  return process.env.ADMIN_SCRIPT_TOKEN || "";
}
function adminScriptConfigured() {
  return Boolean(scriptUrl() && scriptToken());
}
function httpError(message, status) {
  return Object.assign(new Error(message), { status });
}
async function scriptCall(action, payload = {}) {
  const url = scriptUrl();
  const token = scriptToken();
  if (!url || !token) {
    throw httpError("Private admin storage is not configured on the server.", 501);
  }
  let res;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ token, action, ...payload }),
      redirect: "follow"
    });
  } catch {
    throw httpError("Admin spreadsheet request failed.", 502);
  }
  let json;
  try {
    json = await res.json();
  } catch {
    throw httpError("Admin spreadsheet returned a non-JSON response.", 502);
  }
  if (!json || json.success !== true) {
    const msg = typeof json?.error === "string" && json.error ? json.error : "Admin spreadsheet request failed.";
    if (/^Unauthorized\.?$/.test(msg)) throw httpError("Unauthorized.", 401);
    if (/Row not found/.test(msg)) throw httpError(msg, 404);
    throw httpError(msg, 502);
  }
  return json.data;
}
async function scriptReadTab(tab) {
  const data = await scriptCall("readTab", { tab });
  const headers = Array.isArray(data.headers) ? data.headers.map((h) => String(h)) : [];
  const rows = Array.isArray(data.rows) ? data.rows : [];
  return rows.map((r) => {
    const o = {};
    headers.forEach((h, i) => {
      o[h] = r[i] === void 0 || r[i] === null ? "" : String(r[i]);
    });
    return o;
  }).filter((r) => Object.values(r).some((v) => v !== ""));
}
async function scriptAppendRow(tab, row) {
  await scriptCall("appendRow", { tab, row });
}
async function scriptUpdateRowById(tab, id, row) {
  await scriptCall("updateRow", { tab, id, row });
}
export {
  adminScriptConfigured,
  scriptAppendRow,
  scriptCall,
  scriptReadTab,
  scriptUpdateRowById
};
