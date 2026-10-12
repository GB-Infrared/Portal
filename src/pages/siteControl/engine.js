/* SITE CONTROL'S GLOBE - the engine, ported from design-mockup/plants.html.

   This file is that page's script, converted mechanically and otherwise left as
   the mockup wrote it, comments included; read them, they are the design notes.
   What the conversion changed:
     - it is a function, startGlobe(OPTS), that returns a teardown, so leaving the
       page stops the frame loop, the timers and every window listener it added;
     - PLANTS is the backend's site list (OPTS.sites), not a demo fleet, and the
       per-site figures are what the backend reported - nothing is modelled;
     - the portfolio's revenue, CO2 and day curve come from OPTS.portfolio();
     - the four photographs load from /textures, the stars from the shared module;
     - opening a site calls OPTS.onOpen(siteId) instead of loading home.html;
     - CSS variables it drives (--sun-x, --day, --go...) are written on the page
       wrapper (OPTS.root), which the page's scoped stylesheet reads.
   OPTS: { root, sites, portfolio(), operator, onOpen(siteId) }. A site here:
   { siteId, id (display name), addr, lat, lng, ac, dc, dev, down, warn, crit,
     kw, eToday, peak, state } - mutate the objects in place to refresh them. */
/* eslint-disable */
// @ts-nocheck
import { STAR_B64 } from '../../assets/starCatalog';

