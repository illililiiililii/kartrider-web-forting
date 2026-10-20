pub const MAX_ELAPSED_MS: u32 = 500;
pub const MAX_SUBSTEP_MS: u32 = 2;

/// Exact scheduler shape recovered from `KartRider.exe` VA `0x00A33420`.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct SubstepPlan {
    elapsed_ms: u32,
}

impl SubstepPlan {
    #[must_use]
    pub const fn new(elapsed_ms: u32) -> Self {
        Self {
            elapsed_ms: if elapsed_ms > MAX_ELAPSED_MS {
                MAX_ELAPSED_MS
            } else {
                elapsed_ms
            },
        }
    }

    #[must_use]
    pub const fn elapsed_ms(self) -> u32 {
        self.elapsed_ms
    }

    #[must_use]
    pub const fn len(self) -> usize {
        self.elapsed_ms.div_ceil(MAX_SUBSTEP_MS) as usize
    }

    #[must_use]
    pub const fn is_empty(self) -> bool {
        self.elapsed_ms == 0
    }

    pub fn milliseconds(self) -> impl ExactSizeIterator<Item = u32> {
        let full = self.elapsed_ms / MAX_SUBSTEP_MS;
        let tail = self.elapsed_ms % MAX_SUBSTEP_MS;
        (0..self.len()).map(move |index| {
            if index < full as usize {
                MAX_SUBSTEP_MS
            } else {
                tail
            }
        })
    }

    pub fn seconds(self) -> impl ExactSizeIterator<Item = f32> {
        self.milliseconds()
            .map(|milliseconds| milliseconds as f32 * 0.001)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn splits_elapsed_milliseconds_like_the_original_tick() {
        assert_eq!(
            SubstepPlan::new(0).milliseconds().collect::<Vec<_>>(),
            vec![]
        );
        assert_eq!(
            SubstepPlan::new(1).milliseconds().collect::<Vec<_>>(),
            vec![1]
        );
        assert_eq!(
            SubstepPlan::new(2).milliseconds().collect::<Vec<_>>(),
            vec![2]
        );
        assert_eq!(
            SubstepPlan::new(5).milliseconds().collect::<Vec<_>>(),
            vec![2, 2, 1]
        );
    }

    #[test]
    fn clamps_a_long_frame_to_five_hundred_milliseconds() {
        let plan = SubstepPlan::new(10_000);
        assert_eq!(plan.elapsed_ms(), 500);
        assert_eq!(plan.len(), 250);
        assert_eq!(plan.milliseconds().sum::<u32>(), 500);
    }
}
