include(Platform)

add_library(godot_core_object)

macro_target_include_platform_config(godot_core_object)

# Run `make_virtuals.py`.
add_custom_command(
	OUTPUT gdvirtual.gen.inc
	COMMAND ${program_python3} ${CMAKE_CURRENT_LIST_DIR}/make_virtuals.py "gdvirtual.gen.inc"
	WORKING_DIRECTORY ${CMAKE_CURRENT_LIST_DIR}
)
add_library(godot_core_object_gdvirtual 
	gdvirtual.gen.inc
)
set_target_properties(godot_core_object_gdvirtual PROPERTIES LINKER_LANGUAGE CXX)

# Sources.
target_sources(godot_core_object
	PRIVATE
		callable_method_pointer.cpp
		class_db.cpp
		message_queue.cpp
		method_bind.cpp
		object.cpp
		ref_counted.cpp
		script_instance.cpp
		script_language.cpp
		script_language_extension.cpp
		undo_redo.cpp
		worker_thread_pool.cpp
)

target_compile_definitions(godot_core_object
	PUBLIC
		$<BUILD_INTERFACE:${GODOT_COMPILE_DEFINITIONS}>
)

target_include_directories(godot_core_object
	PUBLIC
		${Godot_SOURCE_DIR}
)

target_link_libraries(godot_core_object
	PUBLIC
		godot_core_object_gdvirtual
)

target_link_libraries(godot_core
	PRIVATE
		godot_core_object
)