export function startGlobe(OPTS){
"use strict";
const __offs=[], __timers=[], __ints=[];
let __alive=true;
const __on=function(t,ev,fn,o){ t.addEventListener(ev,fn,o); __offs.push(function(){ t.removeEventListener(ev,fn,o); }); };
const __st=function(fn,ms){ const id=setTimeout(function(){ if(__alive) fn(); },ms); __timers.push(id); return id; };
const __si=function(fn,ms){ const id=setInterval(function(){ if(__alive) fn(); },ms); __ints.push(id); return id; };
/* a frame already asked for still arrives after stop(), so it checks again when it does */
const __raf=function(fn){ return __alive ? requestAnimationFrame(function(t){ if(__alive) fn(t); }) : 0; };
const $=id=>document.getElementById(id);
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ================= THE PORTFOLIO =================
   The same three sites the rest of the portal carries, with the same addresses
   and the same capacities, so the picker here reads as the picker there. A
   mockup may simulate; it may not disagree with itself. */
/* `sky` is the site's own weather, held apart from `perf`, which is the plant's
   own quality. Keeping them separate is the whole point: a site can be having a
   bad DAY without being a bad PLANT, and a screen that folds the two together
   sends somebody to a substation to look for a cloud. */
/* `lat`/`lng` are the site's real position, and they are the reason this screen
   is a map. They are read to the town the address names — Sangaria in
   Hanumangarh, Bikaner, Jaisalmer — which is the honest precision for a
   picker: close enough to put the site in the right part of the state, and not
   pretending to know which corner of which plot the inverter yard is on. The
   real backend sends surveyed coordinates and this projection will take them
   unchanged. */
/* THE PORTFOLIO is the backend's site list, as Site Control's React wrapper
   mapped it. Sites with no coordinates are not given to the globe - there is
   nowhere on the planet to put them - and stay reachable from the list. */
const PLANTS=OPTS.sites;

$('who').textContent=OPTS.operator||'operator';

/* ================= SIMULATED OUTPUT =================
   A day curve, so the map looks like a fleet rather than a diagram: sites are
   bright at noon and dark at night, which is the one thing about solar that a
   picture should get right. Anchored to the viewer's own clock — nothing here
   is a reading, and the caption never claims it is. */
/* The curve is now asked about ARBITRARY hours, not just this one, because the
   energy figure integrates it from dawn to now. Same shape, one argument. */
function curve(h){
  const P=OPTS.portfolio(); if(!P||!P.hours||!P.hours.length) return 0;
  const H=P.hours, K=P.kw, cap=P.cap||1;
  if(h<H[0]||h>H[H.length-1]) return 0;
  let i=0; while(i<H.length-2&&H[i+1]<h) i++;
  const a=K[i]==null?0:K[i], b=K[i+1]==null?a:K[i+1], t=H[i+1]>H[i]?(h-H[i])/(H[i+1]-H[i]):0;
  return Math.max(0,Math.min(1,(a+(b-a)*t)/cap));
}
function dayFactor(){
  const d=new Date();
  return curve(d.getHours()+d.getMinutes()/60);
}
/* WHAT THE SITE REPORTED. The mockup modelled this from a day curve; the
   backend's live power replaces it, and a site that reported nothing reads 0
   here and OFFLINE wherever its state says so. */
function outputOf(p){ return p.kw==null||!isFinite(p.kw) ? 0 : p.kw; }
function stateOf(p){
  if(p.state) return p.state;               /* the backend's word, when it gives one */
  if(p.crit>0) return 'crit';
  if(p.down>=p.dev) return 'off';
  if(p.warn>0||p.down>0) return 'warn';
  return 'ok';
}
/* The canvas cannot read a CSS variable, so it asks the document for one and
   keeps the answer. Asked ONCE, because this screen carries no theme control of
   its own — exactly like the sign-in. Both wear whatever the portal was last
   set to, applied by the script in the head before the first paint, and neither
   can change under its own feet while it is up.
   Asked at all, rather than hardcoded, because the portal LIFTS its accents for
   the dark theme instead of reusing them: a green picked to carry on white is
   not the green that carries on navy, and a map painted in the wrong one stops
   matching the page it is drawn on. */
let COLOR={};
let SEA_HI='',SEA='',SEA_LO='',LANDF='',LANDS='',GRATC='',LIMBC='',ATMOC='',NIGHTC='',TERMC='';
const ah=a=>Math.round(Math.max(0,Math.min(1,a))*255).toString(16).padStart(2,'0');
function readTheme(){
  const cs=getComputedStyle(OPTS.root);
  const t=n=>cs.getPropertyValue(n).trim();
  COLOR={ok:t('--green'),warn:t('--amber'),crit:t('--red'),off:t('--dim')};
  /* the border is the strongest line on the field, the graticule the faintest,
     and the land between them is barely there at all — a map read at a glance
     wants the SITES to be the bright thing, not the cartography */
  /* The globe is painted out of the portal's own tokens and nothing else. An
     earth rendered in photographic blue-greens would be a picture that had
     wandered in from another product; this one is the portal's navy, the
     portal's blue and the portal's gold, so it belongs to the same screen as
     the panel beside it. */
  /* These went up when the page ramp went up. The sphere is painted in --blue
     over the field, so lifting --bg from #0a1017 to #121a26 closed the gap
     between the ocean and the void it sits in, and the globe started to lose
     its silhouette on the night side. The ink is the same; there is simply more
     of it, so the separation the old ramp gave for free is bought back. */
  SEA_HI=t('--blue')+'54';   /* the lit face, nearest the sun   */
  SEA   =t('--blue')+'2e';   /* open ocean                      */
  SEA_LO=t('--blue')+'14';   /* the far edge, rolling away      */
  LANDF =t('--blue')+'46';   /* continents, filled              */
  LANDS =t('--blue')+'82';   /* coastlines, on the vector fallback only */
  GRATC =t('--blue')+'1f';   /* graticule                       */
  LIMBC =t('--blue')+'8c';   /* the edge of the world           */
  ATMOC =t('--blue');        /* the air                         */
  /* NIGHT IS NOT A PAGE COLOUR. It used to be the page background laid back
     over the globe, which worked while the page was dark and would be absurd
     now - painting a light page's own #f1f4f8 over the night side would make
     midnight the brightest thing on screen. The globe is its own lit world and
     its shadow is a real shadow, so this is a fixed deep blue and it does not
     follow the theme. */
  /* NOT AS DARK AS IT WAS. At d6 - eighty-four percent - the shadow was not a
     night, it was a hole: the coastline, the cloud and the site markers on the
     dark half all went to the same near-black, and half a monitoring picture
     became a place where nothing could be read. Dusk is not the absence of a
     photograph. So the ink is lifted and thinned: a paler navy at about
     two-thirds, which still reads unmistakably as the unlit half while leaving
     the land, the sea and the fleet on it visible. */
  /* Darker again than the light-page version, and it can be: the night side is
     no longer an empty hole to be apologised for, it is where the cities are.
     A shadow you can read a coastline through washes those out, and the lights
     are the more interesting fact. Still short of black, so the land under them
     stays faintly legible. */
  NIGHTC='#0a1424cc';
  /* Dawn is drawn in light, and for the same reason as the night above it: the
     terminator lies ON the globe, between a sunlit half and a dark one, and it
     answers to that world rather than to the page around it. Pale, fixed, and
     the same in any theme the portal ever grows. */
  TERMC ='#ffffff';          /* the day/night line              */

}
readTheme();
const STATE_TEXT={ok:'PRODUCING',warn:'ATTENTION',crit:'CRITICAL',off:'OFFLINE'};
const num=n=>Math.round(n).toLocaleString('en-IN');

/* kW under a megawatt and MW over it. A portfolio line reading 7,500 kW makes
   you count digits to learn it is seven and a half megawatts, which is the
   whole of what the line was for. */
const fmtP=kw=> kw>=1000 ? (kw/1000).toFixed(kw>=10000?0:1)+' MW'  : num(kw)+' kW';
const fmtE=e => e >=1000 ? (e /1000).toFixed(e >=10000?0:1)+' MWh' : num(e)+' kWh';

/* A site's OPEN ALARMS are its criticals and its warnings. A device that is
   simply down is counted separately and never folded in here: an inverter off
   for maintenance is a fact about the fleet, not somebody shouting. */
const alarmsOf=p=>p.crit+p.warn;

const nowH=()=>{ const d=new Date(); return d.getHours()+d.getMinutes()/60; };
const hhmm=h=>String(Math.floor(h)).padStart(2,'0')+':'+
              String(Math.round((h%1)*60)).padStart(2,'0');

/* Plane-of-array irradiance, from the same curve every other number here is
   built on: about 1010 W/m² at the top of a clear day at these latitudes. It is
   the reading that answers the only question a low output ever raises — is that
   the plant, or is it the sky? Every portal shows the kilowatts. The ones worth
   using show what the kilowatts were made FROM, because a fleet at half output
   under half a sun is a fleet behaving perfectly. */
/* THE PEAK SO FAR TODAY, and deliberately not the peak the model says is still
   coming: this is a monitoring screen, and a number it has not measured yet is
   a forecast wearing a reading's clothes. The day has exactly one maximum, at
   noon, so the highest point reached is the curve at noon once noon has passed
   and the curve at NOW before it. No search, and no pretending. */
function peakAt(){
  const h=nowH();
  return h<=5.5 ? 0 : Math.min(h,12);      /* 0 = nothing has happened yet today */
}
function peakOf(p){ return p.peak==null||!isFinite(p.peak) ? 0 : p.peak; }
/* NO TARIFF AND NO GRID FACTOR HERE. The mockup costed energy at a fixed 2.84
   and carbon at a fixed 0.71 so that it could print a revenue and a CO2 figure
   with no backend. Both are the backend's now (the portfolio call), worked out
   from the rates on Settings - the same numbers Home is given - so this screen
   cannot quote different money or carbon for the same kilowatt-hours. */
const fmtC=kg=> kg>=1000 ? (kg/1000).toFixed(kg>=10000?0:1)+' t'
              : num(kg)+' kg';
const inr=v=> v>=1e7 ? '₹'+(v/1e7).toFixed(2)+' Cr'
            : v>=1e5 ? '₹'+(v/1e5).toFixed(2)+' L'
            : '₹'+num(v);

/* kWh so far today, integrated from the same curve the map is lit by — a
   number that disagreed with the picture beside it would be worse than no
   number at all. Trapezoid at five-minute steps, which at this scale is exact
   enough that a finer step moves nothing on screen. */
function energyToday(p){ return p.eToday==null||!isFinite(p.eToday) ? 0 : p.eToday; }

/* ================= THE GLOBE =================
   The picker is a globe now, and the reason is not that a globe is pretty.

   It went ring -> flat map -> globe, and each step was forced by something the
   step before it could not say. The RING said nothing about where a site was.
   The FLAT MAP said where, but it was a diagram of one state: it could not put
   the fleet in the world, it had no room to grow past Rajasthan, and it had
   nothing to say about the one variable a solar operator actually lives by.

   THE SUN IS THE POINT. This is a solar portal, and the single fact that
   governs every number on every other screen is which of these sites the sun is
   currently on. A globe is the only projection where that fact draws itself:
   the terminator below is computed from the real position of the sun right now,
   so the dark half of the picture IS the half of the fleet that has stopped
   generating, and dawn visibly reaches the sites before the numbers move. No
   other picker on this portal can show that, and it is not decoration - it is
   the reason the morning ramp looks the way it does.

   Everything here is real: Natural Earth coastlines, real site coordinates, a
   real subsolar point. Nothing is drawn for effect that is not also true. */
const oc=$('atlas'), ox=oc.getContext('2d');
let W=0,H=0,CX=0,CY=0,R=0,R0=0;

/* ---- how close you are standing ----
   A whole globe answers "where in the world is this fleet". It cannot answer
   "which of these three is which", because Sangria, Rioja and Mendoza are
   inside four degrees of each other and four degrees of the whole Earth is a
   smudge. Both questions are real, so the picture does both: scroll in and the
   world comes up to meet you until the sites separate.

   The ceiling is eight. Past that an orthographic sphere stops behaving like a
   globe - the curvature falls out of the frame and you are looking at a flat
   photograph of some coastline, which is the flat map this screen already
   rejected once. */
let ZOOM=1, tZOOM=1;

/* ================= THE DESCENT =================
   The ceiling used to be eight, on the argument that past that an orthographic
   sphere stops behaving like a globe. That is true, and it is now the POINT: at
   the bottom of a descent you are not looking at a globe any more, you are
   looking at ground. Eight was the right ceiling for a picker that only ever
   answered "where in the world"; this one also has to answer "what is it like
   THERE", and that question is asked from much closer.

   DESC_Z is where the fly-down stops - about eight degrees across the frame,
   which is the whole fleet with room around it and the regional plate at very
   nearly its native resolution. Past that you are enlarging pixels. */
const MAXZ=34, DESC_Z=22;
let FLY=false;                 /* a commanded move, eased slowly and cinematically */
let REGMIX=0;                  /* how much of the fleet's own ground is showing   */

/* ---- THE DEPARTURE ----
   GOING is the site the screen is leaving for, and it is set only by open().
   While it is set the camera is not being EASED towards anything - it is being
   assigned its position from a script (see frame()), because a transition that
   something else is timed against has to finish, and finish on the beat.

   GO_MS is that beat, and it is the only place that decides. The stylesheet
   times the rail leaving and the page dissolving against the same number
   through --go, written from here, so the picture and the chrome can never
   drift out of step the way two literals eventually do. */
let GOING=null, GO=null, GOT=0;   /* GOT: 0..1, how far through the departure */
const GO_MS=1150;

/* HOW FAR THROUGH, and it is deliberately past the ceiling everything else on
   this page obeys. MAXZ is the limit on BROWSING - the point past which you are
   enlarging pixels rather than learning anything, which is the right limit for
   somebody looking. Held to it, a departure that begins where the load-descent
   already left the camera has 22 to 34 to travel in: about one and a half
   times, spread over a second, which is not a fall. It is a still frame with a
   shutter closing over it, and the first cut of this transition proved it -
   the frame at half a second and the frame at three quarters were the same
   picture.

   So the departure gets its own ceiling and it is roughly four times the
   browsing one. The ground goes soft well before the bottom, and that is not a
   defect being tolerated: you are going THROUGH it, the last third is behind a
   closing iris, and ground that stayed crisp while it rushed past would be the
   one part of this that looked like a zoom rather than a descent. */
const GO_Z=92;

function descend(p){
  const t=p||{lng:HOME.lam,lat:HOME.phi};
  tLAM=t.lng; tPHI=Math.max(-78,Math.min(78,t.lat)); tZOOM=DESC_Z;
  FLY=true; idle=-1e9;         /* and it does not drift home while it is down there */
}
/* still reachable from Escape - a wordless "back out" that zoom buttons alone
   don't give you, since they zoom in place rather than re-centring on HOME */
function orbit(){
  tLAM=HOME.lam; tPHI=HOME.phi; tZOOM=1;
  FLY=true; idle=0;
}
const isDown=function(){ return ZOOM>2.2; };

/* ---- the world ----
   Natural Earth 1:110m land, reduced to about 2,600 points - Douglas-Peucker at
   a quarter of a degree, which at this size is well under one pixel, so the
   coastline is as accurate as the screen can show and no heavier than it has to
   be. Rings are separated by "|", points by a space, each point "lng,lat".
   India is carried separately so the fleet's own country can be picked out of
   the landmass without needing a second dataset. */
function rings(str){
  return str.split('|').map(function(r){
    return r.split(' ').map(function(p){
      const a=p.split(','); return [+a[0],+a[1]];
    });
  });
}
const LAND=rings('-59.6,-80 -60.2,-81 -64.5,-80.9 -66.3,-80.3 -61.9,-80.4 -60.6,-79.6 -59.6,-80|-159.2,-79.5 -161.1,-79.6 -163.7,-78.6 -163.1,-78.2 -161.2,-78.4 -159.5,-79 -159.2,-79.5|-45.2,-78 -43.9,-78.5 -43.3,-80 -50.5,-81 -54.2,-80.6 -54,-80.2 -51,-79.6 -48.7,-78 -45.2,-78|-121.2,-73.5 -118.7,-73.5 -120.2,-74.1 -122.6,-73.7 -122.4,-73.3 -121.2,-73.5|-99,-71.9 -96.8,-72 -96.2,-72.5 -100.8,-72.5 -102.3,-71.9 -99,-71.9|-68.5,-71 -68.8,-72.2 -71.1,-72.5 -72.4,-72.5 -71.9,-72.1 -74.2,-72.4 -75,-72.1 -75,-71.7 -72.1,-71.2 -71.7,-69.5 -70.3,-68.9 -68.5,-71|-180,-84.7 -179.1,-84.1 -177.3,-84.5 -175.9,-84.1 -174.4,-84.5 -172.9,-84.1 -170,-83.9 -167,-84.6 -158.1,-85.4 -155.2,-85.1 -148.5,-85.6 -143.1,-85 -142.9,-84.6 -150.1,-84.3 -153.6,-83.7 -152.7,-82.5 -152.9,-82 -156.8,-81.1 -152.1,-81 -150.6,-81.3 -146.4,-80.3 -146.8,-79.9 -149.5,-79.4 -155.3,-79.1 -158.1,-78 -158.4,-76.9 -157,-77.3 -153.7,-77.1 -152.9,-77.5 -151.3,-77.4 -146.1,-76.5 -146.5,-75.7 -146.2,-75.4 -144.9,-75.2 -144.3,-75.5 -135.2,-74.3 -119.7,-74.5 -113.9,-73.7 -112.3,-74.7 -111.3,-74.4 -107.6,-75.2 -104.9,-74.9 -100.6,-75.3 -100.1,-74.9 -101.3,-74.2 -102.5,-74.1 -103.7,-72.6 -99.1,-72.9 -97.7,-73.6 -96.3,-73.6 -92.4,-73.2 -90.1,-73.3 -89.2,-72.6 -88.4,-73 -86,-73.1 -85.2,-73.5 -81.5,-73.9 -80.3,-73.1 -76.2,-74 -68.9,-73 -68,-72.8 -67.1,-72 -68.5,-69.7 -67.6,-68.5 -67.7,-67.3 -67.3,-66.9 -63,-64.6 -57.8,-63.3 -57.2,-63.5 -57.6,-63.9 -62,-64.8 -62.6,-65.5 -62.1,-66.2 -63.7,-66.5 -65.7,-68 -63.2,-69.2 -61.8,-70.7 -60.7,-73.2 -60.8,-73.7 -64.4,-75.3 -70.6,-76.6 -77.2,-76.7 -76.9,-77.1 -73.7,-77.9 -77.9,-78.4 -78,-79.2 -75.4,-80.3 -59.7,-82.4 -58.2,-83.2 -49.8,-81.7 -42.8,-82.1 -40.8,-81.4 -28.6,-80.3 -29.7,-79.6 -29.7,-79.3 -35.6,-79.5 -35.8,-78.3 -35.3,-78.1 -28.9,-76.7 -22.5,-76.1 -17.5,-75.1 -15.7,-74.5 -15.4,-74.1 -16.5,-73.9 -15.4,-73.1 -12.3,-72.4 -10.3,-71.3 -7.4,-71.7 -6.9,-70.9 -4.3,-71.5 -0.7,-71.2 -0.2,-71.6 7.7,-69.9 9.5,-70 10.8,-70.8 13.4,-70 14.7,-70 15.1,-70.4 15.9,-70 19.3,-69.9 21.5,-70.1 22.6,-70.7 27.1,-70.5 32,-69.7 33.9,-68.5 38.6,-69.8 42,-68.6 46.5,-67.6 47.4,-67.7 50.8,-66.9 51.8,-66.2 54.5,-65.8 56.4,-66 58.7,-67.3 61.4,-68 62.4,-68 64.1,-67.4 68.9,-67.9 69.7,-69.2 69.6,-69.7 67.8,-70.3 67.9,-70.7 69.1,-70.7 67.9,-71.9 69.9,-72.3 71,-72.1 73.9,-69.9 77.6,-69.5 79.1,-68.3 82.8,-67.2 86.8,-67.1 88,-66.2 89.7,-67.1 95.8,-67.4 99.7,-67.2 102.8,-65.6 106.2,-66.9 110.2,-66.7 113.6,-65.9 115.6,-66.7 119.8,-67.3 123.2,-66.5 128.8,-66.8 134.8,-66.2 135.1,-65.3 136.6,-66.8 137.5,-67 145.5,-66.9 146.6,-67.9 148.8,-68.4 152.5,-68.9 154.3,-68.6 156.8,-69.4 159.2,-69.6 161.6,-70.6 167.3,-70.8 171.2,-71.7 169.3,-73.7 166.1,-74.4 163.6,-76.2 163.5,-77.1 164.7,-78.2 166.6,-78.3 167,-78.8 161.8,-79.2 159.8,-80.9 163.7,-82.4 168.9,-83.3 169.4,-83.8 173.2,-84.4 176,-84.2 178.3,-84.5 -180,-84.7|-67.8,-53.8 -65.1,-54.7 -65.5,-55.2 -67,-54.9 -68.1,-55.6 -69.2,-55.5 -72.3,-54.5 -74.7,-52.8 -71.1,-54.1 -70.3,-52.9 -69.3,-52.5 -68.6,-52.6 -67.8,-53.8|-58.5,-51.1 -57.7,-51.5 -58,-51.9 -59.4,-52.2 -59.8,-51.8 -60.7,-52.3 -61.2,-51.8 -60,-51.3 -59.2,-51.5 -58.5,-51.1|145.4,-40.8 146.4,-41.1 148.3,-40.9 148.4,-42.1 147.9,-43.2 147.6,-42.9 146.9,-43.6 146,-43.5 144.7,-41.2 144.7,-40.7 145.4,-40.8|173,-40.9 173.2,-41.3 174,-40.9 174.2,-41.3 174.2,-41.8 172.7,-43.4 173.1,-43.9 171.5,-44.2 170.6,-45.9 169.3,-46.6 166.7,-46.2 166.5,-45.9 167,-45.1 170.5,-43 172.1,-41 172.8,-40.5 173,-40.9|174.6,-36.2 175.3,-37.2 175.4,-36.5 175.8,-36.8 176,-37.6 176.8,-37.9 178.5,-37.7 178,-39.2 177.2,-39.1 176,-41.3 175.2,-41.7 174.7,-41.3 175.2,-40.5 174.9,-39.9 173.8,-39.5 174.6,-38.8 174.7,-37.4 172.6,-34.5 174.3,-35.3 174.6,-36.2|167.1,-22.2 166.7,-22.4 165.5,-21.7 164,-20.1 165,-20.5 167.1,-22.2|-180,-16.6 178.7,-17 178.6,-16.6 179.4,-16.4 -179.8,-16 -180,-16.6|50.1,-13.6 50.4,-15.7 50.2,-16 49.9,-15.4 49.7,-15.7 49.8,-16.9 47.1,-24.9 45.4,-25.6 44,-25 43.3,-22.1 44.4,-20.1 44,-17.4 44.4,-16.2 46.3,-15.8 47.7,-14.6 47.9,-13.7 48.3,-13.8 49.2,-12 50.1,-13.6|143.6,-13.8 143.9,-14.5 144.6,-14.2 145.4,-15 146.4,-19 148.8,-20.4 149.7,-22.3 150.7,-22.4 150.9,-23.5 152.9,-25.3 153.1,-26.1 153.1,-27.3 153.6,-28.1 153.1,-30.9 152.4,-32.6 151.7,-33 150.3,-35.7 150,-37.4 148.3,-37.8 146.3,-39 144.9,-38.4 145,-37.9 143.6,-38.8 140.6,-38 140,-37.4 139.6,-36.1 138.1,-35.6 138.4,-35.1 138.2,-34.4 137.7,-35.1 136.8,-35.3 137.9,-33.6 137.8,-32.9 136.4,-34.1 136,-34.9 135.2,-34.5 135.2,-33.9 134.1,-32.8 134.3,-32.6 131.3,-31.5 126.1,-32.2 124.2,-33 123.7,-33.9 119.9,-34 118,-35.1 116.6,-35 115,-34.2 115,-33.6 115.7,-33.3 115.7,-31.6 115,-29.5 113.3,-26.1 113.8,-26.5 113.4,-25.6 114.2,-26.3 113.4,-24.4 114.1,-21.8 114.2,-22.5 114.6,-21.8 116.7,-20.7 120.9,-19.7 122.2,-18.2 122.3,-17.3 123,-16.4 123.4,-17.3 123.9,-17.1 123.5,-16.6 123.8,-16.1 124.3,-16.3 124.4,-15.6 125.7,-14.2 127.1,-13.8 128.4,-14.9 129.6,-15 129.4,-14.4 130.6,-12.5 132.6,-12.1 132.6,-11.6 131.8,-11.3 132.4,-11.1 135.3,-12.2 136.5,-11.9 137,-12.4 136,-13.3 135.5,-15 140.2,-17.7 140.9,-17.4 141.7,-15 141.5,-13.7 142.1,-11 142.5,-10.7 142.8,-11.2 143.6,-13.8|124.4,-10.1 123.5,-10.2 124,-9.3 125.1,-8.7 127.3,-8.4 125.1,-9.4 124.4,-10.1|117.9,-8.1 118.9,-8.3 119.1,-8.7 116.7,-9 117.9,-8.1|122.9,-8.1 122.8,-8.7 119.9,-8.8 119.9,-8.4 120.7,-8.2 121.3,-8.5 122.9,-8.1|108.6,-6.8 110.5,-6.9 110.8,-6.5 112.6,-6.9 113,-7.6 115.7,-8.4 114.6,-8.8 108.3,-7.8 105.4,-6.9 106.1,-5.9 107.3,-6 108.6,-6.8|152,-5.5 150.2,-6.3 148.3,-5.7 148.4,-5.4 149.8,-5.5 150.1,-5 150.2,-5.5 150.8,-5.5 151.6,-4.8 151.5,-4.2 152.3,-4.3 152,-5.5|130.5,-3.1 130.8,-3.9 130,-3.4 127.9,-3.4 128.1,-2.8 130.5,-3.1|153.1,-4.5 152.8,-4.8 152.4,-3.8 150.7,-2.7 150.9,-2.5 152.2,-3.2 153.1,-4.5|134.1,-1.2 134.4,-2.8 135.5,-3.4 136.3,-2.3 137.4,-1.7 138.3,-1.7 144.6,-3.9 145.8,-4.9 146,-5.5 147.6,-6.1 147.9,-6.6 147,-6.7 147.2,-7.4 148.7,-9.1 149.3,-9.1 149.3,-9.5 150.8,-10.3 150.7,-10.6 147.9,-10.1 146,-8.1 144.7,-7.6 143.3,-8.2 143.4,-9 142.6,-9.3 141,-9.1 140.1,-8.3 139.1,-8.1 137.6,-8.4 138,-7.6 138.7,-7.3 137.9,-5.4 133.7,-3.5 133,-4.1 132.8,-3.3 132,-2.8 133.8,-2.5 133.7,-2.2 132.2,-2.2 130.5,-0.9 132.4,-0.4 134,-0.8 134.1,-1.2|125.2,1.4 124.4,0.4 123.7,0.2 120.2,0.2 120,-0.5 120.9,-1.4 121.5,-1 123.3,-0.6 123.3,-1.1 122.8,-0.9 121.5,-1.9 122.5,-3.2 122.3,-3.5 123.2,-4.7 123.2,-5.3 122.6,-5.6 122.2,-5.3 122.7,-4.5 121.7,-4.9 121.5,-4.6 121.6,-4.2 120.9,-3.6 121,-2.6 120.3,-2.9 120.4,-5.5 119.4,-5.4 119.5,-3.5 119.1,-3.5 118.8,-2.8 120,0.6 120.9,1.3 122.9,0.9 124.1,0.9 125.1,1.6 125.2,1.4|128.7,1.1 128.6,0.3 128.1,0.4 128,-0.3 128.4,-0.8 128.1,-0.9 127.4,1 127.6,1.8 127.9,2.2 128,1.6 128.6,1.5 128.7,1.1|105.8,-5.9 104.7,-5.9 102.6,-4.2 99.3,0.2 98.6,1.8 95.4,5 95.3,5.5 97.5,5.2 100.6,2.1 101.7,2.1 103.8,0.1 103.4,-0.7 104.4,-1.1 104.9,-2.3 105.6,-2.4 106.1,-3.1 105.8,-5.9|117.9,1.8 119,0.9 117.8,0.8 117.5,-0.8 116.6,-1.5 116.1,-4 116,-3.7 114.9,-4.1 114.5,-3.5 113.3,-3.1 112.1,-3.5 111.7,-3 110.2,-2.9 110.1,-1.6 109.1,-0.5 109.1,1.3 109.7,2 110.4,1.7 111.2,1.9 111.4,2.7 113,3.1 116.7,6.9 117.1,6.9 117.7,6 119.2,5.4 119.1,5 118.4,5 118.6,4.5 117.9,4.1 117.3,3.2 118,2.3 117.9,1.8|126.4,8.4 126.5,7.2 126.2,6.3 125.8,7.3 125.4,6.8 125.7,6 125.4,5.6 124.2,6.2 123.9,6.9 124.2,7.4 123.6,7.8 122.1,6.9 121.9,7.2 122.3,8 123.5,8.7 123.8,8.2 124.6,8.5 124.8,9 125.5,9 125.4,9.8 126.2,9.3 126.4,8.4|81.2,6.2 80.3,6 79.9,6.8 79.7,8.2 80.1,9.8 81.8,7.5 81.6,6.5 81.2,6.2|124,10.3 123,9 122.4,9.7 122.9,10.9 123.5,10.9 123.3,10.3 124.1,11.2 124,10.3|118.5,9.3 117.2,8.4 119.5,11.4 119.7,10.6 118.5,9.3|125.5,12.2 125.8,11 125,11.3 125.3,10.4 124.8,10.1 124.3,11.5 124.9,11.4 124.9,11.8 124.3,12.6 125.2,12.5 125.5,12.2|121.3,18.5 121.9,18.2 122.2,18.5 122.5,17.1 122.3,16.3 121.7,15.9 121.7,14.3 124,13.8 124.1,12.5 122.9,13.6 122.7,13.2 122,13.8 120.6,13.9 121,14.5 120.7,14.8 120.6,14.4 120.1,15 119.9,16.4 120.3,16 120.7,18.5 121.3,18.5|-76.9,17.9 -78.3,18.2 -76.9,18.4 -76.2,17.9 -76.9,17.9|-72.6,19.9 -70,19.6 -68.3,18.6 -68.7,18.2 -70.7,18.4 -71.4,17.6 -72.4,18.2 -73.9,18 -74.5,18.3 -74.4,18.7 -72.3,18.7 -72.8,19.5 -73.4,19.6 -72.6,19.9|110.3,18.7 109.5,18.2 108.7,18.5 108.6,19.4 109.1,19.8 110.8,20.1 111,19.7 110.3,18.7|-79.7,22.8 -79.3,22.4 -78.3,22.5 -76.5,21.2 -75.6,21 -75.7,20.7 -74.2,20.3 -75,19.9 -77.8,19.9 -77.1,20.4 -78.1,20.7 -78.7,21.6 -81.8,22.2 -82.2,22.4 -81.8,22.6 -82.8,22.7 -84.1,21.9 -85,21.9 -83.8,22.8 -82.3,23.2 -79.7,22.8|121.2,22.8 120.7,22 120.1,23.6 121.5,25.3 122,25 121.2,22.8|134.6,34.1 134.8,33.8 134.2,33.2 133.8,33.5 133,32.7 132.4,33 132.9,34.1 133.5,33.9 133.9,34.4 134.6,34.1|23.7,35.7 26.3,35.3 26.2,35 24.7,34.9 23.5,35.3 23.7,35.7|15.5,38.2 15.1,36.6 12.4,37.6 12.6,38.1 15.5,38.2|9.2,41.2 9.8,40.5 9.7,39.2 8.8,38.9 8.4,39.2 8.2,41 9.2,41.2|141,37.1 140.8,35.8 140.3,35.1 137.2,34.6 135.8,33.5 135.1,33.8 135.1,34.6 131,33.9 132,33.1 131.3,31.5 130.7,31 130.2,31.4 130.4,32.3 129.4,33.3 130.4,33.6 132.6,35.4 135.7,35.5 136.7,37.3 137.4,36.8 139.4,38.2 140.1,39.4 139.9,40.6 140.3,41.2 141.4,41.4 141.9,40 141.9,39.2 141,38.2 141,37.1|143.9,44.2 144.6,44 145.3,44.4 145.5,43.3 144.1,43 143.2,42 141.6,42.7 141.1,41.6 140,41.6 139.8,42.6 140.3,43.3 141.4,43.4 142,45.6 143.9,44.2|-63.7,46.5 -62,46.4 -62.9,46 -64.1,46.4 -64.4,46.7 -64,47 -63.7,46.5|-123.5,48.5 -125.7,48.8 -127,49.8 -128.1,50 -128.4,50.8 -125.8,50.3 -123.5,48.5|-56.1,50.7 -56.8,49.8 -56.1,50.1 -55.5,49.9 -55.8,49.6 -53.5,49.2 -53.8,48.5 -53.1,48.7 -52.6,47.5 -53.1,46.7 -54.2,46.8 -54,47.6 -54.2,47.8 -55.4,46.9 -56,46.9 -55.3,47.4 -56.3,47.6 -59.3,47.6 -59.4,47.9 -58.8,48.3 -59.2,48.5 -57.4,50.7 -55.9,51.6 -55.4,51.6 -56.1,50.7|-132.7,54 -131.7,54.1 -132.1,53 -131.2,52.2 -133.1,53.4 -133.2,54.2 -132.7,54|143.6,50.7 144.7,49 143.2,49.3 142.6,47.9 143.5,46.8 143.5,46.1 142.7,46.7 142.1,46 142.2,51 141.6,51.9 141.7,53.3 142.6,53.8 142.2,54.2 142.7,54.4 143.6,50.7|-6.8,52.3 -8.6,51.7 -10,51.8 -9.2,52.9 -9.7,53.9 -7.6,55.1 -6.7,55.2 -5.7,54.6 -6.2,53.9 -6,53.2 -6.8,52.3|-153,57.1 -154,56.7 -154.7,57.5 -152.6,57.9 -152.1,57.6 -153,57.1|-3,58.6 -4.1,57.6 -2,57.7 -3.1,56 -2.1,55.9 -1.1,54.6 -0.4,54.5 0.5,52.9 1.7,52.7 1.6,52.1 1,51.8 1.4,51.3 0.5,50.8 -3,50.7 -5.2,50 -5.8,50.2 -3.4,51.4 -5,51.6 -5.3,52 -4.2,52.3 -4.8,52.8 -4.6,53.5 -3.1,53.4 -2.9,54 -3.6,54.6 -4.8,54.8 -5.1,55.1 -4.7,55.5 -5,55.8 -5.6,55.3 -5.6,56.3 -6.2,56.8 -5,58.6 -3,58.6|-81.9,62.7 -83.1,62.2 -84,62.5 -83.2,62.9 -81.9,62.7|-171.7,63.8 -168.7,63.3 -169.5,63 -171.6,63.3 -171.7,63.8|-85.2,65.7 -85,65.2 -84.5,65.4 -81.6,64.5 -81.6,64 -80.1,63.7 -81,63.4 -82.5,63.7 -83.1,64.1 -85.5,63.1 -85.9,63.6 -87.2,63.5 -86.4,64 -85.9,65.7 -85.2,65.7|-14.5,66.5 -14.7,65.8 -13.6,65.1 -14.9,64.4 -18.7,63.5 -22.8,64 -21.8,64.4 -24,64.9 -22.2,65.1 -22.2,65.4 -24.3,65.6 -23.7,66.3 -22.1,66.4 -20.6,65.7 -19.1,66.3 -17.8,66 -16.2,66.5 -14.5,66.5|-75.9,67.1 -77,67.1 -77.2,67.6 -76.8,68.1 -75.9,68.3 -75.1,68 -75.2,67.4 -75.9,67.1|-180,69 -174.9,67.2 -175,66.6 -174.3,66.3 -174.6,67.1 -171.9,66.9 -169.9,66 -172.5,65.4 -172.6,64.5 -173,64.3 -176,64.9 -176.2,65.4 -178.4,65.4 -178.9,65.7 -178.7,66.1 -179.9,65.9 -179.4,65.4 -180,65 180,65 178.7,64.5 177.4,64.6 179.4,63 179.2,62.3 177.4,62.5 173.7,61.7 170.3,59.9 168.9,60.6 166.3,59.8 165.8,60.2 164.9,59.7 163.5,59.9 162,58.2 162.1,57.8 163.2,57.6 163.1,56.2 162.1,56.1 161.7,55.3 162.1,54.9 160.4,54.3 160,53.2 158.5,53 158.2,51.9 156.8,51 155.4,55.4 155.9,56.8 156.8,57.4 156.8,57.8 158.4,58.1 163.7,61.1 164.5,62.6 163.3,62.5 162.7,61.6 160.1,60.5 159.3,61.8 156.7,61.4 154.2,59.8 155,59.1 151.3,58.8 151.3,59.5 149.8,59.7 148.5,59.2 142.2,59 135.1,54.7 136.7,54.6 137.2,54 138.2,53.8 138.8,54.3 139.9,54.2 141.3,53.1 141.4,52.2 140.6,51.2 140.1,48.4 138.2,46.3 134.9,43.4 133.5,42.8 132.3,43.3 130,41.9 129.7,40.9 127.5,39.8 127.4,39.2 128.4,38.6 129.5,36.8 129.5,35.6 129.1,35.1 126.5,34.4 126.6,35.7 126.1,36.7 126.9,36.9 126.2,37.7 125.3,37.7 124.7,38.1 125.2,38.7 125.3,39.6 124.3,39.9 121.1,38.9 122.2,40.4 121.6,40.9 119,39.3 118,39.2 117.5,38.7 118.1,38.1 118.9,37.9 118.9,37.4 119.7,37.2 120.8,37.9 122.4,37.5 122.5,36.9 121.1,36.7 119.2,34.9 120.2,34.4 121.9,31.7 121.9,30.9 121.3,30.7 122.1,29.8 121.7,28.2 121.1,28.1 118.7,24.5 115.9,22.8 114.2,22.2 113.8,22.5 113.2,22.1 110.8,21.4 110.4,20.3 109.9,20.3 109.9,21.4 108.5,21.7 106.7,20.7 105.9,19.8 105.7,19.1 108.9,15.3 109.3,13.4 109.2,11.7 105.2,8.6 104.8,9.2 105.1,9.9 103.5,10.6 102.6,12.2 100.8,12.6 101,13.4 100.1,13.4 99.2,9.2 99.9,9.2 100.5,7.4 103,5.5 103.4,4.9 103.5,2.8 104.2,1.3 103.5,1.2 101.4,2.8 100.2,5.3 100.1,6.5 98.5,8.4 98.3,7.8 98.1,8.3 98.8,11.4 97.2,16.9 95.4,15.7 94.2,16 94.5,17.3 94.3,18.2 93.5,19.4 93.7,19.7 92.4,20.7 91.4,22.8 90.5,22.8 90.3,21.8 89,22.1 88.9,21.7 87,21.5 87,20.7 86.5,20.2 85.1,19.5 82.2,17 82.2,16.6 80.3,15.9 79.9,10.4 79.3,10.3 78.9,9.5 79.2,9.2 78.3,8.9 77.5,8 76.6,8.9 74.9,12.7 74.4,14.6 73.5,16 72.6,21.4 71.2,20.8 70.5,20.9 69.2,22.1 69.6,22.5 69.3,22.8 67.4,23.9 66.4,25.4 61.5,25.1 57.4,25.7 57,27 56.5,27.1 54.7,26.5 51.5,27.9 50.1,30.1 48.9,30.3 48,30 48.8,27.7 50.2,26.7 50.1,25.9 50.8,24.8 51,26 51.6,25.8 51.4,24.6 51.8,24 54,24.1 56.4,26.4 56.4,24.9 56.8,24.2 58.7,23.6 59.8,22.3 58.5,20.4 57.8,20.2 57.7,18.9 56.6,18.6 56.3,17.9 55.3,17.6 55.3,17.2 52.4,16.4 52.2,15.6 49.6,14.7 48.7,14 45.6,13.3 45,12.7 43.5,12.6 42.6,15.2 42.7,16.8 40.9,19.5 39.1,21.3 39.1,22.6 38.5,23.7 37.5,24.3 35.1,28.1 34.6,28.1 34.9,29.5 33.9,27.6 32.4,29.9 34.1,26.1 35.7,23.9 35.5,23.1 36.9,22 37.5,18.6 38.4,18 39.3,15.9 43.3,12.4 43.3,12 42.7,11.7 44.1,10.4 44.6,10.4 51.1,12 51,10.6 49.5,6.8 47.7,4.2 40.3,-2.6 39.2,-4.7 38.8,-6.5 39.4,-6.8 39.2,-8.5 40.5,-10.8 40.8,-14.7 39.5,-16.7 37.4,-17.6 34.8,-19.8 34.7,-20.5 35.6,-22.1 35.5,-24.1 32.6,-25.7 32.9,-26.2 32.2,-28.8 28.2,-32.8 25.8,-33.9 22.6,-33.9 19.6,-34.8 18.2,-33.9 17.9,-32.6 18.2,-32.4 18.2,-31.7 15.2,-27.1 14.3,-22.1 11.8,-18.1 11.8,-15.8 12.5,-13.5 13.6,-12 13.7,-10.7 12.9,-9.2 13.2,-8.6 11.9,-5 8.8,-1.1 9.8,3.1 9.4,3.7 8.5,4.8 5.9,4.3 4.3,6.3 1.9,6.1 -2,4.7 -4.6,5.2 -7.5,4.3 -9,4.8 -12.4,7.3 -14.8,10.9 -16.6,12.2 -16.7,13.6 -17.6,14.7 -16.5,16.1 -16.1,18.1 -16.3,20.1 -17.1,21 -17,21.9 -16,23.7 -15.1,24.5 -14.4,26.3 -12.6,28 -11.7,28.1 -9.6,29.9 -9.8,31.2 -9.3,32.6 -6.9,34.1 -5.9,35.8 -2.2,35.2 1.5,36.6 5.3,36.7 6.3,37.1 8.4,36.9 9.5,37.4 10.2,37.2 10.2,36.7 11.1,36.9 10.6,36.4 10.9,35.7 10.8,34.8 10.2,34.3 10.3,33.8 11.5,33.1 15.2,32.3 15.7,31.4 19.1,30.3 20.1,31 19.8,31.8 20.1,32.2 21.5,32.8 22.9,32.6 23.2,32.2 25.2,31.6 26.5,31.6 28.9,30.9 31,31.6 31.7,31.4 32,30.9 32.2,31.3 33.8,31 34.6,31.5 36,34.6 36.1,35.8 35.8,36.3 36.2,36.7 34.7,36.8 34,36.2 32.5,36.1 31.7,36.6 30.6,36.7 29.7,36.1 28.7,36.7 27.6,36.7 26.3,38.2 26.8,39 26.2,39.5 27.3,40.4 28.8,40.5 29.2,41.2 31.1,41.1 33.5,42 35.2,42 38.3,40.9 40.4,41 41.6,41.5 41.7,42 41.5,42.6 36.7,45.2 37.4,45.4 38.2,46.2 37.7,46.6 39.1,47.3 35,46.3 35,45.7 36.5,45.5 36.3,45.1 33.9,44.4 33.3,44.6 33.5,45 32.5,45.3 33.6,45.9 33.3,46.1 31.7,46.3 31.7,46.7 30.7,46.6 29.6,45 28.8,44.9 28.6,43.7 27.7,42.6 28.1,41.6 29,41.3 28.8,41.1 27.6,41 26.4,40.2 26.1,40.8 24.9,40.9 23.7,40.7 24.4,40.1 23.9,40 22.8,40.5 22.6,40.3 23.4,39.2 23,39 24,38.2 24,37.7 23.1,37.9 23.4,37.4 22.8,37.3 23.2,36.4 22.5,36.4 21.7,36.8 21.1,38.3 19.4,40.3 19.5,41.7 16,43.5 15.2,44.2 14.9,45.1 14.3,45.2 14,44.8 13.7,45.1 13.9,45.6 13.1,45.7 12.3,45.4 12.6,44.1 15.1,42 15.9,42 16.2,41.7 15.9,41.5 18.5,40.2 18.3,39.8 16.9,40.4 16.5,39.8 17.2,39.4 17.1,38.9 16.1,38 15.7,37.9 16.1,39 15.4,40 12.1,41.7 10.5,42.9 10.2,43.9 8.9,44.4 6.5,43.1 4.6,43.4 3.1,43.1 3,41.9 2.1,41.2 0.8,41 -0.3,39.3 0.1,38.7 -0.7,37.6 -1.4,37.4 -2.1,36.7 -4.4,36.7 -5.4,35.9 -5.9,36 -6.5,36.9 -8.9,36.9 -8.8,38.3 -9.5,38.7 -8.8,40.8 -9,42.6 -9.4,43 -8,43.7 -1.9,43.4 -1.4,44 -1.2,46 -3,47.6 -4.5,48 -4.6,48.7 -1.6,48.6 -1.9,49.8 -1,49.3 1.3,50.1 1.6,50.9 3.8,51.6 4.7,53.1 7.1,53.7 8.1,53.5 8.8,54 8.1,55.5 8.1,56.5 8.5,57.1 10.6,57.7 10.3,56.9 10.9,56.5 9.6,55.5 9.9,54.6 10.9,54.4 10.9,54 12.5,54.5 14.1,53.8 17.6,54.9 19.7,54.4 19.9,54.9 21.3,55.2 21.1,56.8 21.6,57.4 22.5,57.8 23.3,57 24.1,57 24.4,58.4 23.4,58.6 23.3,59.2 25.9,59.6 28,59.5 29.1,60 28.1,60.5 22.9,59.8 21.3,60.7 21.5,61.7 21.1,62.6 21.5,63.2 25.4,65.1 25.3,65.5 23.9,66 22.2,65.7 21.2,65 21.4,64.4 17.8,62.7 17.1,61.3 18.8,60.1 17.9,59 16.8,58.7 15.9,56.1 14.7,56.2 14.1,55.4 12.9,55.4 10.4,59.5 8.4,58.3 7.1,58.1 5.7,58.6 5,62 5.9,62.6 10.5,64.5 14.8,67.8 19.2,69.8 23,70.2 24.5,71 28.2,71.2 31.3,70.5 30,70.2 31.1,69.6 32.1,69.9 40.3,67.9 41.1,67.5 41.1,66.8 40,66.3 38.4,66 33.2,66.6 34.8,65.9 34.9,64.4 37,63.9 37.1,64.3 36.5,64.8 37.2,65.1 39.6,64.5 40.4,64.8 39.8,65.5 42.1,66.5 44,66.1 44.5,66.8 43.7,67.4 44.2,68 43.5,68.6 46.3,68.2 46.8,67.7 45.6,67.6 45.6,67 46.3,66.7 47.9,66.9 48.1,67.5 53.7,68.9 54.5,68.8 53.5,68.2 54.7,68.1 58.8,68.9 59.9,68.3 61.1,68.9 60,69.5 60.6,69.9 63.5,69.5 68.5,68.1 69.2,68.6 68.1,69.4 66.9,69.5 67.3,69.9 66.7,71 68.5,71.9 69.2,72.8 72.6,72.8 72.8,72.2 71.8,71.4 72.8,70.4 72.6,69 73.7,68.4 71.3,66.3 72.4,66.2 75.1,67.8 74.5,68.3 74.9,69 73.8,69.1 73.6,69.6 74.4,70.6 73.1,71.4 74.9,72.1 74.7,72.8 75.2,72.9 75.7,72.3 75.3,71.3 76.4,71.2 75.9,71.9 77.6,72.3 79.7,72.3 81.5,71.7 80.6,72.6 80.5,73.6 86.8,73.9 86,74.5 87.2,75.1 93.2,76 96.7,75.9 100.8,76.4 102,77.3 104.4,77.7 106.1,77.4 104.7,77.1 107,77 107.2,76.5 111.1,76.7 114.1,75.8 113.9,75.3 109.4,74.2 113,74 113.5,73.3 115.6,73.8 118.8,73.6 119,73.1 123.2,73 123.3,73.7 127,73.6 128.6,73 129.1,72.4 128.5,72 131.3,70.8 132.3,71.8 133.9,71.4 139.9,71.5 139.1,72.4 140.5,72.8 149.5,72.2 153,70.8 159,70.9 159.8,70.5 159.7,69.7 160.9,69.4 167.8,69.6 169.6,68.7 170.8,69 170,69.7 170.5,70.1 178.6,69.4 -180,69|49.1,41.3 50.4,40.3 49.6,40.2 48.9,38.8 49.2,37.6 50.8,36.9 53.8,37 53.9,39 53.1,39.3 53.4,40 52.7,40 52.9,40.9 53.9,40.6 54.7,41 53.7,42.1 52.9,41.9 52.8,41.1 52.5,42.8 51.3,43.1 50.3,44.6 51.3,44.5 51.3,45.2 53,45.3 53,46.9 51.2,47 49.1,46.4 46.7,44.6 47.6,43.7 47.5,43 49.1,41.3|-95.6,69.1 -96.3,68.8 -99.8,69.4 -98.2,70.1 -95.6,69.1|-180,71.5 180,70.8 178.9,70.8 178.7,71.1 -180,71.5|-90.5,69.5 -90.5,68.5 -89.2,69.3 -88,68.6 -88.3,67.9 -87.3,67.2 -85.6,68.8 -85.5,69.9 -82.6,69.7 -81.3,69.2 -81.2,68.7 -82,68.1 -81.3,67.6 -81.4,67.1 -83.3,66.4 -85.8,66.6 -87.3,64.8 -88.5,64.1 -89.9,64 -90.7,63.6 -90.8,63 -91.9,62.8 -93.2,62 -94.2,60.9 -94.7,58.9 -93.2,58.8 -92.3,57.1 -90.9,57.3 -85,55.3 -82.3,55.1 -82.1,53.3 -81.4,52.2 -79.9,51.2 -79.1,51.5 -78.6,52.6 -79.1,54.1 -79.8,54.7 -78.2,55.1 -76.5,56.5 -77.3,58.1 -78.5,58.8 -77.3,59.9 -78.1,62.3 -73.8,62.4 -71.4,61.1 -69.6,61.1 -69.3,59 -67.7,58.2 -66.2,58.8 -64.6,60.3 -61.4,57 -61.8,56.3 -59.6,55.2 -57.3,54.6 -56.9,53.8 -55.8,53.3 -55.7,52.1 -60,50.2 -66.4,50.2 -68.5,49.1 -71.1,46.8 -70.3,47 -68.7,48.3 -66.6,49.1 -65.1,49.2 -64.2,48.7 -65.1,48.1 -64.5,46.2 -63.2,45.7 -61.5,45.9 -60.5,47 -60.5,46.3 -59.8,45.9 -65.4,43.5 -66.1,43.6 -66.2,44.5 -64.4,45.3 -67.1,45.1 -67,44.8 -70.1,43.7 -70.7,43 -70.8,42.3 -70.5,41.8 -70.1,41.8 -70.2,42.1 -69.9,41.9 -70,41.6 -73.7,40.9 -71.9,40.9 -74,40.8 -74.2,39.7 -74.9,38.9 -75.5,39.5 -75.1,38.4 -75.9,37.2 -75.7,37.9 -76.2,38.3 -76.4,39.1 -76.3,38.1 -77,38.2 -76.3,37.9 -75.7,35.6 -76.4,34.8 -79.1,33.5 -81.3,31.4 -81.3,30 -80.1,26.9 -80.4,25.2 -81.2,25.2 -81.7,25.9 -82.9,27.9 -82.9,29.1 -84.1,30.1 -85.1,29.6 -86.4,30.4 -89.2,30.3 -89.6,30.2 -89.2,29.3 -90.2,29.1 -91.6,29.7 -93.8,29.7 -96.6,28.3 -97.4,27.4 -97.1,25.9 -97.9,22.4 -96.3,19.3 -94.4,18.1 -92,18.7 -90.8,19.3 -90.3,21 -87.1,21.5 -86.8,20.8 -87.6,19.6 -87.8,18.3 -88.3,18.5 -88.4,16.5 -88.9,15.9 -85,16 -83.4,15.3 -83.2,14.3 -83.8,11.1 -82.2,9 -81.4,8.8 -79.6,9.6 -76.8,8.6 -75.7,9.4 -75.5,10.6 -74.9,11.1 -73.4,11.2 -71.8,12.4 -71.1,12.1 -71.4,11.5 -71.9,11.4 -71.6,10.4 -72.1,9.9 -71.7,9.1 -71.3,9.1 -71,9.9 -71.4,11 -70.2,11.4 -70.3,11.8 -69.9,12.2 -69.6,11.5 -68.9,11.4 -68.2,10.6 -66.2,10.6 -64.9,10.1 -64.3,10.6 -61.9,10.7 -62.7,10.4 -62.4,9.9 -60.8,9.4 -60.7,8.6 -59.1,8 -58.5,6.8 -57.1,6 -54,5.8 -51.3,4.2 -50.5,1.9 -50,1.7 -49.9,1 -50.7,0.2 -50.4,-0.1 -48.6,-0.2 -48.6,-1.2 -47.8,-0.6 -44.9,-1.6 -44.4,-2.1 -44.6,-2.7 -43.4,-2.4 -40,-2.9 -37.2,-4.8 -35.6,-5.1 -34.7,-7.3 -35.1,-9 -38.7,-13.1 -39.3,-17.9 -40.9,-21.9 -41.8,-22.4 -42,-23 -44.6,-23.4 -47.6,-24.9 -48.5,-25.9 -48.9,-28.7 -53.8,-34.4 -54.9,-35 -56.2,-34.9 -57.8,-34.5 -58.4,-33.9 -58.5,-34.4 -57.2,-35.3 -57.4,-36 -56.7,-36.4 -56.8,-36.9 -57.7,-38.2 -59.2,-38.7 -62.3,-38.8 -62.1,-40.7 -62.7,-41 -63.8,-41.2 -64.7,-40.8 -65.1,-41.1 -65,-42.1 -64.3,-42.4 -63.8,-42 -63.5,-42.6 -65.2,-43.5 -65.6,-45 -66.5,-45 -67.3,-45.6 -67.6,-46.3 -65.6,-47.2 -66,-48.1 -67.2,-48.7 -67.8,-49.9 -69.1,-50.7 -68.8,-51.8 -68.2,-52.4 -69.5,-52.3 -70.8,-52.9 -71,-53.8 -72.6,-53.5 -74.9,-52.3 -75.6,-48.7 -75.2,-47.7 -74.1,-46.9 -75.6,-46.6 -74.7,-45.8 -74.4,-44.1 -73.2,-44.5 -72.7,-42.4 -73.4,-42.1 -73.7,-43.4 -74.3,-43.2 -73.7,-39.9 -73.2,-39.3 -73.6,-37.2 -73.2,-37.1 -71.4,-32.4 -71.5,-28.9 -70.9,-27.6 -70.2,-19.8 -70.4,-18.3 -71.5,-17.4 -76,-14.6 -76.3,-13.5 -79.8,-7.2 -81.3,-6.1 -80.9,-5.7 -81.4,-4.7 -79.8,-2.7 -80,-2.2 -80.4,-2.7 -81,-2.2 -80.9,-1.1 -80.6,-0.9 -80.1,0.8 -78.9,1.4 -78.4,2.6 -77.9,2.7 -77.1,3.8 -77.5,4.1 -77.5,6.7 -78.2,7.5 -78.2,8.3 -79.6,8.9 -80.5,8.1 -80,7.5 -80.9,7.2 -81.1,7.8 -83.5,8.4 -83.6,9.1 -85,10.1 -85.1,9.6 -85.7,9.9 -85.7,11.1 -87.7,12.9 -87.3,13 -87.5,13.3 -88.5,13.2 -91.2,13.9 -94.7,16.2 -96.6,15.7 -103.5,18.3 -105.5,19.9 -105.7,20.4 -105.4,20.5 -105.3,21.4 -106,22.8 -108.4,25.2 -109.3,25.6 -109.3,26.4 -112.2,29 -113.1,31.2 -113.9,31.6 -114.8,31.8 -114.7,30.2 -111.6,26.7 -110.7,24.3 -110.2,24.3 -109.4,23.4 -110,22.8 -110.3,23.4 -112.2,24.7 -112.3,26 -115.1,27.7 -114.6,27.7 -114.2,28.6 -115.5,29.6 -117.3,33 -118.5,34 -120.6,34.6 -124.4,40.3 -124.2,42 -124.5,42.8 -123.9,45.5 -124.7,48.2 -123.1,48 -122.6,47.1 -122.3,47.4 -122.8,49 -125.6,50.4 -127.4,50.8 -128,51.7 -127.8,52.3 -129.1,52.8 -129.3,53.6 -130.5,54.3 -130.5,54.8 -132,55.5 -132.2,56.4 -133.5,57.2 -134.1,58.1 -136.6,58.2 -139.9,59.5 -144,60 -147.1,60.9 -148.2,60.7 -148,60 -151.7,59.2 -151.9,59.7 -151.4,60.7 -150.3,61 -150.6,61.3 -154,59.4 -153.3,58.9 -154.2,58.1 -156.3,57.4 -158.4,56 -164.8,54.4 -161.8,55.9 -160.6,56 -157.7,57.6 -157,58.9 -159.1,58.4 -159.7,58.9 -160,58.6 -160.4,59.1 -162,58.7 -161.9,59.6 -162.5,60 -163.8,59.8 -165.3,60.5 -165.4,61.1 -166.1,61.5 -164.6,63.1 -163.1,63.1 -160.8,63.8 -161.5,64.4 -160.8,64.8 -162.8,64.3 -165,64.4 -166.4,64.7 -168.1,65.7 -164.5,66.6 -163.7,66.6 -163.8,66.1 -161.7,66.1 -165.4,68 -166.8,68.4 -166.2,68.9 -164.4,68.9 -163.2,69.4 -161.9,70.3 -156.6,71.4 -154.3,70.7 -143.6,70.2 -136.5,68.9 -134.4,69.6 -132.9,69.5 -129.8,70.2 -129.1,69.8 -128.1,70.5 -125.8,69.5 -124.4,70.2 -124.3,69.4 -121.5,69.8 -115.2,68.9 -113.9,68.4 -115.3,67.9 -109.9,68 -108.9,67.4 -107.8,67.9 -108.8,68.3 -108.2,68.7 -106.1,68.8 -104.3,68 -101.5,67.6 -98.4,67.8 -98.6,68.4 -97.7,68.6 -96.1,68.2 -96.1,67.3 -95.5,68.1 -94.7,68.1 -94.2,69.1 -96.5,70.1 -96.4,71.2 -95.2,71.9 -92.9,71.3 -91.5,70.2 -92.4,69.7 -90.5,69.5|-114.2,73.1 -114.7,72.7 -112.4,73 -111.1,72.5 -109.9,73 -109,72.6 -108.2,71.7 -107.7,72.1 -108.4,73.1 -106.5,73.1 -105.4,72.7 -104.5,71 -101,70 -101.1,69.6 -102.7,69.5 -102.1,69.1 -102.4,68.8 -106,69.2 -113.3,68.5 -113.9,69 -116.1,69.2 -117.3,70 -112.4,70.4 -117.9,70.5 -118.4,70.9 -116.1,71.3 -119.4,71.6 -117.9,72.7 -115.2,73.3 -114.2,73.1|-76.3,73.1 -76.3,72.8 -79.5,72.7 -80.9,73.3 -80.8,73.7 -80.4,73.8 -78.1,73.7 -76.3,73.1|-86.6,73.2 -85.8,72.5 -84.9,73.3 -82.3,73.8 -80.6,72.7 -80.8,72.1 -77.8,72.8 -74.2,71.8 -74.1,71.3 -72.2,71.6 -71.2,70.9 -67.9,70.1 -67,69.2 -68.8,68.7 -64.9,67.8 -63.4,66.9 -61.9,66.9 -62.2,66.2 -63.9,65 -66.7,66.4 -68,66.3 -68.1,65.7 -65.3,64.4 -64.7,63.4 -65,62.7 -68.8,63.7 -66.2,61.9 -71,62.9 -72.2,63.4 -71.9,63.7 -74.8,64.7 -74.8,64.4 -77.7,64.2 -78.6,64.6 -77.9,65.3 -74,65.5 -74.3,65.8 -72.7,67.3 -72.9,67.7 -76.9,68.9 -76.2,69.1 -79,70.2 -81.3,69.7 -88.7,70.4 -89.5,70.8 -88.5,71.2 -89.9,71.2 -90.2,72.2 -89.4,73.1 -88.4,73.5 -85.8,73.8 -86.6,73.2|-100.4,73.8 -97.4,73.8 -97.1,73.5 -98.1,73 -96.5,72.6 -96.7,71.7 -99.3,71.4 -102.5,72.5 -102.5,72.8 -100.4,72.7 -101.5,73.4 -100.4,73.8|-93.2,72.8 -94.3,72 -95.4,72.1 -96,73.4 -94.5,74.1 -90.5,73.9 -92,73 -93.2,72.8|-120.5,71.4 -123.1,70.9 -125.9,71.9 -123.9,73.7 -124.9,74.3 -117.6,74.2 -115.5,73.5 -119.2,72.5 -120.5,71.8 -120.5,71.4|150.7,75.1 149.6,74.7 146.1,75.2 146.4,75.5 150.7,75.1|-93.6,75 -94.2,74.6 -96.8,74.9 -94.9,75.6 -93.6,75|145.1,75.6 144.3,74.8 139,74.6 137,75.3 137.5,75.9 138.8,76.1 145.1,75.6|-98.5,76.7 -97.7,76.3 -98.2,75 -99.8,74.9 -100.9,75.1 -100.9,75.6 -102.5,75.6 -102.6,76.3 -98.5,76.7|-108.2,76.2 -107.8,75.8 -105.9,76 -105.7,75.5 -106.3,75 -113.7,74.4 -113.9,74.7 -111.8,75.2 -117.7,75.2 -115.4,76.5 -109.1,75.5 -110.5,76.4 -109.6,76.8 -108.6,76.7 -108.2,76.2|57.5,70.7 53.7,70.8 53.4,71.2 51.6,71.5 51.5,72 52.5,72.2 52.4,72.8 54.4,73.6 53.5,73.8 55.9,74.6 55.6,75.1 61.2,76.3 66.2,76.8 68.2,76.9 68.9,76.5 61.6,75.3 58.5,74.3 55.4,72.4 55.6,71.5 57.5,70.7|-94.7,77.1 -91.6,76.8 -90.7,76.5 -91,76.1 -89.2,75.6 -81.1,75.7 -79.8,74.9 -81.9,74.4 -88.1,74.4 -92.4,74.8 -92.9,75.9 -93.9,76.3 -97.1,76.8 -96.7,77.2 -94.7,77.1|-116.2,77.6 -116.3,76.9 -117.1,76.5 -121.5,75.9 -122.9,76.1 -119.1,77.5 -116.2,77.6|-110.2,77.7 -112.1,77.4 -113.5,77.7 -111.3,78.2 -109.9,78 -110.2,77.7|24.7,77.9 22.5,77.4 20.7,77.7 21.4,77.9 20.8,78.3 22.9,78.5 24.7,77.9|-95.8,78.1 -98.1,78.1 -98.6,78.9 -95.6,78.4 -95.8,78.1|-100.1,78.3 -99.7,77.9 -105.2,78.4 -104.2,78.7 -105.4,78.9 -105.5,79.3 -100.8,78.8 -100.1,78.3|105.1,78.3 99.4,77.9 101.3,79.2 102.1,79.3 105.4,78.7 105.1,78.3|18.3,79.7 21.5,79 19,78.6 18.5,77.8 17.6,77.6 17.1,76.8 15.9,76.8 13.8,77.4 14.7,77.7 11.2,78.9 10.4,79.7 13.2,80 13.7,79.7 15.1,79.7 15.5,80 17,80.1 18.3,79.7|25.4,80.4 27.4,80.1 25.9,79.5 23,79.4 20.1,79.6 17.4,80.3 22.9,80.7 25.4,80.4|51.1,80.5 47.6,80 46.5,80.2 47.1,80.6 44.8,80.6 48.3,80.8 48.5,80.5 50,80.9 51.5,80.7 51.1,80.5|99.9,78.9 95,79 93.3,79.4 92.5,80.1 91.2,80.3 95.9,81.3 100.2,79.8 99.9,78.9|-87,79.7 -85.8,79.3 -89,78.3 -90.8,78.2 -92.9,78.3 -94,78.8 -93.9,79.1 -93.1,79.4 -95,79.4 -96.7,80.2 -95.3,80.9 -94.3,81 -94.7,81.2 -92.4,81.3 -91.1,80.7 -87.8,80.3 -87,79.7|-68.5,83.1 -63.7,82.9 -61.9,82.6 -61.9,82.4 -67.7,81.5 -65.5,81.5 -69.5,80.6 -71.2,79.8 -76.9,79.3 -75.5,79.2 -76.2,79 -75.4,78.5 -79.8,77.2 -77.9,76.8 -80.6,76.2 -89.5,76.5 -89.6,77 -87.8,77.2 -88.3,77.9 -85,77.5 -86.3,78.2 -88,78.4 -85.1,79.3 -86.5,79.7 -86.9,80.3 -83.4,80.1 -81.8,80.5 -87.6,80.5 -89.4,80.9 -91.6,81.9 -85.5,82.7 -83.2,82.3 -82.4,82.9 -79.3,83.1 -68.5,83.1|-27.1,83.5 -20.8,82.7 -22.7,82.3 -31.4,82 -24.8,81.8 -22.9,82.1 -22.1,81.7 -23.2,81.2 -15.8,81.9 -12.8,81.7 -12.2,81.3 -16.8,80.3 -20,80.2 -17.7,80.1 -19.7,78.8 -19.7,77.6 -18.5,77 -21.7,76.6 -19.8,76.1 -19.6,75.2 -20.7,75.2 -19.4,74.3 -21.6,74.2 -20.4,73.8 -20.8,73.5 -23.6,73.3 -22.3,72.6 -22.3,72.2 -24.3,72.6 -24.8,72.3 -22.1,71.5 -21.8,70.7 -23.5,70.5 -25.5,71.4 -25.2,70.8 -26.4,70.2 -22.3,70.1 -27.7,68.5 -31.8,68.1 -34.2,66.7 -39.8,65.5 -40.7,64.8 -41.2,63.5 -42.8,62.7 -42.4,61.9 -43.4,60.1 -44.8,60 -46.3,60.9 -48.3,60.9 -51.6,63.6 -52.3,65.2 -53.7,66.1 -53.3,66.8 -54,67.2 -53,68.4 -51.5,68.7 -50.9,69.9 -53.5,69.3 -54.7,69.6 -54.4,70.8 -51.4,70.6 -54,71.5 -55.8,71.7 -54.7,72.6 -57.3,74.7 -58.6,75.1 -58.6,75.5 -61.3,76.1 -68.5,76.1 -71.4,77 -66.8,77.4 -73.3,78 -73.2,78.4 -65.7,79.4 -65.3,79.8 -68,80.1 -62.2,81.3 -62.6,81.8 -57.2,82.2 -53,81.9 -50.4,82.4 -44.5,81.7 -46.9,82.2 -46.8,82.6 -43.4,83.2 -35.1,83.6 -27.1,83.5');
const D2R=Math.PI/180;

/* ---- where the camera is ----
   HOME is the fleet's own centroid, so the portal opens looking straight at the
   sites rather than at a globe you then have to hunt across. LAM/PHI are where
   the camera IS, tLAM/tPHI where it is going; every movement on this screen is
   an ease between the two, which is what stops a drag or a keyboard jump from
   teleporting. */
let LAM=0, PHI=0, tLAM=0, tPHI=0, sinP=0, cosP=1;
const HOME={lam:0,phi:0};
(function(){
  let a=0,b=0;
  PLANTS.forEach(function(p){ a+=p.lng; b+=p.lat; });
  HOME.lam=a/PLANTS.length; HOME.phi=b/PLANTS.length;
  LAM=tLAM=HOME.lam; PHI=tPHI=HOME.phi;
})();
function setPhi(v){ PHI=Math.max(-78,Math.min(78,v)); sinP=Math.sin(PHI*D2R); cosP=Math.cos(PHI*D2R); }
setPhi(PHI);

/* The bar and the strip float ON the field rather than cropping it, so the
   canvas is the whole window and these two numbers are the only place that
   knows where the FREE part of it starts and ends. Everything that has to stay
   clear of them - the globe's centre, its radius, the card columns - is derived
   from these and from nothing else. */
const HUD_H=62, SUM_H=74;

function size(){
  const r=oc.parentElement.getBoundingClientRect();
  W=r.width; H=r.height;
  const dpr=window.devicePixelRatio||1;
  oc.width=W*dpr; oc.height=H*dpr;
  oc.style.width=W+'px'; oc.style.height=H+'px';
  ox.setTransform(dpr,0,0,dpr,0,0);
  /* the photograph layer is sized in the same breath as the instrument layer,
     because two canvases that disagree about their pixel ratio disagree about
     where the equator is */
  if(typeof ec!=='undefined'&&ec){ ec.width=W*dpr; ec.height=H*dpr;
    ec.style.width=W+'px'; ec.style.height=H+'px'; }
  CX=W/2;
  /* centred on what is LEFT, not on the window: a globe centred on the window
     sits low, because the strip at the foot is taller than the bar at the head */
  CY=(HUD_H + (H-SUM_H))/2;
  /* The globe is NOT sized to fill the box. The readouts stand outside it in
     two fixed columns and need a clear channel to stand in: a card, its margin
     and enough leader to read as a leader is about 300px a side. Sizing the
     sphere to the box and letting the cards fall where they may is how you get
     a picker with its own numbers lying across the world. */
  R0=Math.max(120, Math.min((W-600)/2, (H-HUD_H-SUM_H-120)/2));
  R=R0*ZOOM;
}

/* ---- the projection ----
   Orthographic: the view from far enough away that the sphere reads as a
   sphere. cosc is the cosine of the angular distance from the centre of the
   view, so it is positive exactly when a point is on the side of the world
   facing us - one number that both projects a point and answers "can this be
   seen from here". */
function proj(lng,lat){
  const dl=(lng-LAM)*D2R, la=lat*D2R;
  const cl=Math.cos(la), sl=Math.sin(la), cd=Math.cos(dl);
  return { x: CX + R*cl*Math.sin(dl),
           y: CY - R*(cosP*sl - sinP*cl*cd),
           c: sinP*sl + cosP*cl*cd };
}

/* ---- where the sun is, actually ----
   The subsolar point: the one spot on Earth with the sun straight overhead.
   Standard low-precision solar position - good to a fraction of a degree, which
   at this scale is a fraction of a pixel, and far better than the hour the
   terminator would have to be wrong by before anyone could notice.

   This is the only thing on the screen that is neither site data nor
   cartography, and it is here because for a solar fleet it IS the weather. */
function subsolar(when){
  const n=when/86400000 + 2440587.5 - 2451545.0;      /* days from J2000 */
  const L=(280.460 + 0.9856474*n)*D2R;                 /* mean longitude  */
  const g=(357.528 + 0.9856003*n)*D2R;                 /* mean anomaly    */
  const lam=L + (1.915*Math.sin(g) + 0.020*Math.sin(2*g))*D2R;
  const eps=(23.439 - 0.0000004*n)*D2R;                /* obliquity       */
  const dec=Math.asin(Math.sin(eps)*Math.sin(lam));
  const ra=Math.atan2(Math.cos(eps)*Math.sin(lam), Math.cos(lam));
  const gmst=(18.697374558 + 24.06570982441908*n)%24;  /* sidereal, hours */
  let lng=ra/D2R - gmst*15;
  lng=((lng+180)%360+360)%360-180;
  return {lat:dec/D2R, lng:lng};
}
/* the sun as the CAMERA sees it: x right, y up, z towards the viewer. z>0 means
   the sun is on our side of the world, which is what decides whether the night
   we draw is a sliver at the edge or most of the disc. */
/* ?sun=H shifts the sun H hours from now, and nothing else. It exists because
   the terminator is the feature and you cannot review a feature by waiting
   eleven hours for it: ?sun=-7 is the fleet at dawn, ?sun=6 is the fleet after
   dark. It moves the SUN only - the output figures still come from the real
   clock, so the page never quietly pretends to be a different time of day than
   the numbers it is printing. */
const SUNSHIFT=(function(){
  const v=parseFloat(new URLSearchParams(location.search).get('sun')||'0');
  return isFinite(v)?v*3600000:0;
})();
/* ================= IS IT DAY AT THIS SITE? =================
   The terminator draws the line; this answers the question the line raises,
   which is the one an operator actually has: is the sun up AT SANGRIA, right
   now. cosz is the cosine of the solar zenith angle - the angular distance from
   the subsolar point - so it is positive exactly while the sun is above that
   site's horizon and it crosses zero at sunrise and sunset.

   This is why a fleet reading 0 kW at 03:00 is not a fault, and it is the
   difference between a picker and a picture. */
/* The cosine of the solar zenith angle: 1 with the sun straight overhead, 0 on
   the horizon, negative once it has set. The site markers want the sign of it -
   is the sun up at Sangria, yes or no - and the city lights want the VALUE,
   because a city does not switch on at the terminator, it comes up through
   dusk. One formula, two readers, so a dot and a light can never disagree about
   what time it is where they are standing. */
function sunCos(lat,lng,sub){
  const la=lat*D2R, lo=lng*D2R, sa=sub.lat*D2R, so=sub.lng*D2R;
  return Math.sin(la)*Math.sin(sa)+Math.cos(la)*Math.cos(sa)*Math.cos(lo-so);
}
function sunUpAt(p,sub){ return sunCos(p.lat,p.lng,sub) > 0; }

function sunView(){
  const s=subsolar(Date.now()+SUNSHIFT);
  const la=s.lat*D2R, dl=(s.lng-LAM)*D2R;
  const cl=Math.cos(la), sl=Math.sin(la), cd=Math.cos(dl);
  return { x: cl*Math.sin(dl),
           y: cosP*sl - sinP*cl*cd,
           z: sinP*sl + cosP*cl*cd, at:s };
}

/* ================= WHERE A STAR IS, ON THIS SCREEN =================
   The sky was wallpaper. Every star was stored as a fraction of the WINDOW, so
   turning the world spun the planet under a field that never moved - which is
   the background disagreeing with the subject, the one thing this screen may
   not do. Dragging orbits the camera around a fixed Earth; from an orbit, the
   sky sweeps.

   So the deep field gets the treatment the sun already had: a real place on a
   real sphere, projected through the same camera as the globe. The centre of
   the screen is the ANTI-CAMERA direction - straight through the middle of the
   planet and out the far side - and a star's angular distance from that point
   is its distance from the centre in pixels. That is the sun's own projection
   with a different constant, which is exactly the point: the sun and the stars
   sit on the same sphere, so they have to travel at the same rate. If they did
   not, one of them would be lying.

   SKYK is set so that ninety degrees off the anti-camera axis lands at the
   corner of the frame. Anything past that is round behind the reader, and is
   dropped rather than folded back into the picture.

   The result is returned UNLENSED. drawSpace bends it afterwards with warp(),
   the same gravity the grid is bent by, because a star near the limb is being
   seen past a planet and this file already knows what that looks like. */
let SKYK=540;
function skyXY(lng,lat){
  const la=lat*D2R, dl=(lng-LAM)*D2R;
  const cl=Math.cos(la), sl=Math.sin(la), cd=Math.cos(dl);
  const x=cl*Math.sin(dl),
        y=cosP*sl - sinP*cl*cd,
        z=sinP*sl + cosP*cl*cd;
  /* beta from the point directly behind the planet, which is where -z points */
  const b=Math.acos(Math.max(-1,Math.min(1,-z)));
  if(b>1.75) return null;
  const t=Math.hypot(x,y);
  if(t<1e-6) return [CX,CY];
  const r=SKYK*b;
  return [CX + (x/t)*r, CY - (y/t)*r];
}

/* The nebula projection went with the nebulae - see body's background. The sky
   is a texture on the celestial sphere now and the shader places it, so there is
   nothing left here for JavaScript to position. */

/* ================= THE EARTH, PHOTOGRAPHED =================
   The globe was drawn from vectors: a blue disc, coastlines, a graticule. It was
   honest and it was clearly a diagram. What was asked for instead was the thing
   an iPhone puts on its lock screen - a real planet - and there is no API for
   that; Apple's is a private asset. What there IS, and what this uses, is the
   imagery that sort of picture is made from in the first place: NASA's Blue
   Marble, which is public domain.

   TWO PLATES, AND THE SECOND ONE IS THE POINT.
   DAY is NASA Blue Marble - land, topography, bathymetry - with the Blue Marble
   cloud layer composited over it.
   NIGHT is NASA BLACK MARBLE 2016: the real VIIRS Day/Night Band composite off
   Suomi NPP, fetched at 13500x6750 and reduced here. It is a PHOTOGRAPH OF
   WHERE THE POWER IS, which is the one subject this portal is actually about -
   the Ganges plain, the Nile, the Rhine-Ruhr, the Java corridor, and the dark
   in between.

   The reduction is done in LINEAR light, not sRGB. A city is a handful of very
   bright pixels surrounded by black, and averaging those down in gamma space
   throws most of their energy away - the naive resize gives a dim brown smear
   where India should be. Resampling in linear light conserves the flux. A power
   curve then separates the two things in the plate that do not belong together:
   cities are bright points, moonlit terrain is a broad dim wash, and the curve
   costs the wash far more than it costs the points.

   Both are 2048x1024: 2:1 because the plate is equirectangular, and a power of
   two because WebGL 1 will only REPEAT at those sizes - and it has to repeat,
   since longitude wraps at the antimeridian and a clamped texture puts a seam
   down the Pacific.

   WHY THE GPU. Painting a sphere from an equirectangular map is a per-pixel
   inverse projection - for every pixel, work out which point on the ball it is
   and which pixel of the photograph that is. At this size that is roughly a
   quarter of a million lookups a frame, which is nothing for a fragment shader
   and hopeless in JavaScript. The whole sphere is one triangle and one shader;
   there is no mesh, because a sphere seen orthographically is just a circle with
   z = sqrt(1 - x^2 - y^2), and that is cheaper to solve than to tessellate.

   THE PROJECTION IS SHARED. The shader is handed the same camera basis the 2D
   layer projects with, so a marker drawn by canvas and the coastline drawn by
   the GPU land on the same pixel. If these ever drift apart the site markers
   float off their countries, which is why the basis is computed once, here, and
   passed to both rather than derived twice. */
const TEX_DAY='/textures/day.jpg';
const TEX_SKY='/textures/sky.jpg';
const TEX_REGION='/textures/region.jpg';
/* THE FLEET'S OWN GROUND, at 14 degrees by 12 - NASA GIBS Blue Marble shaded
   relief and bathymetry over lng 66..80, lat 22..34. The global plate is
   about 400 m to the pixel, which is a planet but not a place; this one is
   nearer 60 m, and it is what the descent actually arrives at. Change these
   four numbers and the box moves - nothing else knows where it is. */
const REGION=[66,22,80,34];
const TEX_NIGHT='/textures/night.jpg';

const ec=$('earth');
const gl=(function(){
  try{ return ec.getContext('webgl',{alpha:true,premultipliedAlpha:false,antialias:false})
              || ec.getContext('experimental-webgl',{alpha:true,premultipliedAlpha:false}); }
  catch(e){ return null; }
})();
/* If there is no WebGL there is still a globe: the vector one this replaced is
   kept below and drawn instead. A picker that shows nothing on an old machine is
   worse than a picker that shows a diagram. */
const GL_OK=!!gl;
let texReady=false, prog=null, uni={};

const VERT=
  'attribute vec2 a;'+
  'void main(){ gl_Position=vec4(a,0.0,1.0); }';

/* r is the distance from the centre of the disc in radii, so r<=1 is the ball
   and everything past it is air. z is the height of the sphere above the screen
   at that point - the only piece of 3D in the entire shader. */
const FRAG=
  'precision highp float;'+
  'uniform vec2 uRes; uniform vec2 uC; uniform float uR;'+
  'uniform vec3 uE, uN, uV, uSun;'+
  'uniform sampler2D uDay, uNight, uSky, uRegion;'+
  'uniform vec4 uRegBox;'+
  'uniform float uRegMix, uSkyK, uSkySpin;'+
  'const float PI=3.141592653589793;'+
  'void main(){'+
  '  vec2 p=vec2(gl_FragCoord.x, uRes.y-gl_FragCoord.y);'+   /* to y-down pixels */
  '  vec2 d=(p-uC)/uR;'+
  '  float r=length(d);'+
  /* one pixel, expressed in radii - the width the edge is feathered over, so the
     limb is smooth at every zoom instead of stair-stepping */
  '  float px=1.4/uR;'+
  '  float inside=1.0-smoothstep(1.0-px,1.0+px,r);'+
  '  float z=sqrt(max(0.0,1.0-min(r,1.0)*min(r,1.0)));'+
  '  vec3 P=d.x*uE+(-d.y)*uN+z*uV;'+
  '  float lat=asin(clamp(P.z,-1.0,1.0));'+
  '  float lng=atan(P.y,P.x);'+
  '  vec2 uv=vec2(lng/(2.0*PI)+0.5, 0.5-lat/PI);'+
  '  float cosz=dot(P,uSun);'+
  /* ---- THE GROUND, AND THE PLATE THE DESCENT SWAPS IN ----
     The global plate is one photograph of a whole planet: magnificent at arm's
     length, four hundred metres to the pixel up close. So the fleet's own
     ground rides in a second plate, and it cross-fades in as you come down.
     The edge is feathered rather than cut, because a rectangle of sharper
     ground appearing over a blurrier planet is a window, and a window is the
     one thing that would give the descent away. */
  '  vec3 dayC=texture2D(uDay,uv).rgb;'+
  '  vec2 g=vec2(degrees(lng),degrees(lat));'+
  '  vec2 ruv=vec2((g.x-uRegBox.x)/(uRegBox.z-uRegBox.x),'+
  '                (uRegBox.w-g.y)/(uRegBox.w-uRegBox.y));'+
  '  float edge=smoothstep(0.0,0.06,ruv.x)*smoothstep(1.0,0.94,ruv.x)'+
  '            *smoothstep(0.0,0.06,ruv.y)*smoothstep(1.0,0.94,ruv.y);'+
  '  dayC=mix(dayC,texture2D(uRegion,ruv).rgb,clamp(uRegMix,0.0,1.0)*edge);'+
  /* the lit face. Lambert, gamma-softened so the tropics do not blow out, over
     an ambient floor that keeps the dark side a place rather than a hole */
  '  float lam=max(cosz,0.0);'+
  '  vec3 earth=dayC*(0.055+1.06*pow(lam,0.60));'+
  /* THE CITIES, coming up THROUGH dusk - a city does not switch on at the
     terminator, it fades in as the sky goes out. NASA Black Marble. */
  '  vec3 ntC=texture2D(uNight,uv).rgb;'+
  '  float nAmt=smoothstep(0.12,-0.10,cosz);'+
  '  earth+=ntC*nAmt*1.32;'+
  /* dawn and dusk ON the surface: sunlight through a very long slant of air */
  '  float tw=exp(-(cosz*cosz)/0.0105);'+
  '  earth+=vec3(1.00,0.42,0.15)*tw*0.115;'+
  '  earth*=mix(1.06,0.74,smoothstep(0.62,1.0,r));'+
  /* the air seen edge-on, and only where the sun is on it */
  '  float rimLit=smoothstep(-0.30,0.30,cosz);'+
  '  earth+=vec3(0.40,0.62,0.95)*smoothstep(0.86,1.0,r)*0.55*rimLit;'+
  /* AIRGLOW. The thin luminous band hugging the NIGHT limb - oxygen recombining
     around 90km up. It is in every photograph ever taken from the station, and
     without it a night limb just stops. */
  '  float ag=smoothstep(0.88,1.0,r)*smoothstep(0.22,-0.18,cosz);'+
  '  earth+=vec3(0.16,0.86,0.60)*ag*0.34;'+
  /* ---- the halo, a crescent because the air is only lit where the sun is ---- */
  '  vec2 dn=d/max(r,1e-4);'+
  '  vec3 Pl=dn.x*uE+(-dn.y)*uN;'+
  '  float cl=dot(Pl,uSun);'+
  '  float atmo=smoothstep(1.30,1.0,r);'+
  '  atmo=atmo*atmo*0.58;'+
  '  atmo*=0.10+0.90*smoothstep(-0.55,0.35,cl);'+
  '  float sunset=exp(-(cl*cl)/0.075);'+
  '  vec3 air=mix(vec3(0.46,0.70,1.0),vec3(1.00,0.50,0.20),sunset*0.60);'+
  /* ---- AND BEHIND ALL OF IT, THE REAL SKY ----
     NASA Deep Star Maps 2020: the actual Milky Way, its dust lanes, and both
     Magellanic Clouds. The screen point is turned back into a direction on the
     celestial sphere - the same projection the catalogue stars are drawn with,
     so the band and the points can never disagree - and uSkySpin carries
     sidereal time, which is what puts the galaxy in the right place for the
     hour rather than merely somewhere. */
  '  vec2 sd=(p-uC)/uSkyK;'+
  '  float b=length(sd);'+
  '  vec3 tang=(b>1e-5)?normalize(sd.x*uE+(-sd.y)*uN):uE;'+
  '  vec3 dir=(-uV)*cos(b)+tang*sin(b);'+
  '  float slat=asin(clamp(dir.z,-1.0,1.0));'+
  '  float slng=atan(dir.y,dir.x)+uSkySpin;'+
  '  vec3 skyC=texture2D(uSky,vec2(slng/(2.0*PI)+0.5,0.5-slat/PI)).rgb;'+
  '  float skyA=clamp(max(max(skyC.r,skyC.g),skyC.b)*2.6,0.0,1.0);'+
  /* source-over, bottom up: sky, then air, then ball */
  '  vec3 pre=earth*inside+air*atmo*(1.0-inside);'+
  '  float al=inside+atmo*(1.0-inside);'+
  '  pre+=skyC*skyA*(1.0-al);'+
  '  al+=skyA*(1.0-al);'+
  '  if(al>0.001) pre/=al;'+                                 /* un-premultiply */
  '  gl_FragColor=vec4(pre,al);'+
  '}';


if(GL_OK){
  const sh=function(t,src){
    const o=gl.createShader(t); gl.shaderSource(o,src); gl.compileShader(o);
    if(!gl.getShaderParameter(o,gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(o));
    return o;
  };
  try{
    prog=gl.createProgram();
    gl.attachShader(prog,sh(gl.VERTEX_SHADER,VERT));
    gl.attachShader(prog,sh(gl.FRAGMENT_SHADER,FRAG));
    gl.linkProgram(prog);
    if(!gl.getProgramParameter(prog,gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
    gl.useProgram(prog);

    /* one triangle covering the viewport, not two making a quad: the shared
       diagonal of a quad is a seam the rasteriser has to think about twice */
    const buf=gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER,buf);
    gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1, 3,-1, -1,3]),gl.STATIC_DRAW);
    const loc=gl.getAttribLocation(prog,'a');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc,2,gl.FLOAT,false,0,0);

    ['uRes','uC','uR','uE','uN','uV','uSun','uDay','uNight','uSky','uRegion',
     'uRegBox','uRegMix','uSkyK','uSkySpin'].forEach(function(n){
      uni[n]=gl.getUniformLocation(prog,n);
    });

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);
    gl.clearColor(0,0,0,0);

    /* Both plates share one upload path and one arrival latch: the shader
       samples them in the same instruction stream, so a frame drawn with only
       one of them up would be a lit Earth with no cities on it, or cities
       floating on nothing. texReady goes true when the PAIR has landed. */
    const upload=function(tex,img,unit){
      gl.activeTexture(gl.TEXTURE0+unit);
      gl.bindTexture(gl.TEXTURE_2D,tex);
      /* the plate is stored with row 0 at the north pole, and the shader's v
         runs the same way, so the image is NOT flipped */
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false);
      gl.texImage2D(gl.TEXTURE_2D,0,gl.RGB,gl.RGB,gl.UNSIGNED_BYTE,img);
      /* REPEAT across longitude so the antimeridian has no seam; CLAMP down the
         poles, where there is nothing to wrap to. LINEAR without mipmaps: the
         wrap makes the texture coordinate jump by a whole turn at the seam, and
         a mip level chosen from that jump would blur one column to mush. */
      /* unit 3 is the regional inset: it is a rectangle of ground, not a globe,
         so it CLAMPS in both directions. Left on REPEAT it would tile its own
         west edge across the east one the moment the descent overshot it. */
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,unit===3?gl.CLAMP_TO_EDGE:gl.REPEAT);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
    };
    /* FOUR plates now, and the latch waits for all of them: the shader samples
       every one in the same instruction stream, so a frame drawn with three up
       is a frame with a hole in it. */
    const SRC=[TEX_DAY,TEX_NIGHT,TEX_SKY,TEX_REGION];
    const texes=SRC.map(function(){ return gl.createTexture(); });
    let up=0;
    const arrive=function(){
      if(++up<SRC.length) return;
      gl.uniform1i(uni.uDay,0); gl.uniform1i(uni.uNight,1);
      gl.uniform1i(uni.uSky,2); gl.uniform1i(uni.uRegion,3);
      gl.uniform4f(uni.uRegBox,REGION[0],REGION[1],REGION[2],REGION[3]);
      texReady=true;
      $('theatre').classList.add('photo');
    };
    SRC.forEach(function(s,i){
      const im=new Image();
      im.onload=function(){ upload(texes[i],im,i); arrive(); };
      im.src=s;
    });
  }catch(err){ prog=null; }
}

