import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseEnv } from "node:util";
import { fileURLToPath } from "node:url";

export async function connectGovernance(env, options = {}) {
  const url = new URL(env.MCP_SERVER_URL ?? "https://mcp.codexsun.com/mcp");
  if (url.href !== "https://mcp.codexsun.com/mcp")
    throw new Error("Only https://mcp.codexsun.com/mcp is allowed.");
  if (!env.MCP_SERVER_SECRET || !env.APP_ID || !env.APP_USER)
    throw new Error("Configure MCP_SERVER_SECRET, APP_ID, and APP_USER in .env.");
  const headers = {
    "Content-Type": "application/json",
    Accept: "application/json, text/event-stream",
    Authorization: `Bearer ${env.MCP_SERVER_SECRET}`,
    "X-App-Id": env.APP_ID,
    "X-App-User": env.APP_USER
  };
  async function post(body) {
    for (let attempt = 0; attempt < 3; attempt++) {
      let response;
      try {
        response = await fetch(url, {
          method: "POST",
          redirect: "error",
          headers,
          signal: AbortSignal.timeout(options.timeout ?? 15000),
          body: JSON.stringify(body)
        });
      } catch (error) {
        if (attempt === 2) throw error;
        await new Promise((resolve) => setTimeout(resolve, 250 * (attempt + 1)));
        continue;
      }
      if (response.ok) return response;
      if (attempt === 2 || (response.status !== 429 && response.status < 500))
        throw new Error(`MCP connection returned HTTP ${response.status}.`);
      await new Promise((resolve) => setTimeout(resolve, 250 * (attempt + 1)));
    }
  }
  async function request(id, method, params) {
    const response = await post({ jsonrpc: "2.0", id, method, params });
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
  await post({ jsonrpc: "2.0", method: "notifications/initialized" });
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
  if (options.strict) {
    if (instructions.repository?.repository === undefined)
      throw new Error("MCP repository metadata is missing.");
    const resources = await request(3, "resources/list", {});
    const uris = new Set(resources.resources?.map((resource) => resource.uri));
    for (const uri of ["governance://code-standard", "governance://app-setup"])
      if (!uris.has(uri)) throw new Error(`MCP resource is missing: ${uri}.`);
    const tools = await request(4, "tools/list", {});
    const names = new Set(tools.tools?.map((tool) => tool.name));
    for (const name of ["get_working_instructions", "inspect_repository", "find_guidance"])
      if (!names.has(name)) throw new Error(`MCP tool is missing: ${name}.`);
  }
  return instructions;
}

export async function runConnection(env, { timeout, strict = false } = {}) {
  try {
    const result = await connectGovernance(env, { timeout, strict });
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
