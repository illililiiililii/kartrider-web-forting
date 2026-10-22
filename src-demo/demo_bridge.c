/* Local WebAssembly adapter. The driving and camera computations are linked
 * directly from the user's separate KartriderDemoPhysics checkout. No upstream
 * source or derived binary is distributed with this repository. */
#include "kart_simulation.h"
#include "kart_camera.h"
#include "kart_demo_data.h"
#include "kart_track_scene.h"
#include "kart_track_collision.h"
#include "kart_countdown.h"
#include "kart_course.h"
#include "kart_engine_sound.h"
#include "kart_gauge.h"
#include "kart_input.h"
#include <math.h>
#include <stdlib.h>
#include <string.h>

static KartSimulationState kart;
static KartChaseCameraFollow chase;
static KartSimulationWorld world;
static float telemetry[40];
static KartGaugeState gauge;
static KartGaugeConfig gauge_config;
/* V1's passive charger is a 5136-era feature absent from the 2004 demo.
   The threshold/rate are provisional and deliberately kept outside upstream C. */
static bool v1_charger_enabled;
static float v1_charger_threshold = 25.0f; /* metres / second */
static float v1_charger_rate = 2.0f;       /* gauge units / second */
static KartCountdown race_countdown;
static KartSoundDriver sound_driver;
static KartSoundState sound_state;
static KartSteeringInputState steering_keys;
static KartCourse course;
/* This table is generated locally from the user's 5136 track.1s files. */
extern const KartCourseAsset *kart_5136_course_asset_at(unsigned int index);
float demo_track_ground_height(float x, float y, float top);
static KartCourseProgress course_progress;
static bool course_enabled;
static unsigned int clock_ms;
static unsigned int respawn_arm_ms;
static bool previous_throttle, previous_boost;
static float race_phase, countdown, lap, next_gate, race_time, finish_time;
static float wall_hits;
static bool wall_contact;
static unsigned int last_wall_hit_ms;
static KartVec3 stable_ground_position;
static KartVec3 fallback_respawn_position;
static KartQuat fallback_respawn_orientation;
static unsigned int last_fallback_mark_ms;
static float previous_x, previous_y;
static unsigned int preset_index = 10; /* cotten5, demo simulator default */
static KartTrackScene track_scene;
static KartDemoTrackSpec track_spec = {
    .asset_name = "p5136-local-usd", .display_name = "P5136 local USD",
    .minimum = {-10000.0f, -10000.0f, -10000.0f},
    .maximum = {10000.0f, 10000.0f, 10000.0f},
    .has_scene = true, .start_kind = KART_TRACK_START_CONFIRMED,
    .start_line = {0.0f, 0.0f, 0.0f},
};
static bool track_enabled;
static float spawn_x, spawn_y, spawn_z, spawn_heading;

/* Zig's WASI libc expects a main symbol even for a no-entry library. */
int main(void) { return 0; }

static bool ground_query(void *unused, KartVec3 start, KartVec3 delta, KartGroundHit *hit) {
    (void)unused;
    if (track_enabled)
        return kart_track_scene_query_ground(&track_scene, &track_spec, start, delta, hit);
    if (delta.z >= 0.0f || start.z < 0.0f || start.z + delta.z > 0.0f) return false;
    float fraction = -start.z / delta.z;
    hit->point = (KartVec3){ start.x + delta.x * fraction, start.y + delta.y * fraction, 0.0f };
    hit->normal = (KartVec3){0.0f, 0.0f, 1.0f};
    hit->surface_id = 0;
    return true;
}

