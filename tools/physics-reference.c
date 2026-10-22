/* Standalone native fixture against the unchanged pinned demo C modules.
   The flat world and initial pose match demo_new; no web track adapters run. */
#include "kart_simulation.h"
#include "kart_demo_data.h"
#include "kart_gauge.h"
#include "kart_track_scene.h"
#include "kart_track_collision.h"
#include <math.h>
#include <stdio.h>
#include <stdlib.h>

static bool ground(void *user,KartVec3 start,KartVec3 delta,KartGroundHit *hit) {
    (void)user;
    if(delta.z>=0 || start.z<0 || start.z+delta.z>0) return false;
    float t=-start.z/delta.z;
    *hit=(KartGroundHit){.point={start.x+delta.x*t,start.y+delta.y*t,0},.normal={0,0,1}};
    return true;
}
static KartTrackScene scene;
static KartDemoTrackSpec track={.asset_name="p5136-local-usd",.minimum={-10000,-10000,-10000},.maximum={10000,10000,10000},.has_scene=true,.start_kind=KART_TRACK_START_CONFIRMED};
static bool road(void *user,KartVec3 start,KartVec3 delta,KartGroundHit *hit) {
    return kart_track_scene_query_ground(&scene,&track,start,delta,hit);
}
static unsigned int body(void *user,const KartSimulationState *state,KartBodyContact *contacts,unsigned int capacity) {
    return kart_track_scene_query_body_collisions(&scene,&track,state,contacts,capacity);
}
int main(int argc,char **argv) {
    if(argc>1) {
        FILE *f=fopen(argv[1],"rb"); if(!f)return 2;
        fseek(f,0,SEEK_END);long size=ftell(f);rewind(f);
        unsigned char *bytes=malloc(size);if(!bytes)return 3;
        if(fread(bytes,1,size,f)!=(size_t)size)return 4;fclose(f);
        if(!kart_track_scene_load_memory(&scene,bytes,size))return 5;free(bytes);
    }
    const KartDemoKartSpec *spec=kart_demo_kart_at(10);
    printf("geometry,%.9g,%.9g\n",spec->geometry.half_width,spec->geometry.half_length);
    for(int scenario=0;scenario<(scene.mesh_count?4:3);scenario++) {
        KartSimulationState kart; kart_simulation_init(&kart,&spec->dynamics,&spec->geometry);
        kart.position=(KartVec3){0,0,.5f};
        kart.orientation=(KartQuat){cosf(1.5707963267948966f*.5f),0,0,sinf(1.5707963267948966f*.5f)};
        KartSimulationWorld world={ground,NULL,NULL};
        KartGaugeState gauge={.model=KART_GAUGE_SLIP}; KartGaugeConfig config=kart_gauge_default_config();
        if(scenario==2) {
            kart.position.x=42;
            kart.orientation=(KartQuat){cosf(3.1415926535897932f*.5f),0,0,sinf(3.1415926535897932f*.5f)};
            kart_timed_boost_start(&kart.timed_boost,1,1000);
        }
        if(scenario==3) {
            KartGroundHit hit;road(NULL,(KartVec3){1200,980,400},(KartVec3){0,0,-1000},&hit);
            kart.geometry.half_width=1.04f;kart.geometry.half_length=1.52f;
            kart.position=(KartVec3){1200,980,hit.point.z+.5f};
            kart.orientation=(KartQuat){cosf(4.71238898038469f*.5f),0,0,sinf(4.71238898038469f*.5f)};
            world=(KartSimulationWorld){road,body,NULL};
        }
        for(int i=0;i<(scenario==3?690:160);i++) {
            KartSimulationControls controls={0};
            controls.forward_input=i<130;
            controls.reverse_input=i>=130;
            controls.steering_input=(i>=70 && i<130)?0.7f:0;
            controls.drift_input=scenario==1 && i>=70 && i<125;
            unsigned int dt=scenario==3?16:5;
            if(scenario==3) {controls.forward_input=1;controls.reverse_input=0;controls.steering_input=.5f;}
            KartSimulationStepResult step=kart_simulate_milliseconds(&kart,&controls,&world,dt);
            const KartQuat q=kart.orientation;
            float fx=2*(q.w*q.z-q.x*q.y),fy=-(1-2*(q.x*q.x+q.z*q.z));
            int drifting=kart.drift.input_active || kart.drift.slip_detected || kart.drift.trigger_active || kart.drift.linger_timer>0;
            kart_gauge_update(&gauge,&config,&kart,kart.linear_velocity.x*fx+kart.linear_velocity.y*fy,0,drifting,dt*.001f);
            printf("%d,%d,%.9g,%.9g,%.9g,%.9g,%.9g,%.9g,%.9g,%.9g,%d,%.9g,%.9g,%u\n",
                scenario,i,kart.position.x,kart.position.y,kart.position.z,kart.linear_velocity.x,kart.linear_velocity.y,
                sqrtf(kart.linear_velocity.x*kart.linear_velocity.x+kart.linear_velocity.y*kart.linear_velocity.y+kart.linear_velocity.z*kart.linear_velocity.z),
                atan2f(fy,fx),kart.angular_velocity.z,drifting,kart.timed_boost.remaining_ms*.001f,kart.instant_boost.active_timer,step.substeps);
        }
    }
    return 0;
}
