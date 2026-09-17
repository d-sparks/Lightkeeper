extends Node3D

const KeeperScript := preload("res://scripts/player.gd")
const DARK_THRESHOLD_Z := -11.0

var player: Keeper
var mineral_count := 0
var extracted := false
var _mineral: Area3D
var _sol_bar: ProgressBar
var _objective_label: Label
var _status_label: Label
var _zone_label: Label


func _ready() -> void:
	_build_environment()
	_build_world()
	_spawn_keeper()
	_build_mineral()
	_build_return_zone()
	_build_ui()


func _process(_delta: float) -> void:
	if not is_instance_valid(player):
		return
	player.is_in_dark = player.global_position.z < DARK_THRESHOLD_Z
	_sol_bar.value = player.sol_charge
	_zone_label.text = "PERMANENT NIGHT" if player.is_in_dark else "HOME — TERMINATOR DUSK"
	_zone_label.modulate = Color("8ab8d8") if player.is_in_dark else Color("f0b36b")
	_status_label.text = "SOL %03d%%   •   MINERALS %d   •   LIGHT [F]: %s" % [
		int(player.sol_charge),
		mineral_count,
		"ON" if player.flashlight_on else "OFF"
	]
	if extracted:
		_objective_label.text = "RELAY SAMPLE SECURED — PROTOTYPE LOOP COMPLETE"
		_objective_label.modulate = Color("90e0a7")
	elif mineral_count > 0:
		_objective_label.text = "RETURN THE NIGHTGLASS SAMPLE TO THE DUSK PLATFORM"
	else:
		_objective_label.text = "VENTURE INTO THE DARK AND RECOVER NIGHTGLASS"


func _build_environment() -> void:
	var world_environment := WorldEnvironment.new()
	var environment := Environment.new()
	environment.background_mode = Environment.BG_COLOR
	environment.background_color = Color("02050a")
	environment.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	environment.ambient_light_color = Color("526170")
	environment.ambient_light_energy = 0.2
	environment.fog_enabled = true
	environment.fog_light_color = Color("101c2b")
	environment.fog_density = 0.018
	environment.fog_sky_affect = 0.0
	environment.tonemap_mode = Environment.TONE_MAPPER_FILMIC
	world_environment.environment = environment
	add_child(world_environment)

	var dusk_light := DirectionalLight3D.new()
	dusk_light.rotation_degrees = Vector3(-48, -32, 0)
	dusk_light.light_color = Color("f0a45d")
	dusk_light.light_energy = 0.7
	dusk_light.shadow_enabled = true
	add_child(dusk_light)


func _build_world() -> void:
	_make_solid_box("DuskPlatform", Vector3(0, -0.5, 5), Vector3(18, 1, 16), Color("5d4936"))
	_make_solid_box("Threshold", Vector3(0, -0.5, -7), Vector3(10, 1, 8), Color("394044"))
	_make_solid_box("DarkRoad", Vector3(0, -0.5, -26), Vector3(10, 1, 30), Color("1d2932"))
	_make_solid_box("RelayFloor", Vector3(0, -0.5, -45), Vector3(18, 1, 12), Color("18252e"))

	_make_solid_box("RoadWallLeft", Vector3(-5.4, 1.6, -26), Vector3(0.8, 4.2, 31), Color("26333d"))
	_make_solid_box("RoadWallRight", Vector3(5.4, 1.6, -26), Vector3(0.8, 4.2, 31), Color("26333d"))
	_make_solid_box("RelayWallBack", Vector3(0, 1.6, -51), Vector3(18, 4.2, 0.8), Color("202b35"))
	_make_solid_box("RelayWallLeft", Vector3(-9, 1.6, -45), Vector3(0.8, 4.2, 12), Color("202b35"))
	_make_solid_box("RelayWallRight", Vector3(9, 1.6, -45), Vector3(0.8, 4.2, 12), Color("202b35"))

	# Lighthouse infrastructure silhouettes.
	for x in [-6.5, 6.5]:
		_make_solid_box("RelayPylon", Vector3(x, 3.0, -47), Vector3(1.2, 7.0, 1.2), Color("3a4349"))
		_make_visual_box(Vector3(x, 6.8, -47), Vector3(1.8, 0.35, 1.8), Color("8bb9c8"), true)

	# A readable warm home landmark and a dead blue relay ahead.
	_make_visual_box(Vector3(-5.8, 2.4, 7.5), Vector3(2.0, 4.8, 2.0), Color("8b5c32"))
	_make_visual_box(Vector3(-5.8, 5.0, 7.5), Vector3(2.6, 0.35, 2.6), Color("f2a64d"), true)
	var home_light := OmniLight3D.new()
	home_light.position = Vector3(-5.8, 4.8, 7.5)
	home_light.light_color = Color("ffad55")
	home_light.light_energy = 4.0
	home_light.omni_range = 13.0
	add_child(home_light)

	var relay_light := OmniLight3D.new()
	relay_light.position = Vector3(0, 2.0, -47)
	relay_light.light_color = Color("6fa5c5")
	relay_light.light_energy = 1.4
	relay_light.omni_range = 10.0
	add_child(relay_light)


