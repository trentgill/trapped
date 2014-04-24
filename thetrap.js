inlets = 2; // 0: grid, 1: arc
outlets = 3; // 0: grid, 1: arc, 2: to-midi

var bx = 16;
var by = 8;

var gLeds0 = new Array(64);
var gLeds1 = new Array(64);
var ledBuffer = new Array(64);
var trapNow = new Array(64);
	for(i=0;i<64;i++) { ledBuffer[i] = 0; gLeds0[i] = 0; gLeds1[i] = 0; }

var gMults = new Array(8); // -2,-1,0,1,2
var gMutes = new Array(8);
	for(i=0;i<8;i++) { gMults[i] = 0; gMutes[i] = 0; }
var gSel = new Array(2); // [0] = which sounds, [1] = currently held?

//// ARC SETTINGS ////
var aSens = 0.001; // smaller numbers are more sensitive
var aState = new Array(8);
	for(i=0;i<8;i++) {
		aState[i] = new Array(4);
		for(j=0;j<4;j++) aState[i][j] = 0.5; // initialise all arc values to mid level
	}
var aLedBuf = new Array(4); // 1 temp buffer for each arc ring
var aLeds = new Array(4); // 1 array per arc ring
	for(i=0;i<4;i++) {
		aLedBuf[i] = new Array(64); // 64 cells for temp display
		for(a=0;a<64;a++) aLedBuf[i][a] = 0; // clear arc led buffer
		aLeds[i] = new Array(8); // 8 copies of each ring, 1 for each grid row
		for(j=0;j<8;j++) aLeds[i][j] = new Array(64); // 64 cells in each array for display
	}
var aRepeats = new Array(8); // stores the number of repeats in the gated section
var cRepeats = new Array(8); // stores the number of current counted repeats
var aSize = 2; // how many arc rings

function init() {
	// initialisation function
	gMutes[0] = 1;
	for(i=0;i<8;i++) {
		gLeds0[i+56] = gMutes[i]*15; // draw mutes
		gSel[0] = i;
		arcMoved(i,0); // call bogus movement to redraw arc
	}
	gSel[0] = 0;
	gSel[1] = 0;
	gLeds0[gSel[0]+48] = 15;
}

function anything() {
	var args = arrayfromargs(messagename, arguments);

	if(inlet==0) { ///// GRID INPUT /////
		if(args[0]=="/trap-g/grid/key") {
			if(args[1]<8) { // only left quadrant
				if(args[2]>0 && args[2]<6) { // change mult
					if(args[3]==1) calcMults(args[1],args[2]);
				}
				else if(args[2]==6) { // change selection
					gSel[0] = args[1]; // store x-value of selection
					gSel[1] = args[3]; // store held state of selection

						// draw selection
					for(i=0;i<8;i++) gLeds0[i+48] = 0;
					gLeds0[gSel[0]+48] = 15;
				}
				else if(args[2]==7) {
					if(args[3]==1) gMutes[args[1]] = 1-gMutes[args[1]]; // invert mute state
					for(i=0;i<8;i++) gLeds0[i+56] = gMutes[i]*15; // draw mutes
				}
			}
		}
		else if(args[0]=="/sys/size") { bx = args[1]; by = args[2]; }
		else if(args[0]=="focus") {
			if(args[1]==0) frame.cancel();
			else frame.repeat();
		}
	}
	else if(inlet==1) { ///// ARC INPUT /////
		if(args[0]=="/trap-a/enc/delta") { // update counters with max/min limited to 0/1
			// would be best to allow full rotation of phase to avoid the focus on the 'zero' point
			if(aSize==2) { // 2 knobs
				if(args[1]==0) { // first knob
					if(gSel[1]==0) { // if phase, let it wrap
						aState[gSel[0]][0] = aState[gSel[0]][0] + (args[2]*aSens);
						if(aState[gSel[0]][0] >= 1) aState[gSel[0]][0]--; // if more than 1, wrap by sub 1
						else if(aState[gSel[0]][0] <= 0) aState[gSel[0]][0]++; // if less than 0, wrap by add 1
					}
					else aState[gSel[0]][1] = Math.min(0.984375, Math.max(0, aState[gSel[0]][1] + (args[2]*aSens))); // if sel pressed, this is brace end, limited to 63/64
				}
				else { // second knob (add volume fade on gSel[1]==1 here)
					aState[gSel[0]][2] = Math.min(1, Math.max(0, aState[gSel[0]][2] + (args[2]*aSens))); // repeat speed
				}
			}
			else if(aSize==4) { // 4 knobs
				if(args[1]==0) { // if phase, let it wrap
					aState[gSel[0]][0] = aState[gSel[0]][0] + (args[2]*aSens);
					if(aState[gSel[0]][0] >= 1) aState[gSel[0]][0]--; // if more than 1, wrap by sub 1
					else if(aState[gSel[0]][0] <= 0) aState[gSel[0]][0]++; // if less than 0, wrap by add 1
				}
				else if(args[1]==1) aState[gSel[0]][args[1]] = Math.min(0.984375, Math.max(0, aState[gSel[0]][args[1]] + (args[2]*aSens)));
				else aState[gSel[0]][args[1]] = Math.min(1, Math.max(0, aState[gSel[0]][args[1]] + (args[2]*aSens)));
			}
			
			if(args[1]==0) newPhase(gSel[0]); // first ring is new phase
			else if(args[1]==1) newRepeats(gSel[0]); // second ring is new repeat time
			arcMoved(args[1],args[2]); // calc leds
		}
		else if(args[0]=="monome arc 2") { aSize = 2; }
		else if(args[0]=="monome arc 4") { aSize = 4; }
	}
}


