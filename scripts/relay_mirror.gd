class_name RelayMirror
extends StaticBody3D

signal alignment_changed(mirror: RelayMirror, aligned: bool)

var aligned := false
var _disc: MeshInstance3D
var _glow: OmniLight3D


func _ready() -> void:
	var collision := CollisionShape3D.new()
	var shape := BoxShape3D.new()
	shape.size = Vector3(1.4, 2.2, 0.5)
	collision.shape = shape
	collision.position.y = 1.1
	add_child(collision)

	var pedestal_mesh := CylinderMesh.new()
	pedestal_mesh.top_radius = 0.42
	pedestal_mesh.bottom_radius = 0.62
	pedestal_mesh.height = 1.1
	pedestal_mesh.material = _material(Color("3b4549"), false)
	var pedestal := MeshInstance3D.new()
	pedestal.mesh = pedestal_mesh
	pedestal.position.y = 0.55
	add_child(pedestal)

	var disc_mesh := CylinderMesh.new()
	disc_mesh.top_radius = 0.7
	disc_mesh.bottom_radius = 0.7
	disc_mesh.height = 0.16
	disc_mesh.radial_segments = 20
	disc_mesh.material = _material(Color("6b7880"), true)
	_disc = MeshInstance3D.new()
	_disc.mesh = disc_mesh
	_disc.position = Vector3(0, 1.65, 0)
	_disc.rotation_degrees.x = 90.0
	_disc.rotation_degrees.z = -35.0
	add_child(_disc)

	_glow = OmniLight3D.new()
	_glow.position = Vector3(0, 1.65, 0)
	_glow.light_color = Color("6d8f9f")
	_glow.light_energy = 0.6
	_glow.omni_range = 3.0
	add_child(_glow)


func receive_pulse(_power: int, illuminated: bool) -> bool:
	if not illuminated:
		var reject := create_tween()
		reject.tween_property(_disc, "rotation_degrees:z", _disc.rotation_degrees.z + 8.0, 0.08)
		reject.tween_property(_disc, "rotation_degrees:z", _disc.rotation_degrees.z - 8.0, 0.08)
		return false
	aligned = not aligned
	var target_angle := 35.0 if aligned else -35.0
	var tween := create_tween().set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
	tween.tween_property(_disc, "rotation_degrees:z", target_angle, 0.36)
	_glow.light_color = Color("ffb65c") if aligned else Color("6d8f9f")
	_glow.light_energy = 2.2 if aligned else 0.6
	alignment_changed.emit(self, aligned)
	return true


func _material(color: Color, emissive: bool) -> StandardMaterial3D:
	var material := StandardMaterial3D.new()
	material.albedo_color = color
	material.roughness = 0.66
	material.diffuse_mode = BaseMaterial3D.DIFFUSE_TOON
	if emissive:
		material.emission_enabled = true
		material.emission = color
		material.emission_energy_multiplier = 1.6
	return material
