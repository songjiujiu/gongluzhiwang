"""Inspect the delivered editable source; never substitute a bitmap for geometry."""
import bpy
import json
import math
from pathlib import Path

ROOT=Path(__file__).resolve().parents[2]
bpy.ops.wm.open_mainfile(filepath=str(ROOT/'art/blender/roadking-assets.blend'))
groups=[]
for prefix in ['01 /','02 /','03 /','04 /']:
    col=next(c for c in bpy.data.collections if c.name.startswith(prefix))
    bodies=[o for o in col.objects if o.name.startswith('Continuous sculpted body')]
    assert len(bodies)==1
    body=bodies[0]
    assert body.type=='MESH' and len(body.data.vertices)>1000
    assert all(math.isfinite(v) for vertex in body.data.vertices for v in vertex.co)
    assert any(o.name.startswith('Full-width red LED connection') for o in col.objects)
    assert sum(o.name.startswith('Rounded performance tire') for o in col.objects)==4
    assert not any('racing stripe' in o.name.lower() for o in col.objects)
    assert all(len(o.data.vertices)>0 for o in col.objects if o.type=='MESH')
    groups.append({'name':col.name,'objects':len(col.objects),'bodyVertices':len(body.data.vertices),
                   'bodyPolygons':len(body.data.polygons),'bodyDimensions':[round(x,3) for x in body.dimensions],
                   'actualMeshes':sum(o.type=='MESH' for o in col.objects),'curves':sum(o.type=='CURVE' for o in col.objects)})
assert any(o.name.startswith('Upper warning board') for o in bpy.data.objects)
assert any(o.name.startswith('Lower warning board') for o in bpy.data.objects)
report={'kind':'Blender source geometry inspection; image-reference resemblance is assessed visually',
        'blenderVersion':bpy.app.version_string,'groups':groups,'passed':True}
(ROOT/'art/blender/model-verification.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print('MODEL_SOURCE_VERIFIED',json.dumps(report),flush=True)
