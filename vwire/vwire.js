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

    const CMD_SEND_INTERVAL = 80; // 80 msec interval at minimum

    var port = null;
    var transactions = {};
    var buf = []; 
    var statusIndicators = [];
    var portStatus = false;
    var portName = null;
    var portBaudrate = null;
    var parserEnabled = false;  // parser for https://github.com/araobp/sensor-network

    /*
     * Sends commands to serial port at a specific interval
     */
    function sendCommands(node, cmdList, payload, index, port) {
        if (port == null) {
            port = getPort();
        }
        var cmd = cmdList.shift();
        if (cmd != null) {
            if (index == 0) {
                port.write(cmd + payload + '\n');
            } else {
                port.write(cmd + '\n');
            }
            setTimeout(function() {
                index = index - 1;
                sendCommands(node, cmdList, payload, index, port);
            }, CMD_SEND_INTERVAL);
        } else {
            node.send({msg: null});
        }
    }

    /*
     * Updates port statu on vwire-status node
     */
    function updatePortStatus(status) {
        if (status != null) {
            portStatus = status;
        }
        var parser = '';
        if (parserEnabled) {
            parser = ', parser on';
        }
        for (var s of statusIndicators) {
            switch(portStatus) {
                case true:
                    s.status({fill:"green",shape:"dot",text:"connected"+parser});
                    break;
                case false:
                    s.status({fill:"red",shape:"dot",text:"disconnected"+parser});
                    break;
            }
        }
    }

    /*
     * Gets a serial port
     */
    function getPort() {
        if (port == null) { 
            updatePortStatus(null);
            port = new SerialPort(portName, {
                baudRate: portBaudrate,
                parser: SerialPort.parsers.raw,
                autoOpen: true 
            });
            port.on('error', function(data) {
                port = null;
                setTimeout(function() {
                    getPort();
                }, 1000);
            });
            port.on('data', function(data) {
                for (var c of data) {
                    if (c == 10) {  // '\n'(0x0a)
                        var respString = new Buffer(buf).toString('utf8');
                        var resp = null;
                        buf.length = 0;
                        console.log(respString);
                        if (parserEnabled) {
                            var startsWith = respString.charAt(0);
                            switch(startsWith) {
                                case '$':
                                case '*':
                                    resp = respString.split(':');
                                    var command = resp[1];
                                    var msg = null;
                                    if (command in transactions) {
                                        var transaction = transactions[command];
                                        var dest = transaction[0];
                                        var parserExtension = transaction[1]; 
                                        delete transactions[command];
                                        var msg = null;
                                        if (parserExtension != null) {
                                            msg = {payload: parserExtension(resp[2])};
                                        } else {
                                            msg = {payload: resp[2]};
                                        }
                                        dest.send(msg);
                                    }
                                    break;
                                case '%':
                                    resp = respString.split(':');
                                    var deviceId = parseInt(resp[0].slice(1,3));
                                    var converted = [];
                                    if (resp[1] == 'NO_DATA') {
                                        converted = null;
                                    } else {
                                        var converted = resp[2].split(',');
                                        switch(resp[1]) {
                                            case 'FLOAT':
                                                converted.map(elm => parseFloat(elm));
                                                break;
                                            default:
                                                converted.map(elm => parseInt(elm));
                                                break;
                                        }
                                    }

                                    var msg = {payload: {
                                        deviceId: deviceId,
                                        data: converted
                                    }};

                                    if ('SEN' in transactions) {
                                        var dest = transactions.SEN[0];
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
                            try {
                                resp = parseInt(dataString);
                            } catch (e) {
                                console.log('not integer');
                            }
                            try {
                                resp = parseFloat(dataString);
                            } catch (e) {
                                console.log('not float');
                            }
                            var msg = {payload: resp};
                            var dest = transactions._next[0];
                            delete transactions._next;
                            try {
                                dest.send(msg);
                            } catch(e) {
                                console.log(e);
                            }
                            if ('_in' in transactions) {
                                transactions._in[0].send(msg);
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
                    getPort();
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
        portName = this.port;
        portBaudrate = parseInt(this.baudrate);
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
        var port = getPort(); 
        node.on('input', function(msg) {
            var cmd = null;
            if (command != null) {
                cmd = command;
            } else {
                cmd = msg.payload;
            }
            if (parserEnabled) {
                var cmd_name = cmd.split(':')[0]
                transactions[cmd_name] = [node, null];
            } else {
                transactions._next = [node, null];
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
    RED.nodes.registerType("vwire", vwire);
    
    function vwireMaker(cmd, noack, parserExtension) {
        function vwire(config) {
            RED.nodes.createNode(this, config);
            var node = this;
            var params = RED.nodes.getNode(config.params);
            var port = getPort(); 
            node.on('input', function(msg) {
                if (parserEnabled) {
                    var cmd_name = cmd.split(':')[0]
                    transactions[cmd_name] = [node, parserExtension];
                } else {
                    transactions._next = [node, parserExtension];
                }
                port.write(cmd + '\n');
                if (noack) {
                    node.send({payload: parserExtension});
                }
            });
            node.on('close', function(removed, done) {
                transactions = {};
                done();
            });
        }
        return vwire;
    }

    /*
     * Limitation: 
     * (1) cmdList cannot have same commands.
     * (2) this function works only for nodes with noack = true and parserEnabled = true.
     */
    function vwireCmdListMaker(cmdList, index) {
        function vwire(config) {
            RED.nodes.createNode(this, config);
            var node = this;
            var params = RED.nodes.getNode(config.params);
            var port = getPort(); 
            var cmd = null;
            if ('name' in config && config.name != '') {
                cmd = config.name;
            }
            node.on('input', function(msg) {
                var payload = null;
                if (cmd == null) {
                    payload = msg.payload;
                } else {
                    payload = cmd;
                }
                sendCommands(node, [].concat(cmdList), payload, index, null);
            });
            node.on('close', function(removed, done) {
                transactions = {};
                done();
            });
        }
        return vwire;
    }

    // The following nodes require ParserEnabled = true
    RED.nodes.registerType("hall-sensor", vwireMaker("SEN:17", false, null));
    RED.nodes.registerType("accelerometer", vwireMaker("SEN:19", false, null));
    RED.nodes.registerType("temperature-humidity", vwireMaker("SEN:20", false, null));
    RED.nodes.registerType("device-map", vwireMaker("MAP", false, resp => resp.split(',')));
    RED.nodes.registerType("schedule", vwireMaker("RSC", false, resp => resp.split('|').map(elm => elm.split(','))));
    RED.nodes.registerType("start", vwireMaker("STA", true, null));
    RED.nodes.registerType("stop", vwireMaker("STP", false, null));
    RED.nodes.registerType("lcd", vwireCmdListMaker(["I2C:16", "CLR", "STR:", "I2C:1"], 2));
    // The following nodes require ParserEnabled = false
    RED.nodes.registerType("door-status", vwireMaker("07", false, null));
    RED.nodes.registerType("door-unlock", vwireMaker("150", false, null));
    RED.nodes.registerType("door-lock", vwireMaker("1590", false, null));
    RED.nodes.registerType("door-led-on", vwireMaker("180", true, null));
    RED.nodes.registerType("door-led-off", vwireMaker("181", true, null));

    function VwireIn(config) {
        RED.nodes.createNode(this, config);
        var node = this;
        var params = RED.nodes.getNode(config.params);
        getPort();
        transactions._in = [node, null];
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
