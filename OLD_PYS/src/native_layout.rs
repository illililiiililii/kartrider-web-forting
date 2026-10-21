//! Version-pinned `GoPlayKart` offsets recovered from the supplied P5136 client.
//!
//! `0x00A3DCD0` serializes the object rooted at `GoPlayKart + 0x644` in
//! `KartSpec` field order. Constants below are included only where that order
//! establishes a direct field-to-offset correspondence.

pub const KART_SPEC_BASE: usize = 0x0644;

pub const MASS: usize = 0x0644;
pub const DRAFT_MUL_ACCEL_FACTOR: usize = 0x0658;
pub const DRAFT_TICK: usize = 0x0664;
pub const DRIFT_BOOST_MUL_ACCEL_FACTOR: usize = 0x0670;
pub const DRIFT_BOOST_TICK: usize = 0x067c;
pub const CHARGE_BOOST_BY_SPEED: usize = 0x0688;
pub const SPEED_SLOT_CAPACITY: usize = 0x0694;
pub const ITEM_SLOT_CAPACITY: usize = 0x06a0;
pub const SPECIAL_SLOT_CAPACITY: usize = 0x06ac;
pub const USE_TRANSFORM_BOOSTER: usize = 0x06b8;
pub const MOTORCYCLE_TYPE: usize = 0x06b9;
pub const BIKE_REAR_WHEEL: usize = 0x06ba;
pub const FORWARD_ACCEL_FORCE: usize = 0x06bc;
pub const BACKWARD_ACCEL_FORCE: usize = 0x06c8;
pub const AIR_FRICTION: usize = 0x06d4;
pub const DRAG_FACTOR: usize = 0x06e0;
pub const MAX_STEER_ANGLE: usize = 0x06ec;
pub const STEER_CONSTRAINT: usize = 0x06f0;
pub const GRIP_BRAKE_FORCE: usize = 0x06f4;
pub const SLIP_BRAKE_FORCE: usize = 0x06f8;
pub const DRIFT_TRIGGER_FACTOR: usize = 0x06fc;
pub const DRIFT_TRIGGER_TIME: usize = 0x0708;
pub const DRIFT_SLIP_FACTOR: usize = 0x0714;
pub const DRIFT_ESCAPE_FORCE: usize = 0x0720;
pub const DRIFT_LEAN_FACTOR: usize = 0x072c;
pub const STEER_LEAN_FACTOR: usize = 0x0730;
pub const DRIFT_MAX_GAUGE: usize = 0x0734;
pub const CORNER_DRAW_FACTOR: usize = 0x0740;
pub const FRONT_GRIP_FACTOR: usize = 0x074c;
pub const REAR_GRIP_FACTOR: usize = 0x0750;
pub const NORMAL_BOOSTER_TIME: usize = 0x07a0;
pub const ITEM_BOOSTER_TIME: usize = 0x07ac;
pub const TEAM_BOOSTER_TIME: usize = 0x07b8;
pub const ANIMAL_BOOSTER_TIME: usize = 0x07c4;
pub const SUPER_BOOSTER_TIME: usize = 0x07d0;
pub const TRANS_ACCEL_FACTOR: usize = 0x07dc;
pub const BOOST_ACCEL_FACTOR: usize = 0x07e8;
pub const START_BOOSTER_TIME_ITEM: usize = 0x07f4;
pub const START_BOOSTER_TIME_SPEED: usize = 0x0800;
pub const START_FORWARD_ACCEL_FORCE_ITEM: usize = 0x080c;
pub const START_FORWARD_ACCEL_FORCE_SPEED: usize = 0x0818;
pub const BOOST_ACCEL_FACTOR_ONLY_ITEM: usize = 0x0824;
pub const USE_EXTENDED_AFTER_BOOSTER: usize = 0x0830;
pub const ANTI_COLLIDE_BALANCE: usize = 0x0834;
pub const DRIFT_GAUGE_PRESERVE_PERCENT: usize = 0x084c;
pub const DUAL_BOOSTER_SET_AUTO: usize = 0x0864;
pub const DUAL_BOOSTER_TICK_MIN: usize = 0x0868;
pub const DUAL_BOOSTER_TICK_MAX: usize = 0x0874;
pub const DUAL_MUL_ACCEL_FACTOR: usize = 0x0880;
pub const DUAL_TRANS_LOW_SPEED: usize = 0x088c;

pub const WORLD_POSITION: usize = 0x0090;
pub const ORIENTATION_MATRIX: usize = 0x009c;
pub const WORLD_LINEAR_VELOCITY: usize = 0x00c0;
pub const ANGULAR_VELOCITY_CANDIDATE: usize = 0x00cc;
pub const WHEEL_CONTACT_FLAGS: usize = 0x09c4;
pub const BODY_LATERAL_AXIS: usize = 0x0a38;
pub const BODY_VERTICAL_AXIS: usize = 0x0a44;
pub const BODY_FORWARD_AXIS: usize = 0x0a50;
pub const LOCAL_FORWARD_VELOCITY: usize = 0x0a5c;
pub const LOCAL_LATERAL_VELOCITY_PROTECTED: usize = 0x0a60;
pub const LOCAL_VERTICAL_VELOCITY: usize = 0x0a6c;
pub const WORLD_SPEED_MAGNITUDE: usize = 0x0a70;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn serialized_offsets_are_relative_to_the_recovered_base() {
        assert_eq!(FORWARD_ACCEL_FORCE - KART_SPEC_BASE, 0x78);
        assert_eq!(STEER_CONSTRAINT - KART_SPEC_BASE, 0xac);
        assert_eq!(FRONT_GRIP_FACTOR - KART_SPEC_BASE, 0x108);
        assert_eq!(DRIFT_ESCAPE_FORCE - KART_SPEC_BASE, 0xdc);
        assert_eq!(DUAL_TRANS_LOW_SPEED - KART_SPEC_BASE, 0x248);
    }
}