/* the camera basis, built once per frame and used by BOTH layers */
function basis(){
  const cl=Math.cos(LAM*D2R), sl=Math.sin(LAM*D2R);
  return {
    e:[-sl, cl, 0],
    n:[-sinP*cl, -sinP*sl, cosP],
    v:[ cosP*cl,  cosP*sl, sinP]
  };
}

function drawEarth(sub){
  if(!prog||!texReady) return false;
  const dpr=window.devicePixelRatio||1;
  gl.viewport(0,0,ec.width,ec.height);
  gl.clear(gl.COLOR_BUFFER_BIT);
  const b=basis();
  gl.uniform2f(uni.uRes,ec.width,ec.height);
  gl.uniform2f(uni.uC,CX*dpr,CY*dpr);
  gl.uniform1f(uni.uR,R*dpr);
  gl.uniform3fv(uni.uE,b.e);
  gl.uniform3fv(uni.uN,b.n);
  gl.uniform3fv(uni.uV,b.v);
  /* the sun as a direction in WORLD space, from the same subsolar point the
     rest of the screen is drawn from - so the shader's terminator, the site
     dots, the strip and the page's own daylight can never disagree */
  const sl=sub.lat*D2R, so=sub.lng*D2R, csl=Math.cos(sl);
  gl.uniform3f(uni.uSun, csl*Math.cos(so), csl*Math.sin(so), Math.sin(sl));
  gl.uniform1f(uni.uRegMix, REGMIX);
  gl.uniform1f(uni.uSkyK, SKYK*dpr);
  gl.uniform1f(uni.uSkySpin, gmstDeg()*D2R);
  gl.drawArrays(gl.TRIANGLES,0,3);
  return true;
}

