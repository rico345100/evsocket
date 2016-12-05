"use strict";
const uuid = require('node-uuid');
const ws = require('ws');

// string-binary-attacher
const sba = require('string-binary-attacher');
const attachStringToBinary = sba.attachStringToBinary;
const detachStringFromBinary = sba.detachStringFromBinary; 
const extractStringFromBinary = sba.extractStringFromBinary;

// utilties
const util = require('../util');
const parseMetaData = util.parseMetaData;
const toArrayBuffer = util.toArrayBuffer;

const auth = require('../auth');
const channels = require('../channels');
const middlewares = require('../middlewares');
const sockets = require('../sockets');

const applyMiddlewares = middlewares.applyMiddlewares;

function EvSocket(socket, options) {
	if(!socket) {
		throw new Error('EvSocket requires WebSocket.');
	}

	options = options || {};

	this.id = uuid.v1();
	this.socket = socket;
	this.socket.binaryType = 'arraybuffer';
	this.ev = {};
	this.channelName = '';

	sockets.add(this);

	var authFn = auth.getAuthFn();

	this.send('__evsock__::sync', {
		id: this.id,
		hasAuth: (typeof authFn === 'function')
	});

	this.once('__evsock__::authenticate', (data) => {
		// Auth
		if(authFn) {
			let next = (error) => {
				if(error) {
					this.emit('unauthorized', error);
					this.send('unauthorized', error);

					this.close();
				}
				else {
					this.emit('authenticated');
					this.send('authenticated');
				}
			};

			authFn(this, data, next);
		}
	});

	socket.onclose = (code, reason) => {
		this.emit('close', code, reason);

		// remove from channel
		channels.leave(this, this.channelName);
		this.channelName = '';

		// delete socket
		sockets.remove(this);
	};
	socket.onerror = (err) => {
		this.emit('error', err);
	};
	socket.onmessage = (ev) => {
		var recv = ev.data;
		
		if(typeof recv === 'string') {
			recv = parseMetaData(recv);

			if(recv.evName === '__evsock__::sync') {
				this.id = recv.data.id;
				this.emit('open');
			}
			else if(recv.evName === '__evsock__::authenticate') {
				this.emit('__evsock__::authenticate', recv.data);
			}
			else if(recv.evName === '__evsock__::join-channel') {
				this.join(recv.data);
			}
			else if(recv.evName === '__evsock__::leave-channel') {
				this.leave(recv.data);
			}
			else if(recv.evName === '__evsock__::broadcast') {
				this.broadcast(recv.data.evName, recv.data.data);
			}
			else {
				middlewares.applyMiddlewares(this, recv.data, 
					function(data) {
						return evSocket.emit(evName, data);
					},
					function(err, data) {
						return evSocket.emit('error', errorMiddlewares.error);
					}
				);
			}
		}
		else if(recv instanceof ArrayBuffer) {
			var metaData = extractStringFromBinary(recv);
			var buf = detachStringFromBinary(recv);

			recv = parseMetaData(metaData);
			recv.data = buf;
			middlewares.applyMiddlewares(this, recv);
			// this.emit(recv.evName, buf);
		}
		else {
			throw new Error('EvSocket currently only supports string transmission.');
		}
	};
}
EvSocket.prototype.close = function() {
	this.socket.close();
};
EvSocket.prototype.send = function(evName, data) {
	let obj = {
		event: evName,
		data: data
	};

	obj = JSON.stringify(obj);
	this.socket.send(obj);
};
EvSocket.prototype.sendBinary = function(evName, buffer) {
	// If data is Node.js Buffer, convert to ArrayBuffer
	if(buffer instanceof Buffer) {
		buffer = toArrayBuffer(buffer);
	}
	else {
		buffer = buffer.buffer || buffer;	// If it is not ArrayBuffer and it's TypedArray, get buffer.
	}

	var metaData = JSON.stringify({ event: evName });
	var newBuf = attachStringToBinary(buffer, metaData);

	this.socket.binaryType = 'arraybuffer';
	this.socket.send(newBuf);
};
EvSocket.prototype.on = function(evName, fn) {
	if(!this.ev[evName]) {
		this.ev[evName] = [];
	}

	this.ev[evName].push(fn);
	return this;
};
EvSocket.prototype.once = function(evName, fn) {
	if(!this.ev[evName]) {
		this.ev[evName] = [];
	}

	fn.once = true;
	this.ev[evName].push(fn);
	return this;
};
EvSocket.prototype.off = function(evName, fn) {
	if(typeof evName === 'undefined') {
		this.ev = [];
	}
	else if(typeof fn === 'undefined') {
		if(this.ev[evName]) {
			delete this.ev[evName]; 
		}
	}
	else {
		var evList = this.ev[evName] || [];

		for(var i = 0; i < evList.length; i++) {
			if(evList[i] === fn) {
				evList = evList.splice(i, 1);
				break;
			}
		}
	}

	return this;
};
EvSocket.prototype.emit = function(evName) {
	var evList = this.ev[evName] || [];
	var args = Array.prototype.slice.call(arguments);

	args.splice(0, 1);

	var newEvList = [];
	for(var i = 0; i < evList.length; i++) {
		var fn = evList[i];
		fn.apply(this, args);

		// remove function if it attached by once method.
		if(!fn.once) {
			newEvList.push(fn);
		}
	}

	this.ev[evName] = newEvList;
	return this;
};
EvSocket.prototype.join = function(channelName) {
	if(this.channelName) {
		this.leave();	
	}

	this.channelName = channelName;
	channels.join(this, channelName);

	this.emit('channeljoin', this.channelName);
	this.send('__evsock__::channeljoin', this.channelName);
};
EvSocket.prototype.leave = function(channelName) {
	this.emit('channelleave', this.channelName);
	this.send('__evsock__::channelleave', this.channelName);

	channels.leave(this, this.channelName);
	this.channelName = '';
};
EvSocket.prototype.broadcast = function(evName, data) {
	this.broadcastTo(this.channelName, evName, data);
};
EvSocket.prototype.broadcastTo = function(channelName, evName, data) {
	if(!channelName) return;

	this.multicast(function(sock) {
		return sock.channelName === channelName;
	}, evName, data);
};
EvSocket.prototype.multicast = function(filter, evName, data) {
	filter = filter || function(){};
	
	const socks = sockets.get();

	for(var key in socks) {
		let sock = socks[key];
		let result = filter(sock);
		
		if(result && sock.socket.readyState === 1) {
			applyMiddlewares(sock, data, function(data) {
				sock.send(evName, data);
			}, function(err, data) {
				sock.send('error', {
					message: err.message
				});
			});
		}
	}
};

module.exports = EvSocket;