import { access, readFile, writeFile, unlink, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execSync } from "node:child_process";

const PRE_DEPLOY_HOOK = "scripts/pre-deploy.ts";
const NEON_API = "https://console.neon.tech/api/v2";
const CF_API = "https://api.cloudflare.com/client/v4";
const BRANCH_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const HYPERDRIVE_BINDING = "HYPERDRIVE";

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) {
    console.error(`${name} is required`);
    process.exit(1);
  }
  return v;
}

function runOrExit(command: string, options?: { env?: Record<string, string | undefined> }): void {
  console.log(`Running: ${command}`);
  try {
    execSync(command, { stdio: "inherit", env: { ...process.env, ...options?.env } });
  } catch {
    process.exit(1);
  }
}

async function runPreDeployHook(args: {
  pooledUri: string;
  unpooledUri: string;
  branchId: string;
  branchName: string;
  deployEnv: "production" | "preview";
}): Promise<void> {
  try {
    await access(PRE_DEPLOY_HOOK);
  } catch {
    console.log(`No ${PRE_DEPLOY_HOOK} found — skipping.`);
    return;
  }

  console.log(`=== Running pre-deploy hook: ${PRE_DEPLOY_HOOK} ===`);
  runOrExit(`npx tsx ${PRE_DEPLOY_HOOK}`, {
    env: {
      DATABASE_URL: args.pooledUri,
      DATABASE_URL_UNPOOLED: args.unpooledUri,
      NEON_BRANCH_ID: args.branchId,
      NEON_BRANCH_NAME: args.branchName,
      DEPLOY_ENV: args.deployEnv,
    },
  });
  console.log(`=== Pre-deploy hook complete ===`);
}

