trapped
=======

looping free rhythm sequencer

- 8 channel sequencer
- global tempo
- each channel can mul/div the master clock (hence become unsynced)
- the phase of when a channel triggers can be moved to any arbitrary point in the cycle
- each channel retriggers at a variable rate, for a selected portion of the cycle

fundamentally about having a globally referenced clock tempo where channels can be synchronised, however the phase and repeat rates can be varied totally arbitrarily. this leads to rhythms inspired by typical rhythmic patterns, but with no locking to the grid and only evenly spaced repeats.

grid:
left quad - divided into 8 columns
- row0: load preset (un-implemented)
- rows1-5: select clock division
- row6: select row for viewing on arc
	- hold row6 to access alternate arc view on arc2
- row7: mutes for each channel (lit is currently playing)

right quad - displays a live feed of the playback
- when lights reach the top of the device they are triggered
- allows visualisation of the current looping sequence
- buttom row allows a channel to be selected as the master
	when this channel reaches it's zero point, it re-triggers 'slaved' channels
- second bottom row is slave select
