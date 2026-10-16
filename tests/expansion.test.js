import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {DrivingState} from '../driving.js';
import {Progress} from '../physics.js';

const asset=new URL('../assets/',import.meta.url);
const catalog=JSON.parse(fs.readFileSync(new URL('catalog.json',asset)));
test('every selectable kart, character and track has loadable assets',()=>{
 for(const k of catalog.karts)for(const file of ['model.ktrk','skin.png'])assert.ok(fs.existsSync(new URL(`karts/${k.id}/${file}`,asset)),`${k.id}/${file}`);
 for(const c of catalog.characters)assert.ok(fs.existsSync(new URL(`characters/${c.id}/face.png`,asset)),c.id);
 for(const t of catalog.tracks){for(const file of ['track.ktrk','textures.json','course.json','thumbnail.png','bgm.ogg'])assert.ok(fs.existsSync(new URL(`tracks/${t.id}/${file}`,asset)),`${t.id}/${file}`);const course=JSON.parse(fs.readFileSync(new URL(`tracks/${t.id}/course.json`,asset)));assert.equal(course.gates.length,t.gates);assert.ok(new Progress(course.gates,t.laps));}
});
test('steering creates lateral slip and drift changes handling',()=>{
 const a=new DrivingState(),b=new DrivingState();for(let i=0;i<360;i++){a.step(1/120,{forward:true,steer:i>180?1:0});b.step(1/120,{forward:true,steer:i>180?1:0,drift:i>180});}
 assert.ok(a.speed>20);assert.ok(Math.abs(a.heading)>.1);assert.ok(Math.abs(b.vs)>Math.abs(a.vs),'drift should have greater sideways velocity');assert.equal(b.mode,'drift');
 for(let i=0;i<180;i++)b.step(1/120,{forward:true});assert.equal(b.mode,'grip');assert.ok(Number.isFinite(b.vf)&&Number.isFinite(b.vs));
});