/* A resize is the ONLY thing that moves a card, and it moves them by
   recomputing the columns from the new box - never by nudging them from where
   they were. */
size();
__on(window,'resize',function(){
  size(); place();
  if(ACT) placeCard(ACT);      /* the card is pinned to a row that just moved */
});

/* ---- turning the world ----
   Drag anywhere on the field. Vertical drag is clamped short of the poles,
   because an orthographic globe tipped past about eighty degrees stops reading
   as a globe and starts reading as a disc with a bent grid on it.

   Letting go does not strand you. After a few idle seconds the camera eases
   back HOME, to the fleet - this is a front door, and a front door you can get
   lost on is worse than one that does not turn at all. */
let drag=null, idle=0;

/* ================= TURNING THE WORLD =================
   The globe turns; the SITES do not move. Dragging a marker was tried and taken
   out again: a site that can be picked up is a site whose position is a
   suggestion, and the entire argument for putting this fleet on a globe was
   that position is a FACT. A picture you can rearrange is a picture that can be
   made to say the wrong thing, and the crowding it was solving is better solved
   by leaning in - which is what the zoom is for.

   travelled survives it, because the guard it feeds still matters: a drag that
   started on top of a marker must turn the world without also opening that
   site. */
let travelled=0;       /* how far the pointer moved since it went down  */

