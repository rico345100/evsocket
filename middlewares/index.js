"use strict";

const middlewares = [];
middlewares.type = 'middleware';

const errorMiddlewares = [];
errorMiddlewares.type = 'error';
errorMiddlewares.error = null;

function addMiddleware(fn) {
	middlewares.push(fn);
}

function addErrorMiddleware(fn) {
	errorMiddlewares.push(fn);
}

function applyMiddlewares(evSocket, data, successFn, errorFn) {
	successFn = typeof successFn === 'function' ? successFn : function() {};
	errorFn = typeof errorFn === 'function' ? errorFn : function() {};

	function runMiddleware(middlewares) {
		if(middlewares.length === 0) {
			return successFn(data);
		}

		var idx = 0;
		var len = middlewares.length;

		function run() {
			var middleware = middlewares[idx];

			function fn(err) {
				// Got an error while passing middleware,
				// stop passing middlewares and switch to error middlewares.
				if(middlewares.type === 'middleware' && err) {
					errorMiddlewares.error = err;
					runMiddleware(errorMiddlewares);
				}
				else {
					idx++;
					
					if(idx === len) {
						if(middlewares.type === 'error') {
							return errorFn(errorMiddlewares.error, data);
						}
						else {
							return successFn(data);
						}
					}
					else {
						run();
					}
				}
			}

			if(middlewares.type === 'middleware') {
				middleware(evSocket, data, fn);
			}
			else if(middlewares.type === 'error') {
				middleware(errorMiddlewares.error, evSocket, data, fn);
			}
			else {
				throw new Error('Unsupported Middleware Type: ' + middlewares.type);
			}
		}

		run();
	}

	runMiddleware(middlewares);
}

module.exports = {
	addMiddleware: addMiddleware,
	addErrorMiddleware: addErrorMiddleware,
	applyMiddlewares: applyMiddlewares
};