/* SPDX-License-Identifier: EPL-2.0 OR GPL-3.0-or-later */
// Run after JVM GeometricLayoutTest and a fresh npm run build.
const fs=require('fs');
const path=require('path');
const assert=require('assert');
const ELK=require('../lib/elk.bundled.js');
const fixtures=path.resolve(__dirname,'../../elk/test/geometry');
const results=path.resolve(process.argv[2]||path.join(__dirname,'../../elk/test/org.eclipse.elk.alg.geometric.test/target/geometric-results'));

function coordinates(graph){
  const values={};
  function shape(s,prefix){
    for(const key of ['x','y','width','height'])values[`${prefix}/${key}`]=s[key]||0;
    for(const label of s.labels||[])shape(label,`${prefix}/label:${label.id}`);
    for(const port of s.ports||[])shape(port,`${prefix}/port:${port.id}`);
    for(const child of s.children||[])shape(child,`${prefix}/node:${child.id}`);
    for(const edge of s.edges||[]){
      const ep=`${prefix}/edge:${edge.id}`;
      values[`${ep}/endpoints`]=JSON.stringify([edge.sources,edge.targets]);
      for(const label of edge.labels||[])shape(label,`${ep}/label:${label.id}`);
      for(const [index,section] of (edge.sections||[]).entries()){
        for(const [pi,p] of [section.startPoint,...(section.bendPoints||[]),section.endPoint].entries()){
          values[`${ep}/section:${index}/point:${pi}/x`]=p.x;
          values[`${ep}/section:${index}/point:${pi}/y`]=p.y;
        }
      }
    }
  }
  shape(graph,`node:${graph.id}`);
  return values;
}

async function main(){
  const elk=new ELK({algorithms:['geometric']});
  let maximumDifference=0,coordinateCount=0;
  const files=fs.readdirSync(fixtures).filter(p=>p.endsWith('.json')).sort();
  for(const file of files){
    const input=JSON.parse(fs.readFileSync(path.join(fixtures,file),'utf8'));
    const jvm=JSON.parse(fs.readFileSync(path.join(results,file),'utf8'));
    const js=await elk.layout(input),a=coordinates(jvm),b=coordinates(js);
    assert.deepStrictEqual(Object.keys(a).sort(),Object.keys(b).sort(),`${file}: geometry schema`);
    const epsilon=1e-6*Math.max(1,jvm.width,jvm.height,js.width,js.height);
    for(const key of Object.keys(a)){
      if(typeof a[key]==='string')assert.strictEqual(a[key],b[key],`${file}: ${key}`);
      else {const difference=Math.abs(a[key]-b[key]);assert(difference<=epsilon,`${file}: ${key}: ${a[key]} != ${b[key]}`);
        maximumDifference=Math.max(maximumDifference,difference);coordinateCount++;}
    }
  }
  console.log(JSON.stringify({fixtures:files.length,coordinateCount,maximumDifference},null,2));
}
main().catch(error=>{console.error(error);process.exitCode=1;});
