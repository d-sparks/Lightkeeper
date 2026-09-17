class_name Keeper
extends CharacterBody3D

const WALK_SPEED := 6.0
const ACCELERATION := 22.0
const MOUSE_SENSITIVITY := 0.0024
const LIGHT_DRAIN_PER_SECOND := 2.6
const TOUCH_LOOK_SENSITIVITY := 0.0032
const CAMERA_LENGTH := 5.2
const CAMERA_MIN_LENGTH := 0.9

var sol_charge := 100.0
var flashlight_on := true
var is_in_dark := false
var mobile_move_vector := Vector2.ZERO

var _gravity: float = ProjectSettings.get_setting("physics/3d/default_gravity")
var _camera_pitch := -0.18
var _camera_pivot: Node3D
var _camera_probe: SpringArm3D
var _camera: Camera3D
var _spotlight: SpotLight3D
var _sol_glow: OmniLight3D
var _visual: Node3D


func _ready() -> void:
	_build_keeper_visual()
	_build_camera()
	Input.mouse_mode = Input.MOUSE_MODE_CAPTURED


func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventMouseMotion and Input.mouse_mode == Input.MOUSE_MODE_CAPTURED:
		_apply_look(event.relative, MOUSE_SENSITIVITY)
	elif event is InputEventMouseButton and event.pressed:
		Input.mouse_mode = Input.MOUSE_MODE_CAPTURED
	elif event is InputEventKey and event.pressed and not event.echo:
		if event.keycode == KEY_ESCAPE:
			Input.mouse_mode = Input.MOUSE_MODE_VISIBLE
		elif event.keycode == KEY_F:
			toggle_flashlight()


func _physics_process(delta: float) -> void:
	if not is_on_floor():
		velocity.y -= _gravity * delta

	var input_vector := Vector2.ZERO
	if Input.is_key_pressed(KEY_A) or Input.is_key_pressed(KEY_LEFT):
		input_vector.x -= 1.0
	if Input.is_key_pressed(KEY_D) or Input.is_key_pressed(KEY_RIGHT):
		input_vector.x += 1.0
	if Input.is_key_pressed(KEY_W) or Input.is_key_pressed(KEY_UP):
		input_vector.y += 1.0
	if Input.is_key_pressed(KEY_S) or Input.is_key_pressed(KEY_DOWN):
		input_vector.y -= 1.0
	if mobile_move_vector.length_squared() > input_vector.length_squared():
		input_vector = Vector2(mobile_move_vector.x, -mobile_move_vector.y)
	input_vector = input_vector.normalized()

	var forward := -global_transform.basis.z
	var right := global_transform.basis.x
	var desired := (right * input_vector.x + forward * input_vector.y) * WALK_SPEED
	velocity.x = move_toward(velocity.x, desired.x, ACCELERATION * delta)
	velocity.z = move_toward(velocity.z, desired.z, ACCELERATION * delta)
	move_and_slide()
	_update_camera_collision(delta)

	if is_in_dark and flashlight_on:
		sol_charge = maxf(0.0, sol_charge - LIGHT_DRAIN_PER_SECOND * delta)
		if sol_charge <= 0.0:
			_set_flashlight(false)


func recharge() -> void:
	sol_charge = 100.0
	_set_flashlight(true)


func set_mobile_move(direction: Vector2) -> void:
	mobile_move_vector = direction


func apply_mobile_look(delta: Vector2) -> void:
	_apply_look(delta, TOUCH_LOOK_SENSITIVITY)


func toggle_flashlight() -> void:
	_set_flashlight(not flashlight_on)


func _apply_look(delta: Vector2, sensitivity: float) -> void:
	var safe_delta := delta.limit_length(80.0)
	rotation.y -= safe_delta.x * sensitivity
	_camera_pitch = clampf(_camera_pitch - safe_delta.y * sensitivity, -0.85, 0.42)
	_camera_pivot.rotation.x = _camera_pitch


