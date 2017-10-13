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

    const CMD_SEND_INTERVAL = 20; // 20 msec interval at minimum

    var port = null;
    var transactions = {};
    var buf = [];  // receive buffer
    var statusIndicators = [];
    var portOpened = false;
    var portName = null;
    var portBaudrate = null;
    var parserEnabled = false;  // parser for https://github.com/araobp/sensor-network
    var sendQueue = [];

    /*
     * Schedule
     * 8msec, 16msec, 48msec, 96msec, 480msec, 960msec, 4800msec 
     */
    var schedule = [[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0]];
    var subscriptions = [];

    function cleanUp() {
        var cmdList = ['STP', 'CSC'];
        sendCommands(null, cmdList, null, 0);
        transactions = {};
        schedule = [[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0]];
        subscriptions.length = 0;
        statusIndicators.length = 0;
        sendQueue.length = 0;
    }

    /*
     * Sends a series of commands to serial port at a specific interval
     */
    function sendCommands(node, cmdList, payload, index) {
        sendQueue.push({
            node: node,
            cmdList: cmdList,
            payload: payload,
            index: index
        });
    }

    function startSenderLoop(port) {
        var batch = null;
        var node = null;
        var cmd = null;
        var payload = null;
        var index = null;

        setInterval(function() {
            if (batch != null) {
                cmd = batch.cmdList.shift();
            } else if (sendQueue.length > 0) {
                batch = sendQueue.shift();
                node = batch.node;
                cmd = batch.cmdList.shift();
                payload = batch.payload;
                index = batch.index;
            }
            if (cmd) {
                if (index == 0 && payload != null) {
                    port.write(cmd + payload + '\n');
                } else {
                    port.write(cmd + '\n');
                }
                index = index - 1;
            } else {
                if (node!= null) {
                    node.send({msg: null});
                }
                batch = null;
            }
        }, CMD_SEND_INTERVAL);
    }

    /*
     * Updates port statu on vwire-status node
     */
    function updatePortStatus(status) {
        if (status != null) {
            portOpened = status;
        }
        var parser = '';
        if (parserEnabled) {
            parser = ', parser on';
        }
        for (var s of statusIndicators) {
            switch(portOpened) {
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
            port.on('open', function() {
                var cmdList = ['STP', 'CSC'].concat(subscriptions);
                //console.log(cmdList);
                startSenderLoop(port);
                sendCommands(null, cmdList, null, 0);
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
                                        var dest = transactions._in[0];
                                        dest.send(msg);
                                    }

                                    var deviceIdString = deviceId.toString();
                                    if (deviceIdString in transactions) {
                                        var dest = transactions[deviceIdString][0];
                                        dest.send(msg);
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
                cleanUp();
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
            cleanUp(); 
            done();
        });
    }
    RED.nodes.registerType("vwire-config", VwireConfig);

    function VwireIn(config) {
        RED.nodes.createNode(this, config);
        var node = this;
        getPort();
        transactions._in = [node, null];
        node.on('close', function(removed, done) {
            cleanUp();
            done();
        });
    }
    RED.nodes.registerType("vwire-in", VwireIn);

    function VwireStatus(config) {
        RED.nodes.createNode(this, config);
        var node = this;
        var port = getPort();
        statusIndicators.push(node);
        updatePortStatus(null);
        node.on('close', function(removed, done) {
            cleanUp(); 
            done();
        });
    }
    RED.nodes.registerType("vwire-status", VwireStatus);
    
    function vwire(config) {
        RED.nodes.createNode(this, config);
        var node = this;
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
            cleanUp(); 
            done();
        });
    }
    RED.nodes.registerType("vwire", vwire);
    
    function vwireMaker(cmd, noack, parserExtension) {
        function vwire(config) {
            RED.nodes.createNode(this, config);
            var node = this;
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
                cleanUp();
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
                sendCommands(node, [].concat(cmdList), payload, index);
            });
            node.on('close', function(removed, done) {
                cleanUp();
                done();
            });
        }
        return vwire;
    }

    /*
     * Limitation: 
     * (1) this function works only for nodes with parserEnabled = true.
     */
    function vwireSubscriberMaker(deviceId) {
        function vwire(config) {
            RED.nodes.createNode(this, config);
            var node = this;
            var port = getPort(); 
            var timer = ('timer' in config) ? config.timer : 5;
            var timeslot = schedule[timer];
            var i;
            for (i=0; i<4; i++) {
                if (timeslot[i] == 0) {
                    timeslot[i] = deviceId;
                    break;
                }
            }
            var pos = 4 * timer + i;
            /*
            console.log(timeslot);
            console.log(pos);
            console.log(timer);
            console.log(i);
            */

            var subscription = ['POS:'+pos.toString(), 'WSC:'+deviceId, 'STA'];
            if (port.isOpen) {
                console.log('port is open');
                sendCommands(null, subscription, null, 0);
            } else {
                console.log('port is still not open');
                subscriptions = subscriptions.concat(subscription);
                console.log(subscriptions);
            }

            transactions[deviceId.toString()] = [node, null]; 
            
            node.on('close', function(removed, done) {
                cleanUp();
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
    RED.nodes.registerType("hall-sensor-subscriber", vwireSubscriberMaker(17));
    RED.nodes.registerType("accelerometer-subscriber", vwireSubscriberMaker(19));
    RED.nodes.registerType("temperature-humidity-subscriber", vwireSubscriberMaker(20));
    RED.nodes.registerType("position-detector-subscriber-1", vwireSubscriberMaker(21));
    RED.nodes.registerType("position-detector-subscriber-2", vwireSubscriberMaker(22));
    // The following nodes require ParserEnabled = false
    RED.nodes.registerType("door-status", vwireMaker("07", false, null));
    RED.nodes.registerType("door-unlock", vwireMaker("150", false, null));
    RED.nodes.registerType("door-lock", vwireMaker("1590", false, null));
    RED.nodes.registerType("door-led-on", vwireMaker("180", true, null));
    RED.nodes.registerType("door-led-off", vwireMaker("181", true, null));
}
