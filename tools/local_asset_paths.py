"""Read-only local originals: moved track files take precedence over unpack root."""
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

def track_file(rho, name, filename='track.1s'):
    roots = [ROOT/'local-assets/track'/name, ROOT/'local-assets/rhoOut/track'/name, Path(rho)/'track'/name]
    for directory in roots:
        candidates = [directory/filename]
        if filename == 'track.1s': candidates.append(directory/'track.s1')
        for candidate in candidates:
            if candidate.is_file(): return candidate
    return roots[0]/filename

def resource_file(rho, relative):
    local = ROOT/'local-assets/rhoOut'/relative
    return local if local.is_file() else Path(rho)/relative