func _spawn_keeper() -> void:
	player = KeeperScript.new()
	player.name = "Keeper"
	player.position = Vector3(0, 0.05, 7)
	var collision := CollisionShape3D.new()
	var capsule := CapsuleShape3D.new()
	capsule.radius = 0.5
	capsule.height = 2.2
	collision.shape = capsule
	collision.position = Vector3(0, 1.1, 0)
	player.add_child(collision)
	add_child(player)


func _build_mineral() -> void:
	_mineral = Area3D.new()
	_mineral.name = "NightglassSample"
	_mineral.position = Vector3(0, 0.75, -47)
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
	add_child(_mineral)


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
	add_child(return_zone)


func _on_mineral_collected(body: Node3D) -> void:
	if body != player or mineral_count > 0:
		return
	mineral_count = 1
	_mineral.queue_free()


func _on_return_zone_entered(body: Node3D) -> void:
	if body != player:
		return
	if mineral_count > 0 and not extracted:
		extracted = true
		player.recharge()


func _build_ui() -> void:
	var layer := CanvasLayer.new()
	add_child(layer)

	var shade := ColorRect.new()
	shade.color = Color(0.015, 0.025, 0.035, 0.82)
	shade.position = Vector2(24, 22)
	shade.size = Vector2(540, 142)
	layer.add_child(shade)

	_zone_label = Label.new()
	_zone_label.position = Vector2(44, 36)
	_zone_label.add_theme_font_size_override("font_size", 16)
	_zone_label.text = "HOME — TERMINATOR DUSK"
	layer.add_child(_zone_label)

	_status_label = Label.new()
	_status_label.position = Vector2(44, 67)
	_status_label.add_theme_font_size_override("font_size", 18)
	layer.add_child(_status_label)

	_sol_bar = ProgressBar.new()
	_sol_bar.position = Vector2(44, 97)
	_sol_bar.size = Vector2(490, 18)
	_sol_bar.max_value = 100
	_sol_bar.value = 100
	_sol_bar.show_percentage = false
	layer.add_child(_sol_bar)

	_objective_label = Label.new()
	_objective_label.position = Vector2(44, 128)
	_objective_label.add_theme_font_size_override("font_size", 15)
	_objective_label.modulate = Color("e6c47a")
	layer.add_child(_objective_label)

	var controls := Label.new()
	controls.text = "WASD / ARROWS  MOVE     MOUSE  LOOK     F  SOL LIGHT     ESC  RELEASE CURSOR"
	controls.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	controls.set_anchors_preset(Control.PRESET_BOTTOM_WIDE)
	controls.offset_top = -46
	controls.offset_bottom = -18
	controls.add_theme_font_size_override("font_size", 14)
	controls.modulate = Color(0.8, 0.85, 0.88, 0.88)
	layer.add_child(controls)


func _make_solid_box(node_name: String, at: Vector3, size: Vector3, color: Color) -> void:
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
	mesh.material = _make_material(color, false)
	mesh_node.mesh = mesh
	body.add_child(mesh_node)
	add_child(body)


func _make_visual_box(at: Vector3, size: Vector3, color: Color, emissive := false) -> void:
	var mesh_node := MeshInstance3D.new()
	var mesh := BoxMesh.new()
	mesh.size = size
	mesh.material = _make_material(color, emissive)
	mesh_node.mesh = mesh
	mesh_node.position = at
	add_child(mesh_node)


func _make_material(color: Color, emissive: bool) -> StandardMaterial3D:
	var material := StandardMaterial3D.new()
	material.albedo_color = color
	material.roughness = 0.88
	if emissive:
		material.emission_enabled = true
		material.emission = color
		material.emission_energy_multiplier = 2.5
	return material

