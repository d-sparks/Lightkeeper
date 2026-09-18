class_name Keeper
extends CharacterBody3D

signal pulse_fired(ray_origin: Vector3, ray_direction: Vector3)

const WALK_SPEED := 6.0
const ACCELERATION := 22.0
const MOUSE_SENSITIVITY := 0.0024
const LIGHT_DRAIN_PER_SECOND := 2.6
const TOUCH_LOOK_SENSITIVITY := 0.0032
const CAMERA_LENGTH := 5.2
const CAMERA_MIN_LENGTH := 0.9
const PULSE_COST := 4.0
const PULSE_COOLDOWN := 0.34

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
var _weapon_muzzle: Marker3D
var _muzzle_flash: OmniLight3D
var _pulse_cooldown := 0.0
var _attack_recoil := 0.0
var _gait_phase := 0.0
var _visual_bob := 0.0
var _rest_pose: Dictionary = {}


func _ready() -> void:
	_build_keeper_visual()
	_build_camera()
	Input.mouse_mode = Input.MOUSE_MODE_CAPTURED


func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventMouseMotion and Input.mouse_mode == Input.MOUSE_MODE_CAPTURED:
		_apply_look(event.relative, MOUSE_SENSITIVITY)
	elif event is InputEventMouseButton and event.pressed:
		if Input.mouse_mode != Input.MOUSE_MODE_CAPTURED:
			Input.mouse_mode = Input.MOUSE_MODE_CAPTURED
		elif event.button_index == MOUSE_BUTTON_LEFT:
			try_pulse_attack()
	elif event is InputEventKey and event.pressed and not event.echo:
		if event.keycode == KEY_ESCAPE:
			Input.mouse_mode = Input.MOUSE_MODE_VISIBLE
		elif event.keycode == KEY_F:
			toggle_flashlight()
		elif event.keycode == KEY_SPACE or event.keycode == KEY_Q:
			try_pulse_attack()


func _physics_process(delta: float) -> void:
	_pulse_cooldown = maxf(0.0, _pulse_cooldown - delta)
	_attack_recoil = move_toward(_attack_recoil, 0.0, 5.5 * delta)
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
	_animate_keeper(delta, Vector2(velocity.x, velocity.z).length() / WALK_SPEED)

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


func try_pulse_attack() -> void:
	if _pulse_cooldown > 0.0 or sol_charge < PULSE_COST or not is_instance_valid(_camera):
		return
	sol_charge -= PULSE_COST
	_pulse_cooldown = PULSE_COOLDOWN
	_attack_recoil = 1.0
	var ray_direction := -_camera.global_transform.basis.z.normalized()
	pulse_fired.emit(_camera.global_position, ray_direction)
	if is_instance_valid(_muzzle_flash):
		_muzzle_flash.light_energy = 5.0
		var flash_tween := create_tween()
		flash_tween.tween_property(_muzzle_flash, "light_energy", 0.0, 0.12)


func take_sol_damage(amount: float) -> void:
	sol_charge = maxf(0.0, sol_charge - amount)
	_attack_recoil = -0.55
	if sol_charge <= 0.0:
		_set_flashlight(false)


func is_point_illuminated(point: Vector3) -> bool:
	if not flashlight_on or not is_instance_valid(_camera):
		return false
	var offset := point - _camera.global_position
	var distance := offset.length()
	if distance <= 0.01 or distance > _spotlight.spot_range:
		return false
	var beam_direction := -_camera.global_transform.basis.z.normalized()
	return beam_direction.dot(offset / distance) > cos(deg_to_rad(_spotlight.spot_angle * 0.82))


func get_pulse_muzzle_position() -> Vector3:
	return _weapon_muzzle.global_position if is_instance_valid(_weapon_muzzle) else global_position + Vector3.UP


func get_aim_origin() -> Vector3:
	return _camera.global_position if is_instance_valid(_camera) else global_position + Vector3.UP * 1.8


func get_aim_direction() -> Vector3:
	return -_camera.global_transform.basis.z.normalized() if is_instance_valid(_camera) else -global_transform.basis.z


func get_view_camera() -> Camera3D:
	return _camera


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