func _update_camera_collision(delta: float) -> void:
	if not is_instance_valid(_camera_probe) or not is_instance_valid(_camera):
		return
	var target_length := clampf(_camera_probe.get_hit_length() - 0.12, CAMERA_MIN_LENGTH, CAMERA_LENGTH)
	var response := 16.0 if target_length < _camera.position.z else 7.0
	_camera.position.z = lerpf(_camera.position.z, target_length, 1.0 - exp(-response * delta))


func _set_flashlight(enabled: bool) -> void:
	flashlight_on = enabled and sol_charge > 0.0
	if is_instance_valid(_spotlight):
		_spotlight.visible = flashlight_on
	if is_instance_valid(_sol_glow):
		_sol_glow.light_energy = 1.35 if flashlight_on else 0.25


func _build_camera() -> void:
	_camera_pivot = Node3D.new()
	_camera_pivot.name = "CameraPivot"
	_camera_pivot.position = Vector3(0.0, 2.15, 0.0)
	_camera_pivot.rotation.x = _camera_pitch
	add_child(_camera_pivot)

	_camera_probe = SpringArm3D.new()
	_camera_probe.name = "CameraCollisionProbe"
	_camera_probe.spring_length = CAMERA_LENGTH
	_camera_probe.margin = 0.18
	_camera_probe.add_excluded_object(get_rid())
	_camera_pivot.add_child(_camera_probe)

	_camera = Camera3D.new()
	_camera.name = "Camera"
	_camera.current = true
	_camera.fov = 68.0
	_camera.position.z = CAMERA_LENGTH
	_camera_pivot.add_child(_camera)

	_spotlight = SpotLight3D.new()
	_spotlight.name = "SolBeam"
	_spotlight.light_color = Color("ffd28a")
	_spotlight.light_energy = 5.0
	_spotlight.spot_range = 24.0
	_spotlight.spot_angle = 31.0
	_spotlight.shadow_enabled = true
	_spotlight.position = Vector3(0.0, -0.1, 0.0)
	_camera.add_child(_spotlight)


