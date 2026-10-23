// Rotate the complete C chassis pose into Three's X,Z,-Y world, then mount
// the existing model (+X forward) onto C's -Y forward. No guessed body lean.
export function applyKartOrientation(kart, state) {
  if (state.length < 47) { kart.rotation.y = state[2]; return; }
  const x=state[44], y=state[46], z=-state[45], w=state[43], s=Math.SQRT1_2;
  kart.quaternion.set(s*(x+z), s*(y-w), s*(z-x), s*(w+y)).normalize();
}
