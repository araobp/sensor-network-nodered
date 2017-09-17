/*
 * This node is for https://github.com/araobp/sensor-network
 */
module.exports = function(RED) {
    'use strict';
    const SerialPort = require('serialport');
    const parsers = SerialPort.parsers;

    var port = null;
    var instances = [];
    var buf = []; 

    function getPort() {
        if (port == null) { 
            port = new SerialPort('/dev/ttyUSB0', {
            baudRate: 115200,
            parser: SerialPort.parsers.raw,
            autoOpen: true 
            });
            port.on('data', function(data) {
                for (var c of data) {
                    if (c == 10) {
                        var dataString = new Buffer(buf).toString('utf8');
                        buf.length = 0;
                        //console.log(dataString);
                        if (dataString.substring(0,1) != '#') {
                            var resp = dataString.split(':');
                            var command = resp[1];
                            var msg = {payload: resp[2]};
                            //console.log(msg);
                            for (var n of instances) {
                                if (n[1] == command) {
                                    n[0].send(msg);
                                }
                            }
                        }
                    } else {
                        buf.push(c);
                    }
                }
            });
        }
        return port;
    }

    function Vwire(config) {
        RED.nodes.createNode(this, config);
        var node = this;
        instances.push([node, config.command]);
        var port = getPort();
        node.on('input', function(msg) {
            var cmd = msg.payload;
            port.write(config.command + '\n');
        });
        node.on('close', function(removed, done) {
            instances.length = 0;
            done();
        });
    }
    RED.nodes.registerType("vwire", Vwire);
}