func _build_keeper_visual() -> void:
	_visual = Node3D.new()
	_visual.name = "FrontierKeeper"
	add_child(_visual)

	# Layered workwear keeps the silhouette practical and slightly old-fashioned.
	_add_capsule("WaxedCoat", Vector3(0, 1.18, 0), 0.53, 1.18, Color("82613f"))
	_add_box("CoatSkirt", Vector3(0, 0.91, 0.04), Vector3(0.94, 0.52, 0.68), Color("765436"))
	_add_box("ChestBib", Vector3(0, 1.38, -0.48), Vector3(0.72, 0.55, 0.12), Color("37332b"))
	var left_strap := _add_box("LeftChestStrap", Vector3(-0.25, 1.48, -0.56), Vector3(0.1, 0.78, 0.08), Color("ba8b52"))
	left_strap.rotation_degrees.z = -12.0
	var right_strap := _add_box("RightChestStrap", Vector3(0.25, 1.48, -0.56), Vector3(0.1, 0.78, 0.08), Color("ba8b52"))
	right_strap.rotation_degrees.z = 12.0
	_add_box("ChestBuckle", Vector3(0, 1.28, -0.64), Vector3(0.22, 0.2, 0.08), Color("c7a66b"))
	_add_box("LeftPocket", Vector3(-0.31, 1.03, -0.52), Vector3(0.28, 0.27, 0.13), Color("5b4935"))
	_add_box("RightPocket", Vector3(0.31, 1.03, -0.52), Vector3(0.28, 0.27, 0.13), Color("5b4935"))

	# Full-face respirator with distinct round glass eyes; deliberately no hood.
	_add_sphere("Head", Vector3(0, 2.03, 0), Vector3(0.48, 0.48, 0.46), Color("5c5546"))
	_add_box("MaskFace", Vector3(0, 1.99, -0.43), Vector3(0.54, 0.5, 0.25), Color("403f37"))
	_add_box("MaskBrow", Vector3(0, 2.18, -0.57), Vector3(0.68, 0.12, 0.1), Color("292d2b"))
	_add_box("LeftMaskStrap", Vector3(-0.47, 2.02, -0.02), Vector3(0.08, 0.12, 0.62), Color("242724"))
	_add_box("RightMaskStrap", Vector3(0.47, 2.02, -0.02), Vector3(0.08, 0.12, 0.62), Color("242724"))
	for side in [-1.0, 1.0]:
		var x: float = side * 0.2
		var rim := _add_cylinder("GoggleRim", Vector3(x, 2.11, -0.61), 0.18, 0.18, 0.12, Color("242927"))
		rim.rotation_degrees.x = 90.0
		var lens := _add_cylinder("GoggleGlass", Vector3(x, 2.11, -0.69), 0.135, 0.135, 0.04, Color("7fb3af"), true)
		lens.rotation_degrees.x = 90.0
	var filter := _add_cylinder("RespiratorFilter", Vector3(0, 1.86, -0.68), 0.17, 0.2, 0.26, Color("292d2a"))
	filter.rotation_degrees.x = 90.0
	var filter_cap := _add_cylinder("FilterCap", Vector3(0, 1.86, -0.83), 0.13, 0.13, 0.04, Color("8b795a"))
	filter_cap.rotation_degrees.x = 90.0

	# Articulated sleeves, gloves, trousers and reinforced boots.
	for side in [-1.0, 1.0]:
		var prefix := "Left" if side < 0 else "Right"
		_add_sphere(prefix + "Shoulder", Vector3(side * 0.58, 1.53, 0), Vector3(0.25, 0.22, 0.25), Color("735235"))
		_add_capsule(prefix + "UpperSleeve", Vector3(side * 0.63, 1.28, 0), 0.18, 0.58, Color("7a5939"))
		_add_box(prefix + "ElbowPad", Vector3(side * 0.64, 1.11, -0.18), Vector3(0.28, 0.25, 0.13), Color("3c3e37"))
		_add_capsule(prefix + "Forearm", Vector3(side * 0.64, 0.96, -0.01), 0.16, 0.45, Color("6d4e33"))
		_add_sphere(prefix + "Glove", Vector3(side * 0.64, 0.75, -0.02), Vector3(0.2, 0.18, 0.22), Color("292b28"))
		_add_box(prefix + "TrouserLeg", Vector3(side * 0.25, 0.59, 0.02), Vector3(0.38, 0.58, 0.46), Color("4f493b"))
		_add_box(prefix + "KneePad", Vector3(side * 0.25, 0.57, -0.27), Vector3(0.35, 0.27, 0.12), Color("3f423b"))
		_add_box(prefix + "Boot", Vector3(side * 0.25, 0.26, -0.05), Vector3(0.4, 0.48, 0.58), Color("242522"))
		_add_box(prefix + "BootSole", Vector3(side * 0.25, 0.06, -0.09), Vector3(0.44, 0.09, 0.64), Color("121514"))

	_add_box("UtilityBelt", Vector3(0, 0.91, -0.02), Vector3(1.04, 0.16, 0.7), Color("242622"))
	_add_box("LeftBeltPouch", Vector3(-0.52, 0.91, 0), Vector3(0.22, 0.34, 0.34), Color("594630"))
	_add_box("RightBeltPouch", Vector3(0.52, 0.91, 0), Vector3(0.22, 0.34, 0.34), Color("594630"))

	# The backpack-mounted sol unit is the visual center of the character.
	_add_box("PackBody", Vector3(0, 1.38, 0.52), Vector3(0.9, 1.12, 0.44), Color("303b39"))
	_add_box("PackFrameTop", Vector3(0, 1.94, 0.72), Vector3(1.04, 0.1, 0.11), Color("171b1a"))
	_add_box("PackFrameBottom", Vector3(0, 0.83, 0.72), Vector3(1.04, 0.1, 0.11), Color("171b1a"))
	_add_box("PackRailLeft", Vector3(-0.46, 1.38, 0.72), Vector3(0.09, 1.18, 0.1), Color("171b1a"))
	_add_box("PackRailRight", Vector3(0.46, 1.38, 0.72), Vector3(0.09, 1.18, 0.1), Color("171b1a"))
	for side in [-1.0, 1.0]:
		_add_cylinder("SolCanister", Vector3(side * 0.32, 1.43, 0.79), 0.13, 0.13, 0.75, Color("737267"))
		_add_cylinder("CanisterCap", Vector3(side * 0.32, 1.84, 0.79), 0.16, 0.16, 0.09, Color("292d2a"))
		_add_box("CanisterClamp", Vector3(side * 0.32, 1.43, 0.93), Vector3(0.3, 0.1, 0.08), Color("ad7c45"))
	_add_box("CoreHousing", Vector3(0, 1.36, 0.82), Vector3(0.44, 0.5, 0.16), Color("171b1a"))
	_add_sphere("SolCore", Vector3(0, 1.39, 0.93), Vector3(0.2, 0.26, 0.11), Color("ffb84d"), true)
	_add_box("CoreGuardTop", Vector3(0, 1.69, 0.94), Vector3(0.52, 0.07, 0.08), Color("8e6438"))
	_add_box("CoreGuardBottom", Vector3(0, 1.08, 0.94), Vector3(0.52, 0.07, 0.08), Color("8e6438"))
	_add_cylinder("Antenna", Vector3(0.36, 2.13, 0.63), 0.025, 0.025, 0.55, Color("222725"))
	_add_sphere("AntennaTip", Vector3(0.36, 2.42, 0.63), Vector3(0.07, 0.07, 0.07), Color("e79543"), true)

	# A segmented breathing/power hose links mask and pack without costly curves.
	for hose_data in [
		[Vector3(0.39, 1.89, -0.35), Vector3(0, 0, -26)],
		[Vector3(0.48, 1.72, -0.16), Vector3(22, 0, -24)],
		[Vector3(0.53, 1.53, 0.08), Vector3(34, 0, -18)],
		[Vector3(0.5, 1.38, 0.32), Vector3(48, 0, -9)]
	]:
		var hose := _add_cylinder("HoseSegment", hose_data[0], 0.055, 0.055, 0.3, Color("191d1c"))
		hose.rotation_degrees = hose_data[1]

	_sol_glow = OmniLight3D.new()
	_sol_glow.name = "SolAura"
	_sol_glow.position = Vector3(0, 1.42, 0.65)
	_sol_glow.light_color = Color("ffb85c")
	_sol_glow.light_energy = 1.35
	_sol_glow.omni_range = 5.5
	_visual.add_child(_sol_glow)


