"""Signature detection without OpenUSD/Blender or original game assets."""
import importlib.util
from pathlib import Path
import tempfile
import unittest

spec=importlib.util.spec_from_file_location('formats',Path(__file__).with_name('model-format.py'))
formats=importlib.util.module_from_spec(spec)
spec.loader.exec_module(formats)

class Formats(unittest.TestCase):
    def test_signatures_override_extension(self):
        with tempfile.TemporaryDirectory() as folder:
            source=Path(folder)/'mislabelled.fbx'
            for header, expected in [(b'#usda 1.0\n','usd'),(b'PXR-USDC','usd'),
                                     (b'Kaydara FBX Binary  \x00','fbx'),(b'; FBX 7.4.0 project','fbx')]:
                source.write_bytes(header)
                self.assertEqual(formats.detect(source),expected)
            source.write_bytes(b'not a model')
            with self.assertRaises(ValueError): formats.detect(source)

if __name__=='__main__': unittest.main()
