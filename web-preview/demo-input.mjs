// The C camera's screen-right is +body-right. Three.lookAt derives the
// opposite right from C forward/up. Convert steering once at this boundary;
// never change the C force law or mirror the existing 5136 track assets.
export function createDemoInput(getApi, controls) {
  const held = new Map();
  return {
    set(control, pressed, source = control) {
      if (!held.has(control)) held.set(control, new Set());
      const sources = held.get(control);
      if (pressed) sources.add(source); else sources.delete(source);
      controls[control] = sources.size > 0;
      if (control === 'left' || control === 'right')
        getApi()?.demo_steering_event(control === 'left' ? -1 : 1, +controls[control]);
    },
    steering() { return -(getApi()?.demo_steering_value() ?? 0); },
    clear() {
      held.clear();
      for (const key of Object.keys(controls)) controls[key] = false;
      getApi()?.demo_steering_clear();
    },
  };
}

// Win32 uses integer elapsed milliseconds capped at 50, then C subdivides
// into <=5ms steps. Preserve fractional frame timestamps until subtraction.
export function demoElapsedMilliseconds(previous, current) {
  return Math.min(50, Math.max(0, Math.trunc(current) - Math.trunc(previous)));
}