func _animate_keeper(delta: float, speed_ratio: float) -> void:
	var movement := clampf(speed_ratio, 0.0, 1.0)
	_gait_phase += delta * lerpf(2.0, 10.5, movement)
	var stride := sin(_gait_phase) * movement
	var opposing_stride := sin(_gait_phase + PI) * movement
	var step_bob := absf(sin(_gait_phase)) * 0.055 * movement
	var breathing := sin(Time.get_ticks_msec() * 0.0017) * 0.012 * (1.0 - movement)
	_visual_bob = lerpf(_visual_bob, step_bob + breathing, 1.0 - exp(-10.0 * delta))
	_visual.position.y = _visual_bob
	_visual.rotation.z = lerpf(_visual.rotation.z, -velocity.x / WALK_SPEED * 0.055, 1.0 - exp(-7.0 * delta))
	_visual.rotation.x = lerpf(_visual.rotation.x, -movement * 0.035 + _attack_recoil * 0.025, 1.0 - exp(-8.0 * delta))

	_reset_animated_pose()
	_pose_part("LeftUpperSleeve", stride * 0.48, Vector3.ZERO)
	_pose_part("LeftForearm", stride * 0.34, Vector3(0, 0, stride * 0.055))
	_pose_part("LeftGlove", stride * 0.3, Vector3(0, 0, stride * 0.09))
	_pose_part("RightUpperSleeve", opposing_stride * 0.34 - _attack_recoil * 0.5, Vector3.ZERO)
	_pose_part("RightForearm", opposing_stride * 0.28 - _attack_recoil * 0.68, Vector3(0, 0, -_attack_recoil * 0.08))
	_pose_part("RightGlove", opposing_stride * 0.25 - _attack_recoil * 0.7, Vector3(0, 0, -_attack_recoil * 0.1))
	_pose_part("LeftTrouserLeg", opposing_stride * 0.48, Vector3(0, maxf(0.0, stride) * 0.035, stride * 0.07))
	_pose_part("LeftKneePad", opposing_stride * 0.42, Vector3(0, maxf(0.0, stride) * 0.035, stride * 0.09))
	_pose_part("LeftShin", -opposing_stride * 0.22, Vector3(0, maxf(0.0, stride) * 0.05, stride * 0.08))
	_pose_part("LeftBoot", opposing_stride * 0.38, Vector3(0, maxf(0.0, stride) * 0.08, stride * 0.12))
	_pose_part("LeftBootSole", opposing_stride * 0.38, Vector3(0, maxf(0.0, stride) * 0.08, stride * 0.12))
	_pose_part("RightTrouserLeg", stride * 0.48, Vector3(0, maxf(0.0, opposing_stride) * 0.035, opposing_stride * 0.07))
	_pose_part("RightKneePad", stride * 0.42, Vector3(0, maxf(0.0, opposing_stride) * 0.035, opposing_stride * 0.09))
	_pose_part("RightShin", -stride * 0.22, Vector3(0, maxf(0.0, opposing_stride) * 0.05, opposing_stride * 0.08))
	_pose_part("RightBoot", stride * 0.38, Vector3(0, maxf(0.0, opposing_stride) * 0.08, opposing_stride * 0.12))
	_pose_part("RightBootSole", stride * 0.38, Vector3(0, maxf(0.0, opposing_stride) * 0.08, opposing_stride * 0.12))
	_pose_part("CoatSkirt", -stride * 0.08, Vector3(0, 0, -movement * 0.035))
	_pose_part("PackBody", 0.0, Vector3(0, -step_bob * 0.34, movement * 0.02))
	_pose_part("CoreHousing", 0.0, Vector3(0, -step_bob * 0.42, 0))
	_pose_part("SolCore", 0.0, Vector3(0, -step_bob * 0.42, 0))
	_pose_part("PulseProjector", -_attack_recoil * 0.18, Vector3(0, 0, _attack_recoil * 0.12))
	_pose_part("PulseBarrel", -_attack_recoil * 0.18, Vector3(0, 0, _attack_recoil * 0.12))
	_pose_part("PulseCoil", -_attack_recoil * 0.18, Vector3(0, 0, _attack_recoil * 0.12))
	_pose_part("PulseMuzzle", -_attack_recoil * 0.18, Vector3(0, 0, _attack_recoil * 0.12))


func _reset_animated_pose() -> void:
	for node_name in _rest_pose:
		var part := _visual.get_node_or_null(String(node_name)) as Node3D
		if is_instance_valid(part):
			var rest_transform: Transform3D = _rest_pose[node_name]
			part.transform = rest_transform


