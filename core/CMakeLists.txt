add_library(godot_core)

target_sources(godot_core
	PUBLIC
		core_bind.cpp
		core_constants.cpp
		core_globals.cpp
		core_string_names.cpp
		doc_data.cpp
		register_core_types.cpp
)

# Include "platform_config.h"
get_platform_dir(${GODOT_PLATFORM} platform_dir)
configure_file(${platform_dir}/platform_config.h platform_config.h COPYONLY)

target_include_directories(godot_core
	PUBLIC
		${Godot_SOURCE_DIR}
	PRIVATE
		${CMAKE_CURRENT_BINARY_DIR}
)

target_link_libraries(godot
	PRIVATE
		godot_core
)

add_subdirectory(crypto)
add_subdirectory(error)
add_subdirectory(debugger)
