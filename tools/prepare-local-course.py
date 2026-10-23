"""Generate local-only 5136 checkpoint tables from supplied track.1s files.

The separately obtained KartriderDemoPhysics parser supplies the ToRoad format
and C table emitter. Generated geometry is ignored by Git, like the local USD
meshes and Wasm binary. The web scene deliberately enlarges track coordinates
tenfold relative to the original-size conversion, so the same scale must be
applied to the source checkpoints and to the KTRK/rendered track together.
"""

from local_asset_paths import track_file
import argparse
import importlib.util
import json
from pathlib import Path


TRACKS = ("beach_I01", "beach_I02", "village_R01")


class P5136Space:
    @staticmethod
    def point(value):
        return tuple(value)

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
    parser.add_argument("--catalog", type=Path)
    args = parser.parse_args()
    script = args.demo_source / "scripts" / "derive_course_gates.py"
    spec = importlib.util.spec_from_file_location("demo_course_parser", script)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Cannot load demo ToRoad parser: {script}")
    demo = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(demo)
    emitter = demo.Emitter()
    entries = []
    catalog = json.loads(args.catalog.read_text(encoding='utf-8')) if args.catalog else None
    candidates = catalog['tracks'] if catalog else [{'id': n, 'ready': True, 'laps': 2 if n == 'village_R01' else 3} for n in TRACKS]
    for entry in candidates:
        if not entry.get('ready'): continue
        name = entry['id']
        try:
            if entry['laps'] <= 0: raise ValueError('Original lap racing is not defined for this special course')
            source = track_file(args.rho_root, name)
            roads, course_tag, _ = demo.read_track(str(source))
            sections = demo.collect_sections(course_tag, roads, str(source))
            used = collect_used(sections)
            if not used: raise ValueError('Original ToRoad checkpoints missing')
            track_emitter = demo.Emitter()
            for road in sorted(used):
                elements = roads[road]
                if not elements or any(len(element['gates']) < 2 for element in elements):
                    raise ValueError(f'{name}/{road}: missing checkpoint gate triangles')
                track_emitter.emit_road(name, road, elements, P5136Space())
            symbol = 'COURSE_' + demo.identifier(name)
            track_emitter.emit_sections(name, sections, symbol)
            entry['courseIndex'] = len(entries)
            entries.append((name, symbol, entry['laps']))
            emitter.lines.extend(track_emitter.lines)
        except Exception as error:
            if not catalog: raise
            entry['ready'] = False; entry['reason'] = str(error)
    if not entries: raise ValueError('No valid original courses available')
    if catalog:
        args.catalog.write_text(json.dumps(catalog,ensure_ascii=False,indent=2),encoding='utf-8')
    print(f'Prepared {len(entries)} original checkpoint courses')

    header = """/* Local-only tables generated from user-supplied P5136 track.1s.
   Do not commit this file or distribute it without asset rights. */
#include "kart_course.h"
#include <string.h>

"""
    table = "\nstatic const KartCourseAsset P5136_COURSES[] = {\n"
    table += "".join(
        f'    {{"{name}", {symbol}, (unsigned int)(sizeof {symbol} / sizeof *{symbol})}},\n'
        for name, symbol, laps in entries
    )
    table += """};

const KartCourseAsset *kart_5136_course_asset_at(unsigned int index) {
    return index < (unsigned int)(sizeof P5136_COURSES / sizeof *P5136_COURSES)
        ? &P5136_COURSES[index] : 0;
}
"""
    table += '\nstatic const unsigned int P5136_LAPS[] = {' + ','.join(str(laps) for _, _, laps in entries) + '};\n'
    table += 'unsigned int kart_5136_course_laps(unsigned int index) { return index < sizeof P5136_LAPS / sizeof *P5136_LAPS ? P5136_LAPS[index] : 0; }\n'
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(header + "\n".join(emitter.lines) + table, encoding="utf-8")
    print(f"Generated local-only C: {args.output}")


if __name__ == "__main__":
    main()