static unsigned int body_query(void *unused, const KartSimulationState *state,
                               KartBodyContact *contacts, unsigned int capacity) {
    (void)unused;
    if (capacity == 0) return 0;
    if (track_enabled)
        return kart_track_scene_query_body_collisions(
            &track_scene, &track_spec, state, contacts, capacity);
    const KartVec3 p = state->position;
    KartVec3 normal = {0};
    if (p.x > 78.0f) normal.x = -1.0f;
    else if (p.x < -78.0f) normal.x = 1.0f;
    else if (p.y > 78.0f) normal.y = -1.0f;
    else if (p.y < -78.0f) normal.y = 1.0f;
    else return 0;
    contacts[0] = (KartBodyContact){.normal = normal, .point = p, .sweep_fraction = 0.0f};
    return 1;
}

static void reset_at(float x, float y, float heading) {
    const KartDemoKartSpec *spec = kart_demo_kart_at(preset_index);
    KartSimulationGeometry web_geometry = spec ? spec->geometry : (KartSimulationGeometry){0};
    /* The rendered P5136 kart is 0.83 m wide at 0.50 visual scale; this
       0.84 m-wide C body matches it. The track mesh, collision and ToRoad
       gates are enlarged together, not the kart or this hitbox. */
    if (track_enabled) {
        web_geometry.half_width = 0.42f;
        web_geometry.half_length = 0.62f;
    }
    kart_simulation_init(&kart, spec ? &spec->dynamics : NULL,
                         &web_geometry);
    kart.position = (KartVec3){x, y, track_enabled ? spawn_z + 0.5f : 0.5f};
    stable_ground_position = kart.position;
    /* Identity faces world -Y; +pi/2 rotates the forward axis to +X. */
    const float angle = heading + 1.5707963267948966f;
    kart.orientation = (KartQuat){cosf(angle * 0.5f), 0.0f, 0.0f, sinf(angle * 0.5f)};
    fallback_respawn_position = kart.position;
    fallback_respawn_orientation = kart.orientation;
    last_fallback_mark_ms = 0u;
    kart_chase_camera_follow_reset(&chase);
    world = (KartSimulationWorld){ground_query, body_query, NULL};
    memset(telemetry, 0, sizeof telemetry);
    gauge = (KartGaugeState){.model = KART_GAUGE_SLIP};
    gauge_config = kart_gauge_default_config();
    race_countdown = (KartCountdown){0};
    kart_sound_driver_reset(&sound_driver);
    sound_state = (KartSoundState){0};
    kart_steering_input_reset(&steering_keys);
    clock_ms = 0;
    respawn_arm_ms = 0;
    previous_throttle = previous_boost = false;
    wall_hits = 0.0f;
    wall_contact = false;
    last_wall_hit_ms = 0;
    race_phase = countdown = next_gate = race_time = finish_time = 0.0f;
    lap = 1.0f;
    previous_x = x;
    previous_y = y;
    if (course_enabled)
        kart_course_progress_init(&course, &course_progress, kart.position);
}

static void update_race(float dt) {
    if (race_phase == 1.0f) {
        const KartCountdownCues cues = kart_countdown_update(&race_countdown, clock_ms);
        countdown = (float)cues.remaining_ms * 0.001f;
        if (cues.released) race_phase = 2.0f;
        return;
    }
    if (race_phase != 2.0f) return;
    race_time += dt;
    if (course_enabled) {
        const KartVec3 previous = {previous_x, previous_y, kart.position.z};
        KartVec3 destination;
        float yaw;
        if (kart_course_warp_next(&course, previous, kart.position,
                                  &destination, &yaw)) {
            const float c = cosf(yaw), s = sinf(yaw);
            const KartVec3 v = kart.linear_velocity;
            const KartVec3 w = kart.angular_velocity;
            const KartQuat q = kart.orientation;
            const KartQuat rotation = {cosf(yaw * 0.5f), 0, 0, sinf(yaw * 0.5f)};
            kart.position = destination;
            kart.linear_velocity = (KartVec3){c*v.x-s*v.y, s*v.x+c*v.y, v.z};
            kart.angular_velocity = (KartVec3){c*w.x-s*w.y, s*w.x+c*w.y, w.z};
            kart.orientation = (KartQuat){
                rotation.w*q.w-rotation.z*q.z,
                rotation.w*q.x-rotation.z*q.y,
                rotation.w*q.y+rotation.z*q.x,
                rotation.w*q.z+rotation.z*q.w};
            previous_x = destination.x;
            previous_y = destination.y;
        } else {
            kart_course_progress_step(&course, &course_progress, previous,
                kart.position, kart.orientation, kart.linear_velocity,
                (unsigned int)(race_time * 1000.0f));
        }
        lap = (float)(course_progress.lap ? course_progress.lap : 1u);
        next_gate = (float)course_progress.node_id;
        if (course_progress.lap >= course.lap_count) {
            race_phase = 3.0f;
            finish_time = race_time;
        }
    }
}

