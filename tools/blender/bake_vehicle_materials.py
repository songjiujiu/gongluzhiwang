"""Bake the source vehicle's Principled materials into a mobile MatCap atlas.

Run: blender --background --threads 6 --python tools/blender/bake_vehicle_materials.py
The original .blend is read only. No generated bitmap replaces the vehicle mesh.
PNG colours are display referred (AgX + sRGB); sample without a second tone map.
"""
import bpy
import hashlib
import json
import math
import os
import shutil
import struct
import subprocess
import sys
import zlib
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / 'art/blender/roadking-assets.blend'
OUT = ROOT / '公路之王/assets/scene'
QA = ROOT / 'research/blender-preview'
CACHE = ROOT / 'tmp/vehicle-material-bake'
SKIP_RENDER = '--skip-render' in sys.argv
for directory in (OUT, QA, CACHE):
    directory.mkdir(parents=True, exist_ok=True)

TILE = 256
ORTHO_SCALE = 2.02
MATERIALS = [
    ('teal', 'LAGOON / multilayer turquoise lacquer'),
    ('silver', 'PEARL / brushed titanium'),
    ('blue', 'INDIGO / deep metallic'),
    ('orange', 'EMBER / orange lacquer'),
    ('glass', 'Smoked panoramic glass'),
    ('chrome', 'Diamond cut alloy'),
    ('trim', 'Graphite aero trim'),
    ('rubber', 'Tire rubber'),
]


def paeth(a, b, c):
    p = a + b - c
    da, db, dc = abs(p - a), abs(p - b), abs(p - c)
    return a if da <= db and da <= dc else b if db <= dc else c


