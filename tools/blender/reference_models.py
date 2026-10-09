"""Editable reference-inspired automotive surfaces, not image impostors.

Coordinates: +Y front, -Y rear, Z up. All dimensions are metres.
The generated image is a visual reference, not a measured engineering drawing.
"""
import math
import bpy


def build_car(api, name, color, kind='sport', stripes=False):
    # Share the scene/material/primitive helpers from the asset builder.
    col = bpy.data.collections.new(name)
    api['scene'].collection.children.link(col)
    api['COL'] = col
    mesh, cube, cylinder, segment = (api[k] for k in ('mesh', 'cube', 'cylinder', 'segment'))
    M = api['M']
    paint = M[color]
    suv = kind == 'suv'
    sedan = kind == 'sedan'
    lift = .13 if suv else 0
    wide = 1.025 if suv else 1

    def smooth(obj, subdiv=0):
        for poly in obj.data.polygons:
            poly.use_smooth = True
        if subdiv:
            mod = obj.modifiers.new('Automotive curvature / subdivision', 'SUBSURF')
            mod.levels = subdiv
            mod.render_levels = subdiv
        return obj

    def ribbon(label, points, radius, material):
        data = bpy.data.curves.new(label, 'CURVE')
        data.dimensions = '3D'
        data.resolution_u = 16
        data.bevel_depth = radius
        data.bevel_resolution = 4
        spline = data.splines.new('BEZIER')
        spline.bezier_points.add(len(points)-1)
        for point, co in zip(spline.bezier_points, points):
            point.co = co
            point.handle_left_type = point.handle_right_type = 'AUTO'
        obj = bpy.data.objects.new(label, data)
        col.objects.link(obj)
        data.materials.append(material)
        return obj

    def shell(label, rings, material, subdivisions=2):
        verts = [v for ring in rings for v in ring]
        n = len(rings[0])
        faces = [tuple(reversed(range(n)))]
        for j in range(len(rings)-1):
            for i in range(n):
                faces.append((j*n+i,j*n+(i+1)%n,(j+1)*n+(i+1)%n,(j+1)*n+i))
        faces.append(tuple((len(rings)-1)*n+i for i in range(n)))
        return smooth(mesh(label, verts, faces, material), subdivisions)

    # High density longitudinal control cage: broad rear haunches, pinched doors,
    # curved bonnet and a lower front nose. No stack of rectangular body blocks.
    stations = [
        (-2.32,.82,.78),(-2.30,.88,.84),(-2.24,.95,.94),
        (-2.10,1.00,1.01),(-1.76,1.075,1.105),(-1.43,1.095,1.14),
        (-1.05,1.04,1.10),(-.65,.94,1.065),(-.10,.915,1.06),
        (.50,.96,1.04),(1.05,.995,1.005),(1.40,1.00,.96),
        (1.86,.96,.91),(2.14,.90,.86),(2.28,.81,.77),(2.30,.79,.73)]
    rings=[]
    for y,w,top in stations:
        w*=wide;top+=lift
        low=.25+lift
        profile=[(-.79,low),(-.94,low+.04),(-1,low+.14),(-1,top-.22),
                 (-.98,top-.105),(-.86,top-.018),(-.64,top+.015),(-.30,top+.027),
                 (.30,top+.027),(.64,top+.015),(.86,top-.018),(.98,top-.105),
                 (1,top-.22),(1,low+.14),(.94,low+.04),(.79,low)]
        rings.append([(x*w,y,z) for x,z in profile])
    body=shell('Continuous sculpted body / wheel-arch cutouts',rings,paint)
    bpy.context.view_layer.objects.active=body
    bpy.ops.object.modifier_apply(modifier=body.modifiers[0].name)
    wheel_z=.435+lift*.55
    radius=.43 if suv else .405
    # Real open wheel arches, cut across the whole body before wheels are fitted.
    for y in [-1.45,1.36]:
        cutter=cylinder('Temporary wheel arch tool',(0,y,wheel_z),radius+.065,3.2,M['black'],(0,math.pi/2,0),64,0)
        mod=body.modifiers.new('Open wheel arch','BOOLEAN');mod.operation='DIFFERENCE';mod.solver='EXACT';mod.object=cutter
        bpy.context.view_layer.objects.active=body;bpy.ops.object.modifier_apply(modifier=mod.name)
        bpy.data.objects.remove(cutter,do_unlink=True)
    edge=body.modifiers.new('Painted arch edge radius','BEVEL');edge.width=.012;edge.segments=3
    normals=body.modifiers.new('Body highlight normals','WEIGHTED_NORMAL');normals.keep_sharp=True
    cube('Underbody',(0,0,.24+lift),(1.61,3.96,.16),M['black'],.06)

    # Round shoulders on an uninterrupted fastback canopy; the roof is a
    # separate curved panel on top of dark glass, with explicit window frames.
    top=1.78 if suv else 1.48 if sedan else 1.53
    rear=-1.45 if not suv else -1.66
    rear_roof=-.78 if not suv else -1.10
    front_roof=.53 if not suv else .48
    front=1.08
    stations_glass=[(rear,.73,1.09+lift),(rear+.06,.755,1.14+lift),
                    (rear_roof,.73,top),(rear_roof+.12,.725,top+.018),
                    (front_roof-.12,.705,top+.018),(front_roof,.70,top),
                    (front-.05,.755,1.115+lift),(front,.755,1.075+lift)]
    rings=[]
    for y,w,z in stations_glass:
        bottom=1.01+lift
        rings.append([(x*w,y,zz) for x,zz in [(-1,bottom),(-1,max(bottom+.025,z-.13)),(-.94,z-.035),(-.68,z),
            (-.30,z+.015),(.30,z+.015),(.68,z),(.94,z-.055),(1,z-.19),(1,bottom)]])
    shell('Curved tinted glazing / fastback cabin',rings,M['glass'])
    roof_verts=[]
    roof_ys=[rear_roof-.045,rear_roof,rear_roof+.09,front_roof-.09,front_roof,front_roof+.025]
    roof_xs=[-.655,-.63,-.40,0,.40,.63,.655]
    for j,y in enumerate(roof_ys):
        for x in roof_xs:
            crown=math.sin(j*math.pi/5)
            z=top+.022+.065*crown-.065*(abs(x)/.655)**2
            roof_verts.append((x*(.88+.12*crown),y,z))
    faces=[(j*7+i,j*7+i+1,(j+1)*7+i+1,(j+1)*7+i) for j in range(5) for i in range(6)]
    roof=smooth(mesh('Curved painted roof panel',roof_verts,faces,paint),2)
    thick=roof.modifiers.new('Roof panel thickness','SOLIDIFY');thick.thickness=.025
    for side in [-1,1]:
        # Flush sheet-metal pillars rather than round external roll-cage bars.
        for label,verts in [
            ('Flush A pillar',[(side*.755,front,1.105+lift),(side*.755,front-.075,1.12+lift),(side*.651,front_roof-.025,top+.015),(side*.651,front_roof+.045,top+.015)]),
            ('Fastback C pillar panel',[(side*.735,rear-.015,1.105+lift),(side*.763,rear+.18,1.16+lift),(side*.666,rear_roof+.07,top-.005),(side*.651,rear_roof-.075,top+.015)])]:
            panel=mesh(label,verts,[(0,1,2,3)],paint)
            solid=panel.modifiers.new('Pillar skin','SOLIDIFY');solid.thickness=.012
            edge=panel.modifiers.new('Soft pillar outline','BEVEL');edge.width=.01;edge.segments=3
        ribbon('Black side sill',[(side*.98,-1.02,.34+lift),(side*.95,-.15,.30+lift),(side*.98,.86,.33+lift)],.055,M['black'])
        ribbon('Door panel seam',[(side*.985,.66,.97+lift),(side*.956,.69,.69+lift),(side*.944,.61,.40+lift),(side*.952,-.91,.40+lift),(side*.976,-1.03,.86+lift)],.006,M['black'])
        cube('Flush door handle',(side*.956,-.43,.95+lift),(.035,.185,.035),M['metal'],.015)
        segment('Mirror mounting arm',(side*.79,.75,1.10+lift),(side*1.06,.67,1.11+lift),.027,M['black'])
        mirror=cube('Aerodynamic body-color mirror',(side*1.105,.67,1.14+lift),(.23,.29,.14),paint,.065)
        smooth(mirror)
        cube('Mirror glass',(side*1.11,.535,1.145+lift),(.16,.013,.07),M['glass'],.025)
        if suv or sedan:
            ribbon('B pillar',[(side*.784,-.20,1.10+lift),(side*.725,-.20,top-.025)],.033,M['black'])
        # Multi-spoke wheels with tyre tread, disc and red caliper behind spokes.
        for y in [-1.45,1.36]:
            x=side*.962*wide
            cylinder('Rounded performance tire',(x,y,wheel_z),radius,.255,M['rubber'],(0,math.pi/2,0),64,.045)
            face=x+side*.134
            cylinder('Alloy rim',(face,y,wheel_z),radius*.77,.027,M['metal'],(0,math.pi/2,0),64,.008)
            cylinder('Wheel dark barrel',(face+side*.02,y,wheel_z),radius*.69,.025,M['black'],(0,math.pi/2,0),48,.005)
            cylinder('Brake rotor',(face-side*.008,y,wheel_z),radius*.57,.013,M['metal'],(0,math.pi/2,0),48,.005)
            cube('Brake caliper',(face+side*.005,y+.19,wheel_z),(.028,.08,.16),M['red'],.02)
            for i in range(10):
                angle=i*math.tau/10
                segment('Forged split wheel spoke',(face+side*.048,y+math.sin(angle)*.06,wheel_z+math.cos(angle)*.06),
                        (face+side*.053,y+math.sin(angle+.13)*radius*.70,wheel_z+math.cos(angle+.13)*radius*.70),.017,M['metal'],8)
            cylinder('Wheel hub',(face+side*.066,y,wheel_z),.07,.02,M['black'],(0,math.pi/2,0),32,.007)
            for i in range(18):
                angle=i*math.tau/36
                # Cut-looking tread ridges: nearly flush, never protruding spikes.
                a=(x-.07,y+math.sin(angle)*(radius-.005),wheel_z+math.cos(angle)*(radius-.005))
                b=(x+.07,y+math.sin(angle+.025)*(radius-.005),wheel_z+math.cos(angle+.025)*(radius-.005))
                # Curve ridges avoid hundreds of tiny modifier-heavy cylinders.
                ribbon('Tire tread groove',[a,b],.003,M['black'])
            if suv:
                pts=[(side*1.02*wide,y+math.cos(t)*(radius+.065),wheel_z+math.sin(t)*(radius+.065)) for t in [i*math.pi/12 for i in range(13)]]
                ribbon('SUV wheel arch trim',pts,.025,M['black'])

    # Reference silhouette: a slim continuous light bar with swept corner lamps,
    # an integrated dark lip spoiler and a substantial lower diffuser.
    cube('Rear fascia dark inset',(0,-2.314,.82+lift),(1.71,.04,.16),M['black'],.055)
    ribbon('Full-width red LED connection',[(-.84,-2.351,.85+lift),(-.47,-2.358,.83+lift),(0,-2.36,.83+lift),(.47,-2.358,.83+lift),(.84,-2.351,.85+lift)],.013,M['red'])
    for side in [-1,1]:
        outline=[(side*.38,-2.352,.86+lift),(side*.80,-2.34,.91+lift),(side*.90,-2.31,.87+lift),
                 (side*.84,-2.343,.775+lift),(side*.49,-2.36,.775+lift),(side*.38,-2.352,.86+lift)]
        mesh('Smoked swept tail lamp lens',outline[:-1],[(0,1,2,3,4)],M['black'])
        # Flat open blade lenses replace the previous oval neon-tube outline.
        blade=[(side*.39,-2.37,.885+lift),(side*.83,-2.35,.925+lift),
               (side*.91,-2.32,.89+lift),(side*.83,-2.36,.87+lift),
               (side*.39,-2.38,.855+lift)]
        lens=mesh('Angular red LED blade lens',blade,[(0,1,2,3,4)],M['red'])
        thickness=lens.modifiers.new('Lamp lens thickness','SOLIDIFY');thickness.thickness=.012
        ribbon('Tail lamp lower signature',[(side*.52,-2.378,.79+lift),(side*.80,-2.36,.80+lift),(side*.875,-2.335,.855+lift)],.007,M['red'])
        ribbon('Front narrow LED headlamp',[(side*.38,2.289,.78+lift),(side*.71,2.27,.79+lift),(side*.86,2.19,.83+lift)],.022,M['light'])
        cube('Front bumper air intake',(side*.71,2.25,.53+lift),(.24,.10,.23),M['black'],.065)
        ribbon('Hood character crease',[(side*.53,.99,1.02+lift),(side*.59,1.57,.94+lift),(side*.45,2.12,.87+lift)],.008,paint)
        # Oval exhausts using curved closed outlines rather than round tubes.
        points=[(side*.67+.105*math.cos(t),-2.405,.40+lift+.058*math.sin(t)) for t in [i*math.tau/20 for i in range(21)]]
        cube('Dark exhaust aperture',(side*.67,-2.386,.40+lift),(.22,.035,.105),M['black'],.04)
        ribbon('Polished oval exhaust lip',points,.013,M['metal'])
        cube('Rear bumper corner vent',(side*.83,-2.29,.59+lift),(.13,.085,.22),M['black'],.045)
    cube('Broad rear lower diffuser',(0,-2.29,.365+lift),(1.70,.17,.21),M['black'],.075)
    for x in [-.40,-.20,0,.20,.40]:
        cube('Diffuser aero fin',(x,-2.34,.285+lift),(.026,.28,.115),M['black'],.006)
    spoiler=mesh('Integrated black deck spoiler',
        [(-.98,-2.03,1.06+lift),(-.92,-2.25,1.10+lift),(0,-2.28,1.115+lift),(.92,-2.25,1.10+lift),(.98,-2.03,1.06+lift),(0,-2.08,1.08+lift)],
        [(0,1,2,5),(5,2,3,4)],M['black'])
    lip=spoiler.modifiers.new('Spoiler sculpted lip','SOLIDIFY');lip.thickness=.022
    rounded=spoiler.modifiers.new('Spoiler soft edges','BEVEL');rounded.width=.012;rounded.segments=3
    cube('Front central grille',(0,2.27,.52+lift),(1.10,.09,.24),M['black'],.06)
    for i in range(4):
        cube('Grille horizontal slat',(0,2.327,.445+i*.045+lift),(1.0,.017,.01),M['metal'],.003)
    ribbon('Front splitter',[(-.87,2.18,.33+lift),(0,2.34,.32+lift),(.87,2.18,.33+lift)],.027,M['black'])
    if suv:
        for side in [-1,1]:
            ribbon('Roof rail',[(side*.59,-1.03,top+.08),(side*.61,-.35,top+.095),(side*.60,.42,top+.08)],.025,M['metal'])
    # Reference coupe has no white racing stripes and no elevated racing wing.
    return col