static void publish(unsigned int elapsed_ms, KartSimulationStepResult step) {
    const KartQuat q = kart.orientation;
    const float fx = 2.0f * (q.w*q.z - q.x*q.y);
    const float fy = -(1.0f - 2.0f * (q.x*q.x + q.z*q.z));
    const float rx = 1.0f - 2.0f * (q.y*q.y + q.z*q.z);
    const float ry = 2.0f * (q.x*q.y + q.w*q.z);
    const float speed = sqrtf(kart.linear_velocity.x*kart.linear_velocity.x +
                              kart.linear_velocity.y*kart.linear_velocity.y +
                              kart.linear_velocity.z*kart.linear_velocity.z);
    const float lateral = kart.linear_velocity.x*rx + kart.linear_velocity.y*ry;
    const float forward = kart.linear_velocity.x*fx + kart.linear_velocity.y*fy;
    const bool drifting = kart.drift.input_active || kart.drift.slip_detected ||
                          kart.drift.trigger_active || kart.drift.linger_timer > 0.0f;
    const float dt = (float)elapsed_ms * 0.001f;
    kart_gauge_update(&gauge, &gauge_config, &kart, forward, lateral,
                      drifting, dt);
    if (v1_charger_enabled && kart.grounded && !drifting &&
        fabsf(forward) >= v1_charger_threshold && dt > 0.0f &&
        gauge.boosters < KART_GAUGE_MAX_BOOSTERS) {
        gauge.value += v1_charger_rate * dt;
        gauge.rate += v1_charger_rate;
        if (gauge.value >= gauge_config.full_value) {
            gauge.value -= gauge_config.full_value;
            gauge.boosters += 1u;
        }
    }
    sound_state = kart_sound_driver_update(&sound_driver, speed, drifting,
        kart.timed_boost.active || kart.instant_boost.active,
        kart.instant_boost.active, step.wall_impact_speed,
        step.ground_impact_speed, clock_ms);
    KartChaseCameraPose cam = kart_chase_camera_update(
        &chase, kart.position, kart.orientation, speed,
        kart.timed_boost.active || kart.instant_boost.active, elapsed_ms,
        KART_CHASE_FOLLOW_FRONT_MS);
    telemetry[0] = kart.position.x;
    telemetry[1] = kart.position.y;
    telemetry[2] = atan2f(fy, fx);
    telemetry[3] = kart.linear_velocity.x;
    telemetry[4] = kart.linear_velocity.y;
    telemetry[5] = kart.angular_velocity.z;
    telemetry[6] = speed;
    telemetry[7] = gauge.value / gauge_config.full_value * 100.0f;
    telemetry[8] = kart.timed_boost.remaining_ms * 0.001f;
    telemetry[9] = drifting ? 1.0f : 0.0f;
    telemetry[10] += dt;
    if (clock_ms - last_wall_hit_ms >= 500u &&
        ((track_enabled && step.wall_impact_speed <= 0.0f) ||
         (!track_enabled && fabsf(kart.position.x) < 76.5f &&
          fabsf(kart.position.y) < 76.5f)))
        wall_contact = false;
    if (step.wall_impact_speed > 1.0f && !wall_contact &&
        (last_wall_hit_ms == 0u || clock_ms - last_wall_hit_ms >= 2500u)) {
        wall_hits += 1.0f;
        wall_contact = true;
        last_wall_hit_ms = clock_ms;
    }
    telemetry[11] = wall_hits;
    telemetry[12] = kart.drift.linger_timer;
    telemetry[13] = kart.previous_steer_angle_rad;
    telemetry[14] = kart.position.z;
    telemetry[15] = atan2f(lateral, forward) * 57.295779513f;
    telemetry[16] = (float)step.substeps;
    telemetry[17] = kart.instant_boost.active_timer;
    telemetry[18] = course_enabled ? course_progress.best_lap_ms * 0.001f : 0.0f;
    telemetry[19] = race_phase;
    telemetry[20] = countdown;
    telemetry[21] = lap;
    telemetry[22] = next_gate;
    telemetry[23] = race_time;
    telemetry[24] = finish_time;
    telemetry[25] = cam.position.x;
    telemetry[26] = cam.position.y;
    telemetry[27] = cam.position.z;
    telemetry[28] = cam.forward.x;
    telemetry[29] = cam.forward.y;
    telemetry[30] = cam.forward.z;
    telemetry[31] = cam.field_of_view_degrees;
    telemetry[32] = (float)gauge.boosters;
    telemetry[33] = gauge.rate;
    telemetry[34] = gauge.contact_weight;
    telemetry[35] = (float)race_countdown.stage;
    telemetry[36] = sound_state.motor_pitch;
    telemetry[37] = sound_state.motor_volume;
    telemetry[38] = sound_state.start_crash ? sound_state.crash_volume : 0.0f;
    telemetry[39] = course_enabled ? (float)course_progress.node : -1.0f;
}

