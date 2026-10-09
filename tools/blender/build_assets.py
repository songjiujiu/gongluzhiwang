"""Road King — reference-inspired Blender models and reproducible sprite renders.

Run: blender --background --threads 6 --python tools/blender/build_assets.py
Optional: -- --only car-player (also writes an editable .blend source).
All meshes are generated locally. The reference image is an appearance target,
not measured multi-view geometry; the output is a reconstruction, not a replica.
"""
import bpy
import math
import json
import sys
from array import array
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / '公路之王' / 'assets' / 'blender'
ART = ROOT / 'art' / 'blender'
OUT.mkdir(parents=True, exist_ok=True)
ART.mkdir(parents=True, exist_ok=True)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
for col in list(bpy.data.collections):
    if col.name != 'Collection':
        bpy.data.collections.remove(col)
scene = bpy.context.scene
bpy.context.preferences.filepaths.save_version = 0
if hasattr(bpy.context.preferences.filepaths, 'use_save_preview'):
    bpy.context.preferences.filepaths.use_save_preview = False
scene.render.engine = 'CYCLES'
scene.cycles.device = 'CPU'
scene.cycles.samples = 64
scene.cycles.use_denoising = True
scene.cycles.max_bounces = 5
scene.render.threads_mode = 'FIXED'
scene.render.threads = 6
scene.render.image_settings.file_format = 'PNG'
scene.render.image_settings.color_mode = 'RGBA'
scene.render.film_transparent = True
scene.render.resolution_percentage = 100
scene.view_settings.view_transform = 'AgX'
scene.view_settings.look = 'AgX - Medium High Contrast'
scene.world.color = (0.3, 0.3, 0.3)
scene.world.use_nodes = True
scene.world.node_tree.nodes['Background'].inputs['Color'].default_value = (0.48, 0.63, 0.75, 1)
scene.world.node_tree.nodes['Background'].inputs['Strength'].default_value = 0.55

def mat(name, color, metallic=0.0, roughness=0.4, emission=0.0, coat=0.0):
    m = bpy.data.materials.new(name)
    m.diffuse_color = (*color, 1)
    m.use_nodes = True
    bs = m.node_tree.nodes.get('Principled BSDF')
    bs.inputs['Base Color'].default_value = (*color, 1)
    bs.inputs['Metallic'].default_value = metallic
    bs.inputs['Roughness'].default_value = roughness
    bs.inputs['Coat Weight'].default_value = coat
    if emission:
        bs.inputs['Emission Color'].default_value = (*color, 1)
        bs.inputs['Emission Strength'].default_value = emission
    return m

M = {
    'teal': mat('LAGOON / multilayer turquoise lacquer', (0.012, 0.36, 0.41), .82, .19, coat=.65),
    'silver': mat('PEARL / brushed titanium', (.48, .51, .53), .78, .23, coat=.3),
    'blue': mat('INDIGO / deep metallic', (.055, .12, .37), .65, .24, coat=.45),
    'orange': mat('EMBER / orange lacquer', (.76, .18, .035), .75, .21, coat=.45),
    'white': mat('Ivory reflective paint', (.92, .94, .88), .12, .32),
    'glass': mat('Smoked panoramic glass', (.018, .052, .071), .38, .14, coat=.8),
    'rubber': mat('Tire rubber', (.018, .023, .028), 0, .58),
    'black': mat('Graphite aero trim', (.025, .037, .05), .2, .33),
    'metal': mat('Diamond cut alloy', (.68, .73, .77), .88, .21),
    'red': mat('Ruby tail lamp lenses', (.8, .012, .023), .1, .2, .5),
    'light': mat('Warm white running lights', (.9, .96, 1), .1, .18, 1),
    'amber': mat('Amber warning lens', (1, .34, .012), .1, .22, .7),
    'cone': mat('Safety tangerine', (1, .26, .035), .05, .38),
    'redpaint': mat('Safety vermilion', (.85, .06, .035), .08, .38),
    'trunk': mat('Palm trunk honey bark', (.34, .16, .065), 0, .8),
    'leaf': mat('Palm jade green', (.014, .14, .037), .0, .62),
    'leaflight': mat('Palm leaf sunlight', (.055, .27, .07), .0, .6),
    'rock': mat('Coastal sandstone', (.46, .40, .30), .0, .87),
    'rocklight': mat('Warm stone highlights', (.64, .57, .43), .0, .9),
}

