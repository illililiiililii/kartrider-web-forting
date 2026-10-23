import * as THREE from './vendor/three.module.js';

export const boostLabel = kind => ['','부스터','출발 부스터','순간 부스터'][kind] || '';
export function skidSegment(previous, point, width=0.22) {
  const dx=point[0]-previous[0], dz=point[2]-previous[2], length=Math.hypot(dx,dz);
  if (length<0.04 || length>4 || Math.abs(point[1]-previous[1])>1) return null;
  const x=-dz/length*width/2,z=dx/length*width/2;
  const a=[previous[0]+x,previous[1]+.025,previous[2]+z],b=[previous[0]-x,previous[1]+.025,previous[2]-z];
  const c=[point[0]+x,point[1]+.025,point[2]+z],d=[point[0]-x,point[1]+.025,point[2]-z];
  return [...a,...b,...c,...c,...b,...d];
}

export function createRaceEffects(renderer,scene,kart) {
  const loader=new THREE.TextureLoader();
  const texture=path=>{const t=loader.load('./assets/effects/'+path);t.colorSpace=THREE.SRGBColorSpace;return t;};
  const fire=texture('effect/booster/10main/10Fire01.png');
  const flare=texture('effect/boosterFlare/cotton6/6buster001.png');
  const instant=texture('effect/boosterWave/8Flashbooster_05.png');
  const wave=texture('effect/boosterWave/9wave01.png');
  const group=new THREE.Group();kart.add(group);
  const jets=[],glows=[];
  for(const side of [-.55,.55]) {
    const material=new THREE.MeshBasicMaterial({map:fire,transparent:true,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending});
    for(const angle of [0,Math.PI/2]) {
      const jet=new THREE.Mesh(new THREE.PlaneGeometry(1,1),material);
      // Original fire image points down its V axis; mount that axis rearwards.
      jet.rotation.z=-Math.PI/2;jet.rotation.x=angle;
      jet.position.set(-2.2,.55,side);group.add(jet);jets.push(jet);
    }
    const glow=new THREE.Sprite(new THREE.SpriteMaterial({map:flare,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending}));
    glow.position.set(-1.15,.6,side);group.add(glow);glows.push(glow);
  }
  const ring=new THREE.Sprite(new THREE.SpriteMaterial({map:wave,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending}));
  ring.position.set(-1.2,.6,0);group.add(ring);
  const capacity=1024, positions=new Float32Array(capacity*18);
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(positions,3).setUsage(THREE.DynamicDrawUsage));geometry.setDrawRange(0,0);
  const marks=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({color:0x15151b,transparent:true,opacity:.52,depthWrite:false,side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:-1}));
  marks.frustumCulled=false;scene.add(marks);
  let cursor=0,count=0,previous=[null,null],lastKind=0,burst=0,blurEnabled=true;
  const target=new THREE.WebGLRenderTarget(1,1);
  const mask=loader.load('./assets/effects/effect/boosterBlur/blurMask.png');
  const uniforms={image:{value:target.texture},mask:{value:mask},strength:{value:0}};
  const post=new THREE.Mesh(new THREE.PlaneGeometry(2,2),new THREE.ShaderMaterial({depthTest:false,depthWrite:false,uniforms,
    vertexShader:'varying vec2 uv0;void main(){uv0=uv;gl_Position=vec4(position.xy,0.,1.);}',
    fragmentShader:`uniform sampler2D image;uniform sampler2D mask;uniform float strength;varying vec2 uv0;
      void main(){vec2 delta=(uv0-.5)*strength*texture2D(mask,uv0).r;vec4 sum=vec4(0.);
      for(int i=0;i<6;i++)sum+=texture2D(image,clamp(uv0-delta*float(i)/5.,vec2(0.),vec2(1.)));
      gl_FragColor=sum/6.;#include <tonemapping_fragment>
      #include <colorspace_fragment>
      }`.replace(';#include',';\n#include')}));
  const postScene=new THREE.Scene();postScene.add(post);const postCamera=new THREE.Camera();
  function clear() {previous=[null,null];cursor=count=0;geometry.setDrawRange(0,0);lastKind=0;burst=0;}
  return {
    clear,
    mountKart(bounds,scale) {
      group.position.x=bounds.min.x*scale+1.15;
      group.position.y=(bounds.max.y-bounds.min.y)*scale*.3-.6;
    },
    setBlurEnabled(value){blurEnabled=Boolean(value);},
    update(state,elapsed,active) {
      marks.visible=active;
      const kind=active?Math.round(state[48]||0):0;
      if(kind && kind!==lastKind)burst=.35;
      burst=Math.max(0,burst-elapsed/1000);lastKind=kind;group.visible=kind>0;
      const pulse=1+Math.sin((state[10]||0)*55)*.08;
      for(const jet of jets){jet.material.map=kind===3?instant:fire;jet.scale.set(kind===3?1.1:1.35,(kind===2?2.5:kind===3?1.8:3.2)*pulse,1);}
      for(const glow of glows){glow.material.map=kind===3?instant:flare;glow.scale.setScalar((kind===2?1.8:kind===3?.9:1.3)*pulse);}
      ring.visible=burst>0;ring.scale.setScalar(1+(1-burst/.35)*6);ring.material.opacity=burst/.35;
      for(let rear=0;rear<2;rear++) {
        const offset=49+rear*4;
        if(!active || !state[9] || !state[47] || !state[offset+3] || state[6]<2){previous[rear]=null;continue;}
        const point=[state[offset],state[offset+2],-state[offset+1]];
        if(previous[rear]) {
          const segment=skidSegment(previous[rear],point);
          if(segment){positions.set(segment,cursor*18);cursor=(cursor+1)%capacity;count=Math.min(capacity,count+1);geometry.attributes.position.needsUpdate=true;geometry.setDrawRange(0,count*6);}
          else if(Math.hypot(...point.map((v,i)=>v-previous[rear][i]))<.04)continue;
        }
        previous[rear]=point;
      }
      uniforms.strength.value=kind && blurEnabled?.035:0;
    },
    render(camera) {
      if(!uniforms.strength.value){renderer.render(scene,camera);return;}
      const size=renderer.getDrawingBufferSize(new THREE.Vector2());
      if(target.width!==size.x||target.height!==size.y)target.setSize(size.x,size.y);
      renderer.setRenderTarget(target);renderer.render(scene,camera);renderer.setRenderTarget(null);renderer.render(postScene,postCamera);
    },
  };
}
