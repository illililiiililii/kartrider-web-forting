// Original XML layout/atlases. EX remains idle: the recovered C demo has no
// V1 exceed simulation. Never feed its decoration from the unrelated N2O gauge.
export async function mountV1Dashboard(container) {
  const response=await fetch('./assets/ui/v1-dashboard.json',{cache:'no-store'});
  if(!response.ok)return;
  const data=await response.json(), base='./assets/ui/gui/tachometer/v1_exceed/';
  container.style.backgroundImage=`url('${base}tacho_v1_baseBG_1.png')`;
  container.dataset.source=data.source;
  const anchor={x:(291-data.window[0])/2,y:125-data.window[1]};
  for(const [name,panel] of Object.entries(data.panels)){
    const image=document.createElement('img');image.src=base+panel.texture+'.png';image.alt='';image.className='v1-detail';
    const exceed=['icnExceed','keyX','keySpace'].includes(name);
    image.style.left=`${anchor.x+panel.position[0]-(exceed?18:0)}px`;
    image.style.top=`${anchor.y+panel.position[1]-(exceed?7:0)}px`;
    if(name==='n2o')image.id='v1-boost-icon';
    if(name==='keyX'||name==='keySpace')image.title='원본 EX 키 안내 (EX 기능 대기)';
    container.append(image);
  }
  const ex=document.createElement('img');ex.src=base+'tacho_v1_exeedBoosterBG.png';ex.className='v1-ex-rail';ex.alt='EX (원본 C 데모 미지원)';container.append(ex);
  const speed=container.querySelector('#speed');speed.dataset.fontWidth=data.font.size[0];speed.dataset.fontHeight=data.font.size[1];
  speed.style.top=`${anchor.y+data.font.rect[1]}px`;speed.style.bottom='auto';speed.style.height=data.font.size[1]+'px';
}
