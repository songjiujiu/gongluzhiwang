"""Render a real Blender coastal comparison scene from the final editable models."""
import bpy
import math
import random
from pathlib import Path
from mathutils import Vector

ROOT=Path(__file__).resolve().parents[2]
ART=ROOT/'art/blender'
bpy.ops.wm.open_mainfile(filepath=str(ART/'roadking-assets.blend'))
scene=bpy.context.scene
random.seed(1049)
for obj in scene.objects:
    if obj.type!='CAMERA': obj.hide_render=True

def material(name,color,roughness=.5,metal=0):
    m=bpy.data.materials.new(name);m.use_nodes=True
    bs=m.node_tree.nodes.get('Principled BSDF')
    bs.inputs['Base Color'].default_value=(*color,1)
    bs.inputs['Roughness'].default_value=roughness;bs.inputs['Metallic'].default_value=metal
    return m

def box(name,location,size,mat,bevel=0):
    bpy.ops.mesh.primitive_cube_add(size=1,location=location)
    obj=bpy.context.object;obj.name=name;obj.dimensions=size
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    obj.data.materials.append(mat)
    if bevel:
        mod=obj.modifiers.new('Soft manufactured edges','BEVEL');mod.width=bevel;mod.segments=3
    return obj

def group(prefix,source,destination,copy=False):
    col=next(c for c in bpy.data.collections if c.name.startswith(prefix))
    for original in list(col.objects):
        if copy:
            obj=original.copy();scene.collection.objects.link(obj)
        else: obj=original
        obj.hide_render=False
        obj.location+=Vector(destination)-Vector(source)

group('01 /',(-3.1,-2,0),(0,0,.06))
group('02 /',(0,-2,0),(-2.85,18,.06))
group('04 /',(-3.1,4,0),(.1,26,.06))
group('03 /',(3.1,-2,0),(2.85,40,.06))
group('05 /',(.1,3.8,0),(6.6,9,.06))
asphalt=material('Reference scene / fine asphalt',(.072,.078,.082),.85)
nodes=asphalt.node_tree;noise=nodes.nodes.new('ShaderNodeTexNoise');noise.inputs['Scale'].default_value=95
bump=nodes.nodes.new('ShaderNodeBump');bump.inputs['Strength'].default_value=.20;bump.inputs['Distance'].default_value=.025
nodes.links.new(noise.outputs['Fac'],bump.inputs['Height']);nodes.links.new(bump.outputs['Normal'],nodes.nodes['Principled BSDF'].inputs['Normal'])
stone=material('Warm coastal rock',(.35,.29,.20),.92)
verge=material('Dry coastal verge',(.25,.23,.135),.92)
white=material('Aged lane paint',(.81,.80,.70),.65)
rail=material('Galvanized coastal guard rail',(.44,.46,.44),.32,.68)
orange=material('Reference safety cone orange',(1,.18,.02),.34)
rubber=material('Cone weighted rubber foot',(.018,.022,.025),.8)
box('Traffic cone weighted foot',(6.2,6,.11),(.66,.66,.16),rubber,.055)
for index,(low,high) in enumerate([(.19,.44),(.44,.59),(.59,.79),(.79,.90),(.90,1.12)]):
    # Separate closed tapered sections keep white safety bands part of the model.
    radius=lambda z:.29-(z-.19)*.24
    bpy.ops.mesh.primitive_cone_add(vertices=48,radius1=radius(low),radius2=radius(high),depth=high-low,location=(6.2,6,(low+high)/2))
    obj=bpy.context.object;obj.name='Traffic cone / white band' if index in [1,3] else 'Traffic cone / orange shell'
    obj.data.materials.append(white if index in [1,3] else orange)
    for poly in obj.data.polygons: poly.use_smooth=True
box('Three lane coastal road',(0,80,-.12),(9.5,210,.25),asphalt)
box('Left verge',(-8,80,-.15),(6.5,210,.35),verge)
box('Right raised verge',(6.8,80,-.30),(4.2,210,.7),stone)
for y in range(-20,183,6):
    for x in [-1.58,1.58]:box('Dashed white lane marking',(x,y,.016),(.11,3,.015),white)
