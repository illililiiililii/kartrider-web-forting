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
if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--rho-root',type=Path,required=True);prepare(p.parse_args().rho_root)
