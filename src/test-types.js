import { loadConfig } from "./config.js";
import { queryWorkItemsByType, queryWiql, getWorkItems } from "./tfs-client.js";

const config = loadConfig();

const items = await queryWorkItemsByType(config, {
  types: ["Epic"],
  top: 5,
});

const wiqlItems = await queryWiql(config, {
  wiql:
    "SELECT [System.Id] FROM WorkItems WHERE [System.WorkItemType] = 'Epic' ORDER BY [System.ChangedDate] DESC",
  top: 5,
});

const itemIds = items.map((item) => item.id);
const batchItems = itemIds.length
  ? await getWorkItems(config, config.project, itemIds, { expand: "none" })
  : [];

console.log(
  JSON.stringify(
    {
      byType: { count: items.length, items },
      wiql: { count: wiqlItems.length, items: wiqlItems },
      batch: { count: batchItems.length, items: batchItems },
    },
    null,
    2
  )
);
