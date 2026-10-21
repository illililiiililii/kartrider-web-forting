"""Generate local-only 5136 checkpoint tables from supplied track.1s files.

The separately obtained KartriderDemoPhysics parser supplies the ToRoad format
and C table emitter. Generated geometry is ignored by Git, like the local USD
meshes and Wasm binary. The converted 5136 scene uses 0.1 source units per
physics metre, confirmed against the original start-line and road heights.
"""

import argparse
import importlib.util
from pathlib import Path


TRACKS = ("beach_I01", "beach_I02", "village_R01")


class P5136Space:
    @staticmethod
    def point(value):
        return tuple(component * 0.1 for component in value)

    @staticmethod
    def direction(value):
        return tuple(value)


def collect_used(sections):
    used = set()
    for section in sections:
        if section["kind"] == "road":
            used.add(section["road"])
        else:
            for alternative in section["alternatives"]:
                used.update(collect_used(alternative))
    return used


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--demo-source", type=Path, required=True)
    parser.add_argument("--rho-root", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    script = args.demo_source / "scripts" / "derive_course_gates.py"
    spec = importlib.util.spec_from_file_location("demo_course_parser", script)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Cannot load demo ToRoad parser: {script}")
    demo = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(demo)
    emitter = demo.Emitter()
    entries = []
    for name in TRACKS:
        source = args.rho_root / "track" / name / "track.1s"
        roads, course_tag, _ = demo.read_track(str(source))
        sections = demo.collect_sections(course_tag, roads, str(source))
        used = collect_used(sections)
        for road in sorted(used):
            elements = roads[road]
            if not elements or any(len(element["gates"]) < 2 for element in elements):
                raise ValueError(f"{name}/{road}: missing checkpoint gate triangles")
            emitter.emit_road(name, road, elements, P5136Space())
        symbol = "COURSE_" + demo.identifier(name)
        emitter.emit_sections(name, sections, symbol)
        entries.append((name, symbol))
        print(f"{name}: {sum(len(roads[road]) for road in used)} source gates")

    header = """/* Local-only tables generated from user-supplied P5136 track.1s.
   Do not commit this file or distribute it without asset rights. */
#include "kart_course.h"
#include <string.h>

"""
    table = "\nstatic const KartCourseAsset P5136_COURSES[] = {\n"
    table += "".join(
        f'    {{"{name}", {symbol}, (unsigned int)(sizeof {symbol} / sizeof *{symbol})}},\n'
        for name, symbol in entries
    )
    table += """};

const KartCourseAsset *kart_5136_course_asset_at(unsigned int index) {
    return index < (unsigned int)(sizeof P5136_COURSES / sizeof *P5136_COURSES)
        ? &P5136_COURSES[index] : 0;
}
"""
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(header + "\n".join(emitter.lines) + table, encoding="utf-8")
    print(f"Generated local-only C: {args.output}")


if __name__ == "__main__":
    main()
