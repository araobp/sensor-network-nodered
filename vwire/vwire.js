/*
 * Node to communicate with a sensor network via a serial port.
 *
 * vwire node is synchronous: blocks until the response is received.
 * The reason why it is synchronous is that most of sequnece-control
 * scenarios require synchronous control.
 *
 * vwire-in node is to receive time-series data from a sensor network.
 * Set "parser" on vwire-config node to true to enable a parser for 
 * https://github.com/araobp/sensor-network
 *
 * vwire-status node is to show the current status of the sensor
 * network: connected or disconnected.
 */
module.exports = function(RED) {
    'use strict';

    const SerialPort = require('serialport');
    const parsers = SerialPort.parsers;

    var port = null;
    var transactions = {};
    var buf = []; 
    var statusIndicators = [];
    var portStatus = false;
    var parserEnabled = false;  // parser for https://github.com/araobp/sensor-network

    /*
     * Updates port statu on vwire-status node
     */
    function updatePortStatus(status) {
        if (status != null) {
            portStatus = status;
        }
        for (var s of statusIndicators) {
            switch(portStatus) {
                case true:
                    s.status({fill:"green",shape:"dot",text:"connected"});
                    break;
                case false:
                    s.status({fill:"red",shape:"dot",text:"disconnected"});
                    break;
            }
        }
    }
    
    /*
     * Gets a serial port
     */
    function getPort(params) {
        if (port == null) { 
            updatePortStatus(null);
            port = new SerialPort(params.port, {
                baudRate: parseInt(params.baudrate),
                parser: SerialPort.parsers.raw,
                autoOpen: true 
            });
            port.on('error', function(data) {
                console.log('trying to open port...');
                port = null;
                setTimeout(function() {
                    getPort(params);
                }, 1000);
            });
            port.on('data', function(data) {
                for (var c of data) {
                    if (c == 10) {  // '\n'(0x0a)
                        var dataString = new Buffer(buf).toString('utf8');
                        buf.length = 0;
                        console.log(dataString);
                        if (parserEnabled) {
                            var startsWith = dataString.substring(0,1);
                            switch(startsWith) {
                                case '$', '*':
                                    var resp = dataString.split(':');
                                    var command = resp[1];
                                    if (command in transactions) {
                                        var msg = {payload: resp[2]};
                                        var dest = transactions[command];
                                        delete transactions[command];
                                        dest.send(msg);
                                    }
                                    break;
                                case '%':
                                    var resp = dataString.split(':');
                                    var deviceId = parseInt(resp[0].slice(1,3));
                                    var converted = [];
                                    if (resp[1] == 'NO_DATA') {
                                        converted = null;
                                    } else {
                                        var converted = resp[2].split(',');
                                        switch(resp[1]) {
                                            case 'FLOAT':
                                                converted.map(function(elm) {
                                                    return parseFloat(elm);
                                                });
                                                break;
                                            default:
                                                converted.map(function(elm) {
                                                    return parseInt(elm);
                                                });
                                                break;
                                        }
                                    }

                                    var msg = {payload: {
                                        deviceId: deviceId,
                                        data: converted
                                    }};

                                    if ('SEN' in transactions) {
                                        var dest = transactions.SEN;
                                        delete transactions.SEN;
                                        dest.send(msg);
                                    }
                                        
                                    if ('_in' in transactions) {
                                        transactions._in.send(msg);
                                    }
                                    break;
                                default:
                                    break;
                            }
                        } else {
                            console.log(transactions);
                            var msg = {payload: dataString};
                            var dest = transactions._next;
                            delete transactions._next;
                            try {
                                dest.send(msg);
                            } catch(e) {
                                console.log(e);
                            }
                            if ('_in' in transactions) {
                                transactions._in.send(msg);
                            }
                        }
                    } else {
                        buf.push(c);
                    }
                }
            });
            port.on('open', function() {
                updatePortStatus(true);
            });
            port.on('close', function() {
                port = null;
                updatePortStatus(false);
                setTimeout(function() {
                    getPort(params);
                }, 1000);
            });
        }
        return port;
    }
    
    /*
     * vwire-config node
     */
    function VwireConfig(n) {
        RED.nodes.createNode(this, n);
        this.port = n.port;
        this.baudrate = n.baudrate;
        this.parser = n.parser;
        parserEnabled = this.parser;
        if (parserEnabled) {
            console.log('parser enabled');
        }
        this.on('close', function(removed, done) {
            transactions = {};
            done();
        });
    }
    RED.nodes.registerType("vwire-config", VwireConfig);
    
    function vwire(config) {
        RED.nodes.createNode(this, config);
        var node = this;
        var params = RED.nodes.getNode(config.params);
        var command = null;
        if ('name' in config && config.name != '') {
            command = config.name;
        }
        var noack = config.noack;
        var port = getPort(params); 
        node.on('input', function(msg) {
            var cmd = null;
            if (command != null) {
                cmd = command;
            } else {
                cmd = msg.payload;
            }
            console.log(parserEnabled);
            if (parserEnabled) {
                var cmd_name = cmd.split(':')[0]
                transactions[cmd_name] = node;
                console.log(transactions);
            } else {
                transactions._next = node;
            }
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
    
    function vwireMaker(cmd, noack) {
        function vwire(config) {
            RED.nodes.createNode(this, config);
            var node = this;
            var params = RED.nodes.getNode(config.params);
            var port = getPort(params); 
            node.on('input', function(msg) {
                console.log(parserEnabled);
                if (parserEnabled) {
                    var cmd_name = cmd.split(':')[0]
                    transactions[cmd_name] = node;
                    console.log(transactions);
                } else {
                    transactions._next = node;
                }
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
        return vwire;
    }
    
    RED.nodes.registerType("vwire", vwire);
    
    // The following nodes require ParserEnabled = true
    RED.nodes.registerType("hall-sensor", vwireMaker("SEN:17", false));
    RED.nodes.registerType("accelerometer", vwireMaker("SEN:19", false));
    RED.nodes.registerType("temperature-humidity", vwireMaker("SEN:20", false));

    // The following nodes require ParserEnabled = false
    RED.nodes.registerType("door-status", vwireMaker("07", false));
    RED.nodes.registerType("servo-unlock", vwireMaker("150", false));
    RED.nodes.registerType("servo-lock", vwireMaker("1590", false));

    function VwireIn(config) {
        RED.nodes.createNode(this, config);
        var node = this;
        var params = RED.nodes.getNode(config.params);
        getPort(params);
        transactions['_in'] = node;
        node.on('close', function(removed, done) {
            transactions = {};
            done();
        });
    }
    RED.nodes.registerType("vwire-in", VwireIn);

    function VwireStatus(config) {
        RED.nodes.createNode(this, config);
        var node = this;
        statusIndicators.push(node);
        updatePortStatus(null);
        node.on('close', function(removed, done) {
            statusIndicators = [];
            done();
        });
    }
    RED.nodes.registerType("vwire-status", VwireStatus);
}
