/* SPDX-License-Identifier: EPL-2.0 OR GPL-3.0-or-later */
const assert=require('assert');
const ELK=require('../../lib/elk.bundled.js');
describe('Geometric reuse of a prior JSON result',function(){
  it('removes stale junction points when a prior route is replaced',async()=>{
    const graph=await new ELK({algorithms:['geometric']}).layout({id:'old',layoutOptions:{'elk.algorithm':'geometric'},
      children:[{id:'a',width:40,height:30},{id:'b',width:40,height:30}],
      edges:[{id:'ab',sources:['a'],targets:['b'],junctionPoints:[{x:100000,y:100000}]}]});
    assert(!graph.edges[0].junctionPoints || graph.edges[0].junctionPoints.length===0);
  });
});
