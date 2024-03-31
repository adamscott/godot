include(Platform)

add_library(godot_core_math)

target_sources(godot_core_math
	PRIVATE
		aabb.cpp
		a_star.cpp
		a_star_grid_2d.cpp
		basis.cpp
		color.cpp
		convex_hull.cpp
		dynamic_bvh.cpp
		expression.cpp
		face3.cpp
		geometry_2d.cpp
		geometry_3d.cpp
		math_fieldwise.cpp
		math_funcs.cpp
		plane.cpp
		projection.cpp
		quaternion.cpp
		quick_hull.cpp
		random_number_generator.cpp
		random_pcg.cpp
		rect2.cpp
		rect2i.cpp
		static_raycaster.cpp
		transform_2d.cpp
		transform_3d.cpp
		transform_interpolator.cpp
		triangle_mesh.cpp
		triangulate.cpp
		vector2.cpp
		vector2i.cpp
		vector3.cpp
		vector3i.cpp
		vector4.cpp
		vector4i.cpp
)

# Include "platform_config.h"
macro_include_platform_config(godot_core_math)

target_include_directories(godot_core_math
	PUBLIC
		${Godot_SOURCE_DIR}
	PRIVATE
		godot_thirdparty_clipper
		godot_thirdparty_polypartition
)

target_link_libraries(godot_core
	PRIVATE
		godot_core_math
)
