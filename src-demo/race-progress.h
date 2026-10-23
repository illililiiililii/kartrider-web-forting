/* Upstream lap is the one-based CURRENT lap, initially zero before start. */
static unsigned int race_completed_laps(unsigned int current_lap) {
    return current_lap ? current_lap - 1u : 0u;
}
static int race_finished(unsigned int current_lap, unsigned int required) {
    return required > 0u && race_completed_laps(current_lap) >= required;
}
