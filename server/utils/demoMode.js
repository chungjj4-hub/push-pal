// Single source of truth for whether the server is running as a public,
// credential-free portfolio demo (seeded SQLite data, no live OAuth/API
// calls). Read once at call time rather than cached, so tests/scripts that
// set the env var after import still see the current value.
export function isDemoMode() {
  return process.env.DEMO_MODE === 'true';
}
