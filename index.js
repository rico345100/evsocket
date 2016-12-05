"use strict";
const EventEmitter = require('events').EventEmitter;
const util = require('util');
const wss = require('ws').Server;

const auth = require('./auth');
const EvSocket = require('./evsocket');

const middlewares = require('./middlewares');

function EvSocketServer(options) {
	this.server = new wss(options);

	this.server.on('connection', (socket) => {
		var sock = new EvSocket(socket);

		this.emit('connection', sock);
	});
	this.server.on('error', (err) => {
		this.emit('error', err);
	});
	this.server.on('headers', (headers) => {
		this.emit('headers', headers);
	});
}
util.inherits(EvSocketServer, EventEmitter);

module.exports = {
	createServer: function(options) {
		return new EvSocketServer(options);
	},
	useAuth: function(fn) {
		auth.setAuthFn(fn);
	},
	setMiddleware: function(fn) {
		middlewares.addMiddleware(fn);
	},
	setErrorMiddleware: function(fn) {
		middlewares.addErrorMiddleware(fn);
	}
};