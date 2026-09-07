# Geometric layout

`org.eclipse.elk.geometric` balances trees, preserves concentric radial levels, places rings at equal angles, and composes these structures in mixed graphs. Placement, topology analysis, routing, and bounds normalization run in Java and are compiled into the elkjs workers. The existing default remains `layered`.

```js
const ELK = require('elkjs/lib/elk.bundled.js');
const elk = new ELK({ algorithms: ['geometric'] });

graph.layoutOptions = {
  ...graph.layoutOptions,
  'elk.algorithm': 'org.eclipse.elk.geometric',
  'elk.geometric.mode': 'AUTO',
  'elk.spacing.nodeNode': '24',
  'elk.padding': '[top=24,left=24,bottom=24,right=24]'
};
// Optional: select the main root in its connected component.
mainNode.layoutOptions = { ...mainNode.layoutOptions, 'elk.geometric.root': 'true' };
const result = await elk.layout(graph, { logging: true, measureExecutionTime: true });
```

The `algorithms: ['geometric']` configuration also registers the required layered, MrTree, and radial providers. The bundle, ordinary worker, and minified worker use the same implementation. `LayoutOptions` remains a string map; node IDs, edge IDs, endpoints, directions, and declared hierarchy are preserved.

## Options

| Option | Default | Meaning |
| --- | --- | --- |
| `elk.geometric.mode` | `AUTO` | `TREE`, `RADIAL`, `RING`, or `CLUSTER` can force the layout family. |
| `elk.geometric.root` | `false` | Mark a node as the root of its component. Multiple roots in one component produce an error. |
| `elk.geometric.order` | `MODEL_ORDER` | Use `STABLE_ID` for invariance to reordering the input node and edge arrays. IDs are ordered lexically. |
| `elk.geometric.startAngle` | `-1.5707963267948966` | Radians, with the first ring node or radial branch pointing upward by default. |
| `elk.geometric.clockwise` | `true` | Orientation in screen coordinates. |
| `elk.geometric.ring.anchorId` | empty | Node to place at the ring's start angle. Applies to the ring containing that node. |

Core direction, padding, node spacing, edge spacing, node sizing, labels, and port constraints remain available. Effective node spacing may increase to leave a navigable edge corridor. Exact symmetry applies to matching subtree structures and footprints; unequal branches are centered by their visible envelopes.

`TREE` uses a BFS backbone, bottom-up contours, symmetric packing passes, and uniform levels. All four directions are supported. `RADIAL` assigns equal sectors to root branches and keeps a common radius step for all depths. `RING` keeps every node on a common circle at equal angles, increasing only the shared radius for clearance.

In `AUTO`, explicit roots select radial layout; pure trees select tree layout (stars select radial); qualifying cycles select ring layout; other structures are decomposed in `CLUSTER`. The structural graph collapses parallel edges and excludes self-loops only during recognition. All original edges are subsequently routed.

Mixed layout uses iterative biconnected-component analysis. A block qualifies as a ring when a deterministic fundamental cycle covers all its nodes and its chord count is at most `max(1, floor(n / 4))`. This is a bounded heuristic, not an exhaustive Hamiltonian-cycle search. Hanging trees occupy outward sectors. Generic blocks use layered BK `BALANCED`, followed by uniform expansion if required for clearance. Regions are composed by translation, with no temporary clusters added to the output hierarchy.

For interactive ring layout, set `elk.interactive` to `'true'`, retain old node coordinates, and omit `elk.geometric.startAngle`. Rotation is fitted to positioned nodes; a newly added JSON node with no coordinates does not bias the fit. An explicit start angle locks rotation.

## Routing and failure behavior

The geometric router emits polylines around fixed node, port, and label footprints. It uses a spatial index, a cached adaptive visibility graph, and deterministic path choices ordered by length, bends, and crossings. Fixed ports retain their coordinates. Cross-hierarchy routes use ancestor boundary waypoints and avoid descendant obstacles. Labels use suitable segments or dedicated exterior corridors when they need more room.

Explicit spline or orthogonal routing, hyperedges, and excluded-node constraints use layered fallback. Enable `logging` to see the reason and the recognized modes. A fixed graph size that cannot accommodate the result raises an error; it does not silently clip the layout. The geometric provider commits its internal working graph only after every scope succeeds.

Native opt-in placement is also available:

```js
{ 'elk.algorithm': 'mrtree', 'elk.mrtree.nodePlacement': 'BALANCED' }
{ 'elk.algorithm': 'radial', 'elk.radial.nodePlacement': 'BALANCED',
  'elk.radial.centerOnRoot': 'true' }
```

Use the geometric provider for mixed graphs and automatic routing fallback. Native MrTree and radial keep their legacy placement defaults.

## Build and verification

Keep the matching ELK checkout beside elkjs as `../elk`. Build Java with JDK 17 and a checkout of `elk-models`, following the ELK CI Maven `clean verify` configuration. Then use Node 24:

```sh
npm ci
npm run build
npm test -- --exit
node scripts/check-geometric-parity.cjs
node scripts/geometric-quality.cjs artifacts/geometric /path/to/baseline-elk.bundled.js
```

Shared fixtures are in `../elk/test/geometry`. JVM tests export results to `../elk/test/org.eclipse.elk.alg.geometric.test/target/geometric-results`; the parity script compares node, port, label, and edge coordinates with the freshly built JS bundle, using `1e-6 × max(1, diagram size)` tolerance.

The quality command writes a standalone `gallery.html`, `comparisons.json`, and `benchmark.json`. Each before/after pair uses the same input dimensions and display scale. Benchmarks cover tree, star, ring, chain, chorded ring, mixed regions, and nested scopes at 10, 100, and 1,000 leaf nodes. Five timed samples follow a warm-up. p50/p95 are descriptive sample quantiles; heap deltas include garbage-collection effects and are not peak memory. Stage timings come from ELK progress monitors. Area, edge length, and bend count are costs to inspect, not optimization targets that must always decrease.

## Compatibility notes

- Legacy MrTree bounds now use top-left extents after coordinate conversion and include margins. Unequal-width children no longer overflow their graph.
- Legacy radial `centerOnRoot` bounds use the farther side of the root, including margins and padding. Asymmetric diagrams may become larger while retaining their centered root.
- Legacy Eades placement uses a clamped parent/child radius ratio for its tangent cone and gives the root a full circle. This fixes non-finite angles and inward-facing support edges.
- JSON export removes obsolete junction points when routes are replaced. JSON port import uses an explicit `void` return to prevent an invalid temporary variable in optimized GWT output.

These corrections can change legacy output bounds or radial coordinates. The new geometric placement families require explicit selection.