COL = None
def add(obj, name, material=None):
    obj.name = name
    for c in list(obj.users_collection):
        c.objects.unlink(obj)
    COL.objects.link(obj)
    if material:
        obj.data.materials.append(material)
    return obj

def bevel(obj, amount=.06, segments=3):
    m = obj.modifiers.new('Crafted soft edges', 'BEVEL')
    m.width = amount
    m.segments = segments
    m = obj.modifiers.new('Weighted corner normals', 'WEIGHTED_NORMAL')
    return obj

def cube(name, pos, dims, material, soft=.04):
    bpy.ops.mesh.primitive_cube_add(size=1, location=pos)
    obj = add(bpy.context.object, name, material)
    obj.dimensions = dims
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if soft:
        bevel(obj, soft)
    return obj

def mesh(name, vertices, faces, material, soft=0):
    data = bpy.data.meshes.new(name)
    data.from_pydata(vertices, [], faces)
    data.update()
    obj = bpy.data.objects.new(name, data)
    COL.objects.link(obj)
    data.materials.append(material)
    if soft:
        bevel(obj, soft)
    return obj

def cylinder(name, pos, radius, depth, material, rotation=(0, 0, 0), vertices=32, soft=.02):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=pos, rotation=rotation)
    obj = add(bpy.context.object, name, material)
    if soft:
        bevel(obj, soft, 2)
    for p in obj.data.polygons:
        p.use_smooth = True
    return obj

def segment(name, a, b, radius, material, vertices=12):
    center = (Vector(a) + Vector(b)) / 2
    delta = Vector(b) - Vector(a)
    obj = cylinder(name, center, radius, delta.length, material, vertices=vertices)
    obj.rotation_euler = delta.to_track_quat('Z', 'Y').to_euler()
    return obj

def loft(name, stations, material):
    # Each station: longitudinal Y, half-width, lower body Z, shoulder Z, crown Z.
    verts=[]
    for y, w, low, shoulder, crown in stations:
        for x,z in [(-w*.84, low),(-w,low+.16),(-w,shoulder-.07),(-w*.82,shoulder),(-w*.5,crown),
                    (w*.5,crown),(w*.82,shoulder),(w,shoulder-.07),(w,low+.16),(w*.84,low)]:
            verts.append((x,y,z))
    faces=[]
    n=10
    faces.append(tuple(reversed(range(n))))
    for j in range(len(stations)-1):
        for i in range(n):
            faces.append((j*n+i,j*n+(i+1)%n,(j+1)*n+(i+1)%n,(j+1)*n+i))
    faces.append(tuple((len(stations)-1)*n+i for i in range(n)))
    return mesh(name,verts,faces,material,.055)

def wheel(x,y,z, sporty=True):
    side=1 if x>0 else -1
    cylinder('Performance tire', (x,y,z), .43 if sporty else .47, .28, M['rubber'], (0,math.pi/2,0), 40,.04)
    face=x+side*.151
    cylinder('Alloy wheel lip',(face,y,z),.31,.025,M['metal'],(0,math.pi/2,0),40,.012)
    cylinder('Brake shadow',(face+side*.018,y,z),.266,.031,M['black'],(0,math.pi/2,0),32,.007)
    for i in range(5):
        angle=i*math.tau/5
        a=(face+side*.04,y+math.sin(angle)*.06,z+math.cos(angle)*.06)
        b=(face+side*.04,y+math.sin(angle+.12)*.255,z+math.cos(angle+.12)*.255)
        segment('Forged radial spoke',a,b,.039,M['metal'],8)
    cylinder('Hub cap',(face+side*.055,y,z),.092,.022,M['metal'],(0,math.pi/2,0),24,.01)

# The v2 control cages and detailing live in a separate, editable module.
import importlib.util
spec = importlib.util.spec_from_file_location('reference_models', Path(__file__).with_name('reference_models.py'))
reference_models = importlib.util.module_from_spec(spec)
spec.loader.exec_module(reference_models)
def car(name, color, kind='sport', stripes=False):
    return reference_models.build_car(globals(), name, color, kind, stripes)

assets={}
assets['car-player']=car('01 / LAGOON GT — player','teal','sport',False)
assets['car-silver']=car('02 / PEARL SUV — traffic','silver','suv')
assets['car-blue']=car('03 / INDIGO sedan — traffic','blue','sedan')
assets['car-orange']=car('04 / EMBER sedan — traffic','orange','sedan')

