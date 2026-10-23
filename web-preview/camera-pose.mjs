// C world (X,Y,Z up) -> Three world (X,Z,-Y). C owns chase smoothing/FOV.
export function readChasePose(state) {
  return {
    position: [state[25], state[27], -state[26]],
    forward: [state[28], state[30], -state[29]],
    up: [state[40] ?? 0, state[42] ?? 1, -(state[41] ?? 0)],
    fov: state[31],
  };
}

// Presentation only: preserve the C view direction/up/FOV and move a quarter
// of the distance to the rider. No extra camera filter or physics adjustment.
export function pullCameraTowardRider(position,rider,amount=.25){
  return position.map((value,index)=>value+(rider[index]-value)*amount);
}
