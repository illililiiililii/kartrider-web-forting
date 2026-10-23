"""Use original action XML rectangles/timing, without recreating lap lettering."""
import argparse,json,shutil,xml.etree.ElementTree as ET
from pathlib import Path
from local_asset_paths import ROOT,resource_file

def prepare(rho):
    relative='stage/speedIndiGame';xml=resource_file(rho,relative+'/action2d@zz.xml')
    notices={};target=ROOT/'web-preview/assets/ui'/relative;target.mkdir(parents=True,exist_ok=True)
    for control in ET.parse(xml).getroot().iter('ControlWindow'):
        key=control.get('name','').split('@')[0]
        if key not in ['finallap','2lap','3lap','4lap','5lap']:continue
        panel=control.find('TonPanel');filename=panel.get('texture')+'.png';image=resource_file(rho,relative+'/'+filename)
        shutil.copy2(image,target/filename)
        notices[key]={'image':relative+'/'+filename,'rect':[int(v) for v in panel.get('uvRect').split()],
            'adjust':[int(v) for v in panel.get('adjust').split()],
            'fadeIn':int(control.get('fadeInLength')),'hold':int(control.get('showLength')),'fadeOut':int(control.get('fadeOutLength'))}
    output=ROOT/'web-preview/assets/ui/lap-notices.json';output.write_text(json.dumps(notices,ensure_ascii=False),encoding='utf-8')
    print('Prepared original XML lap panels:',len(notices))
    # The reference uses the exceed V1 dashboard, not the older V1 layout.
    relative='gui/tachometer/v1_exceed';folder=ROOT/'web-preview/assets/ui'/relative;folder.mkdir(parents=True,exist_ok=True)
    xml=ET.parse(resource_file(rho,relative+'/tacho.xml')).getroot();dashboard=xml.find('./Window[@name="dashboard"]')
    names=['baseBG_1','exeedBoosterBG','exeedIcon_1','keySpace_1','keyX_1','icon_boost_01','icon_boost_02','icon_Auto_1','icon_draft_1','number_1','soloBoosterBG','soloBooster_1']
    for name in names:
        name='tacho_v1_'+name+'.png';shutil.copy2(resource_file(rho,relative+'/'+name),folder/name)
    panels={}
    for name in ['n2o','draft']:
        panel=dashboard.find('./Panel[@name="'+name+'"]');panels[name]={'texture':panel.get('texture'),'position':[int(v) for v in panel.get('leftTopTex').split()]}
    auto=dashboard.find('./Container[@name="collisionFeatures"]/Panel[@name="incGauge"]');panels['auto']={'texture':auto.get('texture'),'position':[int(v) for v in auto.get('leftTopTex').split()]}
    for panel in dashboard.findall('./Container[@name="exceedFeatures"]/Window[@name="idling"]/Panel'):
        panels[panel.get('name')]={'texture':panel.get('texture'),'position':[int(v) for v in panel.get('leftTopTex').split()]}
    font=dashboard.find('./CharPanel[@name="kmh"]')
    data={'source':relative+'/tacho.xml','window':[200,74],'panels':panels,'font':{'size':[int(v) for v in font.get('fontSize').split()],'rect':[int(v) for v in font.get('leftTopWH').split()],'characters':font.get('fontStr'),'spacing':int(font.get('spaceOffset'))},'exceedAvailable':False}
    (ROOT/'web-preview/assets/ui/v1-dashboard.json').write_text(json.dumps(data),encoding='utf-8')
if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--rho-root',type=Path,required=True);prepare(p.parse_args().rho_root)