COL=bpy.data.collections.new('05 / Road works — striped barricade')
scene.collection.children.link(COL)
assets['barrier']=COL
# Asphalt dust and pores, a procedural material shared by concrete bases.
stone=M['rocklight'].node_tree
noise=stone.nodes.new('ShaderNodeTexNoise');noise.inputs['Scale'].default_value=28
bump=stone.nodes.new('ShaderNodeBump');bump.inputs['Strength'].default_value=.22;bump.inputs['Distance'].default_value=.06
stone.links.new(noise.outputs['Fac'],bump.inputs['Height']);stone.links.new(bump.outputs['Normal'],stone.nodes['Principled BSDF'].inputs['Normal'])
for side in [-1,1]:
    cube('Weighted road foot',(side*.96,0,.10),(.67,.86,.2),M['rocklight'],.055)
    cube('Galvanized support post',(side*.96,0,.64),(.10,.12,1.0),M['metal'],.025)
cube('Upper warning board',(0,-.03,1.10),(2.85,.16,.28),M['white'],.025)
cube('Lower warning board',(0,-.03,.61),(2.85,.16,.28),M['white'],.025)
# Raised diagonal stripes, clipped within board edges.
def clip(poly, axis, limit, keep_greater):
    out=[]
    for i,a in enumerate(poly):
        b=poly[(i+1)%len(poly)]
        ain=a[axis]>=limit if keep_greater else a[axis]<=limit
        bin=b[axis]>=limit if keep_greater else b[axis]<=limit
        if ain: out.append(a)
        if ain != bin:
            t=(limit-a[axis])/(b[axis]-a[axis])
            out.append(tuple(a[j]+t*(b[j]-a[j]) for j in range(2)))
    return out
for i in range(-3,5):
    x=i*.7
    poly=[(x,.56),(x+.34,.56),(x+.74,1.25),(x+.40,1.25)]
    poly=clip(clip(poly,0,-1.35,True),0,1.35,False)
    for low,high in [(.97,1.23),(.48,.74)]:
        stripe=clip(clip(poly,1,low,True),1,high,False)
        if len(stripe)>2:
            mesh('Orange diagonal safety stripe',[(a,-.116,b) for a,b in stripe],[tuple(range(len(stripe)))],M['cone'])
for side in [-1,1]:
    cube('Warning beacon base',(side*1.1,-.01,1.32),(.28,.25,.085),M['black'],.028)
    cylinder('Amber warning beacon',(side*1.1,-.01,1.45),.105,.22,M['amber'],vertices=24,soft=.035)
    cube('Metal cap bolt',(side*1.28,-.177,1.17),(.042,.02,.042),M['metal'],.01)

COL=bpy.data.collections.new('06 / Coastal palm — low poly sculpt')
scene.collection.children.link(COL)
assets['tree']=COL
# Curved segmented trunk; leaf meshes are folded along a central spine.
for j in range(9):
    z=j*.38
    x=.11*math.sin(j*.20)
    a=(x,0,z)
    b=(.11*math.sin((j+1)*.20),0,z+.42)
    trunk=segment('Tapered palm trunk section',a,b,.18-j*.009,M['trunk'],24)
    cylinder('Bark growth ring',(x,0,z+.12),.19-j*.009,.055,M['rock'],vertices=24,soft=.005)
for i in range(9):
    ang=i*math.tau/9
    length=1.65+(i%3)*.13
    verts=[]
    for j in range(6):
        t=j/5
        r=t*length
        height=3.36+.54*math.sin(t*math.pi)-.49*t
        w=.27*math.sin(t*math.pi)**.65
        cx=.11+math.cos(ang)*r
        cy=math.sin(ang)*r
        verts.extend([(cx-math.sin(ang)*w,cy+math.cos(ang)*w,height-.09),
                      (cx,cy,height+.05),
                      (cx+math.sin(ang)*w,cy-math.cos(ang)*w,height-.09)])
    faces=[]
    for j in range(5):
        faces.extend([(j*3,j*3+1,(j+1)*3+1,(j+1)*3),(j*3+1,j*3+2,(j+1)*3+2,(j+1)*3+1)])
    leaf=mesh('Folded sculpted palm frond',verts,faces,M['leaflight'] if i%2 else M['leaf'])
    for polygon in leaf.data.polygons: polygon.use_smooth=True
    sub=leaf.modifiers.new('Curved frond surface','SUBSURF');sub.levels=2
    solid=leaf.modifiers.new('Leaf thickness','SOLIDIFY');solid.thickness=.012
    # Fine individual leaflets make a recognizable feathered palm silhouette.
    for j in range(1,14):
        t=j/15;r=t*length;cx=.11+math.cos(ang)*r;cy=math.sin(ang)*r;z=3.36+.54*math.sin(t*math.pi)-.49*t
        for side in [-1,1]:
            reach=.34*math.sin(t*math.pi)**.6
            tip=(cx-math.sin(ang)*side*reach+math.cos(ang)*.13,cy+math.cos(ang)*side*reach+math.sin(ang)*.13,z-.16)
            mesh('Palm leaflet',[(cx,cy,z+.04),(cx+math.cos(ang)*.08,cy+math.sin(ang)*.08,z+.035),tip],[(0,1,2)],M['leaflight'] if i%2 else M['leaf'])