function localXY(e){
  const r=oc.getBoundingClientRect();
  return [e.clientX-r.left, e.clientY-r.top];
}
/* which site is under the pointer, if any. The radius is generous on purpose:
   these are small marks on a sphere you can also spin, and demanding pixel
   accuracy would make both gestures feel broken. */
function dotAt(mx,my){
  let best=null, bd=24;
  PLANTS.forEach(function(p){
    if(!p.vis) return;
    const d=Math.hypot(p.dx-mx,p.dy-my);
    if(d<bd){ bd=d; best=p; }
  });
  return best;
}
__on(oc,'pointerdown',function(e){
  travelled=0; idle=0;
  drag={x:e.clientX,y:e.clientY};
  try{ oc.setPointerCapture(e.pointerId); }catch(err){}
  oc.style.cursor='grabbing';
});

__on(oc,'pointermove',function(e){
  const xy=localXY(e);
  if(drag){
    /* the smaller the globe, the more degrees a pixel of drag is worth - so the
       surface moves under the finger at the same speed at every size */
    const k=0.26*(320/R);
    travelled+=Math.hypot(e.clientX-drag.x,e.clientY-drag.y);
    tLAM=LAM-(e.clientX-drag.x)*k;
    tPHI=Math.max(-78,Math.min(78,PHI+(e.clientY-drag.y)*k));
    drag={x:e.clientX,y:e.clientY}; idle=0; return;
  }
  /* over a site the pointer says "this opens something"; everywhere else the
     field says "this turns" */
  oc.style.cursor = dotAt(xy[0],xy[1]) ? 'pointer' : '';
});

function endDrag(){
  if(!drag) return;
  drag=null; oc.style.cursor=''; idle=0;
}
__on(oc,'pointerup',endDrag);
__on(oc,'pointercancel',endDrag);

/* the buttons and the wheel are the same motion - one function, three triggers */
function zoomBy(factor){
  tZOOM=Math.max(1,Math.min(MAXZ,tZOOM*factor));
  FLY=false; idle=0;
}

__on(oc,'wheel',function(e){
  e.preventDefault();
  zoomBy(Math.exp(-e.deltaY*0.0016));
},{passive:false});

(function(){
  const zi=$('zoomIn'), zo=$('zoomOut');
  if(zi) __on(zi,'click',function(){ zoomBy(1.5); });
  if(zo) __on(zo,'click',function(){ zoomBy(1/1.5); });
})();

/* ?zoom=N opens at a given magnification, the same way ?plants=N grows the
   portfolio - so a reviewer can look at the close view without having to
   describe a scroll gesture to whoever they are showing it to */
(function(){
  const z=parseFloat(new URLSearchParams(location.search).get('zoom')||'0');
  if(z>=1&&z<=MAXZ){ ZOOM=tZOOM=z; R=R0*ZOOM; }
})();

/* one card per site, built once. Every readout it will ever show is here from
   the start and is looked up ONCE - the paint runs sixty times a second, and a
   querySelector per field per site per frame is a cost paid for nothing. */
/* NOTHING ON THIS CARD IS A CONTROL.
   It was one <button> around the whole assembly once, so reading a number was a
   click away from leaving the screen - a pointer resting on REVENUE to check it
   was a pointer sitting on a control. That was cut back to the nameplate alone,
   and the nameplate has now gone the same way: a site is opened from the FLEET,
   and only from the fleet. See the note over .card .ch in the stylesheet for
   why one door beats two. The card is a table, and tables are for reading. */
const CARD=$('card'), ROWS=$('rows');
let ACT=null;                     /* the site the card is currently about */

/* THE CARD IS BUILT ONCE AND RE-POINTED, not rebuilt per site. One node, moved
   and refilled, so opening a site costs a few text writes rather than a parse. */
CARD.innerHTML=
  '<span class="ch">'+
    '<span class="nm"></span>'+
    '<span class="st"></span>'+
  '</span>'+
  /* NO PERCENTAGE HERE. The bar directly underneath already draws output
     against nameplate, and the figure said the same thing a second time in
     words - which is only ever noticed when it reads 0%, at night, on a site
     that is behaving perfectly. AC CAP is in the grid below for anyone who
     wants the denominator. */
  '<span class="rd"><span class="val"></span><span class="u">kW</span></span>'+
  '<span class="tr"><i></i></span>'+
  '<span class="gr">'+
    '<span class="c"><i>PEAK</i><b>—</b></span>'+
    '<span class="c"><i>TODAY</i><b class="gold">—</b></span>'+
    '<span class="c"><i>AC CAP</i><b>—</b></span>'+
    '<span class="c"><i>DC CAP</i><b>—</b></span>'+
    '<span class="c"><i>DEVICES</i><b>—</b></span>'+
    '<span class="c"><i>ALARMS</i><b>—</b></span>'+
  '</span>'+
  '<span class="site"><svg class="pin" viewBox="0 0 8 11" aria-hidden="true">'+
    '<path d="M4 0a4 4 0 0 0-4 4c0 3 4 7 4 7s4-4 4-7a4 4 0 0 0-4-4zm0 5.6A1.6 1.6 0 1 1 4 2.4a1.6 1.6 0 0 1 0 3.2z"/>'+
  '</svg><span class="ad"></span></span>';
const CQ=(function(){
  const q=s=>CARD.querySelector(s);
  const g=CARD.querySelectorAll('.gr b');
  return { nm:q('.nm'), st:q('.st'), val:q('.val'), u:q('.u'),
           fl:q('.tr i'), ad:q('.ad'),
           peak:g[0], e:g[1], ac:g[2], dc:g[3], dev:g[4], alm:g[5] };
})();

PLANTS.forEach(function(p,i){
  const b=document.createElement('button');
  b.className='rrow'; b.type='button';
  b.innerHTML='<span class="pip"></span><span class="nm"></span>'+
              '<span class="alm"></span><span class="kw"></span>'+
              '<svg class="go" viewBox="0 0 24 24" aria-hidden="true">'+
                '<path d="M8.5 4.5 16 12l-7.5 7.5"/></svg>';
  /* A CLICK ON A NAME OPENS THAT SITE, and it is the only gesture this rail
     takes. Reading is already free - the card follows the pointer down the list
     without being asked for anything - so the click was never needed for
     reading, and spending it on "hold this card still" spent the one gesture a
     reader has on the single thing nobody came to this screen to do. */
  __on(b,'click',function(){ open(p); });
  __on(b,'mouseenter',function(){ show(p); });
  __on(b,'focus',function(){ show(p); });
  ROWS.appendChild(b);
  p._i=i; p._row2=b;
  p._el={ nm:b.querySelector('.nm'), kw:b.querySelector('.kw'),
          alm:b.querySelector('.alm') };
  p._was={};
});
__on(ROWS,'mouseenter',holdOpen);
__on(ROWS,'mouseleave',armShut);
__on(CARD,'mouseenter',holdOpen);
__on(CARD,'mouseleave',armShut);

/* WHERE THE CARD SITS. Beside the row that asked for it, clamped so it can
   never hang off the top or the bottom of the window - a card half off the
   screen is a card that has stopped being one. */
function placeCard(p){
  const r=p._row2.getBoundingClientRect();
  const h=CARD.offsetHeight||300;
  const y=Math.max(88+h/2, Math.min(innerHeight-18-h/2, r.top+r.height/2));
  CARD.style.top=y+'px';
}

/* ---- READING IS FREE, AND OPENING COSTS ONE CLICK ----
   There are two gestures on this rail and there are only two:

     HOVER a name  the card opens on it. Reading down a fleet of fifty is one
                   pass of the pointer, no clicks and nothing to close.
     CLICK a name  the portal opens on that site. Same for Enter on a focused
                   row, because the row is a button and always was.

   PIN IS GONE. It existed so that a card could be travelled to without
   evaporating on the way - but the pointer's journey from the rail to the card
   is already covered by the grace below, which treats the two as one region and
   waits out the gap between them. So pinning was charging a click for something
   already given away, and charging it in the one currency a reader has: the
   gesture they meant to use to LEAVE. Every click on a name now leaves. */

function show(p){
  ACT=p; hot=p;
  fillCard(p); CARD.classList.add('on'); placeCard(p);
  PLANTS.forEach(function(q){ q._row2.classList.toggle('on',q===p); });
  $('theatre').classList.add('hot');
}
function shut(){
  clearTimeout(shutT);
  ACT=null;
  CARD.classList.remove('on');
  PLANTS.forEach(function(q){ q._row2.classList.remove('on'); });
  cool();
}

/* THE CROSSING. The card sits beside the rail with real space between them, and
   leaving the rail is exactly the gesture that reaches the card - so closing on
   mouseleave alone would shut it during the journey to it. The pair of them are
   treated as one region, and the wait covers the gap between. */
let shutT=null;
function armShut(){
  clearTimeout(shutT);
  shutT=__st(shut,260);
}
function holdOpen(){ clearTimeout(shutT); }

function fillCard(p){
  const st=stateOf(p), kw=outputOf(p), f=(st==='off'||!p.ac)?0:Math.min(1,kw/p.ac);
  CARD.className='card on'+(st==='ok'?'':' '+st);
  CQ.nm.textContent=p.id;
  CQ.st.textContent=STATE_TEXT[st];
  CQ.ad.textContent=p.addr;
  CQ.ac.textContent=fmtP(p.ac);
  CQ.dc.textContent=p.dc!=null?fmtP(p.dc).replace(' MW',' MWp').replace(' kW',' kWp'):'—';
  paintCard();
}

/* the moving half, called on the frame clock */
function paintCard(){
  const p=ACT; if(!p) return;
  const st=stateOf(p), kw=outputOf(p), f=(st==='off'||!p.ac)?0:Math.min(1,kw/p.ac);
  if(st==='off'){ CQ.val.textContent='OFFLINE'; CQ.u.style.display='none'; }
  else { CQ.val.textContent=num(kw); CQ.u.style.display=''; }
  CQ.fl.style.width=(f*100).toFixed(1)+'%';
  const t=peakAt(), pk=peakOf(p), nA=alarmsOf(p);
  CQ.peak.textContent = pk>0 ? fmtP(pk) : '—';
  CQ.e.textContent=fmtE(energyToday(p));
  CQ.dev.textContent=(p.dev-p.down)+' of '+p.dev;
  CQ.alm.textContent=nA?(nA+' OPEN'):'NONE';
  CQ.alm.className=p.crit?'crit':(nA?'warn':'none');
}

/* ONE CLICK OPENS, AND THE SECOND ONE IS NOT A SECOND ANSWER.
   A double click is not a gesture the browser hands over whole - it is two
   click events, and both of them used to reach here. The screen looked right,
   because the first click had already started leaving and the second one asked
   for the same place. What it cost was the way BACK: two assignments to
   location.href is two entries in the history, so a reader who double-clicked
   Sangria had to press Back twice to return to the fleet, and the first press
   appeared to do nothing at all.

   So leaving is a latch. The first click sets it and every click after it is
   ignored - not just the second half of a double click, but an impatient third,
   and a click on a DIFFERENT site landed during the moment the page is already
   on its way somewhere. The question this screen asks is answered once. */
let LEAVING=false;
function open(p){
  if(LEAVING) return;
  LEAVING=true;
  /* The portal opens ON the site that was clicked - the whole point of the
     screen - and STAYS on it. The query string carries the choice to Home; the
     remembered value carries it to every page after that, because the nav tabs
     are plain links and a site chosen here must not be forgotten the first time
     somebody clicks Monitoring.

     WRITTEN FIRST, BEFORE ANY OF THE MOTION BELOW. The choice is the only part
     of this function that MUST happen; the descent is the only part that can be
     skipped. Ordering them the other way round would put a transition between a
     reader and the thing they asked for. */
  /* the choice is recorded by onOpen, which also routes */
  const go=function(){ OPTS.onOpen(p.siteId); };

  /* ---- GOING THROUGH THE GROUND ----
     Opening a site used to be a cut: click, and the fleet was replaced by one
     plant's Home in a single frame. Nothing was WRONG with it, which is exactly
     why it was worth looking at twice - it worked, and it threw away the one
     thing this screen has that no other page in the portal does.

     This page's whole claim is that a site is a PLACE. It draws the real Earth
     from real plates, lights it from where the sun actually is, and puts each
     site at its own coordinates precisely so that "which site" is answered by
     pointing at ground. It already FALLS to a site when you click its dot. A
     cut at the end throws all of that away one frame before it pays off; going
     the rest of the way down, and through, is the same sentence finished. The
     fleet's own ground is already wired to arrive with the altitude - REGMIX
     rides on ZOOM - so by the time Home opens you have been looking at the
     site's own dirt for half a second.

     IT IS SKIPPED, NOT SHORTENED, in the three cases where the fall is not
     available or not wanted: a reader who asked for less motion, for whom a
     fall is the one thing this is; a site with no coordinates, which cannot be
     fallen to; and a narrow screen, where the picture is a plain list and there
     is no ground to go through. All three get the old cut, unchanged - which is
     also why the cut is still the first thing written above. */
  if(reduced || !isFinite(p.lat) || !isFinite(p.lng) || innerWidth<=720){ go(); return; }

  GOING=p; GOT=0;
  GO={ t:0, dur:GO_MS/1000,
       lam0:LAM, dLam:angTo(LAM,p.lng),
       phi0:PHI, phi1:Math.max(-78,Math.min(78,p.lat)),
       lz0:Math.log(ZOOM), lz1:Math.log(GO_Z) };
  FLY=false; idle=-1e9;
  /* the chrome leaves on the stylesheet's clock, and this is what starts it.
     --go is written from GO_MS so there is one number, not two. */
  OPTS.root.style.setProperty('--go',GO_MS+'ms');
  document.body.classList.add('going');
  /* the card, the leader and the lit row all belong to BROWSING, and this is
     no longer that. shut() rather than cool(), because cool() defers to an open
     card - correct everywhere else, wrong here, where the card is usually the
     very thing that was just clicked. */
  shut();
  /* by now the page has dissolved to the same background Home opens on, so
     what the navigation cuts between is two frames of one colour */
  __st(go,GO_MS+40);
}

/* The site under the pointer, and nothing else. It used to also drive a panel
   in the corner; now that every card carries its own readout, hovering has one
   job left - saying which site the picture and the reader are both looking at,
   by lifting its card and its node and letting the rest recede. */
let hot=null;
function hover(p,chip){
  hot=p;
  $('theatre').classList.add('hot');
  PLANTS.forEach(q=>q._row2.classList.toggle('on',q===p));
}
function cool(){
  if(ACT) return;                 /* an open card keeps its site lit */
  hot=null;
  $('theatre').classList.remove('hot');
  PLANTS.forEach(q=>q._row2.classList.remove('on'));
}

/* ================= WHERE THINGS STAND =================
   The two-column slot machinery is gone with the two columns. What is left is
   the part that was always doing the real work: every frame, where each site
   has landed on the picture and whether it can be seen at all. The card does
   not need a slot any more - it stands beside the row that opened it, and the
   browser puts it there.

   DOCK is the one point the leader has to reach: the left edge of the open
   card. Read from the live element rather than computed, because where that
   card sits is decided by the stylesheet, and a second copy of that arithmetic
   here is a second source of truth waiting to disagree. */
let DOCK=null;
function dock(){
  if(!ACT || !CARD.classList.contains('on')){ DOCK=null; return; }
  const b=$('theatre').getBoundingClientRect(), r=CARD.getBoundingClientRect();
  DOCK=[r.right-b.left, r.top-b.top+r.height/2];
}

/* the leader: out of the site, bowed clear of the planet, level into the card.
   Same curve as before - only its destination has changed. */
function leaderCurve(p){
  const ax=p.dx, ay=p.dy, ex=DOCK[0]+3, ey=DOCK[1], bx=DOCK[0]+38, by=DOCK[1];
  const mx=(ax+bx)/2, my=(ay+by)/2;
  let nx=-(by-ay), ny=(bx-ax);
  const nl=Math.hypot(nx,ny)||1; nx/=nl; ny/=nl;
  if((mx-CX)*nx+(my-CY)*ny < 0){ nx=-nx; ny=-ny; }
  const bow=Math.max(0, R*1.10-Math.hypot(mx-CX,my-CY))*0.62 + 16;
  return [ax,ay, mx+nx*bow,my+ny*bow, bx,by, ex,ey];
}

/* Every frame: where each node has landed, and whether it can be seen. */
function place(){
  PLANTS.forEach(function(p){
    const q=proj(p.lng,p.lat);
    p.x=q.x; p.y=q.y;
    /* 0.05 rather than 0: a site exactly on the limb is edge-on, its node is a
       sliver, and its leader would have nowhere to go. */
    p.vis=q.c>0.05;
    p.dx=p.x; p.dy=p.y;
  });
  const vis=PLANTS.filter(function(p){ return p.vis; });
  vis.forEach(function(p){
    let near=1e9;
    vis.forEach(function(q){ if(q!==p) near=Math.min(near,Math.hypot(p.dx-q.dx,p.dy-q.dy)); });
    p.near=near;
  });
  dock();
}

/* ---- what changes every frame ----
   State, output, share of nameplate. Everything here moves with the day curve
   and with nothing else, so it is the only part of a card worth repainting at
   sixty frames a second. */
function paintChips(){
  PLANTS.forEach(function(p){
    const st=stateOf(p), kw=outputOf(p), el=p._el, w=p._was;
    /* WRITTEN ONLY WHEN IT CHANGES. This runs sixty times a second, and the
       old card set every field, a title and a freshly built aria-label on every
       site on every frame - thousands of DOM writes a second to say what the
       DOM already said. Worse than the waste: a screen reader parked on a row
       whose label is rewritten sixty times a second can be made to stutter. */
    if(w.st!==st){
      w.st=st;
      p._row2.className='rrow'+(st==='ok'?'':' '+st)+(ACT===p?' on':'');
    }
    if(w.nm!==p.id){ w.nm=p.id; el.nm.textContent=p.id; }
    const kwt = st==='off' ? 'OFFLINE' : num(kw)+' kW';
    if(w.kw!==kwt){ w.kw=kwt; el.kw.textContent=kwt; }
    const nA=alarmsOf(p);
    if(w.al!==nA){
      w.al=nA;
      el.alm.textContent=nA||'';
      el.alm.className='alm'+(nA?' on':'')+(p.crit?' crit':'');
    }
    const lab=p.id+' — '+STATE_TEXT[st]+', '+
      (p.sunUp===false?'in darkness, ':'in daylight, ')+num(kw)+' kilowatts, '+
      (nA?nA+' open alarm'+(nA>1?'s':''):'no open alarms')+'. Open this site.';
    if(w.lab!==lab){ w.lab=lab; p._row2.setAttribute('aria-label',lab); }
  });
  paintCard();
}

/* ---- what changes every ten seconds ----
   Energy is an integral over the whole day so far and money is a multiple of
   it; neither moves fast enough to be worth a frame, and both are far too
   expensive to compute in one. */
function paintSlow(){
  /* A ROW HAS NO SLOW HALF. It carries a name, a live figure and an alarm
     count - all three move on the frame clock or not at all. The slow figures
     that used to be written into thirty cards are written into ONE now, and
     paintCard() already does it, so this is the open site and the fleet. */
  if(ACT) paintCard();
  paintSum();
}

/* ---- what the fleet adds up to ----
   Summed from the same per-site figures the cards are drawn from, so the strip
   and the picture cannot disagree. Carbon is derived from the fleet's energy
   rather than summed per site, because it is the same multiplication either way
   and one of them can drift from the kWh printed next to it.
   Devices are counted as reporting-of-total, because a fleet with four
   inverters dark is a different fleet from one with none, and a single number
   cannot say which you have. */
