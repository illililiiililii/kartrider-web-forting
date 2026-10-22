"""Blender: --background --python this.py -- input.fbx output.usda."""
import sys
from pathlib import Path
import bpy

source, output = map(Path, sys.argv[sys.argv.index('--') + 1:])
if source.resolve() == output.resolve():
    raise ValueError('Must not overwrite source')
output.parent.mkdir(parents=True, exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.fbx(filepath=str(source.resolve()))
bpy.ops.wm.usd_export(filepath=str(output.resolve()), export_textures=True, generate_preview_surface=True)
