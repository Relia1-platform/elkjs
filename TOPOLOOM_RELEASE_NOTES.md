# @relia1-platform/elkjs 0.13.0-topoloom.2

Built from Relia1 master after merging the geometric release with upstream
development. Compared with `0.13.0-topoloom.1`, this includes the restored DisCo
provider, the FakeWorker CommonJS export fix, updated dependencies, and rebuilt
workers using Gradle 8.10 and GWT 2.13.0. The ELK Java source pin is unchanged.
The previous release tag and assets remain unchanged.

Adds opt-in geometric layout for balanced trees, concentric radial diagrams,
equal-angle rings, and mixed graphs. `AUTO` recognizes and composes these forms;
`TREE`, `RADIAL`, `RING`, and `CLUSTER` select a family explicitly. The default
layout remains layered. The async API and string-map layout options are unchanged.

Install from the versioned GitHub Release asset (the distribution channel used
by Topoloom):

```sh
pnpm add '@relia1-platform/elkjs@https://github.com/Relia1-platform/elkjs/releases/download/v0.13.0-topoloom.2/relia1-platform-elkjs-0.13.0-topoloom.2.tgz'
```

```js
const ELK = require('@relia1-platform/elkjs/lib/elk.bundled.js');
const elk = new ELK({ algorithms: ['geometric'] });
const result = await elk.layout({
  id: 'root',
  layoutOptions: {
    'elk.algorithm': 'org.eclipse.elk.geometric',
    'elk.geometric.mode': 'AUTO'
  },
  children: [
    { id: 'a', width: 40, height: 30 },
    { id: 'b', width: 40, height: 30 }
  ],
  edges: [{ id: 'ab', sources: ['a'], targets: ['b'] }]
});
```

The ordinary worker and minified worker also support the restricted
`algorithms: ['geometric']` list. See `geometric-layout.md` in the release assets
(or `docs/geometric-layout.md` in the package) for root hints, ordering, ports,
hierarchy, labels, and routing fallback behavior.

Compatibility corrections affect legacy output: MrTree now contains unequal
node widths correctly; centered radial bounds include the farther extent; Eades
uses finite tangent cones; JSON export clears obsolete junction points. Existing
diagrams can therefore have corrected bounds or radial coordinates. Explicit
spline/orthogonal routing and hyperedges use layered fallback. Impossible fixed
bounds produce an error rather than clipped geometry.

Validation includes the full Java Maven suite, 110 JavaScript tests across the
bundle and workers, and exact JVM/JS parity for 10 shared fixtures (696 geometric
coordinates). The release workflow rebuilds and runs the JS suite on Linux with
Java 17 and Node 24. This fork uses the ELK 0.13 development line; it is not an
upstream 0.13 release. See `TOPOLOOM_PROVENANCE.md` and `source-revisions.json`
for source revisions, plus the SBOM, license, and `SHA256SUMS` release assets.
