/* SPDX-License-Identifier: EPL-2.0 OR GPL-3.0-or-later */
const assert = require('assert');
const ELK = require('../../lib/elk.bundled.js');
const m = require('./geometryMetrics');
const elk = new ELK({algorithms:['geometric']});
const node = id => ({id,width:40,height:30});
const edge = (a,b,id=`${a}-${b}`) => ({id,sources:[a],targets:[b]});
const options = {'elk.algorithm':'geometric','elk.spacing.nodeNode':'24'};

describe('Geometric structural edge cases',function(){
  this.timeout(30000);
  for(const size of [0,1,2]) it(`handles a ring request with ${size} nodes`,async()=>{
    const children=Array.from({length:size},(_,i)=>node(`n${i}`));
    const g=await elk.layout({id:'small',layoutOptions:{...options,'elk.geometric.mode':'RING'},children,
      edges:size===2?[edge('n0','n1'),edge('n1','n0'),edge('n0','n0')]:[]});
    m.containment(g);m.clearance(g,24);
  });

  it('keeps a sparse chorded cycle on one ring in AUTO',async()=>{
    const g=await elk.layout({id:'chord',layoutOptions:options,children:Array.from({length:8},(_,i)=>node(`n${i}`)),
      edges:[...Array.from({length:8},(_,i)=>edge(`n${i}`,`n${(i+1)%8}`)),edge('n0','n4')]});
    m.circular(g.children,m.epsilon(g));m.containment(g);m.clearance(g,24);
  });

  it('keeps separate tree components clear in each direction',async()=>{
    for(const direction of ['DOWN','UP','LEFT','RIGHT']){
      const g=await elk.layout({id:'forest',layoutOptions:{...options,'elk.geometric.mode':'TREE','elk.direction':direction},
        children:['a','a1','a2','b','b1','isolated'].map(node),edges:[edge('a','a1'),edge('a','a2'),edge('b','b1')]});
      m.containment(g);m.clearance(g,24);
    }
  });

  it('preserves ring, tree and generic blocks in the same scope',async()=>{
    const children=['r0','r1','r2','r3','r4','t0','t1','t2','g0','g1','g2','g3','g4'].map(node);
    const edges=Array.from({length:5},(_,i)=>edge(`r${i}`,`r${(i+1)%5}`));
    edges.push(edge('r2','t0'),edge('t0','t1'),edge('t0','t2'),edge('t2','g0'));
    for(let i=0;i<5;i++)for(let j=i+1;j<5;j++)edges.push(edge(`g${i}`,`g${j}`));
    const g=await elk.layout({id:'mixed',layoutOptions:{...options,'elk.geometric.mode':'CLUSTER'},children,edges});
    m.circular(g.children.slice(0,5),m.epsilon(g));m.containment(g);m.clearance(g,24);
    assert.equal(g.children.length,children.length);assert.equal(g.edges.length,edges.length);
  });

  it('does not duplicate a shared articulation node',async()=>{
    const g=await elk.layout({id:'shared',layoutOptions:{...options,'elk.geometric.mode':'CLUSTER'},
      children:['x','a','b','c','d'].map(node),edges:[edge('x','a'),edge('a','b'),edge('b','x'),edge('x','c'),edge('c','d'),edge('d','x')]});
    assert.equal(new Set(g.children.map(n=>n.id)).size,5);assert.equal(g.edges.length,6);m.containment(g);m.clearance(g,24);
  });

  it('handles a high-degree ring with varied node sizes',async()=>{
    const children=Array.from({length:100},(_,i)=>({id:`n${i}`,width:20+i%5*13,height:15+i%7*7}));
    const g=await elk.layout({id:'large-ring',layoutOptions:{...options,'elk.geometric.mode':'RING'},children,
      edges:Array.from({length:100},(_,i)=>edge(`n${i}`,`n${(i+1)%100}`))});
    m.circular(g.children,m.epsilon(g));m.containment(g);m.clearance(g,24);
  });

  it('preserves interactive ring rotation when startAngle is unlocked',async()=>{
    const input={id:'interactive',layoutOptions:{...options,'elk.geometric.mode':'RING','elk.geometric.startAngle':'0.37'},
      children:Array.from({length:6},(_,i)=>node(`n${i}`)),edges:Array.from({length:6},(_,i)=>edge(`n${i}`,`n${(i+1)%6}`))};
    const first=await elk.layout(input);delete first.layoutOptions['elk.geometric.startAngle'];first.layoutOptions['elk.interactive']='true';
    const second=await elk.layout(first);const a=m.circular(first.children,m.epsilon(first)),b=m.circular(second.children,m.epsilon(second));
    const p=m.center(first.children[0]),q=m.center(second.children[0]);
    m.near(Math.atan2(p.y-a.center.y,p.x-a.center.x),Math.atan2(q.y-b.center.y,q.x-b.center.x),1e-6,'rotation');
  });

  it('honors a root hint even when incoming edges point toward it',async()=>{
    const children=['a','b','c','r'].map(node);children[3].layoutOptions={'elk.geometric.root':'true'};
    const g=await elk.layout({id:'root',layoutOptions:options,children,edges:['a','b','c'].map(n=>edge(n,'r'))});
    const root=m.center(g.children[3]);m.near(root.x,g.width/2,m.epsilon(g),'root x');m.near(root.y,g.height/2,m.epsilon(g),'root y');
    assert(g.edges.every(e=>e.targets[0]==='r'));
  });
});
