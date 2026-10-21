"""Export supplied KartRider USDA geometry/materials to local-only browser JSON.

Install usd-core (tested with 25.5.1) in a local Python environment. This
script copies only referenced textures; all outputs are ignored by Git.
"""

import argparse
import json
import math
import shutil
import struct
from pathlib import Path

from pxr import Gf, Usd, UsdGeom, UsdShade


def texture_for(prim, source, output_dir, rho_root=None):
    # USD bindings can be inherited from a parent Xform. Resolve the bound
    # material rather than assuming every mesh owns material:binding itself.
    binding = prim.GetRelationship("material:binding")
    targets = binding.GetTargets() if binding else []
    if targets:
        material = prim.GetStage().GetPrimAtPath(targets[0])
    else:
        bound = UsdShade.MaterialBindingAPI(prim).ComputeBoundMaterial()[0]
        if not bound:
            return None
        material = bound.GetPrim()
    for child in Usd.PrimRange(material):
        if not child.IsA(UsdShade.Shader):
            continue
        value = child.GetAttribute("inputs:file").Get()
        if value is None:
            continue
        name = Path(str(value).strip("@")).name
        if Path(name).suffix.lower() not in (".png", ".jpg", ".jpeg"):
            continue
        file = source.parent / name
        if not file.is_file() and rho_root is not None:
            # Only the exact source category/name may satisfy a missing USDA
            # reference. A same-named image from another track is not evidence.
            category = source.parent.parent.name
            asset = source.stem.split("_demo")[0]
            candidate = rho_root / category / asset / name
            if candidate.is_file():
                file = candidate
            if not file.is_file() and category == "track" and name.startswith("ad_"):
                theme = asset.split("_")[0]
                localized = (rho_root / "zeta" / "kr" / "ppl" / "ingame"
                             / "hangul" / theme / name)
                if localized.is_file():
                    file = localized
        if not file.is_file():
            continue
        shutil.copy2(file, output_dir / name)
        return name
    return None


def material_flags(prim, source, output_dir):
    flags = {"alphaBlend": False, "alphaTest": False, "alphaTexture": None}
    parent = prim
    while parent and parent.IsValid():
        flags["alphaBlend"] = flags["alphaBlend"] or bool(parent.GetCustomDataByKey("kart_alphaBlend"))
        flags["alphaTest"] = flags["alphaTest"] or bool(parent.GetCustomDataByKey("kart_alphaTest"))
        parent = parent.GetParent()
    binding = prim.GetRelationship("material:binding")
    targets = binding.GetTargets() if binding else []
    material = prim.GetStage().GetPrimAtPath(targets[0]) if targets else None
    if material is None:
        bound = UsdShade.MaterialBindingAPI(prim).ComputeBoundMaterial()[0]
        material = bound.GetPrim() if bound else None
    if material:
        raw = material.GetCustomDataByKey("kart_alphaTexture")
        if raw:
            name = Path(str(raw)).name
            file = source.parent / name
            if file.is_file():
                shutil.copy2(file, output_dir / name)
                flags["alphaTexture"] = name
    return flags


def collision_candidate(part):
    # The supplied USDA does not retain the original property/road tag.
    # Exclude obvious non-solid backdrop/water; remaining meshes are an
    # experimental collision proxy, not recovered original collision data.
    label = f"{part['name']} {part.get('texture') or ''}".lower()
    if any(word in label for word in ("skydome", "water", "sea0", "bird", "transparency")):
        return False
    if not any(word in label for word in (
        "road", "bridge", "side", "tile", "sand", "grass", "cement",
        "fence", "rail", "wall", "barrier"
    )):
        return False
    values = part["positions"]
    xs, zs = values[0::3], values[2::3]
    return max(max(xs) - min(xs), max(zs) - min(zs)) < 200


def write_ktrk(path, parts):
    selected = [part for part in parts if collision_candidate(part)]
    if not selected:
        raise ValueError("No collision candidates in exported track")
    vertices = sum(len(part["positions"]) // 3 for part in selected)
    triangles = sum(len(part["indices"]) // 3 for part in selected)
    coordinates = [[], [], []]
    for part in selected:
        p = part["positions"]
        # The demo loader mirrors KTRK X. Store the opposite sign so the
        # collision world matches the unmirrored original USD render mesh.
        coordinates[0].extend(-value for value in p[0::3])
        coordinates[1].extend(-value for value in p[2::3])
        coordinates[2].extend(p[1::3])
    with path.open("wb") as file:
        file.write(struct.pack("<4sIIII", b"KTRK", 2, len(selected), vertices, triangles))
        file.write(struct.pack("<6f", *(min(axis) for axis in coordinates),
                               *(max(axis) for axis in coordinates)))
        for part in selected:
            def field(value):
                return value.encode("utf-8")[:96].ljust(96, b"\0")

            p, uv, indices = part["positions"], part["uvs"], list(part["indices"])
            # The USDA export has mixed winding on drivable horizontal faces.
            # Ground queries in the recovered C engine intentionally trust the
            # face normal; normalize only this provisional web collision mesh.
            for tri in range(0, len(indices), 3):
                ia, ib, ic = indices[tri:tri + 3]
                ax, ay, az = -p[ia * 3], -p[ia * 3 + 2], p[ia * 3 + 1]
                bx, by, bz = -p[ib * 3], -p[ib * 3 + 2], p[ib * 3 + 1]
                cx, cy, cz = -p[ic * 3], -p[ic * 3 + 2], p[ic * 3 + 1]
                nx = (by - ay) * (cz - az) - (bz - az) * (cy - ay)
                ny = (bz - az) * (cx - ax) - (bx - ax) * (cz - az)
                nz = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax)
                if nz < 0 and abs(nz) > (nx * nx + ny * ny) ** 0.5 * 0.86:
                    indices[tri + 1], indices[tri + 2] = indices[tri + 2], indices[tri + 1]
            file.write(field(part["name"]))
            file.write(field(part.get("texture") or ""))
            file.write(struct.pack("<III", 1, len(p) // 3, len(indices)))
            for i in range(0, len(p), 3):
                file.write(struct.pack("<5f", -p[i], -p[i + 2], p[i + 1],
                                       uv[i // 3 * 2], uv[i // 3 * 2 + 1]))
            file.write(struct.pack(f"<{len(indices)}I", *indices))
    print(f"KTRK collision candidates: {len(selected)} meshes / {triangles} triangles -> {path}")


def export(source, output, scale, ktrk=None, rho_root=None):
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
                    # Three.TextureLoader flips PNG Y on upload. Preserve USD
                    # UVs here; flipping both made every texture upside down.
                    uvs.extend((round(float(uv[0]), 5), round(float(uv[1]), 5)))
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
            "indices": triangles, "texture": texture_for(prim, source, output.parent, rho_root),
            **material_flags(prim, source, output.parent),
        })
    if not parts:
        raise ValueError(f"No meshes in {source}")
    result = {"format": "p5136-usd-mesh-v1", "source": source.name, "parts": parts}
    output.write_text(json.dumps(result, separators=(",", ":")), encoding="utf-8")
    if ktrk is not None:
        write_ktrk(ktrk, parts)
    print(f"{source.name}: {len(parts)} meshes, {output.stat().st_size:,} bytes -> {output}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--scale", type=float, default=0.01)
    parser.add_argument("--ktrk", type=Path)
    parser.add_argument("--rho-root", type=Path)
    args = parser.parse_args()
    export(args.source, args.output, args.scale, args.ktrk, args.rho_root)