function paintSum(){
  let kw=0, ac=0, e=0, dev=0, up=0, alm=0, crit=0;
  PLANTS.forEach(function(p){
    kw+=outputOf(p); ac+=p.ac; e+=energyToday(p);
    dev+=p.dev; up+=p.dev-p.down; alm+=alarmsOf(p); crit+=p.crit;
  });
  const f=ac?Math.min(1,kw/ac):0;
  $('x-n').textContent=PLANTS.length;
  $('r-n').textContent=PLANTS.length;
  /* ONE CALL DECIDES BOTH. fmtP picks the scale; splitting its answer is the
     only way the number and the unit beside it can be guaranteed to agree.
     Printing the value from fmtP and the unit from the markup is how this came
     to read 5.8 kW for 5.8 megawatts. */
  const big=fmtP(kw).match(/^(.*?) (MW|kW)$/);
  $('x-kw').textContent = big ? big[1] : fmtP(kw);
  $('x-u').textContent  = big ? big[2] : 'kW';
  $('x-pc').textContent=Math.round(f*100)+'%';
  $('x-ac').textContent=fmtP(ac);
  /* CARBON, from the SAME energy figure printed beside it - one number, one
     source, so the strip cannot report a saving the energy does not support. */
  const PF=OPTS.portfolio()||{};
  $('x-co2').textContent = PF.co2!=null ? fmtC(PF.co2) : '—';
  $('x-e').textContent=fmtE(e);
  $('x-rev').textContent = PF.revenue!=null ? inr(PF.revenue) : '—';
  $('x-dev').innerHTML=up+'<small>OF '+dev+'</small>';
  $('x-now').textContent=hhmm(nowH());
  drawDay(f);
}

/* ================= THE ARC OF THE DAY =================
   A portfolio reading 5.7 MW says nothing by itself. 5.7 MW two thirds of the
   way up its own morning, against a curve that peaks at 7.5, says everything:
   whether this is a good noon or a poor one, how much is already banked, and
   how much is still to come.

   Drawn as an SVG path from the SAME curve() every figure on this screen is
   built on, so the picture and the numbers cannot drift apart. The filled part
   is the day so far; the faint part is what is still owed. */
function drawDay(f){
  const svg=$('x-curve'); if(!svg) return;
  const W=262, H=64, D0=5.5, D1=18.5, h=Math.max(D0,Math.min(D1,nowH()));
  const X=t=>(t-D0)/(D1-D0)*W, Y=v=>H-3-v*(H-11);
  const pts=function(a,b){
    let s='';
    for(let t=a;t<=b+1e-9;t+=0.2) s+=(s?' L ':'M ')+X(Math.min(t,b)).toFixed(1)+' '+Y(curve(Math.min(t,b))).toFixed(1);
    return s;
  };
  const done = h>D0 ? pts(D0,h)+' L '+X(h).toFixed(1)+' '+Y(0)+' L '+X(D0).toFixed(1)+' '+Y(0)+' Z' : '';
  svg.innerHTML=
    '<defs><linearGradient id="dg" x1="0" y1="0" x2="0" y2="1">'+
      '<stop offset="0" stop-color="#3ad998" stop-opacity=".55"/>'+
      '<stop offset="1" stop-color="#3ad998" stop-opacity=".04"/>'+
    '</linearGradient></defs>'+
    '<path d="'+pts(D0,D1)+'" fill="none" stroke="rgba(150,180,220,.30)" stroke-width="1"/>'+
    (done?'<path d="'+done+'" fill="url(#dg)"/>'+
          '<path d="'+pts(D0,h)+'" fill="none" stroke="#3ad998" stroke-width="1.5"/>':'')+
    '<line x1="'+X(h).toFixed(1)+'" y1="2" x2="'+X(h).toFixed(1)+'" y2="'+(H-3)+
      '" stroke="rgba(240,183,74,.55)" stroke-width="1" stroke-dasharray="2 3"/>'+
    '<circle cx="'+X(h).toFixed(1)+'" cy="'+Y(curve(h)).toFixed(1)+'" r="3" fill="#f0b74a"/>';
}

/* ================= THE GLOBE, DRAWN =================
   Back to front: the air, the sea, the grid, the land, the night, the edge,
   then the fleet. Each layer answers one question and none of them argues with
   another - which is why the night can be laid over the whole world in a single
   pass instead of every layer having to know about the sun. */

/* ---- helpers ----
   strokeArc walks a line across the sphere and lifts the pen wherever the line
   goes round the back. Without that, a meridian would be drawn straight across
   the disc as a chord: the far half of a great circle projects onto exactly the
   same place as the near half, and the only thing separating them is which side
   of the world they are on. */
function strokeArc(f,n){
  ox.beginPath();
  let pen=false;
  for(let i=0;i<=n;i++){
    const ll=f(i/n), q=proj(ll[0],ll[1]);
    if(q.c>0){ if(pen){ ox.lineTo(q.x,q.y); } else { ox.moveTo(q.x,q.y); pen=true; } }
    else pen=false;
  }
  ox.stroke();
}
/* A filled ring has to stay closed even where it disappears over the horizon,
   so a hidden point is pushed straight out to the limb along its own bearing.
   That is the correct place for it: in an orthographic view a hidden point
   already projects to the right spot, it is simply on the far side, and the
   nearest visible point on its own line of sight is the limb. Africa keeps its
   coast and gains a clean edge at the horizon instead of folding inside out. */
function fillRing(ring){
  ox.beginPath();
  for(let i=0;i<ring.length;i++){
    const q=proj(ring[i][0],ring[i][1]);
    let x=q.x,y=q.y;
    if(q.c<=0){
      const dx=x-CX, dy=y-CY, L=Math.hypot(dx,dy)||1;
      x=CX+dx/L*R; y=CY+dy/L*R;
    }
    if(i) ox.lineTo(x,y); else ox.moveTo(x,y);
  }
  ox.closePath();
}
/* the coast is stroked only where it is actually visible, because a limb-
   clamped ring would draw a coastline along the horizon that is not there */
function strokeRing(ring){
  ox.beginPath();
  let pen=false;
  for(let i=0;i<ring.length;i++){
    const q=proj(ring[i][0],ring[i][1]);
    if(q.c>0){ if(pen){ ox.lineTo(q.x,q.y); } else { ox.moveTo(q.x,q.y); pen=true; } }
    else pen=false;
  }
  ox.stroke();
}
function clipGlobe(){ ox.beginPath(); ox.arc(CX,CY,R,0,Math.PI*2); ox.clip(); }

/* ---- the air ----
   A rim just outside the sphere. It does real work: without it the globe ends on
   a hard edge and reads as a printed circle, and with it the edge is a limb -
   the thing that tells you at a glance you are looking at a ball.

   It was green, and green was wrong. On this portal green means PRODUCING, and
   a green halo around the entire planet was the loudest use of that colour on a
   screen whose whole job is to show you which sites are producing. It is the
   same blue as the sea now, only thinner and further out. The alphas are up,
   because blue against a blue sphere on a navy field has far less separation to
   work with than green did and would otherwise have disappeared. */
function drawAir(){
  const g=ox.createRadialGradient(CX,CY,R*0.97,CX,CY,R*1.20);
  g.addColorStop(0,   ATMOC+'00');
  g.addColorStop(0.22,ATMOC+'4a');
  g.addColorStop(0.55,ATMOC+'1e');
  g.addColorStop(1,   ATMOC+'00');
  ox.fillStyle=g;
  ox.beginPath(); ox.arc(CX,CY,R*1.20,0,Math.PI*2); ox.fill();
}

/* ---- the sea ----
   Lit FROM THE SUN, not from a fixed corner. The bright spot on the sphere sits
   at the subsolar point, which means the shading and the terminator are two
   views of the same fact and can never disagree - the world is brightest
   exactly where the sun is overhead, and it falls off towards the dark. */
function drawSea(s){
  const lx=CX+s.x*R*0.72, ly=CY-s.y*R*0.72;
  const g=ox.createRadialGradient(lx,ly,R*0.05,CX,CY,R*1.12);
  g.addColorStop(0,   SEA_HI);
  g.addColorStop(0.45,SEA);
  g.addColorStop(1,   SEA_LO);
  ox.beginPath(); ox.arc(CX,CY,R,0,Math.PI*2);
  ox.fillStyle=g; ox.fill();
}

/* ---- the grid ---- every thirty degrees, and almost invisible */
/* Over a PHOTOGRAPH the reference lines have to be light: a blue hairline on a
   blue ocean is not a line, and the same value that reads perfectly over the
   vector globe disappears over the Pacific. Over the vector fallback they stay
   in the portal's blue, because there the entire picture is that blue and white
   would shout. One flag, two liveries, and the flag is simply whether the
   photograph is actually on screen yet. */
const photo=function(){ return !!(prog&&texReady); };
const GRAT_W='rgba(255,255,255,.085)';

function drawGrat(){
  ox.save(); clipGlobe();
  ox.strokeStyle=photo()?GRAT_W:GRATC; ox.lineWidth=1;
  for(let lng=-180;lng<180;lng+=30)
    strokeArc(function(t){ return [lng,-90+t*180]; },48);
  for(let lat=-60;lat<=60;lat+=30)
    strokeArc(function(t){ return [-180+t*360,lat]; },96);
  /* the equator carries a touch more weight than the rest: it is the one line
     on the grid a reader can name, and naming one line orients all of them */
  ox.strokeStyle=photo()?GRAT_W:GRATC; ox.lineWidth=1.6;
  strokeArc(function(t){ return [-180+t*360,0]; },96);
  ox.restore();
}

/* ---- the land, when there is no photograph of it ----
   Only reached on a machine without WebGL. The continents are filled and their
   coasts drawn, which the texture would otherwise be doing. */
function drawLandVector(){
  ox.save(); clipGlobe();
  ox.fillStyle=LANDF;
  LAND.forEach(function(r){ fillRing(r); ox.fill(); });
  ox.strokeStyle=LANDS; ox.lineWidth=1;
  LAND.forEach(function(r){ strokeRing(r); });
  ox.restore();
}

/* ---- the night ----
   THE ONE PIECE OF GEOMETRY ON THIS SCREEN WORTH READING TWICE.

   The terminator is the great circle ninety degrees from the sun. Projected
   orthographically it is an ellipse: full radius across the direction the sun
   lies in, and squashed to R*|sz| along it, where sz is how much of the sun's
   direction points at the camera. Only half of that ellipse is on our side of
   the world; the other half is the terminator behind the globe.

   So the night is bounded by two arcs - the visible half-ellipse, and the half
   of the limb running away from the sun - and drawing it is just walking those
   two arcs and filling. Exact, and about thirty lines cheaper than testing
   every pixel.

   When the sun is nearly dead centre or dead behind, the in-plane part of its
   direction vanishes and there is no bearing to build the frame on. That is not
   a degenerate case to guard against so much as an easy one: the whole disc is
   day, or the whole disc is night. */
/* THE TERMINATOR IS ON. It was parked while the globe was being made to look
   like a photograph; it is back because a solar portal that cannot tell you
   whether the sun is up over a site is withholding the single fact that governs
   every number it prints. The lit face stays exactly as the satellite saw it and
   the dark half is laid back over it, so the picture is a photograph of the
   Earth AND a statement about right now.

   ?night=0 turns it off for anyone who wants the plain globe back. */
const NIGHT=new URLSearchParams(location.search).get('night')!=='0';
function drawNight(s){
  const a=Math.hypot(s.x,s.y);
  ox.save(); clipGlobe();
  if(a<1e-6){
    if(s.z<0){ ox.fillStyle=NIGHTC; ox.fillRect(CX-R,CY-R,2*R,2*R); }
    ox.restore(); return;
  }
  const ux=s.x/a, uy=s.y/a;      /* towards the sun, in the screen plane */
  const wx=-uy, wy=ux;           /* ninety degrees off it                */
  /* (u,w) are maths axes with y upwards; the canvas has y downwards */
  const pt=function(cu,cw){ return [CX+cu*ux+cw*wx, CY-(cu*uy+cw*wy)]; };
  const N=64;
  ox.beginPath();
  for(let i=0;i<=N;i++){
    const t=(90+180*i/N)*D2R;
    const p=pt(R*s.z*Math.cos(t), R*Math.sin(t));
    if(i) ox.lineTo(p[0],p[1]); else ox.moveTo(p[0],p[1]);
  }
  for(let i=0;i<=N;i++){
    const t=(270-180*i/N)*D2R;
    const p=pt(R*Math.cos(t), R*Math.sin(t));
    ox.lineTo(p[0],p[1]);
  }
  ox.closePath();
  ox.fillStyle=NIGHTC; ox.fill();

  /* dawn and dusk, drawn as the line itself. A hard edge would be a lie about
     twilight and a soft blur would be a lie about precision, so it is one thin
     gold line: this is where the sun is rising and setting on the fleet, right
     now, and it is the most operationally loaded line on the screen. */
  ox.beginPath();
  for(let i=0;i<=N;i++){
    const t=(90+180*i/N)*D2R;
    const p=pt(R*s.z*Math.cos(t), R*Math.sin(t));
    if(i) ox.lineTo(p[0],p[1]); else ox.moveTo(p[0],p[1]);
  }
  /* Twilight, then the line. A single hard edge is a lie about dusk - the sun
     takes the better part of an hour to set and the sites do not stop at a
     stroke - and a soft blur alone is a lie about precision. So it is both: a
     wide, very faint band for the hour, and a thin bright line for the instant.
     Same path, stroked twice, which is also why they can never drift apart. */
  ox.strokeStyle=TERMC+'10'; ox.lineWidth=14; ox.stroke();
  ox.strokeStyle=TERMC+'6e'; ox.lineWidth=1.2; ox.stroke();
  ox.restore();
}

/* ================= SPACE, AND WHAT THE EARTH DOES TO IT =================
   Everything behind the globe - the stars, the grid, and the leaders running
   out to the cards - is bent by the same field, because there is only one
   field and it belongs to the thing in the middle of the picture.

   The deflection is the real one's SHAPE. Light passing a mass is pulled
   towards it, so a distant field seen past the Earth appears pushed AWAY from
   it: the sky opens into a clear disc around the limb and bunches into a bright
   ring at its edge. r -> sqrt(r^2 + Rc^2) is that map in one line. It cannot
   put anything inside Rc, which is why nothing drawn out here ever lands on the
   planet; it barely moves the far field, which is why the corners of the frame
   stay a plain grid; and it magnifies hardest just off the limb, which is where
   lensing is actually visible.

   The grid is what makes it legible. A warped starfield alone reads as
   scattered dots; a warped GRID reads as space itself being pulled out of
   shape, which is the whole of what a gravity well looks like. */
const LENSR=1.03;
function warp(x,y){
  const dx=x-CX, dy=y-CY, Rc=R*LENSR;
  const r=Math.hypot(dx,dy);
  if(r<1e-4) return [CX+Rc, CY];
  const k=Math.sqrt(r*r+Rc*Rc)/r;
  return [CX+dx*k, CY+dy*k];
}

/* ================= THE SKY IS NOT INVENTED ANY MORE =================
   It was 1,400 points from a seeded PRNG, all one colour. Three things are
   wrong with that and the eye catches every one of them without being told:
   there are no CONSTELLATIONS, so the field reads as noise rather than as sky;
   there is no star COLOUR, when Rigel against Betelgeuse is one of the plainest
   colour contrasts in nature; and there is no MILKY WAY, which is the whole
   reason a real void looks deep instead of empty.

   So the dots are gone and the sky is the sky. 8,920 stars from the HYG v4.0
   catalogue - everything down to magnitude 6.5, which is the naked-eye limit -
   carrying their real right ascension, declination, visual magnitude and B-V
   colour index. Orion is Orion. The Plough is where the Plough is. The band of
   the galaxy behind them is NASA's own Deep Star Maps plate, sampled by the
   shader, so the diffuse light and the points are one sky and not two.

   Packed six bytes a star - ra 16, dec 16, mag 8, colour 8 - which is 53 KB for
   the entire visible universe, rather less than the file was already spending
   on a scatter of grey dots. */
/* STAR_B64 is imported from the shared catalogue (HYG v4.0) */

/* B-V colour index to something a screen can show. This is a blackbody ramp in
   disguise: hot stars are blue, cool stars are red, and the sun sits at 0.65
   looking faintly yellow. Seven bins rather than a continuous function, because
   the renderer below batches by colour and a batch of one is not a batch. */
const CBIN=[[155,176,255],[192,208,255],[228,233,255],[255,246,237],
            [255,223,182],[255,197,142],[255,159,107]];
function ciBin(ci){
  return ci<0.00?0 : ci<0.20?1 : ci<0.42?2 : ci<0.68?3 : ci<0.98?4 : ci<1.40?5 : 6;
}

/* Sidereal time, in degrees. A star at right ascension RA stands over terrestrial
   longitude RA - GMST, which is the one line that puts the constellations in the
   right place for the hour instead of merely somewhere. Captured ONCE at load and
   shared with the shader's uSkySpin, so the catalogue points and the painted band
   are locked to each other. */
function gmstDeg(when){
  const d=(when===undefined?Date.now():when)/86400000 + 2440587.5 - 2451545.0;
  return ((((18.697374558 + 24.06570982441908*d)%24)+24)%24)*15;
}
const GMST0=gmstDeg(Date.now()+SUNSHIFT);

const STARS=(function(){
  const raw=atob(STAR_B64), out=[];
  for(let i=0;i+5<raw.length;i+=6){
    const ra =((raw.charCodeAt(i)<<8   | raw.charCodeAt(i+1))/65535)*360;
    const dec=((raw.charCodeAt(i+2)<<8 | raw.charCodeAt(i+3))/65535)*180-90;
    const mag=(raw.charCodeAt(i+4)/255)*9-2;
    const ci =(raw.charCodeAt(i+5)/255)*3-0.5;
    /* magnitude is a logarithmic scale running BACKWARDS - each step is 2.512x
       the flux, and brighter is smaller. Compressed hard for the screen, or
       Sirius would be a dinner plate next to a field of invisible sixes. */
    const f=Math.pow(2.512,(6.5-mag)/2.6)/Math.pow(2.512,8/2.6);
    out.push({ lng:((ra-GMST0)%360+540)%360-180, lat:dec, mag:mag,
               r:0.30+Math.pow(f,0.55)*2.60,
               a:0.10+Math.pow(f,0.62)*0.90,
               cb:ciBin(ci), ph:(i*0.7548)%6.283 });
  }
  return out;
})();

/* Batched by colour and brightness. 8,920 stars is nothing to draw and a great
   deal to RESTYLE: a fillStyle per star is half a million context writes a
   second, which is where a starfield of this size would otherwise go to die.
   Seven colours by five brightnesses is at most thirty-five style changes a
   frame, and every star in a bin joins one path. */
const ABIN=5;
const STAR_BATCH=(function(){
  const b={};
  STARS.forEach(function(s){
    const ai=Math.max(0,Math.min(ABIN-1,Math.round((s.a-0.26)/0.74*(ABIN-1))));
    const k=s.cb*ABIN+ai;
    if(!b[k]){
      const c=CBIN[s.cb];
      b[k]={ rgb:c, lvl:(ai+1)/ABIN, list:[] };
    }
    b[k].list.push(s);
  });
  return Object.keys(b).map(function(k){ return b[k]; });
})();
/* the few dozen that carry the constellations get drawn one at a time, with a
   halo - these are the stars a person can actually name */
const STAR_BRIGHT=STARS.filter(function(s){ return s.mag<2.6; });

/* How much of the sun
/* How much of the sun this side of the world is getting, 0..1. Written by
   sunCss from the same subsolar vector everything else on this screen is drawn
   from, read here by the stars and by the CSS behind the canvas, so the
   background, the corona and the starfield can never disagree about whether it
   is day. */
var DAYF=1;

function drawSpace(now){
  /* ---- NOTHING IS PAINTED BEHIND THE WORLD ----
     The globe is a disc of radius R at the centre of the frame, so the moment R
     passes the distance from the centre to a CORNER there is no void left on
     screen at all. On a 1920x1080 window that happens at about 2.6x - and the
     descent goes to 22x, where the planet is nine times wider than the window.

     Every frame of that descent was still projecting 8,920 stars through
     skyXY and warp, walking the gravity grid at five-pixel steps across the
     whole frame, and allocating a radial gradient for each of the named stars -
     all of it behind a planet covering every pixel of the screen. That is the
     zoomed-in stutter: not the ground coming up, but the sky still being drawn
     under it.

     The corner is measured from the GLOBE's centre, which is not the canvas
     centre - CY is lifted to sit between the header and the foot - so the
     farthest corner is the far side on each axis rather than half the frame.
     Getting that wrong the cheap way would cut the sky while a corner still
     showed void, which is a black notch in the picture.

     The margin is there because the limb carries a glow past R, and because a
     guard that cuts at exactly the corner flickers on the frame where the two
     are equal. A frame of drawing stars costs less than a frame of missing
     them. */
  if(R > Math.hypot(Math.max(CX,W-CX), Math.max(CY,H-CY))*1.04) return;
  ox.save();
  /* ninety degrees off the anti-camera axis lands at the corner of the frame,
     so the visible sky is exactly the hemisphere standing behind the planet */
  SKYK=Math.hypot(W/2,H/2)/(Math.PI/2);

  /* ---- the grid ----
     Straight lines, walked in short steps and displaced point by point. The pen
     lifts wherever two consecutive samples land far apart, which happens only
     where a line passes close to the centre and the lens throws its two halves
     to opposite sides of the planet - the split is correct and the chord that
     would otherwise join them is not. */
  const step=Math.max(56, Math.min(94, Math.min(W,H)/11));
  ox.lineWidth=1;
  /* down from .10. It was doing the work of making the void look deep, and
     the Milky Way does that now - so this steps back to being what it should
     always have been: a faint instrument ruling, not weather. */
  ox.strokeStyle='rgba(90,162,240,.040)';
  const walk=function(at,len){
    let pen=false, px=0, py=0;
    ox.beginPath();
    for(let d=0; d<=len; d+=5){
      const p=at(d), q=warp(p[0],p[1]);
      if(pen && Math.hypot(q[0]-px,q[1]-py)>58) pen=false;
      if(pen) ox.lineTo(q[0],q[1]); else ox.moveTo(q[0],q[1]);
      pen=true; px=q[0]; py=q[1];
    }
    ox.stroke();
  };
  for(let x=-step; x<=W+step; x+=step)
    walk(function(d){ return [x,-step+d]; }, H+2*step);
  for(let y=-step; y<=H+step; y+=step)
    walk(function(d){ return [-step+d,y]; }, W+2*step);

  /* ---- the stars ----
     Lensed with everything else, and brightened where the lens has bunched them
     up: the ring of light just off the limb is not decoration, it is the same
     magnification the grid is showing, said in the other medium. */
  const tw = reduced ? 0 : now/1000;
  const night=0.82+0.62*(1-DAYF);
  STAR_BATCH.forEach(function(bk){
    const c=bk.rgb;
    ox.fillStyle='rgba('+c[0]+','+c[1]+','+c[2]+','+(bk.lvl*0.92*night).toFixed(3)+')';
    ox.beginPath();
    const L=bk.list;
    for(let i=0;i<L.length;i++){
      const st=L[i], p=skyXY(st.lng,st.lat);
      if(!p) continue;
      const q=warp(p[0],p[1]);
      if(q[0]<-4||q[0]>W+4||q[1]<-4||q[1]>H+4) continue;   /* off the frame */
      const rr=Math.hypot(q[0]-CX,q[1]-CY);
      const near=Math.max(0,(R*1.6-rr))/(R*1.6);
      const rad=st.r*(1+near*0.5);
      ox.moveTo(q[0]+rad,q[1]);
      ox.arc(q[0],q[1],rad,0,6.283185);
    }
    ox.fill();
  });
  /* and the named ones, with the bloom a bright point actually has */
  STAR_BRIGHT.forEach(function(st){
    const p=skyXY(st.lng,st.lat);
    if(!p) return;
    const q=warp(p[0],p[1]);
    /* the bloom is 4.6 radii wide, so it is culled against that rather than
       against the point - a star just past the edge still throws light in */
    const pad=st.r*4.6+2;
    if(q[0]<-pad||q[0]>W+pad||q[1]<-pad||q[1]>H+pad) return;
    const c=CBIN[st.cb];
    const fl=reduced?1:(0.80+0.20*Math.sin(tw*1.5+st.ph));
    const g=ox.createRadialGradient(q[0],q[1],0,q[0],q[1],st.r*4.6);
    g.addColorStop(0,'rgba('+c[0]+','+c[1]+','+c[2]+','+(0.50*fl*night).toFixed(3)+')');
    g.addColorStop(1,'rgba('+c[0]+','+c[1]+','+c[2]+',0)');
    ox.fillStyle=g;
    ox.beginPath(); ox.arc(q[0],q[1],st.r*4.6,0,6.283185); ox.fill();
    ox.fillStyle='rgba(255,255,255,'+(0.85*fl*night).toFixed(3)+')';
    ox.beginPath(); ox.arc(q[0],q[1],st.r*0.62,0,6.283185); ox.fill();
  });
  ox.globalAlpha=1;
  ox.restore();
}