for x,y,z in [(.04,-.12,3.34),(.23,-.04,3.36),(.12,.14,3.29)]:
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2,radius=.15,location=(x,y,z))
    add(bpy.context.object,'Palm coconut',M['trunk'])

COL=bpy.data.collections.new('07 / Sandstone verge rocks')
scene.collection.children.link(COL)
assets['rock']=COL
for i,(p,s) in enumerate([((0,0,.42),(1.10,.75,.68)),((.80,.14,.23),(.55,.54,.37)),((-.64,-.30,.16),(.42,.36,.28))]):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2,radius=1,location=p)
    obj=add(bpy.context.object,'Faceted coastal boulder',M['rocklight'] if i==1 else M['rock'])
    obj.scale=s
    obj.rotation_euler=(.10*i,.1,.45*i)
    bevel(obj,.045,2)

# Studio lighting keeps every sprite consistent and immediately recognizable.
rig=bpy.data.collections.new('LIGHTING / warm coastal studio')
scene.collection.children.link(rig)
COL=rig
def area(name,pos,color,power,size,target=(0,0,0)):
    data=bpy.data.lights.new(name,'AREA');data.energy=power;data.color=color;data.shape='DISK';data.size=size
    obj=bpy.data.objects.new(name,data);rig.objects.link(obj);obj.location=pos
    obj.rotation_euler=(Vector(target)-obj.location).to_track_quat('-Z','Y').to_euler()
    return obj
area('Golden key / upper left',(-4,-5,9),(1,.78,.54),1100,5)
area('Sky fill / cool right',(5,-1,5),(.50,.78,1),850,4)
area('Warm rim / ahead',(0,5,7),(1,.88,.70),1300,4)
data=bpy.data.cameras.new('Game orthographic chase camera')
camera=bpy.data.objects.new('Game orthographic chase camera',data)
rig.objects.link(camera);scene.camera=camera;data.type='ORTHO'

specs={
    'car-player':(256,384), 'car-silver':(256,384), 'car-blue':(256,384), 'car-orange':(256,384),
    'barrier':(384,256),'tree':(256,384),'rock':(256,192),
}
manifest={'generator':'Blender 5.2 / Cycles CPU / original procedural meshes',
          'style':'Reference v2 / sculpted fastback coupe, continuous LED lamps, metallic turquoise; image-inspired reconstruction',
          'reference':'art/blender/reference-v2.png',
          'coordinates':{'forward':'+Y','up':'+Z','spriteView':'orthographic rear elevated, no yaw'},
          'assets':{}}

def select_asset(key):
    for k,col in assets.items():
        col.hide_render=(k!=key)
        col.hide_viewport=False

