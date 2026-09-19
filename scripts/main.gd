extends Node3D

const KeeperScript := preload("res://scripts/player.gd")
const TouchControlsScript := preload("res://scripts/touch_controls.gd")
const NightEnemyScript := preload("res://scripts/night_enemy.gd")
const RelayMirrorScript := preload("res://scripts/relay_mirror.gd")
const HomeStationScript := preload("res://scripts/home_station.gd")
const DARK_THRESHOLD_Z := -11.0
const PULSE_RANGE := 34.0
const AUTO_TARGET_ANGLE := 18.0

var player: Keeper
var mineral_count := 0
var extracted := false
var _mineral: Area3D
var _sol_bar: ProgressBar
var _objective_label: Label
var _status_label: Label
var _zone_label: Label
var _ui_layer: CanvasLayer
var _rng := RandomNumberGenerator.new()
var _enemies_remaining := 2
var _mirrors: Array[RelayMirror] = []
var _relay_gate: StaticBody3D
var _puzzle_beam_one: MeshInstance3D
var _puzzle_beam_two: MeshInstance3D
var _puzzle_beam_final: MeshInstance3D
var _gate_open := false
var _event_message := ""
var _event_message_time := 0.0
var _current_pulse_target: Node3D
var _target_indicator: Label
var _target_name_label: Label
var _current_home_station: HomeStation
var _interaction_label: Label
var _construction_boom: Node3D
var _deployed_harvester: Node3D
var _harvester_deployed := false
var _grid_output := 1
var _home_root: Node3D
var _expedition_root: Node3D
var _build_parent: Node3D
var _at_home := true
var _surface_textures: Dictionary = {}


func _ready() -> void:
	_rng.seed = 74291
	_build_environment()
	_home_root = Node3D.new()
	_home_root.name = "HomeArea"
	add_child(_home_root)
	_expedition_root = Node3D.new()
	_expedition_root.name = "ExpeditionArea"
	_expedition_root.position = Vector3(0, 0, -240)
	add_child(_expedition_root)

	_build_parent = _expedition_root
	_build_world()
	_build_puzzle()
	_build_mineral()
	_build_return_zone()
	_build_expedition_station()
	_build_parent = _home_root
	_build_encampment()
	_build_parent = null
	_spawn_keeper()
	_spawn_enemies()
	_build_ui()
	_build_touch_controls()


func _process(delta: float) -> void:
	if not is_instance_valid(player):
		return
	_event_message_time = maxf(0.0, _event_message_time - delta)
	_objective_label.modulate = Color("e6c47a")
	var expedition_position := _expedition_root.to_local(player.global_position)
	player.is_in_dark = not _at_home and expedition_position.z < DARK_THRESHOLD_Z
	_sol_bar.value = player.sol_charge
	if _at_home:
		_zone_label.text = "HOME — TERMINATOR ENCAMPMENT"
	elif player.is_in_dark:
		_zone_label.text = "PERMANENT NIGHT"
	else:
		_zone_label.text = "NIGHT LINE — FORWARD PLATFORM"
	_zone_label.modulate = Color("8ab8d8") if player.is_in_dark else Color("f0b36b")
	_status_label.text = "SOL %03d%%  •  GRID %d MW  •  HOSTILES %d  •  CARGO %d  •  LIGHT: %s" % [
		int(player.sol_charge),
		_grid_output,
		0 if _at_home else _enemies_remaining,
		mineral_count,
		"ON" if player.flashlight_on else "OFF"
	]
	_update_pulse_target()
	_update_home_station()
	if _event_message_time > 0.0:
		_objective_label.text = _event_message
		_objective_label.modulate = Color("efc47a")
	elif extracted:
		_objective_label.text = "RELAY SAMPLE SECURED — PROTOTYPE LOOP COMPLETE"
		_objective_label.modulate = Color("90e0a7")
	elif mineral_count > 0:
		_objective_label.text = "SECURE THE NIGHTGLASS SAMPLE IN THE KEEPER HOUSE STASH" if _at_home else "RETURN TO THE TRAIN WITH THE NIGHTGLASS SAMPLE"
	elif _at_home:
		_objective_label.text = "PREPARE AT CAMP OR BOARD THE NIGHT TRAIN"
	elif _gate_open:
		_objective_label.text = "THE RELAY VAULT IS OPEN — RECOVER THE NIGHTGLASS"
	elif _mirrors_aligned_count() > 0:
		_objective_label.text = "KEEP THE SOL BEAM ON THE SECOND MIRROR AND PULSE IT"
	elif _enemies_remaining > 0:
		_objective_label.text = "PULSE THE NIGHT CREATURES — THE STALKER NEEDS SOL LIGHT"
	else:
		_objective_label.text = "ILLUMINATE AND PULSE BOTH RELAY MIRRORS"


func _build_environment() -> void:
	var world_environment := WorldEnvironment.new()
	var environment := Environment.new()
	var sky_material := ProceduralSkyMaterial.new()
	sky_material.sky_top_color = Color("08101d")
	sky_material.sky_horizon_color = Color("bb6d4f")
	sky_material.ground_bottom_color = Color("010307")
	sky_material.ground_horizon_color = Color("503f42")
	sky_material.sun_angle_max = 4.0
	sky_material.sun_curve = 0.08
	var sky := Sky.new()
	sky.sky_material = sky_material
	environment.sky = sky
	environment.background_mode = Environment.BG_SKY
	environment.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	environment.ambient_light_color = Color("6d7c8a")
	environment.ambient_light_energy = 0.34
	environment.fog_enabled = true
	environment.fog_light_color = Color("142334")
	environment.fog_density = 0.014
	environment.fog_sky_affect = 0.0
	environment.tonemap_mode = Environment.TONE_MAPPER_FILMIC
	world_environment.environment = environment
	add_child(world_environment)

	var dusk_light := DirectionalLight3D.new()
	dusk_light.rotation_degrees = Vector3(-48, -32, 0)
	dusk_light.light_color = Color("f0a45d")
	dusk_light.light_energy = 1.05
	dusk_light.shadow_enabled = true
	add_child(dusk_light)

	# Huge crescent-like world body beyond the relay, echoing the concept board.
	var planet := MeshInstance3D.new()
	var planet_mesh := SphereMesh.new()
	planet_mesh.radius = 14.0
	planet_mesh.height = 28.0
	planet_mesh.material = _make_material(Color("273754"), true)
	planet.mesh = planet_mesh
	planet.position = Vector3(31, 18, -78)
	add_child(planet)


