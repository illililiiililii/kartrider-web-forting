"""Small authored USD fixtures: no original assets or network required."""
import json,tempfile,unittest
from pathlib import Path
from PIL import Image
from pxr import Usd,UsdGeom,UsdShade,Sdf,Gf
from importlib.util import spec_from_file_location,module_from_spec
spec=spec_from_file_location('converter',Path(__file__).with_name('convert-usd-local.py'))
converter=module_from_spec(spec);spec.loader.exec_module(converter)

class ConversionTest(unittest.TestCase):
 def test_bindings_uv_time_transform_texture_identity(self):
  with tempfile.TemporaryDirectory() as tmp:
   root=Path(tmp);source=root/'scene.usda';output=root/'web/model.mesh.json'
   for name,color in [('a','red'),('b','green')]:
    (root/name).mkdir();Image.new('RGBA',(2,2),color).save(root/name/'same.png')
   stage=Usd.Stage.CreateNew(str(source));stage.SetStartTimeCode(20);stage.SetEndTimeCode(20)
   for name in ['a','b']:
    parent=UsdGeom.Xform.Define(stage,'/'+name)
    parent.AddTranslateOp().Set(Gf.Vec3d(10,3,4),20)
    parent.AddScaleOp().Set(Gf.Vec3f(-1,1,1),20)
    parent.GetPrim().SetCustomDataByKey('kart_doubleSided',True)
    mesh=UsdGeom.Mesh.Define(stage,'/'+name+'/Geo')
    mesh.CreatePointsAttr([(0,0,0),(1,0,0),(0,1,0),(0,0,1),(1,0,1),(0,1,1)])
    mesh.CreateFaceVertexCountsAttr([3,3]);mesh.CreateFaceVertexIndicesAttr([0,1,2,3,4,5])
    UsdGeom.PrimvarsAPI(mesh).CreatePrimvar('st',Sdf.ValueTypeNames.TexCoord2fArray,'uniform').Set([(0.2,0.3),(1.2,-0.4)])
    material=UsdShade.Material.Define(stage,'/Materials/'+name)
    surface=UsdShade.Shader.Define(stage,material.GetPath().AppendChild('Surface'));surface.CreateIdAttr('UsdPreviewSurface')
    texture=UsdShade.Shader.Define(stage,material.GetPath().AppendChild('Texture'));texture.CreateIdAttr('UsdUVTexture')
    texture.CreateInput('file',Sdf.ValueTypeNames.Asset).Set(Sdf.AssetPath(name+'/same.png'))
    texture.CreateInput('wrapS',Sdf.ValueTypeNames.Token).Set('repeat')
    texture.CreateOutput('rgb',Sdf.ValueTypeNames.Float3)
    surface.CreateInput('diffuseColor',Sdf.ValueTypeNames.Color3f).ConnectToSource(texture.ConnectableAPI(),'rgb')
    material.CreateSurfaceOutput().ConnectToSource(surface.ConnectableAPI(),'surface')
    UsdShade.MaterialBindingAPI.Apply(parent.GetPrim()).Bind(material)
   stage.GetRootLayer().Save()
   converter.export(source,output,1)
   parts=json.loads(output.read_text())['parts'];self.assertEqual(len(parts),2)
   self.assertNotEqual(parts[0]['texture'],parts[1]['texture'])
   for part in parts:
    self.assertEqual(part['positions'][:3],[10,4,-3])
    self.assertEqual(part['indices'][:3],[0,2,1])
    self.assertEqual(part['uvs'][:6],[.2,.3]*3)
    self.assertEqual(part['uvs'][6:],[1.2,-.4]*3)
    self.assertTrue(part['doubleSided']);self.assertEqual(part['wrapS'],'repeat')
    self.assertTrue((output.parent/part['texture']).is_file())

if __name__=='__main__':unittest.main()
