use crate::encoded;

pub const KART_SPEC_LENGTH: usize = 235;
pub const KART_SPEC_FIELD_COUNT: usize = 70;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum KartSpecDecodeError {
    WrongLength { actual: usize },
    NonFiniteFloat { field: &'static str },
}

macro_rules! define_kart_spec {
    ($( $field:ident : $type:ty => $reader:ident ),+ $(,)?) => {
        #[derive(Debug, Clone, Copy, PartialEq)]
        pub struct KartSpec {
            $(pub $field: $type,)+
        }

        impl KartSpec {
            pub fn decode(bytes: &[u8]) -> Result<Self, KartSpecDecodeError> {
                if bytes.len() != KART_SPEC_LENGTH {
                    return Err(KartSpecDecodeError::WrongLength { actual: bytes.len() });
                }
                let mut reader = Reader { bytes, offset: 0 };
                let decoded = Self {
                    $($field: reader.$reader(stringify!($field))?,)+
                };
                debug_assert_eq!(reader.offset, KART_SPEC_LENGTH);
                Ok(decoded)
            }
        }
    };
}

define_kart_spec! {
    draft_mul_accel_factor: f32 => f32,
    draft_tick: i32 => i32,
    drift_boost_mul_accel_factor: f32 => f32,
    drift_boost_tick: i32 => i32,
    charge_boost_by_speed: f32 => f32,
    speed_slot_capacity: u8 => u8,
    item_slot_capacity: u8 => u8,
    special_slot_capacity: u8 => u8,
    use_transform_booster: u8 => u8,
    motorcycle_type: u8 => u8,
    bike_rear_wheel: u8 => u8,
    mass: f32 => f32,
    air_friction: f32 => f32,
    drag_factor: f32 => f32,
    forward_accel_force: f32 => f32,
    backward_accel_force: f32 => f32,
    grip_brake_force: f32 => f32,
    slip_brake_force: f32 => f32,
    max_steer_angle: f32 => f32,
    steer_constraint: f32 => f32,
    front_grip_factor: f32 => f32,
    rear_grip_factor: f32 => f32,
    drift_trigger_factor: f32 => f32,
    drift_trigger_time: f32 => f32,
    drift_slip_factor: f32 => f32,
    drift_escape_force: f32 => f32,
    corner_draw_factor: f32 => f32,
    drift_lean_factor: f32 => f32,
    steer_lean_factor: f32 => f32,
    drift_max_gauge: f32 => f32,
    normal_booster_time: f32 => f32,
    item_booster_time: f32 => f32,
    team_booster_time: f32 => f32,
    animal_booster_time: f32 => f32,
    super_booster_time: f32 => f32,
    trans_accel_factor: f32 => f32,
    boost_accel_factor: f32 => f32,
    start_booster_time_item: f32 => f32,
    start_booster_time_speed: f32 => f32,
    start_forward_accel_force_item: f32 => f32,
    start_forward_accel_force_speed: f32 => f32,
    drift_gauge_preserve_percent: f32 => f32,
    use_extended_after_booster: u8 => u8,
    boost_accel_factor_only_item: f32 => f32,
    anti_collide_balance: f32 => f32,
    dual_booster_set_auto: u8 => u8,
    dual_booster_tick_min: i32 => i32,
    dual_booster_tick_max: i32 => i32,
    dual_mul_accel_factor: f32 => f32,
    dual_trans_low_speed: f32 => f32,
    parts_engine_lock: u8 => u8,
    parts_wheel_lock: u8 => u8,
    parts_steering_lock: u8 => u8,
    parts_booster_lock: u8 => u8,
    parts_coating_lock: u8 => u8,
    parts_tail_lamp_lock: u8 => u8,
    charge_inst_accel_gauge_by_boost: f32 => f32,
    charge_inst_accel_gauge_by_grip: f32 => f32,
    charge_inst_accel_gauge_by_wall: f32 => f32,
    inst_accel_factor: f32 => f32,
    inst_accel_gauge_cooldown_time: i32 => i32,
    inst_accel_gauge_length: f32 => f32,
    inst_accel_gauge_min_usable: f32 => f32,
    inst_accel_gauge_min_vel_bound: f32 => f32,
    inst_accel_gauge_min_vel_loss: f32 => f32,
    use_extended_after_booster_more: u8 => u8,
    wall_coll_gauge_cooldown_time: i32 => i32,
    wall_coll_gauge_max_vel_loss: f32 => f32,
    wall_coll_gauge_min_vel_bound: f32 => f32,
    wall_coll_gauge_min_vel_loss: f32 => f32,
}

struct Reader<'a> {
    bytes: &'a [u8],
    offset: usize,
}

impl Reader<'_> {
    fn take_four(&mut self) -> [u8; 4] {
        let value = self.bytes[self.offset..self.offset + 4]
            .try_into()
            .expect("length checked before decoding");
        self.offset += 4;
        value
    }

    fn f32(&mut self, field: &'static str) -> Result<f32, KartSpecDecodeError> {
        let value = encoded::decode_f32(self.take_four());
        if !value.is_finite() {
            return Err(KartSpecDecodeError::NonFiniteFloat { field });
        }
        Ok(value)
    }

    fn i32(&mut self, _field: &'static str) -> Result<i32, KartSpecDecodeError> {
        Ok(encoded::decode_i32(self.take_four()))
    }

    fn u8(&mut self, _field: &'static str) -> Result<u8, KartSpecDecodeError> {
        let value = encoded::decode_u8(self.bytes[self.offset]);
        self.offset += 1;
        Ok(value)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rejects_any_non_protocol_length() {
        assert_eq!(
            KartSpec::decode(&[0; KART_SPEC_LENGTH - 1]),
            Err(KartSpecDecodeError::WrongLength {
                actual: KART_SPEC_LENGTH - 1
            })
        );
    }

    #[test]
    fn schema_constants_match_the_recovered_wire_layout() {
        assert_eq!(KART_SPEC_LENGTH, 235);
        assert_eq!(KART_SPEC_FIELD_COUNT, 70);
    }
}