func _build_world() -> void:
	_make_solid_box("DuskPlatform", Vector3(0, -0.5, 7), Vector3(18, 1, 16), Color("66513c"), "ground")
	_make_solid_box("Threshold", Vector3(0, -0.5, -7), Vector3(10, 1, 8), Color("394044"), "ground")
	_make_solid_box("DarkRoad", Vector3(0, -0.5, -26), Vector3(10, 1, 30), Color("1d2932"), "ground")
	_make_solid_box("RelayFloor", Vector3(0, -0.5, -45), Vector3(18, 1, 12), Color("18252e"), "ground")
	_make_solid_box("MirrorGalleryFloor", Vector3(0, -0.5, -62), Vector3(14, 1, 22), Color("17212b"), "ground")
	_make_solid_box("RelayVaultFloor", Vector3(0, -0.5, -72), Vector3(12, 1, 8), Color("101b24"), "ground")

	_make_solid_box("RoadWallLeft", Vector3(-5.4, 1.6, -26), Vector3(0.8, 4.2, 31), Color("26333d"))
	_make_solid_box("RoadWallRight", Vector3(5.4, 1.6, -26), Vector3(0.8, 4.2, 31), Color("26333d"))
	_make_solid_box("RelayWallLeft", Vector3(-9, 1.6, -45), Vector3(0.8, 4.2, 12), Color("202b35"))
	_make_solid_box("RelayWallRight", Vector3(9, 1.6, -45), Vector3(0.8, 4.2, 12), Color("202b35"))
	_make_solid_box("GalleryWallLeft", Vector3(-7, 1.8, -62), Vector3(0.8, 4.8, 22), Color("1b2833"))
	_make_solid_box("GalleryWallRight", Vector3(7, 1.8, -62), Vector3(0.8, 4.8, 22), Color("1b2833"))
	_make_solid_box("VaultWallLeft", Vector3(-6, 1.8, -73.5), Vector3(0.8, 4.8, 5), Color("17242e"))
	_make_solid_box("VaultWallRight", Vector3(6, 1.8, -73.5), Vector3(0.8, 4.8, 5), Color("17242e"))
	_make_solid_box("VaultWallBack", Vector3(0, 1.8, -76), Vector3(14, 4.8, 0.8), Color("17242e"))
	for arch_z in [-52.0, -58.0, -64.0, -70.0]:
		_make_visual_box(Vector3(-6.2, 3.6, arch_z), Vector3(0.45, 1.5, 0.65), Color("3b464d"))
		_make_visual_box(Vector3(6.2, 3.6, arch_z), Vector3(0.45, 1.5, 0.65), Color("3b464d"))
		_make_visual_box(Vector3(0, 4.25, arch_z), Vector3(12.8, 0.35, 0.65), Color("303b43"))

	# Monumental relay gate at the edge of permanent night.
	_make_solid_box("ThresholdLeft", Vector3(-3.8, 2.4, -10.2), Vector3(1.2, 5.8, 1.4), Color("494642"))
	_make_solid_box("ThresholdRight", Vector3(3.8, 2.4, -10.2), Vector3(1.2, 5.8, 1.4), Color("494642"))
	_make_visual_box(Vector3(0, 5.0, -10.2), Vector3(8.6, 0.8, 1.4), Color("383d40"))
	_make_visual_box(Vector3(0, 4.95, -9.45), Vector3(2.4, 0.15, 0.12), Color("f3a957"), true)

	# Lighthouse infrastructure silhouettes.
	for x in [-6.5, 6.5]:
		_make_solid_box("RelayPylon", Vector3(x, 3.0, -47), Vector3(1.2, 7.0, 1.2), Color("3a4349"))
		_make_visual_box(Vector3(x, 6.8, -47), Vector3(1.8, 0.35, 1.8), Color("8bb9c8"), true)

	# Broken stone, frost and nightglass lead the eye toward the relay core.
	for i in range(34):
		var z := _rng.randf_range(-46.0, -13.0)
		var side := -1.0 if i % 2 == 0 else 1.0
		var x := side * _rng.randf_range(3.4, 4.75)
		_make_rock(Vector3(x, _rng.randf_range(0.0, 0.16), z), Vector3(
			_rng.randf_range(0.35, 1.2),
			_rng.randf_range(0.25, 0.9),
			_rng.randf_range(0.35, 1.25)
		))
	for crystal_data in [
		[Vector3(-3.7, 0.65, -20), Color("7350d8"), 0.75],
		[Vector3(4.1, 0.55, -27), Color("3d9ed1"), 0.62],
		[Vector3(-4.0, 0.8, -35), Color("7545ca"), 0.95],
		[Vector3(5.8, 0.9, -44), Color("4db7dc"), 1.15],
		[Vector3(-6.3, 0.7, -46), Color("7b4ed1"), 0.9],
		[Vector3(5.6, 0.7, -56), Color("4a8ccf"), 0.75],
		[Vector3(-5.5, 0.9, -63), Color("8550db"), 1.0],
		[Vector3(4.8, 0.65, -71), Color("50bfd8"), 0.82]
	]:
		_make_crystal(crystal_data[0], crystal_data[1], crystal_data[2])

	# The dead blue relay remains the night-side landmark.
	var relay_light := OmniLight3D.new()
	relay_light.position = Vector3(0, 2.0, -47)
	relay_light.light_color = Color("6fa5c5")
	relay_light.light_energy = 1.4
	relay_light.omni_range = 10.0
	_current_build_parent().add_child(relay_light)


func _build_encampment() -> void:
	var camp := Node3D.new()
	camp.name = "StartingEncampment"
	_current_build_parent().add_child(camp)

	# A broad central service lane makes the stations readable from the spawn point.
	_make_solid_box_child(camp, "CampGround", Vector3(0, -0.5, 7), Vector3(30, 1, 24), Color("66513c"), "ground")
	_make_child_box(camp, Vector3(0, 0.025, 7), Vector3(8.5, 0.05, 21.0), Color("7b6b55"), false, "ground")
	for marker_z in [-1.0, 3.0, 7.0, 11.0, 15.0]:
		_make_child_box(camp, Vector3(0, 0.06, marker_z), Vector3(0.13, 0.03, 1.6), Color("d09a52"), true)

	_build_keeper_house(camp)
	_build_repair_bay(camp)
	_build_upgrade_shop(camp)
	_build_solar_operations(camp)
	_build_construction_gantry(camp)
	_build_power_bank(camp)
	_build_dispatch_tower(camp)
	_build_night_train(camp)
	_build_solar_field(camp)

	_add_home_station(camp, "stash", "KEEPER HOUSE", "SECURE CARRIED MATERIALS", Vector3(-5.2, 0, 11.0), Color("8fc58b"))
	_add_home_station(camp, "repair", "REPAIR SHED", "REPAIR GEAR & RECHARGE SOL", Vector3(-5.0, 0, 3.2), Color("e29a50"))
	_add_home_station(camp, "upgrade", "UPGRADE SHOP", "INSPECT AVAILABLE MODULES", Vector3(-5.8, 0, 16.4), Color("cf9b62"))
	_add_home_station(camp, "solar", "SOLAR OPERATIONS", "ROUTE POWER TO CONSTRUCTION", Vector3(5.0, 0, 11.0), Color("f5bc58"))
	_add_home_station(camp, "dispatch", "NIGHT DISPATCH", "REVIEW EXPEDITION ROUTE", Vector3(2.4, 0, -2.2), Color("78b7d1"))


