#[derive(Debug, Clone, Copy, PartialEq)]
pub struct SuspensionParameters {
    pub spring: f32,
    /// Native `GoPlayKart + 0x798`; selected when compression delta is positive.
    pub positive_delta_damping: f32,
    /// Native `GoPlayKart + 0x79c`; selected when compression delta is non-positive.
    pub non_positive_delta_damping: f32,
}

impl SuspensionParameters {
    /// Scalar spring/damper term recovered from native function `0x00A36E30`.
    ///
    /// The native caller supplies a positive scheduler substep. Contact-normal
    /// projection and application at the wheel are downstream operations and
    /// intentionally remain outside this evidence-closed scalar function.
    #[must_use]
    pub fn scalar_force(
        self,
        contact: bool,
        compression: f32,
        compression_delta: f32,
        dt_seconds: f32,
    ) -> f32 {
        if !contact {
            return 0.0;
        }
        debug_assert!(dt_seconds > 0.0);
        let damping = if compression_delta > 0.0 {
            self.positive_delta_damping
        } else {
            self.non_positive_delta_damping
        };
        self.spring * compression + compression_delta / dt_seconds * damping
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const PARAMETERS: SuspensionParameters = SuspensionParameters {
        spring: 100.0,
        positive_delta_damping: 10.0,
        non_positive_delta_damping: 20.0,
    };

    #[test]
    fn absent_contact_produces_no_suspension_force() {
        assert_eq!(PARAMETERS.scalar_force(false, 2.0, 1.0, 0.002), 0.0);
    }

    #[test]
    fn chooses_damping_from_the_native_delta_branch() {
        assert_eq!(PARAMETERS.scalar_force(true, 2.0, 0.5, 0.1), 250.0);
        assert_eq!(PARAMETERS.scalar_force(true, 2.0, -0.5, 0.1), 100.0);
    }
}
