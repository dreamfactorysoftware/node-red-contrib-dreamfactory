/**
 * Copyright 2013,2014 IBM Corp.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 **/

module.exports = function(RED) {
    "use strict";
    var http = require("follow-redirects").http;
    var https = require("follow-redirects").https;
    var urllib = require("url");
    var express = require("express");
    var getBody = require('raw-body');
    var mustache = require("mustache");
    var querystring = require("querystring");

    var cors = require('cors');
    var jsonParser = express.json();
    var urlencParser = express.urlencoded();

    function rawBodyParser(req, res, next) {
        if (req._body) { return next(); }
        req.body = "";
        req._body = true;
        getBody(req, {
            limit: '1mb',
            length: req.headers['content-length'],
            encoding: 'utf8'
        }, function (err, buf) {
            if (err) { return next(err); }
            req.body = buf;
            next();
        });
    }

    function DreamFactoryRequest(config) {

        RED.nodes.createNode(this,config);
        this.server = RED.nodes.getNode(config.server);
        var n = this.server;

        var nodeUrl = n.host;
        if(n.port != ""){
            nodeUrl += ":" + n.port;
        }
        var query_params = "";
        if(n.x_params){
            query_params = "&" + query_params;
        }
        nodeUrl += n.path + "?app_name=" + n.app_name + query_params;
        var isTemplatedUrl = (nodeUrl||"").indexOf("{{") != -1;
        var nodeMethod = n.x_method || "GET";
        var node = this;
        this.on("input",function(msg) {
            node.status({fill:"blue",shape:"dot",text:"requesting"});
            var url;
            if (msg.url) {
                url = msg.url;
            } else if (isTemplatedUrl) {
                url = mustache.render(nodeUrl,msg);
            } else {
                url = nodeUrl;
            }
            // url must start http:// or https:// so assume http:// if not set
            if (!((url.indexOf("http://")===0) || (url.indexOf("https://")===0))) {
                url = "http://"+url;
            }

            var method = (msg.method||nodeMethod).toUpperCase();
            //node.log(method+" : "+url);
            var opts = urllib.parse(url);
            opts.method = method;
            opts.headers = {};
            if (msg.headers) {
                for (var v in msg.headers) {
                    if (msg.headers.hasOwnProperty(v)) {
                        var name = v.toLowerCase();
                        if (name !== "content-type" && name !== "content-length") {
                            // only normalise the known headers used later in this
                            // function. Otherwise leave them alone.
                            name = v;
                        }
                        opts.headers[name] = msg.headers[v];
                    }
                }
            }
            if (this.credentials && this.credentials.user) {
                opts.auth = this.credentials.user+":"+(this.credentials.password||"");
            }
            var payload = null;

            if (msg.payload && (method == "POST" || method == "PUT") ) {
                if (typeof msg.payload === "string" || Buffer.isBuffer(msg.payload)) {
                    payload = msg.payload;
                } else if (typeof msg.payload == "number") {
                    payload = msg.payload+"";
                } else {
                    if (opts.headers['content-type'] == 'application/x-www-form-urlencoded') {
                        payload = querystring.stringify(msg.payload);
                    } else {
                        payload = JSON.stringify(msg.payload);
                        if (opts.headers['content-type'] == null) {
                            opts.headers['content-type'] = "application/json";
                        }
                    }
                }
                if (opts.headers['content-length'] == null) {
                    opts.headers['content-length'] = Buffer.byteLength(payload);
                }
            }

            var req = ((/^https/.test(url))?https:http).request(opts,function(res) {
                res.setEncoding('utf8');
                msg.statusCode = res.statusCode;
                msg.headers = res.headers;
                msg.payload = "";
                res.on('data',function(chunk) {
                    msg.payload += chunk;
                });
                res.on('end',function() {
                    node.send(msg);
                    node.status({});
                });
            });
            req.on('error',function(err) {
                msg.payload = err.toString() + " : " + url;
                msg.statusCode = err.code;
                node.send(msg);
                node.status({fill:"red",shape:"ring",text:err.code});
            });
            if (payload) {
                req.write(payload);
            }
            req.end();
        });
    }

    RED.nodes.registerType("dreamfactory",DreamFactoryRequest,{
        credentials: {
            user: {type:"text"},
            password: {type: "password"}
        }
    });
}
