/// Evidence-closed subset of the drift input state updated by native
/// function `0x00A2D540`.
#[derive(Debug, Default, Clone, Copy, PartialEq, Eq)]
pub struct DriftInputState {
    /// Native byte `GoPlayKart + 0xA74`.
    pub pressed: bool,
    /// Native byte `GoPlayKart + 0xA88`; set when an accepted press begins.
    pub trigger_armed: bool,
    /// Native byte `GoPlayKart + 0xADC`.
    pub entered_while_moving_forward: bool,
    /// Native byte `GoPlayKart + 0xE7C`.
    pub entered_without_contact: bool,
}

impl DriftInputState {
    pub const PRESSED_BIT: u32 = 1 << 0;
    pub const TRIGGER_ARMED_BIT: u32 = 1 << 1;
    pub const ENTERED_FORWARD_BIT: u32 = 1 << 2;
    pub const ENTERED_WITHOUT_CONTACT_BIT: u32 = 1 << 3;

    #[must_use]
    pub const fn from_bits(bits: u32) -> Self {
        Self {
            pressed: bits & Self::PRESSED_BIT != 0,
            trigger_armed: bits & Self::TRIGGER_ARMED_BIT != 0,
            entered_while_moving_forward: bits & Self::ENTERED_FORWARD_BIT != 0,
            entered_without_contact: bits & Self::ENTERED_WITHOUT_CONTACT_BIT != 0,
        }
    }

    #[must_use]
    pub const fn to_bits(self) -> u32 {
        (if self.pressed { Self::PRESSED_BIT } else { 0 })
            | (if self.trigger_armed {
                Self::TRIGGER_ARMED_BIT
            } else {
                0
            })
            | (if self.entered_while_moving_forward {
                Self::ENTERED_FORWARD_BIT
            } else {
                0
            })
            | (if self.entered_without_contact {
                Self::ENTERED_WITHOUT_CONTACT_BIT
            } else {
                0
            })
    }

    /// Apply the transition whose predicates are proven in `0x00A2D540`.
    ///
    /// Gauge work performed on release is deliberately excluded until its
    /// speed divisor and destination field are identified.
    pub fn apply_input(
        &mut self,
        request_pressed: bool,
        input_allowed: bool,
        lockout_remaining: f32,
        forward_velocity: f32,
        any_wheel_contact: bool,
    ) {
        if !input_allowed {
            return;
        }
        if !request_pressed {
            self.pressed = false;
            self.entered_without_contact = false;
            return;
        }
        if lockout_remaining <= 0.0 {
            self.pressed = true;
            self.trigger_armed = true;
            self.entered_while_moving_forward = forward_velocity > 0.0;
            if !any_wheel_contact {
                self.entered_without_contact = true;
            }
        }
    }
}

/// Native `0x00A2D540` writes this scalar to `GoPlayKart + 0x640` on release
/// only when race mode `+0x1D0` is 1, drift was pressed, and the previous
/// scalar was non-positive. Its later consumer still needs identification.
#[must_use]
pub fn scalar_after_release(
    mode_at_1d0: i32,
    was_pressed: bool,
    current_scalar_at_640: f32,
    world_speed_at_a70: f32,
) -> f32 {
    if mode_at_1d0 == 1 && was_pressed && current_scalar_at_640 <= 0.0 {
        let speed_ratio = world_speed_at_a70 / 120.0_f32;
        10.0_f32 * speed_ratio * speed_ratio
    } else {
        current_scalar_at_640
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn accepted_press_arms_drift_and_records_entry_conditions() {
        let mut state = DriftInputState::default();
        state.apply_input(true, true, 0.0, 12.0, false);
        assert_eq!(
            state,
            DriftInputState {
                pressed: true,
                trigger_armed: true,
                entered_while_moving_forward: true,
                entered_without_contact: true,
            }
        );
    }

    #[test]
    fn positive_lockout_rejects_a_press() {
        let mut state = DriftInputState::default();
        state.apply_input(true, true, 0.001, 12.0, true);
        assert_eq!(state, DriftInputState::default());
    }

    #[test]
    fn release_clears_only_the_two_native_release_bytes() {
        let mut state = DriftInputState {
            pressed: true,
            trigger_armed: true,
            entered_while_moving_forward: true,
            entered_without_contact: true,
        };
        state.apply_input(false, true, 10.0, -1.0, false);
        assert!(!state.pressed);
        assert!(!state.entered_without_contact);
        assert!(state.trigger_armed);
        assert!(state.entered_while_moving_forward);
    }

    #[test]
    fn release_scalar_uses_native_speed_squared_only_for_eligible_state() {
        assert_eq!(scalar_after_release(1, true, 0.0, 60.0), 2.5);
        assert_eq!(scalar_after_release(2, true, 0.0, 60.0), 0.0);
        assert_eq!(scalar_after_release(1, false, 0.0, 60.0), 0.0);
        assert_eq!(scalar_after_release(1, true, 3.0, 60.0), 3.0);
    }
}
