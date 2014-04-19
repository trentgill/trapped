inlets = 1;
outlets = 2;

var rin = 0;
var pin = 0;
var lin = 0;

var brace = new Array(64);
var rate = new Array(64);
var phase = new Array(64);
var length = new Array(64);

for(i=0; i<64; i++) rate[i] = 0;
for(i=0; i<64; i++) phase[i] = 0;
for(i=0; i<64; i++) length[i] = 0;

function r(x)
{
	rin = Math.floor(x*64); // shifts 0. to 1. into 0 to 64
}

function p(x)
{
	pin = Math.floor(x*64); // shifts 0. to 1. into 0 to 64
}
function l(x)
{
	lin = Math.floor(x*64); // shifts 0. to 1. into 0 to 64	
}

	// this function is the redraw function called all the time!
function bang()
{
		// first empty all of the rings buffers
	for(i=0; i<64; i++) {
		rate[i] = 0;
		phase[i] = 0;
		length[i] = 0;
	}

		// now we draw a low-bright range as the base display
		// this draws a range into the buffer starting at the phase offset
		// continuing through the length of the loop
		// modulo 64 to allow wrapping past the 0 marker for high phase offsets
	for(i=pin; i<lin+pin; i++) {
		//brace[(i%64)] = 5; // set all cells within range to low brightness
		rate[i%64] = 5;
		phase[i%64] = 5;
		length[i%64] = 5;
	}

	
		//dump the brace[] into the 3 output arrays
		//rate = brace;
		//phase = brace;
		//length = brace;

		// sets all valid trigger instances inside loop brace to 15
	for(i=0; i<lin; i= i+(64/rin)) rate[Math.floor(i+pin)%64] = 15;
	
	phase[pin%64] = 15; // sets 1st step in range to full bright
	
	length[(lin+pin)%64] = 15; // sets last step in range to full bright

		// shoot out the full arrays to their respective rings

	outlet(0, "/trap-a/ring/map", 0, rate);
	outlet(0, "/trap-a/ring/map", 1, phase);
	outlet(0, "/trap-a/ring/map", 2, length);
	
	outlet(1, "bang"); // sends a bang out 2nd outlet to trigger clock overlay
}