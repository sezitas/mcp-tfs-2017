import fs from "node:fs";
import path from "node:path";

const DEFAULT_CONFIG_FILE = "config.json";

function readJson(filePath) {
  const raw = fs.readFileSync(filePath, "utf8");
  return JSON.parse(raw);
}

function readPat(patFile, configDir) {
  const resolved = path.isAbsolute(patFile)
    ? patFile
    : path.resolve(configDir, patFile);

  if (!fs.existsSync(resolved)) {
    throw new Error(`PAT file not found at ${resolved}`);
  }

  const token = fs.readFileSync(resolved, "utf8").trim();
  if (!token) {
    throw new Error("PAT file is empty.");
  }

  return token;
}

export function loadConfig() {
  const configPath = process.env.TFS_MCP_CONFIG
    ? path.resolve(process.env.TFS_MCP_CONFIG)
    : path.resolve(process.cwd(), DEFAULT_CONFIG_FILE);

  if (!fs.existsSync(configPath)) {
    throw new Error(
      `Config not found at ${configPath}. Copy config.example.json to config.json or set TFS_MCP_CONFIG.`
    );
  }

  const config = readJson(configPath);
  if (!config.baseUrl || !config.collection || !config.project) {
    throw new Error("Config requires baseUrl, collection, and project.");
  }

  const patFile = config.patFile || process.env.TFS_PAT_FILE;
  if (!patFile) {
    throw new Error("Config requires patFile or TFS_PAT_FILE.");
  }

  const pat = readPat(patFile, path.dirname(configPath));

  return {
    baseUrl: config.baseUrl.replace(/\/$/, ""),
    collection: config.collection,
    project: config.project,
    apiVersion: config.apiVersion || "2.0",
    pat,
    tls: {
      rejectUnauthorized:
        process.env.TFS_INSECURE_TLS === "true"
          ? false
          : config.tls?.rejectUnauthorized ?? true,
    },
  };
}