///// MULTIPLIERS /////
var preMul = [0.5, 0.6667, 1, 1.5, 2]
redrawMults(); // run redraw on init
function calcMults(x,y) { // set a new mult
	gMults[x] = y-3; // invert mute state

	if(x==0) trapClock0.interval = baseTime * preMul[y-1];
	else if(x==1) trapClock1.interval = baseTime * preMul[y-1];
	else if(x==2) trapClock2.interval = baseTime * preMul[y-1];
	else if(x==3) trapClock3.interval = baseTime * preMul[y-1];
	else if(x==4) trapClock4.interval = baseTime * preMul[y-1];
	else if(x==5) trapClock5.interval = baseTime * preMul[y-1];
	else if(x==6) trapClock6.interval = baseTime * preMul[y-1];
	else if(x==7) trapClock7.interval = baseTime * preMul[y-1];
	
	newPhase(x); // new clock means phase has changed
	newRepeats(x); // new clock means repeat time has changed

	// draw multipliers
	switch(gMults[x]) {
		case -2:
			gLeds0[x+8] = 15;
			gLeds0[x+16] = 5;
			gLeds0[x+24] = 5;
			gLeds0[x+32] = 0;
			gLeds0[x+40] = 0;
			break;
		case -1:
			gLeds0[x+8] = 0;
			gLeds0[x+16] = 15;
			gLeds0[x+24] = 5;
			gLeds0[x+32] = 0;
			gLeds0[x+40] = 0;
			break;
		case 0:
			gLeds0[x+8] = 0;
			gLeds0[x+16] = 0;
			gLeds0[x+24] = 15;
			gLeds0[x+32] = 0;
			gLeds0[x+40] = 0;
			break;
		case 1:
			gLeds0[x+8] = 0;
			gLeds0[x+16] = 0;
			gLeds0[x+24] = 5;
			gLeds0[x+32] = 15;
			gLeds0[x+40] = 0;
			break;
		case 2:
			gLeds0[x+8] = 0;
			gLeds0[x+16] = 0;
			gLeds0[x+24] = 5;
			gLeds0[x+32] = 5;
			gLeds0[x+40] = 15;
			break;
	}
}

function redrawMults() {
	// draw multipliers
	for(i=0;i<8;i++) {
		for(y=1;y<6;y++) gLeds0[i+8*y] = 0; // clear mult

		switch(gMults[i]) {
			case -2:
				gLeds0[i+8] = 15;
				gLeds0[i+16] = 5;
				gLeds0[i+24] = 5;
				break;
			case -1:
				gLeds0[i+16] = 15;
				gLeds0[i+24] = 5;
				break;
			case 0:
				gLeds0[i+24] = 15;
				break;
			case 1:
				gLeds0[i+24] = 5;
				gLeds0[i+32] = 15;
				break;
			case 2:
				gLeds0[i+24] = 5;
				gLeds0[i+32] = 5;
				gLeds0[i+40] = 15;
				break;
		}
	}	
}


	//////////////////
	//////////////////
	///// TIMERS /////
	//////////////////
	//////////////////