func _build_keeper_house(camp: Node3D) -> void:
	var house := Node3D.new()
	house.name = "KeeperHouse"
	camp.add_child(house)
	_make_solid_box_child(house, "HouseBody", Vector3(-9.0, 1.55, 11.0), Vector3(6.0, 3.1, 5.5), Color("5b5143"))
	_make_child_box(house, Vector3(-9.0, 3.22, 11.0), Vector3(6.5, 0.25, 6.0), Color("282c2a"))
	_make_child_box(house, Vector3(-5.92, 1.35, 11.0), Vector3(0.12, 2.25, 1.25), Color("d88943"), true)
	_make_child_box(house, Vector3(-8.8, 1.65, 8.2), Vector3(2.6, 1.2, 0.1), Color("d09a55"), true)
	for z_value in [9.0, 13.0]:
		_make_child_box(house, Vector3(-12.08, 1.1, z_value), Vector3(0.12, 1.8, 0.22), Color("2a2e2d"))


func _build_repair_bay(camp: Node3D) -> void:
	var bay := Node3D.new()
	bay.name = "RepairBay"
	camp.add_child(bay)
	_make_solid_box_child(bay, "RepairBack", Vector3(-11.8, 1.55, 3.0), Vector3(0.45, 3.1, 6.0), Color("414743"))
	_make_solid_box_child(bay, "RepairNorth", Vector3(-8.8, 1.0, 5.8), Vector3(5.7, 2.0, 0.35), Color("4c4a40"))
	_make_solid_box_child(bay, "RepairSouth", Vector3(-8.8, 1.0, 0.2), Vector3(5.7, 2.0, 0.35), Color("4c4a40"))
	_make_child_box(bay, Vector3(-9.0, 3.05, 3.0), Vector3(6.2, 0.22, 6.4), Color("2b302f"))
	_make_child_box(bay, Vector3(-9.3, 0.65, 3.0), Vector3(2.7, 1.0, 1.0), Color("252a28"))
	for x_value in [-10.2, -8.4]:
		_make_child_box(bay, Vector3(x_value, 1.25, 5.55), Vector3(0.7, 1.5, 0.12), Color("d79148"), true)
	var repair_light := OmniLight3D.new()
	repair_light.position = Vector3(-8.5, 2.5, 3.0)
	repair_light.light_color = Color("ffb96b")
	repair_light.light_energy = 2.8
	repair_light.omni_range = 7.0
	bay.add_child(repair_light)


func _build_upgrade_shop(camp: Node3D) -> void:
	var shop := Node3D.new()
	shop.name = "UpgradeShop"
	camp.add_child(shop)
	_make_solid_box_child(shop, "UpgradeBody", Vector3(-9.2, 1.45, 16.4), Vector3(5.6, 2.9, 3.8), Color("50483d"))
	_make_child_box(shop, Vector3(-9.2, 3.03, 16.4), Vector3(6.0, 0.24, 4.2), Color("292d2b"))
	_make_child_box(shop, Vector3(-6.32, 1.25, 16.4), Vector3(0.12, 1.8, 1.3), Color("c78a4d"), true)
	for x_value in [-10.6, -9.2, -7.8]:
		_make_child_box(shop, Vector3(x_value, 1.7, 14.44), Vector3(0.72, 0.72, 0.1), Color("92704a"), true)


func _build_solar_operations(camp: Node3D) -> void:
	var operations := Node3D.new()
	operations.name = "SolarOperations"
	camp.add_child(operations)
	_make_solid_box_child(operations, "OperationsBase", Vector3(8.6, 1.35, 11.2), Vector3(6.0, 2.7, 5.0), Color("4b4b42"))
	_make_solid_box_child(operations, "OperationsTower", Vector3(10.0, 4.1, 11.4), Vector3(2.2, 3.2, 2.2), Color("605746"))
	_make_child_box(operations, Vector3(10.0, 5.85, 11.4), Vector3(3.0, 0.22, 3.0), Color("d18c43"), true)
	_make_child_box(operations, Vector3(5.52, 1.25, 11.0), Vector3(0.12, 1.5, 1.6), Color("f0b14e"), true)
	for z_value in [9.5, 11.2, 12.9]:
		_make_child_box(operations, Vector3(8.5, 2.15, z_value), Vector3(1.0, 0.12, 0.28), Color("b58a50"), true)


func _build_construction_gantry(camp: Node3D) -> void:
	var gantry := Node3D.new()
	gantry.name = "ConstructionGantry"
	camp.add_child(gantry)
	for z_value in [2.0, 6.0]:
		_make_solid_box_child(gantry, "GantryColumn", Vector3(9.2, 2.1, z_value), Vector3(0.65, 4.2, 0.65), Color("6b5538"))
	_make_child_box(gantry, Vector3(9.2, 4.25, 4.0), Vector3(0.8, 0.45, 5.2), Color("8a653a"))
	_construction_boom = Node3D.new()
	_construction_boom.name = "ConstructionBoom"
	_construction_boom.position = Vector3(9.2, 4.55, 4.0)
	gantry.add_child(_construction_boom)
	_make_child_box(_construction_boom, Vector3(-2.7, 0, 0), Vector3(5.8, 0.42, 0.52), Color("9a713e"))
	_make_child_box(_construction_boom, Vector3(-5.45, -1.25, 0), Vector3(0.35, 2.5, 0.35), Color("252a29"))
	_make_child_box(_construction_boom, Vector3(-5.45, -2.35, 0), Vector3(1.2, 0.3, 1.2), Color("c28b48"), true)

	_deployed_harvester = Node3D.new()
	_deployed_harvester.name = "DeployedHarvester"
	_deployed_harvester.position = Vector3(12.1, 0, 3.8)
	_deployed_harvester.visible = false
	_deployed_harvester.scale = Vector3(0.2, 0.2, 0.2)
	camp.add_child(_deployed_harvester)
	_make_child_box(_deployed_harvester, Vector3(0, 0.85, 0), Vector3(0.35, 1.7, 0.35), Color("383b37"))
	var new_panel := _make_child_box(_deployed_harvester, Vector3(0, 1.65, 0), Vector3(2.8, 0.13, 2.0), Color("31506a"), true)
	new_panel.rotation_degrees.x = -18.0


