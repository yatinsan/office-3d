"""Build /Game/Office/Lvl_Office in an Unreal 5 project from unreal/office.glb.

office.glb comes from the web version (src/exportUnreal.js). Every mesh in it is already in world
space, so each imported static mesh is placed at the origin. Shared models (the desk chairs) come as
<name>.glb + instances.json and are imported once, then placed at every spot.

Run inside the Unreal editor (Python Editor Script Plugin enabled):
    UnrealEditor.exe MyProject.uproject -ExecutePythonScript="<path>/import_office.py"
or in the editor: Tools > Execute Python Script...
"""
import json
import math
import os

import unreal

HERE = os.path.dirname(os.path.abspath(__file__))
GLB = os.path.join(HERE, "office.glb")
DEST = "/Game/Office"
MESHES = DEST + "/Imported"
LEVEL = DEST + "/Lvl_Office"

log = unreal.log


def import_glb():
    task = unreal.AssetImportTask()
    task.filename = GLB
    task.destination_path = MESHES
    task.automated = True
    task.replace_existing = True
    task.save = True
    unreal.AssetToolsHelpers.get_asset_tools().import_asset_tasks([task])
    paths = list(task.imported_object_paths)
    if not paths:  # some importers don't report paths: list what landed in the folder
        paths = unreal.EditorAssetLibrary.list_assets(MESHES, recursive=True)
    meshes = []
    for p in paths:
        a = unreal.EditorAssetLibrary.load_asset(p)
        if isinstance(a, unreal.StaticMesh):
            meshes.append(a)
    log(f"[office] imported {len(meshes)} static meshes")
    return meshes


def import_model(name):
    """Import unreal/<name>.glb (a shared model such as the desk chair) as one combined static mesh."""
    task = unreal.AssetImportTask()
    task.filename = os.path.join(HERE, name + ".glb")
    task.destination_path = f"{DEST}/Models/{name}"
    task.automated = True
    task.replace_existing = True
    task.save = True
    try:
        pipe = unreal.InterchangeGenericAssetsPipeline()
        pipe.mesh_pipeline.set_editor_property("combine_static_meshes", True)
        task.options = pipe
    except Exception as e:  # older engines: fall back to one mesh per part
        unreal.log_warning(f"[office] could not combine {name} meshes: {e}")
    unreal.AssetToolsHelpers.get_asset_tools().import_asset_tasks([task])
    paths = list(task.imported_object_paths) or unreal.EditorAssetLibrary.list_assets(task.destination_path, recursive=True)
    meshes = [a for a in (unreal.EditorAssetLibrary.load_asset(p) for p in paths) if isinstance(a, unreal.StaticMesh)]
    for m in meshes:
        walkable(m)
    log(f"[office] {name}: {len(meshes)} static mesh(es)")
    return meshes


def place_instances(actors):
    """Spawn each shared model at the spots listed in instances.json (three.js meters, y up -> Unreal cm, z up)."""
    path = os.path.join(HERE, "instances.json")
    if not os.path.exists(path):
        return
    with open(path, encoding="utf-8") as f:
        spots = json.load(f)
    models = {name: import_model(name) for name in sorted({s["asset"] for s in spots})}
    for i, s in enumerate(spots):
        loc = unreal.Vector(s["x"] * 100, s["z"] * 100, s["y"] * 100)
        rot = unreal.Rotator(0, 0, -math.degrees(s["ry"]))
        for mesh in models[s["asset"]]:
            a = actors.spawn_actor_from_object(mesh, loc, rot)
            a.set_actor_label(f"{s['asset']}_{i}")
            a.set_folder_path(f"Office/{s['asset']}")
            if s.get("scale", 1) != 1:
                a.set_actor_scale3d(unreal.Vector(s["scale"], s["scale"], s["scale"]))
    log(f"[office] placed {len(spots)} shared-model instances")


def kind(mesh):
    n = mesh.get_name()
    if "SPAWN_A" in n:
        return "spawn_a"
    if "SPAWN_B" in n:
        return "spawn_b"
    return "dyn" if "dyn_" in n else "static"


