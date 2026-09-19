class_name TouchControls
extends Control

signal move_changed(direction: Vector2)
signal look_changed(delta: Vector2)
signal light_pressed
signal attack_pressed
signal use_pressed

const JOYSTICK_RADIUS := 72.0
const KNOB_RADIUS := 30.0
const BUTTON_RADIUS := 48.0
const ATTACK_RADIUS := 43.0
const USE_RADIUS := 40.0
const MAX_LOOK_DELTA := 28.0

var enabled_for_device := false
var _move_touch := -1
var _look_touch := -1
var _move_value := Vector2.ZERO
var _joystick_center := Vector2.ZERO
var _button_center := Vector2.ZERO
var _attack_center := Vector2.ZERO
var _use_center := Vector2.ZERO
var _look_last_position := Vector2.ZERO


func _ready() -> void:
	set_process_input(true)
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	resized.connect(_update_layout)
	_update_layout()


func set_enabled_for_device(enabled: bool) -> void:
	enabled_for_device = enabled
	visible = enabled
	set_process_input(enabled)
	queue_redraw()


func _update_layout() -> void:
	_joystick_center = Vector2(118.0, size.y - 122.0)
	_button_center = Vector2(size.x - 88.0, size.y - 104.0)
	_attack_center = Vector2(size.x - 205.0, size.y - 90.0)
	_use_center = Vector2(size.x - 310.0, size.y - 98.0)
	queue_redraw()


func _input(event: InputEvent) -> void:
	if not enabled_for_device:
		return

	if event is InputEventScreenTouch:
		if event.pressed:
			if event.position.distance_to(_use_center) <= USE_RADIUS * 1.35:
				use_pressed.emit()
				get_viewport().set_input_as_handled()
			elif event.position.distance_to(_attack_center) <= ATTACK_RADIUS * 1.35:
				attack_pressed.emit()
				get_viewport().set_input_as_handled()
			elif event.position.distance_to(_button_center) <= BUTTON_RADIUS * 1.35:
				light_pressed.emit()
				get_viewport().set_input_as_handled()
			elif event.position.x < size.x * 0.45 and event.position.y > size.y * 0.35 and _move_touch < 0:
				_move_touch = event.index
				_update_move(event.position)
				get_viewport().set_input_as_handled()
			elif _look_touch < 0:
				_look_touch = event.index
				_look_last_position = event.position
				get_viewport().set_input_as_handled()
		else:
			if event.index == _move_touch:
				_move_touch = -1
				_move_value = Vector2.ZERO
				move_changed.emit(_move_value)
				queue_redraw()
				get_viewport().set_input_as_handled()
			elif event.index == _look_touch:
				_look_touch = -1
				get_viewport().set_input_as_handled()

	elif event is InputEventScreenDrag:
		if event.index == _move_touch:
			_update_move(event.position)
			get_viewport().set_input_as_handled()
		elif event.index == _look_touch:
			# Browser touch drivers occasionally report a very large `relative`
			# value when a second finger is added. Derive the delta from this
			# finger's own tracked position and cap any remaining spike.
			var look_delta: Vector2 = event.position - _look_last_position
			_look_last_position = event.position
			look_changed.emit(look_delta.limit_length(MAX_LOOK_DELTA))
			get_viewport().set_input_as_handled()


func _update_move(position: Vector2) -> void:
	var offset := position - _joystick_center
	_move_value = offset.limit_length(JOYSTICK_RADIUS) / JOYSTICK_RADIUS
	move_changed.emit(_move_value)
	queue_redraw()


func _draw() -> void:
	if not enabled_for_device:
		return

	var warm := Color(1.0, 0.65, 0.27, 0.72)
	var pale := Color(0.78, 0.84, 0.86, 0.34)
	var dark := Color(0.02, 0.04, 0.06, 0.58)

	draw_circle(_joystick_center, JOYSTICK_RADIUS + 9.0, dark)
	draw_arc(_joystick_center, JOYSTICK_RADIUS, 0, TAU, 64, pale, 3.0, true)
	draw_circle(_joystick_center + _move_value * JOYSTICK_RADIUS, KNOB_RADIUS, Color(0.72, 0.78, 0.78, 0.62))
	draw_arc(_joystick_center + _move_value * JOYSTICK_RADIUS, KNOB_RADIUS, 0, TAU, 40, Color(0.92, 0.93, 0.89, 0.78), 2.0, true)

	draw_circle(_button_center, BUTTON_RADIUS + 7.0, dark)
	draw_circle(_button_center, BUTTON_RADIUS, Color(0.17, 0.12, 0.07, 0.76))
	draw_arc(_button_center, BUTTON_RADIUS, 0, TAU, 48, warm, 3.0, true)
	var font := ThemeDB.fallback_font
	draw_string(font, _button_center + Vector2(-18, 7), "SOL", HORIZONTAL_ALIGNMENT_LEFT, -1, 17, Color("ffd28a"))

	draw_circle(_attack_center, ATTACK_RADIUS + 7.0, dark)
	draw_circle(_attack_center, ATTACK_RADIUS, Color(0.08, 0.13, 0.16, 0.8))
	draw_arc(_attack_center, ATTACK_RADIUS, 0, TAU, 48, Color("73c9d5"), 3.0, true)
	draw_string(font, _attack_center + Vector2(-25, 7), "PULSE", HORIZONTAL_ALIGNMENT_LEFT, -1, 14, Color("a9f2f5"))

	draw_circle(_use_center, USE_RADIUS + 7.0, dark)
	draw_circle(_use_center, USE_RADIUS, Color(0.12, 0.16, 0.11, 0.8))
	draw_arc(_use_center, USE_RADIUS, 0, TAU, 48, Color("91c98b"), 3.0, true)
	draw_string(font, _use_center + Vector2(-15, 7), "USE", HORIZONTAL_ALIGNMENT_LEFT, -1, 14, Color("c8efbc"))

	draw_string(font, Vector2(size.x - 310, size.y - 174), "SWIPE TO LOOK", HORIZONTAL_ALIGNMENT_LEFT, -1, 13, Color(0.76, 0.82, 0.86, 0.52))
