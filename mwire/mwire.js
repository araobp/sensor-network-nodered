/*
 * Node to communicate with device simulators via a mqtt network.
 */

module.exports = function(RED) {
    'use strict';

    const MQTT = require('mqtt');

    var server = null;
    var client = null;
    var transactions = {};
    var subscriptions = [];
    var statusIndicators = [];
    var clientConnected = false;

    function cleanUp() {
        transactions = {};
        if (client != null) {
            subcriptions.forEach(elm => client.unsubscribe(elm));
        }
        subscriptions.length = 0;
        statusIndicators.length = 0;
        server = null;
    }

    /*
     * Updates mqtt client status on mwire-status node
     */
    function updateClientStatus(status) {
        if (status != null) {
            clientConnected = status;
        }
        for (var s of statusIndicators) {
            switch(clientConnected) {
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
     * Gets a mqtt client
     */
    function getClient() {
        if (client == null) { 
            updateClientStatus(null);
            client = MQTT.connect(server);
            client.on('connect', function() {
                updateClientStatus(true);
            });
            client.on('message', function(topic, payload) {
                payload = JSON.parse(payload);
                var key = topic + ":" + payload.cmd;
                if (key in transactions) {
                    transactions[key].send({payload: payload});
                    delete transactions[key];
                }
            });
            client.on('close', function() {
                updateClientStatus(false);
                client = null;
            });
        }
        return client;
    }
    
    /*
     * mwire-config node
     */
    function MwireConfig(n) {
        RED.nodes.createNode(this, n);
        var node = this;
        this.server = n.server;
        server = 'mqtt://' + this.server;
        this.on('close', function(removed, done) {
            cleanUp();
            done();
        });
    }
    RED.nodes.registerType("mwire-config", MwireConfig);

    /*
     * mwire-status node
     */
    function MwireStatus(config) {
        RED.nodes.createNode(this, config);
        var node = this;
        var client = getClient();
        statusIndicators.push(node);
        updateClientStatus(null);
        node.on('close', function(removed, done) {
            cleanUp();
            done();
        });
    }
    RED.nodes.registerType("mwire-status", MwireStatus);
    
    /*
     * mwire node
     */
    function mwire(config) {
        RED.nodes.createNode(this, config);
        var node = this;
        var deviceId = config.device;
        var command = config.command || null;
        var args = null;
        if (config.args) {
            if (typeof(config.args) == "string") {
                args = config.args;
            } else {
                args = JSON.parse(config.args);
            }
        }
        var noack = config.noack;
        var topicTx = deviceId + '-tx';
        var topicRx = deviceId + '-rx';
        var client = getClient();
        client.subscribe(topicTx);
        if (subscriptions.indexOf(topicTx) < 0) {
            subscriptions.push(topicTx);
        }
        node.on('input', function(msg) {
            var cmd = null;
            if (command != null) {
                cmd = {cmd: command, args: args};
            } else {
                cmd = msg.payload;
            }
            if (!noack) {
                transactions[topicTx + ':' + cmd.cmd] = node;
                client.publish(topicRx, JSON.stringify(cmd));
            } else {
                client.publish(topicRx, JSON.stringify(cmd));
                node.send({payload: null});
            }
            console.log(JSON.stringify(cmd));
        });
        node.on('close', function(removed, done) {
            cleanUp();
            done();
        });
    }
    RED.nodes.registerType("mwire", mwire);
}
