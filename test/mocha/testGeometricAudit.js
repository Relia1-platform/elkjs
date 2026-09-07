/* SPDX-License-Identifier: EPL-2.0 OR GPL-3.0-or-later */
const assert = require('assert');
const ELK = require('../../lib/elk.bundled.js');
const m = require('./geometryMetrics');
const elk = new ELK({algorithms:['geometric']});
const clone = value => JSON.parse(JSON.stringify(value));

// Liang–Barsky clipping against the open interior, independent of the production router.
function crosses(a, b, node) {
  const e=1e-6, lo=[node.x+e,node.y+e], hi=[node.x+node.width-e,node.y+node.height-e];
  let enter=0, leave=1;
  for (const [index,key] of ['x','y'].entries()) {
    const delta=b[key]-a[key];
    if (Math.abs(delta)<1e-12) { if (a[key]<=lo[index] || a[key]>=hi[index]) return false; }
    else { const p=(lo[index]-a[key])/delta,q=(hi[index]-a[key])/delta;
      enter=Math.max(enter,Math.min(p,q));leave=Math.min(leave,Math.max(p,q)); }
  }
  return enter<leave;
}

describe('Geometric independent invariant audit', function() {
  this.timeout(30000);
  for (const mode of ['TREE','RADIAL','RING','CLUSTER','AUTO']) {
    it(`${mode}: preserves data and avoids node obstacles on seeded cyclic graphs`,async()=>{
      for(let seed=1;seed<=8;seed++) {
        let state=seed;
        const random=()=>((state=Math.imul(state,1664525)+1013904223>>>0)/4294967296);
        const n=12+seed*2, children=Array.from({length:n},(_,i)=>({id:`n${i}`,width:10+Math.floor(random()*90),height:10+Math.floor(random()*60)}));
        const edges=[];
        const add=(a,b)=>edges.push({id:`e${edges.length}`,sources:[`n${a}`],targets:[`n${b}`]});
        for(let i=1;i<n;i++)add(Math.floor(random()*i),i);
        for(let i=0;i<n/2;i++)add(Math.floor(random()*n),Math.floor(random()*n));
        const input={id:`${mode}-${seed}`,layoutOptions:{'elk.algorithm':'geometric','elk.geometric.mode':mode,'elk.spacing.nodeNode':'24','elk.geometric.order':'STABLE_ID'},children,edges};
        const result=await elk.layout(clone(input));
        m.containment(result);m.clearance(result,24);
        assert.deepStrictEqual(result.edges.map(e=>[e.id,e.sources,e.targets]),input.edges.map(e=>[e.id,e.sources,e.targets]));
        for(const edge of result.edges)for(const s of edge.sections){
          const points=[s.startPoint,...(s.bendPoints||[]),s.endPoint];
          for(let i=1;i<points.length;i++)for(const node of result.children)
            assert(!crosses(points[i-1],points[i],node),`${input.id}: ${edge.id} crosses ${node.id}`);
        }
        const permuted=clone(input);permuted.children.reverse();permuted.edges.reverse();
        assert.deepStrictEqual(m.geometry(await elk.layout(permuted)),m.geometry(result),`${input.id}: permutation`);
      }
    });
  }

  it('rejects infeasible fixed dimensions even when routing falls back to layered',async()=>{
    await assert.rejects(elk.layout({id:'fixed',width:10,height:10,
      layoutOptions:{'elk.algorithm':'geometric','elk.edgeRouting':'SPLINES','elk.nodeSize.fixedGraphSize':'true'},
      children:[{id:'a',width:60,height:40},{id:'b',width:60,height:40}],
      edges:[{id:'ab',sources:['a'],targets:['b']}]}),/fixed graph size/i);
  });

  it('fits interactive rotation to surviving positions when new nodes have no coordinates',async()=>{
    const count=5, angle=.43;
    const children=Array.from({length:count},(_,i)=>({id:`n${i}`,width:40,height:30,
      x:10000+200*Math.cos(angle+2*Math.PI*i/(count+1))-20,
      y:5000+200*Math.sin(angle+2*Math.PI*i/(count+1))-15}));
    children.push({id:'new',width:40,height:30});
    const ids=children.map(n=>n.id), edges=ids.map((id,i)=>({id:`e${i}`,sources:[id],targets:[ids[(i+1)%ids.length]]}));
    const g=await elk.layout({id:'interactive-add',layoutOptions:{'elk.algorithm':'geometric','elk.geometric.mode':'RING','elk.interactive':'true'},children,edges});
    const circle=m.circular(g.children,m.epsilon(g)),p=m.center(g.children[0]);
    m.near(Math.atan2(p.y-circle.center.y,p.x-circle.center.x),angle,1e-6,'survivor rotation');
  });
});
