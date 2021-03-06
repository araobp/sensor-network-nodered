# sensor-network-nodered

![title](./doc/title.png)

## Background and motivation

Lately I have been creating miniature things that can be controlled by Node-RED or [Android](https://github.com/araobp/sensor-network-android) for rapid IoT prototyping.

Generally speaking, the granurarity of nodes on Node-RED is fine-grained (KISS), and some of them are asynchronous (event-driven). However, I want coarse-grained and synchronous ones for rapid IoT prototyping.

The goal of this project is to see if it is possible to create synchronous and coarse-grained nodes on Node-RED to control my miniature things in a sequence-control manner: Node-RED works as Programmable Logic Controller (PLC) for IoT prototype or IoT demo. Some of them utilize [this sensor network protocol](https://github.com/araobp/sensor-network) to control devices.

I also develop [device simulators](./simulator) controlled by such synchrnous and coarse-grained nodes on Node-RED.

## Construct

I use RasPi 3 for this project, but I don't use those physical pins on RasPi because of the complicated physical wirling that kids never like. Instead, this project provides virtual wires (vwire) connected to each physical devices at logical device IDs.

```

                                                                Node-RED
    +----------+----------+---[master/scheduler]--UART/USB(vcp)--[RasPi]
    |          |          |
[sensor]   [sensor]   [actuator]  ...
device ID  device ID  device ID
   17         19         16
   
vwire-16: [actuator, device ID 16]--wire--[Node-RED/RasPi]
vwire-17: [sensor, device ID 17]--wire--[Node-RED/RasPi]
vwire-19: [sensor, device ID 19]--wire--[Node-RED/RasPi]

```

The sensor network protocol supports plug&play, and "device-map" node in the Node-RED palette can be used to show all the devices attached to the network currently.

## Sample flows

### Synchronous operations

![nodered](./doc/flow.png)

And a picture of the (physical) lcd showing current temperature:

![lcd](./doc/lcd.jpg)

### Sensor data subscribers

![pubsub.png](./doc/pubsub.png)

## Sequence

```

  <--- virtual wire (vwire) --------------------->                Node-RED flow
                                                                        |
Sensor A      MCU          vwire common     vwire node 1                |
   |           |                |    req1        |                      |
   |           |    req1        |<---------------|                      | in
   |           |<----uart-------|                |                      V
   |<---i2c----|                |                |               [vwire node 1]
   |----i2c--->|    res1        |                |                      |
   |           |-----uart------>|    res1        |                      |
   |           |                |--------------->|                      | out
               |                |                                       :
Sensor B       |                |           vwire node 2                :
   |           |                |                |                      |
   |           |                |    req2        |                      |
   |           |    req2        |<---------------|                      | in
   |           |<---uart/usb----|                |                      V
   |<---i2c----|                |                |               [vwire node 2]
   |----i2c--->|    res2        |                |                      |
   |           |----uart/usb--->|    res2        |                      |
   |           |                |--------------->|                      V out


"vwire common" is an instance of serialport attached to a tty (e.g., /dev/ttyUSB0) on Linux
or a COM port on Windows.

```

## Architecture

Since a serial port is physical (i.e., cannot make copies), transaction layer works as MUX between vwire/vwire-in nodes and the sensor network.

```

      [vwire 1]  [vwire 2]  [vwire-in 1]
          |          |          |
    [transaction layer                 ]
    [vwire common (serialport instance)]
                     |
                 UART/USB
                     |
                    MCU
                     |
               Sensor network
```

## Implementation

### Preparation

Assuming that this repo is under /home/pi, modify ~/.node-red/settings.js as follows:

```
nodesDir: '/home/pi/sensor-network-nodered/vwire',
```

### Current implementation

I have just made [a minimal implementation](./vwire):
- vwire: control/manage the sensor network in a sequential manner.
- vwire-in: receives time-series sensor data from the sensor network.
- vwire-status: show the current status of port connectivity.
- vwire-config: config shared by vwire and vwire-in instances.
- vwireMaker() closure makes nodes of specific sensors.
- vwireSubscriberMaker() closure makes nodes of sensor data subscribers.

Limitations:
- Supports only one serial port.
- Cannot perform parallel operations of a same command.

## Device simulators

I have also developed device simulators based on HTML5 and AngularJS => [simulator](./simulator)

The simulators can be controlled by [mwire](./mwire) node:

```
  <------ mqtt wire (mwire) --------------------->                Node-RED flow
                                                                        |
Device A     Chrome          mwire common     mwire node 1              |
   |           |                |    req1        |                      |
   |           |    req1        |<---------------|                      | in
   |           |<----mqtt-------|                |                      V
   |<---JS-----|                |                |               [mwire node 1]
   |----JS---->|    res1        |                |                      |
   |           |-----mqtt------>|    res1        |                      |
   |           |                |--------------->|                      | out
               |                |                                       :
Device B       |                |           mwire node 2                :
   |           |                |                |                      |
   |           |                |    req2        |                      |
   |           |    req2        |<---------------|                      | in
   |           |<----mqtt-------|                |                      V
   |<---JS-----|                |                |               [mwire node 2]
   |----JS---->|    res2        |                |                      |
   |           |-----mqtt------>|    res2        |                      |
   |           |                |--------------->|                      V out

```

Sample flow with mwire nodes:
![elevator_contorl](./doc/elevator_control.png)

### BLE interface

I have developed a BLE interface for PIC MCU running at 5V.

![RN4020](./doc/ble.png)

![Schematic](./doc/ble.jpg)

```
[I2C backplane master(scheduler)]--UART--[RN4020] <- - - MLDP/BLE - - -> [RN4020]--UART/USB--[Node-RED/Android]
```

Refer to [the user's guide](http://ww1.microchip.com/downloads/en/DeviceDoc/70005191B.pdf#search=%27RN4020%27).
