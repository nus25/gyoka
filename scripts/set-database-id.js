import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const DEFAULT_DB_NAME = 'gyoka-db-v1';
const CONFIG_URLS = [
  new URL('../packages/editor/wrangler.jsonc', import.meta.url),
  new URL('../packages/generator/wrangler.jsonc', import.meta.url),
];

// Matches the first database_id after "production" so comments and formatting stay intact.
const DATABASE_ID_PATTERN = /("database_id"\s*:\s*")([^"]*)(")/;
// Sample value (xxxxxxxx-xxxx-...) or empty string means "not configured yet".
const UNSET_PATTERN = /^[x-]*$/i;

// Supports `--name <db>` and `--name=<db>`; all other arguments (for example --location wnam) go to `wrangler d1 create`.
function parseArgs(args) {
  let name = DEFAULT_DB_NAME;
  const createArgs = [];
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--name') {
      name = args[++i];
    } else if (arg.startsWith('--name=')) {
      name = arg.slice('--name='.length);
    } else {
      createArgs.push(arg);
    }
  }
  if (!name) {
    throw new Error('--name requires a database name.');
  }
  return { name, createArgs };
}

function readConfig(url) {
  const text = readFileSync(url, 'utf8');
  const start = text.indexOf('"production": {');
  if (start < 0) {
    throw new Error(`env.production was not found in ${url.pathname}`);
  }
  const head = text.slice(0, start);
  const tail = text.slice(start);
  const match = DATABASE_ID_PATTERN.exec(tail);
  if (!match) {
    throw new Error(`database_id was not found in env.production of ${url.pathname}`);
  }
  return { url, head, tail, current: match[2] };
}

// Wrangler prints its own error to stderr; add what to do next instead of a Node stack trace.
function runWrangler(args, options) {
  try {
    return execFileSync('pnpm', ['exec', 'wrangler', ...args], options);
  } catch {
    throw new Error(
      `\`wrangler ${args.join(' ')}\` failed. No file was changed.\n` +
        'See the Wrangler error above.\n' +
        '- Authentication error (code 10000): the login token may have just been refreshed. Run this command again.\n' +
        '- If it keeps failing, check your login and D1 permission with `pnpm exec wrangler whoami`.'
    );
  }
}

function findDatabase(name) {
  const stdout = runWrangler(['d1', 'list', '--json'], {
    encoding: 'utf8',
    stdio: ['inherit', 'pipe', 'inherit'],
  });
  return JSON.parse(stdout).find((db) => db.name === name);
}

function main() {
  const { name: dbName, createArgs } = parseArgs(process.argv.slice(2));

  // Validate config structure before touching Cloudflare so a broken file does not leave a stray database.
  const configs = CONFIG_URLS.map(readConfig);

  let database = findDatabase(dbName);
  if (database) {
    console.log(`D1 database "${dbName}" already exists. Skipping creation.`);
    if (createArgs.length > 0) {
      console.warn(`Ignoring arguments for creation: ${createArgs.join(' ')}`);
    }
  } else {
    runWrangler(['d1', 'create', dbName, '--binding=DB', ...createArgs], { stdio: 'inherit' });
    database = findDatabase(dbName);
  }

  if (!database) {
    throw new Error(`D1 database "${dbName}" was not found after creation.`);
  }

  // A different, already-configured ID may point to a database you chose on purpose; never overwrite it.
  const conflicts = configs.filter(
    ({ current }) => !UNSET_PATTERN.test(current) && current !== database.uuid
  );
  if (conflicts.length > 0) {
    const details = conflicts.map(({ url, current }) => `  ${url.pathname}: ${current}`).join('\n');
    throw new Error(
      `database_id differs from "${dbName}" (${database.uuid}). No file was changed.\n${details}\n` +
        'Fix the value manually, or set it to the ID above and run this command again.'
    );
  }

  for (const { url, head, tail, current } of configs) {
    if (current === database.uuid) {
      console.log(`database_id is already set in ${url.pathname}`);
      continue;
    }
    const replaced = tail.replace(
      DATABASE_ID_PATTERN,
      (_, open, _current, close) => `${open}${database.uuid}${close}`
    );
    writeFileSync(url, head + replaced);
    console.log(`Set database_id in ${url.pathname}`);
  }
}

try {
  main();
} catch (error) {
  console.error(`Error: ${error.message}`);
  process.exitCode = 1;
}
