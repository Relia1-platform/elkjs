# Working in elkjs

This file applies to this repository. Read any more specific `AGENTS.md` before editing its directory.

## Repository boundaries

- This repository packages ELK for JavaScript. The public async API and worker orchestration live here; the layout algorithms primarily live in the sibling `../elk` Java repository.
- Fix algorithm behavior in the owning Java provider/kernel. Use JS changes for API, worker, serialization bridge, typing, build, and packaging concerns.
- Check working trees and HEADs in both repositories before cross-repository work. Preserve unrelated user changes and local agent/index files.
- Build against the matching Relia1 ELK checkout. Do not reset the sibling checkout to an upstream or historical release revision to make a build succeed.
- Keep `elk.layout()`, graph IDs/hierarchy/endpoints, and the `LayoutOptions` string-map contract compatible unless the task explicitly changes the public API.

## Source map

| Path | Purpose |
| --- | --- |
| `src/js/elk-api.js` | Public API, defaults, requests, promises, and worker lifecycle. |
| `src/js/main-node.js`, `src/js/main-api.js` | Runtime entry points. |
| `src/java/org/eclipse/elk/js/ElkJs.java` | Java/JS bridge, manual algorithm registration, result/log handling. |
| `src/java/org/eclipse/elk/js/ElkJs.gwt.xml` | GWT module configuration. |
| `build.gradle` | Java source selection, preprocessing, metadata/Xtend generation, GWT compilation. |
| `typings/` | Source TypeScript declarations. |
| `test/mocha/` | API, worker, regression, and geometric invariant tests. |
| `scripts/` | Geometry parity, benchmark, and gallery tools. |
| `lib/` | Distributed generated API, workers, bundle, and declarations. |

See `docs/geometric-layout.md` for the geometric API and `README.md` for general usage.

## Build and generated artifacts

Use JDK 17 and Node 24 for the supported local/release baseline. Recheck the workflow matrices when changing runtime support. `build.gradle` defaults to Java sources at `../elk`; Gradle's `elkRepo` property can select another checkout.

From this repository root:

```sh
npm ci
npm run build
npm test
```

- `npm run build` runs the Gradle/GWT stage, then Babel, Browserify, and artifact copying. `npm run js` is only the JS packaging stage and is insufficient after Java, Xtend, or metadata changes.
- Edit source files in `src/`, `typings/`, or the sibling Java repository. Rebuild `lib/`; never repair a generated worker or minified bundle by hand.
- `lib/` is ignored but existing distribution files are tracked. Use `git ls-files lib` to inspect and `git add -u lib` to stage rebuilt tracked files. Do not force-add entire ignored build/cache directories.
- Include generated distribution changes with the source changes they represent when delivering a rebuilt library.
- Keep package name, exports, and module/worker behavior consistent. Do not change package versions, lockfiles, dependencies, or release tags unless required by the task.

## Validation

- Mocha tests import built `lib/` artifacts. A passing test on the old bundle is not evidence for a Java source change.
- For a targeted JS iteration after the relevant build, use `npm test -- --grep "pattern"`. Terminate real workers in test cleanup; `--exit` may help diagnose a failed run that hangs, but must not substitute for lifecycle cleanup.
- Cover the bundle, ordinary worker, and minified worker for bridge or algorithm-registration changes. Check metadata listing and an actual layout with a restricted `algorithms` list.
- A new algorithm needs its Java sources in `build.gradle`, provider/dependency registration in `ElkJs.java`, and deliberate default-list handling in `elk-api.js`.
- Geometry fixtures are read from `../elk/test/geometry`; the matching sibling checkout is required. Do not silently skip missing fixtures.
- Test bounds, clearance, symmetry/centering, radii/angles, graph preservation, direction, hierarchy frames, fixed ports, labels, and stable ordering where relevant. Use scale-relative numeric tolerances.
- For shared geometric changes, run the JVM tests first, then compare fresh outputs:

```sh
node scripts/check-geometric-parity.cjs
node scripts/geometric-quality.cjs /path/to/output /path/to/baseline-elk.bundled.js
```

The parity script reads JVM exports from the sibling geometric test plugin's `target/geometric-results`. Use the same input dimensions, hierarchy settings, and display scale in gallery comparisons. Baselines must have complete routes. Run timed benchmarks after build/index jobs finish; report sample count and distinguish heap deltas from peak memory.

- Documentation-only changes need path/command and diff checks; do not rebuild GWT without a reason.

## Release and provenance

- Read `.github/workflows/topoloom-release.yml`, `TOPOLOOM_PROVENANCE.md`, and `TOPOLOOM_RELEASE_NOTES.md` before release work.
- Release configuration pins Java source independently of the JS package. Existing pins describe a specific historical release; they do not prove that the current feature branch can be rebuilt from that release's Java commit.
- For a new release, update source pins, package/version metadata, and provenance together, then validate the actual package contents and worker entry points.
- Report both ELK and elkjs revisions for rebuilt bundles. Keep temporary toolchains, caches, local indexes, and generated benchmark output out of source commits.

<!-- ZVEC_GREP_START -->
## Workspace retrieval

