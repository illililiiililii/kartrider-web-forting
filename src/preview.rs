//! Temporary 3D driving sandbox. This is NOT a P5136-equivalent force model.
//! The native substep schedule and recovered steering expressions are reused;
//! acceleration, yaw response, drift, boost, and rectangular walls below are
//! deliberately provisional until the original client is traced and compared.

use crate::{drift, gauge, scheduler::SubstepPlan, steering};

const GAUGE_CAPACITY: f32 = 3810.0; // Observed in the sampled original kart.
const CHARGE_BOOST_BY_SPEED: f32 = 350.0; // P5136 reference default, not measured for this preview kart.
const SPEED_CHARGE_CALIBRATION: f32 = 0.615; // Provisional fit to controlled run 04, not native.
const ARENA_HALF_EXTENT: f32 = 200.0;

/// Provisional test ramp and hill; real track mesh/ground probes are pending.
pub fn surface_height(x: f32, y: f32) -> f32 {
    if y.abs() > 6.0 {
        return 0.0;
    }
    if (-45.0..-25.0).contains(&x) {
        (x + 45.0) * 0.1
    } else if (-25.0..-5.0).contains(&x) {
        (-5.0 - x) * 0.1
    } else if (25.0..42.0).contains(&x) {
        (x - 25.0) * (2.5 / 17.0)
    } else {
        0.0
    }
}

#[repr(C)]
#[derive(Debug, Clone, Copy)]
pub struct PreviewState {
    pub x: f32,
    pub y: f32,
    pub heading: f32,
    pub velocity_x: f32,
    pub velocity_y: f32,
    pub yaw_rate: f32,
    pub speed: f32,
    pub drift_gauge: f32,
    pub boost_seconds: f32,
    pub drifting: f32,
    pub elapsed_seconds: f32,
    pub wall_hits: f32,
    pub drift_release_seconds: f32,
    pub drift_direction: f32,
    pub drift_pressed: f32,
    pub slip_degrees: f32,
    pub wall_contact_mask: f32,
    pub height: f32,
    pub vertical_velocity: f32,
    pub grounded: f32,
    pub exceed_seconds: f32,
    pub exceed_cooldown_seconds: f32,
    pub wall_hit_cooldown_seconds: f32,
}

impl Default for PreviewState {
    fn default() -> Self {
        Self {
            x: 0.0,
            y: 0.0,
            heading: 0.0,
            velocity_x: 0.0,
            velocity_y: 0.0,
            yaw_rate: 0.0,
            speed: 0.0,
            drift_gauge: 0.0,
            boost_seconds: 0.0,
            drifting: 0.0,
            elapsed_seconds: 0.0,
            wall_hits: 0.0,
            drift_release_seconds: 0.0,
            drift_direction: 0.0,
            drift_pressed: 0.0,
            slip_degrees: 0.0,
            wall_contact_mask: 0.0,
            height: 0.0,
            vertical_velocity: 0.0,
            grounded: 1.0,
            exceed_seconds: 0.0,
            exceed_cooldown_seconds: 0.0,
            wall_hit_cooldown_seconds: 0.0,
        }
    }
}

#[derive(Debug, Clone, Copy, Default)]
pub struct PreviewInput {
    pub throttle: bool,
    pub brake: bool,
    pub steer: f32,
    pub drift: bool,
    pub boost: bool,
    pub exceed: bool,
}

impl PreviewState {
    pub fn advance(&mut self, elapsed_ms: u32, input: PreviewInput) {
        if input.boost && self.boost_seconds <= 0.0 && self.drift_gauge >= GAUGE_CAPACITY {
            self.drift_gauge -= GAUGE_CAPACITY;
            self.boost_seconds = 2.0;
        }
        if input.exceed && self.exceed_cooldown_seconds <= 0.0 {
            self.exceed_seconds = 0.8;
            self.exceed_cooldown_seconds = 6.0;
        }
        for dt in SubstepPlan::new(elapsed_ms).seconds() {
            self.substep(dt, input);
        }
    }