/* THE HAND-PLACED CITIES ARE GONE, and so is the sprite they were stamped with.
   They were about 250 coordinates typed out by hand and drawn as glowing discs -
   an honest approximation when there was no photograph of the night side. There
   is one now: NASA's Black Marble plate is sampled by the shader, so the lights
   are the real lights at their real brightness everywhere, not only in the towns
   somebody remembered to list. See FRAG.

   drawNight() below is KEPT, but it is reachable only on the vector globe - the
   machine with no WebGL, which has no photograph to lay a shadow on. */

/* ---- the edge of the world ---- */
function drawLimb(){
  ox.beginPath(); ox.arc(CX,CY,R,0,Math.PI*2);
  ox.strokeStyle=LIMBC; ox.lineWidth=1.2; ox.stroke();
}

/* ================= THE CADENCE =================
   ONE heartbeat, and everything alive on this screen keeps to it: 2.4 seconds,
   the same interval the live pip in the header bar has always used. A screen
   where three things pulse at three rates looks broken; a screen where they all
   pulse together looks like one machine running.

   Sites are STAGGERED within it rather than firing in unison. A single
   simultaneous flash reads as a decoration on a picture - a sweep passing from
   one site to the next reads as the fleet being polled, which is what is
   actually happening behind a monitoring portal. The offset is by the site's
   own index, so the order never shuffles between frames. */
const BEAT=2.4;
function beatPhase(now,i){ return ((now/1000)/BEAT + (i||0)*0.17) % 1; }

/* leaderCurve lives up with place() and dock() now - it is about where things
   STAND, not about how they are drawn, and it had drifted a long way from the
   two functions it has to agree with. */

/* a point along that curve. The travelling pulse and the line have to be the
   same path or the reading is seen to leave the rails on its way to the card. */
function bezAt(c,t){
  const u=1-t, a=u*u*u, b=3*u*u*t, d=3*u*t*t, e=t*t*t;
  return [a*c[0]+b*c[2]+d*c[4]+e*c[6], a*c[1]+b*c[3]+d*c[5]+e*c[7]];
}



/* ---- the fleet ----
   Size is capacity, colour is health, brightness is output against the site's
   own nameplate - unchanged since the ring, because that part was never what
   was wrong. What is new is the leader: a thin line from the node out to the
   name, bent once at the limb so it reads as something standing off the surface
   rather than a chord drawn across it. */
/* ================= THE CLOSE VIEW =================
   WHY THIS EXISTS. The globe is one 1024x512 photograph of the whole Earth.
   That is a magnificent picture of a planet and it is about four hundred
   metres per pixel at the equator - so somewhere around twice life size the
   photograph stops being a photograph and becomes eight coloured squares where
   a district used to be. Zooming further did not show you more; it showed you
   the same information, larger and wronger, which is the one thing a monitoring
   screen may not do.

   So the picture HANDS OVER. Past 2x the photograph goes under a deep field and
   what comes up in its place is the instrument: a graticule that gets finer as
   you get closer, degree labels on it, and each site standing on a reticle with
   its name, its surveyed coordinates and its address printed beside it. The
   close view answers a different question from the far one - not "where is the
   fleet" but "where exactly is THIS", and coordinates answer that at any
   magnification, which a 400m pixel never will.

   Nothing is invented in the handover. The graticule is computed from the same
   projection the photograph is sampled with, and the coordinates printed at a
   node are the ones the site record carries. When the backend sends surveyed
   positions and a real tile server sends real imagery, the photograph simply
   stays sharp for longer and this view starts later - the arithmetic below does
   not change. */
const CLOSE_IN=5.0, CLOSE_FULL=11.0;
let CLOSE=0;
const MONOF="ui-monospace,'SF Mono','Cascadia Code','Roboto Mono',Consolas,monospace";

/* how many degrees of world are actually on screen, from the projection rather
   than from the zoom number - the two agree only while the whole disc fits */
function spanDeg(){
  const half=Math.asin(Math.max(0,Math.min(1,(Math.min(W,H)/2)/R)))/D2R;
  return half*2;
}
/* one step from a fixed ladder, chosen so the grid is always about a dozen
   lines across: a graticule that keeps its density as you descend is the only
   thing on a featureless close view that says how far you have come */
const GRAT_STEPS=[30,15,10,5,2,1,0.5,0.2,0.1,0.05];
function gratStep(){
  const sp=spanDeg();
  /* the FINEST step that still fits inside the budget, not the first one that
     does. Returning on the first pass takes 30 degrees every time - the whole
     ladder passes the test at the top - and the grid would never get denser however
     far you descended, which is precisely the failure it exists to avoid. */
  let out=GRAT_STEPS[0];
  for(let i=0;i<GRAT_STEPS.length;i++) if(sp/GRAT_STEPS[i]<=12) out=GRAT_STEPS[i];
  return out;
}
/* the GRID is labelled to the precision of the grid; a SITE is labelled to the
   precision of the record, which is the only honest number to print at a point
   claiming to be where something stands */
/* longitude, folded back into -180..180. ((g+540)%360)-180 was ALMOST this and
   went wrong exactly when it mattered: JavaScript's % keeps the sign of its left
   operand, so once the camera had been dragged west past -540 the fold returned
   a negative number and the graticule started printing 292 degrees W across
   Rajasthan. Taking the modulus FIRST is the whole fix. */
const wrap180=v=>((v%360)+540)%360-180;
const degLab=(v,pos,neg)=>Math.abs(v).toFixed(gratStep()<0.2?2:gratStep()<1?1:0)+'°'+(v<0?neg:pos);
const posLab=(v,pos,neg)=>Math.abs(v).toFixed(2)+'°'+(v<0?neg:pos);

function drawClose(){
  if(CLOSE<=0.002) return;
  ox.save();
  clipGlobe();

  /* the photograph does not vanish - it is left as a ghost under the field, so
     a coastline you were following into the close view is still the coastline
     you come out of it on */
  /* A 90% BLACKOUT USED TO GO HERE, and it was throwing away the entire point
     of arriving. The old close view had nothing to show - the global plate is
     four hundred metres to the pixel - so it hid the photograph and drew a
     diagram instead. There is real ground under this now: the Thar running out
     west of the fleet, the Indus green, the salt of the Rann. So the scrim is
     just enough to carry a graticule and a label, and the terrain stays. */
  ox.globalAlpha=CLOSE*0.20;
  ox.fillStyle='#040a14';
  ox.fillRect(0,0,W,H);
  ox.globalAlpha=1;

  const st=gratStep(), sp=spanDeg();
  const lat0=Math.max(-89,PHI-sp), lat1=Math.min(89,PHI+sp);
  const lng0=LAM-sp, lng1=LAM+sp;
  const a=CLOSE;

  ox.lineWidth=1;
  ox.strokeStyle='rgba(120,190,255,'+(0.16*a).toFixed(3)+')';
  /* only the lines that can be on screen are walked. A one-degree graticule
     over the whole sphere is seven hundred arcs, and seven hundred arcs a frame
     to draw the dozen you can see is how a smooth globe stops being smooth. */
  for(let g=Math.ceil(lng0/st)*st; g<=lng1; g+=st)
    strokeArc(function(t){ return [g, lat0+t*(lat1-lat0)]; },24);
  for(let g=Math.ceil(lat0/st)*st; g<=lat1; g+=st)
    strokeArc(function(t){ return [lng0+t*(lng1-lng0), g]; },24);

  /* THE NUMBERS ON THE GRID. A grid with no numbers on it is a texture; the
     labels are what make it a coordinate system, and a coordinate system is the
     whole of what this view has that the photograph does not. They are printed
     where each line crosses the middle of the screen, which is the one place
     every visible line passes through. */
  ox.font='9.5px '+MONOF;
  ox.fillStyle='rgba(170,214,255,'+(0.62*a).toFixed(3)+')';
  ox.textAlign='center'; ox.textBaseline='middle';
  for(let g=Math.ceil(lng0/st)*st; g<=lng1; g+=st){
    const q=proj(g,PHI);
    if(q.c>0.08) ox.fillText(degLab(wrap180(g),'E','W'), q.x, CY-9);
  }
  ox.textAlign='left';
  for(let g=Math.ceil(lat0/st)*st; g<=lat1; g+=st){
    const q=proj(LAM,g);
    if(q.c>0.08) ox.fillText(degLab(g,'N','S'), CX+7, q.y);
  }
  ox.restore();
}

/* ---- a site, close up ----
   The card in the column still carries what the site is DOING. This carries
   what nothing else on the screen can say: exactly where it stands. Name,
   surveyed position, address - the three things you would read off a site visit
   form, printed at the point on the world they describe. */
/* ============================ THE SITE PLATES ============================
   These were four lines of bare text laid straight onto a photograph, and a
   photograph of the Earth has every colour in it: emerald coordinates over
   Rajasthan were emerald on tan, and simply could not be read. Type on a
   picture needs something to stand on.

   So each label is now a PLATE - the same dark glass as the rail and the card,
   so the writing on the ground and the writing in the panels are one instrument
   in one room rather than two things that happen to share a screen. It carries
   the site's live output as well, because a name beside a dot answers "which
   one" and the reader's next question is always "and how is it doing".

   PLATES holds every rectangle already placed this frame - including the rail
   and the portfolio panel, which are seeded in before any label is put down, so
   a label can never slide underneath a panel and be lost. */
const PLATES=[];

function roundRectPath(x,y,w,h,r){
  ox.beginPath();
  if(ox.roundRect){ ox.roundRect(x,y,w,h,r); return; }
  ox.moveTo(x+r,y); ox.lineTo(x+w-r,y); ox.quadraticCurveTo(x+w,y,x+w,y+r);
  ox.lineTo(x+w,y+h-r); ox.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
  ox.lineTo(x+r,y+h); ox.quadraticCurveTo(x,y+h,x,y+h-r);
  ox.lineTo(x,y+r); ox.quadraticCurveTo(x,y,x+r,y); ox.closePath();
}

/* Does this rectangle touch anything already down? Real geometry, against the
   real rectangles. What stood here before was `p._i%2` - odd indices stepped
   down, even ones stepped up - which is not collision avoidance, it is a coin
   toss: two crowded sites with the same parity still landed on each other, and
   a third had nowhere to go at all. */
function clashes(r){
  for(let i=0;i<PLATES.length;i++){
    const q=PLATES[i];
    if(r.x<q.x+q.w+8 && r.x+r.w+8>q.x && r.y<q.y+q.h+6 && r.y+r.h+6>q.y) return true;
  }
  return false;
}

function drawSiteClose(p,col){
  const a=CLOSE;
  if(a<=0.002||!p.vis) return;
  /* THE DEPARTURE, and the close-up needs its own rule for it because it
     carries its own dim. Two different fades, for two different reasons.

     THE SITES BEING LEFT go the way their markers do - a reticle and a
     nameplate left standing over ground the reader is leaving would be the one
     part of the fleet that did not get the message.

     THE SITE BEING OPENED goes too, and EARLIER, which is the part that is not
     obvious. The iris closes on the marker, and this block is a wide slab of
     text starting at the marker and running right: left up, it gets sliced in
     half by the closing hole, and a label cut through the middle by a circle is
     an artefact, not a composition. It is done saying what it says by then - it
     has been on screen for most of a second - so it is gone by the time the
     hole is small enough to reach it. What the iris actually closes on is the
     dot, which is drawn in drawSites and not here, and which is the right last
     thing to see: the place, not the caption. */
  const dim=((hot&&hot!==p&&ACT!==p)?0.72:1)
    *(GOING ? (p===GOING ? Math.max(0,Math.min(1,(0.70-GOT)/0.25))
                         : Math.max(0,1-GOT*2.4)) : 1);
  const live=(ACT===p||hot===p);
  const st=stateOf(p), kw=outputOf(p);

  ox.save();
  ox.globalAlpha=a*dim;

  /* the reticle: four ticks standing off the dot, which is how an instrument
     marks a point it is not allowed to cover up */
  const r0=13+10*a, r1=r0+9;
  ox.strokeStyle=col+'b0'; ox.lineWidth=1;
  [[1,0],[-1,0],[0,1],[0,-1]].forEach(function(d){
    ox.beginPath();
    ox.moveTo(p.dx+d[0]*r0, p.dy+d[1]*r0);
    ox.lineTo(p.dx+d[0]*r1, p.dy+d[1]*r1);
    ox.stroke();
  });
  ox.strokeStyle=col+'55';
  ox.beginPath(); ox.arc(p.dx,p.dy,r0,0,Math.PI*2); ox.stroke();

  /* ---- what goes on it ---- */
  const name=p.id.toUpperCase();
  const power=st==='off' ? 'OFFLINE' : num(kw)+' kW';
  const coord=posLab(p.lat,'N','S')+'  '+posLab(p.lng,'E','W');
  let addr=p.addr||'';
  if(addr.length>46) addr=addr.slice(0,45)+'\u2026';

  const F_NM='700 11.5px '+MONOF, F_KW='600 10.5px '+MONOF,
        F_CO='9.5px '+MONOF,      F_AD='9px '+MONOF;
  ox.font=F_NM; const wNm=ox.measureText(name).width;
  ox.font=F_KW; const wKw=ox.measureText(power).width;
  ox.font=F_CO; const wCo=ox.measureText(coord).width;
  ox.font=F_AD; const wAd=ox.measureText(addr).width;
  const PAD=11, GAP=22;
  const pw=Math.round(Math.max(wNm+GAP+wKw, wCo, wAd)+PAD*2), ph=54;

  /* ---- where it can go ----
     Preferred: level with the dot, on its right. Then the left. Then a step up
     or down, alternating outwards, on either side. The first position that is
     both inside the frame and clear of everything already placed wins. */
  const off=r1+12;
  let box=null;
  const sides=[1,-1], steps=[0,-1,1,-2,2,-3,3];
  for(let s=0;s<sides.length && !box;s++){
    for(let k=0;k<steps.length;k++){
      const sx=sides[s];
      const x = sx>0 ? p.dx+off : p.dx-off-pw;
      const y = p.dy-ph/2 + steps[k]*(ph+11);
      if(x<14 || x+pw>W-14 || y<76 || y+ph>H-16) continue;
      const r={x:x,y:y,w:pw,h:ph,sx:sx};
      if(!clashes(r)){ box=r; break; }
    }
  }
  /* Nowhere clear - a genuinely packed frame. It still gets drawn, clamped into
     the window, because a site with no label is worse than a crowded one. */
  if(!box){
    const sx=(p.dx>W*0.55)?-1:1;
    box={ x:Math.max(14,Math.min(W-14-pw, sx>0?p.dx+off:p.dx-off-pw)),
          y:Math.max(76,Math.min(H-16-ph, p.dy-ph/2)), w:pw, h:ph, sx:sx };
  }
  PLATES.push(box);

  /* the tie between the mark and its writing. It matters more now than it did:
     a plate pushed two rows clear of its dot has to be visibly OWNED by it. */
  const ex = box.sx>0 ? box.x : box.x+pw;
  const ey = box.y+ph/2;
  ox.globalAlpha=a*dim*0.5;
  ox.strokeStyle=col; ox.lineWidth=1;
  ox.beginPath(); ox.moveTo(p.dx+box.sx*r1, p.dy); ox.lineTo(ex, ey); ox.stroke();

  /* ---- the plate ---- */
  ox.globalAlpha=a*dim;
  ox.shadowColor='rgba(0,0,0,.55)'; ox.shadowBlur=16; ox.shadowOffsetY=5;
  roundRectPath(box.x,box.y,pw,ph,8);
  ox.fillStyle='rgba(6,12,20,'+(live?0.93:0.88)+')';
  ox.fill();
  ox.shadowColor='rgba(0,0,0,0)'; ox.shadowBlur=0; ox.shadowOffsetY=0;
  ox.strokeStyle = live ? col+'99' : 'rgba(150,180,220,.24)';
  ox.lineWidth=1; ox.stroke();

  /* the state edge, on the side the dot is on - the same 2px bar the rail rows
     wear, so a site reads the same whether you meet it in the list or the field */
  ox.save();
  roundRectPath(box.x,box.y,pw,ph,8); ox.clip();
  ox.fillStyle=col;
  ox.fillRect(box.sx>0?box.x:box.x+pw-2, box.y, 2, ph);
  ox.restore();

  /* ---- and the writing, in the three colours the rest of the screen uses ---- */
  const tx=box.x+PAD;
  ox.textBaseline='alphabetic';
  ox.textAlign='left';
  ox.font=F_NM; ox.fillStyle='rgba(232,243,255,.98)';
  ox.fillText(name, tx, box.y+19);
  ox.textAlign='right';
  ox.font=F_KW; ox.fillStyle = st==='off' ? 'rgba(150,180,220,.75)' : col;
  ox.fillText(power, box.x+pw-PAD, box.y+19);
  ox.textAlign='left';
  ox.font=F_CO; ox.fillStyle='rgba(120,215,175,.92)';
  ox.fillText(coord, tx, box.y+33);
  ox.font=F_AD; ox.fillStyle='rgba(166,189,213,.90)';
  ox.fillText(addr, tx, box.y+46);
  ox.restore();
}

