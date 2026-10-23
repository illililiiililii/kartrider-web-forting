"""Preserve USD corner normals, including indexed primvars and parent scale."""
from pxr import Gf, UsdGeom

def world_normals(mesh, time, transform):
    primvar = UsdGeom.PrimvarsAPI(mesh).GetPrimvar('normals')
    values = primvar.ComputeFlattened(time) if primvar else mesh.GetNormalsAttr().Get(time)
    if values is None or not len(values):
        return None
    interpolation = primvar.GetInterpolation() if primvar else mesh.GetNormalsInterpolation()
    matrix = transform.GetInverse().GetTranspose()
    result = []
    indices = mesh.GetFaceVertexIndicesAttr().Get(time)
    offset = 0
    for face, count in enumerate(mesh.GetFaceVertexCountsAttr().Get(time)):
        if count >= 3:
            for corner in range(count):
                vertex = indices[offset + corner]
                index = {'faceVarying':offset+corner, 'uniform':face, 'constant':0}.get(interpolation, vertex)
                if index >= len(values):
                    raise ValueError(f'Invalid authored normals: {mesh.GetPath()}')
                normal = matrix.TransformDir(Gf.Vec3d(*values[index])).GetNormalized()
                result.append((vertex, normal))
        offset += count
    return result

def web_normals(normals):
    return [round(float(v), 7) for _, n in normals for v in (n[0], n[2], -n[1])]
