include_guard()

# get_platform_name_from_system_name()
function(get_platform_name_from_system_name system_name platform_name)
    if(system_name STREQUAL "Android")
        set(platform_name "Android")
    elseif(
        system_name STREQUAL "Linux" OR
        system_name STREQUAL "DragonFly" OR
        system_name STREQUAL "NetBSD" OR
        system_name STREQUAL "OpenBSD" OR
        system_name STREQUAL "FreeBSD"
    )
        set(platform_name "LinuxBSD")
    elseif(system_name STREQUAL "Darwin")
        set(platform_name "MacOS")
    elseif(system_name STREQUAL "Windows")
        set(platform_name "Windows")
	else()
		set(platform_name "Unknown")
    endif()

    return(PROPAGATE platform_name)
endfunction()

# get_platform_dir()
function(get_platform_dir platform_name platform_dir)
	string(TOLOWER ${platform_name} platform_dir_name)
	if(IS_DIRECTORY ${Godot_SOURCE_DIR}/platform/${platform_dir_name})
		set(platform_dir ${Godot_SOURCE_DIR}/platform/${platform_dir_name} PARENT_SCOPE)
	else()
		message(FATAL_ERROR "Platform not found: \"${platform_name}\"")
	endif()
endfunction()

# macro_target_include_platform_config()
macro(macro_target_include_platform_config include_target)
	get_platform_dir(${GODOT_PLATFORM} platform_dir)
	# https://discourse.cmake.org/t/how-to-target-include-directories-but-for-a-single-header-file/10514/2
	configure_file(${platform_dir}/platform_config.h platform_config/platform_config.h COPYONLY)
	target_include_directories(${include_target}
		PRIVATE
			${CMAKE_CURRENT_BINARY_DIR}/platform_config  # platform_config.h
	)
endmacro()
