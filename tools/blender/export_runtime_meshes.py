"""Export evaluated Blender geometry into compact local WebGL vertex buffers."""
import bpy
import json
import struct
from pathlib import Path
from mathutils import Vector

ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'公路之王/assets/scene'
OUT.mkdir(parents=True,exist_ok=True)
bpy.ops.wm.open_mainfile(filepath=str(ROOT/'art/blender/roadking-assets.blend'))
sources={'player':('01 /',(-3.1,-2,0)),'suv':('02 /',(0,-2,0)),
         'barrier':('05 /',(.1,3.8,0)),'tree':('06 /',(3.6,4.1,0)),'rock':('07 /',(4,1,0))}
buffer=bytearray();manifest={'version':1,'modelRevision':'v3-curved-fastback','stride':12,'positionScale':2048,'normalScale':32767,'coordinateSystem':'X right, Y up, -Z forward','models':{}}
for name,(prefix,origin) in sources.items():
    col=next(c for c in bpy.data.collections if c.name.startswith(prefix))
    groups={}
    for original in col.objects:
        if original.type not in ['MESH','CURVE']:continue
        if 'Tire tread' in original.name:continue
        # Evaluate every modifier, then simplify a temporary object without
        # touching the detailed source. Smooth corner normals are exported.
        dg=bpy.context.evaluated_depsgraph_get()
        evaluated=original.evaluated_get(dg)
        data=bpy.data.meshes.new_from_object(evaluated,depsgraph=dg)
        temp=bpy.data.objects.new('Export temporary',data);bpy.context.scene.collection.objects.link(temp)
        if len(data.polygons)>160:
            bpy.context.view_layer.objects.active=temp
            dec=temp.modifiers.new('Runtime simplification','DECIMATE');dec.ratio=.16
            bpy.ops.object.modifier_apply(modifier=dec.name)
            data=temp.data
        data.calc_loop_triangles()
        normals=data.corner_normals
        for triangle in data.loop_triangles:
            idx=triangle.material_index
            material=data.materials[idx] if idx<len(data.materials) else None
            if material is None:continue
            key=material.name
            if key not in groups:
                bs=material.node_tree.nodes.get('Principled BSDF')
                groups[key]={'material':{'name':key,'color':list(bs.inputs['Base Color'].default_value)[:3],
                  'metal':float(bs.inputs['Metallic'].default_value),'rough':float(bs.inputs['Roughness'].default_value),
                  'emission':float(bs.inputs['Emission Strength'].default_value),
                  'paint':key.startswith(('LAGOON','PEARL'))},'vertices':[]}
            for vertex_index,loop in zip(triangle.vertices,triangle.loops):
                p=original.matrix_world@data.vertices[vertex_index].co-Vector(origin)
                n=original.matrix_world.to_3x3().inverted().transposed()@normals[loop].vector;n.normalize()
                groups[key]['vertices'].extend((p.x,p.z,-p.y,n.x,n.z,-n.y))
        bpy.data.objects.remove(temp,do_unlink=True)
        bpy.data.meshes.remove(data)
    batches=[]
    for group in groups.values():
        values=group.pop('vertices');offset=len(buffer)
        packed=[max(-32767,min(32767,round(value*(2048 if i%6<3 else 32767)))) for i,value in enumerate(values)]
        buffer.extend(struct.pack('<'+'h'*len(packed),*packed))
        batches.append({'offset':offset,'count':len(values)//6,**group})
    manifest['models'][name]=batches
    print('RUNTIME_MODEL',name,sum(b['count']//3 for b in batches),'triangles',flush=True)
(OUT/'meshes.bin').write_bytes(buffer)
(OUT/'meshes.json').write_text(json.dumps(manifest,separators=(',',':')),encoding='utf-8')
print('RUNTIME_EXPORT_COMPLETE',len(buffer),'bytes',flush=True)
