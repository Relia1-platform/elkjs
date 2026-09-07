/* SPDX-License-Identifier: EPL-2.0 OR GPL-3.0-or-later */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const metrics = require('./geometryMetrics');
const ELK = require('../../lib/elk.bundled.js');
const fixtureDir = path.resolve(__dirname, '../../../elk/test/geometry');
const fixtures = fs.readdirSync(fixtureDir).filter(n => n.endsWith('.json'))
  .map(n => JSON.parse(fs.readFileSync(path.join(fixtureDir, n), 'utf8')));
const fixture = id => structuredClone(fixtures.find(g => g.id === id));

describe('Geometric layout', function () {
  this.timeout(30000);
  const elk = new ELK({ algorithms: ['geometric'] });

  it('registers its metadata and dependencies when selected alone', async () => {
    const algorithms = await elk.knownLayoutAlgorithms();
    for (const id of ['geometric', 'layered', 'mrtree', 'radial']) {
      assert(algorithms.some(a => a.id === `org.eclipse.elk.${id}`), id);
    }
    const options = await elk.knownLayoutOptions();
    for (const suffix of ['mode', 'root', 'order', 'startAngle', 'clockwise', 'ring.anchorId']) {
      assert(options.some(o => o.id === `org.eclipse.elk.geometric.${suffix}`), suffix);
    }
  });

  for (const input of fixtures) it(`contains and preserves ${input.id}`, async () => {
    const graph = await elk.layout(structuredClone(input));
    metrics.containment(graph); metrics.clearance(graph, 24);
    assert.deepStrictEqual(graph.children.map(n => n.id), input.children.map(n => n.id));
    assert.deepStrictEqual(graph.edges.map(e => [e.id, e.sources, e.targets]),
      input.edges.map(e => [e.id, e.sources, e.targets]));
    const second = await elk.layout(structuredClone(input));
    assert.deepStrictEqual(metrics.geometry(graph), metrics.geometry(second));
  });

  for (const direction of ['DOWN', 'UP', 'LEFT', 'RIGHT']) it(`balances tree contours in ${direction}`, async () => {
    const input = fixture('symmetric-tree');
    input.layoutOptions['elk.direction'] = direction;
    const g = await elk.layout(input);
    const e = metrics.epsilon(g);
    const nodes = Object.fromEntries(g.children.map(n => [n.id, metrics.center(n)]));
    const axis = ['LEFT', 'RIGHT'].includes(direction) ? 'y' : 'x';
    const depth = axis === 'x' ? 'y' : 'x';
    for (const [a, b] of [['a', 'b'], ['a1', 'b2'], ['a2', 'b1']]) {
      metrics.near(nodes[a][axis] + nodes[b][axis], 2 * nodes.r[axis], e, 'mirror');
      metrics.near(nodes[a][depth], nodes[b][depth], e, 'level');
    }
    metrics.containment(g); metrics.clearance(g, 24);
  });

  it('keeps stars equiangular and centered on the root', async () => {
    const g = await elk.layout(fixture('star'));
    const root = metrics.center(g.children[0]);
    metrics.near(root.x, g.width / 2, metrics.epsilon(g), 'root x');
    metrics.near(root.y, g.height / 2, metrics.epsilon(g), 'root y');
    metrics.circular(g.children.slice(1), metrics.epsilon(g), root);
  });

  it('keeps asymmetric radial levels concentric with an equal radius step', async () => {
    const g = await elk.layout(fixture('radial-asymmetric'));
    const root = metrics.center(g.children[0]);
    const radius = n => Math.hypot(metrics.center(n).x - root.x, metrics.center(n).y - root.y);
    const step = radius(g.children[1]);
    for (const n of g.children.slice(1)) metrics.near(radius(n), step * (n.id.length === 1 ? 1 : 2), metrics.epsilon(g), n.id);
  });

  for (const id of ['ring', 'ring-unequal']) it(`preserves exact ${id} geometry`, async () => {
    const g = await elk.layout(fixture(id));
    metrics.circular(g.children, metrics.epsilon(g));
  });

  it('honors ring anchor, rotation and orientation', async () => {
    const input = fixture('ring');
    Object.assign(input.layoutOptions, {'elk.geometric.ring.anchorId': 'n3', 'elk.geometric.startAngle': '0', 'elk.geometric.clockwise': 'false'});
    const g = await elk.layout(input);
    const result = metrics.circular(g.children, metrics.epsilon(g), undefined, false);
    const anchor = metrics.center(g.children.find(n => n.id === 'n3'));
    metrics.near(anchor.y, result.center.y, metrics.epsilon(g), 'anchor angle');
    assert(anchor.x > result.center.x);
  });

  it('retains ring geometry when branches are attached', async () => {
    const g = await elk.layout(fixture('ring-branches'));
    metrics.circular(g.children.filter(n => n.id.startsWith('n')), metrics.epsilon(g));
  });

  it('preserves both rings after region composition', async () => {
    const g = await elk.layout(fixture('two-rings'));
    for (const prefix of ['a', 'b']) metrics.circular(g.children.filter(n => n.id.startsWith(prefix)), metrics.epsilon(g));
  });

  it('is invariant to input permutation under STABLE_ID', async () => {
    for (const input of fixtures) {
      const a = structuredClone(input);
      a.layoutOptions['elk.geometric.order'] = 'STABLE_ID';
      const b = structuredClone(a); b.children.reverse(); b.edges.reverse();
      assert.deepStrictEqual(metrics.geometry(await elk.layout(a)), metrics.geometry(await elk.layout(b)), input.id);
    }
  });

  it('rejects infeasible fixed bounds without returning clipped geometry', async () => {
    const g = fixture('star'); g.width = 20; g.height = 20;
    g.layoutOptions['elk.nodeSize.fixedGraphSize'] = 'true';
    await assert.rejects(elk.layout(g), /fixed graph size/);
  });

  it('supports a deep chain without recursive placement', async () => {
    const g = { id: 'chain', layoutOptions: { 'elk.algorithm': 'geometric', 'elk.geometric.mode': 'TREE' }, children: [], edges: [] };
    for (let i = 0; i < 2000; i++) {
      g.children.push({id: `n${i}`, width: 10, height: 10});
      if (i) g.edges.push({id: `e${i}`, sources: [`n${i-1}`], targets: [`n${i}`]});
    }
    const result = await elk.layout(g); metrics.containment(result);
  });

  for (const worker of ['elk-worker.js', 'elk-worker.min.js']) it(`runs geometric in ${worker}`, async () => {
    const Main = require('../../lib/main.js');
    const workerElk = new Main({algorithms: ['geometric'], workerUrl: `./lib/${worker}`});
    try { metrics.circular((await workerElk.layout(fixture('ring'))).children, 1e-5); }
    finally { workerElk.terminateWorker(); }
  });
});
