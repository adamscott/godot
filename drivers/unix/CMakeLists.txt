include(Platform)

add_library(godot_drivers_unix)

macro_target_include_platform_config(godot_drivers_unix)

target_sources(godot_drivers_unix
	PRIVATE
		dir_access_unix.cpp
		file_access_unix.cpp
		file_access_unix_pipe.cpp
		ip_unix.cpp
		net_socket_posix.cpp
		os_unix.cpp
		syslog_logger.cpp
		thread_posix.cpp
)

target_compile_definitions(godot_drivers_unix
	PRIVATE
		${GODOT_COMPILE_DEFINITIONS}
)

target_include_directories(godot_drivers_unix
	PRIVATE
		${Godot_SOURCE_DIR}
)

target_link_libraries(godot_drivers_unix
	PRIVATE
		godot_core
)
