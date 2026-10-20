//! Temporary 2D driving sandbox. This is NOT a P5136-equivalent force model.
//! The native substep schedule and recovered steering expressions are reused;
//! acceleration, yaw response, drift, boost, and rectangular walls below are
//! deliberately provisional until the original client is traced and compared.

use crate::{scheduler::SubstepPlan, steering};

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
}

impl PreviewState {
    pub fn advance(&mut self, elapsed_ms: u32, input: PreviewInput) {
        if input.boost && self.boost_seconds <= 0.0 && self.drift_gauge >= 100.0 {
            self.drift_gauge -= 100.0;
            self.boost_seconds = 2.0;
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

        let base_angle = steering::base_steer_radians(steer, false, 28.0);
        let attenuated_angle =
            steering::speed_attenuated_steer_radians(base_angle, forward_speed, 70.0, 0.25);
        let drifting = input.drift && forward_speed > 4.0 && steer.abs() > 0.05;
        self.drifting = f32::from(drifting);
        let yaw_target =
            forward_speed * attenuated_angle.tan() / 3.2 * if drifting { 1.45 } else { 1.0 };
        let yaw_response = (dt * if drifting { 5.0 } else { 8.0 }).min(1.0);
        self.yaw_rate += (yaw_target - self.yaw_rate) * yaw_response;
        self.heading += self.yaw_rate * dt;

        let boost_active = self.boost_seconds > 0.0;
        let drive_accel = if input.throttle {
            if boost_active {
                24.0
            } else {
                15.0
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
        let drag = forward_speed * (0.4 + forward_speed.abs() * 0.012);
        let forward_delta = (drive_accel - drag) * dt;
        let lateral_delta = -lateral_speed * if drifting { 1.3 } else { 8.0 } * dt;
        self.velocity_x += forward_x * forward_delta + lateral_x * lateral_delta;
        self.velocity_y += forward_y * forward_delta + lateral_y * lateral_delta;
        self.x += self.velocity_x * dt;
        self.y += self.velocity_y * dt;

        for (position, velocity) in [
            (&mut self.x, &mut self.velocity_x),
            (&mut self.y, &mut self.velocity_y),
        ] {
            if *position < -80.0 {
                *position = -80.0;
                *velocity *= -0.22;
                self.wall_hits += 1.0;
            } else if *position > 80.0 {
                *position = 80.0;
                *velocity *= -0.22;
                self.wall_hits += 1.0;
            }
        }

        self.speed = self.velocity_x.hypot(self.velocity_y);
        if drifting {
            self.drift_gauge = (self.drift_gauge + steer.abs() * self.speed * 0.7 * dt).min(100.0);
        }
        self.boost_seconds = (self.boost_seconds - dt).max(0.0);
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
            drift_gauge: 100.0,
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
}