    fn substep(&mut self, dt: f32, input: PreviewInput) {
        let steer = input.steer.clamp(-1.0, 1.0);
        let forward_x = self.heading.cos();
        let forward_y = self.heading.sin();
        let lateral_x = -forward_y;
        let lateral_y = forward_x;
        let forward_speed = self.velocity_x * forward_x + self.velocity_y * forward_y;
        let lateral_speed = self.velocity_x * lateral_x + self.velocity_y * lateral_y;

        // The exponential form is native; 18 degrees and B38=0.08 are
        // preview tuning. SteerConstraint=2.3 is in the supplied BodyParam.
        let base_angle = steering::base_steer_radians(steer, false, 18.0);
        let attenuated_angle =
            steering::speed_attenuated_steer_radians(base_angle, forward_speed.abs(), 2.3, 0.08);
        let drift_press_eligible = input.drift && forward_speed.abs() > 4.0 && steer.abs() > 0.05;
        let was_drifting_with_key = self.drift_pressed != 0.0;
        if drift_press_eligible && !was_drifting_with_key {
            self.drift_direction = steer.signum();
            self.drift_release_seconds = 0.0;
        }
        if !input.drift && was_drifting_with_key {
            // Native +0x640 release scalar is speed-squared. Applying it as
            // visible prototype drift persistence is provisional, not equivalent.
            self.drift_release_seconds =
                drift::scalar_after_release(1, true, self.drift_release_seconds, self.speed * 3.6);
        }
        self.drift_pressed =
            f32::from(input.drift && (was_drifting_with_key || drift_press_eligible));
        let countersteering = self.drift_direction != 0.0 && steer * self.drift_direction < -0.35;
        if countersteering {
            self.drift_release_seconds = (self.drift_release_seconds - dt * 8.0).max(0.0);
        } else {
            self.drift_release_seconds =
                drift::decay_release_scalar(self.drift_release_seconds, dt);
        }
        if forward_speed.abs() < 3.5 {
            self.drift_release_seconds = 0.0;
        }
        let drifting = forward_speed.abs() > 3.5
            && (self.drift_pressed != 0.0 || self.drift_release_seconds > 0.0);
        self.drifting = f32::from(drifting);
        let boost_active = self.boost_seconds > 0.0;
        let drift_yaw = if drifting && !countersteering {
            self.drift_direction
                * forward_speed.signum()
                * (forward_speed.abs() / 25.0).clamp(0.0, 1.0)
                * if forward_speed < 0.0 {
                    0.7
                } else if boost_active {
                    0.12
                } else {
                    0.28
                }
        } else {
            0.0
        };
        let turn_factor = if drifting && forward_speed < 0.0 {
            2.2
        } else if drifting && boost_active {
            0.65
        } else if drifting {
            1.1
        } else {
            1.0
        };
        let yaw_target = forward_speed * attenuated_angle.tan() / 7.5 * turn_factor + drift_yaw;
        let yaw_response = (dt * if drifting { 3.0 } else { 5.0 }).min(1.0);
        self.yaw_rate += (yaw_target - self.yaw_rate) * yaw_response;
        self.heading += self.yaw_rate * dt;

        let drive_accel = if input.throttle {
            if self.exceed_seconds > 0.0 {
                45.0
            } else if boost_active {
                37.0
            } else {
                29.0
            }
        } else if input.brake {
            if forward_speed > 0.5 {
                -27.0
            } else {
                -7.0
            }
        } else {
            0.0
        };
        let drag = forward_speed * (0.28 + forward_speed.abs() * 0.004)
            + if drifting { forward_speed * 0.12 } else { 0.0 };
        let forward_delta = (drive_accel - drag) * dt;
        let lateral_grip = if self.grounded == 0.0 {
            0.05
        } else if drifting {
            0.45
        } else {
            8.0
        };
        let lateral_delta = -lateral_speed * lateral_grip * dt;
        self.velocity_x += forward_x * forward_delta + lateral_x * lateral_delta;
        self.velocity_y += forward_y * forward_delta + lateral_y * lateral_delta;
        let old_x = self.x;
        let old_y = self.y;
        self.x += self.velocity_x * dt;
        self.y += self.velocity_y * dt;

        let mut contact_mask = self.wall_contact_mask as u32;
        for (axis, position, velocity) in [
            (1_u32, &mut self.x, &mut self.velocity_x),
            (2_u32, &mut self.y, &mut self.velocity_y),
        ] {
            if position.abs() < ARENA_HALF_EXTENT - 0.15 {
                contact_mask &= !axis;
            }
            if position.abs() > ARENA_HALF_EXTENT {
                let outward = velocity.signum() == position.signum();
                if outward {
                    if contact_mask & axis == 0 {
                        *velocity *= -0.68;
                        if self.wall_hit_cooldown_seconds <= 0.0 {
                            self.wall_hits += 1.0;
                            self.wall_hit_cooldown_seconds = 0.8;
                        }
                    } else {
                        *velocity = 0.0;
                    }
                }
                *position = (*position).clamp(-ARENA_HALF_EXTENT, ARENA_HALF_EXTENT);
                contact_mask |= axis;
            }
        }
        self.wall_contact_mask = contact_mask as f32;

        // Provisional ballistic vertical axis: an uphill surface imparts
        // take-off velocity; terrain does not pin the kart after a drop.
        if self.grounded != 0.0 && (25.0..42.0).contains(&old_x) && old_y.abs() <= 6.0 {
            self.vertical_velocity = self.velocity_x * (2.5 / 17.0);
        }
        self.vertical_velocity -= 9.81 * dt;
        self.height += self.vertical_velocity * dt;
        let ground_height = surface_height(self.x, self.y);
        if self.height <= ground_height {
            self.height = ground_height;
            self.vertical_velocity = 0.0;
            self.grounded = 1.0;
        } else {
            self.grounded = 0.0;
        }

        self.speed = self.velocity_x.hypot(self.velocity_y);
        let new_forward_x = self.heading.cos();
        let new_forward_y = self.heading.sin();
        self.slip_degrees = (new_forward_x * self.velocity_y - new_forward_y * self.velocity_x)
            .atan2(new_forward_x * self.velocity_x + new_forward_y * self.velocity_y)
            .to_degrees();
        if self.grounded != 0.0 && forward_speed.abs() > 10.0 {
            // The 350*dt arithmetic is native; this eligibility gate and
            // additional lateral contribution are preview hypotheses.
            let speed_charge =
                gauge::speed_charge_increment(CHARGE_BOOST_BY_SPEED, dt) * SPEED_CHARGE_CALIBRATION;
            let lateral_charge = if drifting {
                lateral_speed.abs() * 24.0 * dt
            } else {
                0.0
            };
            self.drift_gauge = gauge::capped_gauge_sum(
                self.drift_gauge,
                speed_charge + lateral_charge,
                GAUGE_CAPACITY,
            );
        }
        self.boost_seconds = (self.boost_seconds - dt).max(0.0);
        self.exceed_seconds = (self.exceed_seconds - dt).max(0.0);
        self.exceed_cooldown_seconds = (self.exceed_cooldown_seconds - dt).max(0.0);
        self.wall_hit_cooldown_seconds = (self.wall_hit_cooldown_seconds - dt).max(0.0);
        self.elapsed_seconds += dt;
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn preview_accelerates_and_stays_finite() {
        let mut state = PreviewState::default();
        for _ in 0..200 {
            state.advance(
                16,
                PreviewInput {
                    throttle: true,
                    ..PreviewInput::default()
                },
            );
        }
        assert!(state.speed > 0.0);
        assert!(state.x.is_finite() && state.y.is_finite());
    }

    #[test]
    fn preview_boost_consumes_full_gauge() {
        let mut state = PreviewState {
            drift_gauge: GAUGE_CAPACITY,
            ..PreviewState::default()
        };
        state.advance(
            2,
            PreviewInput {
                boost: true,
                ..PreviewInput::default()
            },
        );
        assert_eq!(state.drift_gauge, 0.0);
        assert!(state.boost_seconds > 1.9);
    }

    #[test]
    fn drift_lingers_after_release_until_countersteer_or_low_speed() {
        let mut state = PreviewState {
            velocity_x: 20.0,
            speed: 20.0,
            ..PreviewState::default()
        };
        state.advance(
            16,
            PreviewInput {
                throttle: true,
                steer: 1.0,
                drift: true,
                ..PreviewInput::default()
            },
        );
        state.advance(
            16,
            PreviewInput {
                throttle: true,
                ..PreviewInput::default()
            },
        );
        assert!(state.drifting > 0.0);
        assert!(state.drift_release_seconds > 0.0);
        let no_countersteer = state.drift_release_seconds;
        state.advance(
            16,
            PreviewInput {
                throttle: true,
                steer: -1.0,
                ..PreviewInput::default()
            },
        );
        assert!(state.drift_release_seconds < no_countersteer - 0.1);
    }

    #[test]
    fn drift_stays_active_when_steering_is_released_before_drift_key() {
        let mut state = PreviewState {
            velocity_x: 20.0,
            speed: 20.0,
            ..PreviewState::default()
        };
        state.advance(
            16,
            PreviewInput {
                steer: 1.0,
                drift: true,
                throttle: true,
                ..PreviewInput::default()
            },
        );
        state.advance(
            16,
            PreviewInput {
                drift: true,
                throttle: true,
                ..PreviewInput::default()
            },
        );
        assert!(state.drifting > 0.0);
        state.advance(
            16,
            PreviewInput {
                throttle: true,
                ..PreviewInput::default()
            },
        );
        assert!(state.drift_release_seconds > 0.0);
        assert!(state.drifting > 0.0);
    }

    #[test]
    fn reverse_drift_can_start_and_linger_after_release() {
        let mut state = PreviewState {
            velocity_x: -12.0,
            speed: 12.0,
            ..PreviewState::default()
        };
        state.advance(
            16,
            PreviewInput {
                brake: true,
                steer: 1.0,
                drift: true,
                ..PreviewInput::default()
            },
        );
        assert!(state.drifting > 0.0);
        assert!(state.yaw_rate < 0.0);
        state.advance(
            16,
            PreviewInput {
                brake: true,
                ..PreviewInput::default()
            },
        );
        assert!(state.drift_release_seconds > 0.0);
        assert!(state.drifting > 0.0);
    }

    #[test]
    fn reverse_drift_is_reachable_from_rest_with_brake_held() {
        let mut state = PreviewState::default();
        for _ in 0..100 {
            state.advance(
                16,
                PreviewInput {
                    brake: true,
                    ..PreviewInput::default()
                },
            );
        }
        assert!(state.velocity_x < -4.0);
        state.advance(
            16,
            PreviewInput {
                brake: true,
                steer: 1.0,
                drift: true,
                ..PreviewInput::default()
            },
        );
        assert_eq!(state.drifting, 1.0);
    }

    #[test]
    fn high_speed_steering_is_smaller_and_boost_drift_is_not_sharper() {
        let mut normal = PreviewState {
            velocity_x: 35.0,
            speed: 35.0,
            ..PreviewState::default()
        };
        let mut boosted = PreviewState {
            boost_seconds: 1.0,
            ..normal
        };
        normal.advance(
            16,
            PreviewInput {
                throttle: true,
                steer: 1.0,
                drift: true,
                ..PreviewInput::default()
            },
        );
        boosted.advance(
            16,
            PreviewInput {
                throttle: true,
                steer: 1.0,
                drift: true,
                ..PreviewInput::default()
            },
        );
        assert!(boosted.yaw_rate.abs() < normal.yaw_rate.abs());
        let slow = steering::speed_attenuated_steer_radians(1.0, 10.0, 2.3, 0.08);
        let fast = steering::speed_attenuated_steer_radians(1.0, 45.0, 2.3, 0.08);
        assert!(fast < slow);
    }

    #[test]
    fn pressing_against_wall_counts_one_contact_episode() {
        let mut state = PreviewState {
            x: 199.9,
            velocity_x: 20.0,
            speed: 20.0,
            ..PreviewState::default()
        };
        for _ in 0..200 {
            state.advance(
                16,
                PreviewInput {
                    throttle: true,
                    ..PreviewInput::default()
                },
            );
        }
        assert!(state.wall_hits < 5.0, "wall contacts: {}", state.wall_hits);
    }

    #[test]
    fn jump_lip_leaves_surface_and_lands() {
        let mut state = PreviewState {
            x: 24.0,
            velocity_x: 40.0,
            speed: 40.0,
            ..PreviewState::default()
        };
        let mut airborne = false;
        for _ in 0..200 {
            state.advance(
                16,
                PreviewInput {
                    throttle: true,
                    ..PreviewInput::default()
                },
            );
            airborne |= state.grounded == 0.0 && state.height > 0.1;
            assert!(state.height.is_finite() && state.vertical_velocity.is_finite());
        }
        assert!(airborne);
        assert_eq!(state.grounded, 1.0);
        assert!(state.height >= 0.0);
    }

    #[test]
    fn wall_contact_reverses_outward_velocity() {
        let mut state = PreviewState {
            x: 199.9,
            velocity_x: 20.0,
            speed: 20.0,
            ..PreviewState::default()
        };
        state.advance(16, PreviewInput::default());
        assert!(state.velocity_x < -10.0);
        assert!(state.wall_hits >= 1.0);
    }
}
