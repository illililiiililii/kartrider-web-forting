// Original XML layout/atlases. EX reads its own C adapter telemetry, never N2O.
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
    if(exceed)image.dataset.exceedPanel=name;
    if(name==='keyX'||name==='keySpace')image.title='익시드: SPACE / X';
    container.append(image);
  }
  const ex=document.createElement('img');ex.src=base+'tacho_v1_exeedBoosterBG.png';ex.className='v1-ex-rail';ex.alt='EX';container.append(ex);
  const fill=document.createElement('div');fill.className='v1-ex-fill';fill.id='v1-ex-fill';container.append(fill);
  const speed=container.querySelector('#speed');speed.dataset.fontWidth=data.font.size[0];speed.dataset.fontHeight=data.font.size[1];
  speed.style.top=`${anchor.y+data.font.rect[1]}px`;speed.style.bottom='auto';speed.style.height=data.font.size[1]+'px';
}

export function updateExceedDashboard(container,state){
  const fill=container.querySelector('#v1-ex-fill');if(!fill)return;
  const enabled=Boolean(state[61]),active=Boolean(state[58]),usable=enabled&&!state[59]&&state[57]>=state[60];
  fill.style.width=`${142*Math.max(0,Math.min(1,state[57]||0))}px`;
  fill.style.backgroundImage=`url('./assets/ui/gui/tachometer/v1_exceed/tacho_v1_exeedBooster_${active?2:usable?3:1}.png')`;
  fill.setAttribute('aria-label',`익시드 ${Math.round((state[57]||0)*100)}% · ${active?'사용 중':state[59]>0?'재사용 대기':usable?'사용 가능':'충전 중'}`);
  for(const image of container.querySelectorAll('[data-exceed-panel]')){
    const name=image.dataset.exceedPanel;
    image.style.opacity=enabled?'1':'.4';
    image.src=`./assets/ui/gui/tachometer/v1_exceed/tacho_v1_${name==='icnExceed'?'exeedIcon':name}_${usable||active?2:1}.png`;
  }
}
