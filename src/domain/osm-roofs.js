// Roof geometry is generated exclusively from the preserved OSM polygon and roof tags.
// No guessed roof shapes are applied to untagged buildings.
import earcut from 'earcut'
import polygonClipping from 'polygon-clipping'
import maplibregl from './maplibre.js'

export const ROOF_LAYER = 'settld-osm-roofs'
export const ROOF_ZOOM = 15
export const ROOF_TYPES = ['gabled','hipped','half-hipped','pyramidal','skillion','dome','cone','onion','round','gambrel','mansard','saltbox']
export const mappedRoof = ['all', ['>', ['get','roof_height'], 0], ['in', ['get','roof_shape'], ['literal', ROOF_TYPES]]]
const origin = maplibregl.MercatorCoordinate.fromLngLat([-6.2603,53.3498])
const scale = origin.meterInMercatorCoordinateUnits()
const clamp = (x) => Math.min(1,Math.max(0,x))
const mid = (a,b) => [(a[0]+b[0])/2,(a[1]+b[1])/2]
const len = (a,b) => Math.hypot(a[0]-b[0],a[1]-b[1])
const local = (c) => { const p=maplibregl.MercatorCoordinate.fromLngLat(c); return [(p.x-origin.x)/scale,(p.y-origin.y)/scale] }

function color(value, fallback) {
  const c=String(value||'').trim(); const match=/^#?([\da-f]{6})$/i.exec(c)
  if (!match) return fallback
  const n=parseInt(match[1],16); return [(n>>16)/255,((n>>8)&255)/255,(n&255)/255].map((v,i)=>fallback[i]*.68+v*.32)
}

// Fit an oriented box to the actual footprint rather than its longitude/latitude bounds.
function axisFor(ring, orientation) {
  let best=null
  for (let i=1;i<ring.length;i++) {
    const a=ring[i-1],b=ring[i],d=len(a,b); if (d<.1) continue
    const x=(b[0]-a[0])/d,y=(b[1]-a[1])/d; let u0=Infinity,u1=-Infinity,v0=Infinity,v1=-Infinity
    for (const p of ring) { const u=x*p[0]+y*p[1],v=-y*p[0]+x*p[1]; u0=Math.min(u0,u);u1=Math.max(u1,u);v0=Math.min(v0,v);v1=Math.max(v1,v) }
    const area=(u1-u0)*(v1-v0)
    if (!best||area<best.area) best={x,y,u0,u1,v0,v1,area}
  }
  if (!best) return null
  const {x,y,u0,u1,v0,v1}=best
  const swap=(u1-u0 < v1-v0)!==(orientation==='across')
  return swap?{x:-y,y:x,u0:v0,u1:v1,v0:-u1,v1:-u0}:best
}

function profile(axis, props) {
  const {x,y,u0,u1,v0,v1}=axis, width=Math.max(.1,(v1-v0)/2),length=Math.max(.1,(u1-u0)/2), uc=(u0+u1)/2,vc=(v0+v1)/2
  const shape=props.roof_shape, eave=+props.eave, h=+props.roof_height
  const compass={N:0,NE:45,E:90,SE:135,S:180,SW:225,W:270,NW:315}
  const direction=props.roof_direction in compass?compass[props.roof_direction]:Number(props.roof_direction)
  return (p) => {
    const u=x*p[0]+y*p[1],v=-y*p[0]+x*p[1],a=Math.abs((u-uc)/length),b=Math.abs((v-vc)/width)
    let z=1-b
    switch(shape) {
      case 'hipped': z=Math.min(1-b,(1-a)*length/width);break
      case 'half-hipped': z=Math.min(1-b,.5+(1-a)*length/width);break
      case 'pyramidal': z=1-Math.max(a,b);break
      case 'skillion': {
        if (Number.isFinite(direction)) {
          const r=direction*Math.PI/180,du=Math.sin(r)*x-Math.cos(r)*y,dv=-Math.sin(r)*y-Math.cos(r)*x
          z=.5-((u-uc)*du+(v-vc)*dv)/(2*(Math.abs(du)*length+Math.abs(dv)*width||1))
        } else z=(v-v0)/(v1-v0||1)
        break
      }
      case 'dome': z=Math.sqrt(Math.max(0,1-a*a-b*b));break
      case 'onion': z=Math.pow(Math.sqrt(Math.max(0,1-a*a-b*b)),.65);break
      case 'cone': z=1-Math.sqrt(a*a+b*b);break
      case 'round': z=Math.sqrt(Math.max(0,1-b*b));break
      case 'gambrel': z=b>.5?1.45*(1-b):1-.55*b;break
      case 'mansard': z=Math.min(1,Math.min((1-a)*length/width,1-b)*2.4);break
      case 'saltbox': z=v<vc?1-b:Math.max(0,1-b*.9);break
    }
    return eave+h*clamp(z)
  }
}