def read_rgba_png(path):
    """Read Blender's 8-bit PNG bytes, preserving the baked display colours."""
    data = path.read_bytes()
    assert data[:8] == b'\x89PNG\r\n\x1a\n'
    chunks, cursor = [], 8
    while cursor < len(data):
        size = struct.unpack_from('>I', data, cursor)[0]
        kind = data[cursor + 4:cursor + 8]
        payload = data[cursor + 8:cursor + 8 + size]
        if kind == b'IHDR':
            width, height, bits, colour, _, _, interlace = struct.unpack('>IIBBBBB', payload)
            assert bits == 8 and colour == 6 and interlace == 0
        elif kind == b'IDAT':
            chunks.append(payload)
        cursor += size + 12
    raw = zlib.decompress(b''.join(chunks))
    stride, cursor = width * 4, 0
    previous = bytearray(stride)
    pixels = bytearray()
    for _ in range(height):
        mode = raw[cursor]
        row = bytearray(raw[cursor + 1:cursor + 1 + stride])
        cursor += stride + 1
        for i in range(stride):
            a = row[i - 4] if i >= 4 else 0
            b = previous[i]
            c = previous[i - 4] if i >= 4 else 0
            predictor = (0, a, b, (a + b) // 2, paeth(a, b, c))[mode]
            row[i] = (row[i] + predictor) & 255
        pixels.extend(row)
        previous = row
    return width, height, pixels


def extend_sphere(rgba):
    """Extend edge colour radially so filtering never blends into black alpha."""
    result = bytearray(TILE * TILE * 3)
    centre = (TILE - 1) / 2
    for y in range(TILE):
        for x in range(TILE):
            source = (y * TILE + x) * 4
            if rgba[source + 3] < 254:
                dx, dy = x - centre, y - centre
                radius = math.hypot(dx, dy)
                distance = min(radius, TILE / ORTHO_SCALE - 1.5)
                # Exact alpha test also handles the sphere's sampled silhouette.
                while distance > 1:
                    sx = round(centre + dx / radius * distance)
                    sy = round(centre + dy / radius * distance)
                    source = (sy * TILE + sx) * 4
                    if rgba[source + 3] >= 254:
                        break
                    distance -= .75
            target = (y * TILE + x) * 3
            result[target:target + 3] = rgba[source:source + 3]
    return result


def write_rgb_png(path, width, height, pixels):
    """Lossless RGB PNG with adaptive PNG filters; no colour reprocessing."""
    def chunk(kind, payload):
        return struct.pack('>I', len(payload)) + kind + payload + struct.pack('>I', zlib.crc32(kind + payload) & 0xffffffff)
    previous = bytearray(width * 3)
    filtered = bytearray()
    for y in range(height):
        row = pixels[y * width * 3:(y + 1) * width * 3]
        candidates = [bytearray(len(row)) for _ in range(5)]
        for i, value in enumerate(row):
            a = row[i - 3] if i >= 3 else 0
            b = previous[i]
            c = previous[i - 3] if i >= 3 else 0
            for mode, predictor in enumerate((0, a, b, (a + b) // 2, paeth(a, b, c))):
                candidates[mode][i] = (value - predictor) & 255
        mode = min(range(5), key=lambda k: sum(min(v, 256 - v) for v in candidates[k]))
        filtered.append(mode)
        filtered.extend(candidates[mode])
        previous = row
    path.write_bytes(b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', width, height, 8, 2, 0, 0, 0)) + chunk(b'sRGB', b'\x00') + chunk(b'IDAT', zlib.compress(filtered, 9)) + chunk(b'IEND', b''))


bpy.ops.wm.open_mainfile(filepath=str(SOURCE))
scene = bpy.context.scene
source_lights = []
for obj in scene.objects:
    if obj.type == 'LIGHT' and obj.data.type == 'AREA':
        source_lights.append((obj.name, tuple(obj.location), tuple(obj.data.color), obj.data.energy, obj.data.size))
for obj in list(bpy.data.objects):
    bpy.data.objects.remove(obj, do_unlink=True)
scene.render.engine = 'CYCLES'
scene.cycles.device = 'CPU'
scene.cycles.samples = 32
scene.cycles.use_denoising = True
scene.cycles.max_bounces = 5
scene.render.threads_mode = 'FIXED'
scene.render.threads = 6
scene.render.resolution_x = TILE
scene.render.resolution_y = TILE
scene.render.resolution_percentage = 100
scene.render.film_transparent = True
scene.render.image_settings.file_format = 'PNG'
scene.render.image_settings.color_mode = 'RGBA'
scene.render.image_settings.color_depth = '8'
scene.view_settings.view_transform = 'AgX'
scene.view_settings.look = 'AgX - Medium High Contrast'
scene.view_settings.exposure = 0
scene.view_settings.gamma = 1

# Rear chase view: source +Y forward / +Z up, runtime -Z forward / +Y up.
view_to_eye = Vector((0, -9.3, 2.3)).normalized()
camera_data = bpy.data.cameras.new('Material capture / chase orientation')
camera = bpy.data.objects.new(camera_data.name, camera_data)
scene.collection.objects.link(camera)
camera.location = view_to_eye * 12
camera.rotation_euler = (-view_to_eye).to_track_quat('-Z', 'Y').to_euler()
camera.data.type = 'ORTHO'
camera.data.ortho_scale = ORTHO_SCALE
scene.camera = camera
bpy.ops.mesh.primitive_uv_sphere_add(segments=192, ring_count=128, radius=1)
sphere = bpy.context.object
sphere.name = 'Material capture sphere'
for polygon in sphere.data.polygons:
    polygon.use_smooth = True
world = bpy.data.worlds.new('Material capture environment')
world.use_nodes = True
scene.world = world

night_lights = [
    ('Moon softbox / upper left', (-4, -5, 9), (.45, .66, 1), 660, 5),
    ('Cool reflection strip / right', (5, -1, 5), (.50, .77, 1), 470, 3),
    ('Warm roadside rim / ahead', (0, 5, 7), (1, .68, .34), 920, 4),
]
styles = [
    ('day', (.48, .63, .75), .55, source_lights),
    ('night', (.055, .105, .20), .40, night_lights),
]
atlas_width, atlas_height = TILE * len(MATERIALS), TILE * len(styles)
atlas = bytearray(atlas_width * atlas_height * 3)
rows = []
for row_index, (style, world_colour, world_strength, lights) in enumerate(styles):
    for obj in list(scene.objects):
        if obj.type == 'LIGHT':
            bpy.data.objects.remove(obj, do_unlink=True)
    background = world.node_tree.nodes['Background']
    background.inputs['Color'].default_value = (*world_colour, 1)
    background.inputs['Strength'].default_value = world_strength
    for name, position, colour, power, size in lights:
        data = bpy.data.lights.new(name, 'AREA')
        data.energy, data.color, data.size, data.shape = power, colour, size, 'DISK'
        obj = bpy.data.objects.new(name, data)
        scene.collection.objects.link(obj)
        obj.location = position
        obj.rotation_euler = (-Vector(position)).to_track_quat('-Z', 'Y').to_euler()
    for column, (key, source_name) in enumerate(MATERIALS):
        sphere.data.materials.clear()
        sphere.data.materials.append(bpy.data.materials[source_name])
        path = CACHE / f'{style}-{key}.png'
        scene.render.filepath = str(path)
        if not SKIP_RENDER or not path.exists():
            bpy.ops.render.render(write_still=True)
        width, height, rgba = read_rgba_png(path)
        assert (width, height) == (TILE, TILE)
        rgb = extend_sphere(rgba)
        for y in range(TILE):
            start = ((row_index * TILE + y) * atlas_width + column * TILE) * 3
            atlas[start:start + TILE * 3] = rgb[y * TILE * 3:(y + 1) * TILE * 3]
        print('MATERIAL_TILE_BAKED', style, key, flush=True)
    rows.append({'name': style, 'row': row_index, 'worldColour': world_colour, 'worldStrength': world_strength, 'lights': lights})

png_path = QA / 'vehicle-materials-atlas.png'
write_rgb_png(png_path, atlas_width, atlas_height, atlas)
atlas_path = OUT / 'vehicle-materials.jpg'
# Pillow is already used by the project's artifact tools. Keep JPEG 4:4:4 so
# coloured paint edges do not pick up chroma-subsampling artefacts.
python_candidates = [os.environ.get('ROAD_KING_PYTHON'),
    str(Path.home() / '.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe'),
    shutil.which('python3'), shutil.which('python')]
jpeg_python = next((p for p in python_candidates if p and Path(p).is_file()), None)
if not jpeg_python:
    raise RuntimeError('Set ROAD_KING_PYTHON to a Python interpreter with Pillow installed.')
subprocess.run([jpeg_python, '-c',
    'from PIL import Image; import sys; Image.open(sys.argv[1]).convert("RGB").save(sys.argv[2], quality=95, subsampling=0, optimize=True)',
    str(png_path), str(atlas_path)], check=True)
materials = []
for index, (key, source_name) in enumerate(MATERIALS):
    bs = bpy.data.materials[source_name].node_tree.nodes.get('Principled BSDF')
    materials.append({'id': key, 'column': index, 'sourceMaterial': source_name, 'baseColor': list(bs.inputs['Base Color'].default_value)[:3], 'metallic': bs.inputs['Metallic'].default_value, 'roughness': bs.inputs['Roughness'].default_value, 'coatWeight': bs.inputs['Coat Weight'].default_value})
metadata = {
    'version': 1,
    'generator': 'Blender Cycles / source Principled materials / 32 samples',
    'source': 'art/blender/roadking-assets.blend',
    'sourceSha256': hashlib.sha256(SOURCE.read_bytes()).hexdigest(),
    'atlasSha256': hashlib.sha256(atlas_path.read_bytes()).hexdigest(),
    'width': atlas_width, 'height': atlas_height, 'tileSize': TILE,
    'file': atlas_path.name,
    'encoding': 'JPEG quality 95, 4:4:4; lossless RGB inspection PNG is kept outside the game package',
    'colorSpace': 'Display-referred AgX Medium High Contrast, encoded sRGB; do not tone-map a second time',
    'mapping': {
        'rowOrigin': 'top',
        'textureUploadFlipY': False,
        'normalBasis': 'view = normalize(eye-world); right = normalize(cross(worldUp,view)); up = cross(view,right)',
        'tileUv': f'vec2(0.5) + vec2(dot(normal,right), -dot(normal,up)) / {ORTHO_SCALE}',
        'atlasUv': '(vec2(column,row) + tileUv) / vec2(8,2)',
        'equivalentFlipYTrue': 'tileUv = vec2(0.5) + vec2(dot(normal,right), dot(normal,up)) / 2.02; atlasUv = vec2((column+tileUv.x)/8.0, (1.0-row+tileUv.y)/2.0)',
        'discRadiusUv': 1 / ORTHO_SCALE,
        'edgeTreatment': 'Opaque RGB with radial extension outside sphere; LINEAR sampling, CLAMP_TO_EDGE, no mipmaps',
        'captureViewToEyeBlender': list(view_to_eye),
    },
    'materials': materials, 'rows': rows,
    'bytes': atlas_path.stat().st_size,
}
(OUT / 'vehicle-materials.json').write_text(json.dumps(metadata, ensure_ascii=False, indent=2), encoding='utf-8')
(QA / 'vehicle-materials-bake.json').write_text(json.dumps(metadata, ensure_ascii=False, indent=2), encoding='utf-8')
print('MATERIAL_ATLAS_COMPLETE', str(atlas_path), atlas_path.stat().st_size, flush=True)
