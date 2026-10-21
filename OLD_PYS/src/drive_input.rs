/// Native `GoPlayKart + 0xA00` driving-input object.
///
/// `0x0067ECA0` selects the forward channel and `0x00A41D80` selects the
/// complementary reverse/brake channel. The two float fields are decoded by
/// the original protected-float getter before this selection.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct DriveInputChannels {
    pub protected_a04: f32,
    pub protected_a10: f32,
    /// Native byte `GoPlayKart + 0xA1C`.
    pub channels_swapped: bool,
}

impl DriveInputChannels {
    #[must_use]
    pub fn forward(self) -> f32 {
        if self.channels_swapped {
            self.protected_a10
        } else {
            self.protected_a04
        }
    }

    #[must_use]
    pub fn reverse_or_brake(self) -> f32 {
        if self.channels_swapped {
            self.protected_a04
        } else {
            self.protected_a10
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn native_selector_always_uses_complementary_input_channels() {
        let normal = DriveInputChannels {
            protected_a04: 0.75,
            protected_a10: 0.25,
            channels_swapped: false,
        };
        assert_eq!((normal.forward(), normal.reverse_or_brake()), (0.75, 0.25));
        let swapped = DriveInputChannels {
            channels_swapped: true,
            ..normal
        };
        assert_eq!(
            (swapped.forward(), swapped.reverse_or_brake()),
            (0.25, 0.75)
        );
    }
}
