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
