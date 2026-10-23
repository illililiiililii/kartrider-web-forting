#ifndef WEB_EXCEED_H
#define WEB_EXCEED_H
/* Web implementation using Korean BodyParam values. The Rust server exports
 * parameters, not the 5136 client EX state machine. No claim of native parity.
 * Length/minimum/cooldown are milliseconds, charge rates are fractions/sec.
 * Wall-loss recharge is intentionally pending (client algorithm unavailable).
 */
typedef struct WebExceed {float gauge, cooldown; bool active, previous;} WebExceed;
static void web_exceed_step(WebExceed *s, const float *p, unsigned int ms,
                            bool pressed, bool driving, bool boosting) {
    const float length=p[26], minimum=p[27];
    if(length<=0.0f) { *s=(WebExceed){0};return; }
    if(s->cooldown>0.0f)s->cooldown=fmaxf(0.0f,s->cooldown-ms);
    if(!s->active && pressed && !s->previous && driving && s->cooldown==0.0f && s->gauge>=minimum)
        s->active=true;
    s->previous=pressed;
    if(s->active){
        if(driving && pressed)s->gauge=fmaxf(0.0f,s->gauge-ms);
        if(!driving || !pressed || s->gauge==0.0f){s->active=false;s->cooldown=p[25];}
    }else if(driving && s->cooldown==0.0f){
        s->gauge=fminf(length,s->gauge+length*(boosting?p[22]:p[23])*ms*.001f);
    }
}
#endif
