import { access, readFile, writeFile, unlink, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execSync } from "node:child_process";

const PRE_DEPLOY_HOOK = "scripts/pre-deploy.ts";
const CF_API = "https://api.cloudflare.com/client/v4";
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
      DEPLOY_ENV: args.deployEnv,
    },
  });
  console.log(`=== Pre-deploy hook complete ===`);
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

function getCurrentBranch(): string {
  return process.env["WORKERS_CI_BRANCH"] ?? process.env["GITHUB_REF_NAME"] ?? "branch";
}

function getDeployEnv(): "production" | "preview" {
  const defaultBranch = process.env["GIT_DEFAULT_BRANCH"] ?? "main";
  const env = process.env["DEPLOY_ENV"];
  if (env === "production" || env === "preview") return env;
  return getCurrentBranch() === defaultBranch ? "production" : "preview";
}

function getPreviewSlug(): string {
  return getCurrentBranch()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 56) || "branch";
}

async function main(): Promise<void> {
  const deployEnv = getDeployEnv();
  console.log(`Deploy environment: ${deployEnv}`);

  const pooled = requireEnv("DATABASE_URL");
  const unpooled = requireEnv("DATABASE_URL_UNPOOLED");

  await runPreDeployHook({
    pooledUri: pooled,
    unpooledUri: unpooled,
    deployEnv,
  });

  const wranglerConfig = await readWranglerConfig();
  const workerName = wranglerConfig.name as string;
  const hyperdriveName = deployEnv === "production"
    ? `${workerName}--production`
    : `${workerName}--preview--${getPreviewSlug()}`;

  const hyperdriveId = await ensureHyperdrive(hyperdriveName, unpooled);
  const configPath = await writeTempWranglerConfig(hyperdriveId);

  try {
    if (deployEnv === "production") {
      await runWranglerWithSecrets(["deploy", "--config", configPath], {
        DATABASE_URL: pooled,
        DATABASE_URL_UNPOOLED: unpooled,
      });
    } else {
      await runWranglerWithSecrets(
        ["versions", "upload", "--preview-alias", getPreviewSlug(), "--config", configPath],
        {
          DATABASE_URL: pooled,
          DATABASE_URL_UNPOOLED: unpooled,
        },
      );
    }
  } finally {
    await unlink(configPath).catch(() => { });
  }
}

await main();
