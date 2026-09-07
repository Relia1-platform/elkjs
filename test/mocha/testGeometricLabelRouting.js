/* SPDX-License-Identifier: EPL-2.0 OR GPL-3.0-or-later */
const assert=require('assert');
const ELK=require('../../lib/elk.bundled.js');
const {containment}=require('./geometryMetrics');

describe('Geometric label corridors',function(){
  const elk=new ELK({algorithms:['geometric']});
  for(const direction of ['DOWN','RIGHT'])it(`puts a wide edge label beside a sufficient segment in ${direction}`,async()=>{
    const g=await elk.layout({id:'wide-label',layoutOptions:{'elk.algorithm':'geometric','elk.geometric.mode':'TREE','elk.direction':direction},
      children:[{id:'a',width:40,height:30},{id:'b',width:40,height:30}],
      edges:[{id:'ab',sources:['a'],targets:['b'],labels:[{id:'caption',text:'wide label',width:180,height:20}]}]});
    containment(g);
    const e=g.edges[0],l=e.labels[0],cx=l.x+l.width/2,cy=l.y+l.height/2;
    let fits=false;
    for(const s of e.sections){const points=[s.startPoint,...(s.bendPoints||[]),s.endPoint];
      for(let i=1;i<points.length;i++){
        const a=points[i-1],b=points[i],length=Math.hypot(b.x-a.x,b.y-a.y);
        if(!length)continue;
        const ux=(b.x-a.x)/length,uy=(b.y-a.y)/length,projection=(cx-a.x)*ux+(cy-a.y)*uy;
        const half=(Math.abs(ux)*l.width+Math.abs(uy)*l.height)/2;
        const distance=Math.abs((cx-a.x)*uy-(cy-a.y)*ux);
        const normalHalf=(Math.abs(uy)*l.width+Math.abs(ux)*l.height)/2;
        if(projection>=half-1e-6&&projection<=length-half+1e-6&&distance<=normalHalf+8)fits=true;
      }
    }
    assert(fits,'label must remain adjacent to a segment that can hold its projection');
  });
});
