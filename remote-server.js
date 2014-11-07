module.exports = function (RED) {
    function RemoteServerNode(n) {
        RED.nodes.createNode(this, n);
        this.x_method = n.x_method;
        this.host = n.host;
        this.path = n.path;
        this.app_name = n.app_name;
        this.port = n.port;
    }

    RED.nodes.registerType("remote-server", RemoteServerNode);
};