baseTime = 5000; // this is the total time for 1 revolution at the base rate (future: tempo calc)

var trapClock0 = new Task(clock0, this);
var trapClock1 = new Task(clock1, this);
var trapClock2 = new Task(clock2, this);
var trapClock3 = new Task(clock3, this);
var trapClock4 = new Task(clock4, this);
var trapClock5 = new Task(clock5, this);
var trapClock6 = new Task(clock6, this);
var trapClock7 = new Task(clock7, this);

trapClock0.interval = baseTime;
trapClock1.interval = baseTime;
trapClock2.interval = baseTime;
trapClock3.interval = baseTime;
trapClock4.interval = baseTime;
trapClock5.interval = baseTime;
trapClock6.interval = baseTime;
trapClock7.interval = baseTime;

trapClock0.repeat();
trapClock1.repeat();
trapClock2.repeat();
trapClock3.repeat();
trapClock4.repeat();
trapClock5.repeat();
trapClock6.repeat();
trapClock7.repeat();

///// 0 /////

var phase0dec = 1;
function clock0 () {
	trapPhase0.cancel(); // stop the phase counter
	playHead[0] = 0;
	phase0dec = 1;
	newPhase(0); // calc phase offset time
	trapPhase0.repeat(2); // restart the phase counter & repeat once
}

var trapPhase0 = new Task(phase0, this);
function phase0 () {
	if(phase0dec==0) { // has waited for phase to arrive so trigger repeats
		trapRepeat0.cancel(); // reset repeater
		newRepeats(0); // calc repeat ms time
		cRepeats[0] = 1; // init repeat counter to 1 (zero had 1 extra trigger?)
		trapRepeat0.repeat();
	}
	phase0dec--;
}

var trapRepeat0 = new Task(repeat0, this);
function repeat0 () {
	if(cRepeats[0]>=aRepeats[0]) trapRepeat0.cancel(); // cancel if 
	if(gMutes[0]==1) outlet(2,0); // retriggers inside of phase
	cRepeats[0]++; // count repeats
}

///// 1 /////

var phase1dec = 1;
function clock1 () {
	trapPhase1.cancel(); // stop the phase counter
	playHead[1] = 0;
	phase1dec = 1;
	newPhase(1); // calc phase offset time
	trapPhase1.repeat(2); // restart the phase counter & repeat once
}

var trapPhase1 = new Task(phase1, this);
function phase1 () {
	if(phase1dec==0) { // has waited for phase to arrive so trigger repeats
		trapRepeat1.cancel(); // reset repeater
		newRepeats(1); // calc repeat ms time
		cRepeats[1] = 1; // init repeat counter to 1 (zero had 1 extra trigger?)
		trapRepeat1.repeat();
	}
	phase1dec--;
}

var trapRepeat1 = new Task(repeat1, this);
function repeat1 () {
	if(cRepeats[1]>=aRepeats[1]) trapRepeat1.cancel(); // cancel if 
	if(gMutes[1]==1) outlet(2,1); // retriggers inside of phase
	cRepeats[1]++; // count repeats
}

///// 2 /////

var phase2dec = 1;
function clock2 () {
	trapPhase2.cancel(); // stop the phase counter
	playHead[2] = 0;
	phase2dec = 1;
	newPhase(2); // calc phase offset time
	trapPhase2.repeat(2); // restart the phase counter & repeat once
}

var trapPhase2 = new Task(phase2, this);
function phase2 () {
	if(phase2dec==0) { // has waited for phase to arrive so trigger repeats
		trapRepeat2.cancel(); // reset repeater
		newRepeats(2); // calc repeat ms time
		cRepeats[2] = 1; // init repeat counter to 1 (zero had 1 extra trigger?)
		trapRepeat2.repeat();
	}
	phase2dec--;
}

