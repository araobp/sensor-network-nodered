/*
 * This node is for https://github.com/araobp/sensor-network
 */
module.exports = function(RED) {
    'use strict';
    const SerialPort = require('serialport');
    const parsers = SerialPort.parsers;

    var port = null;
    var transactions = {};
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
                            //console.log(msg);
                            if (command in transactions) {
                                var msg = {payload: resp[2]};
                                var dest = transactions[command];
                                //console.log(dest);
                                delete transactions[command];
                                dest.send(msg);
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
        var id = config.id;
        //console.log(id);
        var port = getPort();
        node.on('input', function(msg) {
            var command = msg.payload;
            transactions[command] = this;
            //console.log(transactions);
            port.write(msg.payload + '\n');
        });
        node.on('close', function(removed, done) {
            transaction = {};
            done();
        });
    }
    RED.nodes.registerType("vwire", Vwire);
}
