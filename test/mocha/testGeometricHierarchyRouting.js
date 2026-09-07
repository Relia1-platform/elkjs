/* SPDX-License-Identifier: EPL-2.0 OR GPL-3.0-or-later */
const assert=require('assert');
const ELK=require('../../lib/elk.bundled.js');
const {containment}=require('./geometryMetrics');

function fixture(){
  const children=Array.from({length:3},(_,i)=>({id:`a${i}`,width:40,height:30}));
  children[0].ports=[{id:'south',x:20,y:30,width:0,height:0,layoutOptions:{'elk.port.side':'SOUTH'}}];
  children[0].layoutOptions={'elk.portConstraints':'FIXED_POS'};
  return {id:'hierarchy-obstacle',layoutOptions:{'elk.algorithm':'geometric','elk.geometric.mode':'TREE','elk.direction':'RIGHT'},
    children:[{id:'group',layoutOptions:{'elk.geometric.mode':'TREE','elk.direction':'DOWN'},children,
      edges:[{id:'a01',sources:['a0'],targets:['a1']},{id:'a12',sources:['a1'],targets:['a2']}]},{id:'b',width:40,height:30}],
    edges:[{id:'cross',sources:['south'],targets:['b']}]};
}

function crosses(a,b,n){
  let low=0,high=1;
  for(const [axis,size] of [['x','width'],['y','height']]){
    const d=b[axis]-a[axis],min=n[axis]+1e-6,max=n[axis]+n[size]-1e-6;
    if(Math.abs(d)<1e-9){if(a[axis]<=min||a[axis]>=max)return false;}
    else{const p=(min-a[axis])/d,q=(max-a[axis])/d;low=Math.max(low,Math.min(p,q));high=Math.min(high,Math.max(p,q));if(low>=high)return false;}
  }
  return low<high;
}

async function verify(elk){
  const graph=await elk.layout(fixture());
  containment(graph);
  const group=graph.children[0];
  for(const section of graph.edges[0].sections){
    const points=[section.startPoint,...(section.bendPoints||[]),section.endPoint];
    for(const child of group.children){
      const obstacle={...child,x:child.x+group.x,y:child.y+group.y};
      for(let i=1;i<points.length;i++)assert(!crosses(points[i-1],points[i],obstacle),`cross edge traverses ${child.id}`);
    }
  }
}

describe('Geometric hierarchy corridors',function(){
  it('routes from an inward-facing fixed port around descendants before leaving its group',async()=>{
    await verify(new ELK({algorithms:['geometric']}));
  });
});
module.exports={fixture,verify};
