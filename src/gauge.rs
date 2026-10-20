//! Narrow gauge arithmetic recovered from P5136 `0x00A348E0`.
//! Eligibility gates and other charging paths are not reconstructed here.

/// At `0x00A349B0..0x00A34A03`, the protected `ChargeBoostBySpeed`
/// field at `GoPlayKart+0x688` is multiplied by the physics substep seconds.
/// A separate mode-dependent multiplier is omitted from this base branch.
#[must_use]
pub fn speed_charge_increment(charge_boost_by_speed: f32, dt_seconds: f32) -> f32 {
    charge_boost_by_speed * dt_seconds
}

/// `0x00A38E46..0x00A38ED2` caps the sum of the ordinary gauge and
/// pending addition at the protected `DriftMaxGauge` field.
#[must_use]
pub fn capped_gauge_sum(ordinary: f32, addition: f32, capacity: f32) -> f32 {
    (ordinary + addition).min(capacity)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn native_speed_charge_multiplies_param_by_substep() {
        assert!((speed_charge_increment(350.0, 0.002) - 0.7).abs() < 1e-6);
    }

    #[test]
    fn native_gauge_sum_respects_capacity() {
        assert_eq!(capped_gauge_sum(3800.0, 20.0, 3810.0), 3810.0);
    }
}
