inlets = 2; // 0: grid, 1: arc
outlets = 3; // 0: grid, 1: arc, 2: to-midi

var bx = 16;
var by = 8;

var gLeds = new Array(128);

var ledBuffer = new Array(64);
var trapNow = new Array(64);
var steps = new Array(64);
	for(i=0;i<128;i++) { gLeds[i] = 0; }
	for(i=0;i<64;i++) { ledBuffer[i] = 0; steps[i] = 0; }

var gMults = new Array(16); // -2,-1,0,1,2
var gMutes = new Array(16);
	for(i=0;i<16;i++) { gMults[i] = 0; gMutes[i] = 0; }
var gSel = new Array(2); // [0] = which sounds, [1] = currently held?

//// ARC SETTINGS ////
var aSens = 0.001; // smaller numbers are more sensitive
var aState = new Array(16);
	for(i=0;i<16;i++) {
		aState[i] = new Array(4);
		for(j=0;j<4;j++) aState[i][j] = 0.5; // initialise all arc values to mid level
	}
var aLeds = new Array(4); // 1 array per arc ring
	for(i=0;i<4;i++) {
		aLeds[i] = new Array(8); // 8 copies of each ring, 1 for each grid row
		for(j=0;j<8;j++) aLeds[i][j] = new Array(64); // 64 cells in each array for display
	}
var aRepeats = new Array(16); // stores the number of repeats in the gated section
var cRepeats = new Array(16); // stores the number of current counted repeats

function init() {
	// initialisation function
	gSel[0] = 0;
	gSel[1] = 0;
	gMutes[0] = 1;
}