function neonHeaders(apiKey: string): HeadersInit {
  return {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
}

async function fetchDefaultBranch(): Promise<{ id: string; name: string }> {
  const projectId = requireEnv("NEON_PROJECT_ID");
  const apiKey = requireEnv("NEON_API_KEY");

  const res = await fetch(`${NEON_API}/projects/${projectId}/branches`, {
    headers: neonHeaders(apiKey),
  });

  if (!res.ok) {
    console.error(`Branches list failed: ${res.status} ${await res.text()}`);
    process.exit(1);
  }

  const result = (await res.json()) as {
    branches: Array<{ id: string; name: string; default?: boolean }>;
  };
  const def = result.branches.find((b) => b.default);

  if (!def) {
    console.error("No default branch found on Neon project");
    process.exit(1);
  }

  return { id: def.id, name: def.name };
}

async function fetchDatabaseAndRole(
  branchId: string,
): Promise<{ database: string; role: string }> {
  const projectId = requireEnv("NEON_PROJECT_ID");
  const apiKey = requireEnv("NEON_API_KEY");

  const res = await fetch(
    `${NEON_API}/projects/${projectId}/branches/${branchId}/databases`,
    { headers: neonHeaders(apiKey) },
  );

  if (!res.ok) {
    console.error(`Databases list failed: ${res.status} ${await res.text()}`);
    process.exit(1);
  }

  const result = (await res.json()) as {
    databases: Array<{ name: string; owner_name: string }>;
  };
  const db = result.databases[0];

  if (!db) {
    console.error(`No databases found on branch ${branchId}`);
    process.exit(1);
  }

  return { database: db.name, role: db.owner_name };
}

async function fetchConnectionUri(
  branchId: string,
  database: string,
  role: string,
  pooled: boolean,
): Promise<string> {
  const projectId = requireEnv("NEON_PROJECT_ID");
  const apiKey = requireEnv("NEON_API_KEY");

  const params = new URLSearchParams({
    database_name: database,
    role_name: role,
    pooled: String(pooled),
    branch_id: branchId,
  });

  const res = await fetch(
    `${NEON_API}/projects/${projectId}/connection_uri?${params}`,
    { headers: neonHeaders(apiKey) },
  );

  if (!res.ok) {
    console.error(`Connection URI fetch failed: ${res.status} ${await res.text()}`);
    process.exit(1);
  }

  const result = (await res.json()) as { uri: string };
  return result.uri;
}

async function findNeonBranch(name: string): Promise<string | null> {
  const projectId = requireEnv("NEON_PROJECT_ID");
  const apiKey = requireEnv("NEON_API_KEY");

  const res = await fetch(
    `${NEON_API}/projects/${projectId}/branches?search=${encodeURIComponent(name)}`,
    { headers: neonHeaders(apiKey) },
  );

  if (!res.ok) {
    console.error(`Branch lookup failed: ${res.status} ${await res.text()}`);
    process.exit(1);
  }

  const result = (await res.json()) as {
    branches: Array<{ id: string; name: string }>;
  };
  const match = result.branches.find((b) => b.name === name);
  return match?.id ?? null;
}

async function ensureNeonBranch(name: string): Promise<string> {
  const projectId = requireEnv("NEON_PROJECT_ID");
  const apiKey = requireEnv("NEON_API_KEY");

  const existing = await findNeonBranch(name);

  if (existing) {
    console.log(`Reusing existing Neon branch: ${name} (refreshing TTL)`);

    const res = await fetch(
      `${NEON_API}/projects/${projectId}/branches/${existing}`,
      {
        method: "PATCH",
        headers: neonHeaders(apiKey),
        body: JSON.stringify({
          branch: {
            expires_at: new Date(Date.now() + BRANCH_TTL_MS).toISOString(),
          },
        }),
      },
    );

    if (!res.ok) {
      console.error(`TTL refresh failed: ${res.status} ${await res.text()}`);
      process.exit(1);
    }

    return existing;
  }

  console.log(`Creating Neon branch: ${name}`);

  const res = await fetch(`${NEON_API}/projects/${projectId}/branches`, {
    method: "POST",
    headers: neonHeaders(apiKey),
    body: JSON.stringify({
      branch: {
        name,
        expires_at: new Date(Date.now() + BRANCH_TTL_MS).toISOString(),
      },
      endpoints: [{ type: "read_write" }],
    }),
  });

  if (!res.ok) {
    console.warn(`Branch creation failed (possible race): ${res.status} ${await res.text()}`);
    console.log("Re-trying lookup in case another deploy created the branch concurrently...");
    const retry = await findNeonBranch(name);
    if (retry) {
      console.log(`Found branch "${name}" after creation race — reusing.`);
      const ttlRes = await fetch(
        `${NEON_API}/projects/${projectId}/branches/${retry}`,
        {
          method: "PATCH",
          headers: neonHeaders(apiKey),
          body: JSON.stringify({
            branch: {
              expires_at: new Date(Date.now() + BRANCH_TTL_MS).toISOString(),
            },
          }),
        },
      );
      if (!ttlRes.ok) {
        console.error(`TTL refresh on retried branch failed: ${ttlRes.status} ${await ttlRes.text()}`);
        process.exit(1);
      }
      return retry;
    }
    console.error(`Branch creation failed and no existing branch was found: ${res.status} ${await res.text()}`);
    process.exit(1);
  }

  const created = (await res.json()) as { branch: { id: string } };
  return created.branch.id;
}

function cfHeaders(token: string): HeadersInit {
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
}

type HyperdriveOrigin = {
  scheme: string;
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
};

function parsePostgresUri(uri: string): HyperdriveOrigin {
  const u = new URL(uri);
  return {
    scheme: u.protocol.replace(/:$/, ""),
    host: u.hostname,
    port: u.port ? Number(u.port) : 5432,
    database: decodeURIComponent(u.pathname.replace(/^\//, "")),
    user: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
  };
}

async function listHyperdriveConfigs(): Promise<
  Array<{ id: string; name: string }>
> {
  const accountId = requireEnv("CLOUDFLARE_ACCOUNT_ID");
  const token = requireEnv("CLOUDFLARE_API_TOKEN");

  const res = await fetch(`${CF_API}/accounts/${accountId}/hyperdrive/configs`, {
    headers: cfHeaders(token),
  });

  if (!res.ok) {
    console.error(`Hyperdrive list failed: ${res.status} ${await res.text()}`);
    process.exit(1);
  }

  const result = (await res.json()) as {
    result: Array<{ id: string; name: string }>;
  };
  return result.result;
}

async function deleteHyperdrive(id: string): Promise<void> {
  const accountId = requireEnv("CLOUDFLARE_ACCOUNT_ID");
  const token = requireEnv("CLOUDFLARE_API_TOKEN");

  const res = await fetch(
    `${CF_API}/accounts/${accountId}/hyperdrive/configs/${id}`,
    { method: "DELETE", headers: cfHeaders(token) },
  );

  if (!res.ok) {
    console.error(`Hyperdrive delete failed: ${res.status} ${await res.text()}`);
    process.exit(1);
  }
}

async function listNeonBranches(): Promise<Array<{ id: string; name: string }>> {
  const projectId = requireEnv("NEON_PROJECT_ID");
  const apiKey = requireEnv("NEON_API_KEY");

  const res = await fetch(`${NEON_API}/projects/${projectId}/branches`, {
    headers: neonHeaders(apiKey),
  });

  if (!res.ok) {
    console.error(`Branches list failed: ${res.status} ${await res.text()}`);
    process.exit(1);
  }

  const result = (await res.json()) as {
    branches: Array<{ id: string; name: string }>;
  };
  return result.branches;
}

async function cleanupOrphanHyperdrives(workerName: string): Promise<void> {
  const previewPrefix = `${workerName}--preview--`;

  const [hyperdrives, neonBranches] = await Promise.all([
    listHyperdriveConfigs(),
    listNeonBranches(),
  ]);

  const previewHyperdrives = hyperdrives.filter((h) =>
    h.name.startsWith(previewPrefix),
  );

  if (previewHyperdrives.length === 0) return;

  const liveBranches = new Set(neonBranches.map((b) => b.name));

  for (const h of previewHyperdrives) {
    const slug = h.name.slice(previewPrefix.length);
    const expectedBranch = `preview-${slug}`;

    if (!liveBranches.has(expectedBranch)) {
      console.log(`Cleaning up orphan Hyperdrive: ${h.name}`);
      await deleteHyperdrive(h.id);
    }
  }
}

async function ensureHyperdrive(name: string, uri: string): Promise<string> {
  const accountId = requireEnv("CLOUDFLARE_ACCOUNT_ID");
  const token = requireEnv("CLOUDFLARE_API_TOKEN");
  const origin = parsePostgresUri(uri);

  const configs = await listHyperdriveConfigs();
  const existing = configs.find((c) => c.name === name);

  if (existing) {
    console.log(`Updating Hyperdrive config: ${name}`);

    const putRes = await fetch(
      `${CF_API}/accounts/${accountId}/hyperdrive/configs/${existing.id}`,
      {
        method: "PUT",
        headers: cfHeaders(token),
        body: JSON.stringify({ name, origin }),
      },
    );

    if (!putRes.ok) {
      console.error(`Hyperdrive update failed: ${putRes.status} ${await putRes.text()}`);
      process.exit(1);
    }

    return existing.id;
  }

  console.log(`Creating Hyperdrive config: ${name}`);

  const postRes = await fetch(
    `${CF_API}/accounts/${accountId}/hyperdrive/configs`,
    {
      method: "POST",
      headers: cfHeaders(token),
      body: JSON.stringify({ name, origin }),
    },
  );

  if (!postRes.ok) {
    console.warn(`Hyperdrive create failed (possible race): ${postRes.status} ${await postRes.text()}`);
    console.log("Re-listing Hyperdrive configs in case another deploy created it concurrently...");
    const retryConfigs = await listHyperdriveConfigs();
    const retryExisting = retryConfigs.find((c) => c.name === name);
    if (retryExisting) {
      console.log(`Found Hyperdrive config "${name}" after creation race — reusing.`);
      const putRes = await fetch(
        `${CF_API}/accounts/${accountId}/hyperdrive/configs/${retryExisting.id}`,
        {
          method: "PUT",
          headers: cfHeaders(token),
          body: JSON.stringify({ name, origin }),
        },
      );
      if (!putRes.ok) {
        console.error(`Hyperdrive update on retried config failed: ${putRes.status} ${await putRes.text()}`);
        process.exit(1);
      }
      return retryExisting.id;
    }
    console.error(`Hyperdrive create failed and no existing config was found: ${postRes.status} ${await postRes.text()}`);
    process.exit(1);
  }

  const created = (await postRes.json()) as { result: { id: string } };
  return created.result.id;
}

async function readWranglerConfig(): Promise<Record<string, unknown>> {
  const text = await readFile("wrangler.jsonc", "utf8");
  const stripped = text
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "")
    .replace(/,(\s*[}\]])/g, "$1");
  return JSON.parse(stripped);
}

