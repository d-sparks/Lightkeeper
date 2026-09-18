extends Node3D

const KeeperScript := preload("res://scripts/player.gd")
const TouchControlsScript := preload("res://scripts/touch_controls.gd")
const NightEnemyScript := preload("res://scripts/night_enemy.gd")
const RelayMirrorScript := preload("res://scripts/relay_mirror.gd")
const DARK_THRESHOLD_Z := -11.0

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


func _ready() -> void:
	_rng.seed = 74291
	_build_environment()
	_build_world()
	_spawn_keeper()
	_build_puzzle()
	_spawn_enemies()
	_build_mineral()
	_build_return_zone()
	_build_ui()
	_build_touch_controls()


func _process(delta: float) -> void:
	if not is_instance_valid(player):
		return
	_event_message_time = maxf(0.0, _event_message_time - delta)
	_objective_label.modulate = Color("e6c47a")
	player.is_in_dark = player.global_position.z < DARK_THRESHOLD_Z
	_sol_bar.value = player.sol_charge
	_zone_label.text = "PERMANENT NIGHT" if player.is_in_dark else "HOME — TERMINATOR DUSK"
	_zone_label.modulate = Color("8ab8d8") if player.is_in_dark else Color("f0b36b")
	_status_label.text = "SOL %03d%%  •  HOSTILES %d  •  MINERALS %d  •  LIGHT: %s" % [
		int(player.sol_charge),
		_enemies_remaining,
		mineral_count,
		"ON" if player.flashlight_on else "OFF"
	]
	if _event_message_time > 0.0:
		_objective_label.text = _event_message
		_objective_label.modulate = Color("efc47a")
	elif extracted:
		_objective_label.text = "RELAY SAMPLE SECURED — PROTOTYPE LOOP COMPLETE"
		_objective_label.modulate = Color("90e0a7")
	elif mineral_count > 0:
		_objective_label.text = "RETURN THE NIGHTGLASS SAMPLE TO THE DUSK PLATFORM"
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
	_make_solid_box("DuskPlatform", Vector3(0, -0.5, 5), Vector3(18, 1, 16), Color("66513c"))
	_make_solid_box("Threshold", Vector3(0, -0.5, -7), Vector3(10, 1, 8), Color("394044"))
	_make_solid_box("DarkRoad", Vector3(0, -0.5, -26), Vector3(10, 1, 30), Color("1d2932"))
	_make_solid_box("RelayFloor", Vector3(0, -0.5, -45), Vector3(18, 1, 12), Color("18252e"))
	_make_solid_box("MirrorGalleryFloor", Vector3(0, -0.5, -62), Vector3(14, 1, 22), Color("17212b"))
	_make_solid_box("RelayVaultFloor", Vector3(0, -0.5, -72), Vector3(12, 1, 8), Color("101b24"))

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

	# Home industry: squat solar fields and an improvised vertical settlement.
	for x in [-6.2, -3.7, 3.7, 6.2]:
		var panel := _make_visual_box(Vector3(x, 0.35, 2.2), Vector3(2.0, 0.12, 2.8), Color("263d53"), true)
		panel.rotation_degrees.x = -15.0
		_make_visual_box(Vector3(x, 0.0, 2.45), Vector3(0.18, 0.85, 0.18), Color("332c24"))

	for tower_data in [
		[Vector3(-7.4, 2.0, 8.2), Vector3(1.5, 5.0, 1.5)],
		[Vector3(6.8, 2.8, 9.0), Vector3(1.8, 6.6, 1.8)],
		[Vector3(4.5, 1.3, 11.0), Vector3(2.2, 3.5, 1.7)]
	]:
		_make_visual_box(tower_data[0], tower_data[1], Color("4f4940"))
		_make_visual_box(tower_data[0] + Vector3(0, tower_data[1].y * 0.55, 0), Vector3(tower_data[1].x * 1.25, 0.18, tower_data[1].z * 1.25), Color("ad7744"), true)

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
	player.pulse_fired.connect(_on_pulse_fired)


func _spawn_enemies() -> void:
	var stalker: NightEnemy = NightEnemyScript.new()
	stalker.name = "GloomStalker"
	stalker.configure(player, NightEnemy.Behavior.GLOOM_STALKER)
	stalker.position = Vector3(-1.7, 0.05, -30.0)
	stalker.defeated.connect(_on_enemy_defeated)
	add_child(stalker)

	var mite: NightEnemy = NightEnemyScript.new()
	mite.name = "LumenMite"
	mite.configure(player, NightEnemy.Behavior.LUMEN_MITE)
	mite.position = Vector3(3.2, 0.05, -47.0)
	mite.defeated.connect(_on_enemy_defeated)
	add_child(mite)


