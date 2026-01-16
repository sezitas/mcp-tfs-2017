import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { loadConfig } from "./config.js";
import {
  queryWorkItemsByType,
  queryWiql,
  getWorkItemById,
  getWorkItems,
} from "./tfs-client.js";

const server = new Server(
  {
    name: "mcp-tfs",
    version: "0.1.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

console.error("[mcp-tfs] server starting...");

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "tfs_get_work_items_by_type",
      description:
        "Query TFS work items by work item types. Returns title, description, acceptance criteria, area/iteration, tags, priority, and parent/child relations.",
      inputSchema: {
        type: "object",
        properties: {
          types: {
            type: "array",
            items: { type: "string" },
            description: "Work item types (e.g. Epic, Feature, Product Backlog Item)",
          },
          top: { type: "number" },
          project: { type: "string" },
          fields: {
            type: "array",
            items: { type: "string" },
            description: "Optional list of fields to include in the response.",
          },
          expand: {
            type: "string",
            description:
              "Optional expand parameter, e.g. 'relations'. Use 'none' to skip expand.",
          },
        },
        required: ["types"],
      },
    },
    {
      name: "tfs_query_wiql",
      description:
        "Run a WIQL query and return matching work items with optional fields and relations.",
      inputSchema: {
        type: "object",
        properties: {
          wiql: {
            type: "string",
            description: "WIQL query string (e.g. SELECT [System.Id] FROM WorkItems WHERE ...)",
          },
          top: { type: "number" },
          project: { type: "string" },
          fields: {
            type: "array",
            items: { type: "string" },
            description: "Optional list of fields to include in the response.",
          },
          expand: {
            type: "string",
            description:
              "Optional expand parameter, e.g. 'relations'. Use 'none' to skip expand.",
          },
        },
        required: ["wiql"],
      },
    },
    {
      name: "tfs_get_work_items",
      description: "Fetch multiple TFS work items by ID list.",
      inputSchema: {
        type: "object",
        properties: {
          ids: {
            type: "array",
            items: { type: "number" },
            description: "Work item IDs to fetch.",
          },
          project: { type: "string" },
          fields: {
            type: "array",
            items: { type: "string" },
            description: "Optional list of fields to include in the response.",
          },
          expand: {
            type: "string",
            description:
              "Optional expand parameter, e.g. 'relations'. Use 'none' to skip expand.",
          },
        },
        required: ["ids"],
      },
    },
    {
      name: "tfs_get_work_item_by_id",
      description: "Fetch a single TFS work item by ID.",
      inputSchema: {
        type: "object",
        properties: {
          id: { type: "number" },
          project: { type: "string" },
        },
        required: ["id"],
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const config = loadConfig();
  const { name, arguments: args } = request.params;

  if (name === "tfs_get_work_items_by_type") {
    const params = {
      types: args?.types || [],
      top: args?.top || 50,
      project: args?.project,
      fields: args?.fields,
      expand: args?.expand,
    };

    const items = await queryWorkItemsByType(config, params);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({ count: items.length, items }, null, 2),
        },
      ],
    };
  }

  if (name === "tfs_query_wiql") {
    const params = {
      wiql: args?.wiql,
      top: args?.top,
      project: args?.project,
      fields: args?.fields,
      expand: args?.expand,
    };

    const items = await queryWiql(config, params);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({ count: items.length, items }, null, 2),
        },
      ],
    };
  }

  if (name === "tfs_get_work_items") {
    const items = await getWorkItems(config, args?.project, args?.ids || [], {
      fields: args?.fields,
      expand: args?.expand,
    });

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({ count: items.length, items }, null, 2),
        },
      ],
    };
  }

  if (name === "tfs_get_work_item_by_id") {
    const item = await getWorkItemById(config, args?.project, args?.id);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(item, null, 2),
        },
      ],
    };
  }

  throw new Error(`Unknown tool: ${name}`);
});

const transport = new StdioServerTransport();
await server.connect(transport);