var trapRepeat2 = new Task(repeat2, this);
function repeat2 () {
	if(cRepeats[2]>=aRepeats[2]) trapRepeat2.cancel(); // cancel if 
	if(gMutes[2]==1) outlet(2,2); // retriggers inside of phase
	cRepeats[2]++; // count repeats
}

///// 3 /////

var phase3dec = 1;
function clock3 () {
	trapPhase3.cancel(); // stop the phase counter
	playHead[3] = 0;
	phase3dec = 1;
	newPhase(3); // calc phase offset time
	trapPhase3.repeat(2); // restart the phase counter & repeat once
}

var trapPhase3 = new Task(phase3, this);
function phase3 () {
	if(phase3dec==0) { // has waited for phase to arrive so trigger repeats
		trapRepeat3.cancel(); // reset repeater
		newRepeats(3); // calc repeat ms time
		cRepeats[3] = 1; // init repeat counter to 1 (zero had 1 extra trigger?)
		trapRepeat3.repeat();
	}
	phase3dec--;
}

var trapRepeat3 = new Task(repeat3, this);
function repeat3 () {
	if(cRepeats[3]>=aRepeats[3]) trapRepeat3.cancel(); // cancel if 
	if(gMutes[3]==1) outlet(2,3); // retriggers inside of phase
	cRepeats[3]++; // count repeats
}

///// 4 /////

var phase4dec = 1;
function clock4 () {
	trapPhase4.cancel(); // stop the phase counter
	playHead[4] = 0;
	phase4dec = 1;
	newPhase(4); // calc phase offset time
	trapPhase4.repeat(2); // restart the phase counter & repeat once
}

var trapPhase4 = new Task(phase4, this);
function phase4 () {
	if(phase4dec==0) { // has waited for phase to arrive so trigger repeats
		trapRepeat4.cancel(); // reset repeater
		newRepeats(4); // calc repeat ms time
		cRepeats[4] = 1; // init repeat counter to 1 (zero had 1 extra trigger?)
		trapRepeat4.repeat();
	}
	phase4dec--;
}

var trapRepeat4 = new Task(repeat4, this);
function repeat4 () {
	if(cRepeats[4]>=aRepeats[4]) trapRepeat4.cancel(); // cancel if 
	if(gMutes[4]==1) outlet(2,4); // retriggers inside of phase
	cRepeats[4]++; // count repeats
}

///// 5 /////

var phase5dec = 1;
function clock5 () {
	trapPhase5.cancel(); // stop the phase counter
	playHead[5] = 0;
	phase5dec = 1;
	newPhase(5); // calc phase offset time
	trapPhase5.repeat(2); // restart the phase counter & repeat once
}

var trapPhase5 = new Task(phase5, this);
function phase5 () {
	if(phase5dec==0) { // has waited for phase to arrive so trigger repeats
		trapRepeat5.cancel(); // reset repeater
		newRepeats(5); // calc repeat ms time
		cRepeats[5] = 1; // init repeat counter to 1 (zero had 1 extra trigger?)
		trapRepeat5.repeat();
	}
	phase5dec--;
}

var trapRepeat5 = new Task(repeat5, this);
function repeat5 () {
	if(cRepeats[5]>=aRepeats[5]) trapRepeat5.cancel(); // cancel if 
	if(gMutes[5]==1) outlet(2,5); // retriggers inside of phase
	cRepeats[5]++; // count repeats
}

///// 6 /////

var phase6dec = 1;
function clock6 () {
	trapPhase6.cancel(); // stop the phase counter
	playHead[6] = 0;
	phase6dec = 1;
	newPhase(6); // calc phase offset time
	trapPhase6.repeat(2); // restart the phase counter & repeat once
}

var trapPhase6 = new Task(phase6, this);
function phase6 () {
	if(phase6dec==0) { // has waited for phase to arrive so trigger repeats
		trapRepeat6.cancel(); // reset repeater
		newRepeats(6); // calc repeat ms time
		cRepeats[6] = 1; // init repeat counter to 1 (zero had 1 extra trigger?)
		trapRepeat6.repeat();
	}
	phase6dec--;
}

