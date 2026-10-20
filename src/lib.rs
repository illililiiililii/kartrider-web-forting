#![forbid(unsafe_op_in_unsafe_fn)]

pub mod encoded;
pub mod kart_spec;
pub mod scheduler;

pub use kart_spec::{KartSpec, KartSpecDecodeError, KART_SPEC_LENGTH};
pub use scheduler::{SubstepPlan, MAX_ELAPSED_MS, MAX_SUBSTEP_MS};

/// Version of the raw WebAssembly ABI exposed by this crate.
#[no_mangle]
pub extern "C" fn p5136_abi_version() -> u32 {
    1
}

/// Return the number of 1-2 ms P5136 physics substeps for an elapsed frame.
#[no_mangle]
pub extern "C" fn p5136_substep_count(elapsed_ms: u32) -> u32 {
    SubstepPlan::new(elapsed_ms).len() as u32
}

/// Fill `output` with substep lengths in seconds and return the required count.
///
/// If `capacity` is smaller than the required count, only that prefix is
/// written. Passing a null pointer is allowed only when `capacity == 0`.
#[no_mangle]
pub unsafe extern "C" fn p5136_plan_substeps(
    elapsed_ms: u32,
    output: *mut f32,
    capacity: usize,
) -> usize {
    let plan = SubstepPlan::new(elapsed_ms);
    let write_count = plan.len().min(capacity);
    if write_count != 0 {
        assert!(!output.is_null());
        for (index, seconds) in plan.seconds().take(write_count).enumerate() {
            unsafe { output.add(index).write(seconds) };
        }
    }
    plan.len()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn raw_abi_reports_the_expected_substeps() {
        let mut output = [0.0_f32; 4];
        let required = unsafe { p5136_plan_substeps(5, output.as_mut_ptr(), output.len()) };
        assert_eq!(required, 3);
        assert_eq!(&output[..3], &[0.002, 0.002, 0.001]);
    }
}
