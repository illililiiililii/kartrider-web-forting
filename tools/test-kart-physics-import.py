"""Independent final client-log oracle: fields include EX ms and start-force offset."""
import importlib.util,re,unittest
from pathlib import Path

path=Path(__file__).with_name('prepare-local-kart-physics.py')
spec=importlib.util.spec_from_file_location('physics_import',path)
module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
base=Path.home()/'Documents/kart web'

class ImportTests(unittest.TestCase):
 @unittest.skipUnless((base/'P5136_Rust-main').exists(),'local reference source missing')
 def test_final_korean_s1_logs(self):
  speed,rules,_=module.source_tables(base/'P5136_Rust-main')
  import xml.etree.ElementTree as ET
  for name,id in [('whiteKnightV1',1440),('saberV1',1364),('practiceV1',0),('cottonV1',1336)]:
   source=base/'kartrider_5136/E/_rho5Out/kart_'/name/'param@kr.xml'
   if not source.exists():source=source.with_name('param.xml')
   actual=module.project(ET.parse(source).getroot().attrib,speed,rules)
   text=(base/f'kartrider_5136/Profile/KartSpac.kr/Speed_00/kr.Kart_{id}.txt').read_text(encoding='utf-8-sig')
   oracle={k:float(v) for k,v in re.findall(r'Kart\.(\w+)\s*=\s*(-?[\d.]+)f?;',text)}
   keys=set(oracle)&set(actual)
   self.assertGreaterEqual(len(keys),50)
   for key in keys:self.assertAlmostEqual(actual[key],oracle[key],delta=.001,msg=name+'/'+key)

if __name__=='__main__':unittest.main()
