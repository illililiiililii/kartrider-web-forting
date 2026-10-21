# 2004 demo physics integration audit

Source inspected: `https://github.com/overjoy1008/KartriderDemoPhysics`
(`src/kart_simulation.c`, `src/kart_dynamics.c`, `include/kart_simulation.h`,
`demo/kart_gauge.h`, `CMakeLists.txt`). This is a reference for the **2004 demo**,
not automatically identical to the later P5136 client.

The C simulator takes a control state plus ground/body-contact callbacks, then
per substep projects velocity into body axes, queries four wheel contacts,
applies suspension, longitudinal force, drift state and front/rear lateral
response, drag, linear/angular integration, pose integration, and body contact
response. `kart_simulate_milliseconds` divides elapsed milliseconds into at
most 5 ms pieces. P5136's recovered scheduler instead uses at most 2 ms
substeps plus a possible 1 ms tail; substituting the simulator wholesale
would change time ordering and requires differential tests.

`demo/kart_gauge.h` explicitly labels its rear-slip gauge charging models as
simulator hypotheses, **not recovered original code**. Keep these separate
from the narrow P5136 gauge arithmetic in `src/gauge.rs` and expose any future
coefficient as a configurable diagnostic value.

License boundary: the inspected repository snapshot contains no `LICENSE` or
`COPYING` file and no source-level grant was found. Public GitHub visibility
alone does not grant this project permission to copy or redistribute its C
source. No C source from that repository has been added here. Before source
reuse, obtain an explicit compatible license from its author or another valid
permission. Independently implementable *observed behavior* can still be
compared against P5136 evidence, but must not be described as copied source or
as a verified P5136 match.

Next technical proof: run the same kart configuration, flat track, initial
velocity and input timestamps through (1) the demo C simulator,
(2) a P5136 capture and (3) Wasm. Compare position, orientation, velocity,
angular velocity, drift state and contacts at timestamp boundaries before
deciding which demo dynamics are compatible with P5136.
