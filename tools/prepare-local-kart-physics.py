"""Read Korean BodyParam XML and the pinned P5136_Rust stock composition.

The checked-in numeric snapshot works without an external Rust checkout.
These are stock, untuned parameters, NOT the closed 5136 client integrator.
"""
import argparse, hashlib, json, re, xml.etree.ElementTree as ET
from decimal import Decimal
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
FIELDS = ['Mass','AirFriction','DragFactor','ForwardAccelForce','BackwardAccelForce',
          'GripBrakeForce','SlipBrakeForce','MaxSteerAngle','SteerConstraint',
          'FrontGripFactor','RearGripFactor','DriftTriggerFactor','DriftTriggerTime',
          'DriftSlipFactor','DriftEscapeForce','CornerDrawFactor','DriftLeanFactor','SteerLeanFactor']

def decimal_expr(value):
    value = value.strip()
    constants = {'DECIMAL_ZERO': 0, 'DECIMAL_ONE': 1, 'DECIMAL_THOUSAND': 1000}
    if value in constants: return Decimal(constants[value])
    match = re.fullmatch(r'decimal_literal\(([\d_]+),\s*(\d+),\s*(false|true)\)', value)
    if not match: raise ValueError('Unsupported source decimal expression: '+value)
    return Decimal(match[1].replace('_','')) * Decimal(10)**-int(match[2]) * (-1 if match[3]=='true' else 1)

def source_tables(rust,speed_type=7):
    snapshot=json.loads((ROOT/'tools/p5136-stock-spec.json').read_text(encoding='utf-8'))
    if any(not (rust/path).is_file() or hashlib.sha256((rust/path).read_bytes()).hexdigest()!=digest
           for path,digest in snapshot['sourceHashes'].items()):
        label={0:'S1',7:'S7'}.get(speed_type)
        if label is None: raise ValueError('Only audited stock S1/S7 supported')
        speed={key:Decimal(value) for key,value in snapshot['stockSpeeds'][label].items()}
        rules={key:(entry['member'],Decimal(entry['fallback']),Decimal(entry['default']),Decimal(entry['scale']))
               for key,entry in snapshot['bodyParamRules'].items()}
        return speed,rules,snapshot['sourceHashes']
    core = rust/'crates/p5136-core/src/kart_physics.rs'
    catalog = rust/'crates/p5136-profile/src/catalog.rs'
    text = core.read_text(encoding='utf-8')
    # Rust's default is S7 (wire 7); S1 (wire 0) remains available for audits.
    if speed_type==7:
        block=re.search(r'impl P5136SpeedSpecSnapshot.*?pub const fn csharp_default\(\) -> Self \{\s*Self \{(.*?)\n\s*\}',text,re.S)[1]
    elif speed_type==0:
        block=re.search(r'\n\s+0 => Self \{(.*?)\.\.Self::csharp_zero\(\)',text,re.S)[1]
    else: raise ValueError('Only audited stock S1/S7 supported')
    speed = {key: Decimal(value.replace('_','')) for key,value in re.findall(r'(\w+):\s*(-?[\d_.]+)',block)}
    rules = {}
    text = catalog.read_text(encoding='utf-8')
    section = text[text.index('fn parse_body_param'):text.index('fn known_body_param_field')]
    expression = r'(DECIMAL_\w+|decimal_literal\([\d_]+,\s*\d+,\s*(?:false|true)\))'
    for match in re.finditer(r'(?:float|int|byte)_field!\(\s*(\w+),\s*"([^"]+)",\s*'+expression+r',\s*'+expression+r',\s*'+expression+r'\s*\)',section):
        member, key, fallback, default, scale = match.groups()
        rules[key] = (member,decimal_expr(fallback),decimal_expr(default),decimal_expr(scale))
    if len(rules)<50 or len(speed)<18: raise ValueError('Source layout changed; review parser')
    return speed,rules,{str(p.relative_to(rust)):hashlib.sha256(p.read_bytes()).hexdigest() for p in [core,catalog]}

def project(attributes, speed, rules):
    kart={}
    for key,(member,fallback,default,scale) in rules.items():
        kart[key] = Decimal(attributes[key])*scale+fallback if key in attributes else default
    kart['instAccelGaugeMinUsable'] = Decimal(attributes.get('instAccelGaugeMinUsable','0'))*Decimal(attributes.get('instAccelGaugeLength','0'))*1000
    resolved = {}
    for key,(member,*_) in rules.items():
        resolved[key] = float(kart[key] + (speed.get(member,0) if key in FIELDS+['DriftMaxGauge','TransAccelFactor','BoostAccelFactor'] and key!='DriftLeanFactor' else 0))
    resolved['instAccelGaugeMinUsable']=float(kart['instAccelGaugeMinUsable'])
    factor=kart['StartForwardAccelFactorSpeed'];force=Decimal(str(resolved['ForwardAccelForce']))
    offsets={Decimal(k):Decimal(v) for k,v in [('1.65','158.679'),('1.7','171.212'),('1.8','191.644'),('1.85','204.276'),('1.9','211.547'),('2.1','240.324')]}
    resolved['StartForwardAccelForceSpeed'] = float(force if factor==0 else force*factor-offsets.get(factor,Decimal('58.8')*factor*factor))
    return resolved

def prepare(client,rust,speed_type=7):
    speed,rules,hashes=source_tables(rust,speed_type)
    label='S7' if speed_type==7 else 'S1'
    output={'format':'p5136-kart-physics-v1','speed':label,'speedByte':speed_type,
            'source':'Korean param@kr.xml + P5136_Rust stock composition; no upgrades/pets/tuning',
            'sourceHashes':hashes,'runtime':'2004 C dynamics + web Exceed adapter; 5136 runtime not recovered','karts':{},'waiting':[]}
    catalog=json.loads((ROOT/'web-preview/assets/catalog.json').read_text(encoding='utf-8'))
    for entry in catalog['karts']:
        folder=client/'E/_rho5Out/kart_'/entry['id']
        source=folder/'param@kr.xml'
        if not source.is_file(): source=folder/'param.xml'
        if not source.is_file(): output['waiting'].append(entry['id']);continue
        attrs=ET.parse(source).getroot().attrib
        if attrs.get('TachometerType')=='XunGenTacho':
            output['waiting'].append(entry['id']+': XUN part composition requires separate adapter');continue
        values=project(attrs,speed,rules)
        if not all(values[k]>0 for k in ['Mass','ForwardAccelForce','DragFactor','SteerConstraint']): raise ValueError('Invalid dynamics: '+entry['id'])
        output['karts'][entry['id']]={'values':values,'exceed':attrs.get('TachometerName')=='v1_exceed' and values['instAccelGaugeLength']>0,
            'source':str(source.relative_to(client)).replace('\\','/'),'sha256':hashlib.sha256(source.read_bytes()).hexdigest()}
    destination=ROOT/'web-preview/assets/kart-physics.json'
    destination.write_text(json.dumps(output,ensure_ascii=False,indent=2),encoding='utf-8')
    print('Kart physics:',len(output['karts']),'resolved;',len(output['waiting']),'waiting; stock',label)

if __name__=='__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('--client',type=Path,default=Path.home()/'Documents/kart web/kartrider_5136')
    parser.add_argument('--rust',type=Path,default=ROOT/'.tools/P5136_Rust')
    parser.add_argument('--speed',choices=['S1','S7'],default='S7')
    args=parser.parse_args();prepare(args.client,args.rust,7 if args.speed=='S7' else 0)
