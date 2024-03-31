cmake_minimum_required(VERSION 3.25)

project(Godot
    VERSION 4.3.0
    DESCRIPTION "Godot Engine"
    LANGUAGES C CXX
)

list(
	APPEND 
		CMAKE_MODULE_PATH ${CMAKE_CURRENT_SOURCE_DIR}/cmake
)

include(Platform)

add_executable(godot)
target_include_directories(godot
	PUBLIC
		${Godot_SOURCE_DIR}
)

# Programs.
find_program(program_git
	git
	DOC "Git command."
	REQUIRED
)
find_program(program_patch
	patch
	DOC "Patch command."
	REQUIRED
)
find_program(program_python3
	python3
	DOC "Python 3 command."
	REQUIRED
)

# Platform name.
get_platform_name_from_system_name(${CMAKE_SYSTEM_NAME} platform_name)
set(GODOT_PLATFORM ${platform_name} CACHE STRING "Platform name.")

add_subdirectory(thirdparty)
add_subdirectory(core)
add_subdirectory(platform)
add_subdirectory(main)
