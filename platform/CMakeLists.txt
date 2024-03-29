include(Platform)

get_platform_dir(${platform_name} platform_dir)
add_subdirectory(${platform_dir})
