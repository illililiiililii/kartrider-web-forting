/* Geometry-only course test: traverse actual extracted 5136 gate quads in the
   recovered demo graph. This does not claim a human-driven lap was completed. */
#include "kart_course.h"
#include "../src-demo/race-progress.h"
#include <stdio.h>

extern const KartCourseAsset *kart_5136_course_asset_at(unsigned int index);

static KartVec3 midpoint(const KartCourseGate *gate) {
    KartVec3 p = {0};
    for (unsigned int i = 0; i < 3; ++i) {
        p.x += gate->face[0][i].x / 3.0f;
        p.y += gate->face[0][i].y / 3.0f;
        p.z += gate->face[0][i].z / 3.0f;
    }
    return p;
}

int main(void) {
    for (unsigned int index = 0; index < 3; ++index) {
        const KartCourseAsset *asset = kart_5136_course_asset_at(index);
        KartCourse course = {0};
        KartCourseProgress progress;
        if (!asset || !kart_course_build(&course, asset)) return 1;
        const unsigned int laps = index == 2 ? 2u : 3u;
        kart_course_set_lap_count(&course, laps);
        kart_course_progress_init(&course, &progress, course.start_position);
        unsigned int steps = 0, completed = 0;
        while (!race_finished(progress.lap, laps) && steps < course.node_count * (laps + 1u)) {
            const KartCourseNode *node = &course.nodes[progress.node];
            const unsigned int link = node->backward;
            if (link == KART_COURSE_NO_INDEX) return 2;
            const KartCourseGate *gate = &course.gates[course.links[link].gate];
            const KartVec3 p = midpoint(gate);
            const KartVec3 a = {p.x - gate->normal.x * 0.1f,
                                p.y - gate->normal.y * 0.1f,
                                p.z - gate->normal.z * 0.1f};
            const KartVec3 b = {p.x + gate->normal.x * 0.1f,
                                p.y + gate->normal.y * 0.1f,
                                p.z + gate->normal.z * 0.1f};
            const unsigned int before = progress.node;
            kart_course_progress_step(&course, &progress, a, b,
                (KartQuat){1, 0, 0, 0}, gate->normal, ++steps * 100u);
            if (progress.lap_completed) ++completed;
            if (completed < laps && race_finished(progress.lap, laps)) return 5;
            if (before == progress.node) {
                fprintf(stderr, "%s: gate traversal stuck at node %u\n",
                        asset->track, before);
                return 3;
            }
        }
        printf("%s: %u graph nodes, %u/%u laps after %u gate crossings\n",
               asset->track, course.node_count, completed, laps, steps);
        if (completed != laps || progress.lap != laps + 1u) return 4;
        kart_course_free(&course);
    }
    return 0;
}