func _build_power_bank(camp: Node3D) -> void:
	var bank := Node3D.new()
	bank.name = "SolBank"
	camp.add_child(bank)
	for z_value in [8.2, 10.5, 12.8, 15.1]:
		_make_solid_box_child(bank, "BatteryCell", Vector3(13.0, 1.25, z_value), Vector3(1.25, 2.5, 1.5), Color("3a4240"))
		_make_child_box(bank, Vector3(12.34, 1.25, z_value), Vector3(0.1, 1.55, 0.62), Color("e39542"), true)
	_make_child_box(bank, Vector3(11.8, 0.15, 11.6), Vector3(0.35, 0.25, 8.2), Color("252d2c"))


func _build_dispatch_tower(camp: Node3D) -> void:
	var dispatch := Node3D.new()
	dispatch.name = "DispatchTower"
	camp.add_child(dispatch)
	_make_solid_box_child(dispatch, "DispatchBase", Vector3(3.7, 1.5, -3.5), Vector3(3.0, 3.0, 3.0), Color("3e494d"))
	_make_child_box(dispatch, Vector3(3.7, 3.3, -3.5), Vector3(3.7, 0.22, 3.7), Color("718692"))
	_make_child_box(dispatch, Vector3(3.7, 5.3, -3.5), Vector3(0.18, 4.0, 0.18), Color("303737"))
	_make_child_box(dispatch, Vector3(3.7, 7.2, -3.5), Vector3(1.8, 0.18, 0.18), Color("78b8d2"), true)


func _build_night_train(camp: Node3D) -> void:
	var train := Node3D.new()
	train.name = "NightTrain"
	camp.add_child(train)
	for x_value in [3.65, 5.35]:
		_make_child_box(train, Vector3(x_value, 0.08, 0), Vector3(0.14, 0.14, 19.0), Color("252929"))
	for z_value in range(-9, 10, 2):
		_make_child_box(train, Vector3(4.5, 0.05, float(z_value)), Vector3(2.3, 0.08, 0.2), Color("37322a"))
	_make_child_box(train, Vector3(8.1, 0.2, 0), Vector3(3.0, 0.4, 18.0), Color("4a4640"))
	_make_solid_box_child(train, "TrainBody", Vector3(4.5, 1.5, 3.7), Vector3(2.55, 2.6, 6.4), Color("313b40"))
	_make_child_box(train, Vector3(4.5, 2.9, 3.7), Vector3(2.8, 0.22, 6.7), Color("20272a"))
	_make_child_box(train, Vector3(4.5, 1.75, 0.43), Vector3(1.5, 0.85, 0.1), Color("f0aa50"), true)
	for z_value in [2.1, 4.0, 5.9]:
		_make_child_box(train, Vector3(3.18, 1.65, z_value), Vector3(0.08, 0.72, 0.9), Color("d48840"), true)
	for z_value in [1.4, 5.8]:
		for x_value in [3.5, 5.5]:
			var wheel := _make_child_cylinder(train, Vector3(x_value, 0.45, z_value), 0.42, 0.28, Color("151919"))
			wheel.rotation_degrees.z = 90.0


func _build_solar_field(camp: Node3D) -> void:
	var field := Node3D.new()
	field.name = "SolarHarvesterField"
	camp.add_child(field)
	for panel_data in [
		[Vector3(-13.0, 1.15, 2.5), -12.0], [Vector3(-13.0, 1.15, 7.0), -12.0],
		[Vector3(-13.0, 1.15, 11.5), -12.0], [Vector3(-13.0, 1.15, 16.0), -12.0]
	]:
		_make_child_box(field, panel_data[0] - Vector3(0, 0.75, 0), Vector3(0.22, 1.5, 0.22), Color("332f29"))
		var panel := _make_child_box(field, panel_data[0], Vector3(2.8, 0.13, 3.1), Color("2c4a64"), true)
		panel.rotation_degrees.x = panel_data[1]


func _add_home_station(camp: Node3D, station_id: String, title: String, prompt: String, at: Vector3, color: Color) -> HomeStation:
	var station: HomeStation = HomeStationScript.new()
	station.name = title.to_pascal_case().replace(" ", "") + "Station"
	station.position = at
	station.configure(station_id, title, prompt)
	camp.add_child(station)
	_make_solid_box_child(station, "Console", Vector3(0, 0.58, 0), Vector3(1.15, 1.15, 0.75), Color("343a37"))
	var screen := _make_child_box(station, Vector3(0, 1.0, -0.4), Vector3(0.78, 0.38, 0.08), color, true)
	screen.rotation_degrees.x = -12.0
	var label := Label3D.new()
	label.name = "StationLabel"
	label.text = title
	label.position = Vector3(0, 1.75, 0)
	label.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	label.font_size = 32
	label.pixel_size = 0.006
	label.modulate = color
	station.add_child(label)
	return station


func _spawn_keeper() -> void:
	player = KeeperScript.new()
	player.name = "Keeper"
	player.position = Vector3(0, 0.05, 7)
	var collision := CollisionShape3D.new()
	var capsule := CapsuleShape3D.new()
	capsule.radius = 0.42
	capsule.height = 2.7
	collision.shape = capsule
	collision.position = Vector3(0, 1.35, 0)
	player.add_child(collision)
	_home_root.add_child(player)
	player.pulse_fired.connect(_on_pulse_fired)
	player.interact_pressed.connect(_use_nearby_station)


func _spawn_enemies() -> void:
	var stalker: NightEnemy = NightEnemyScript.new()
	stalker.name = "GloomStalker"
	stalker.configure(player, NightEnemy.Behavior.GLOOM_STALKER)
	stalker.position = Vector3(-1.7, 0.05, -30.0)
	stalker.defeated.connect(_on_enemy_defeated)
	_expedition_root.add_child(stalker)

	var mite: NightEnemy = NightEnemyScript.new()
	mite.name = "LumenMite"
	mite.configure(player, NightEnemy.Behavior.LUMEN_MITE)
	mite.position = Vector3(3.2, 0.05, -47.0)
	mite.defeated.connect(_on_enemy_defeated)
	_expedition_root.add_child(mite)