func _pose_part(node_name: String, rotation_x: float, offset: Vector3) -> void:
	var part := _visual.get_node_or_null(node_name) as Node3D
	if not is_instance_valid(part):
		return
	part.rotation.x += rotation_x
	part.position += offset


func _capture_animation_pose() -> void:
	for node_name in [
		"LeftUpperSleeve", "LeftForearm", "LeftGlove",
		"RightUpperSleeve", "RightForearm", "RightGlove",
		"LeftTrouserLeg", "LeftKneePad", "LeftShin", "LeftBoot", "LeftBootSole",
		"RightTrouserLeg", "RightKneePad", "RightShin", "RightBoot", "RightBootSole",
		"CoatSkirt", "PackBody", "CoreHousing", "SolCore",
		"PulseProjector", "PulseBarrel", "PulseCoil", "PulseMuzzle"
	]:
		var part := _visual.get_node_or_null(node_name) as Node3D
		if is_instance_valid(part):
			_rest_pose[node_name] = part.transform


func _set_flashlight(enabled: bool) -> void:
	flashlight_on = enabled and sol_charge > 0.0
	if is_instance_valid(_spotlight):
		_spotlight.visible = flashlight_on
	if is_instance_valid(_sol_glow):
		_sol_glow.light_energy = 1.35 if flashlight_on else 0.25


