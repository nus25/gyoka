// use .dev.vars for dev environment
// use `wrangler secret put` for production deploy
interface EnvWithSecret extends Env {
  GYOKA_API_KEY: string;
}
