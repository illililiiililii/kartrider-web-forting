/* Audit only: pinned C with caller-supplied stock dynamics on a shared flat mesh.
 * No web force overlay, fitted hitbox, camera or production course is involved. */
#include "kart_simulation.h"
#include "kart_demo_data.h"
#include "kart_track_scene.h"
#include "kart_track_collision.h"
#include <math.h>
#include <stdio.h>
#include <string.h>
#include <stdlib.h>
static KartTrackScene scene;
static KartDemoTrackSpec track={.asset_name="p5136-local-usd",.minimum={-10000,-10000,-1},.maximum={10000,10000,1},.has_scene=true,.start_kind=KART_TRACK_START_CONFIRMED};
static bool ground(void *unused,KartVec3 start,KartVec3 delta,KartGroundHit *hit){
    (void)unused;return kart_track_scene_query_ground(&scene,&track,start,delta,hit);
}
static unsigned int body(void *unused,const KartSimulationState *state,KartBodyContact *contacts,unsigned int capacity){
    (void)unused;return kart_track_scene_query_body_collisions(&scene,&track,state,contacts,capacity);
}
int main(int argc,char **argv){
    if(argc!=2)return 2;
    FILE *file=fopen(argv[1],"rb");if(!file)return 2;
    fseek(file,0,SEEK_END);long size=ftell(file);rewind(file);
    unsigned char *bytes=malloc(size);if(!bytes||fread(bytes,1,size,file)!=(size_t)size)return 2;fclose(file);
    if(!kart_track_scene_load_memory(&scene,bytes,size))return 2;free(bytes);
    float values[18];for(int i=0;i<18;i++)if(scanf("%f",&values[i])!=1)return 2;
    KartDynamicsConfig config;_Static_assert(sizeof config==sizeof values,"Dynamics ABI changed");memcpy(&config,values,sizeof config);
    const KartDemoKartSpec *spec=kart_demo_kart_at(10);
    KartSimulationState kart;kart_simulation_init(&kart,&config,&spec->geometry);
    kart.position=(KartVec3){0,0,.5f};
    const float angle=1.5707963267948966f;kart.orientation=(KartQuat){cosf(angle*.5f),0,0,sinf(angle*.5f)};
    KartSimulationWorld world={ground,body,NULL};
    unsigned int ms,throttle,brake,drift;float steer;
    while(scanf("%u %u %u %f %u",&ms,&throttle,&brake,&steer,&drift)==5){
        KartSimulationControls controls={.forward_input=throttle,.reverse_input=brake,.steering_input=steer,.drift_input=drift};
        const KartSimulationStepResult step=kart_simulate_milliseconds(&kart,&controls,&world,ms);
        const KartQuat q=kart.orientation;const float fx=2*(q.w*q.z-q.x*q.y),fy=-(1-2*(q.x*q.x+q.z*q.z));
        const bool sliding=kart.drift.input_active||kart.drift.slip_detected||kart.drift.trigger_active||kart.drift.linger_timer>0;
        printf("%.9g,%.9g,%.9g,%.9g,%.9g,%.9g,%.9g,%.9g,%d,%u,%u,%.9g\n",
          kart.position.x,kart.position.y,kart.position.z,kart.linear_velocity.x,kart.linear_velocity.y,kart.linear_velocity.z,
          atan2f(fy,fx),kart.angular_velocity.z,sliding,kart.timed_boost.remaining_ms,step.substeps,kart.previous_steer_angle_rad);
    }
    kart_track_scene_free(&scene);return ferror(stdin)?3:0;
}
