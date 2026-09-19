class_name HomeStation
extends Node3D

var station_id := ""
var station_title := ""
var action_text := ""


func configure(id_value: String, title_value: String, action_value: String) -> void:
	station_id = id_value
	station_title = title_value
	action_text = action_value
	add_to_group("home_stations")


func get_interaction_prompt() -> String:
	return action_text
