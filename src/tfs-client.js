import { Agent } from "undici";

function buildAuthHeader(pat) {
  const token = Buffer.from(`:${pat}`, "utf8").toString("base64");
  return `Basic ${token}`;
}

function buildBaseUrl(config, projectOverride, scope = "project") {
  if (scope === "collection") {
    return `${config.baseUrl}/${config.collection}`;
  }
  const project = projectOverride || config.project;
  return `${config.baseUrl}/${config.collection}/${project}`;
}

async function tfsRequest(config, projectOverride, path, options = {}) {
  const url = new URL(
    `${buildBaseUrl(config, projectOverride, options.scope)}/_apis/${path}`
  );
  url.searchParams.set("api-version", config.apiVersion);

  if (options.query) {
    for (const [key, value] of Object.entries(options.query)) {
      url.searchParams.set(key, value);
    }
  }

  const headers = {
    Accept: "application/json",
    Authorization: buildAuthHeader(config.pat),
  };

  if (options.body) {
    headers["Content-Type"] = "application/json";
  }

  const dispatcher =
    config.tls?.rejectUnauthorized === false
      ? new Agent({ connect: { rejectUnauthorized: false } })
      : undefined;

  const response = await fetch(url, {
    method: options.method || "GET",
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
    dispatcher,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`TFS request failed ${response.status}: ${text}`);
  }

  return response.json();
}

function buildWiql({ types }) {
  const clauses = [];

  if (types && types.length) {
    const typeList = types.map((t) => `'${t}'`).join(", ");
    clauses.push(`[System.WorkItemType] IN (${typeList})`);
  }

  const whereClause = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const orderBy = "ORDER BY [System.ChangedDate] DESC";
  const select = "SELECT [System.Id]";

  return `${select} FROM WorkItems ${whereClause} ${orderBy}`.trim();
}

export async function queryWorkItemsByType(config, params) {
  const wiql = buildWiql(params);
  const data = await tfsRequest(config, params.project, "wit/wiql", {
    method: "POST",
    body: { query: wiql },
  });

  const ids = (data.workItems || []).map((wi) => wi.id);
  if (!ids.length) {
    return [];
  }

  const limitedIds =
    params.top && Number.isFinite(params.top) ? ids.slice(0, params.top) : ids;

  return getWorkItems(config, params.project, limitedIds, {
    fields: params.fields,
    expand: params.expand,
  });
}

export async function queryWiql(config, params) {
  const data = await tfsRequest(config, params.project, "wit/wiql", {
    method: "POST",
    body: { query: params.wiql },
  });

  const ids = (data.workItems || []).map((wi) => wi.id);
  if (!ids.length) {
    return [];
  }

  const limitedIds =
    params.top && Number.isFinite(params.top) ? ids.slice(0, params.top) : ids;

  return getWorkItems(config, params.project, limitedIds, {
    fields: params.fields,
    expand: params.expand,
  });
}

export async function getWorkItems(config, project, ids, options = {}) {
  const defaultFields = [
    "System.Id",
    "System.WorkItemType",
    "System.Title",
    "System.Description",
    "Microsoft.VSTS.Common.AcceptanceCriteria",
    "System.State",
    "System.AreaPath",
    "System.IterationPath",
    "System.Tags",
    "Microsoft.VSTS.Common.Priority",
    "Microsoft.VSTS.Common.BacklogPriority",
  ];
  const fields =
    options.fields && options.fields.length ? options.fields : defaultFields;
  const expand =
    options.expand === undefined ? "relations" : String(options.expand);

  const query = {
    ids: ids.join(","),
  };

  if (expand && expand !== "none") {
    query["$expand"] = expand;
  } else {
    query.fields = fields.join(",");
  }

  const data = await tfsRequest(config, project, "wit/workitems", {
    query,
    scope: "collection",
  });

  return (data.value || []).map((item) => {
    const fields = item.fields || {};
    const relations = item.relations || [];
    const parentIds = relations
      .filter((rel) => rel.rel === "System.LinkTypes.Hierarchy-Reverse")
      .map((rel) => rel.url.split("/").pop())
      .filter(Boolean);
    const childIds = relations
      .filter((rel) => rel.rel === "System.LinkTypes.Hierarchy-Forward")
      .map((rel) => rel.url.split("/").pop())
      .filter(Boolean);

    return {
      id: item.id,
      type: fields["System.WorkItemType"],
      title: fields["System.Title"],
      description: fields["System.Description"],
      acceptanceCriteria: fields["Microsoft.VSTS.Common.AcceptanceCriteria"],
      state: fields["System.State"],
      areaPath: fields["System.AreaPath"],
      iterationPath: fields["System.IterationPath"],
      tags: fields["System.Tags"]
        ? fields["System.Tags"].split(";").map((t) => t.trim()).filter(Boolean)
        : [],
      priority:
        fields["Microsoft.VSTS.Common.Priority"] ??
        fields["Microsoft.VSTS.Common.BacklogPriority"],
      relations: {
        parents: parentIds,
        children: childIds,
      },
    };
  });
}

export async function getWorkItemById(config, project, id) {
  const items = await getWorkItems(config, project, [id]);
  return items[0] || null;
}
