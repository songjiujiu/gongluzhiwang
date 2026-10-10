"""Export indexed evaluated geometry and a faithful, independently shared hero car."""
import bpy
import hashlib
import json
import math
import struct
from pathlib import Path
from mathutils import Vector

ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'公路之王/assets/scene'
OUT.mkdir(parents=True,exist_ok=True)
SOURCE=ROOT/'art/blender/roadking-assets.blend'

# Preserve the independent lamp geometry without rewriting its source or preview.
lamp_batches=[]
if (OUT/'meshes.json').exists() and (OUT/'meshes.bin').exists():
    previous=json.loads((OUT/'meshes.json').read_text(encoding='utf-8'))
    previous_binary=(OUT/'meshes.bin').read_bytes()
    for batch in previous.get('models',{}).get('streetlamp',[]):
        assert 'indexOffset' not in batch, 'Streetlamp exporter uses plain vertices'
        start=batch['offset'];end=start+batch['count']*12
        assert 0<=start<end<=len(previous_binary)
        lamp_batches.append((batch,previous_binary[start:end]))

bpy.ops.wm.open_mainfile(filepath=str(SOURCE))
sources={'player':('01 /',(-3.1,-2,0)),'suv':('02 /',(0,-2,0)),
         'barrier':('05 /',(.1,3.8,0)),'tree':('06 /',(3.6,4.1,0)),
         'rock':('07 /',(4,1,0))}
buffer=bytearray()
manifest={'version':2,'modelRevision':'v4-faithful-hero-indexed','stride':12,
          'positionScale':2048,'normalScale':32767,
          'coordinateSystem':'X right, Y up, -Z forward','models':{}}
report={'source':str(SOURCE.relative_to(ROOT)).replace('\\','/'),
        'sourceSha256':hashlib.sha256(SOURCE.read_bytes()).hexdigest(),
        'blenderVersion':bpy.app.version_string,
        'packing':'Int16 position/normal tuples + Uint16 triangle indices',
        'normalValidation':'finite, normalized corner normals before quantization',
        'models':{}}

def hero_material(name):
    return name.startswith(('LAGOON','Smoked panoramic glass','Tire rubber','Ruby tail lamp'))

def material_description(material):
    bs=material.node_tree.nodes.get('Principled BSDF')
    return {'name':material.name,'color':list(bs.inputs['Base Color'].default_value)[:3],
            'metal':float(bs.inputs['Metallic'].default_value),
            'rough':float(bs.inputs['Roughness'].default_value),
            'coat':float(bs.inputs['Coat Weight'].default_value),
            'coatRough':float(bs.inputs['Coat Roughness'].default_value),
            'emission':float(bs.inputs['Emission Strength'].default_value),
            'paint':material.name.startswith(('LAGOON','PEARL'))}

def simplification_ratio(original,hero):
    if hero:
        if original.name.startswith(('Continuous sculpted body','Curved tinted glazing',
             'Curved painted roof','Full-width red LED','Angular red LED','Tail lamp lower')):
            return 1.0
        if original.name.startswith('Rounded performance tire'):
            return .5
    return .16

def collect_geometry(name,prefix,origin,hero=False):
    col=next(c for c in bpy.data.collections if c.name.startswith(prefix))
    groups={};parts=[]
    for original in col.objects:
        if original.type not in ['MESH','CURVE'] or 'Tire tread' in original.name:
            continue
        if hero and not any(hero_material(m.name) for m in original.data.materials if m):
            continue
        dg=bpy.context.evaluated_depsgraph_get()
        evaluated=original.evaluated_get(dg)
        data=bpy.data.meshes.new_from_object(evaluated,depsgraph=dg)
        data.calc_loop_triangles()
        before=len(data.loop_triangles)
        temp=bpy.data.objects.new('Export temporary',data)
        bpy.context.scene.collection.objects.link(temp)
        ratio=simplification_ratio(original,hero)
        if len(data.polygons)>160 and ratio<1:
            bpy.context.view_layer.objects.active=temp
            dec=temp.modifiers.new('Runtime simplification','DECIMATE');dec.ratio=ratio
            bpy.ops.object.modifier_apply(modifier=dec.name)
            data=temp.data
        data.calc_loop_triangles()
        normals=data.corner_normals
        normal_matrix=original.matrix_world.to_3x3().inverted().transposed()
        exported=0;degenerate=0;repaired_normals=0
        for triangle in data.loop_triangles:
            idx=triangle.material_index
            material=data.materials[idx] if idx<len(data.materials) else None
            if material is None or (hero and not hero_material(material.name)):
                continue
            # Some tightly bevelled source trim contains collapsed triangles.
            # They have no visible area and their zero normals cannot be shaded.
            if triangle.area<=1e-12:
                degenerate+=1
                continue
            if material.name not in groups:
                groups[material.name]={'material':material_description(material),'vertices':[]}
            group=groups[material.name]
            for vertex_index,loop in zip(triangle.vertices,triangle.loops):
                p=original.matrix_world@data.vertices[vertex_index].co-Vector(origin)
                n=normal_matrix@normals[loop].vector
                assert all(math.isfinite(v) for v in (*p,*n)), original.name
                if n.length<=1e-6:
                    n=normal_matrix@triangle.normal
                    repaired_normals+=1
                assert n.length>1e-6, 'Zero normal: '+original.name
                n.normalize()
                group['vertices'].extend((p.x,p.z,-p.y,n.x,n.z,-n.y))
            exported+=1
        parts.append({'name':original.name,'sourceTriangles':before,
                      'evaluatedTrianglesAfter':len(data.loop_triangles),
                      'exportedTriangles':exported,'simplificationRatio':ratio if before!=len(data.loop_triangles) else 1,
                      'customNormals':bool(data.has_custom_normals),
                      'degenerateTrianglesSkipped':degenerate,'cornerNormalsRepaired':repaired_normals})
        bpy.data.objects.remove(temp,do_unlink=True)
        bpy.data.meshes.remove(data)
    report['models'][name]={'parts':parts,'sourceTriangles':sum(p['sourceTriangles'] for p in parts),
                           'newTriangles':sum(p['exportedTriangles'] for p in parts)}
    return groups

