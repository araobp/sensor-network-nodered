# sensor-network-nodered

![vwire](./doc/vwire.png)

## Background and motivation

Generally speaking, the granurarity of nodes on Node-RED is fine-grained (KISS), and some of them are asynchronous (event-driven).

Lately I have been creating miniature things that can be controlled by Node-RED or [Android](https://github.com/araobp/sensor-network-android), as educational materials. However, I have been wondering if children younger than 8 years old can really program Node-RED to control them.

Once I tested [SONY Koov](https://www.sony.com/koov) that has a Scratch-like programming tool, and the programming style is completely synchronous. I also watched a TV program teaching Scatch to kids.

The goal of this project is to see if it is possible to create synchronous and coarse-grained nodes on Node-RED to control my miniature things in a sequence-control manner. Some of them use [this sensor network protocol](https://github.com/araobp/sensor-network).

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
Sensor A      MCU          vWire common     vWire node 1                |
   |           |                |    req1        |                      |
   |           |    req1        |<---------------|                      | in
   |           |<----uart-------|                |                      V
   |<---i2c----|                |                |               [vwire node 1]
   |----i2c--->|    res1        |                |                      |
   |           |-----uart------>|    res1        |                      |
   |           |                |--------------->|                      | out
               |                |                                       :
Sensor B       |                |           vWire node 2                :
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

### TODO: BLE interface

A priate BLE GATT service is to be provided.

I am developing a serial communication service between Microchip's RN4020 and Node-RED/Android:

![RN4020](./doc/ble.png)

![Schematic](./doc/ble.jpg)

```
[Scheduler]--UART--[RN4020] - - BLE - - [Node-RED/Android]

      Service "Sensor Network"
      +---------------------------+
      | Characteristics           |
      | +-----------------------+ |
<-WV--- |                       | <- Write -
      | +-----------------------+ |
      | Characteristics           |
      | +-----------------------+ |
-SHU--> |                       | - Read/Notify ->
      | +-----------------------+ |
      +---------------------------+
```

Refer to [the user's guide](http://ww1.microchip.com/downloads/en/DeviceDoc/70005191B.pdf#search=%27RN4020%27).
