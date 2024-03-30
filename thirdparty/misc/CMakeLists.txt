# Clipper.
add_library(godot_thirdparty_clipper)
target_sources(godot_thirdparty_clipper
	PRIVATE
		clipper.cpp
)
target_link_directories(godot_thirdparty_clipper
	PRIVATE
		${Godot_SOURCE_DIR}
)

# Polypartition.
add_library(godot_thirdparty_polypartition)
target_sources(godot_thirdparty_polypartition
	PRIVATE
		polypartition.cpp
)
target_link_libraries(godot_thirdparty_polypartition
	PRIVATE
		godot_core
)
target_link_directories(godot_thirdparty_polypartition
	PRIVATE
		${Godot_SOURCE_DIR}
)