func _build_puzzle() -> void:
	_relay_gate = _make_solid_box("RelayVaultGate", Vector3(0, 2.0, -67.5), Vector3(11.2, 4.0, 0.65), Color("293740"))
	for x in [-4.2, -2.1, 0.0, 2.1, 4.2]:
		_make_child_box(_relay_gate, Vector3(x, 0.0, 0.38), Vector3(0.16, 3.4, 0.1), Color("6c8290"), true)

	var mirror_one: RelayMirror = RelayMirrorScript.new()
	mirror_one.name = "WestRelayMirror"
	mirror_one.position = Vector3(-3.4, 0.0, -57.0)
	mirror_one.alignment_changed.connect(_on_mirror_alignment_changed)
	_current_build_parent().add_child(mirror_one)
	_mirrors.append(mirror_one)

	var mirror_two: RelayMirror = RelayMirrorScript.new()
	mirror_two.name = "EastRelayMirror"
	mirror_two.position = Vector3(3.2, 0.0, -63.0)
	mirror_two.rotation_degrees.y = 180.0
	mirror_two.alignment_changed.connect(_on_mirror_alignment_changed)
	_current_build_parent().add_child(mirror_two)
	_mirrors.append(mirror_two)

	_make_visual_box(Vector3(0, 1.4, -52.0), Vector3(1.4, 2.8, 0.8), Color("3b4b52"))
	_make_visual_box(Vector3(0, 1.45, -51.52), Vector3(0.42, 1.5, 0.12), Color("ffad55"), true)
	_puzzle_beam_one = _make_energy_beam(Vector3(0, 1.65, -52.0), Vector3(-3.4, 1.65, -57.0), Color("ffad55"))
	_puzzle_beam_two = _make_energy_beam(Vector3(-3.4, 1.65, -57.0), Vector3(3.2, 1.65, -63.0), Color("ffc66f"))
	_puzzle_beam_final = _make_energy_beam(Vector3(3.2, 1.65, -63.0), Vector3(0, 2.0, -67.4), Color("ffdc8f"))
	_puzzle_beam_one.visible = false
	_puzzle_beam_two.visible = false
	_puzzle_beam_final.visible = false


func _on_pulse_fired(ray_origin: Vector3, ray_direction: Vector3) -> void:
	var query := PhysicsRayQueryParameters3D.create(ray_origin, ray_origin + ray_direction * PULSE_RANGE)
	query.exclude = [player.get_rid()]
	query.collide_with_areas = true
	var hit := get_world_3d().direct_space_state.intersect_ray(query)
	var hit_position := ray_origin + ray_direction * PULSE_RANGE
	var pulse_target: Node3D
	if not hit.is_empty():
		hit_position = hit["position"]
		var direct_hit := hit["collider"] as Node3D
		if is_instance_valid(direct_hit) and direct_hit.has_method("receive_pulse"):
			pulse_target = direct_hit
	if not is_instance_valid(pulse_target) and is_instance_valid(_current_pulse_target):
		pulse_target = _current_pulse_target
		hit_position = _pulse_target_position(pulse_target)
	if is_instance_valid(pulse_target):
		_apply_pulse_to_target(pulse_target)
	else:
		_show_event("NO TARGET — CENTER A CREATURE OR RELAY MIRROR")
	_spawn_pulse_trace(player.get_pulse_muzzle_position(), hit_position)


func _apply_pulse_to_target(target: Node3D) -> void:
	var accepted := false
	var rejected_for_order := false
	if _mirrors.size() > 1 and target == _mirrors[1] and not _mirrors[0].aligned:
		rejected_for_order = true
		_show_event("NO LIGHT PATH — ALIGN THE WEST MIRROR FIRST")
	else:
		var illuminated := player.is_point_illuminated(_pulse_target_position(target))
		accepted = bool(target.call("receive_pulse", 1, illuminated))
	if not accepted and not rejected_for_order:
		_show_event("TARGET RESISTS — HOLD THE SOL LIGHT ON IT")
	elif accepted and target is NightEnemy and int(target.get("health")) > 0:
		_show_event("%s HIT — %d PULSE%s REMAIN" % [
			_pulse_target_label(target),
			int(target.get("health")),
			"" if int(target.get("health")) == 1 else "S"
		])


func _update_pulse_target() -> void:
	_current_pulse_target = _find_best_pulse_target()
	if not is_instance_valid(_target_indicator) or not is_instance_valid(_target_name_label):
		return
	if not is_instance_valid(_current_pulse_target):
		_target_indicator.visible = false
		_target_name_label.visible = false
		return
	var camera := player.get_view_camera()
	var target_position := _pulse_target_position(_current_pulse_target)
	if not is_instance_valid(camera) or camera.is_position_behind(target_position):
		_target_indicator.visible = false
		_target_name_label.visible = false
		return
	var screen_position := camera.unproject_position(target_position)
	_target_indicator.position = screen_position - _target_indicator.size * 0.5
	_target_name_label.position = screen_position + Vector2(-90.0, 34.0)
	_target_indicator.visible = true
	_target_name_label.visible = true
	_target_name_label.text = _pulse_target_label(_current_pulse_target) + "  •  LOCKED"
	var ready_color := Color("ffd07a") if player.is_point_illuminated(target_position) else Color("78d9e5")
	_target_indicator.modulate = ready_color
	_target_name_label.modulate = ready_color


func _find_best_pulse_target() -> Node3D:
	var origin := player.get_aim_origin()
	var forward := player.get_aim_direction()
	var direct_query := PhysicsRayQueryParameters3D.create(origin, origin + forward * PULSE_RANGE)
	direct_query.exclude = [player.get_rid()]
	direct_query.collide_with_areas = true
	var direct_result := get_world_3d().direct_space_state.intersect_ray(direct_query)
	if not direct_result.is_empty():
		var direct_target := direct_result["collider"] as Node3D
		if is_instance_valid(direct_target) and direct_target.has_method("receive_pulse"):
			return direct_target
	var best_target: Node3D
	var best_score := -INF
	for candidate_node in get_tree().get_nodes_in_group("pulse_targets"):
		var candidate := candidate_node as Node3D
		if not is_instance_valid(candidate) or not candidate.has_method("receive_pulse"):
			continue
		var target_position := _pulse_target_position(candidate)
		var offset := target_position - origin
		var distance := offset.length()
		if distance <= 0.01 or distance > PULSE_RANGE:
			continue
		var aim_alignment := forward.dot(offset / distance)
		if aim_alignment < cos(deg_to_rad(AUTO_TARGET_ANGLE)):
			continue
		if not _has_target_line_of_sight(origin, target_position, candidate):
			continue
		var score := aim_alignment * 5.0 - distance / PULSE_RANGE
		if score > best_score:
			best_score = score
			best_target = candidate
	return best_target