func _build_puzzle() -> void:
	_relay_gate = _make_solid_box("RelayVaultGate", Vector3(0, 2.0, -67.5), Vector3(11.2, 4.0, 0.65), Color("293740"))
	for x in [-4.2, -2.1, 0.0, 2.1, 4.2]:
		_make_child_box(_relay_gate, Vector3(x, 0.0, 0.38), Vector3(0.16, 3.4, 0.1), Color("6c8290"), true)

	var mirror_one: RelayMirror = RelayMirrorScript.new()
	mirror_one.name = "WestRelayMirror"
	mirror_one.position = Vector3(-3.4, 0.0, -57.0)
	mirror_one.alignment_changed.connect(_on_mirror_alignment_changed)
	add_child(mirror_one)
	_mirrors.append(mirror_one)

	var mirror_two: RelayMirror = RelayMirrorScript.new()
	mirror_two.name = "EastRelayMirror"
	mirror_two.position = Vector3(3.2, 0.0, -63.0)
	mirror_two.rotation_degrees.y = 180.0
	mirror_two.alignment_changed.connect(_on_mirror_alignment_changed)
	add_child(mirror_two)
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
	var query := PhysicsRayQueryParameters3D.create(ray_origin, ray_origin + ray_direction * 34.0)
	query.exclude = [player.get_rid()]
	query.collide_with_areas = true
	var hit := get_world_3d().direct_space_state.intersect_ray(query)
	var hit_position := ray_origin + ray_direction * 34.0
	if not hit.is_empty():
		hit_position = hit["position"]
		var collider: Object = hit["collider"]
		var collider_node := collider as Node3D
		if collider.has_method("receive_pulse") and is_instance_valid(collider_node):
			var accepted := false
			var rejected_for_order := false
			if _mirrors.size() > 1 and collider_node == _mirrors[1] and not _mirrors[0].aligned:
				rejected_for_order = true
				_show_event("NO LIGHT PATH — ALIGN THE WEST MIRROR FIRST")
			else:
				var illuminated := player.is_point_illuminated(collider_node.global_position)
				accepted = bool(collider.call("receive_pulse", 1, illuminated))
			if not accepted and not rejected_for_order:
				_show_event("THE TARGET RESISTS — HOLD THE SOL LIGHT ON IT")
	_spawn_pulse_trace(player.get_pulse_muzzle_position(), hit_position)


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
	controls.text = "WASD  MOVE     MOUSE  LOOK     LMB / SPACE  PULSE     F  SOL LIGHT     ESC  CURSOR"
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


func _build_touch_controls() -> void:
	var touch_controls: TouchControls = TouchControlsScript.new()
	touch_controls.name = "TouchControls"
	_ui_layer.add_child(touch_controls)
	touch_controls.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	touch_controls.move_changed.connect(player.set_mobile_move)
	touch_controls.look_changed.connect(player.apply_mobile_look)
	touch_controls.light_pressed.connect(player.toggle_flashlight)
	touch_controls.attack_pressed.connect(player.try_pulse_attack)
	touch_controls.set_enabled_for_device(_uses_touch_controls())


func _uses_touch_controls() -> bool:
	return DisplayServer.is_touchscreen_available() or OS.has_feature("web_android") or OS.has_feature("web_ios")


func _make_solid_box(node_name: String, at: Vector3, size: Vector3, color: Color) -> StaticBody3D:
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
	return body


func _make_visual_box(at: Vector3, size: Vector3, color: Color, emissive := false) -> MeshInstance3D:
	var mesh_node := MeshInstance3D.new()
	var mesh := BoxMesh.new()
	mesh.size = size
	mesh.material = _make_material(color, emissive)
	mesh_node.mesh = mesh
	mesh_node.position = at
	add_child(mesh_node)
	return mesh_node


func _make_child_box(parent: Node3D, at: Vector3, size: Vector3, color: Color, emissive := false) -> MeshInstance3D:
	var mesh_node := MeshInstance3D.new()
	var mesh := BoxMesh.new()
	mesh.size = size
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
	add_child(mesh_node)


func _make_crystal(at: Vector3, color: Color, scale_value: float) -> void:
	for i in range(3):
		var crystal := MeshInstance3D.new()
		var mesh := PrismMesh.new()
		mesh.size = Vector3(0.34, 1.5, 0.34) * scale_value * (1.0 - i * 0.14)
		mesh.material = _make_material(color, true)
		crystal.mesh = mesh
		crystal.position = at + Vector3((i - 1) * 0.3 * scale_value, i * 0.12, 0)
		crystal.rotation_degrees.z = (i - 1) * 13.0
		add_child(crystal)
	var glow := OmniLight3D.new()
	glow.position = at + Vector3(0, 0.5, 0)
	glow.light_color = color
	glow.light_energy = 1.1
	glow.omni_range = 4.0 * scale_value
	add_child(glow)


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
	add_child(beam)
	beam.look_at(end, Vector3.UP)
	beam.rotate_object_local(Vector3.RIGHT, PI * 0.5)
	return beam


func _spawn_pulse_trace(start: Vector3, end: Vector3) -> void:
	var trace := _make_energy_beam(start, end, Color("7de9ef"))
	var tween := create_tween()
	tween.tween_property(trace, "scale", Vector3(0.04, 1.0, 0.04), 0.16)
	tween.tween_callback(trace.queue_free)


func _make_material(color: Color, emissive: bool) -> StandardMaterial3D:
	var material := StandardMaterial3D.new()
	material.albedo_color = color
	material.roughness = 0.88
	material.diffuse_mode = BaseMaterial3D.DIFFUSE_TOON
	material.specular_mode = BaseMaterial3D.SPECULAR_TOON
	if emissive:
		material.emission_enabled = true
		material.emission = color
		material.emission_energy_multiplier = 2.5
	return material