function makeRoof(geometry, props, vertices) {
  const polygons=geometry.type==='Polygon'?[geometry.coordinates]:geometry.type==='MultiPolygon'?geometry.coordinates:[]
  const roofColor=color(props.roof_colour,[.57,.58,.56]),wallColor=color(props.building_colour,[.79,.77,.72]),eave=+props.eave
  function tri(a,b,c,tint) {
    const u=b.map((x,i)=>x-a[i]),v=c.map((x,i)=>x-a[i]); const n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];const m=Math.hypot(...n)
    if (m<.0001) return
    const light=Math.min(1,Math.max(.56,.78+.25*(-.5*n[0]-.5*n[1]+.7*Math.abs(n[2]))/m)); const rgb=tint.map(x=>x*light)
    for(const p of [a,b,c]) vertices.push(...p,...rgb)
  }
  for(const polygon of polygons) {
    const rings=polygon.map(r=>r.slice(0,-1).map(local)).filter(r=>r.length>=3)
    if(!rings.length) continue
    const axis=axisFor([...rings[0],rings[0][0]],props.roof_orientation); if(!axis) continue
    const height=profile(axis,props),flat=[],pts=[],holes=[]
    for(let i=0;i<rings.length;i++){if(i)holes.push(pts.length); for(const p of rings[i]){pts.push(p);flat.push(...p)}}
    const ids=earcut(flat,holes,2),top=p=>[p[0],p[1],height(p)]
    // Subdivide real roof polygons, not the surrounding terrain. This captures
    // ridges and curved roofs while preserving the exact outer/inner rings.
    const curved=['dome','onion','round','cone'].includes(props.roof_shape)
    function face(a,b,c,depth) {
      if(depth<(curved?4:3) && Math.max(len(a,b),len(b,c),len(c,a))>(curved?1.0:3.5)){const ab=mid(a,b),bc=mid(b,c),ca=mid(c,a);face(a,ab,ca,depth+1);face(ab,b,bc,depth+1);face(ca,bc,c,depth+1);face(ab,bc,ca,depth+1)}
      else tri(top(a),top(b),top(c),roofColor)
    }
    for(let i=0;i<ids.length;i+=3)face(pts[ids[i]],pts[ids[i+1]],pts[ids[i+2]],0)
    for(const ring of rings)for(let i=0;i<ring.length;i++){
      const a=ring[i],b=ring[(i+1)%ring.length],steps=Math.max(1,Math.min(16,Math.ceil(len(a,b)/2)))
      for(let j=0;j<steps;j++){const p=a.map((x,k)=>x+(b[k]-x)*j/steps),q=a.map((x,k)=>x+(b[k]-x)*(j+1)/steps); const p0=[...p,eave],q0=[...q,eave];tri(p0,q0,top(q),wallColor);tri(p0,top(q),top(p),wallColor)}
    }
  }
}

export function osmRoofLayer(source) {
  let map,gl,program,vao,buffer,position,colour,matrix,count=0,dirty=true,active=true
  const invalidate=e=>{if(!e?.sourceId||e.sourceId===source){dirty=true;map.triggerRepaint()}}
  function shader(type,s){const sh=gl.createShader(type);gl.shaderSource(sh,s);gl.compileShader(sh);if(!gl.getShaderParameter(sh,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(sh));return sh}
  function rebuild(){
    const features=map.querySourceFeatures(source,{sourceLayer:'buildings',filter:['all',['==',['get','render'],1],mappedRoof]});const groups=new Map(),verts=[]
    for(const f of features){const key=String(f.id??f.properties.osm_id);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(f)}
    for(const parts of groups.values()){
      let geometry=parts[0].geometry
      // Vector tiles clip shapes at their edges. Rejoin overlapping roof
      // fragments so a ridge does not reset at a tile border.
      if(parts.length>1){try{const polys=parts.map(f=>f.geometry.type==='Polygon'?[f.geometry.coordinates]:f.geometry.coordinates);geometry={type:'MultiPolygon',coordinates:polygonClipping.union(...polys)}}catch{}}
      makeRoof(geometry,parts[0].properties,verts)
    }
    gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(verts),gl.STATIC_DRAW);count=verts.length/6
  }
  return {id:ROOF_LAYER,type:'custom',renderingMode:'3d',onAdd(m,g){
    map=m;gl=g;const v=shader(gl.VERTEX_SHADER,`#version 300 es\nin vec3 pos;in vec3 tint;uniform mat4 transform;out vec3 color;void main(){gl_Position=transform*vec4(pos,1.0);color=tint;}`),f=shader(gl.FRAGMENT_SHADER,`#version 300 es\nprecision mediump float;in vec3 color;out vec4 frag;void main(){frag=vec4(color,1.0);}`);program=gl.createProgram();gl.attachShader(program,v);gl.attachShader(program,f);gl.linkProgram(program);gl.deleteShader(v);gl.deleteShader(f);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(program));position=gl.getAttribLocation(program,'pos');colour=gl.getAttribLocation(program,'tint');matrix=gl.getUniformLocation(program,'transform');vao=gl.createVertexArray();buffer=gl.createBuffer();map.on('sourcedata',invalidate);map.on('moveend',invalidate)
  },render(g,args){
    if(!active||map.getZoom()<ROOF_ZOOM)return
    if(dirty){dirty=false;try{rebuild()}catch(e){console.warn('Settld roof rendering:',e.message);count=0}}
    if(!count)return
    const a=args.defaultProjectionData.mainMatrix,out=new Float32Array(16)
    for(let i=0;i<4;i++){out[i]=a[i]*scale;out[i+4]=a[i+4]*scale;out[i+8]=a[i+8]*scale;out[i+12]=a[i]*origin.x+a[i+4]*origin.y+a[i+8]*origin.z+a[i+12]}
    gl.useProgram(program);gl.bindVertexArray(vao);gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.enableVertexAttribArray(position);gl.vertexAttribPointer(position,3,gl.FLOAT,false,24,0);gl.enableVertexAttribArray(colour);gl.vertexAttribPointer(colour,3,gl.FLOAT,false,24,12);gl.uniformMatrix4fv(matrix,false,out);gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.depthMask(true);gl.disable(gl.CULL_FACE);gl.disable(gl.BLEND);gl.drawArrays(gl.TRIANGLES,0,count);gl.bindVertexArray(null);gl.bindBuffer(gl.ARRAY_BUFFER,null)
  },onRemove(){active=false;map.off('sourcedata',invalidate);map.off('moveend',invalidate);gl.deleteBuffer(buffer);gl.deleteVertexArray(vao);gl.deleteProgram(program)}}
}