var trapRepeat6 = new Task(repeat6, this);
function repeat6 () {
	if(cRepeats[6]>=aRepeats[6]) trapRepeat6.cancel(); // cancel if 
	if(gMutes[6]==1) outlet(2,6); // retriggers inside of phase
	cRepeats[6]++; // count repeats
}

///// 7 /////

var phase7dec = 1;
function clock7 () {
	trapPhase7.cancel(); // stop the phase counter
	playHead[7] = 0;
	phase7dec = 1;
	newPhase(7); // calc phase offset time
	trapPhase7.repeat(2); // restart the phase counter & repeat once
}

var trapPhase7 = new Task(phase7, this);
function phase7 () {
	if(phase7dec==0) { // has waited for phase to arrive so trigger repeats
		trapRepeat7.cancel(); // reset repeater
		newRepeats(7); // calc repeat ms time
		cRepeats[7] = 1; // init repeat counter to 1 (zero had 1 extra trigger?)
		trapRepeat7.repeat();
	}
	phase7dec--;
}

var trapRepeat7 = new Task(repeat7, this);
function repeat7 () {
	if(cRepeats[7]>=aRepeats[7]) trapRepeat7.cancel(); // cancel if 
	if(gMutes[7]==1) outlet(2,7); // retriggers inside of phase
	cRepeats[7]++; // count repeats
}

	//////////////////
	//////////////////
	//// ARC INPUT ///
	//////////////////
	//////////////////


function arcMoved(i,d) { // arc movement: index, delta

	// aLeds[0] = phase offset
	// aLeds[1] = repeat length
	// aLeds[2] = repeat rate
	// aLeds[3] = volume / tempo - something else???

	// find integer rounded phase, length, rate
	var aPhase = Math.floor(aState[gSel[0]][0]*64);
	var aLength = Math.floor(aState[gSel[0]][1]*64);
	var aRate = Math.floor(aState[gSel[0]][2]*64);
	var aBrace = Math.floor((aState[gSel[0]][0] + aState[gSel[0]][1]) *64);

	var rateDiv = Math.pow(2,aState[gSel[0]][2]*6);

	// the remainders of the above rounding, for smoothed drawing
	var pRem = aState[gSel[0]][0]*64 - aPhase;
	var lRem = aState[gSel[0]][1]*64 - aLength;
	var rRem = aState[gSel[0]][2]*64 - aRate;
	var bRem = ((aState[gSel[0]][0] + aState[gSel[0]][1]) *64) - aBrace;

	var curDiv = aPhase+pRem; // initialise the first retrigger at the phase offset point (float)


		///// LED FUNCTIONS /////


	// clear arc led buffer for all rings (could do only those being redrawn?)
	for(i=0;i<64;i++)
		for(j=0;j<4;j++) aLeds[j][gSel[0]][i] = 0;

	// draw low-bright brace into displays
	for(i=aPhase;i<aBrace+1;i++)
		for(j=0;j<4;j++) aLeds[j][gSel[0]][i%64] = 3;

	// add fades on start/end of brace
	for(j=0;j<4;j++) {
		aLeds[j][gSel[0]][aPhase%64] = Math.ceil(aLeds[j][gSel[0]][aPhase%64]*(1-pRem)); // first cell
		aLeds[j][gSel[0]][(aBrace+1)%64] = 3 * bRem; // last cell
	}
	
	// phase ring -> brighten front cell
	aLeds[0][gSel[0]][aPhase%64] = 15*(1-pRem);
	aLeds[0][gSel[0]][(aPhase+1)%64] = Math.max(aLeds[0][gSel[0]][(aPhase+1)%64], 15*pRem);

	// length ring -> brighten last cell
	aLeds[1][gSel[0]][aBrace%64] = Math.max(aLeds[1][gSel[0]][(aBrace)%64], 15*(1-bRem));
	aLeds[1][gSel[0]][(aBrace+1)%64] = 15*(bRem);

	aRepeats[gSel[0]] = 0;

	// rate ring -> draw all valid instances inside loop brace
	while(curDiv < aBrace) { // add new triggers for each point inside repeat brace -> move to ring 2
		var iDiv = Math.floor(curDiv); // integer version of curDiv
		var rDiv = curDiv - iDiv; // remainder from integer rounding

		aLeds[2][gSel[0]][iDiv%64] = Math.max(15 * (1-rDiv), aLeds[2][gSel[0]][iDiv%64]);
		aLeds[2][gSel[0]][(iDiv+1)%64] = Math.max(15 * rDiv, aLeds[2][gSel[0]][(iDiv+1)%64]);
	
		curDiv += rateDiv; // add the step division value to the counter, and run again if inside brace
		aRepeats[gSel[0]]++; // for every loop, add 1 to number of repetitions
	}
}

