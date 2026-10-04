import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseEnv } from "node:util";
import { fileURLToPath } from "node:url";

export async function connectGovernance(env, options = {}) {
  const url = new URL(env.MCP_SERVER_URL ?? "https://mcp.codexsun.com/mcp");
  if (url.href !== "https://mcp.codexsun.com/mcp")
    throw new Error("Only https://mcp.codexsun.com/mcp is allowed.");
  if (!["http:", "https:"].includes(url.protocol)) throw new Error("Invalid MCP server URL.");
  if (url.username || url.password || url.search || url.hash || url.pathname !== "/mcp")
    throw new Error("MCP server URL must use /mcp without credentials, query, or fragment.");
  if (url.protocol === "http:" && !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname))
    throw new Error("Remote MCP servers require HTTPS.");
  if (!env.MCP_SERVER_SECRET || !env.APP_ID || !env.APP_USER)
    throw new Error("Configure MCP_SERVER_SECRET, APP_ID, and APP_USER in .env.");
  const headers = {
    "Content-Type": "application/json",
    Accept: "application/json, text/event-stream",
    Authorization: `Bearer ${env.MCP_SERVER_SECRET}`,
    "X-App-Id": env.APP_ID,
    "X-App-User": env.APP_USER
  };
  async function request(id, method, params) {
    const response = await fetch(url, {
      method: "POST",
      redirect: "error",
      headers,
      signal: AbortSignal.timeout(options.timeout ?? 15000),
      body: JSON.stringify({ jsonrpc: "2.0", id, method, params })
    });
    if (!response.ok) throw new Error(`MCP connection returned HTTP ${response.status}.`);
    const message = await response.json();
    if (message.error) throw new Error("MCP protocol request failed.");
    return message.result;
  }
  const initialized = await request(1, "initialize", {
    protocolVersion: "2025-03-26",
    capabilities: {},
    clientInfo: { name: env.APP_ID, version: "1.0.0" }
  });
  headers["MCP-Protocol-Version"] = initialized.protocolVersion;
  const notification = await fetch(url, {
    method: "POST",
    redirect: "error",
    headers,
    signal: AbortSignal.timeout(options.timeout ?? 15000),
    body: JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" })
  });
  if (!notification.ok) throw new Error(`MCP initialization returned HTTP ${notification.status}.`);
  const result = await request(2, "tools/call", {
    name: "get_working_instructions",
    arguments: {}
  });
  if (result.isError) throw new Error("MCP instructions could not be retrieved.");
  const content = result.content?.find((item) => item.type === "text");
  if (!content) throw new Error("MCP instructions response is missing.");
  const instructions = JSON.parse(content.text);
  if (
    instructions.appId !== env.APP_ID ||
    instructions.appUser !== env.APP_USER ||
    typeof instructions.instructions !== "string" ||
    !instructions.instructions.trim()
  )
    throw new Error("MCP instructions do not match the requesting app.");
  return instructions;
}

export async function runConnection(env, { timeout } = {}) {
  try {
    const result = await connectGovernance(env, { timeout });
    console.info(JSON.stringify(result, null, 2));
    return 0;
  } catch (error) {
    console.info(
      `Live governance unavailable: ${error.message} Stop repository work and restore the cloud connection.`
    );
    return 1;
  }
}

export async function runCli() {
  let local = {};
  try {
    local = parseEnv(readFileSync(resolve(".env"), "utf8"));
  } catch (error) {
    if (error.code !== "ENOENT")
      console.info("Local environment file unavailable. Using process environment.");
  }
  const env = { ...local, ...process.env };
  if (env.MCP_SERVER_URL && env.MCP_SERVER_URL !== "https://mcp.codexsun.com/mcp") {
    console.error("MCP_SERVER_URL must be https://mcp.codexsun.com/mcp.");
    return 1;
  }
  return runConnection(env, { strict: true });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = await runCli();
}
