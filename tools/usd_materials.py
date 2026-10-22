"""Resolve authored surface bindings/samplers; never substitute a different texture."""
import hashlib
from pathlib import Path
from PIL import Image
from pxr import UsdShade,UsdGeom

_cache={}
def material_info(prim,source,output,rho=None):
 key=(str(source),str(prim.GetPath()),str(output),str(rho))
 if key in _cache:return _cache[key]
 material=UsdShade.MaterialBindingAPI(prim).ComputeBoundMaterial()[0]
 result={'texture':None,'alphaBlend':False,'alphaTest':False,'alphaRef':0,
         'doubleSided':bool(UsdGeom.Mesh(prim).GetDoubleSidedAttr().Get()),'wrapS':'repeat','wrapT':'repeat'}
 # Nearest authored flag wins; False is meaningful too.
 for field,target in [('kart_alphaBlend','alphaBlend'),('kart_alphaTest','alphaTest'),
                      ('kart_alphaRef','alphaRef'),('kart_doubleSided','doubleSided')]:
  parent=prim
  while parent and parent.IsValid():
   value=parent.GetCustomDataByKey(field)
   if value is not None:result[target]=value;break
   parent=parent.GetParent()
 if not material:
  _cache[key]=result;return result
 surface=material.ComputeSurfaceSource()[0]
 if surface:
  for field,target in [('diffuseColor','baseColor'),('roughness','roughness'),('metallic','metalness'),('opacity','opacity')]:
   value=surface.GetInput(field).Get()
   if value is not None:result[target]=list(value) if field=='diffuseColor' else float(value)
 connection=surface.GetInput('diffuseColor').GetConnectedSource() if surface else None
 texture=UsdShade.Shader(connection[0].GetPrim()) if connection else None
 if not texture or not texture.GetInput('file'):
  # Only an unambiguous single file shader is eligible as a fallback.
  candidates=[UsdShade.Shader(p) for p in material.GetPrim().GetChildren() if p.IsA(UsdShade.Shader) and UsdShade.Shader(p).GetInput('file')]
  texture=candidates[0] if len(candidates)==1 else None
 if texture:
  asset=texture.GetInput('file').Get()
  raw=asset.path if asset else ''
  file=Path(asset.resolvedPath) if asset and asset.resolvedPath else source.parent/raw
  if not file.is_file() and rho:
   category=source.parent.parent.name;name=source.stem.split('_demo')[0]
   candidate=rho/category/name/Path(raw).name
   if candidate.is_file():file=candidate
   if not file.is_file() and category=='track' and Path(raw).name.startswith('ad_'):
    candidate=rho/'zeta/kr/ppl/ingame/hangul'/name.split('_')[0]/Path(raw).name
    if candidate.is_file():file=candidate
  result['missingTexture']=bool(raw and not file.is_file())
  if file.is_file():
   digest=hashlib.sha256(file.read_bytes()).hexdigest()[:12]
   target=f'{digest}-{file.stem}.png'
   if file.suffix.lower() in ['.png','.jpg','.jpeg']:
    target=f'{digest}-{file.name}'
    import shutil
    shutil.copy2(file,output/target)
   elif file.suffix.lower() in ['.dds','.tga']:
    Image.open(file).convert('RGBA').save(output/target)
   else:raise ValueError(f'Unsupported authored texture: {file}')
   result['texture']=target
  for axis in ['S','T']:
   value=texture.GetInput('wrap'+axis).Get()
   if value:result['wrap'+axis]=str(value)
 opacity_input=surface.GetInput('opacity') if surface else None
 if opacity_input and opacity_input.GetConnectedSource():
  # Original exporters connect the diffuse texture's alpha to opacity.
  result['usesTextureAlpha']=True
 _cache[key]=result
 return result
