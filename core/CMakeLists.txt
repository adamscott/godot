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
		${CMAKE_CURRENT_BINARY_DIR}  # platform_config.h
)

target_link_libraries(godot_core
	PRIVATE
		godot_thirdparty_zstd
)

target_link_libraries(godot
	PRIVATE
		godot_core
)

add_subdirectory(config)
add_subdirectory(crypto)
add_subdirectory(debugger)
add_subdirectory(error)
add_subdirectory(extension)
add_subdirectory(input)
add_subdirectory(io)
add_subdirectory(math)
add_subdirectory(object)
add_subdirectory(os)
add_subdirectory(string)
add_subdirectory(templates)
add_subdirectory(variant)
