---
name: Generated client DOM types
description: TypeScript configuration needed for the generated React API client.
---

The TypeScript compiler libraries for `api-client-react` must include `DOM.Iterable` when generated client code uses `Headers.entries()`.

**Why:** Orval generation can succeed while the chained library typecheck fails with `Headers.entries` missing from the `Headers` type.

**How to apply:** If generated API code reports that `Headers.entries` does not exist, inspect the client package's `tsconfig` and retain both `dom` and `dom.iterable` in its `lib` list.