"""Convert a local P5136 kart .1s mesh to compact preview JSON.

Format offsets and hierarchy are adapted from VT-Tuzki/kartrider_model_1s_to_obj
(MIT license). This is geometry-only: materials, textures, bones and animations
are not decoded. The original asset must be supplied locally by the user.
"""

import argparse
import json
import math
import struct
from pathlib import Path

FILE = bytes.fromhex("aa4749028c07")
MODULE = bytes.fromhex("aa4746042a19")
BASE = bytes.fromhex("aa473c03070e")


def u16(data, at):
    return struct.unpack_from("<H", data, at)[0]


def u32(data, at):
    return struct.unpack_from("<I", data, at)[0]


def transform(point, matrix):
    x, y, z = point
    return (
        x * matrix[0] + y * matrix[1] + z * matrix[2] + matrix[9],
        x * matrix[3] + y * matrix[4] + z * matrix[5] + matrix[10],
        x * matrix[6] + y * matrix[7] + z * matrix[8] + matrix[11],
    )


def parse_module(data, at, child=False, part=None):
    part = {} if part is None else part
    if data[at:at + 6] not in (MODULE, BASE):
        raise ValueError(f"module header missing at {at:#x}")
    at += 6
    module_id = u16(data, at)
    at += 2
    name_length = u16(data, at)
    at += 2
    name = data[at:at + 2 + name_length * 2].decode("utf-16le").strip("\0")
    at += 2 + name_length * 2
    part["name" if not child else "child_name"] = name
    part["id" if not child else "child_id"] = module_id
    has_child = u16(data, at)
    at += 4
    if has_child:
        return parse_module(data, at, True, part)

    matrix = struct.unpack_from("<21f", data, at)
    part["matrix"] = matrix
    at += 84 + 50
    if data[at:at + 2] == bytes.fromhex("aa27"):
        at += 2
        part["bone"] = u16(data, at)
        vertex_count = u16(data, at + 2)
        at += 6
        vertices = [struct.unpack_from("<3f", data, at + i * 12) for i in range(vertex_count)]
        at += vertex_count * 12
        normal_count = u32(data, at)
        at += 4 + normal_count * 12
        uv_count = u16(data, at)
        at += 4 + uv_count * 12
        face_count = u16(data, at)
        at += 4
        faces = [struct.unpack_from("<10H", data, at + i * 20) for i in range(face_count)]
        at += face_count * 20
        part["vertices"] = vertices
        part["triangles"] = [(f[6], f[7], f[8]) for f in faces]
    if child:
        part["child_matrix"] = struct.unpack_from("<21f", data, at)
        at += 84 + 46
    return at, part


def convert(source):
    data = source.read_bytes()
    parts = []
    at = 0
    while at < len(data):
        marker = data[at:at + 6]
        if marker == FILE:
            at += 16  # 12-byte file header followed by 32-bit module count.
        elif marker in (MODULE, BASE):
            try:
                at, part = parse_module(data, at)
                vertices = part.get("vertices", [])
                triangles = part.get("triangles", [])
                if not vertices or not triangles:
                    continue
                if any(i >= len(vertices) for face in triangles for i in face):
                    raise ValueError(f"invalid face index in {part['name']}")
                mapped = []
                for vertex in vertices:
                    if part["name"] != "seat" and "child_matrix" in part:
                        vertex = transform(transform(vertex, part["matrix"]), part["child_matrix"])
                    # P5136 Z is up; the browser kart looks along positive X.
                    mapped.extend((-vertex[1], vertex[2], vertex[0]))
                if not all(math.isfinite(x) for x in mapped):
                    raise ValueError(f"non-finite coordinate in {part['name']}")
                indices = [i for face in triangles for i in face]
                parts.append({"name": part["name"], "positions": mapped, "indices": indices})
            except (UnicodeError, ValueError, struct.error) as exc:
                raise ValueError(f"Cannot decode .1s near offset {at:#x}: {exc}") from exc
        else:
            at += 1
    if not parts:
        raise ValueError("No geometry-bearing modules found")
    return {"format": "p5136-preview-mesh-v1", "source": source.name, "parts": parts}


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    result = convert(args.source)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, separators=(",", ":")), encoding="utf-8")
    print(f"{len(result['parts'])} mesh parts -> {args.output} ({args.output.stat().st_size} bytes)")