function drawSites(now,dt){
  PLANTS.forEach(function(p){
    if(!p.vis){ p._h=0; return; }
    const st=stateOf(p), kw=outputOf(p);
    /* read once, at the top: the ping and the pulse travelling down the leader
       are the SAME event and must never be computed from two different clocks */
    const phase = beatPhase(now, p._i);
    /* ONE COLOUR FOR EVERY SITE. The markers used to be green, amber or red by
       health, which put three hues on a photograph that already has every hue in
       it - over Rajasthan an amber dot on amber desert is not a warning, it is
       camouflage. A marker's job here is to be FOUND, and one colour used
       consistently is found faster than three used meaningfully. What the marker
       cannot say any more, the label beside it says in words, and the site's own
       screens say in full.
       Green because it is the portal's live colour, and because these are the
       lights of a working fleet. */
    const col=COLOR.ok;
    /* a site the sun has set on is dimmed rather than recoloured: it is not
       faulty, it is night, and the picture should say so without an alarm */
    /* Up from 0.52. A site the sun has set on is not faulty and it is not
       gone - it is a site you may well be opening BECAUSE it is dark. Halving
       it made the night half of the fleet something you had to hunt for. */
    /* AND ON THE WAY OUT, THE FLEET GOES WITH THE ALTITUDE. Every other marker
       is a fleet-scale reading, and a second into a departure it is describing
       something the reader is no longer looking at. They are gone by about the
       half-way point, which leaves one mark over one piece of ground - the
       sentence the next screen begins with. */
    const dim=((hot&&hot!==p)?0.28:1)*(p.sunUp===false?0.74:1)
      *(GOING ? (p===GOING ? 1 : Math.max(0,1-GOT*2.4)) : 1);
    p._h=(p._h||0)+((hot===p?1:0)-(p._h||0))*Math.min(1,dt*9);
    /* Smaller than they were. Over a diagram a big soft disc was the brightest
       thing on screen; over a photograph of the Earth it is a smear on top of
       a picture. A beep is small and certain. */
    const rad=(4.5+Math.sqrt(p.ac/3200)*4)*(1+p._h*0.20);
    const lit=st==='off'?0:Math.min(1,kw/(p.ac||1));

    ox.save(); ox.globalAlpha=dim;

    /* ---- THE LEADER, AND WHO IT BELONGS TO ----
       Every site used to trail one, permanently, to a card standing in a fixed
       column. With one card at a time there is one line at a time: it belongs
       to the site the card is open on, and it is the thing that says THIS row
       is THAT dot. Nothing else on screen can say that.
       It also retires on the way down - a line reaching for a card that has
       scrolled out of the world is a line pointing at nothing. */
    if(ACT===p && DOCK && CLOSE<0.92){
      const cv=leaderCurve(p), LEADA=1-CLOSE;
      ox.globalAlpha=dim*LEADA;
      ox.beginPath();
      ox.moveTo(cv[0],cv[1]);
      ox.bezierCurveTo(cv[2],cv[3],cv[4],cv[5],cv[6],cv[7]);
      ox.strokeStyle=col+'d0'; ox.lineWidth=1.2;
      ox.stroke();
      /* a reading travelling out to its readout, once per beat - the only thing
         on this screen that shows which way the data moves */
      if(!reduced){
        const q=bezAt(cv,phase);
        const gr=ox.createRadialGradient(q[0],q[1],0,q[0],q[1],7);
        gr.addColorStop(0,col+'ff'); gr.addColorStop(1,col+'00');
        ox.globalAlpha=dim*LEADA*(0.35+0.65*Math.sin(phase*Math.PI));
        ox.fillStyle=gr; ox.beginPath(); ox.arc(q[0],q[1],7,0,Math.PI*2); ox.fill();
        ox.globalAlpha=dim*LEADA;
      }
      ox.beginPath(); ox.arc(cv[6],cv[7],2,0,Math.PI*2);
      ox.fillStyle=col+'ff'; ox.fill();
      ox.globalAlpha=dim;
    }

    /* ---- THE BEEP ----
       Every site pings, continuously, in green. A ring leaves the dot, widens
       and fades, and the glow underneath swells with it - the same gesture the
       live pip in the header uses, at the same 2.4s, so the whole portal
       breathes together.

       Three rules keep it from becoming a screensaver. The ring is thin and
       short-lived, so at any instant most of the picture is still a photograph.
       It eases OUT - fast away from the dot, slow as it dies - which is how a
       real signal leaves a source rather than how a balloon inflates. And the
       DOT itself never moves or fades: the thing you aim at is constant, and
       only the air around it is alive.

       phase runs 0 to 1 across the beat and is offset per site, so the fleet
       pings in sequence. */
    const beat  = reduced ? 1 : 0.62+0.38*(0.5+0.5*Math.cos(phase*Math.PI*2));

    /* The glow still yields to its neighbours: three sites in one district put
       three halos on top of each other, and the fleet became one smear with no
       countable sites in it. The DOT never yields, because the dot is capacity
       and capacity is not negotiable - only the glow, which is atmosphere. */
    const room=Math.max(0.34,Math.min(1,(p.near||1e9)/78));
    const hr=rad*3.0*room;
    const halo=ox.createRadialGradient(p.dx,p.dy,0,p.dx,p.dy,hr);
    halo.addColorStop(0,col+Math.round((60+lit*120)*beat).toString(16).padStart(2,'0'));
    halo.addColorStop(1,col+'00');
    ox.fillStyle=halo; ox.beginPath(); ox.arc(p.dx,p.dy,hr,0,Math.PI*2); ox.fill();

    /* a dark seat under the dot: over sunlit desert a green pip on its own has
       almost no edge, and the picker's whole job is that these are findable */
    ox.globalAlpha=dim*0.5; ox.fillStyle='#060b12';
    ox.beginPath(); ox.arc(p.dx,p.dy,rad+2.6,0,Math.PI*2); ox.fill();

    ox.globalAlpha=dim*(0.62+lit*0.38); ox.fillStyle=col;
    ox.beginPath(); ox.arc(p.dx,p.dy,rad,0,Math.PI*2); ox.fill();

    ox.globalAlpha=dim*beat; ox.strokeStyle=col; ox.lineWidth=1.2;
    ox.beginPath(); ox.arc(p.dx,p.dy,rad+2.6,0,Math.PI*2); ox.stroke();

    /* THE PING. Eased out with a cubic so it leaps away from the dot and then
       lingers as it dies; the alpha falls on the square of the remaining life,
       so the ring is faint for most of its travel and never competes with the
       marker at its centre. */
    if(!reduced){
      const e=1-Math.pow(1-phase,3);
      const left=1-phase;
      ox.globalAlpha=dim*left*left*0.85;
      ox.lineWidth=1.4; ox.strokeStyle=col;
      ox.beginPath(); ox.arc(p.dx,p.dy,rad+2.6+e*26,0,Math.PI*2); ox.stroke();
    }
    ox.restore();
  });

  /* ---- THE LABELS, IN A PASS OF THEIR OWN ----
     Second, and on top of every marker. Drawn inside the loop above, a plate
     could be laid over the next site's dot - and the dots are the one thing on
     this screen that must never be covered. All the marks first, then all the
     writing.

     The rail and the portfolio panel are put down as obstacles before any label
     is placed, so no plate can end up behind them. Ordered north to south so the
     arrangement is stable: the same fleet at the same zoom lays out the same way
     every frame, and nothing shuffles while you drag. */
  if(CLOSE>0.002){
    PLATES.length=0;
    const tb=$('theatre').getBoundingClientRect();
    ['.rail','.sumx'].forEach(function(sel){
      const el=document.querySelector(sel);
      if(!el) return;
      const r=el.getBoundingClientRect();
      PLATES.push({x:r.left-tb.left, y:r.top-tb.top, w:r.width, h:r.height});
    });
    PLANTS.filter(function(p){ return p.vis; })
          .sort(function(a,b){ return a.dy-b.dy; })
          .forEach(function(p){ drawSiteClose(p,COLOR.ok); });
  }
}

/* ---- clicking the world ----
   The name is the button, but the NODE is what a reader points at, so a click
   near a node opens that site. The radius is generous on purpose: these are
   small marks on a sphere, and asking for pixel accuracy on a globe you can
   also drag would make the picker feel broken. A drag is not a click - if the
   pointer travelled, the world turned and nothing opens. */
__on(oc,'click',function(e){
  /* A DRAG IS NOT A CLICK. The pointer going down and up over a dot is how you
     open a site AND how you pick one up to move it, so the only thing telling
     them apart is whether anything travelled in between. Six pixels is about
     the wobble of a deliberate click on a trackpad; anything past that was an
     attempt to move something, and it must not navigate away from the screen.
     This guard is why dragging a dot, or spinning the globe from a point that
     happens to sit on one, does not fling you into a site. */
  if(travelled>6) return;
  const xy=localXY(e), p=dotAt(xy[0],xy[1]);
  /* THE DOT MOVES THE CAMERA, AND THAT IS ALL IT DOES. Clicking a site on the
     globe means "take me closer to this one", so it flies down and stops there.

     It does NOT open the card. The card belongs to the rail: it appears under
     the pointer as you read down the fleet and it is put away by moving off,
     which is a gesture you can take back. A card opened by a click on the
     picture has to be dismissed by finding it again, and it arrives over the
     very ground the click asked to be shown.

     It also used to NAVIGATE - a click on a five-pixel mark, on a ball you can
     also spin. The drag guard above kept that honest, but the gesture was never
     worth the risk it was guarding. */
  if(p) descend(p);
});

/* ================= EVERY FRAME =================
   The camera eases, the world is redrawn, the readouts follow. Only two things
   move on their own: the camera on its way home, and the terminator, which
   moves because the sun does. */
const angTo=function(from,to){ return ((to-from+540)%360)-180; };

/* ---- THE PAGE IS LIT FROM WHERE THE SUN IS ----
   The warm wash and the rays behind this screen are anchored to a CSS custom
   property, and this is what writes it: the subsolar direction, projected into
   the same screen the globe is drawn in. Sun behind the reader and the light
   sits on the middle of the disc, which is exactly what a fully lit face means;
   sun at the limb and it sits just outside the edge, beside the terminator it
   drew; sun round the back and it retreats off the frame. Turn the world and
   the daylight on the page turns with it.

   Written only when the rounded pixel actually changes, because this runs sixty
   times a second and setting a custom property to the value it already holds
   still costs a style recalculation of the whole document. */
let sunPX=-1e9, sunPY=-1e9, sunDay=-1;
function sunCss(s){
  /* DAY FIRST, and separately from the position: the sun can be off the frame
     in the same place whether it is just past the limb or right round the back,
     and those are not the same picture. s.z is the whole of the difference - it
     is the cosine between the view axis and the sun, +1 dead behind the reader
     and -1 dead behind the planet. Daylight is held at full until the sun
     reaches the limb and is gone a little way past it, which is the same soft
     edge the terminator has and for the same reason: a sky that snapped from
     lit to black at one exact frame would be an event, and nothing happened. */
  const day=Math.max(0,Math.min(1,(s.z+0.28)/0.85));
  if(Math.abs(day-sunDay)>0.01){
    sunDay=DAYF=day;
    OPTS.root.style.setProperty('--day',day.toFixed(2));
  }
  const a=Math.hypot(s.x,s.y);
  const ux=a>1e-6?s.x/a:0, uy=a>1e-6?s.y/a:0;
  /* how far off the view axis the sun is, 0 at dead ahead and PI behind us */
  const ang=Math.acos(Math.max(-1,Math.min(1,s.z)));
  const rr=(ang/Math.PI)*2.2*R;
  /* no offset: the canvas is the window now, so canvas pixels and page pixels
     are the same pixels */
  const px=Math.round(CX+ux*rr), py=Math.round(CY-uy*rr);
  if(px===sunPX&&py===sunPY) return;
  sunPX=px; sunPY=py;
  const st=OPTS.root.style;
  st.setProperty('--sun-x',px+'px');
  st.setProperty('--sun-y',py+'px');
}
let last=performance.now();
function frame(now){
  const dt=Math.min(0.05,(now-last)/1000); last=now;

  idle+=dt;
  /* Coming home, and then never quite stopping.

     The camera returns to the fleet after a few idle seconds - that part is
     about not getting lost. What is new is that HOME is not a fixed point: it
     drifts a couple of degrees either side on a minute-long swing, so the
     terminator creeps, the limb turns, and the picture is never the same twice.
     A monitoring screen that is perfectly still is a monitoring screen you stop
     believing is connected. The amplitude is small enough that no site ever
     leaves the frame, and the period is long enough that nothing appears to be
     animating - it just refuses to be a photograph.

     The ZOOM is left where it was put: coming home is about not getting lost,
     and how close somebody chose to stand is not being lost. */
  if(!drag && !GOING && !isDown() && idle>5.5){
    const t=now/1000;
    tLAM=HOME.lam + (reduced?0:Math.sin(t*0.100)*2.6);
    tPHI=HOME.phi + (reduced?0:Math.sin(t*0.067)*1.1);
  }
  if(GOING){
    /* ---- GOING THROUGH THE GROUND ----
       descend() hands the camera a TARGET and lets this loop chase it, which is
       right for browsing: it decelerates into place, a drag can interrupt it,
       and it gives up once it arrives. None of that suits a departure. This one
       has to finish, has to finish ON TIME because the navigation is timed
       against it, and above all has to ACCELERATE - an exponential approach
       slows as it lands, which is the feel of arriving, and this is the feel of
       falling. So the camera is ASSIGNED its position rather than eased toward
       one, and FLY is left out of it entirely.

       THE TWO CURVES ARE THE WHOLE EFFECT, and getting them the same way round
       ruins it. A degree of longitude crosses more of the screen the closer the
       camera is, so a pan still running at 30x throws the site clean off the
       side of the frame. The pan is ease-OUT and is essentially done in the
       first third; the fall is ease-IN and has barely started by then. The
       camera arrives ABOVE the site, and only then goes down.

       It goes past DESC_Z to the ceiling. DESC_Z is where BROWSING stops -
       close enough to read the ground, far enough that you are not enlarging
       pixels - and stopping there would be arriving, again. This is not
       arriving anywhere on this page. */
    GO.t+=dt;
    const u=Math.min(1,GO.t/GO.dur);
    const pan=1-Math.pow(1-u,3), fall=u*u*u;
    LAM=GO.lam0+GO.dLam*pan;
    setPhi(GO.phi0+(GO.phi1-GO.phi0)*pan);
    ZOOM=Math.exp(GO.lz0+(GO.lz1-GO.lz0)*fall);
    R=R0*ZOOM;
    /* the targets are dragged along behind so nothing snaps if a departure is
       ever cancelled from somewhere this function cannot see */
    tLAM=LAM; tPHI=PHI; tZOOM=ZOOM;
    GOT=u;
  } else {
  const e=Math.min(1,dt*(drag?20:(FLY?1.7:2.8)));
  LAM+=angTo(LAM,tLAM)*e;
  setPhi(PHI+(tPHI-PHI)*e);
  /* LAM was unbounded: every westward drag subtracts and nothing brings it back,
     so after a few turns of the world it sits at -700 degrees. The projection
     never minded - it only ever uses (lng-LAM) - but the graticule labels did,
     and that is the 292 degrees W that was appearing over Rajasthan. */
  LAM=((LAM%360)+540)%360-180;
  if(Math.abs(tZOOM-ZOOM)>0.0005){
    /* EASED IN LOG SPACE, because zoom is multiplicative. Eased linearly, a
       descent from 1 to 22 covers half its distance while still up at 11 - it
       leaves briskly and then crawls the last, most interesting part. In log
       space every second doubles, which is what falling actually feels like. */
    const lz=Math.log(ZOOM), lt=Math.log(tZOOM);
    ZOOM=Math.exp(lz+(lt-lz)*Math.min(1,dt*(FLY?1.55:6.5)));
    R=R0*ZOOM;
    if(FLY && Math.abs(lt-Math.log(ZOOM))<0.02) FLY=false;
  }
  }
  /* the fleet's own ground comes up as the planet gets close, and is completely
     in by the time the curvature has left the frame */
  REGMIX=Math.max(0,Math.min(1,(ZOOM-2.6)/(9.0-2.6)));

  /* every site is asked whether its own sun is up, once per frame and from the
     same subsolar point the terminator is drawn from, so a dot can never
     disagree with the shadow it is standing in */
  const sub=subsolar(Date.now()+SUNSHIFT);
  PLANTS.forEach(function(p){ p.sunUp=sunUpAt(p,sub); });

  place();
  /* WHERE THE HOLE IS. The iris closes on the site being opened rather than on
     the middle of the window, so the site's live position has to reach the
     stylesheet - the same trip --sun-x and --sun-y already make every frame,
     and for the same reason: CSS can light and frame a picture it cannot see,
     provided something that CAN see it keeps telling it where things are.
     Viewport pixels on both sides: the theatre is inset:0 and so is the iris. */
  if(GOING && GOING.vis){
    const gs=OPTS.root.style;
    gs.setProperty('--go-x',GOING.x.toFixed(1)+'px');
    gs.setProperty('--go-y',GOING.y.toFixed(1)+'px');
  }
  ox.clearRect(0,0,W,H);
  /* the void first, and everything after it is drawn on top of a sky that has
     already been bent by the thing about to be drawn into the hole in it */
  drawSpace(now);

  const s=sunView();
  /* the page is lit from where the sun is, and this is the one line that makes
     that true rather than decorative */
  sunCss(s);
  /* and the deep sky behind it travels, for exactly the same reason */
  /* The photograph if the machine can show one, the diagram if it cannot. This
     is the only place the two globes meet, and drawEarth reports whether it
     actually drew - so a WebGL context that exists but has not finished loading
     its texture still gets the vector globe for those few frames rather than a
     hole where the world should be. */
  if(!drawEarth(sub)){
    drawAir();
    drawSea(s);
    drawLandVector();
    /* the 2D terminator belongs to the VECTOR globe alone now. Over the
       photograph the shader lights the night side per pixel instead, which is
       both truer and the only way the city lights could work at all. */
    if(NIGHT) drawNight(s);
    drawLimb();
  }
  /* THE BORDER OVERLAY IS GONE. It was drawn when the globe was a diagram and
     an outline was the only way to say which country a site stood in. Over a
     photograph it reads as tracing paper laid on a picture - and the picture
     already says where India is, in more detail than any traced line could.
     The graticule stays, faint: it is not a border, it is the only mark on a
     featureless ocean that shows the world turning under a drag. */
  drawGrat();
  /* LAST BEFORE THE FLEET. The field goes over the photograph, the night and
     the city lights alike - all three are the picture, and the close view is
     what replaces the picture - but never over the sites, which are the one
     thing this screen exists to show. */
  CLOSE=Math.max(0,Math.min(1,(ZOOM-CLOSE_IN)/(CLOSE_FULL-CLOSE_IN)));
  /* THE COLUMNS STAND DOWN. They are orbital furniture: two rails of cards
     beside a planet. Once the ground is under you the labels ON the ground say
     the same things in the place they belong, so the rails get out of the way
     rather than competing with what you came down to look at. */
  const th=$('theatre'), down=CLOSE>0.45;
  if(th._down!==down){
    th._down=down;
    th.classList.toggle('down',down);
    /* the strip is a SIBLING of the theatre, not a child, so it cannot be
       reached from the theatre's own class. On the ground it needs a deeper
       scrim than it does in orbit - see the rule this switches. */
    document.body.classList.toggle('down',down);
  }
  drawClose();
  drawSites(now,dt);

  /* Nothing is printed over the globe. The fleet total lives in the panel on
     the right and the site figures live in the card, and a figure printed
     twice on one screen is a figure that can be read twice and trusted once.
     The field is only the picture. */
  guard(paintChips);
  __raf(frame);
}

/* Runs a paint and refuses to let it take the frame loop with it. Reported
   once per distinct fault - a throw on the frame clock would otherwise write
   sixty identical lines a second and bury itself. */
const SAID={};
function guard(fn){
  try{ fn(); }
  catch(err){
    const k=String(err&&err.message||err);
    if(!SAID[k]){ SAID[k]=1; console.error('[enerops] readout fault:',err); }
  }
}

/* THE PICTURE STARTS FIRST, AND ON ITS OWN.
   These paints used to run above this line, and when one of them threw the
   frame loop was never scheduled: a single bad write in a readout blanked the
   planet, the stars and the descent, and left a dead screen wearing its
   placeholder dashes. The globe is the thing this page IS. It goes up before
   any instrument is allowed to touch it, and the instruments are guarded, so
   the worst a broken readout can now cost is that readout. */
place();
__raf(frame);
guard(function(){ paintChips(); paintSlow(); });

/* ================= THE ARRIVAL =================
   The screen opens on the whole planet and then GOES to the fleet.

   Cutting straight to the ground would answer "where is it" without ever having
   asked - the sites would simply be somewhere, on a map, the way sites are on
   every other portal. Falling to them says the thing the globe was chosen to
   say: that these three are a long way from each other, in a particular corner
   of a particular world, and that this is what it looks like there.

   It yields immediately. Any pointer, wheel or key inside the first beat and
   the descent never starts - a screen that keeps flying while somebody is
   trying to drag it is a screen fighting its reader. */
let touched=false;
['pointerdown','wheel','keydown'].forEach(function(ev){
  __on(window,ev,function(){ touched=true; },{once:true,passive:true});
});
__st(function(){ if(!touched && !reduced) descend(null); },1400);

/* clicking the empty field does nothing on purpose: there is no "all sites"
   destination, and a stray click should not be a navigation */

/* ================= WALKING THE GLOBE =================
   Tab reaches the sites, but the natural way through a picture is to move
   across it. On the ring, ArrowRight meant "the next one round", which was the
   backend's list order wearing a shape. Here it means what the key says: the
   next site to the EAST. Left goes west. Enter opens whatever the cursor is on,
   which the button already does.

   A globe adds a problem a flat picker does not have: the next site east may be
   round the back of the world. So stepping TURNS THE WORLD - the camera is
   aimed at the site and the globe rolls round to it. The focus, though, lands
   immediately: every site has a card standing in its column whether or not the
   world is currently showing it, so the keyboard reaches the whole portfolio at
   once and then watches the picture come and meet it.

   Ordering is by longitude and wraps, so the easternmost steps back to the
   westernmost.

   A typed character is left alone - nothing on this screen takes text, but a
   browser find bar does, and stealing the arrow keys from it would be rude. */
const westEast=PLANTS.slice().sort(function(a,b){ return a.lng-b.lng; });
function goTo(p){
  tLAM=p.lng; tPHI=p.lat;
  /* negative, so the camera holds on the site for a few seconds longer than an
     ordinary idle before it drifts back to the fleet */
  idle=-3;
  /* The card is always there to be focused now, whichever side of the world its
     site is on, so the focus lands at once and the globe turns to catch up. The
     old hand-off - focus the button once it clears the horizon - existed only
     because a hidden site had no button to focus. */
  /* the row IS the control now, so the keyboard lands on it directly - and it
     is always there to be landed on, whichever side of the world its site is
     currently on */
  p._row2.focus();
  p._row2.scrollIntoView({block:'nearest'});
  show(p);
}
__on(window,'keydown',function(e){
  /* Escape comes back up. It is the one key a person tries when a screen has
     taken them somewhere, and it costs two lines to have it work. */
  /* Escape gives back the most recently taken thing first: the card that is
     being held open, and only then the descent. */
  if(e.key==='Escape'&&ACT){ e.preventDefault(); shut(); return; }
  if(e.key==='Escape'&&isDown()){ e.preventDefault(); orbit(); return; }
  if(e.key!=='ArrowLeft'&&e.key!=='ArrowRight') return;
  if(e.altKey||e.ctrlKey||e.metaKey) return;
  const n=westEast.length; if(!n) return;
  const step=e.key==='ArrowRight'?1:-1;
  let at=-1;
  for(let i=0;i<n;i++) if(westEast[i]._row2===document.activeElement) at=i;
  e.preventDefault();
  goTo(westEast[at<0?(step>0?0:n-1):(at+step+n)%n]);
});

/* ================= THE LIST ================= */
const fl=$('flist');
PLANTS.forEach(p=>{
  const b=document.createElement('button');
  b.className='frow'; b.type='button';
  __on(b,'click',()=>open(p));
  fl.appendChild(b);
  p._row=b;
});
function paintList(){
  PLANTS.forEach(p=>{
    const st=stateOf(p), kw=outputOf(p);
    p._row.innerHTML=
      '<span class="dot" style="background:'+COLOR[st]+'"></span>'+
      '<span><span class="nm">'+p.id+'</span><br><span class="ac">'+num(p.ac)+' kW AC · '+
        (p.dev-p.down)+'/'+p.dev+' online</span></span>'+
      '<span class="kw">'+(st==='off'?'OFFLINE':num(kw)+' kW')+'</span>';
  });
}

/* The slow tick carries everything that is measured over a day rather than an
   instant: each card's energy and money, the fallback list, and the portfolio
   strip. All of it moves on the hour hand, and none of it is worth a frame. */
const tick=function(){ paintList(); paintSlow(); };
tick(); __si(tick,10000);

/* the clock is the one thing on the page that has to move every second */
const clock=function(){
  const d=new Date();
  $('clk').textContent=d.toLocaleTimeString('en-IN',{hour12:true,hour:'2-digit',minute:'2-digit',second:'2-digit'});
};
clock(); __si(clock,1000);

/* ================= THE WAY OUT =================
   Leaving the page takes all of it down: the frame loop and timers stop, every
   window listener goes, the classes this screen put on <body> come off, and the
   GPU context is released rather than left for the collector. */
return {
  stop:function(){
    __alive=false;
    __offs.forEach(function(f){ f(); });
    __timers.forEach(clearTimeout); __ints.forEach(clearInterval);
    document.body.classList.remove('going','down');
    try{ const lose=gl&&gl.getExtension('WEBGL_lose_context'); if(lose) lose.loseContext(); }catch(e){}
  },
  /* fresh figures arrived (the wrapper mutated the site objects): repaint now
     rather than waiting for the next ten-second tick */
  refresh:function(){ guard(function(){ paintChips(); paintSlow(); paintList(); }); }
};
}
