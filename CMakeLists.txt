cmake_minimum_required(VERSION 3.25)

project(Godot
    VERSION 4.3.0
    DESCRIPTION "Godot Engine"
    LANGUAGES C CXX
)

list(APPEND CMAKE_MODULE_PATH "${CMAKE_CURRENT_SOURCE_DIR}/cmake")

add_subdirectory(platform)
add_subdirectory(thirdparty)
