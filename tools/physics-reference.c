/* Independent native runner: unchanged pinned engine, gauge and camera.
   Inputs follow demo/kart_win32.c; web-only force/geometry overrides are absent. */
#include "kart_simulation.h"
#include "kart_demo_data.h"
#include "kart_gauge.h"
#include "kart_track_scene.h"
#include "kart_track_collision.h"
#include "kart_camera.h"
#include "kart_countdown.h"
#include <math.h>
#include <stdio.h>
#include <stdlib.h>
static bool ground(void *user,KartVec3 start,KartVec3 delta,KartGroundHit *hit) {
    if(delta.z>=0 || start.z<0 || start.z+delta.z>0)return false;
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
        FILE *f=fopen(argv[1],"rb");if(!f)return 2;
        fseek(f,0,SEEK_END);long size=ftell(f);rewind(f);
        unsigned char *bytes=malloc(size);if(!bytes)return 3;
        if(fread(bytes,1,size,f)!=(size_t)size)return 4;fclose(f);
        if(!kart_track_scene_load_memory(&scene,bytes,size))return 5;free(bytes);
    }
    const KartDemoKartSpec *spec=kart_demo_kart_at(10);
    printf("geometry,%.9g,%.9g\n",spec->geometry.half_width,spec->geometry.half_length);
    for(int scenario=0;scenario<6;scenario++) {
        if(scenario==3&&!scene.mesh_count)continue;
        KartSimulationState kart;kart_simulation_init(&kart,&spec->dynamics,&spec->geometry);
        kart.position=(KartVec3){0,0,.5f};float heading=0;
        KartSimulationWorld world={ground,NULL,NULL};
        KartCountdown countdown={0};bool forward_was_down=false;
        if(scenario==2){kart.position.x=42;heading=1.5707963267948966f;kart_countdown_start(&countdown,0);}
        if(scenario==3) {
            KartGroundHit hit;if(!road(NULL,(KartVec3){1200,980,400},(KartVec3){0,0,-1000},&hit))return 6;
            kart.position=(KartVec3){1200,980,hit.point.z+.5f};heading=3.1415926535897932f;
            world=(KartSimulationWorld){road,body,NULL};
        }
        float angle=heading+1.5707963267948966f;
        kart.orientation=(KartQuat){cosf(angle*.5f),0,0,sinf(angle*.5f)};
        KartGaugeState gauge={.model=KART_GAUGE_SLIP};KartGaugeConfig config=kart_gauge_default_config();
        KartChaseCameraFollow follow;kart_chase_camera_follow_reset(&follow);
        kart_chase_camera_update(&follow,kart.position,kart.orientation,0,false,0,KART_CHASE_FOLLOW_FRONT_MS);
        unsigned int clock=0;
        for(int i=0;i<(scenario==2?500:scenario==3?690:160);i++) {
            const unsigned int schedule[]={8,16,17,33,5};
            unsigned int dt=scenario==5?schedule[i%5]:(scenario>=2?16:5);clock+=dt;
            KartSimulationControls controls={0};
            controls.forward_input=i<130;controls.reverse_input=i>=130;
            controls.steering_input=(i>=70&&i<130)?.7f:0;
            controls.drift_input=(scenario==1||scenario==5)&&i>=70&&i<125;
            if(scenario==2) {
                controls.forward_input=i>=438&&i<490;controls.reverse_input=i>=490;
                controls.steering_input=i>=458&&i<488?.7f:0;
                bool forward=controls.forward_input!=0;
                KartCountdownCues cues=kart_countdown_update(&countdown,clock);
                if(forward&&!forward_was_down&&kart_countdown_start_boost_granted(&countdown,clock))
                    kart_timed_boost_start(&kart.timed_boost,1,KART_START_BOOST_DURATION_MS);
                forward_was_down=forward;
                if(!cues.released)controls.forward_input=controls.reverse_input=0;
            }
            if(scenario==3){controls.forward_input=1;controls.reverse_input=0;controls.steering_input=.5f;}
            if(scenario==4){controls.forward_input=0;controls.reverse_input=1;}
            KartSimulationStepResult step=kart_simulate_milliseconds(&kart,&controls,&world,dt);
            const KartQuat q=kart.orientation;
            float fx=2*(q.w*q.z-q.x*q.y),fy=-(1-2*(q.x*q.x+q.z*q.z));
            float rx=1-2*(q.y*q.y+q.z*q.z),ry=2*(q.x*q.y+q.w*q.z);
            float speed=sqrtf(kart.linear_velocity.x*kart.linear_velocity.x+kart.linear_velocity.y*kart.linear_velocity.y+kart.linear_velocity.z*kart.linear_velocity.z);
            int drifting=kart.drift.input_active||kart.drift.slip_detected||kart.drift.trigger_active||kart.drift.linger_timer>0;
            kart_gauge_update(&gauge,&config,&kart,kart.linear_velocity.x*fx+kart.linear_velocity.y*fy,kart.linear_velocity.x*rx+kart.linear_velocity.y*ry,drifting,dt*.001f);
            KartChaseCameraPose cam=kart_chase_camera_update(&follow,kart.position,kart.orientation,speed,kart.timed_boost.active||kart.instant_boost.active,dt,KART_CHASE_FOLLOW_FRONT_MS);
            float fields[]={kart.position.x,kart.position.y,kart.position.z,kart.linear_velocity.x,kart.linear_velocity.y,speed,atan2f(fy,fx),kart.angular_velocity.z,drifting,kart.timed_boost.remaining_ms*.001f,kart.instant_boost.active_timer,step.substeps,gauge.value/config.full_value*100,gauge.boosters,gauge.rate,gauge.contact_weight,cam.position.x,cam.position.y,cam.position.z,cam.forward.x,cam.forward.y,cam.forward.z,cam.field_of_view_degrees,cam.up.x,cam.up.y,cam.up.z,kart.previous_steer_angle_rad};
            printf("%d,%d",scenario,i);for(unsigned int k=0;k<sizeof(fields)/sizeof(fields[0]);k++)printf(",%.9g",fields[k]);printf("\n");
        }
    }
    kart_track_scene_free(&scene);return 0;
}