func _has_target_line_of_sight(origin: Vector3, target_position: Vector3, target: Node3D) -> bool:
	var query := PhysicsRayQueryParameters3D.create(origin, target_position)
	query.exclude = [player.get_rid()]
	query.collide_with_areas = true
	var result := get_world_3d().direct_space_state.intersect_ray(query)
	return not result.is_empty() and result["collider"] == target


func _pulse_target_position(target: Node3D) -> Vector3:
	if target.has_method("get_pulse_target_position"):
		return target.call("get_pulse_target_position") as Vector3
	return target.global_position + Vector3.UP


func _pulse_target_label(target: Node3D) -> String:
	if target.has_method("get_pulse_target_label"):
		return String(target.call("get_pulse_target_label"))
	return target.name.to_snake_case().replace("_", " ").to_upper()


func _on_enemy_defeated(enemy_title: String) -> void:
	_enemies_remaining = maxi(0, _enemies_remaining - 1)
	_show_event("%s DISPERSED — %d HOSTILE%s REMAIN" % [
		enemy_title.to_upper(),
		_enemies_remaining,
		"" if _enemies_remaining == 1 else "S"
	])


func _on_mirror_alignment_changed(_mirror: RelayMirror, _aligned: bool) -> void:
	var aligned_count := _mirrors_aligned_count()
	_puzzle_beam_one.visible = aligned_count >= 1
	_puzzle_beam_two.visible = aligned_count >= 2
	_puzzle_beam_final.visible = aligned_count >= 2
	if aligned_count == 2 and not _gate_open:
		_gate_open = true
		_show_event("LIGHT PATH RESTORED — RELAY VAULT UNSEALED")
		var gate_tween := create_tween().set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_IN_OUT)
		gate_tween.tween_property(_relay_gate, "position:y", 6.3, 1.25)


func _mirrors_aligned_count() -> int:
	var count := 0
	for mirror in _mirrors:
		if is_instance_valid(mirror) and mirror.aligned:
			count += 1
	return count


func _show_event(message: String) -> void:
	_event_message = message
	_event_message_time = 2.6


func _update_home_station() -> void:
	_current_home_station = null
	var nearest_distance := 3.0
	for station_node in get_tree().get_nodes_in_group("home_stations"):
		var station := station_node as HomeStation
		if not is_instance_valid(station):
			continue
		var distance := player.global_position.distance_to(station.global_position)
		if distance < nearest_distance:
			nearest_distance = distance
			_current_home_station = station
	if not is_instance_valid(_interaction_label):
		return
	_interaction_label.visible = is_instance_valid(_current_home_station)
	if is_instance_valid(_current_home_station):
		var input_name := "USE" if _uses_touch_controls() else "E"
		_interaction_label.text = "[%s]  %s — %s" % [
			input_name,
			_current_home_station.station_title,
			_current_home_station.get_interaction_prompt()
		]


func _use_nearby_station() -> void:
	if not is_instance_valid(_current_home_station):
		_show_event("MOVE CLOSER TO A CAMP CONSOLE")
		return
	match _current_home_station.station_id:
		"repair":
			player.recharge()
			_show_event("REPAIR CYCLE COMPLETE — SOL UNIT FULLY CHARGED")
		"upgrade":
			if extracted:
				_show_event("NIGHTGLASS CATALOGUED — HOVER MODULE SCHEMATICS AVAILABLE")
			else:
				_show_event("UPGRADE BENCH ONLINE — NIGHTGLASS SAMPLE REQUIRED")
		"stash":
			if mineral_count > 0:
				mineral_count = 0
				extracted = true
				player.recharge()
				_show_event("NIGHTGLASS SECURED — EXPEDITION COMPLETE")
			else:
				_show_event("SAFE STASH EMPTY — CARRIED GEAR IS PROTECTED HERE")
		"solar":
			_activate_solar_construction()
		"dispatch":
			_travel_to_expedition()
		"return_train":
			_travel_home()


func _travel_to_expedition() -> void:
	_at_home = false
	player.reparent(_expedition_root, false)
	player.position = Vector3(0, 0.05, 7)
	player.velocity = Vector3.ZERO
	_show_event("NIGHT LINE ARRIVAL — FORWARD PLATFORM")


func _travel_home() -> void:
	_at_home = true
	player.reparent(_home_root, false)
	player.position = Vector3(0, 0.05, 7)
	player.velocity = Vector3.ZERO
	if mineral_count > 0:
		_show_event("CARGO HOME — SECURE IT IN THE KEEPER HOUSE STASH")
	else:
		_show_event("TERMINATOR CAMP — KEEPER RETURNED")


func _activate_solar_construction() -> void:
	if _harvester_deployed:
		_show_event("SOLAR GRID STABLE — %d MW AVAILABLE" % _grid_output)
		return
	_harvester_deployed = true
	_grid_output = 2
	_deployed_harvester.visible = true
	var construction_tween := create_tween().set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_IN_OUT)
	construction_tween.tween_property(_construction_boom, "rotation:y", deg_to_rad(-58.0), 1.0)
	construction_tween.parallel().tween_property(_deployed_harvester, "scale", Vector3.ONE, 1.0)
	_show_event("NEW HARVESTER ONLINE — GRID OUTPUT INCREASED TO 2 MW")


func _build_mineral() -> void:
	_mineral = Area3D.new()
	_mineral.name = "NightglassSample"
	_mineral.position = Vector3(0, 0.75, -72.5)
	var shape_node := CollisionShape3D.new()
	var shape := SphereShape3D.new()
	shape.radius = 1.0
	shape_node.shape = shape
	_mineral.add_child(shape_node)

	var mesh_node := MeshInstance3D.new()
	var mesh := PrismMesh.new()
	mesh.size = Vector3(0.7, 1.4, 0.7)
	var material := StandardMaterial3D.new()
	material.albedo_color = Color("82c8d9")
	material.emission_enabled = true
	material.emission = Color("68b7d0")
	material.emission_energy_multiplier = 3.0
	mesh.material = material
	mesh_node.mesh = mesh
	_mineral.add_child(mesh_node)
	_mineral.body_entered.connect(_on_mineral_collected)
	_current_build_parent().add_child(_mineral)