__attribute__((export_name("demo_new"))) float *demo_new(void) {
    reset_at(0, 0, 0);
    publish(0, (KartSimulationStepResult){0});
    return telemetry;
}

__attribute__((export_name("demo_reset"))) void demo_reset(void) {
    reset_at(track_enabled ? spawn_x : 0.0f,
             track_enabled ? spawn_y : 0.0f,
             track_enabled ? spawn_heading : 0.0f);
    publish(0, (KartSimulationStepResult){0});
}

__attribute__((export_name("demo_start_race"))) void demo_start_race(void) {
    reset_at(track_enabled ? spawn_x : 42.0f,
             track_enabled ? spawn_y : 0.0f,
             track_enabled ? spawn_heading : 1.5707963267948966f);
    race_phase = 1.0f;
    kart_countdown_start(&race_countdown, clock_ms);
    countdown = (float)KART_COUNTDOWN_TOTAL_MS * 0.001f;
    publish(0, (KartSimulationStepResult){0});
}

__attribute__((export_name("demo_set_steer_angle"))) void demo_set_steer_angle(float degrees) {
    if (isfinite(degrees) && degrees >= 1.0f && degrees <= 30.0f)
        kart.config.max_steer_angle_deg = degrees;
}

__attribute__((export_name("demo_set_preset"))) void demo_set_preset(unsigned int index) {
    if (kart_demo_kart_at(index) == NULL) return;
    preset_index = index;
    reset_at(track_enabled ? spawn_x : 0.0f,
             track_enabled ? spawn_y : 0.0f,
             track_enabled ? spawn_heading : 0.0f);
    publish(0, (KartSimulationStepResult){0});
}

__attribute__((export_name("demo_set_gauge_factor"))) void demo_set_gauge_factor(float factor) {
    if (isfinite(factor) && factor >= 0.0f && factor <= 100.0f)
        gauge_config.charge_factor = factor;
}

