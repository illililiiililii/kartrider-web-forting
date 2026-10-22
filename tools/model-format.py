"""Detect USD/FBX signatures without conversion dependencies."""
import sys
from pathlib import Path

def detect(path):
    with Path(path).open('rb') as stream:
        header = stream.read(256).lstrip(b'\xef\xbb\xbf \t\r\n')
    if header.startswith((b'#usda', b'PXR-USDC')):
        return 'usd'
    if header.startswith(b'Kaydara FBX Binary') or (header.startswith(b';') and b'FBX' in header):
        return 'fbx'
    raise ValueError(f'Unsupported model signature: {path}')

if __name__ == '__main__':
    print(detect(sys.argv[1]))