func _build_return_zone() -> void:
	var return_zone := Area3D.new()
	return_zone.name = "DuskReturnZone"
	return_zone.position = Vector3(0, 1.0, 6.5)
	var shape_node := CollisionShape3D.new()
	var shape := BoxShape3D.new()
	shape.size = Vector3(6, 2, 4)
	shape_node.shape = shape
	return_zone.add_child(shape_node)
	return_zone.body_entered.connect(_on_return_zone_entered)
	_current_build_parent().add_child(return_zone)


func _build_expedition_station() -> void:
	var platform := Node3D.new()
	platform.name = "ReturnPlatform"
	_current_build_parent().add_child(platform)
	_make_child_box(platform, Vector3(3.0, 0.06, 7.0), Vector3(3.8, 0.12, 4.8), Color("4b4c48"), false, "ground")
	_add_home_station(platform, "return_train", "RETURN TRAIN", "TRAVEL TO TERMINATOR CAMP", Vector3(3.0, 0, 7.0), Color("78b7d1"))


func _on_mineral_collected(body: Node3D) -> void:
	if body != player or mineral_count > 0:
		return
	mineral_count = 1
	_mineral.queue_free()


func _on_return_zone_entered(body: Node3D) -> void:
	if body != player:
		return
	if mineral_count > 0 and not extracted:
		_show_event("CARGO AT FORWARD PLATFORM — USE THE RETURN TRAIN")


func _build_ui() -> void:
	_ui_layer = CanvasLayer.new()
	add_child(_ui_layer)

	var shade := ColorRect.new()
	shade.color = Color(0.015, 0.025, 0.035, 0.82)
	shade.position = Vector2(24, 22)
	shade.size = Vector2(680, 142)
	_ui_layer.add_child(shade)

	_zone_label = Label.new()
	_zone_label.position = Vector2(44, 36)
	_zone_label.add_theme_font_size_override("font_size", 16)
	_zone_label.text = "HOME — TERMINATOR DUSK"
	_ui_layer.add_child(_zone_label)

	_status_label = Label.new()
	_status_label.position = Vector2(44, 67)
	_status_label.add_theme_font_size_override("font_size", 18)
	_ui_layer.add_child(_status_label)

	_sol_bar = ProgressBar.new()
	_sol_bar.position = Vector2(44, 97)
	_sol_bar.size = Vector2(630, 18)
	_sol_bar.max_value = 100
	_sol_bar.value = 100
	_sol_bar.show_percentage = false
	_ui_layer.add_child(_sol_bar)

	_objective_label = Label.new()
	_objective_label.position = Vector2(44, 128)
	_objective_label.add_theme_font_size_override("font_size", 15)
	_objective_label.modulate = Color("e6c47a")
	_ui_layer.add_child(_objective_label)

	var controls := Label.new()
	controls.text = "WASD  MOVE     MOUSE  LOOK     E  USE     LMB / SPACE  PULSE     F  SOL LIGHT     ESC  CURSOR"
	controls.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	controls.set_anchors_preset(Control.PRESET_BOTTOM_WIDE)
	controls.offset_top = -46
	controls.offset_bottom = -18
	controls.add_theme_font_size_override("font_size", 14)
	controls.modulate = Color(0.8, 0.85, 0.88, 0.88)
	controls.visible = not _uses_touch_controls()
	_ui_layer.add_child(controls)

	var crosshair := Label.new()
	crosshair.text = "+"
	crosshair.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	crosshair.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	crosshair.set_anchors_preset(Control.PRESET_CENTER)
	crosshair.position = Vector2(-12, -16)
	crosshair.size = Vector2(24, 32)
	crosshair.add_theme_font_size_override("font_size", 23)
	crosshair.modulate = Color(0.75, 0.93, 0.94, 0.82)
	_ui_layer.add_child(crosshair)

	_target_indicator = Label.new()
	_target_indicator.name = "PulseTargetIndicator"
	_target_indicator.text = "◎"
	_target_indicator.size = Vector2(58, 58)
	_target_indicator.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_target_indicator.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	_target_indicator.add_theme_font_size_override("font_size", 46)
	_target_indicator.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_target_indicator.visible = false
	_ui_layer.add_child(_target_indicator)

	_target_name_label = Label.new()
	_target_name_label.name = "PulseTargetName"
	_target_name_label.size = Vector2(180, 24)
	_target_name_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_target_name_label.add_theme_font_size_override("font_size", 13)
	_target_name_label.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_target_name_label.visible = false
	_ui_layer.add_child(_target_name_label)

	_interaction_label = Label.new()
	_interaction_label.name = "InteractionPrompt"
	_interaction_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_interaction_label.set_anchors_preset(Control.PRESET_BOTTOM_WIDE)
	_interaction_label.offset_top = -92
	_interaction_label.offset_bottom = -58
	_interaction_label.add_theme_font_size_override("font_size", 17)
	_interaction_label.modulate = Color("d8e8c6")
	_interaction_label.visible = false
	_ui_layer.add_child(_interaction_label)


func _build_touch_controls() -> void:
	var touch_controls: TouchControls = TouchControlsScript.new()
	touch_controls.name = "TouchControls"
	_ui_layer.add_child(touch_controls)
	touch_controls.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	touch_controls.move_changed.connect(player.set_mobile_move)
	touch_controls.look_changed.connect(player.apply_mobile_look)
	touch_controls.light_pressed.connect(player.toggle_flashlight)
	touch_controls.attack_pressed.connect(player.try_pulse_attack)
	touch_controls.use_pressed.connect(player.try_interact)
	touch_controls.set_enabled_for_device(_uses_touch_controls())


func _uses_touch_controls() -> bool:
	return DisplayServer.is_touchscreen_available() or OS.has_feature("web_android") or OS.has_feature("web_ios")


func _current_build_parent() -> Node3D:
	return _build_parent if is_instance_valid(_build_parent) else self


func _make_solid_box(node_name: String, at: Vector3, size: Vector3, color: Color, surface_kind := "metal") -> StaticBody3D:
	var body := StaticBody3D.new()
	body.name = node_name
	body.position = at
	var collision := CollisionShape3D.new()
	var shape := BoxShape3D.new()
	shape.size = size
	collision.shape = shape
	body.add_child(collision)
	var mesh_node := MeshInstance3D.new()
	var mesh := BoxMesh.new()
	mesh.size = size
	mesh.material = _make_material(color, false, surface_kind)
	mesh_node.mesh = mesh
	body.add_child(mesh_node)
	_current_build_parent().add_child(body)
	return body


