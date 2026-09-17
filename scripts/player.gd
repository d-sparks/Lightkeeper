class_name Keeper
extends CharacterBody3D

const WALK_SPEED := 6.0
const ACCELERATION := 22.0
const MOUSE_SENSITIVITY := 0.0024
const LIGHT_DRAIN_PER_SECOND := 2.6

var sol_charge := 100.0
var flashlight_on := true
var is_in_dark := false

var _gravity: float = ProjectSettings.get_setting("physics/3d/default_gravity")
var _camera_pitch := -0.18
var _camera_pivot: Node3D
var _spotlight: SpotLight3D
var _sol_glow: OmniLight3D
var _visual: Node3D


func _ready() -> void:
	_build_keeper_visual()
	_build_camera()
	Input.mouse_mode = Input.MOUSE_MODE_CAPTURED


func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventMouseMotion and Input.mouse_mode == Input.MOUSE_MODE_CAPTURED:
		rotation.y -= event.relative.x * MOUSE_SENSITIVITY
		_camera_pitch = clampf(
			_camera_pitch - event.relative.y * MOUSE_SENSITIVITY,
			-0.85,
			0.42
		)
		_camera_pivot.rotation.x = _camera_pitch
	elif event is InputEventMouseButton and event.pressed:
		Input.mouse_mode = Input.MOUSE_MODE_CAPTURED
	elif event is InputEventKey and event.pressed and not event.echo:
		if event.keycode == KEY_ESCAPE:
			Input.mouse_mode = Input.MOUSE_MODE_VISIBLE
		elif event.keycode == KEY_F:
			_set_flashlight(not flashlight_on)


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
	input_vector = input_vector.normalized()

	var forward := -global_transform.basis.z
	var right := global_transform.basis.x
	var desired := (right * input_vector.x + forward * input_vector.y) * WALK_SPEED
	velocity.x = move_toward(velocity.x, desired.x, ACCELERATION * delta)
	velocity.z = move_toward(velocity.z, desired.z, ACCELERATION * delta)
	move_and_slide()

	if is_in_dark and flashlight_on:
		sol_charge = maxf(0.0, sol_charge - LIGHT_DRAIN_PER_SECOND * delta)
		if sol_charge <= 0.0:
			_set_flashlight(false)


func recharge() -> void:
	sol_charge = 100.0
	_set_flashlight(true)


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

	var spring_arm := SpringArm3D.new()
	spring_arm.name = "SpringArm"
	spring_arm.spring_length = 5.2
	spring_arm.margin = 0.15
	_camera_pivot.add_child(spring_arm)

	var camera := Camera3D.new()
	camera.name = "Camera"
	camera.current = true
	camera.fov = 68.0
	spring_arm.add_child(camera)

	_spotlight = SpotLight3D.new()
	_spotlight.name = "SolBeam"
	_spotlight.light_color = Color("ffd28a")
	_spotlight.light_energy = 5.0
	_spotlight.spot_range = 24.0
	_spotlight.spot_angle = 31.0
	_spotlight.shadow_enabled = true
	_spotlight.position = Vector3(0.0, -0.1, 0.0)
	camera.add_child(_spotlight)


func _build_keeper_visual() -> void:
	_visual = Node3D.new()
	_visual.name = "RuggedKeeper"
	add_child(_visual)

	# Broad work coat and heavy boots: utility worker, not supersoldier.
	_add_capsule("Coat", Vector3(0, 1.15, 0), 0.52, 1.15, Color("8f6940"))
	_add_box("ChestHarness", Vector3(0, 1.35, -0.46), Vector3(0.72, 0.48, 0.16), Color("3b3028"))
	_add_sphere("Head", Vector3(0, 2.05, 0), Vector3(0.53, 0.48, 0.48), Color("b49364"))
	_add_box("Mask", Vector3(0, 1.98, -0.43), Vector3(0.48, 0.32, 0.34), Color("514b40"))
	_add_sphere("LeftGoggle", Vector3(-0.2, 2.12, -0.58), Vector3(0.16, 0.16, 0.10), Color("9bc3bd"), true)
	_add_sphere("RightGoggle", Vector3(0.2, 2.12, -0.58), Vector3(0.16, 0.16, 0.10), Color("9bc3bd"), true)
	_add_box("Backpack", Vector3(0, 1.35, 0.48), Vector3(0.85, 1.08, 0.42), Color("303b39"))
	_add_sphere("SolCore", Vector3(0, 1.42, 0.76), Vector3(0.25, 0.25, 0.13), Color("ffb84d"), true)

	_add_capsule("LeftArm", Vector3(-0.62, 1.25, 0), 0.19, 0.72, Color("7a5939"))
	_add_capsule("RightArm", Vector3(0.62, 1.25, 0), 0.19, 0.72, Color("7a5939"))
	_add_box("LeftBoot", Vector3(-0.25, 0.28, -0.04), Vector3(0.38, 0.55, 0.56), Color("262522"))
	_add_box("RightBoot", Vector3(0.25, 0.28, -0.04), Vector3(0.38, 0.55, 0.56), Color("262522"))

	_sol_glow = OmniLight3D.new()
	_sol_glow.name = "SolAura"
	_sol_glow.position = Vector3(0, 1.42, 0.65)
	_sol_glow.light_color = Color("ffb85c")
	_sol_glow.light_energy = 1.35
	_sol_glow.omni_range = 5.5
	_visual.add_child(_sol_glow)


func _add_box(node_name: String, at: Vector3, size: Vector3, color: Color, emissive := false) -> void:
	var mesh := BoxMesh.new()
	mesh.size = size
	_add_mesh(node_name, at, mesh, color, emissive)


func _add_sphere(node_name: String, at: Vector3, scale_value: Vector3, color: Color, emissive := false) -> void:
	var mesh := SphereMesh.new()
	mesh.radius = 0.5
	mesh.height = 1.0
	var instance := _add_mesh(node_name, at, mesh, color, emissive)
	instance.scale = scale_value * 2.0


func _add_capsule(node_name: String, at: Vector3, radius: float, height: float, color: Color) -> void:
	var mesh := CapsuleMesh.new()
	mesh.radius = radius
	mesh.height = height
	_add_mesh(node_name, at, mesh, color, false)


func _add_mesh(node_name: String, at: Vector3, mesh: PrimitiveMesh, color: Color, emissive: bool) -> MeshInstance3D:
	var material := StandardMaterial3D.new()
	material.albedo_color = color
	material.roughness = 0.82
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

