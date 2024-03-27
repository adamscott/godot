include_guard()

set(BASE_SUPPORTED_PLATFORMS
    "Android"
    "LinuxBSD"
    "MacOS"
    "iOS"
    "Web"
    "Windows"
)

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
    endif()

    return(PROPAGATE platform_name)
endfunction()
