class_name NightEnemy
extends CharacterBody3D

signal defeated(enemy_title: String)

enum Behavior { GLOOM_STALKER, LUMEN_MITE }

const GRAVITY := 20.0
const CONTACT_RANGE := 1.35

var behavior := Behavior.GLOOM_STALKER
var target: Keeper
var enemy_title := "Gloom Stalker"
var health := 3
var _attack_cooldown := 0.0
var _motion_time := 0.0
var _body_visual: Node3D
var _eye_material: StandardMaterial3D
var _hurt_tween: Tween


func configure(new_target: Keeper, new_behavior: Behavior) -> void:
	target = new_target
	behavior = new_behavior
	enemy_title = "Gloom Stalker" if behavior == Behavior.GLOOM_STALKER else "Lumen Mite"
	health = 3 if behavior == Behavior.GLOOM_STALKER else 2


func _ready() -> void:
	add_to_group("pulse_targets")
	_build_collision()
	_build_visual()


func get_pulse_target_position() -> Vector3:
	return global_position + Vector3.UP * (1.1 if behavior == Behavior.GLOOM_STALKER else 0.65)


func get_pulse_target_label() -> String:
	return enemy_title.to_upper()


func _physics_process(delta: float) -> void:
	if not is_instance_valid(target):
		return
	_motion_time += delta
	_attack_cooldown = maxf(0.0, _attack_cooldown - delta)
	if not is_on_floor():
		velocity.y -= GRAVITY * delta

	var to_target := target.global_position - global_position
	var flat_direction := Vector3(to_target.x, 0.0, to_target.z)
	var distance := flat_direction.length()
	var illuminated := target.is_point_illuminated(global_position + Vector3.UP)
	var desired := Vector3.ZERO

	if distance > 0.05:
		flat_direction /= distance
		if behavior == Behavior.GLOOM_STALKER:
			# The stalker advances in darkness but recoils and exposes itself in the beam.
			desired = -flat_direction * 2.4 if illuminated else flat_direction * 3.2
		else:
			# The mite is compulsively attracted to the sol unit's light.
			desired = flat_direction * (4.0 if target.flashlight_on else 2.0)
		rotation.y = lerp_angle(rotation.y, atan2(-flat_direction.x, -flat_direction.z), 1.0 - exp(-8.0 * delta))

	velocity.x = move_toward(velocity.x, desired.x, 10.0 * delta)
	velocity.z = move_toward(velocity.z, desired.z, 10.0 * delta)
	move_and_slide()
	_animate(illuminated)

	if distance < CONTACT_RANGE and _attack_cooldown <= 0.0:
		target.take_sol_damage(9.0 if behavior == Behavior.GLOOM_STALKER else 6.0)
		_attack_cooldown = 1.25
		velocity -= flat_direction * 4.0


func receive_pulse(power: int, illuminated: bool) -> bool:
	if behavior == Behavior.GLOOM_STALKER and not illuminated:
		_flash(Color("586a88"))
		return false
	health -= power
	_flash(Color("ffb85c"))
	if health <= 0:
		defeated.emit(enemy_title)
		set_physics_process(false)
		var death_tween := create_tween()
		death_tween.set_parallel(true)
		death_tween.tween_property(self, "scale", Vector3(1.2, 0.05, 1.2), 0.24)
		death_tween.tween_property(self, "rotation_degrees:y", rotation_degrees.y + 90.0, 0.24)
		death_tween.chain().tween_callback(queue_free)
	return true


func _build_collision() -> void:
	var collision := CollisionShape3D.new()
	var capsule := CapsuleShape3D.new()
	capsule.radius = 0.52 if behavior == Behavior.GLOOM_STALKER else 0.42
	capsule.height = 1.5 if behavior == Behavior.GLOOM_STALKER else 1.0
	collision.shape = capsule
	collision.position.y = 0.75 if behavior == Behavior.GLOOM_STALKER else 0.5
	add_child(collision)