func _add_box(node_name: String, at: Vector3, size: Vector3, color: Color, emissive := false) -> MeshInstance3D:
	var mesh := BoxMesh.new()
	mesh.size = size
	return _add_mesh(node_name, at, mesh, color, emissive)


func _add_sphere(node_name: String, at: Vector3, scale_value: Vector3, color: Color, emissive := false) -> void:
	var mesh := SphereMesh.new()
	mesh.radius = 0.5
	mesh.height = 1.0
	var instance := _add_mesh(node_name, at, mesh, color, emissive)
	instance.scale = scale_value * 2.0


func _add_capsule(node_name: String, at: Vector3, radius: float, height: float, color: Color) -> MeshInstance3D:
	var mesh := CapsuleMesh.new()
	mesh.radius = radius
	mesh.height = height
	return _add_mesh(node_name, at, mesh, color, false)


func _add_cylinder(node_name: String, at: Vector3, top_radius: float, bottom_radius: float, height: float, color: Color, emissive := false) -> MeshInstance3D:
	var mesh := CylinderMesh.new()
	mesh.top_radius = top_radius
	mesh.bottom_radius = bottom_radius
	mesh.height = height
	mesh.radial_segments = 12
	return _add_mesh(node_name, at, mesh, color, emissive)


func _add_mesh(node_name: String, at: Vector3, mesh: PrimitiveMesh, color: Color, emissive: bool) -> MeshInstance3D:
	var material := StandardMaterial3D.new()
	material.albedo_color = color
	material.roughness = 0.82
	material.diffuse_mode = BaseMaterial3D.DIFFUSE_TOON
	material.specular_mode = BaseMaterial3D.SPECULAR_TOON
	if emissive:
		material.emission_enabled = true
		material.emission = color
		material.emission_energy_multiplier = 2.2
	mesh.material = material
	var instance := MeshInstance3D.new()
	instance.name = node_name
	instance.mesh = mesh
	instance.position = at
	_visual.add_child(instance)
	return instance
