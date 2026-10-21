//! Temporary single-player test circuit. Gates and lap state live in Wasm.
//! This is not original P5136 track data.

pub const GATES: [(f32, f32); 4] = [(0.0, 42.0), (-42.0, 0.0), (0.0, -42.0), (42.0, 0.0)];
pub const LAPS: u32 = 3;

#[repr(C)]
#[derive(Debug, Clone, Copy, Default)]
pub struct RaceState {
    /// 0 free drive, 1 countdown, 2 racing, 3 finished.
    pub phase: f32,
    pub countdown: f32,
    pub lap: f32,
    pub next_gate: f32,
    pub time: f32,
    pub finish_time: f32,
}

impl RaceState {
    pub fn start(&mut self) {
        *self = Self { phase: 1.0, countdown: 3.0, lap: 1.0, ..Self::default() };
    }

    pub fn advance(&mut self, dt: f32, x: f32, y: f32) {
        if self.phase == 1.0 {
            self.countdown = (self.countdown - dt).max(0.0);
            if self.countdown == 0.0 { self.phase = 2.0; }
            return;
        }
        if self.phase != 2.0 { return; }
        self.time += dt;
        let gate = self.next_gate as usize;
        let (gx, gy) = GATES[gate];
        if (x - gx).hypot(y - gy) > 13.0 { return; }
        self.next_gate += 1.0;
        if self.next_gate as usize == GATES.len() {
            self.next_gate = 0.0;
            self.lap += 1.0;
            if self.lap > LAPS as f32 {
                self.phase = 3.0;
                self.finish_time = self.time;
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn countdown_requires_ordered_gates_and_finishes_three_laps() {
        let mut race = RaceState::default();
        race.start();
        race.advance(3.0, 0.0, 42.0);
        assert_eq!(race.phase, 2.0);
        race.advance(0.1, 42.0, 0.0);
        assert_eq!(race.next_gate, 0.0);
        for lap in 1..=3 {
            for (x, y) in GATES { race.advance(0.1, x, y); }
            assert_eq!(race.lap, (lap + 1) as f32);
        }
        assert_eq!(race.phase, 3.0);
        assert!(race.finish_time > 0.0);
    }
}