async function writeTempWranglerConfig(hyperdriveId: string): Promise<string> {
  const config = await readWranglerConfig();
  (config as Record<string, unknown>)["hyperdrive"] = [
    { binding: HYPERDRIVE_BINDING, id: hyperdriveId },
  ];

  const tmpDir = await mkdtemp(join(tmpdir(), "gameserver-deploy-"));
  const path = join(tmpDir, "wrangler.json");
  await writeFile(path, JSON.stringify(config, null, 2));

  return path;
}

async function runWranglerWithSecrets(
  args: string[],
  secrets: Record<string, string>,
): Promise<void> {
  const tmpDir = await mkdtemp(join(tmpdir(), "gameserver-secrets-"));
  const secretsPath = join(tmpDir, ".dev.vars");

  const body = Object.entries(secrets)
    .map(([k, v]) => `${k}=${v}`)
    .join("\n");

  await writeFile(secretsPath, body + "\n");

  const wranglerCmd = `npx wrangler ${args.join(" ")} --secrets-file ${secretsPath}`;
  console.log(`Running: npx wrangler ${args.join(" ")} --secrets-file <tmp>`);

  try {
    execSync(wranglerCmd, { stdio: "inherit" });
  } finally {
    await unlink(secretsPath).catch(() => { });
    await unlink(join(tmpDir, ".gitkeep")).catch(() => { });
  }
}