func _build_visual() -> void:
	_body_visual = Node3D.new()
	_body_visual.name = "CreatureVisual"
	add_child(_body_visual)
	if behavior == Behavior.GLOOM_STALKER:
		_add_capsule(Vector3(0, 0.92, 0), 0.46, 1.35, Color("242b35"))
		_add_sphere(Vector3(0, 1.58, -0.06), Vector3(0.48, 0.38, 0.48), Color("323b48"))
		for side in [-1.0, 1.0]:
			_add_capsule(Vector3(side * 0.48, 0.75, -0.04), 0.13, 0.9, Color("171e27"), side * -18.0)
			_add_capsule(Vector3(side * 0.33, 0.3, 0), 0.16, 0.58, Color("1c2530"), side * 8.0)
			_add_prism(Vector3(side * 0.2, 1.78, 0.02), Vector3(0.16, 0.45, 0.16), Color("536b87"), side * 12.0)
		_add_eye(Vector3(-0.17, 1.61, -0.43), Color("8457d8"))
		_add_eye(Vector3(0.17, 1.61, -0.43), Color("8457d8"))
	else:
		_add_sphere(Vector3(0, 0.62, 0), Vector3(0.68, 0.42, 0.82), Color("4b344f"))
		for side in [-1.0, 1.0]:
			for z_offset in [-0.35, 0.0, 0.35]:
				_add_capsule(Vector3(side * 0.58, 0.38, z_offset), 0.09, 0.7, Color("2b2331"), side * 58.0)
		_add_prism(Vector3(0, 1.06, 0.12), Vector3(0.32, 0.72, 0.32), Color("a34b78"), 0.0)
		_add_eye(Vector3(0, 0.72, -0.72), Color("56c9db"))


func _animate(illuminated: bool) -> void:
	var pace := velocity.length()
	_body_visual.position.y = sin(_motion_time * (5.0 + pace)) * 0.045
	_body_visual.rotation.z = sin(_motion_time * 4.0) * 0.04 * minf(1.0, pace)
	var glow := Color("c687ff") if behavior == Behavior.GLOOM_STALKER else Color("71e5ed")
	_eye_material.emission = glow * (1.5 if illuminated else 0.65)


func _flash(color: Color) -> void:
	if is_instance_valid(_hurt_tween):
		_hurt_tween.kill()
	var flash_scale := Vector3(1.12, 0.9, 1.12) if color.r > color.b else Vector3(0.92, 1.08, 0.92)
	_body_visual.scale = flash_scale
	_hurt_tween = create_tween()
	_hurt_tween.tween_property(_body_visual, "scale", Vector3.ONE, 0.18)


func _add_eye(at: Vector3, color: Color) -> void:
	var mesh := SphereMesh.new()
	mesh.radius = 0.5
	mesh.height = 1.0
	_eye_material = _material(color, true)
	mesh.material = _eye_material
	var instance := MeshInstance3D.new()
	instance.mesh = mesh
	instance.position = at
	instance.scale = Vector3(0.16, 0.16, 0.09)
	_body_visual.add_child(instance)


func _add_sphere(at: Vector3, scale_value: Vector3, color: Color) -> void:
	var mesh := SphereMesh.new()
	mesh.radius = 0.5
	mesh.height = 1.0
	mesh.material = _material(color, false)
	var instance := MeshInstance3D.new()
	instance.mesh = mesh
	instance.position = at
	instance.scale = scale_value
	_body_visual.add_child(instance)


func _add_capsule(at: Vector3, radius: float, height: float, color: Color, tilt := 0.0) -> void:
	var mesh := CapsuleMesh.new()
	mesh.radius = radius
	mesh.height = height
	mesh.material = _material(color, false)
	var instance := MeshInstance3D.new()
	instance.mesh = mesh
	instance.position = at
	instance.rotation_degrees.z = tilt
	_body_visual.add_child(instance)


func _add_prism(at: Vector3, size: Vector3, color: Color, tilt: float) -> void:
	var mesh := PrismMesh.new()
	mesh.size = size
	mesh.material = _material(color, true)
	var instance := MeshInstance3D.new()
	instance.mesh = mesh
	instance.position = at
	instance.rotation_degrees.z = tilt
	_body_visual.add_child(instance)


func _material(color: Color, emissive: bool) -> StandardMaterial3D:
	var material := StandardMaterial3D.new()
	material.albedo_color = color
	material.roughness = 0.78
	material.diffuse_mode = BaseMaterial3D.DIFFUSE_TOON
	if emissive:
		material.emission_enabled = true
		material.emission = color
		material.emission_energy_multiplier = 2.2
	return material
