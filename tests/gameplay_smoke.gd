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
	var camp := game.get_node_or_null("StartingEncampment")
	_assert(camp != null, "starting encampment must spawn")
	_assert(camp.get_node_or_null("KeeperHouse") != null, "Keeper House must spawn")
	_assert(camp.get_node_or_null("RepairBay") != null, "repair bay must spawn")
	_assert(camp.get_node_or_null("UpgradeShop") != null, "upgrade shop must spawn")
	_assert(camp.get_node_or_null("SolarOperations") != null, "solar operations must spawn")
	_assert(camp.get_node_or_null("ConstructionGantry") != null, "construction gantry must spawn")
	_assert(camp.get_node_or_null("NightTrain") != null, "night train must spawn")
	_assert(get_nodes_in_group("home_stations").size() == 5, "five usable home stations must register")

	var repair_station := _station_by_id("repair")
	keeper.sol_charge = 17.0
	keeper.global_position = repair_station.global_position
	game.call("_update_home_station")
	game.call("_use_nearby_station")
	_assert(keeper.sol_charge == 100.0, "repair station must recharge the sol unit")

	var solar_station := _station_by_id("solar")
	keeper.global_position = solar_station.global_position
	game.call("_update_home_station")
	game.call("_use_nearby_station")
	_assert(bool(game.get("_harvester_deployed")), "solar operations must deploy the first harvester")
	_assert(int(game.get("_grid_output")) == 2, "deployed harvester must increase grid output")
	var deployed_harvester := camp.get_node("DeployedHarvester") as Node3D
	_assert(deployed_harvester.visible, "deployed harvester must become visible")

	var stash_station := _station_by_id("stash")
	game.set("mineral_count", 1)
	keeper.global_position = stash_station.global_position
	game.call("_update_home_station")
	game.call("_use_nearby_station")
	_assert(bool(game.get("extracted")), "safe stash must complete a returned expedition")
	_assert(int(game.get("mineral_count")) == 0, "safe stash must secure carried minerals")
	_assert(game.find_child("InteractionPrompt", true, false) != null, "station interaction prompt must exist")
	var touch_controls := game.find_child("TouchControls", true, false)
	_assert(touch_controls != null and touch_controls.has_signal("use_pressed"), "mobile controls must expose a use action")

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
	keeper.global_position = Vector3(0.0, 0.05, -20.0)
	keeper.rotation.y = 0.0
	await physics_frame
	var auto_target := game.call("_find_best_pulse_target") as Node3D
	_assert(auto_target == stalker, "soft targeting must acquire a visible enemy near the center of aim")
	game.set("_current_pulse_target", stalker)
	var health_before_auto_aim := stalker.health
	game.call("_on_pulse_fired", keeper.get_aim_origin(), keeper.get_aim_direction())
	_assert(stalker.health == health_before_auto_aim - 1, "a pulse must damage the selected soft target")

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
	_assert(animation_pose.size() >= 24, "Keeper must have a detailed animated pose")
	var keeper_visual := keeper.get_node("FrontierKeeper")
	var head := keeper_visual.get_node("Head") as MeshInstance3D
	var shoulder := keeper_visual.get_node("LeftShoulder") as MeshInstance3D
	_assert(head.position.y >= 2.3 and head.scale.x <= 0.72, "Keeper must use a smaller head on a taller frame")
	_assert(absf(shoulder.position.x) <= 0.5, "Keeper shoulders must retain natural humanoid width")
	_assert(game.find_child("PulseTargetIndicator", true, false) != null, "target lock indicator must exist")
	print("Gameplay smoke passed: home stations, construction, proportions, combat, puzzle, and mobile controls are present.")
	quit(0)


func _assert(condition: bool, message: String) -> void:
	if condition:
		return
	push_error("GAMEPLAY SMOKE FAILED: " + message)
	quit(1)


func _station_by_id(station_id: String) -> HomeStation:
	for station_node in get_nodes_in_group("home_stations"):
		var station := station_node as HomeStation
		if is_instance_valid(station) and station.station_id == station_id:
			return station
	return null
