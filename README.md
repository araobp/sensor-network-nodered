# sensor-network-nodered

![nodered](./doc/flow.png)

## Background and motivation

Generally speaking, the granurarity of nodes on Node-RED is fine-grained (KISS), and some of them are asynchronous (event-driven).

Lately I have been creating miniature things that can be controlled by Node-RED or [Android](https://github.com/araobp/sensor-network-android), as educational materials. However, I have been wondering if children younger than 8 years old can really program Node-RED to control them.

Once I tested [SONY Koov](https://www.sony.com/koov) that has a Scratch-like programming tool, and the programming style is completely synchronous. I also watched a TV program teaching Scatch to kids.

The goal of this project is to see if it is possible to create synchronous and coarse-grained nodes on Node-RED to control my miniature things in a sequence-control manner. Some of them use [this sensor network protocol](https://github.com/araobp/sensor-network).

## Flow

```

Sensors       MCU          vWire common     vWire instance (id1)
   |           |                |    req1        |
   |           |    req1        |<---------------|
   |           |<---------------|                |
   |---------->|    res1        |                |
   |           |--------------->|    res1        |
   |           |                |--------------->|
               |
               |           vWire common    vWire instance (id2)
   |           |                |                |
   |           |                |    req2        |
   |           |    req2        |<---------------|
   |           |<---------------|                |
   |---------->|    res2        |                |
   |           |--------------->|    res2        |
   |           |                |--------------->|

```

## Implementation

Assuming that this repo is under /home/pi, modify ~/.node-red/settings.js as follows:

```
nodesDir: '/home/pi/sensor-network-nodered/vwire',
```

I have just made a minimum implementation.
