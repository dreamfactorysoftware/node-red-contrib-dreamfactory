module.exports = function(RED) {
    function DreamFactoryServersNode(n) {
        RED.nodes.createNode(this,n);
        this.host = n.host;
        this.port = n.port;
    }
    RED.nodes.registerType("dreamfactory-servers",DreamFactoryServersNode);
}