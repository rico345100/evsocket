"use strict";

function parseMetaData(recv) {
	try {
		recv = JSON.parse(recv);
	}
	catch(err) {
		throw new Error(err);
	}

	return {
		evName: recv.event,
		data: recv.data
	};
}
function toArrayBuffer(buf) {
	var ab = new ArrayBuffer(buf.length);
	var view = new Uint8Array(ab);
	for (var i = 0; i < buf.length; ++i) {
		view[i] = buf[i];
	}
	return ab;
}
function hasObjectValue(obj) {
	var cnt = 0;
	for(var key in obj) {
		if(obj.hasOwnProperty(key)) {
			cnt++;
		}
	}

	return (cnt > 0);
}

module.exports = {
	parseMetaData: parseMetaData,
	toArrayBuffer: toArrayBuffer,
	hasObjectValue: hasObjectValue
};