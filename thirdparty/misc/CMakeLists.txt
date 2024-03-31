include(Platform)

# Clipper.
add_library(godot_thirdparty_clipper)
target_sources(godot_thirdparty_clipper
	PUBLIC
		clipper.cpp
)
target_link_directories(godot_thirdparty_clipper
	PRIVATE
		${Godot_SOURCE_DIR}
)

# Polypartition.
add_library(godot_thirdparty_polypartition)
macro_include_platform_config(godot_thirdparty_polypartition)

target_sources(godot_thirdparty_polypartition
	PUBLIC
		polypartition.cpp
)
target_link_libraries(godot_thirdparty_polypartition
	PRIVATE
		godot_core_math
)
target_link_directories(godot_thirdparty_polypartition
	PRIVATE
		${Godot_SOURCE_DIR}
)
