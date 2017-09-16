module.exports = function(RED) {
    'use strict';
    const SerialPort = require('serialport');
    const parsers = SerialPort.parsers;

    const port = new SerialPort('/dev/ttyUSB0', {
        baudRate: 115200,
        parser: SerialPort.parsers.raw,
        autoOpen: true
    });

    port.on('open', console.log);


    function Vwire(config) {
        RED.nodes.createNode(this, config);
        var node = this;
        var buf = []; 
        node.on('input', function(msg) {
            var cmd = msg.payload;
            port.write('WHO\n');
        });
        port.on('data', function(data) {
            for (var c of data) {
                if (c == 10) {
                    var msg = {payload: new Buffer(buf).toString('utf8')};
                    buf.length = 0;
                    node.send(msg);
                } else {
                    buf.push(c);
                }
            }
        });
    }
    RED.nodes.registerType("vwire", Vwire);
}