function newPhase(i) { // RECALC PHASE TIMERS //
	if(i==0) trapPhase0.interval = Math.min(trapClock0.interval-10, Math.max(trapClock0.interval * aState[0][0], 10)); // limit to 10ms to ensure trigger
	else if(i==1) trapPhase1.interval = Math.min(trapClock1.interval-10, Math.max(trapClock1.interval * aState[1][0], 10));
	else if(i==2) trapPhase2.interval = Math.min(trapClock2.interval-10, Math.max(trapClock2.interval * aState[2][0], 10));
	else if(i==3) trapPhase3.interval = Math.min(trapClock3.interval-10, Math.max(trapClock3.interval * aState[3][0], 10));
	else if(i==4) trapPhase4.interval = Math.min(trapClock4.interval-10, Math.max(trapClock4.interval * aState[4][0], 10));
	else if(i==5) trapPhase5.interval = Math.min(trapClock5.interval-10, Math.max(trapClock5.interval * aState[5][0], 10));
	else if(i==6) trapPhase6.interval = Math.min(trapClock6.interval-10, Math.max(trapClock6.interval * aState[6][0], 10));
	else if(i==7) trapPhase7.interval = Math.min(trapClock7.interval-10, Math.max(trapClock7.interval * aState[7][0], 10));
}

function newRepeats(i) { // RECALC REPEAT SPEED //
	if(i==0) trapRepeat0.interval = Math.max(trapClock0.interval * (Math.pow(2,aState[0][2]*6)/64), 10);
	else if(i==1) trapRepeat1.interval = Math.max(trapClock1.interval * (Math.pow(2,aState[1][2]*6)/64), 10);
	else if(i==2) trapRepeat2.interval = Math.max(trapClock2.interval * (Math.pow(2,aState[2][2]*6)/64), 10);
	else if(i==3) trapRepeat3.interval = Math.max(trapClock3.interval * (Math.pow(2,aState[3][2]*6)/64), 10);
	else if(i==1) trapRepeat4.interval = Math.max(trapClock4.interval * (Math.pow(2,aState[4][2]*6)/64), 10);
	else if(i==2) trapRepeat5.interval = Math.max(trapClock5.interval * (Math.pow(2,aState[5][2]*6)/64), 10);
	else if(i==3) trapRepeat6.interval = Math.max(trapClock6.interval * (Math.pow(2,aState[6][2]*6)/64), 10);
	else if(i==1) trapRepeat7.interval = Math.max(trapClock7.interval * (Math.pow(2,aState[7][2]*6)/64), 10);
}


var frame = new Task(trapThis, this);
frame.interval = 25; // 40fps redraw
frame.repeat(); // should remove so only starts on grid focus

var playHead = new Array(8);

// init drawing // 
	// clear top row (temporary) & initialise all playheads to 0
	for(i=0;i<8;i++) { gLeds0[i] = 0; playHead[i] = 0; }


