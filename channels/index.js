"use strict";
const util = require('../util');
const hasObjectValue = util.hasObjectValue;

const channels = {};

function join(socket, channelName) {
	if(!channels[channelName]) {
		channels[channelName] = {};
	}

	channels[channelName][socket.id] = true;
}
function leave(socket, channelName) {
	if(!channels[channelName]) return;

	delete channels[channelName][socket.id];

	if(hasObjectValue(channels[channelName])) {
		delete channels[channelName];
	}
}
function getChannelNames() {
	var result = [];

	for(var key in channels) {
		result.push(key);
	}

	return result;
}

module.exports = {
	join: join,
	leave: leave,
	getChannelNames: getChannelNames
};