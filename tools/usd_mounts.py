"""Read authored seat/handle bindings; ignore synthetic _demoEffect helpers."""
from pxr import Gf
def kart_mounts(stage,cache):
    for root in stage.GetPseudoRoot().GetChildren():
        bindings=root.GetCustomDataByKey('attach_points')
        if not bindings:continue
        result={}
        for role in ['seat','handle']:
            path=bindings.get(role)
            if not path:continue
            prim=stage.GetPrimAtPath(path)
            if not prim.IsValid():continue
            matrix=cache.GetLocalToWorldTransform(prim)
            def web(p):return [float(p[0]),float(p[2]),-float(p[1])]
            origin=[v*.01 for v in web(matrix.Transform(Gf.Vec3d(0)))]
            axes=[web(matrix.TransformDir(Gf.Vec3d(*axis))) for axis in [(1,0,0),(0,0,1),(0,-1,0)]]
            result[role]={'path':str(path),'position':origin,'matrix':[axes[0][0],axes[0][1],axes[0][2],0,axes[1][0],axes[1][1],axes[1][2],0,axes[2][0],axes[2][1],axes[2][2],0,*origin,1]}
        return result
    return {}
