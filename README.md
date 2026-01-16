# MCP TFS Server 2017

Minimal MCP server for querying TFS work items by type or WIQL, including key fields and parent/child relations.

## Setup

1. Copy config:

```bash
cp config.example.json config.json
```

2. Create a PAT file and point config to it:

```bash
echo "YOUR_PAT" > .tfs.pat
```

3. Install deps and run:

```bash
npm install
npm start
```

The server writes a startup line to stderr: `[mcp-tfs] server starting...`.

## Manual test (without MCP host)

```bash
npm run test:types
```

## Configuration

`config.json` fields:
- `baseUrl`: TFS base URL, e.g. `https://tfs.example.com:8080/tfs`
- `collection`: collection name
- `project`: default project
- `patFile`: file path to a PAT token (relative to `config.json` or absolute)
- `apiVersion`: default `2.0`
- `tls.rejectUnauthorized`: set to `false` for self-signed certs (not recommended)

You can override the config location with `TFS_MCP_CONFIG=/path/to/config.json`.
You can override the PAT file with `TFS_PAT_FILE=/path/to/pat`.
You can set `TFS_INSECURE_TLS=true` to skip TLS verification (use only for testing).

## Returned fields

Each item includes:
- `title`, `description`, `acceptanceCriteria`
- `areaPath`, `iterationPath`, `tags`
- `priority`
- `relations.parents`, `relations.children` (work item IDs)

## Tools

- `tfs_get_work_items_by_type`: query by work item types (supports optional `fields`, `expand`).
- `tfs_query_wiql`: run a WIQL query and return matching work items (supports optional `top`, `fields`, `expand`).
- `tfs_get_work_items`: fetch multiple work items by ID list (supports optional `fields`, `expand`).
- `tfs_get_work_item_by_id`: fetch a single work item by ID.

Notes:
- `expand` defaults to `relations` unless you pass `expand: "none"`.
- `fields` defaults to a standard set if not provided.
- On TFS 2017, `fields` cannot be combined with `expand`. Use `expand: "none"` when you need `fields`.

## Codex CLI integration 

Add the following the %USERPROFILE%\\.codex\config.toml

```toml
[mcp_servers.tfs]
command = "node"
args = ["<path_to>/mcp-tfs-2017/src/index.js"]
[mcp_servers.tfs.env]
TFS_MCP_CONFIG = "<path_to>/mcp-tfs-2017/config.json"
```