for x in [-4.48,4.48]:box('Road edge line',(x,80,.016),(.12,210,.015),white)
for side in [-1,1]:
    box('Continuous steel guard rail',(side*5.0,80,.74),(.13,210,.21),rail,.025)
    for y in range(-20,181,4):box('Guard rail post',(side*5.0,y,.39),(.08,.11,.8),rail,.015)
for i,y in enumerate(range(-10,130,17)):
    group('06 /',(3.6,4.1,0),(-7.2-(i%2)*.6,y,0),copy=True)
    if i%2:group('06 /',(3.6,4.1,0),(8,y+6,-.04),copy=True)
for i in range(17):
    group('07 /',(4.0,1.0,0),(-6.1-random.random()*2,random.uniform(-10,160),-.04),copy=True)
sea=material('Sunlit blue sea',(.018,.10,.13),.18,.12)
nodes=sea.node_tree;noise=nodes.nodes.new('ShaderNodeTexNoise');noise.inputs['Scale'].default_value=1.15;noise.inputs['Detail'].default_value=3
bump=nodes.nodes.new('ShaderNodeBump');bump.inputs['Strength'].default_value=.35;bump.inputs['Distance'].default_value=.17
nodes.links.new(noise.outputs['Fac'],bump.inputs['Height']);nodes.links.new(bump.outputs['Normal'],nodes.nodes['Principled BSDF'].inputs['Normal'])
box('Coastal sea',(87,85,-.8),(160,270,.1),sea)
for i in range(19):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2,radius=1,location=(-16-random.random()*16,i*11,random.uniform(1,5)))
    obj=bpy.context.object;obj.name='Coastal cliff outcrop';obj.scale=(random.uniform(7,14),random.uniform(8,14),random.uniform(4,11));obj.data.materials.append(stone)
for location,scale in [((-23,100,8),(18,28,17)),((-27,145,13),(29,36,25)),((-35,185,11),(45,30,24))]:
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=3,radius=1,location=location)
    obj=bpy.context.object;obj.name='Distant coastal mountain';obj.scale=scale;obj.data.materials.append(stone)
world=bpy.data.worlds.new('Mediterranean golden hour');world.use_nodes=True;scene.world=world
sky=world.node_tree.nodes.new('ShaderNodeTexSky')
sky_types=sky.bl_rna.properties['sky_type'].enum_items.keys()
sky.sky_type='MULTIPLE_SCATTERING' if 'MULTIPLE_SCATTERING' in sky_types else 'NISHITA'
for key,value in {'sun_elevation':math.radians(14),'sun_rotation':math.radians(125),'altitude':30,'air_density':1.1,'dust_density':1.7}.items():
    if hasattr(sky,key):setattr(sky,key,value)
world.node_tree.links.new(sky.outputs['Color'],world.node_tree.nodes['Background'].inputs['Color']);world.node_tree.nodes['Background'].inputs['Strength'].default_value=.20
data=bpy.data.lights.new('Golden hour sun','SUN');data.energy=2.0;data.color=(1,.76,.48);data.angle=math.radians(8)
sun=bpy.data.objects.new('Golden hour sun',data);scene.collection.objects.link(sun);sun.rotation_euler=(math.radians(65),math.radians(-20),math.radians(-35))
camera=scene.camera;camera.data.type='PERSP';camera.data.lens=47
camera.location=(-4.3,-8.5,3.5);camera.rotation_euler=(Vector((0,2.8,1.0))-camera.location).to_track_quat('-Z','Y').to_euler()
scene.render.engine='CYCLES';scene.cycles.samples=48;scene.cycles.use_denoising=True
scene.render.resolution_x=1200;scene.render.resolution_y=800;scene.render.resolution_percentage=100
scene.render.film_transparent=False;scene.render.filepath=str(ART/'reference-scene.png')
scene.view_settings.exposure=-.8
scene.render.image_settings.color_mode='RGB'
bpy.ops.wm.save_as_mainfile(filepath=str(ART/'reference-scene.blend'))
bpy.ops.render.render(write_still=True)
print('REFERENCE_SCENE_RENDERED',scene.render.filepath,flush=True)
