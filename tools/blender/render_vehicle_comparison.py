"""Render the actual source car from the game's chase camera, for visual QA.

No source .blend is modified. The output is a transparent crop at native pixels,
not an image-generation reference or a substitute for the in-game mesh.
"""
import bpy
import hashlib
import json
import math
import os
import shutil
import subprocess
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / 'art/blender/roadking-assets.blend'
QA = ROOT / 'research/blender-preview'
CACHE = ROOT / 'tmp/vehicle-material-bake'
QA.mkdir(parents=True, exist_ok=True)
CACHE.mkdir(parents=True, exist_ok=True)
bpy.ops.wm.open_mainfile(filepath=str(SOURCE))
scene = bpy.context.scene
player = next(c for c in bpy.data.collections if c.name.startswith('01 /'))
player_objects = set(player.objects)
for obj in scene.objects:
    obj.hide_render = obj.type not in ('LIGHT', 'CAMERA') and obj not in player_objects
for obj in player.objects:
    obj.location -= Vector((-3.1, -2, 0))

camera = scene.camera
camera.data.type = 'PERSP'
camera.data.sensor_fit = 'HORIZONTAL'
camera.data.sensor_width = 36
camera.data.lens = 36 / (2 * math.tan(math.radians(31.986) / 2))
camera.data.shift_x = camera.data.shift_y = 0
camera.location = (0, -9.3, 3.3)
target = Vector((0, 15, 1.05))
camera.rotation_euler = (target - camera.location).to_track_quat('-Z', 'Y').to_euler()
scene.render.resolution_x = 960
scene.render.resolution_y = 2082
scene.render.resolution_percentage = 100
scene.render.pixel_aspect_x = scene.render.pixel_aspect_y = 1
# Match the game's off-axis projection p[9]=.08 exactly for this aspect ratio.
camera.data.shift_y = 1
projection = camera.calc_matrix_camera(bpy.context.evaluated_depsgraph_get(), x=960, y=2082)
camera.data.shift_y = .08 / projection[1][2]
scene.render.engine = 'CYCLES'
scene.cycles.device = 'CPU'
scene.cycles.samples = 48
scene.cycles.use_denoising = True
scene.render.threads_mode = 'FIXED'
scene.render.threads = 6
scene.render.film_transparent = True
scene.view_settings.view_transform = 'AgX'
scene.view_settings.look = 'AgX - Medium High Contrast'
scene.view_settings.exposure = 0
scene.render.image_settings.file_format = 'PNG'
scene.render.image_settings.color_mode = 'RGBA'
scene.render.image_settings.color_depth = '8'
full = CACHE / 'blender-rear-reference-full.png'
output = QA / 'blender-rear-reference.png'
scene.render.filepath = str(full)
bpy.ops.render.render(write_still=True)

python_candidates = [os.environ.get('ROAD_KING_PYTHON'),
    str(Path.home() / '.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe'),
    shutil.which('python3'), shutil.which('python')]
python = next((p for p in python_candidates if p and Path(p).is_file()), None)
if not python:
    raise RuntimeError('Set ROAD_KING_PYTHON to a Python interpreter with Pillow installed.')
result = subprocess.run([python, '-c',
    'from PIL import Image; import sys,json; im=Image.open(sys.argv[1]).convert("RGBA"); b=im.getchannel("A").getbbox(); c=(max(0,b[0]-24),max(0,b[1]-24),min(im.width,b[2]+24),min(im.height,b[3]+24)); im.crop(c).save(sys.argv[2]); print(json.dumps({"alphaBounds":b,"crop":c,"size":[c[2]-c[0],c[3]-c[1]]}))',
    str(full), str(output)], check=True, capture_output=True, text=True)
metadata = {'source': 'art/blender/roadking-assets.blend',
    'sourceSha256': hashlib.sha256(SOURCE.read_bytes()).hexdigest(),
    'cameraBlender': {'eye': list(camera.location), 'target': list(target),
        'horizontalFovDegrees': 31.986, 'shiftY': camera.data.shift_y, 'fullFrame': [960, 2082]},
    'crop': json.loads(result.stdout), 'renderer': 'Cycles 48 samples / source studio area lights and world / AgX Medium High Contrast',
    'scope': 'Actual Blender car; matching chase view, perspective and framing before transparent crop. Lighting is the source studio/day setup.'}
(QA / 'blender-rear-reference.json').write_text(json.dumps(metadata, indent=2), encoding='utf-8')
print('BLENDER_REAR_REFERENCE_COMPLETE', str(output), result.stdout, flush=True)
