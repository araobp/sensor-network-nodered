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

    function VwireConfig(n) {
        //console.log(n);
        RED.nodes.createNode(this, n);
        this.port = n.port;
        this.baudrate = n.baudrate;
        this.on('close', function(removed, done) {
            transactions = {};
            port.close();
            port = null;
            done();
        });
    }
    RED.nodes.registerType("vwire-config", VwireConfig);

    function getPort(params) {
        if (port == null) { 
            port = new SerialPort(params.port, {
            baudRate: parseInt(params.baudrate),
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
        //console.log(config);
        var params = RED.nodes.getNode(config.params);
        node.on('input', function(msg) {
            var command = msg.payload;
            //console.log(command);
            transactions[command] = this;
            //console.log(transactions);
            getPort(params).write(command + '\n');
        });
        node.on('close', function(removed, done) {
            transactions = {};
            done();
        });
    }
    RED.nodes.registerType("vwire", Vwire);
}
