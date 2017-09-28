# Device simulator based on HTML5 and AngularJS

## Prerequisite

- [mosquitto](https://mosquitto.org) is runnig somewhere, for example, on RasPi.
- The mosquitto has been made(compiled) with WebSockets option enabled.
- angular.min.js and browserMqtt.js is accesible from a simulator.

Refer to the following links for mosquitto and browserMqtt.js:
- [obtaining mosquitto with WebSockets enabled](https://xperimentia.com/2015/08/20/installing-mosquitto-mqtt-broker-on-raspberry-pi-with-websockets/)
- [building browserMqtt.js](https://github.com/mqttjs/MQTT.js/)

## Architecture

```
[Script    ]                                         [Device simulator node]  
[AngularJS ]---mqtt/WebSocket---[mosquitto]---mqtt---[mqtt client          ]
[HTML5/CSS3]                                         [Node-RED             ]
```

## Sample index.html as a device simulator

[sample](./index.html)


