# @relia1-platform/elkjs 0.13.0-topoloom.3

Built from Relia1 master. Compared with `0.13.0-topoloom.2`, this release fixes
the geometric edge-label routing regression and rebuilds the bundle and both
workers from Relia1 ELK Java commit `ad788fa2`. Package dependencies are
unchanged. The previous release tag and assets remain unchanged.

Edge-label footprints no longer send geometric edges into loops or exterior
corridors above the whole drawing. Placement reserves room for labels: tree
levels and siblings spread by the label extents, and radial and ring layouts
grow to the smallest scale at which every label fits beside its edge. Routing
then places each label on the edge's own route whenever a segment can hold it,
sliding along the segment and choosing the freer side; only when no segment fits
does the edge take the smallest local detour, and only when no such detour exists
an exterior corridor on the nearest side. Placed labels, including those of
nested groups, are obstacles for edges routed later, never for their own edge.
Self-loops stay beside their node, and parallel labeled edges keep their lanes.
A six-leaf radial star with mixed label widths now routes with 0 bends instead
of 53, and a labeled ring or symmetric tree routes with 0 bends instead of 78
and 50.

`elk.edgeLabels.inline`, `elk.edgeLabels.placement`, `elk.spacing.edgeLabel`,
`elk.spacing.labelNode`, and `elk.spacing.labelLabel` are honored by the
geometric provider. Renderers that draw a label on a midpoint anchor, as
Topoloom does, should pass `'elk.edgeLabels.inline': 'true'`. Labeled drawings
become larger because room is reserved; layouts of graphs without edge labels
are bit-identical to `0.13.0-topoloom.2`. Label `id`, `x`, `y`, `width`, and
`height` are returned relative to the edge's containing node, like the edge
sections. The async API and string-map layout options are unchanged.

Geometric layout remains opt-in for balanced trees, concentric radial diagrams,
equal-angle rings, and mixed graphs. `AUTO` recognizes and composes these forms;
`TREE`, `RADIAL`, `RING`, and `CLUSTER` select a family explicitly. The default
layout remains layered.

Install from the versioned GitHub Release asset (the distribution channel used
by Topoloom):

```sh
pnpm add '@relia1-platform/elkjs@https://github.com/Relia1-platform/elkjs/releases/download/v0.13.0-topoloom.3/relia1-platform-elkjs-0.13.0-topoloom.3.tgz'
```

```js
const ELK = require('@relia1-platform/elkjs/lib/elk.bundled.js');
const elk = new ELK({ algorithms: ['geometric'] });
const result = await elk.layout({
  id: 'root',
  layoutOptions: {
    'elk.algorithm': 'org.eclipse.elk.geometric',
    'elk.geometric.mode': 'AUTO',
    'elk.edgeLabels.inline': 'true'
  },
  children: [
    { id: 'a', width: 40, height: 30 },
    { id: 'b', width: 40, height: 30 }
  ],
  edges: [{ id: 'ab', sources: ['a'], targets: ['b'],
    labels: [{ id: 'ab-label', text: 'depends on', width: 64, height: 16 }] }]
});
```

The ordinary worker and minified worker also support the restricted
`algorithms: ['geometric']` list. See `geometric-layout.md` in the release assets
(or `docs/geometric-layout.md` in the package) for root hints, ordering, ports,
hierarchy, labels, and routing fallback behavior.

Explicit spline/orthogonal routing and hyperedges use layered fallback.
Impossible fixed bounds produce an error rather than clipped geometry.

Validation includes the full Java Maven suite (51,736 tests), 137 JavaScript
tests across the bundle and workers including a label quality suite over nine
shared label fixtures, and exact JVM/JS parity for 19 shared fixtures (1,612
coordinates). The release workflow rebuilds and runs the JS suite on Linux with
Java 17 and Node 24. This fork uses the ELK 0.13 development line; it is not an
upstream 0.13 release. See `TOPOLOOM_PROVENANCE.md` and `source-revisions.json`
for source revisions, plus the SBOM, license, and `SHA256SUMS` release assets.