func _build_camera() -> void:
	_camera_pivot = Node3D.new()
	_camera_pivot.name = "CameraPivot"
	_camera_pivot.position = Vector3(0.0, 2.35, 0.0)
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
	_add_capsule("WaxedCoat", Vector3(0, 1.62, 0), 0.44, 1.16, Color("82613f"))
	_add_box("CoatSkirt", Vector3(0, 1.27, 0.04), Vector3(0.78, 0.48, 0.58), Color("765436"))
	_add_box("ChestBib", Vector3(0, 1.69, -0.40), Vector3(0.6, 0.54, 0.1), Color("37332b"))
	var left_strap := _add_box("LeftChestStrap", Vector3(-0.21, 1.76, -0.47), Vector3(0.08, 0.74, 0.07), Color("ba8b52"))
	left_strap.rotation_degrees.z = -12.0
	var right_strap := _add_box("RightChestStrap", Vector3(0.21, 1.76, -0.47), Vector3(0.08, 0.74, 0.07), Color("ba8b52"))
	right_strap.rotation_degrees.z = 12.0
	_add_box("ChestBuckle", Vector3(0, 1.51, -0.53), Vector3(0.18, 0.17, 0.07), Color("c7a66b"))
	_add_box("LeftPocket", Vector3(-0.26, 1.37, -0.44), Vector3(0.23, 0.25, 0.11), Color("5b4935"))
	_add_box("RightPocket", Vector3(0.26, 1.37, -0.44), Vector3(0.23, 0.25, 0.11), Color("5b4935"))
	_add_box("RaisedCollar", Vector3(0, 2.05, -0.02), Vector3(0.62, 0.17, 0.46), Color("5f4934"))
	for button_y in [1.48, 1.68, 1.88]:
		_add_sphere("CoatFastener", Vector3(0, button_y, -0.485), Vector3(0.04, 0.04, 0.022), Color("d0a45f"), true)

	# Full-face respirator with distinct round glass eyes; deliberately no hood.
	_add_sphere("Head", Vector3(0, 2.38, 0), Vector3(0.35, 0.39, 0.34), Color("5c5546"))
	_add_box("MaskFace", Vector3(0, 2.34, -0.31), Vector3(0.44, 0.43, 0.21), Color("403f37"))
	_add_box("MaskBrow", Vector3(0, 2.49, -0.42), Vector3(0.56, 0.1, 0.08), Color("292d2b"))
	_add_box("LeftMaskStrap", Vector3(-0.34, 2.36, -0.02), Vector3(0.06, 0.1, 0.48), Color("242724"))
	_add_box("RightMaskStrap", Vector3(0.34, 2.36, -0.02), Vector3(0.06, 0.1, 0.48), Color("242724"))
	for side in [-1.0, 1.0]:
		var x: float = side * 0.145
		var rim := _add_cylinder("GoggleRim", Vector3(x, 2.42, -0.45), 0.135, 0.135, 0.1, Color("242927"))
		rim.rotation_degrees.x = 90.0
		var lens := _add_cylinder("GoggleGlass", Vector3(x, 2.42, -0.51), 0.1, 0.1, 0.035, Color("7fb3af"), true)
		lens.rotation_degrees.x = 90.0
	var filter := _add_cylinder("RespiratorFilter", Vector3(0, 2.2, -0.49), 0.13, 0.16, 0.22, Color("292d2a"))
	filter.rotation_degrees.x = 90.0
	var filter_cap := _add_cylinder("FilterCap", Vector3(0, 2.2, -0.61), 0.1, 0.1, 0.035, Color("8b795a"))
	filter_cap.rotation_degrees.x = 90.0
	for side in [-1.0, 1.0]:
		var valve := _add_cylinder("MaskValve", Vector3(side * 0.235, 2.24, -0.45), 0.06, 0.075, 0.08, Color("7d6b50"))
		valve.rotation_degrees.x = 90.0

	# Articulated sleeves, gloves, trousers and reinforced boots.
	for side in [-1.0, 1.0]:
		var prefix := "Left" if side < 0 else "Right"
		_add_sphere(prefix + "Shoulder", Vector3(side * 0.48, 1.86, 0), Vector3(0.2, 0.19, 0.21), Color("735235"))
		_add_capsule(prefix + "UpperSleeve", Vector3(side * 0.52, 1.58, 0), 0.145, 0.62, Color("7a5939"))
		_add_box(prefix + "ElbowPad", Vector3(side * 0.53, 1.38, -0.14), Vector3(0.23, 0.23, 0.11), Color("3c3e37"))
		_add_capsule(prefix + "Forearm", Vector3(side * 0.53, 1.18, -0.01), 0.13, 0.5, Color("6d4e33"))
		_add_sphere(prefix + "Glove", Vector3(side * 0.53, 0.93, -0.02), Vector3(0.16, 0.16, 0.18), Color("292b28"))
		_add_box(prefix + "TrouserLeg", Vector3(side * 0.21, 0.94, 0.02), Vector3(0.31, 0.52, 0.38), Color("4f493b"))
		_add_box(prefix + "KneePad", Vector3(side * 0.21, 0.68, -0.22), Vector3(0.29, 0.22, 0.1), Color("3f423b"))
		_add_box(prefix + "Shin", Vector3(side * 0.21, 0.48, 0.02), Vector3(0.29, 0.42, 0.34), Color("474338"))
		_add_box(prefix + "Boot", Vector3(side * 0.21, 0.22, -0.04), Vector3(0.34, 0.35, 0.49), Color("242522"))
		_add_box(prefix + "BootSole", Vector3(side * 0.21, 0.035, -0.07), Vector3(0.37, 0.07, 0.54), Color("121514"))

	_add_box("UtilityBelt", Vector3(0, 1.19, -0.02), Vector3(0.86, 0.14, 0.58), Color("242622"))
	_add_box("LeftBeltPouch", Vector3(-0.43, 1.16, 0), Vector3(0.19, 0.3, 0.29), Color("594630"))
	_add_box("RightBeltPouch", Vector3(0.43, 1.16, 0), Vector3(0.19, 0.3, 0.29), Color("594630"))
	_add_cylinder("LeftHipLantern", Vector3(-0.46, 0.92, -0.1), 0.09, 0.09, 0.3, Color("c8853f"), true)

	# The backpack-mounted sol unit is the visual center of the character.
	_add_box("PackBody", Vector3(0, 1.66, 0.45), Vector3(0.74, 1.0, 0.38), Color("303b39"))
	_add_box("PackFrameTop", Vector3(0, 2.17, 0.62), Vector3(0.86, 0.09, 0.1), Color("171b1a"))
	_add_box("PackFrameBottom", Vector3(0, 1.14, 0.62), Vector3(0.86, 0.09, 0.1), Color("171b1a"))
	_add_box("PackRailLeft", Vector3(-0.37, 1.66, 0.62), Vector3(0.08, 1.08, 0.09), Color("171b1a"))
	_add_box("PackRailRight", Vector3(0.37, 1.66, 0.62), Vector3(0.08, 1.08, 0.09), Color("171b1a"))
	for side in [-1.0, 1.0]:
		_add_cylinder("SolCanister", Vector3(side * 0.265, 1.7, 0.68), 0.105, 0.105, 0.72, Color("737267"))
		_add_cylinder("CanisterCap", Vector3(side * 0.265, 2.09, 0.68), 0.13, 0.13, 0.08, Color("292d2a"))
		_add_box("CanisterClamp", Vector3(side * 0.265, 1.76, 0.8), Vector3(0.25, 0.09, 0.07), Color("ad7c45"))
		_add_box("CanisterLowerClamp", Vector3(side * 0.265, 1.45, 0.8), Vector3(0.25, 0.07, 0.07), Color("6c5337"))
	_add_box("CoreHousing", Vector3(0, 1.66, 0.71), Vector3(0.36, 0.46, 0.14), Color("171b1a"))
	_add_sphere("SolCore", Vector3(0, 1.68, 0.8), Vector3(0.16, 0.23, 0.095), Color("ffb84d"), true)
	_add_box("CoreGuardTop", Vector3(0, 1.94, 0.81), Vector3(0.43, 0.06, 0.07), Color("8e6438"))
	_add_box("CoreGuardBottom", Vector3(0, 1.39, 0.81), Vector3(0.43, 0.06, 0.07), Color("8e6438"))
	_add_cylinder("Antenna", Vector3(0.3, 2.33, 0.55), 0.022, 0.022, 0.5, Color("222725"))
	_add_sphere("AntennaTip", Vector3(0.3, 2.59, 0.55), Vector3(0.055, 0.055, 0.055), Color("e79543"), true)
	var gauge := _add_cylinder("PackGauge", Vector3(-0.16, 2.07, 0.77), 0.08, 0.08, 0.035, Color("8fc1bd"), true)
	gauge.rotation_degrees.x = 90.0
	_add_box("PackSerialPlate", Vector3(0.15, 2.06, 0.79), Vector3(0.18, 0.1, 0.02), Color("b18b55"))

	# Compact industrial pulse projector, carried as a tool rather than a rifle.
	_add_box("PulseProjector", Vector3(0.6, 1.16, -0.27), Vector3(0.25, 0.29, 0.5), Color("3b403c"))
	var pulse_barrel := _add_cylinder("PulseBarrel", Vector3(0.6, 1.19, -0.57), 0.1, 0.125, 0.42, Color("6d6a5d"))
	pulse_barrel.rotation_degrees.x = 90.0
	var pulse_coil := _add_cylinder("PulseCoil", Vector3(0.6, 1.19, -0.41), 0.15, 0.15, 0.11, Color("ffad4f"), true)
	pulse_coil.rotation_degrees.x = 90.0
	_add_box("PulseGrip", Vector3(0.6, 0.99, -0.25), Vector3(0.14, 0.27, 0.16), Color("242824"))
	_weapon_muzzle = Marker3D.new()
	_weapon_muzzle.name = "PulseMuzzle"
	_weapon_muzzle.position = Vector3(0.6, 1.19, -0.8)
	_visual.add_child(_weapon_muzzle)
	_muzzle_flash = OmniLight3D.new()
	_muzzle_flash.name = "PulseFlash"
	_muzzle_flash.light_color = Color("ffbd68")
	_muzzle_flash.light_energy = 0.0
	_muzzle_flash.omni_range = 4.5
	_weapon_muzzle.add_child(_muzzle_flash)

	# A segmented breathing/power hose links mask and pack without costly curves.
	for hose_data in [
		[Vector3(0.29, 2.24, -0.25), Vector3(0, 0, -24)],
		[Vector3(0.37, 2.07, -0.1), Vector3(20, 0, -22)],
		[Vector3(0.42, 1.88, 0.08), Vector3(33, 0, -16)],
		[Vector3(0.4, 1.7, 0.27), Vector3(46, 0, -8)]
	]:
		var hose := _add_cylinder("HoseSegment", hose_data[0], 0.055, 0.055, 0.3, Color("191d1c"))
		hose.rotation_degrees = hose_data[1]

	_sol_glow = OmniLight3D.new()
	_sol_glow.name = "SolAura"
	_sol_glow.position = Vector3(0, 1.7, 0.57)
	_sol_glow.light_color = Color("ffb85c")
	_sol_glow.light_energy = 1.35
	_sol_glow.omni_range = 5.5
	_visual.add_child(_sol_glow)
	_capture_animation_pose()


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
