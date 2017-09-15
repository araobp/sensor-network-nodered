# sensor-network-nodered

## Background and motivation

I want to use Node-RED to control my hardware prototype (such as [this one](https://github.com/araobp/sensor-network)) in some cases.

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
- Use "tcp node" on Node-RED and develop a TCP server as vWire common
- Develop a new node for Node-RED.
