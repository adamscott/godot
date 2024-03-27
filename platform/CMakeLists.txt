include(Platform)

get_platform_name_from_system_name(${CMAKE_SYSTEM_NAME} platform_name)
set(PLATFORM platform_name CACHE STRING "Platform name.")
