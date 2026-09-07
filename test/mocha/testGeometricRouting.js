/* SPDX-License-Identifier: EPL-2.0 OR GPL-3.0-or-later */
const assert = require('assert');
const ELK = require('../../lib/elk.bundled.js');
const { center, near, containment, clearance, epsilon, circular } = require('./geometryMetrics');
const elk = new ELK({ algorithms: ['geometric'] });
const node = id => ({ id, width: 40, height: 30 });
const edge = (a, b, id = `${a}-${b}`) => ({ id, sources: [a], targets: [b] });

function intersects(a, b, n) {
  let low = 0, high = 1;
  for (const [axis, size] of [['x', 'width'], ['y', 'height']]) {
    const d = b[axis] - a[axis], min = n[axis] + 1e-6, max = n[axis] + n[size] - 1e-6;
    if (Math.abs(d) < 1e-9) { if (a[axis] <= min || a[axis] >= max) return false; }
    else {
      const s = (min - a[axis]) / d, t = (max - a[axis]) / d;
      low = Math.max(low, Math.min(s, t)); high = Math.min(high, Math.max(s, t));
      if (low >= high) return false;
    }
  }
  return low < high;
}

function avoidsNodes(g) {
  for (const e of g.edges || []) for (const s of e.sections) {
    const points = [s.startPoint, ...(s.bendPoints || []), s.endPoint];
    for (let i = 1; i < points.length; i++) for (const n of g.children || []) {
      assert(!intersects(points[i-1], points[i], n), `${e.id} crosses ${n.id}`);
    }
  }
}

describe('Geometric routing and constraints', function () {
  this.timeout(30000);

  it('routes cross-links, parallel edges and self-loops around fixed nodes', async () => {
    const g = await elk.layout({ id: 'routing', layoutOptions: {'elk.algorithm': 'geometric', 'elk.geometric.mode': 'TREE'},
      children: ['r', 'a', 'b', 'c'].map(node),
      edges: [edge('r', 'a'), edge('r', 'b'), edge('r', 'c'), edge('a', 'c'), edge('a', 'c', 'parallel'), edge('b', 'b')]
    });
    containment(g); clearance(g, 20); avoidsNodes(g);
    assert(g.edges.find(e => e.id === 'a-c').sections[0].bendPoints.length >= 2);
    assert(g.edges.find(e => e.id === 'b-b').sections[0].bendPoints.length >= 2);
  });

  it('preserves fixed port positions and attaches routes exactly', async () => {
    const source = node('a'), target = node('b');
    source.layoutOptions = target.layoutOptions = { 'elk.portConstraints': 'FIXED_POS' };
    source.ports = [{id: 'ap', x: 40, y: 10, width: 0, height: 0, layoutOptions: {'elk.port.side': 'EAST'}}];
    target.ports = [{id: 'bp', x: 0, y: 10, width: 0, height: 0, layoutOptions: {'elk.port.side': 'WEST'}}];
    const g = await elk.layout({id: 'ports', layoutOptions: {'elk.algorithm': 'geometric', 'elk.geometric.mode': 'TREE', 'elk.direction': 'RIGHT'},
      children: [source, target], edges: [edge('ap', 'bp')]});
    const [a, b] = g.children, s = g.edges[0].sections[0];
    assert.equal(a.ports[0].x, 40); assert.equal(b.ports[0].x, 0);
    near(s.startPoint.x, a.x + 40, 1e-6, 'source x'); near(s.startPoint.y, a.y + 10, 1e-6, 'source y');
    near(s.endPoint.x, b.x, 1e-6, 'target x'); near(s.endPoint.y, b.y + 10, 1e-6, 'target y');
    containment(g); avoidsNodes(g);
  });

  it('includes outside labels and edge labels in bounds', async () => {
    const a = node('a'), b = node('b');
    a.labels = [{id: 'node-label', text: 'outside', width: 110, height: 15}];
    a.layoutOptions = {'elk.nodeLabels.placement': '[OUTSIDE,H_LEFT,V_TOP]'};
    const e = edge('a', 'b'); e.labels = [{id: 'edge-label', text: 'edge label', width: 130, height: 20}];
    const g = await elk.layout({id: 'labels', layoutOptions: {'elk.algorithm': 'geometric', 'elk.geometric.mode': 'TREE'}, children: [a,b], edges: [e]});
    containment(g);
    const l = g.edges[0].labels[0];
    for (const n of g.children) assert(!(l.x < n.x+n.width && l.x+l.width > n.x && l.y<n.y+n.height && l.y+l.height>n.y));
  });

  it('keeps declared hierarchy and nested endpoint coordinates', async () => {
    const a = {id: 'A', layoutOptions: {'elk.geometric.mode': 'TREE'}, children: [node('a1'),node('a2')], edges: [edge('a1','a2')]};
    const b = {id: 'B', layoutOptions: {'elk.geometric.mode': 'TREE'}, children: [node('b1'),node('b2')], edges: [edge('b1','b2')]};
    const g = await elk.layout({id: 'nested', layoutOptions: {'elk.algorithm':'geometric', 'elk.geometric.mode':'TREE', 'elk.direction':'RIGHT'},
      children: [a,b], edges: [edge('a2','b1')]});
    containment(g);
    assert.deepStrictEqual(g.children.map(n=>n.children.map(c=>c.id)), [['a1','a2'],['b1','b2']]);
    const s = g.edges[0].sections[0];
    const source = g.children[0].children[1], parent = g.children[0];
    const p = s.startPoint;
    const dx = p.x - parent.x - source.x, dy = p.y - parent.y - source.y;
    assert(dx >= -1e-6 && dx <= source.width+1e-6 && dy >= -1e-6 && dy <= source.height+1e-6, 'nested source anchor');
  });

  it('supports opt-in balanced placement on native algorithms', async () => {
    for (const algorithm of ['mrtree','radial']) {
      const g = await elk.layout({id:'native',layoutOptions:{'elk.algorithm':algorithm,[`elk.${algorithm}.nodePlacement`]:'BALANCED','elk.radial.centerOnRoot':'true'},
        children:['r','a','b','c'].map(node),edges:['a','b','c'].map(id=>edge('r',id))});
      containment(g); clearance(g,20);
      if(algorithm==='radial') circular(g.children.slice(1),epsilon(g),center(g.children[0]));
    }
  });

  it('constrains legacy Eades support edges to point outward', async () => {
    const g = {id:'eades',layoutOptions:{'elk.algorithm':'radial','elk.radial.radius':'100','elk.radial.compactor':'NONE','elk.radial.rotate':'false'}, children:['r','a','b'].map(node),edges:[edge('r','a'),edge('r','b')]};
    for(let i=0;i<12;i++){g.children.push(node(`c${i}`));g.edges.push(edge('a',`c${i}`));}
    const result = await elk.layout(g), r = center(result.children[0]), a = center(result.children[1]);
    for(const n of result.children.slice(3)){
      const c=center(n); assert((c.x-a.x)*(a.x-r.x)+(c.y-a.y)*(a.y-r.y)>=-1e-6,'edge goes inward');
    }
  });

  it('falls back with a log for spline requests', async () => {
    const g = await elk.layout({id:'fallback',layoutOptions:{'elk.algorithm':'geometric','elk.edgeRouting':'SPLINES'},children:[node('a'),node('b')],edges:[edge('a','b')]}, {logging:true});
    containment(g);
    assert(JSON.stringify(g.logging).includes('spline routing requested'));
  });
});