def frame_collection(col,size,view=(0,-9,13),anchor=.92,padding=.08):
    scene.render.resolution_x,scene.render.resolution_y=size
    direction=Vector(view).normalized()
    camera.rotation_euler=(-direction).to_track_quat('-Z','Y').to_euler()
    rotation=camera.rotation_euler.to_matrix()
    inv=rotation.transposed()
    depsgraph=bpy.context.evaluated_depsgraph_get()
    verts=[]
    for obj in col.objects:
        evaluated=obj.evaluated_get(depsgraph)
        evaluated_mesh=evaluated.to_mesh()
        verts.extend([inv @ (obj.matrix_world @ vertex.co) for vertex in evaluated_mesh.vertices])
        evaluated.to_mesh_clear()
    left=min(v.x for v in verts);right=max(v.x for v in verts)
    low=min(v.y for v in verts);high=max(v.y for v in verts)
    aspect=size[0]/size[1]
    ortho=max((right-left)/aspect/(1-2*padding),(high-low)/(1-2*padding))
    # Blender's orthographic scale measures the larger sensor dimension.
    # Keep `ortho` as vertical span for projection math and ground anchoring.
    camera.data.ortho_scale=ortho*max(1,aspect)
    center=rotation @ Vector(((left+right)/2,low+(anchor-.5)*ortho,0))
    camera.location=center+direction*18
    return {'canvas':list(size),'groundAnchor':[.5,anchor],'forward':'+Y',
            'contentProjection':[round((left-(left+right)/2)/(ortho*aspect)+.5,4),round(1-((high-low)/ortho+1-anchor),4),
                                 round((right-(left+right)/2)/(ortho*aspect)+.5,4),anchor]}

only=None
skip_existing=False
if '--' in sys.argv:
    args=sys.argv[sys.argv.index('--')+1:]
    if '--only' in args: only=set(args[args.index('--only')+1].split(','))
    skip_existing='--skip-existing' in args
for key,size in specs.items():
    select_asset(key)
    view=(0,-13,8) if key.startswith('car-') else (0,-10,9) if key=='tree' else (0,-9,13)
    spec=frame_collection(assets[key],size,view=view)
    spec['file']=key+'.png'
    manifest['assets'][key]=spec
    if only and key not in only: continue
    if skip_existing and (OUT/(key+'.png')).exists(): continue
    scene.render.filepath=str(OUT/(key+'.png'))
    bpy.ops.render.render(write_still=True)

# A larger three-quarter hero shot shows the fully modeled sides and alloy rims.
select_asset('car-player')
manifest['assets']['hero']=frame_collection(assets['car-player'],(768,512),view=(6,-10,5.5),anchor=.92,padding=.09)
manifest['assets']['hero']['file']='hero.png'
if not only or 'hero' in only:
    scene.cycles.samples=48
    scene.render.filepath=str(OUT/'hero.png')
    bpy.ops.render.render(write_still=True)

# Arrange all editable source models in a little design studio for the .blend.
positions={'car-player':(-3.1,-2,0),'car-silver':(0,-2,0),'car-blue':(3.1,-2,0),
           'car-orange':(-3.1,4,0),'barrier':(.1,3.8,0),'tree':(3.6,4.1,0),'rock':(4.0,1.0,0)}
allmodels=bpy.data.collections.new('SHOWCASE camera framing helpers')
scene.collection.children.link(allmodels)
for key,col in assets.items():
    col.hide_render=False
    for obj in col.objects:
        obj.location+=Vector(positions[key])
        # Link to framing collection, while retaining each original editable group.
        allmodels.objects.link(obj)
COL=allmodels
floor=cube('Warm sand studio floor',(0,1,-.21),(13,13,.3),mat('Studio warm mist',(.63,.72,.71),0,.8),.25)
frame_collection(allmodels,(1200,900),view=(8,-12,15),anchor=.94,padding=.065)
scene.render.film_transparent=False
scene.cycles.samples=32
scene.render.filepath=str(ART/'showcase.png')
# Opening the blend goes straight to the composed studio view.
for screen in bpy.data.screens:
    for area_ in screen.areas:
        if area_.type=='VIEW_3D':
            area_.spaces.active.region_3d.view_perspective='CAMERA'
bpy.ops.wm.save_as_mainfile(filepath=str(ART/'roadking-assets.blend'))
if not only or 'showcase' in only:
    bpy.ops.render.render(write_still=True)
for key,spec in manifest['assets'].items():
    path=OUT/spec['file']
    if not path.exists(): continue
    image=bpy.data.images.load(str(path),check_existing=False)
    width,height=image.size
    pixels=array('f',[0])*(width*height*4)
    image.pixels.foreach_get(pixels)
    xs=[];ys=[]
    for i in range(width*height):
        if pixels[i*4+3]>.01:
            xs.append(i%width);ys.append(i//width)
    if xs:
        spec['alphaBounds']=[min(xs),height-1-max(ys),max(xs)+1,height-min(ys)]
    bpy.data.images.remove(image)
(OUT/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8')
(ART/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8')
print('ROADKING_ASSETS_COMPLETE',str(OUT))
