"""Build an editable night-road lamp and append its compact runtime geometry."""
import bpy
import json
import math
import struct
from pathlib import Path
from mathutils import Vector

ROOT=Path(__file__).resolve().parents[2]
bpy.ops.wm.read_factory_settings(use_empty=True)
scene=bpy.context.scene
collection=bpy.data.collections.new('Night road / streetlamp')
scene.collection.children.link(collection)

def material(name,color,metal=0,emission=0):
    mat=bpy.data.materials.new(name);mat.diffuse_color=(*color,1);mat.use_nodes=True
    bs=mat.node_tree.nodes.get('Principled BSDF')
    bs.inputs['Base Color'].default_value=(*color,1)
    bs.inputs['Metallic'].default_value=metal
    bs.inputs['Roughness'].default_value=.38
    bs.inputs['Emission Color'].default_value=(*color,1)
    bs.inputs['Emission Strength'].default_value=emission
    return mat

steel=material('Night lamp / powder-coated steel',(.10,.14,.19),.65)
base=material('Night lamp / concrete foot',(.26,.29,.32))
led=material('Night lamp / warm LED', (1,.72,.35),emission=5)
reflector=material('Night lamp / reflector',(.52,.75,1),emission=.7)

def move(obj,name,mat):
    obj.name=name
    for col in list(obj.users_collection):col.objects.unlink(obj)
    collection.objects.link(obj);obj.data.materials.append(mat)
    return obj

def box(name,center,size,mat,bevel=0):
    bpy.ops.mesh.primitive_cube_add(size=1,location=center)
    obj=move(bpy.context.object,name,mat);obj.dimensions=size
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    if bevel:
        mod=obj.modifiers.new('Rounded fabricated edges','BEVEL');mod.width=bevel;mod.segments=2
        bpy.context.view_layer.objects.active=obj;bpy.ops.object.modifier_apply(modifier=mod.name)
    return obj

def rod(name,a,b,radius,mat):
    a,b=Vector(a),Vector(b)
    bpy.ops.mesh.primitive_cylinder_add(vertices=12,radius=radius,depth=(b-a).length,location=(a+b)/2)
    obj=move(bpy.context.object,name,mat);obj.rotation_euler=(b-a).to_track_quat('Z','Y').to_euler()
    return obj

# Blender Z up, +Y road direction. Runtime swaps Z/Y as in the base exporter.
box('Anchored footing',(0,0,.16),(.48,.48,.32),base,.06)
rod('Tapered-looking mast',(0,0,.3),(0,0,7.3),.085,steel)
rod('Angled outreach',(0,0,6.95),(-.55,0,7.65),.075,steel)
rod('Cantilever arm',(-.55,0,7.65),(-1.8,0,7.65),.07,steel)
box('LED weatherproof housing',(-1.83,0,7.60),(.8,.38,.16),steel,.06)
box('LED luminous panel',(-1.83,0,7.50),(.64,.29,.035),led,.015)
box('Blue roadside reflector',(-.096,0,.85),(.025,.15,.30),reflector,.006)

# Pack only the lamp meshes. Light and preview floor remain editable in Blender.
out=ROOT/'公路之王/assets/scene'
manifest=json.loads((out/'meshes.json').read_text(encoding='utf-8'))
buffer=bytearray((out/'meshes.bin').read_bytes())
old=manifest['models'].pop('streetlamp',None)
if old:buffer=buffer[:min(batch['offset'] for batch in old)]
groups={}
for obj in collection.objects:
    obj.data.calc_loop_triangles()
    for tri in obj.data.loop_triangles:
        mat=obj.data.materials[tri.material_index];bs=mat.node_tree.nodes.get('Principled BSDF')
        group=groups.setdefault(mat.name,{'material':{'name':mat.name,'color':list(bs.inputs['Base Color'].default_value)[:3],'metal':float(bs.inputs['Metallic'].default_value),'rough':.38,'emission':float(bs.inputs['Emission Strength'].default_value),'paint':False},'vertices':[]})
        for index in tri.vertices:
            p=obj.matrix_world@obj.data.vertices[index].co
            n=obj.matrix_world.to_3x3().inverted().transposed()@tri.normal;n.normalize()
            group['vertices'].extend((p.x,p.z,-p.y,n.x,n.z,-n.y))
batches=[]
for group in groups.values():
    vertices=group.pop('vertices');offset=len(buffer)
    packed=[max(-32767,min(32767,round(v*(2048 if i%6<3 else 32767)))) for i,v in enumerate(vertices)]
    buffer.extend(struct.pack('<'+'h'*len(packed),*packed))
    batches.append({'offset':offset,'count':len(vertices)//6,**group})
manifest['models']['streetlamp']=batches
manifest['nightRevision']='night-road-v1'
(out/'meshes.bin').write_bytes(buffer)
(out/'meshes.json').write_text(json.dumps(manifest,separators=(',',':')),encoding='utf-8')

scene.world=bpy.data.worlds.new('Midnight blue environment');scene.world.use_nodes=True
scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.012,.023,.06,1)
scene.world.node_tree.nodes['Background'].inputs[1].default_value=.25
floor=material('Preview asphalt',(.035,.05,.075))
bpy.ops.mesh.primitive_plane_add(size=30,location=(-2,0,-.01));bpy.context.object.data.materials.append(floor)
light=bpy.data.lights.new('LED pool of warm light','AREA');light.energy=420;light.color=(1,.72,.4);light.shape='DISK';light.size=1.8
obj=bpy.data.objects.new(light.name,light);scene.collection.objects.link(obj);obj.location=(-1.83,0,7.43)
fill=bpy.data.lights.new('Cool moon fill','AREA');fill.energy=900;fill.color=(.28,.48,1);fill.size=8
obj=bpy.data.objects.new(fill.name,fill);scene.collection.objects.link(obj);obj.location=(1,3,9)
camera=bpy.data.cameras.new('Night model inspection');obj=bpy.data.objects.new(camera.name,camera);scene.collection.objects.link(obj)
obj.location=(11,-17,11);obj.rotation_euler=(Vector((-1,0,3.6))-obj.location).to_track_quat('-Z','Y').to_euler();camera.type='ORTHO';camera.ortho_scale=12;scene.camera=obj
scene.render.engine='CYCLES';scene.cycles.samples=24
scene.render.resolution_x=640;scene.render.resolution_y=800;scene.render.resolution_percentage=100
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'art/blender/night-road.blend'))
scene.render.filepath=str(ROOT/'art/blender/night-road.png');bpy.ops.render.render(write_still=True)
print('NIGHT_MODEL_EXPORTED',sum(b['count'] for b in batches),'vertices',flush=True)
