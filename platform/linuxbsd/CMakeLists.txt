# https://discourse.cmake.org/t/how-to-target-include-directories-but-for-a-single-header-file/10514/2
configure_file(platform_config.h platform_config.h COPYONLY)
target_include_directories(godot
	PRIVATE
		${CMAKE_CURRENT_BINARY_DIR}
)
