#[derive(Debug, Clone, Copy, PartialEq)]
pub struct Vec3 {
    pub x: f32,
    pub y: f32,
    pub z: f32,
}

impl Vec3 {
    #[must_use]
    pub const fn new(x: f32, y: f32, z: f32) -> Self {
        Self { x, y, z }
    }

    #[must_use]
    pub fn dot(self, other: Self) -> f32 {
        self.x * other.x + self.y * other.y + self.z * other.z
    }
}

/// Three body axes used by P5136 to project world velocity before force work.
///
/// The supplied build stores these axes at `GoPlayKart + 0xA50` (forward),
/// `+0xA44` (vertical), and `+0xA38` (lateral).
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct BodyAxes {
    pub forward: Vec3,
    pub vertical: Vec3,
    pub lateral: Vec3,
}

impl BodyAxes {
    /// Mirrors the three dot products in native function `0x00A35B20`.
    /// The returned components are forward, vertical, and lateral.
    #[must_use]
    pub fn project_world_velocity(self, world_velocity: Vec3) -> Vec3 {
        Vec3::new(
            world_velocity.dot(self.forward),
            world_velocity.dot(self.vertical),
            world_velocity.dot(self.lateral),
        )
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn projects_world_velocity_onto_body_axes() {
        let axes = BodyAxes {
            forward: Vec3::new(0.0, 1.0, 0.0),
            vertical: Vec3::new(0.0, 0.0, 1.0),
            lateral: Vec3::new(1.0, 0.0, 0.0),
        };
        assert_eq!(
            axes.project_world_velocity(Vec3::new(3.0, 4.0, 5.0)),
            Vec3::new(4.0, 5.0, 3.0)
        );
    }
}
