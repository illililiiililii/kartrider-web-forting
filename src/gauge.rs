//! Narrow original P5136 gauge arithmetic, independent of the provisional preview.
//! The full gating, kart multiplier and other charging paths remain unresolved.

/// Native `0x00A349B0..0x00A34A03`: `ChargeBoostBySpeed * dt` before
/// mode-dependent processing. The caller must supply the actual kart field.
#[must_use]
pub fn speed_charge_increment(charge_boost_by_speed: f32, dt_seconds: f32) -> f32 {
    charge_boost_by_speed * dt_seconds
}

/// Native `0x00A38E46..0x00A38ED2`: ordinary plus pending addition,
/// capped at the kart's protected `DriftMaxGauge` value.
#[must_use]
pub fn capped_gauge_sum(ordinary: f32, addition: f32, capacity: f32) -> f32 {
    (ordinary + addition).min(capacity)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn original_speed_term_uses_substep_seconds() {
        assert!((speed_charge_increment(350.0, 0.002) - 0.7).abs() < 1e-6);
    }

    #[test]
    fn original_cap_branch_limits_pending_addition() {
        assert_eq!(capped_gauge_sum(3800.0, 20.0, 3810.0), 3810.0);
    }
}