- Choose the evidence source first. Use workspace retrieval for local code, documents, configuration, and questions grounded in these repositories; use external sources for unrelated or current external facts.
- For an exact identifier, filename, literal, or regex where locating occurrences is sufficient, use `zvec_grep_rg` if available, otherwise `rg`.
- For architecture, relationships, lifecycle, rationale, fuzzy discovery, or cross-file synthesis, use `zvec_grep_search` first. Include known anchors in the semantic query, then use exact searches for focused follow-up.
- Pass the daemon-visible absolute repository `root` on every zvec call. Search the Java and JS repositories separately when the question crosses their boundary.
- Treat sufficient returned snippets as already-read evidence. Open a file only for a detail outside the snippet; avoid broad reads or repeated searches after the evidence is sufficient.
- Read `freshness` and `background_refresh` from results without a status preflight. Use sufficient `served_from_current_index` results while acknowledging possible drift; verify edited source directly.
- For an existence question without an exact anchor, make one focused semantic probe. If it is irrelevant, report that the index did not establish the answer rather than broadening indefinitely.
- If an index is missing and exact search can answer the question, use `rg`. Creating, rebuilding, or dropping persistent indexes requires user authorization; reuse authorization already given in the session.
- Do not delegate merely to locate files. Complete independent local work while a necessary clarification is pending.

<!-- ZVEC_GREP_END -->

## GitNexus operational notes

The block below supplies the required impact/commit gates. Its generated statistics and example comparison base are snapshots; verify current source/index state and use the task's actual base revision. Use the repository name `elkjs` explicitly when selecting among indexed repositories.

- Prefer MCP tools; use the existing `.gitnexus/run.cjs` or an installed CLI if MCP is unavailable. Verify the runner before relying on its graph.
- Refresh only with user authorization, including authorization already given in the session. Prefer `analyze --index-only` to preserve repository instructions; enable `--pdg` when dependence analysis is needed.
- A dirty worktree can make some CLI versions report `stale` even just after indexing. Check indexed revision, runner identity, incomplete reasons, and source hashes; do not hide user files or treat a status label alone as proof of freshness.
- Graph analysis does not fully resolve Xtend, inline scripts, generated code, or dynamic/cross-language dispatch. For `UNKNOWN`, verify the real source/registration path and relevant tests; never equate zero callers with no impact. Report unavailable or incomplete analysis explicitly.

<!-- gitnexus:start -->
# GitNexus — Code Intelligence

This project is indexed by GitNexus as **elkjs**. Obtain current statistics and freshness from the index instead of treating this file as an index snapshot.

> When an index refresh is authorized, run `node .gitnexus/run.cjs analyze --index-only` from the project root. If the runner is absent, use an available installed CLI or the host's GitNexus tools; do not assume a machine-specific global path.

## Always Do

- **MUST run impact analysis before editing.** Use `impact({target: "symbolName", direction: "upstream"})` (MCP) or `node .gitnexus/run.cjs impact "symbolName" --direction upstream --repo .` (CLI fallback); report callers, processes, and risk. Never substitute grep for graph analysis.
- **MUST analyze graph changes before committing.** Use `detect_changes({scope: "all"})` (MCP) or `node .gitnexus/run.cjs detect-changes --scope all --repo .` (CLI fallback). `partial: true` or `truncated: true` is not a clean check — a zero means unseen, not unaffected; re-run it. For regression review: `detect_changes({scope: "compare", base_ref: "master"})` or `node .gitnexus/run.cjs detect-changes --scope compare --base-ref "master" --repo .`.
- **MUST warn the user** if impact analysis returns HIGH or CRITICAL risk before proceeding with edits.
- **MUST treat `risk: UNKNOWN` as unresolved, not as low.** An empty caller set is not evidence the symbol is unused — it can also mean the callers are not resolvable by the index (plain-object property access, dynamic dispatch, cross-language calls). `impact` pairs `UNKNOWN` with a `riskNote` saying so. Confirm with a text search before treating the symbol as safe to change or delete; do not proceed on the strength of a zero.
- When exploring unfamiliar code, use `query({search_query: "concept"})` to find execution flows instead of grepping. It returns process-grouped results ranked by relevance.
- When you need full context on a specific symbol — callers, callees, which execution flows it participates in — use `context({name: "symbolName"})`.
- For security review, `explain({target: "fileOrSymbol"})` lists taint findings (source→sink flows; needs `analyze --pdg`).

## Never Do

- NEVER edit a function, class, or method before MCP/CLI impact analysis.
- NEVER ignore HIGH or CRITICAL risk warnings from impact analysis, and never read `UNKNOWN` as an all-clear — it means the walk could not answer, which is the one verdict that requires confirming by other means.
- NEVER rename symbols with find-and-replace — use `rename` which understands the call graph.
- NEVER commit before MCP/CLI graph change analysis.

## Resources

| Resource | Use for |
| --- | --- |
| `gitnexus://repo/elkjs/context` | Codebase overview, check index freshness |
| `gitnexus://repo/elkjs/clusters` | All functional areas |
| `gitnexus://repo/elkjs/processes` | All execution flows |
| `gitnexus://repo/elkjs/process/{name}` | Step-by-step execution trace |

## CLI

| Task | Read this skill file |
| --- | --- |
| Understand architecture / "How does X work?" | `.claude/skills/gitnexus-exploring/SKILL.md` |
| Blast radius / "What breaks if I change X?" | `.claude/skills/gitnexus-impact-analysis/SKILL.md` |
| Trace bugs / "Why is X failing?" | `.claude/skills/gitnexus-debugging/SKILL.md` |
| Rename / extract / split / refactor | `.claude/skills/gitnexus-refactoring/SKILL.md` |
| Tools, resources, schema reference | `.claude/skills/gitnexus-guide/SKILL.md` |
| Index, status, clean, wiki CLI commands | `.claude/skills/gitnexus-cli/SKILL.md` |

<!-- gitnexus:end -->
