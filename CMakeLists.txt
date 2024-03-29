cmake_minimum_required(VERSION 3.25)

project(Godot
    VERSION 4.3.0
    DESCRIPTION "Godot Engine"
    LANGUAGES C CXX
)

list(APPEND CMAKE_MODULE_PATH "${CMAKE_CURRENT_SOURCE_DIR}/cmake")

include(Platform)

add_executable(godot)
target_include_directories(godot
	PUBLIC
		${CMAKE_CURRENT_LIST_DIR}
)

# Platform name.
get_platform_name_from_system_name(${CMAKE_SYSTEM_NAME} platform_name)
set(GODOT_PLATFORM ${platform_name} CACHE STRING "Platform name.")

add_subdirectory(main)
add_subdirectory(core)
add_subdirectory(platform)
add_subdirectory(thirdparty)