function anything() {
	var args = arrayfromargs(messagename, arguments);

	if(inlet==0) { ///// GRID INPUT /////
		if(args[0]=="/trap-g/grid/key") {
			if(args[2]>0 && args[2]<6) { // change mult
				if(args[3]==1) calcMults(args[1],args[2]);
			}
			else if(args[2]==6) { // change selection
				gSel[0] = args[1]; // store x-value of selection
				gSel[1] = args[3]; // store held state of selection

					// draw selection
				for(i=0;i<16;i++) gLeds[i+96] = 0;
				gLeds[gSel[0]+96] = 15;
			}
			else if(args[2]==7) {
				if(args[3]==1) gMutes[args[1]] = 1-gMutes[args[1]]; // invert mute state
				for(i=0;i<16;i++) gLeds[i+112] = gMutes[i]*15; // draw mutes
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
			aState[gSel[0]][args[1]*(gSel[1]+1)] = Math.min(1, Math.max(0, aState[gSel[0]][args[1]*(gSel[1]+1)] + (args[2]*aSens)));
			if(args[1]==0) newPhase(gSel[0]); // first ring is new phase
			else if(args[1]==1) newRepeats(gSel[0]); // second ring is new repeat time
			arcMoved(args[1],args[2]); // calc leds
		}
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
		// etc.
	newPhase(x); // new clock means phase has changed
	newRepeats(x); // new clock means repeat time has changed

	// draw multipliers
	switch(gMults[x]) {
		case -2:
			gLeds[x+16] = 15;
			gLeds[x+32] = 5;
			gLeds[x+48] = 5;
			gLeds[x+64] = 0;
			gLeds[x+80] = 0;
			break;
		case -1:
			gLeds[x+16] = 0;
			gLeds[x+32] = 15;
			gLeds[x+48] = 5;
			gLeds[x+64] = 0;
			gLeds[x+80] = 0;
			break;
		case 0:
			gLeds[x+16] = 0;
			gLeds[x+32] = 0;
			gLeds[x+48] = 15;
			gLeds[x+64] = 0;
			gLeds[x+80] = 0;
			break;
		case 1:
			gLeds[x+16] = 0;
			gLeds[x+32] = 0;
			gLeds[x+48] = 5;
			gLeds[x+64] = 15;
			gLeds[x+80] = 0;
			break;
		case 2:
			gLeds[x+16] = 0;
			gLeds[x+32] = 0;
			gLeds[x+48] = 5;
			gLeds[x+64] = 5;
			gLeds[x+80] = 15;
			break;
	}
}

function redrawMults() {
	// draw multipliers
	for(i=0;i<16;i++) {
		for(y=1;y<6;y++) gLeds[i+16*y] = 0; // clear mult

		switch(gMults[i]) {
			case -2:
				gLeds[i+16] = 15;
				gLeds[i+32] = 5;
				gLeds[i+48] = 5;
				break;
			case -1:
				gLeds[i+32] = 15;
				gLeds[i+48] = 5;
				break;
			case 0:
				gLeds[i+48] = 15;
				break;
			case 1:
				gLeds[i+48] = 5;
				gLeds[i+64] = 15;
				break;
			case 2:
				gLeds[i+48] = 5;
				gLeds[i+64] = 5;
				gLeds[i+80] = 15;
				break;
		}
	}	
}

///// TIMERS /////
baseTime = 1000; // this is the total time for 1 revolution at the base rate (future: tempo calc)


var trapClock0 = new Task(clock0, this);
var trapClock1 = new Task(clock1, this);
var trapClock2 = new Task(clock2, this);
var trapClock3 = new Task(clock3, this);
/*var trapClock4 = new Task(clock4, this);
var trapClock5 = new Task(clock5, this);
var trapClock6 = new Task(clock6, this);
var trapClock7 = new Task(clock7, this); */

trapClock0.interval = baseTime;
trapClock1.interval = baseTime;
trapClock2.interval = baseTime;
trapClock3.interval = baseTime;
/* trapClock4.interval = baseTime;
trapClock5.interval = baseTime;
trapClock6.interval = baseTime;
trapClock7.interval = baseTime; */

trapClock0.repeat();
trapClock1.repeat();
trapClock2.repeat();
trapClock3.repeat();
/* trapClock4.repeat();
trapClock5.repeat();
trapClock6.repeat();
trapClock7.repeat(); */

var phase0dec = 1;

function clock0 () {
	trapPhase0.cancel(); // stop the phase counter
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
	outlet(2,0); // retriggers inside of phase
	cRepeats[0]++; // count repeats
}


function clock1 () {
	//
}

function clock2 () {
	//
}

function clock3 () {
	//
}
/*
function clock4 () {
	//
}

function clock5 () {
	//
}

function clock6 () {
	//
}

function clock7 () {
	//
}
*/

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

		/////////////////////////////
		////////////////////
		///////////
		// temp. assigned to 2nd knob
		/////////////////////////////
	var rateDiv = Math.pow(2,aState[gSel[0]][1]*6); // change to aState[gSel[0]][2]

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
	//aLeds[1][gSel[0]][aBrace%64] = Math.max(aLeds[1][gSel[0]][(aBrace)%64], 15*(1-bRem));
	//aLeds[1][gSel[0]][(aBrace+1)%64] = 15*(bRem);

	aRepeats[gSel[0]] = 0;

	// rate ring -> draw all valid instances inside loop brace
	while(curDiv < aBrace) { // add new triggers for each point inside repeat brace -> move to ring 2
		var iDiv = Math.floor(curDiv); // integer version of curDiv
		var rDiv = curDiv - iDiv; // remainder from integer rounding

		aLeds[1][gSel[0]][iDiv%64] = Math.max(15 * (1-rDiv), aLeds[1][gSel[0]][iDiv%64]);
		aLeds[1][gSel[0]][(iDiv+1)%64] = Math.max(15 * rDiv, aLeds[1][gSel[0]][(iDiv+1)%64]);
	
		curDiv += rateDiv; // add the step division value to the counter, and run again if inside brace
		aRepeats[gSel[0]]++; // for every loop, add 1 to number of repetitions
	}
}

function newPhase(i) {
		// RECALC PHASE TIMERS //
	if(i==0) trapPhase0.interval = Math.min(trapClock0.interval-10, Math.max(trapClock0.interval * aState[0][0], 10)); // limit to 10ms to ensure trigger
	else if(i==1) trapPhase1.interval = Math.min(trapClock1.interval-10, Math.max(trapClock1.interval * aState[1][0], 10));
	else if(i==2) trapPhase2.interval = Math.min(trapClock2.interval-10, Math.max(trapClock2.interval * aState[2][0], 10));
	else if(i==3) trapPhase3.interval = Math.min(trapClock3.interval-10, Math.max(trapClock3.interval * aState[3][0], 10));
		// etc.
}

function newRepeats(i) {
		// RECALC REPEAT SPEED //
	if(i==0) trapRepeat0.interval = Math.max(trapClock0.interval * (Math.pow(2,aState[0][1]*6)/64), 10); // <<<<< TEMPORARY change to aState[0][2]
	else if(i==1) trapRepeat1.interval = Math.max(trapClock1.interval * (Math.pow(2,aState[1][1]*6)/64), 10);
	else if(i==2) trapRepeat2.interval = Math.max(trapClock2.interval * (Math.pow(2,aState[2][1]*6)/64), 10);
	else if(i==3) trapRepeat3.interval = Math.max(trapClock3.interval * (Math.pow(2,aState[3][1]*6)/64), 10);
		// etc.
}


var frame = new Task(trapThis, this);
frame.interval = 25; // 40fps redraw
frame.repeat(); // should remove so only starts on grid focus

// init drawing // 
	// clear top row (temporary)
	for(i=0;i<16;i++) gLeds[i] = 0;


function trapThis () { // calculate the device displays
	// add any per-frame drawing tasks in here
	// might need to add one last set of arc led buffers to avoid destructive changes

	// add 'current play position' marker overlay in here

	drawLeds();
}


function drawLeds() {
	
	///// GRID /////

	if(by==8 && bx==8) outlet(0,0,0,gLeds); // 8x8
    else if(by==8 && bx==16) { // 16x8
        for(i=0;i<8;i++)
            for(j=0;j<8;j++) ledBuffer[i*8+j] = gLeds[i*16+j];
        outlet(0,0,0,ledBuffer);

        for(i=0;i<8;i++)
            for(j=0;j<8;j++) ledBuffer[i*8+j] = gLeds[i*16+j+8];
        outlet(0,8,0,ledBuffer);
    }
    else if(by==16 && bx==8) { // 8x16
        for(i=0;i<8;i++)
            for(j=0;j<8;j++) ledBuffer[i*8+j] = gLeds[i*8+j];
        outlet(0,0,0,ledBuffer);

        for(i=0;i<8;i++)
            for(j=0;j<8;j++) ledBuffer[i*8+j] = gLeds[i*8+j+64];
        outlet(0,0,8,ledBuffer);
    }
    else if(by==16 && bx==16) { // 16x16
        for(i=0;i<8;i++)
            for(j=0;j<8;j++) ledBuffer[i*8+j] = gLeds[i*16+j];
        outlet(0,0,0,ledBuffer);

        for(i=0;i<8;i++)
            for(j=0;j<8;j++) ledBuffer[i*8+j] = gLeds[i*16+j+128];
        outlet(0,0,8,ledBuffer);

        for(i=0;i<8;i++)
            for(j=0;j<8;j++) ledBuffer[i*8+j] = gLeds[i*16+j+8];
        outlet(0,8,0,ledBuffer);

        for(i=0;i<8;i++)
            for(j=0;j<8;j++) ledBuffer[i*8+j] = gLeds[i*16+j+136];
        outlet(0,8,8,ledBuffer);
    }

    ///// ARC /////

    	// should first test for arc2/4
    	// also test for arc focus
    for(i=0;i<4;i++) outlet(1,i,aLeds[i][gSel[0]]); // bang out 4 rings of currently selected col
}