__attribute__((export_name("demo_configure_v1_charger"))) void demo_configure_v1_charger(
    unsigned int enabled, float threshold_mps, float gauge_per_second) {
    if (!isfinite(threshold_mps) || !isfinite(gauge_per_second) ||
        threshold_mps < 0.0f || threshold_mps > 200.0f ||
        gauge_per_second < 0.0f || gauge_per_second > 200.0f) return;
    v1_charger_enabled = enabled != 0u;
    v1_charger_threshold = threshold_mps;
    v1_charger_rate = gauge_per_second;
}

__attribute__((export_name("demo_set_course"))) unsigned int demo_set_course(unsigned int index) {
    const KartCourseAsset *asset = kart_course_asset_at(index);
    kart_course_free(&course);
    course_enabled = false;
    if (!asset || !kart_course_build(&course, asset)) return 0u;
    kart_course_set_lap_count(&course, 3u);
    course_enabled = true;
    kart_course_progress_init(&course, &course_progress, kart.position);
    return 1u;
}

__attribute__((export_name("demo_set_5136_course"))) unsigned int demo_set_5136_course(
    unsigned int index) {
    const KartCourseAsset *asset = kart_5136_course_asset_at(index);
    if (!track_enabled || !asset || index > 2u) return 0u;
    kart_course_free(&course);
    course_enabled = false;
    if (!kart_course_build(&course, asset)) return 0u;
    kart_course_set_lap_count(&course, index == 2u ? 2u : 3u);
    KartVec3 start;
    KartQuat orientation;
    kart_course_start_pose(&course, 0u, &start, &orientation);
    const float height = demo_track_ground_height(start.x, start.y, start.z + 10.0f);
    if (!isfinite(height)) {
        kart_course_free(&course);
        return 0u;
    }
    const float fx = 2.0f * (orientation.w*orientation.z -
                             orientation.x*orientation.y);
    const float fy = -(1.0f - 2.0f * (orientation.x*orientation.x +
                                      orientation.z*orientation.z));
    spawn_x = start.x;
    spawn_y = start.y;
    spawn_z = height;
    spawn_heading = atan2f(fy, fx);
    course_enabled = true;
    reset_at(spawn_x, spawn_y, spawn_heading);
    publish(0, (KartSimulationStepResult){0});
    return course.node_count;
}

__attribute__((export_name("demo_clear_course"))) void demo_clear_course(void) {
    kart_course_free(&course);
    course_enabled = false;
}

__attribute__((export_name("demo_request_reset"))) void demo_request_reset(void) {
    if (course_enabled || track_enabled) {
        if (respawn_arm_ms == 0) respawn_arm_ms = clock_ms ? clock_ms : 1u;
    } else {
        demo_reset();
    }
}

__attribute__((export_name("demo_steering_event"))) void demo_steering_event(
    int key, unsigned int pressed) {
    if (key != -1 && key != 1) return;
    kart_steering_key_event(&steering_keys, (KartSteeringKey)key, pressed != 0);
}

__attribute__((export_name("demo_steering_value"))) float demo_steering_value(void) {
    return steering_keys.value;
}

__attribute__((export_name("demo_steering_clear"))) void demo_steering_clear(void) {
    kart_steering_input_reset(&steering_keys);
}

__attribute__((export_name("demo_track_alloc"))) void *demo_track_alloc(unsigned int size) {
    if (size == 0 || size > 32u * 1024u * 1024u) return NULL;
    return malloc(size);
}

__attribute__((export_name("demo_track_free_buffer"))) void demo_track_free_buffer(void *buffer) {
    free(buffer);
}

__attribute__((export_name("demo_track_load"))) unsigned int demo_track_load(
    const void *data, unsigned int size) {
    track_enabled = false;
    kart_course_free(&course);
    course_enabled = false;
    kart_track_scene_free(&track_scene);
    return kart_track_scene_load_memory(&track_scene, data, size) ?
        track_scene.total_triangle_count : 0u;
}