async function deployProduction(): Promise<void> {
  console.log("Production deploy — fetching default branch URI from Neon");

  const { id: branchId, name: branchName } = await fetchDefaultBranch();
  const { database, role } = await fetchDatabaseAndRole(branchId);
  const [pooled, unpooled] = await Promise.all([
    fetchConnectionUri(branchId, database, role, true),
    fetchConnectionUri(branchId, database, role, false),
  ]);

  await runPreDeployHook({
    pooledUri: pooled,
    unpooledUri: unpooled,
    branchId,
    branchName,
    deployEnv: "production",
  });

  const wranglerConfig = await readWranglerConfig();
  const hyperdriveName = `${wranglerConfig.name as string}--production`;
  const hyperdriveId = await ensureHyperdrive(hyperdriveName, unpooled);
  const configPath = await writeTempWranglerConfig(hyperdriveId);

  try {
    await runWranglerWithSecrets(["deploy", "--config", configPath], {
      DATABASE_URL: pooled,
      DATABASE_URL_UNPOOLED: unpooled,
    });
  } finally {
    await unlink(configPath).catch(() => { });
  }
}

async function deployPreview(): Promise<void> {
  const gitBranch = requireEnv("WORKERS_CI_BRANCH");

  const slug = gitBranch
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 56) || "branch";

  const branchName = `preview-${slug}`;
  const branchId = await ensureNeonBranch(branchName);
  const { database, role } = await fetchDatabaseAndRole(branchId);

  const [pooled, unpooled] = await Promise.all([
    fetchConnectionUri(branchId, database, role, true),
    fetchConnectionUri(branchId, database, role, false),
  ]);

  await runPreDeployHook({
    pooledUri: pooled,
    unpooledUri: unpooled,
    branchId,
    branchName,
    deployEnv: "preview",
  });

  const wranglerConfig = await readWranglerConfig();
  const hyperdriveName = `${wranglerConfig.name as string}--preview--${slug}`;
  const hyperdriveId = await ensureHyperdrive(hyperdriveName, unpooled);
  const configPath = await writeTempWranglerConfig(hyperdriveId);

  const previewAlias = slug;

  try {
    await runWranglerWithSecrets(
      ["versions", "upload", "--preview-alias", previewAlias, "--config", configPath],
      {
        DATABASE_URL: pooled,
        DATABASE_URL_UNPOOLED: unpooled,
      },
    );
  } finally {
    await unlink(configPath).catch(() => { });
  }
}

if (!process.env["WORKERS_CI_BUILD_UUID"]) {
  console.log("Not running in Cloudflare Workers Builds (WORKERS_CI_BUILD_UUID unset) — skipping.");
  process.exit(0);
}

const GIT_DEFAULT_BRANCH = process.env["GIT_DEFAULT_BRANCH"] ?? "main";

const wranglerConfigInit = await readWranglerConfig();
await cleanupOrphanHyperdrives(wranglerConfigInit.name as string);

if (requireEnv("WORKERS_CI_BRANCH") === GIT_DEFAULT_BRANCH) {
  await deployProduction();
} else {
  await deployPreview();
}
