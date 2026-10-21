/* Local WebAssembly adapter. The driving and camera computations are linked
 * directly from the user's separate KartriderDemoPhysics checkout. No upstream
 * source or derived binary is distributed with this repository. */
#include "kart_simulation.h"
#include "kart_camera.h"
#include "kart_demo_data.h"
#include <math.h>
#include <string.h>

static KartSimulationState kart;
static KartChaseCameraFollow chase;
static KartSimulationWorld world;
static float telemetry[32];
static float gauge;
static float race_phase, countdown, lap, next_gate, race_time, finish_time;
static float wall_hits;
static bool wall_contact;
static float previous_x, previous_y;
static unsigned int preset_index = 10; /* cotten5, demo simulator default */

/* Zig's WASI libc expects a main symbol even for a no-entry library. */
int main(void) { return 0; }

static bool ground_query(void *unused, KartVec3 start, KartVec3 delta, KartGroundHit *hit) {
    (void)unused;
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
    kart_simulation_init(&kart, spec ? &spec->dynamics : NULL,
                         spec ? &spec->geometry : NULL);
    kart.position = (KartVec3){x, y, 0.5f};
    /* Identity faces world -Y; +pi/2 rotates the forward axis to +X. */
    const float angle = heading + 1.5707963267948966f;
    kart.orientation = (KartQuat){cosf(angle * 0.5f), 0.0f, 0.0f, sinf(angle * 0.5f)};
    kart_chase_camera_follow_reset(&chase);
    world = (KartSimulationWorld){ground_query, body_query, NULL};
    memset(telemetry, 0, sizeof telemetry);
    gauge = wall_hits = 0.0f;
    wall_contact = false;
    race_phase = countdown = next_gate = race_time = finish_time = 0.0f;
    lap = 1.0f;
    previous_x = x;
    previous_y = y;
}

static void update_race(float dt) {
    static const float gates[4][2] = {{0,42},{-42,0},{0,-42},{42,0}};
    if (race_phase == 1.0f) {
        countdown = fmaxf(0.0f, countdown - dt);
        if (countdown == 0.0f) race_phase = 2.0f;
        return;
    }
    if (race_phase != 2.0f) return;
    race_time += dt;
    unsigned int index = (unsigned int)next_gate;
    float dx = kart.position.x - gates[index][0];
    float dy = kart.position.y - gates[index][1];
    float old_dx = previous_x - gates[index][0];
    float old_dy = previous_y - gates[index][1];
    if (dx*dx + dy*dy <= 169.0f && old_dx*old_dx + old_dy*old_dy > 169.0f) {
        next_gate += 1.0f;
        if (next_gate == 4.0f) {
            next_gate = 0.0f;
            lap += 1.0f;
            if (lap > 3.0f) { race_phase = 3.0f; finish_time = race_time; }
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
    if (drifting && kart.grounded && speed > 5.0f) {
        const float slip = (-lateral + 0.5f*kart.angular_velocity.z)/fmaxf(speed,5.0f);
        gauge = fminf(100.0f, gauge + 4.0f * speed * fabsf(slip) * dt);
    }
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
    telemetry[7] = gauge;
    telemetry[8] = kart.timed_boost.remaining_ms * 0.001f;
    telemetry[9] = drifting ? 1.0f : 0.0f;
    telemetry[10] += dt;
    if (fabsf(kart.position.x) < 77.5f && fabsf(kart.position.y) < 77.5f)
        wall_contact = false;
    if (step.wall_impact_speed > 0.0f && !wall_contact) {
        wall_hits += 1.0f;
        wall_contact = true;
    }
    telemetry[11] = wall_hits;
    telemetry[12] = kart.drift.linger_timer;
    telemetry[13] = kart.previous_steer_angle_rad;
    telemetry[14] = kart.position.z;
    telemetry[15] = atan2f(lateral, forward) * 57.295779513f;
    telemetry[16] = (float)step.substeps;
    telemetry[17] = kart.instant_boost.active_timer;
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
}

__attribute__((export_name("demo_new"))) float *demo_new(void) {
    reset_at(0, 0, 0);
    publish(0, (KartSimulationStepResult){0});
    return telemetry;
}

__attribute__((export_name("demo_reset"))) void demo_reset(void) {
    reset_at(0, 0, 0);
    publish(0, (KartSimulationStepResult){0});
}

__attribute__((export_name("demo_start_race"))) void demo_start_race(void) {
    reset_at(42, 0, 1.5707963267948966f);
    race_phase = 1.0f;
    countdown = 3.0f;
    publish(0, (KartSimulationStepResult){0});
}

__attribute__((export_name("demo_set_steer_angle"))) void demo_set_steer_angle(float degrees) {
    if (isfinite(degrees) && degrees >= 1.0f && degrees <= 30.0f)
        kart.config.max_steer_angle_deg = degrees;
}

__attribute__((export_name("demo_set_preset"))) void demo_set_preset(unsigned int index) {
    if (kart_demo_kart_at(index) == NULL) return;
    preset_index = index;
    reset_at(0, 0, 0);
    publish(0, (KartSimulationStepResult){0});
}

__attribute__((export_name("demo_step"))) void demo_step(
    unsigned int elapsed_ms, unsigned int throttle, unsigned int brake,
    float steer, unsigned int drift, unsigned int boost) {
    if (elapsed_ms > 100) elapsed_ms = 100;
    if (race_phase == 1.0f || race_phase == 3.0f) {
        update_race(elapsed_ms * 0.001f);
        publish(0, (KartSimulationStepResult){0});
        return;
    }
    KartSimulationControls controls = {0};
    controls.forward_input = throttle ? 1.0f : 0.0f;
    controls.reverse_input = brake ? 1.0f : 0.0f;
    controls.steering_input = fmaxf(-1.0f, fminf(1.0f, steer));
    controls.drift_input = drift != 0;
    controls.boost_active = boost != 0 && gauge >= 100.0f;
    if (controls.boost_active && !kart.timed_boost.active) gauge = 0.0f;
    KartSimulationStepResult step = kart_simulate_milliseconds(&kart, &controls, &world, elapsed_ms);
    /* The demo collision callback resolves velocity, while this temporary
       square test world's positional boundary keeps the body inside it. */
    kart.position.x = fmaxf(-78.0f, fminf(78.0f, kart.position.x));
    kart.position.y = fmaxf(-78.0f, fminf(78.0f, kart.position.y));
    update_race(elapsed_ms * 0.001f);
    publish(elapsed_ms, step);
    previous_x = kart.position.x;
    previous_y = kart.position.y;
}