def walkable(mesh):
    """Use the render triangles as collision so floors, walls, stairs and furniture are solid."""
    body = mesh.get_editor_property("body_setup")
    if body:
        body.set_editor_property("collision_trace_flag", unreal.CollisionTraceFlag.CTF_USE_COMPLEX_AS_SIMPLE)
        mesh.modify()
        unreal.EditorAssetLibrary.save_loaded_asset(mesh)


def spawn(cls, loc=unreal.Vector(0, 0, 0), rot=unreal.Rotator(0, 0, 0), label=None):
    actors = unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
    a = actors.spawn_actor_from_class(cls, loc, rot)
    if label:
        a.set_actor_label(label)
    return a


def build():
    if not os.path.exists(GLB):
        unreal.log_error(f"[office] {GLB} not found: export it from the web version first")
        return
    levels = unreal.get_editor_subsystem(unreal.LevelEditorSubsystem)
    actors = unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
    if unreal.EditorAssetLibrary.does_asset_exist(LEVEL):  # re-run: rebuild the level's contents in place
        levels.load_level(LEVEL)
        for a in actors.get_all_level_actors():
            if not isinstance(a, unreal.WorldSettings):
                actors.destroy_actor(a)
    else:
        levels.new_level(LEVEL)

    meshes = import_glb()
    markers = {}
    with unreal.ScopedSlowTask(len(meshes), "Placing office meshes") as slow:
        slow.make_dialog()
        for m in meshes:
            slow.enter_progress_frame(1)
            k = kind(m)
            if k == "static":
                walkable(m)
            a = actors.spawn_actor_from_object(m, unreal.Vector(0, 0, 0))
            a.set_folder_path("Office/Dynamic" if k == "dyn" else "Office/Static")
            comp = a.get_component_by_class(unreal.StaticMeshComponent)
            if k == "dyn":
                comp.set_collision_enabled(unreal.CollisionEnabled.NO_COLLISION)
            if k.startswith("spawn"):
                origin, _ = a.get_actor_bounds(False)
                markers[k] = origin
                actors.destroy_actor(a)

    place_instances(actors)

    # Player start at the web version's spawn point, looking the same way.
    a, b = markers.get("spawn_a"), markers.get("spawn_b")
    if a and b:
        yaw = math.degrees(math.atan2(b.y - a.y, b.x - a.x))
        spawn(unreal.PlayerStart, unreal.Vector(a.x, a.y, a.z), unreal.Rotator(0, 0, yaw), "PlayerStart")
        log(f"[office] player start at {a} yaw {yaw:.1f}")
    else:
        spawn(unreal.PlayerStart, unreal.Vector(0, 0, 200), label="PlayerStart")
        unreal.log_warning("[office] spawn markers missing: PlayerStart placed at the origin")

    # Evening sun + sky, dynamic (Lumen) so nothing needs a lighting build.
    sun = spawn(unreal.DirectionalLight, rot=unreal.Rotator(0, -35, -60), label="Sun")
    sc = sun.get_component_by_class(unreal.DirectionalLightComponent)
    sc.set_mobility(unreal.ComponentMobility.MOVABLE)
    sc.set_editor_property("intensity", 6.0)
    sc.set_editor_property("atmosphere_sun_light", True)
    spawn(unreal.SkyAtmosphere, label="SkyAtmosphere")
    sky = spawn(unreal.SkyLight, label="SkyLight")
    skc = sky.get_component_by_class(unreal.SkyLightComponent)
    skc.set_mobility(unreal.ComponentMobility.MOVABLE)
    skc.set_editor_property("real_time_capture", True)
    spawn(unreal.ExponentialHeightFog, label="Fog")
    ppv = spawn(unreal.PostProcessVolume, label="PostProcess")
    ppv.set_editor_property("unbound", True)

    unreal.EditorLoadingAndSavingUtils.save_dirty_packages(True, True)
    log(f"[office] done: {LEVEL}")


build()