__attribute__((export_name("demo_track_ground_height"))) float demo_track_ground_height(
    float x, float y, float top) {
    if (track_scene.mesh_count == 0) return NAN;
    KartGroundHit hit;
    const KartVec3 start = {x, y, top};
    const KartVec3 down = {0.0f, 0.0f, -100.0f};
    return kart_track_scene_query_ground(&track_scene, &track_spec, start, down, &hit)
        ? hit.point.z : NAN;
}

__attribute__((export_name("demo_track_ground_normal"))) float demo_track_ground_normal(
    float x, float y, float top, unsigned int axis) {
    if (track_scene.mesh_count == 0 || axis > 2u) return NAN;
    KartGroundHit hit;
    const KartVec3 start = {x, y, top};
    const KartVec3 down = {0.0f, 0.0f, -100.0f};
    if (!kart_track_scene_query_ground(&track_scene, &track_spec, start, down, &hit))
        return NAN;
    return axis == 0 ? hit.normal.x : axis == 1 ? hit.normal.y : hit.normal.z;
}

__attribute__((export_name("demo_track_enable"))) unsigned int demo_track_enable(
    float x, float y, float z, float heading) {
    if (track_scene.mesh_count == 0 || !isfinite(x) || !isfinite(y) ||
        !isfinite(z) || !isfinite(heading)) return 0u;
    spawn_x = x; spawn_y = y; spawn_z = z; spawn_heading = heading;
    track_enabled = true;
    reset_at(x, y, heading);
    publish(0, (KartSimulationStepResult){0});
    return 1u;
}

__attribute__((export_name("demo_track_disable"))) void demo_track_disable(void) {
    track_enabled = false;
    reset_at(0, 0, 0);
    publish(0, (KartSimulationStepResult){0});
}

