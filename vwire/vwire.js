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
                        var startsWith = dataString.substring(0,1);
                        switch(startsWith) {
                            case '$':
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
                                break;
                            case '%':
                                var resp = dataString.split(':');
                                var msg = {payload: resp};
                                if ('_in' in transactions) {
                                    transactions._in.send(msg);
                                }
                                break;
                            default:
                                break;
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
        //console.log(config);
        var params = RED.nodes.getNode(config.params);
        var command = null;
        if (config.name != '') {
            command = config.name;
        }
        var noack = config.noack;
        var port = getPort(params); 
        node.on('input', function(msg) {
            var cmd = null;
            if (command) {
                cmd = command;
            } else {
                cmd = msg.payload;
            }
            //console.log(command);
            transactions[cmd] = this;
            //console.log(transactions);
            port.write(cmd + '\n');
            if (noack) {
                node.send({payload: null});
            }
        });
        node.on('close', function(removed, done) {
            transactions = {};
            done();
        });
    }
    RED.nodes.registerType("vwire", Vwire);

    function VwireIn(config) {
        RED.nodes.createNode(this, config);
        var node = this;
        transactions['_in'] = this;
        node.on('close', function(removed, done) {
            transactions = {};
            done();
        });
    }
    RED.nodes.registerType("vwire-in", VwireIn);
}
