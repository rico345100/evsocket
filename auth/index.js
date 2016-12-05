"use strict";
let authFn = null;
let authData = {};

module.exports = {
	setAuthFn: function(fn) {
		authFn = fn;
	},
	getAuthFn: function() {
		return authFn;
	}
};