extends SceneTree


func _initialize() -> void:
	call_deferred("_run_checks")


func _run_checks() -> void:
	var packed_scene := load("res://scenes/main.tscn") as PackedScene
	_assert(packed_scene != null, "main scene must load")
	var game := packed_scene.instantiate()
	root.add_child(game)
	await process_frame
	await physics_frame

	var keeper := game.get_node_or_null("Keeper") as Keeper
	_assert(keeper != null, "Keeper must spawn")
	_assert(game.get_node_or_null("GloomStalker") != null, "Gloom Stalker must spawn")
	_assert(game.get_node_or_null("LumenMite") != null, "Lumen Mite must spawn")
	_assert(game.get_node_or_null("WestRelayMirror") != null, "first relay mirror must spawn")
	_assert(game.get_node_or_null("EastRelayMirror") != null, "second relay mirror must spawn")
	_assert(game.get_node_or_null("RelayVaultGate") != null, "relay vault gate must spawn")

	var starting_sol := keeper.sol_charge
	keeper.try_pulse_attack()
	_assert(keeper.sol_charge == starting_sol - 4.0, "pulse attack must consume sol charge")
	var starting_yaw := keeper.rotation.y
	keeper.apply_mobile_look(Vector2(10000.0, 0.0))
	_assert(absf(angle_difference(starting_yaw, keeper.rotation.y)) <= 0.257, "mobile look spikes must be capped")

	var stalker := game.get_node("GloomStalker") as NightEnemy
	var stalker_health := stalker.health
	_assert(not stalker.receive_pulse(1, false), "Gloom Stalker must resist pulses outside the sol beam")
	_assert(stalker.health == stalker_health, "a resisted pulse must not damage the Gloom Stalker")
	_assert(stalker.receive_pulse(1, true), "Gloom Stalker must take damage while illuminated")
	_assert(stalker.health == stalker_health - 1, "an illuminated pulse must damage the Gloom Stalker")

	var mite := game.get_node("LumenMite") as NightEnemy
	var mite_health := mite.health
	_assert(mite.receive_pulse(1, false), "Lumen Mite must remain vulnerable outside the beam")
	_assert(mite.health == mite_health - 1, "a pulse must damage the Lumen Mite")

	var mirror := game.get_node("WestRelayMirror") as RelayMirror
	_assert(not mirror.receive_pulse(1, false), "mirror must reject an unlit pulse")
	_assert(mirror.receive_pulse(1, true), "mirror must accept an illuminated pulse")
	_assert(mirror.aligned, "accepted pulse must align the mirror")
	var second_mirror := game.get_node("EastRelayMirror") as RelayMirror
	_assert(second_mirror.receive_pulse(1, true), "second illuminated mirror must align")
	_assert(bool(game.get("_gate_open")), "aligning both mirrors must unseal the relay vault")

	var animation_pose: Dictionary = keeper.get("_rest_pose")
	_assert(animation_pose.size() >= 20, "Keeper must have a detailed animated pose")
	print("Gameplay smoke passed: controls, combat rules, enemies, puzzle, and Keeper animation rig are present.")
	quit(0)


func _assert(condition: bool, message: String) -> void:
	if condition:
		return
	push_error("GAMEPLAY SMOKE FAILED: " + message)
	quit(1)
