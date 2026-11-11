import type { RemoteLiveQuery } from "@sveltejs/kit";

// SvelteKit keeps a live query that ended or failed (a 401 after a logout, for example) in its cache,
// and reading it again replays that end. Reconnect it first so a page mounted again gets live data.
export default async function* follow<T>(query: RemoteLiveQuery<T>) {
  if (query.done) {
    // After a navigation SvelteKit reconnects the query too: ours is then interrupted and rejects
    // with the old error. A real failure still closes the query, so reading it below reports it.
    await query.reconnect().catch(() => undefined);
  }

  yield* query;
}