def pack_groups(groups):
    batches=[]
    for group in groups.values():
        values=group['vertices'];unique=[];indices=[];lookup={}
        for start in range(0,len(values),6):
            vertex=tuple(round(values[start+i]*(2048 if i<3 else 32767)) for i in range(6))
            assert all(-32767<=v<=32767 for v in vertex), 'Quantization would clip geometry'
            index=lookup.get(vertex)
            if index is None:
                index=len(lookup);lookup[vertex]=index;unique.extend(vertex)
            indices.append(index)
        assert len(lookup)<65536, 'Split material before exporting Uint16 indices'
        offset=len(buffer)
        buffer.extend(struct.pack('<'+'h'*len(unique),*unique))
        index_offset=len(buffer)
        buffer.extend(struct.pack('<'+'H'*len(indices),*indices))
        batches.append({'offset':offset,'vertexCount':len(lookup),'indexOffset':index_offset,
                        'count':len(indices),'material':group['material']})
    return batches

for name,(prefix,origin) in sources.items():
    batches=pack_groups(collect_geometry(name,prefix,origin))
    manifest['models'][name]=batches
    print('RUNTIME_MODEL',name,sum(b['count']//3 for b in batches),'triangles',flush=True)

hero_groups=collect_geometry('playerHero',*sources['player'],hero=True)
hero_batches={batch['material']['name']:batch for batch in pack_groups(hero_groups)}
manifest['models']['playerHero']=[hero_batches.get(batch['material']['name'],batch)
                                  for batch in manifest['models']['player']]
report['models']['playerHero']['sharedMaterials']=[batch['material']['name']
    for batch in manifest['models']['player'] if batch['material']['name'] not in hero_batches]
report['models']['playerHero']['runtimeTriangles']=sum(b['count']//3 for b in manifest['models']['playerHero'])
print('RUNTIME_MODEL playerHero',report['models']['playerHero']['runtimeTriangles'],'triangles',flush=True)

if lamp_batches:
    manifest['models']['streetlamp']=[]
    for old_batch,vertices in lamp_batches:
        batch={**old_batch,'offset':len(buffer),'material':{**old_batch['material'],'coat':0,'coatRough':.03}}
        buffer.extend(vertices);manifest['models']['streetlamp'].append(batch)
    manifest['nightRevision']='night-road-v1'

(OUT/'meshes.bin').write_bytes(buffer)
(OUT/'meshes.json').write_text(json.dumps(manifest,separators=(',',':')),encoding='utf-8')
if not lamp_batches:
    import runpy
    runpy.run_path(str(ROOT/'tools/blender/build_night_scene.py'),run_name='__main__')

report['binaryBytes']=(OUT/'meshes.bin').stat().st_size
report['binarySha256']=hashlib.sha256((OUT/'meshes.bin').read_bytes()).hexdigest()
report['manifestSha256']=hashlib.sha256((OUT/'meshes.json').read_bytes()).hexdigest()
report['passed']=True
(ROOT/'art/blender/runtime-geometry.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print('RUNTIME_EXPORT_COMPLETE',report['binaryBytes'],'bytes; normals and index ranges verified',flush=True)
