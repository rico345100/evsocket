"use strict";
const sockets = {};

function add(socket) {
	sockets[socket.id] = socket;
}
function remove(socket) {
	delete sockets[socket.id];
}
function get() {
	return sockets;
}

module.exports = {
	add: add,
	remove: remove,
	get: get
};