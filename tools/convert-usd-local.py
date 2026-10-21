"""Export supplied KartRider USDA geometry/materials to local-only browser JSON.

Install usd-core (tested with 25.5.1) in a local Python environment. This
script copies only referenced textures; all outputs are ignored by Git.
"""

import argparse
import json
import math
import shutil
from pathlib import Path

from pxr import Gf, Usd, UsdGeom, UsdShade


def texture_for(prim, source, output_dir):
    binding = prim.GetRelationship("material:binding")
    if not binding:
        return None
    targets = binding.GetTargets()
    if not targets:
        return None
    material = prim.GetStage().GetPrimAtPath(targets[0])
    for child in Usd.PrimRange(material):
        if not child.IsA(UsdShade.Shader):
            continue
        value = child.GetAttribute("inputs:file").Get()
        if value is None:
            continue
        file = source.parent / str(value).strip("@")
        if not file.is_file() or file.suffix.lower() not in (".png", ".jpg", ".jpeg"):
            continue
        name = file.name
        shutil.copy2(file, output_dir / name)
        return name
    return None


def export(source, output, scale):
    stage = Usd.Stage.Open(str(source))
    if stage is None:
        raise ValueError(f"Cannot open USDA: {source}")
    output.parent.mkdir(parents=True, exist_ok=True)
    cache = UsdGeom.XformCache(Usd.TimeCode.Default())
    parts = []
    for prim in stage.Traverse():
        if not prim.IsA(UsdGeom.Mesh):
            continue
        mesh = UsdGeom.Mesh(prim)
        points = mesh.GetPointsAttr().Get()
        counts = mesh.GetFaceVertexCountsAttr().Get()
        indices = mesh.GetFaceVertexIndicesAttr().Get()
        if not points or not counts or not indices:
            continue
        uv_primvar = UsdGeom.PrimvarsAPI(mesh).GetPrimvar("st")
        uv_values = uv_primvar.ComputeFlattened() if uv_primvar else None
        interpolation = uv_primvar.GetInterpolation() if uv_primvar else None
        transform = cache.GetLocalToWorldTransform(prim)
        positions, uvs, triangles = [], [], []
        offset = 0
        for face_index, count in enumerate(counts):
            if count < 3:
                offset += count
                continue
            face = []
            for corner in range(count):
                vertex_index = indices[offset + corner]
                point = transform.Transform(Gf.Vec3d(*points[vertex_index]))
                # USD is Z-up. Convert into Three.js Y-up, preserving handedness.
                xyz = (point[0] * scale, point[2] * scale, -point[1] * scale)
                if not all(math.isfinite(value) for value in xyz):
                    raise ValueError(f"Non-finite vertex in {prim.GetPath()}")
                positions.extend(round(value, 5) for value in xyz)
                uv_index = offset + corner if interpolation == "faceVarying" else vertex_index
                if interpolation == "constant":
                    uv_index = 0
                if uv_values is not None and uv_index < len(uv_values):
                    uv = uv_values[uv_index]
                    uvs.extend((round(float(uv[0]), 5), round(1 - float(uv[1]), 5)))
                else:
                    uvs.extend((0, 0))
                face.append(len(positions) // 3 - 1)
            for corner in range(1, count - 1):
                triangles.extend((face[0], face[corner], face[corner + 1]))
            offset += count
        if not triangles:
            continue
        parts.append({
            "name": str(prim.GetPath()), "positions": positions, "uvs": uvs,
            "indices": triangles, "texture": texture_for(prim, source, output.parent),
        })
    if not parts:
        raise ValueError(f"No meshes in {source}")
    result = {"format": "p5136-usd-mesh-v1", "source": source.name, "parts": parts}
    output.write_text(json.dumps(result, separators=(",", ":")), encoding="utf-8")
    print(f"{source.name}: {len(parts)} meshes, {output.stat().st_size:,} bytes -> {output}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--scale", type=float, default=0.01)
    args = parser.parse_args()
    export(args.source, args.output, args.scale)
