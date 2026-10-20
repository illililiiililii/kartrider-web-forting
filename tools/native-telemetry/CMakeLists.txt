cmake_minimum_required(VERSION 3.25)
project(p5136_original_telemetry LANGUAGES CXX)

if(NOT WIN32 OR NOT MSVC OR NOT CMAKE_SIZEOF_VOID_P EQUAL 4)
    message(FATAL_ERROR "P5136 telemetry requires 32-bit MSVC")
endif()

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_MSVC_RUNTIME_LIBRARY "MultiThreaded$<$<CONFIG:Debug>:Debug>")

add_library(p5136_original_telemetry SHARED telemetry.cpp)
target_compile_definitions(p5136_original_telemetry PRIVATE WIN32_LEAN_AND_MEAN NOMINMAX UNICODE _UNICODE)
target_compile_options(p5136_original_telemetry PRIVATE /W4 /WX /permissive- /sdl /GS /utf-8)
target_link_options(p5136_original_telemetry PRIVATE /DYNAMICBASE /NXCOMPAT)
set_target_properties(p5136_original_telemetry PROPERTIES PREFIX "" OUTPUT_NAME "p5136-original-telemetry")

add_executable(p5136_telemetry_injector injector.cpp)
target_compile_definitions(p5136_telemetry_injector PRIVATE WIN32_LEAN_AND_MEAN NOMINMAX UNICODE _UNICODE)
target_compile_options(p5136_telemetry_injector PRIVATE /W4 /WX /permissive- /sdl /GS /utf-8)
target_link_options(p5136_telemetry_injector PRIVATE /DYNAMICBASE /NXCOMPAT)
set_target_properties(p5136_telemetry_injector PROPERTIES OUTPUT_NAME "p5136-telemetry-injector")

add_executable(p5136_input_driver input_driver.cpp)
target_compile_definitions(p5136_input_driver PRIVATE WIN32_LEAN_AND_MEAN NOMINMAX UNICODE _UNICODE)
target_compile_options(p5136_input_driver PRIVATE /W4 /WX /permissive- /sdl /GS /utf-8)
target_link_options(p5136_input_driver PRIVATE /DYNAMICBASE /NXCOMPAT)
set_target_properties(p5136_input_driver PROPERTIES OUTPUT_NAME "p5136-input-driver")