function trapThis () { // calculate framerate displays
	// add any per-frame drawing tasks in here
	// might need to add one last set of arc led buffers to avoid destructive changes

	// add 'current play position' marker overlay in here

	// calc playback position every frame
	// add the old value to the frame length / cycle length
	// wrap the output to 1 for continuous cycling
	playHead[0] = (playHead[0] + frame.interval / trapClock0.interval) %1;
	playHead[1] = (playHead[1] + frame.interval / trapClock1.interval) %1;
	playHead[2] = (playHead[2] + frame.interval / trapClock2.interval) %1;
	playHead[3] = (playHead[3] + frame.interval / trapClock3.interval) %1;
	playHead[4] = (playHead[4] + frame.interval / trapClock4.interval) %1;
	playHead[5] = (playHead[5] + frame.interval / trapClock5.interval) %1;
	playHead[6] = (playHead[6] + frame.interval / trapClock6.interval) %1;
	playHead[7] = (playHead[7] + frame.interval / trapClock7.interval) %1;

	// ^^^ when trapClockx repeats call a reset to playHead to keep animation aligned


	// DRAW CASCADING GRID DISPLAY HERE //
	// for each column (channel) look in arc buffers over the next 8 steps for 
	// first find the phase marker aState[x][0] is 0-1 location
	for(i=0;i<64;i++) gLeds1[i] = 0;

	for(i=0;i<8;i++) { // draw each sequence column
		// draw the first note (ie. phase head)
		if((aState[i][0] > playHead[i] && aState[i][0] < (playHead[i]+0.125))) { // inside viewable area
			var floor = Math.floor((aState[i][0] - playHead[i])*64);
			var rem = ((aState[i][0] - playHead[i])*64) - floor;

			gLeds1[i + 8*floor] = Math.ceil(15 * (1-rem));
			if((i + 8*(floor+1)) < 64) gLeds1[i + 8*(floor+1)] = Math.ceil(15 * rem);
		}
		else if(((playHead[i]+0.125) > 1) && (aState[i][0] < (playHead[i]-0.875))) { // in roll over area
			post(2,"\n");
			var floor = Math.floor((aState[i][0] - playHead[i] + 1)*64);
			var rem = ((aState[i][0] - playHead[i] + 1)*64) - floor;

			gLeds1[i + 8*floor] = Math.ceil(15 * (1-rem));
			if((i + 8*(floor+1)) < 64) gLeds1[i + 8*(floor+1)] = Math.ceil(15 * rem);
		}
		else if((playHead[i] > 0.875) && (aState[i][0] > playHead[i])) { // at end before playhead rolled over
			post(3,"\n");
			var floor = Math.floor((aState[i][0] - playHead[i])*64);
			var rem = ((aState[i][0] - playHead[i])*64) - floor;

			gLeds1[i + 8*floor] = Math.ceil(15 * (1-rem));
			if((i + 8*(floor+1)) < 64) gLeds1[i + 8*(floor+1)] = Math.ceil(15 * rem);
		}
	}

	ledBuffer0 = gLeds0; // temporary -> just dumps the gLeds into the buffer then sends out
	ledBuffer1 = gLeds1;

	// ARC CURRENT PLAYBACK MARKER //
	var floor = Math.floor(playHead[gSel[0]]*64);
	var rem = playHead[gSel[0]]*64 - floor;
	for(i=0;i<4;i++) { // draw onto each ring
		for(j=0;j<64;j++) aLedBuf[i][j] = aLeds[i][gSel[0]][j]; // first dump currently selected rings into buffers
		aLedBuf[i][floor] = Math.max(aLedBuf[i][floor], Math.ceil(15 * Math.cos(rem * Math.PI / 2)));
		aLedBuf[i][(floor+1)%64] = Math.max(aLedBuf[i][(floor+1)%64],Math.ceil(15 * Math.cos((1-rem) * Math.PI / 2)));
	}

	drawLeds();
}


function drawLeds() {
	
	///// GRID /////

	if(by==8 && bx==8) outlet(0,0,0,ledBuffer0); // 8x8
    else if(by==16 && bx==8) { // 8x16
        outlet(0,0,0,ledBuffer0);
        outlet(0,0,8,ledBuffer1);
    }
    else { // 16x8 or 16x16 -> top half only
        outlet(0,0,0,ledBuffer0);
        outlet(0,8,0,ledBuffer1);
    }

    ///// ARC /////

    	// should first test for arc2/4
    	// also test for arc focus
	if(aSize==2) { // arc 2
		outlet(1,0,aLedBuf[gSel[1]]); // choose ring 0 /1 depending on held select state
		outlet(1,1,aLedBuf[2]); // always sends the repeat ring for now (need to add volume fade ring option)
	}
	else if(aSize==4) { // arc 4
		for(i=0;i<4;i++) outlet(1,i,aLedBuf[i]); // bang out 4 rings of currently selected col
	}
}