__attribute__((export_name("demo_step"))) void demo_step(
    unsigned int elapsed_ms, unsigned int throttle, unsigned int brake,
    float steer, unsigned int drift, unsigned int boost) {
    if (elapsed_ms > 50) elapsed_ms = 50;
    clock_ms += elapsed_ms;
    const bool throttle_pressed = throttle != 0;
    const bool boost_pressed = boost != 0;
    if (race_phase == 1.0f || race_phase == 3.0f) {
        if (race_phase == 1.0f && throttle_pressed && !previous_throttle &&
            kart_countdown_start_boost_granted(&race_countdown, clock_ms))
            kart_timed_boost_start(&kart.timed_boost, 1.0f,
                                   KART_START_BOOST_DURATION_MS);
        previous_throttle = throttle_pressed;
        previous_boost = boost_pressed;
        update_race(elapsed_ms * 0.001f);
        publish(0, (KartSimulationStepResult){0});
        return;
    }
    KartSimulationControls controls = {0};
    controls.forward_input = throttle ? 1.0f : 0.0f;
    controls.reverse_input = brake ? 1.0f : 0.0f;
    controls.steering_input = fmaxf(-1.0f, fminf(1.0f, steer));
    controls.drift_input = drift != 0;
    controls.boost_active = boost_pressed && !previous_boost && throttle_pressed &&
        !kart.timed_boost.active && kart_gauge_take_booster(&gauge);
    previous_throttle = throttle_pressed;
    previous_boost = boost_pressed;
    const KartVec3 prior_position = kart.position;
    const bool prior_grounded = kart.grounded;
    const float prior_vertical_speed = kart.linear_velocity.z;
    KartSimulationStepResult step = kart_simulate_milliseconds(&kart, &controls, &world, elapsed_ms);
    if (track_enabled) {
        KartGroundHit ahead;
        const KartVec3 probe = {kart.position.x, kart.position.y, prior_position.z + 1.5f};
        const KartVec3 down = {0.0f, 0.0f, -4.0f};
        const bool center_supported = ground_query(NULL, probe, down, &ahead) &&
                                      ahead.normal.z > 0.65f;
        if (!center_supported && prior_grounded && prior_vertical_speed < 1.0f &&
            kart.position.z <= prior_position.z + 0.25f) {
            /* This provisional KTRK lacks some original fence collision.
               Rebound at a flat road's missing edge; rising jump trajectories
               remain governed by the upstream suspension and gravity. */
            const float impact = sqrtf(kart.linear_velocity.x * kart.linear_velocity.x +
                                       kart.linear_velocity.y * kart.linear_velocity.y);
            kart.position = stable_ground_position;
            kart.linear_velocity.x *= -0.32f;
            kart.linear_velocity.y *= -0.32f;
            kart.linear_velocity.z = 0.0f;
            kart.angular_velocity.z *= 0.4f;
            step.wall_impact_speed = fmaxf(step.wall_impact_speed, impact);
        } else if (center_supported && kart.grounded &&
                   kart.position.z < ahead.point.z + 0.45f) {
            /* Four wheel samples can straddle a mesh seam while the body
               slips below the road surface. Bound this proxy-import error. */
            kart.position.z = ahead.point.z + 0.45f;
            kart.linear_velocity.z = fmaxf(0.0f, kart.linear_velocity.z);
        }
        if (center_supported && kart.grounded &&
            kart.position.z >= ahead.point.z + 0.35f) {
            stable_ground_position = kart.position;
            const float dx = kart.position.x - fallback_respawn_position.x;
            const float dy = kart.position.y - fallback_respawn_position.y;
            if (race_phase == 2.0f && clock_ms - last_fallback_mark_ms >= 2000u &&
                dx*dx + dy*dy >= 100.0f) {
                fallback_respawn_position = kart.position;
                fallback_respawn_orientation = kart.orientation;
                last_fallback_mark_ms = clock_ms;
            }
        }
    }
    /* The imported P5136 collision proxy contains nearly-flat triangles
       with small normal errors. The demo has no static-friction branch, so an
       unattended kart slowly creeps for minutes. Keep this compatibility
       deadzone outside the unmodified demo source and only on proxy tracks. */
    if (track_enabled && kart.grounded && !throttle && !brake &&
        steer == 0.0f && !drift &&
        kart.linear_velocity.x * kart.linear_velocity.x +
        kart.linear_velocity.y * kart.linear_velocity.y < 0.15f * 0.15f) {
        kart.linear_velocity.x = 0.0f;
        kart.linear_velocity.y = 0.0f;
    }
    /* The demo collision callback resolves velocity, while this temporary
       square test world's positional boundary keeps the body inside it. */
    if (!track_enabled) {
        kart.position.x = fmaxf(-78.0f, fminf(78.0f, kart.position.x));
        kart.position.y = fmaxf(-78.0f, fminf(78.0f, kart.position.y));
    } else if (kart.position.z < spawn_z - 20.0f && respawn_arm_ms == 0) {
        respawn_arm_ms = clock_ms ? clock_ms : 1u;
    }
    update_race(elapsed_ms * 0.001f);
    if (respawn_arm_ms != 0 && clock_ms - respawn_arm_ms >= 500u) {
        KartVec3 position;
        KartQuat orientation;
        const bool have_course_pose = course_enabled &&
            kart_course_respawn_pose(&course, &course_progress, &position, &orientation);
        if (have_course_pose || track_enabled) {
            if (!have_course_pose) {
                position = fallback_respawn_position;
                orientation = fallback_respawn_orientation;
            }
            kart.position = position;
            kart.orientation = orientation;
            kart.linear_velocity = (KartVec3){0};
            kart.angular_velocity = (KartVec3){0};
            previous_x = position.x;
            previous_y = position.y;
            kart_chase_camera_follow_reset(&chase);
            stable_ground_position = position;
        }
        respawn_arm_ms = 0;
    }
    publish(elapsed_ms, step);
    previous_x = kart.position.x;
    previous_y = kart.position.y;
}
