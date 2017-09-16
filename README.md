# sensor-network-nodered

## Background and motivation

Generally speaking, the granurarity of nodes on Node-RED is fine-grained (KISS), and some of them are asynchronous (event-driven).

Lately I have been creating miniature things that can be controlled by Node-RED or [Android](https://github.com/araobp/sensor-network-android), as educational materials. However, I have been wondering if children younger than 8 years old can really program Node-RED to control them.

Once I tested [SONY Koov](https://www.sony.com/koov) that has a Scratch-like programming tool, and the programming style is completely synchronous. I also watched a TV program teaching Scatch to kids.

The goal of this project is to see if it is possible to create synchronous and coarse-grained nodes on Node-RED to control my miniature things. Some of them use [this sensor network](https://github.com/araobp/sensor-network).

## Flow

[Step 1] The user of vWire node sets a source ID(its own ID) to the instance of vWire.

[Step 2] The vWire instance appends the number to a request message to MCU.

[Step 3] vWire common part transfers the message to MCU.

[Step 4] vWire common part receives a response from MCU and transfers it to the instance of vWire.

```

Sensor 17     MCU          vWire common     vWire instance
   |           |                |    req1,id1    |
   |           |    req1,id1    |<---------------|
   |           |<---------------|                |
   |---------->|    res1,id1    |                |
   |           |--------------->|    res1,id1    |
   |           |                |--------------->|
   |           |
   |           |           vWire common    vWire instance
   |           |                |                |
   |           |                |    req2,id2    |
   |           |    req2,id2    |<---------------|
   |           |<---------------|                |
   |---------->|    res2,id2    |                |
   |           |--------------->|    res2,id2    |
   |           |                |--------------->|
   
```

## Implementation

I have devised two approached:
- TCP node: use "tcp node" on Node-RED and develop a TCP server as vWire common
- New node: develop a new node for Node-RED, using "serialport" package.

## Using the new node (currently under development)

Assuming that this repo is under /home/pi, modify ~/.node-red/settings.js as follows:

```
nodesDir: '/home/pi/sensor-network-nodered/vwire',
```
