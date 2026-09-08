# @relia1-platform/elkjs 0.13.0-topoloom.4

Built from Relia1 master. Compared with `0.13.0-topoloom.3`, this release adds
the geometric aesthetics work of September 2026 and rebuilds the bundle and both
workers from Relia1 ELK Java commit `501ec161`. Every new capability is opt-in:
layouts that use none of the new options are bit-identical to `0.13.0-topoloom.3`
(82 shared fixture and generated cases, and the 21 unlabeled fixtures against the
`0.13.0-topoloom.3` bundle). Package dependencies are unchanged. The previous
release tags and assets remain unchanged.

New options of the geometric provider (`elk.algorithm: 'org.eclipse.elk.geometric'`):

- `elk.geometric.routing: 'ORTHOGONAL'` draws axis-aligned connectors that leave
  and enter nodes through the facing sides, spread along shared sides, are
  nudged apart in shared channels, take the fewest bends, and carry their labels
  on the final routes. Nodes closer than twice `elk.spacing.edgeNode` get a
  polyline connector instead of an error. `elk.edgeRouting: 'ORTHOGONAL'` still
  selects the layered fallback.
- `elk.geometric.tree.routing: 'BUS'` draws TREE components as org charts: one
  bus per parent halfway through the level gap, perpendicular drops into the
  children, `junctionPoints` where drops leave the bus, labels on the drops.
- `elk.geometric.tree.hanging: N` hangs the leaf children of a parent with more
  than N of them in columns beside vertical trunks, one leaf per side and row,
  as square a block as the counts allow, connected through the bus, the trunk,
  and a stub long enough for the widest label. In `AUTO` mode a star with more
  leaves than N becomes such a tree: a hub with a hundred labeled devices
  measures about 920 by 1085 px instead of 5280 px square.
- `elk.geometric.mode: 'FIXED'` keeps the given node positions, for example from
  `layered` or from a user, and only routes edges, places labels, and computes
  bounds; edges that cannot be routed fall back to their direct segment.
- `elk.geometric.refine: 'true'` polishes placed positions with small moves that
  keep spacing and order: connectors whose ends almost share an axis are
  straightened, nodes that almost share a row or column are aligned, nearly
  equal gaps become equal, and node borders snap to `elk.geometric.refineGrid`
  (default 1 px). It works in every mode, including `FIXED` positions from
  `layered`, whose staircases of a few pixels are straightened level by level.
- `elk.interactive: 'true'` with the old coordinates keeps the drawing's order
  on relayout: tree siblings, hanging leaves, radial children, ring orientation
  and rotation, and the root; new nodes without coordinates are appended.
- `elk.geometric.packing: 'COMPACT'` arranges the connected components of a
  scope by decreasing height, first fit into the rows opened so far: aligned
  tops, full rows, a denser drawing, independent of the input order.

Robustness and performance: a label whose detour or corridor search fails is
placed beside its route instead of failing the layout, a self-loop whose
corners are all blocked keeps its shape, a search from an endpoint enclosed by
another footprint fails at once, and `FIXED` routing spends a bounded search per
edge before its direct connector. The connector router is allocation-free on
its hot paths and indexes pre-routed segments: a labeled 100-leaf orthogonal
star routes in 0.19 s instead of 1.19 s, and a labeled hub of a thousand hanging
leaves in 0.58 s instead of 2.05 s.

Edge labels, `elk.edgeLabels.inline`, `elk.edgeLabels.placement`, and the label
spacing options behave as in `0.13.0-topoloom.3`; renderers that draw a label
on a midpoint anchor, as Topoloom does, should pass `'elk.edgeLabels.inline':
'true'`. The async API and string-map layout options are unchanged. The default
layout remains layered.

Install from the versioned GitHub Release asset (the distribution channel used
by Topoloom):

```sh
pnpm add '@relia1-platform/elkjs@https://github.com/Relia1-platform/elkjs/releases/download/v0.13.0-topoloom.4/relia1-platform-elkjs-0.13.0-topoloom.4.tgz'
```

```js
const ELK = require('@relia1-platform/elkjs/lib/elk.bundled.js');
const elk = new ELK({ algorithms: ['geometric'] });
const result = await elk.layout({
  id: 'root',
  layoutOptions: {
    'elk.algorithm': 'org.eclipse.elk.geometric',
    'elk.geometric.mode': 'AUTO',
    'elk.geometric.routing': 'ORTHOGONAL',
    'elk.geometric.tree.hanging': '8',
    'elk.geometric.refine': 'true',
    'elk.edgeLabels.inline': 'true'
  },
  children: [
    { id: 'core', width: 60, height: 40 },
    { id: 'a', width: 40, height: 30 },
    { id: 'b', width: 40, height: 30 }
  ],
  edges: [
    { id: 'core-a', sources: ['core'], targets: ['a'],
      labels: [{ id: 'core-a-label', text: 'uplink', width: 48, height: 16 }] },
    { id: 'core-b', sources: ['core'], targets: ['b'] }
  ]
});
```

The ordinary worker and minified worker also support the restricted
`algorithms: ['geometric']` list. See `geometric-layout.md` in the release assets
(or `docs/geometric-layout.md` in the package) for every option, the connector
styles, hanging leaves, refinement, stable relayout, packing, labels, and the
routing fallback behavior.

Explicit spline routing and hyperedges use layered fallback. Impossible fixed
bounds produce an error rather than clipped geometry.

Validation includes the full Java Maven suite (51,764 tests), 192
JavaScript tests across the bundle and workers including label quality,
connector, refinement, hanging, relayout, and packing suites over 33 shared
fixtures, exact JVM/JS parity for those fixtures (3,804 coordinates), and a
random sweep of trees, stars, rings, forests, and meshes through ten feature
combinations (`scripts/geometric-sweep.cjs`). The release workflow rebuilds and
runs the JS suite on Linux with Java 17 and Node 24. This fork uses the ELK 0.13
development line; it is not an upstream 0.13 release. See
`TOPOLOOM_PROVENANCE.md` and `source-revisions.json` for source revisions, plus
the SBOM, license, and `SHA256SUMS` release assets.