func _make_solid_box_child(parent: Node3D, node_name: String, at: Vector3, size: Vector3, color: Color, surface_kind := "metal") -> StaticBody3D:
	var body := StaticBody3D.new()
	body.name = node_name
	body.position = at
	var collision := CollisionShape3D.new()
	var shape := BoxShape3D.new()
	shape.size = size
	collision.shape = shape
	body.add_child(collision)
	var mesh_node := MeshInstance3D.new()
	var mesh := BoxMesh.new()
	mesh.size = size
	mesh.material = _make_material(color, false, surface_kind)
	mesh_node.mesh = mesh
	body.add_child(mesh_node)
	parent.add_child(body)
	return body


func _make_visual_box(at: Vector3, size: Vector3, color: Color, emissive := false, surface_kind := "metal") -> MeshInstance3D:
	var mesh_node := MeshInstance3D.new()
	var mesh := BoxMesh.new()
	mesh.size = size
	mesh.material = _make_material(color, emissive, surface_kind)
	mesh_node.mesh = mesh
	mesh_node.position = at
	_current_build_parent().add_child(mesh_node)
	return mesh_node


func _make_child_box(parent: Node3D, at: Vector3, size: Vector3, color: Color, emissive := false, surface_kind := "metal") -> MeshInstance3D:
	var mesh_node := MeshInstance3D.new()
	var mesh := BoxMesh.new()
	mesh.size = size
	mesh.material = _make_material(color, emissive, surface_kind)
	mesh_node.mesh = mesh
	mesh_node.position = at
	parent.add_child(mesh_node)
	return mesh_node


func _make_child_cylinder(parent: Node3D, at: Vector3, radius: float, height: float, color: Color, emissive := false) -> MeshInstance3D:
	var mesh_node := MeshInstance3D.new()
	var mesh := CylinderMesh.new()
	mesh.top_radius = radius
	mesh.bottom_radius = radius
	mesh.height = height
	mesh.radial_segments = 12
	mesh.material = _make_material(color, emissive)
	mesh_node.mesh = mesh
	mesh_node.position = at
	parent.add_child(mesh_node)
	return mesh_node


func _make_rock(at: Vector3, scale_value: Vector3) -> void:
	var mesh_node := MeshInstance3D.new()
	var mesh := SphereMesh.new()
	mesh.radius = 0.5
	mesh.height = 1.0
	mesh.radial_segments = 7
	mesh.rings = 4
	mesh.material = _make_material(Color("303840"), false)
	mesh_node.mesh = mesh
	mesh_node.position = at
	mesh_node.scale = scale_value
	mesh_node.rotation_degrees = Vector3(_rng.randf_range(-16, 16), _rng.randf_range(0, 180), _rng.randf_range(-12, 12))
	_current_build_parent().add_child(mesh_node)


func _make_crystal(at: Vector3, color: Color, scale_value: float) -> void:
	for i in range(3):
		var crystal := MeshInstance3D.new()
		var mesh := PrismMesh.new()
		mesh.size = Vector3(0.34, 1.5, 0.34) * scale_value * (1.0 - i * 0.14)
		mesh.material = _make_material(color, true)
		crystal.mesh = mesh
		crystal.position = at + Vector3((i - 1) * 0.3 * scale_value, i * 0.12, 0)
		crystal.rotation_degrees.z = (i - 1) * 13.0
		_current_build_parent().add_child(crystal)
	var glow := OmniLight3D.new()
	glow.position = at + Vector3(0, 0.5, 0)
	glow.light_color = color
	glow.light_energy = 1.1
	glow.omni_range = 4.0 * scale_value
	_current_build_parent().add_child(glow)


func _make_energy_beam(start: Vector3, end: Vector3, color: Color) -> MeshInstance3D:
	var beam := MeshInstance3D.new()
	var mesh := CylinderMesh.new()
	mesh.top_radius = 0.045
	mesh.bottom_radius = 0.045
	mesh.height = start.distance_to(end)
	mesh.radial_segments = 8
	mesh.material = _make_material(color, true)
	beam.mesh = mesh
	beam.position = (start + end) * 0.5
	_current_build_parent().add_child(beam)
	beam.look_at(end, Vector3.UP)
	beam.rotate_object_local(Vector3.RIGHT, PI * 0.5)
	return beam


func _spawn_pulse_trace(start: Vector3, end: Vector3) -> void:
	var trace := _make_energy_beam(start, end, Color("7de9ef"))
	var tween := create_tween()
	tween.tween_property(trace, "scale", Vector3(0.04, 1.0, 0.04), 0.16)
	tween.tween_callback(trace.queue_free)


func _make_material(color: Color, emissive: bool, surface_kind := "metal") -> StandardMaterial3D:
	var material := StandardMaterial3D.new()
	material.albedo_color = color
	material.roughness = 0.88
	material.diffuse_mode = BaseMaterial3D.DIFFUSE_TOON
	material.specular_mode = BaseMaterial3D.SPECULAR_TOON
	if emissive:
		material.emission_enabled = true
		material.emission = color
		material.emission_energy_multiplier = 2.5
	else:
		material.albedo_texture = _surface_texture(surface_kind)
		material.uv1_triplanar = true
		material.uv1_world_triplanar = true
		material.uv1_scale = Vector3(0.55, 0.55, 0.55) if surface_kind == "ground" else Vector3(1.15, 1.15, 1.15)
	return material


func _surface_texture(surface_kind: String) -> Texture2D:
	if _surface_textures.has(surface_kind):
		return _surface_textures[surface_kind] as Texture2D
	var noise := FastNoiseLite.new()
	noise.seed = 1947 if surface_kind == "ground" else 6113
	noise.noise_type = FastNoiseLite.TYPE_SIMPLEX_SMOOTH
	noise.frequency = 0.035 if surface_kind == "ground" else 0.085
	noise.fractal_octaves = 4 if surface_kind == "ground" else 2
	var ramp := Gradient.new()
	if surface_kind == "ground":
		ramp.offsets = PackedFloat32Array([0.0, 0.42, 0.7, 1.0])
		ramp.colors = PackedColorArray([Color("777777"), Color("a4a4a4"), Color("d0d0d0"), Color("8b8b8b")])
	else:
		ramp.offsets = PackedFloat32Array([0.0, 0.38, 0.72, 1.0])
		ramp.colors = PackedColorArray([Color("686868"), Color("929292"), Color("bababa"), Color("747474")])
	var texture := NoiseTexture2D.new()
	texture.width = 128
	texture.height = 128
	texture.seamless = true
	texture.noise = noise
	texture.color_ramp = ramp
	_surface_textures[surface_kind] = texture
	return texture
