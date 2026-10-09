"""Create the Douyin source handoff with explicit file selection."""
from pathlib import Path
import hashlib
import json
import zipfile

root = Path(__file__).resolve().parents[1]
target = root / 'deliverables'
target.mkdir(exist_ok=True)
verification = json.loads((root / 'research/blender-preview/blender-ui-smoke.json').read_text(encoding='utf-8'))
assert verification.get('passed') is True, 'Visual verification must pass before packaging'
runtime_verification=json.loads((root/'research/blender-preview/realtime-ui-smoke.json').read_text(encoding='utf-8'))
assert runtime_verification.get('passed') is True, 'Real-time WebGL visual/input verification must pass'
for mesh in runtime_verification['meshInputs']:
    assert hashlib.sha256((root/'公路之王/assets/scene'/mesh['name']).read_bytes()).hexdigest()==mesh['sha256'],'Runtime geometry changed after verification'
model_verification = json.loads((root / 'art/blender/model-verification.json').read_text(encoding='utf-8'))
assert model_verification.get('passed') is True, 'Editable source geometry must pass inspection'
engine_verification=json.loads((root/'research/blender-preview/engine-playback.json').read_text(encoding='utf-8'))
extreme_speed=json.loads((root/'research/blender-preview/extreme-speed.json').read_text(encoding='utf-8'))
assert extreme_speed.get('passed') is True, 'Extreme speed spawning and collision checks must pass'
assert engine_verification.get('passed') is True, 'Engine playback verification must pass'
assert hashlib.sha256((root/'公路之王/audio/engine.wav').read_bytes()).hexdigest()==engine_verification['asset']['sha256'], 'Engine audio changed after verification'
assert hashlib.sha256((root/'公路之王/audio/engine-idle.wav').read_bytes()).hexdigest()==engine_verification['idleAsset']['sha256'], 'Idle recording changed after verification'
for asset in verification['renderInputs']:
    image_path = root / '公路之王/assets/blender' / (asset['name'] + '.png')
    assert hashlib.sha256(image_path.read_bytes()).hexdigest() == asset['sha256'], 'A rendered asset changed after verification'
files = [root / 'README.md']
for folder in ('公路之王', 'preview', 'tests'):
    files.extend(p for p in (root / folder).rglob('*') if p.is_file())
files.extend(root / p for p in (
    'docs/endless-mode.md',
    'docs/difficulty-config.md',
    'docs/blender-art.md',
    'docs/game-design.md',
    'tools/generate_audio.py',
    'tools/generate_engine_audio.py',
    'tools/decode_engine_recordings.cjs',
    'tools/verify_engine_preview.cjs',
    'tools/verify_extreme_speed_preview.cjs',
    'art/blender/roadking-assets.blend',
    'art/blender/manifest.json',
    'art/blender/README.md',
    'art/blender/showcase.png',
    'art/blender/reference-v2.png',
    'art/blender/reference-scene.png',
    'art/blender/reference-scene.blend',
    'tools/blender/build_assets.py',
    'tools/blender/reference_models.py',
    'tools/blender/render_reference_scene.py',
    'tools/blender/verify_model_source.py',
    'tools/blender/export_runtime_meshes.py',
    'art/blender/model-verification.json',
    'tools/verify_blender_preview.cjs',
    'tools/verify_realtime_preview.cjs',
))
files.extend(p for p in (root / 'research/blender-preview').glob('*') if p.suffix in ('.json', '.png'))
files.extend(p for p in (root / 'art/audio').glob('*') if p.is_file())
assert all(p.is_file() for p in files), 'Missing delivery input'
archive = target / '驾考宝典之公路日常_实时三维版.zip'
with zipfile.ZipFile(archive, 'w', zipfile.ZIP_DEFLATED) as z:
    for p in sorted(set(files)):
        z.write(p, p.relative_to(root).as_posix())
with zipfile.ZipFile(archive) as z:
    assert z.testzip() is None
    names = z.namelist()
    assert '公路之王/game.js' in names
    assert '公路之王/project.config.json' in names
    assert 'art/blender/roadking-assets.blend' in names
    for sprite in ('car-player', 'car-silver', 'car-blue', 'car-orange', 'barrier', 'tree', 'rock', 'hero'):
        assert '公路之王/assets/blender/' + sprite + '.png' in names
    assert not any('RoadKingUnity' in n or n.endswith('.mp4') for n in names)
    config = json.loads(z.read('公路之王/project.config.json'))
    assert config['douyinProjectType'] == 'native'
    assert json.loads(z.read('公路之王/game.json'))['deviceOrientation'] == 'portrait'
report = {
    'archive':archive.name,
    'bytes':archive.stat().st_size,
    'sha256':hashlib.sha256(archive.read_bytes()).hexdigest(),
    'importDirectory':'公路之王',
    'files':names,
    'zipIntegrity':'passed',
    'platform':'Douyin native WebGL 3D scene with Blender geometry and Canvas 2D HUD',
    'verification':'48 Node tests; extreme configured-speed browser spawning and collision checks, configurable tier durations and hazard parameters, four difficulty tiers, persistent WebAudio engine playback and 15-second PCM continuity checks, traffic merge clearance, collision stop/recovery and WebGL rendering. See research/blender-preview and README for scope.',
    'notVerified':['Blender art version in Douyin IDE simulator','Android/iOS phone','live upload and publication','phone performance','audio listening'],
}
(target / 'delivery-manifest.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({k:v for k,v in report.items() if k!='files'},ensure_ascii=False))
print('Files:',len(names))
