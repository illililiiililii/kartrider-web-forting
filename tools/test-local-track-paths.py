"""No original assets are modified by these temporary-directory regressions."""
import importlib.util, struct, tempfile, unittest, zlib
from pathlib import Path
import local_asset_paths as paths

spec=importlib.util.spec_from_file_location('track_art',Path(__file__).with_name('prepare-local-track-art.py'))
art=importlib.util.module_from_spec(spec);spec.loader.exec_module(art)

class TrackPaths(unittest.TestCase):
    def test_moved_files_take_precedence_and_accept_reported_s1_suffix(self):
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory);old=paths.ROOT
            try:
                paths.ROOT=root
                local=root/'local-assets/track/test';local.mkdir(parents=True)
                rho=root/'unpack';raw=rho/'track/test';raw.mkdir(parents=True)
                (raw/'track.1s').write_bytes(b'fallback')
                (local/'track.s1').write_bytes(b'moved')
                self.assertEqual(paths.track_file(rho,'test'),local/'track.s1')
                (local/'track.1s').write_bytes(b'canonical')
                self.assertEqual(paths.track_file(rho,'test'),local/'track.1s')
                self.assertEqual((raw/'track.1s').read_bytes(),b'fallback')
            finally:paths.ROOT=old

    def test_mapping_reads_own_original_values_and_rejects_invalid_scale(self):
        with tempfile.TemporaryDirectory() as directory:
            file=Path(directory)/'track.1s'
            header=b'\xaa\x47'+struct.pack('<IHI?',zlib.adler32(b'ToMinimap',0),7,0,False)
            file.write_bytes(header+struct.pack('<fffII',1200,700,.3,256,256))
            mapping=art.minimap_mapping(file)
            self.assertEqual(mapping['origin'],[1200,700]);self.assertAlmostEqual(mapping['scale'],.3)
            file.write_bytes(header+struct.pack('<fffII',1200,700,0,256,256))
            with self.assertRaises(ValueError):art.minimap_mapping(file)
            file.write_bytes(b'no mapping');self.assertIsNone(art.minimap_mapping(file))

if __name__=='__main__':unittest.main()
