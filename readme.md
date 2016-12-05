# EvSocket
Abstracted WebSocket module with event driven interface and rich functionalities. See also [evsocket-client](https://www.npmjs.com/package/evsocket-client).
Server side uses [ws](https://www.npmjs.com/package/ws) module to implement WebSocket server.


## Why use this?
There is well-known alternative for this module, Socket.io, but unfortunately Socket.io doesn't support React Native, because it uses Node.js features inside.
This module built for provide highly abstracted WebSocket interface without any Node.js related features, only used pure JavaScript features.
When I was used WebSocket with vanila JS, it was really hard to make something rich.
EvSocket provides similar interface like Socket.io with only uses WebSocket + JavaScript features so it is safe to use any WebSocket supporting JavaScript platform.


## Features
- Event Driven Interface
- Easy Authentication
- Binary Transmission
- Middlewares
- Channel system(like Room in Socket.io)
- Socket Broadcasting
- And more...!

### Event Driven
Event Driven is super useful interface that implement complicated web applications easily. Plain WebSocket only supports onmessage and send() method to exchange data, but most of time, you want to send and get data with multiple entries.
For this, EvSocket supports Event Driven interface like Socket.io(as you can see the name, EvSocket means EventSocket), and if you already used Socket.io, this will really easy to use.

```javascript
// Server Side
const http = require('http');
const httpServ = http.createServer();
const evsocket = require('evsocket');
const server = evsocket.createServer({ server: httpServ });

server.on('connection', (socket) => {
	console.log('Socket connected.');
});

//Client Side
var socket = new EvSocket("ws://localhost:3000");
socket.on('open', () => {
	socket.send('boom', 'BOOM!');
});
```

You can set any event name you want, and you can trigger any event whenever you want. Also it supports object sending/getting, if you sent object, it will automatically do serializing/parsing jobs when receiver got the message, so you don't have to serialize or parse JavaScript object everytime.


### Binary Transmission
WebSocket supports sending ArrayBuffer, that is built-in native binary data format. However there is no way to send binary data with string at once. This makes hard to implement Event Driven interface with binary transmission. EvSocket supports Event Driven binary transmission, inside, it converts some metadata like event name to binary data and combine them together. And then EvSocket send the bundled binary data, and when got this, detach the metadata from this, and parse the metadata to find correct event name of binary transffering destination.
Want to know more about this, please check [string-binary-attacher](https://www.npmjs.com/package/string-binary-attacher) module that I made for this purpose.

For provide better performance, to send binary data via EvSocket, you should use sendBinary() instead of send().

```javascript
// Server Side
socket.once('send-binary', (bin) => {
	console.log('Got binary from client: ', bin);
	socket.sendBinary('got-binary', bin);			// send back
});

// Client Side
socket.once('got-binary', function(bin) {
	console.log('Got binary from server: ' + new Uint8Array(bin).toString());
});

var uint8Array = new Uint8Array([0,1,2,3,4,5,6,7]);
socket.sendBinary('send-binary', uint8Array);
```

Also it supports sending Node.js Buffer. Internally it converts to ArrayBuffer.


### Auto uid generation
EvSocket automatically generate unique id for each socket when it's connected.

```javascript
// Server Side
server.on('connection', (socket) => {
	console.log('Connected: ' + socket.id);
});

// Client Side
var socket = new EvSocket("ws://localhost:3000");

socket.on('open', () => {
	console.log('ID is ' + socket.id);
});
```

### Middlewares
EvSocket provides Middleware system. Each message from client passing through these middlewares and you can access the data between middlewares and modify it.
This system inspired from connect and express's middleware system.

```javascript
const evsocket = require('evsocket');

// Set Middlewares
evsocket.setMiddleware((socket, data, next) => {
	console.log('Middleware 1', data);
	next();
});
evsocket.setMiddleware((socket, data, next) => {
	// console.log('Middleware 2 (Async)', recv);
	// setTimeout(next, 1000);
	console.log('Middleware 2', data);
	next();
});
evsocket.setMiddleware((socket, data, next) => {
	console.log('Middleware 3', data);
	// next();
	// Give Error here
	next(new Error('Stop!'));
});
evsocket.setMiddleware((socket, data, next) => {
	console.log('Middleware 4', data);
	next();
});
evsocket.setErrorMiddleware((error, socket, data, next) => {
	console.log('Error Middleware 1', error);
	next();
});
evsocket.setErrorMiddleware((error, socket, data, next) => {
	console.log('Error Middleware 2', error);
	next();
});
```

### Authentication
EvSocket provides built-in authenticating system, which useful to authenticate socket. Only you have to do is use useAuth() method to generate own authentication rule and apply it when client socket created. Then server and client exchange their data and authenticate it by your own rule. After it succeeds, it calling 'authenticated' events both, else, it calling 'unauthorized' events both and close the socket automatically after event fires.

```javascript
// Server Side
evsocket.useAuth((socket, data, done) => {
	if(data.id === '.modernator' && data.password === '1234') {
		done();
	}
	else {
		done(new Error('Unauthorized.'));
	}
});

//Client Side
var socket = new EvSocket('ws://localhost:3000', {
	auth: {
		id: '.modernator',
		password: '1234'
	}
});

socket.on('open', function() {
	console.log('Connected as ' + socket.id);

	socket.on('authenticated', () => {
		console.log('Authenticated.');
		// your code goes here...
	});
	socket.on('unauthorized', (err) => {
		console.log('unauthorized.');
	});
});
```

### Channel System & Broadcasting
Channel system allows you to grouping sockets easily. Also you can broadcast message to other sockets in same channel.

```javascript
socket.on('chat', (msg) => {
	console.log(msg);
});

socket.join('channel1');
socket.broadcast('chat', 'Hello!');
```

evSocket.broadcast() sends message to all users in the same channel. This is quite useful to implement chat room like something.


## API

### void createServer(object options)
Possible options follows this [doc](https://github.com/websockets/ws/blob/master/doc/ws.md). 

```javascript
const evsocket = require('evsocket');
const server = evsocket.createServer({ port: 3000});

server.on('connection', (socket) => { ... });
```

### void setMiddleware(function middleware)
Add a middleware. Callback function receives 3 arguments, socket, recv, next. socket argument is EvSocket and recv is object that has event name with data.

```javascript
const EvSocket = require('evsocket');

EvSocket.setMiddleware((socket, data, next) => {
	recv.data = base64_encoding(data);
	next();
});

```

### void setErrorMiddleware(function middleware)
Add an error middleware. Callback function receives 4 arguments, error, socket, recv, next. error is Error Object that contains error information.

```javascript
const EvSocket = require('evsocket');

EvSocket.setMiddleware((socket, data, next) => {
	if(!socket.someRequiredData) {
		return next(new Error('Unauthorized'));
	}
	
	next();
});

EvSocket.setErrorMiddleware((error, socket, data, next) => {
	socket.send('error', error);
	socket.close();
});
```

### void useAuth(function authFn)
Add authentication function. Callback function receives 3 arguments, socket, data, done. Data is just data received from client.

```javascript
const EvSocket = require('evsocket');
const secretKey = 'some-secret';

EvSocket.useAuth((socket, data, done) => {
	if(data.secretKey !== secretKey) {
		return done(new Error('Invalid key.'));
	}
	
	done();
});
```

```javascript
// Client
var EvSocket = new EvSocket('ws://localhost:3000', {
	auth: { key: 'some-secret' }
});
```

## API of Socket object
When new Socket is connected, connection event will emit and send EvSocket instance as first argument.

### EvSocket.prototype.close(void)
Close WebSocket.

```javascript
server.on('connection', (socket) => {
	socket.close();
});
```

### EvSocket.prototype.send(string evName, object data)
Send the data with event name to client.

```javascript
server.on('connection', (socket) => {
	socket.send('client-ev', 'hello, client!');
});
```

### EvSocket.prototype.sendBinary(string evName, ArrayBuffer data)
### EvSocket.prototype.sendBinary(string evName, TypedArray data)
Send the binary data with event name to client.

```javascript
server.on('connection', (socket) => {
	socket.sendBinary('some-client-event', new Uint8Array([1,2,3,4,5,6,7,8]));
});
```

### EvSocket.prototype.on(string evName, function fn)
Add event listener.

### EvSocket.prototype.once(string evName, function fn)
Add event listener that execute only once and delete itself automatically.

### EvSocket.prototype.off(string evName[, function fn])
Remove event listener. If fn argument is undefined, remove all listeners in specified event name.

### EvSocket.prototype.emit(string evName[, object data])
Fires event of server socket.

### EvSocket.prototype.join(string channelName)
Join the specified channel.

```javascript
server.on('connection', (socket) => {
	socket.on('channeljoin', (channelName) => {
		console.log(`Channel ${channelName} joined.`);
	});
	
	socket.join('channel1');
});
```

### EvSocket.prototype.leave(void)
Leave the current channel.

```javascript
socket.join('channel1');
console.log(socket.channelName);	// channel1
socket.leave();
console.log(socket.channelName);	// Empty
```

### EvSocket.prototype.broadcast(string evName[, object data])
Broadcast message to users who currently in same channel.

```javascript
server.on('connection', (socket) => {
	socket.on('channeljoin', (channelName) => {
		console.log(`Channel ${channelName} joined.`);
		socket.broadcast('chat', `${socket.id} joined in ${channelName}.`);
	});
	
	socket.join('channel1');
});
```

### EvSocket.prototype.broadcastTo(string channelName, string evName[, object data])
Broadcast message to users who in specified channel.

```javascript
socket.broadcastTo('some-channel', 'chat', 'helloworld!');
```

### EvSocket.prototype.multicast(function filter, string evName[, object data])
Multicast message to users who matches filter.

```javascript
// Multicast only that has someProp property in socket.
socket.multicast(function(sock) {
	return sock.someProp === true;
};
```


## Events
You can use any name of the event, except these default events. These default events are triggering by EvSocket directly.

### onclose
Fired on socket closed. Arguments are code and reason, please check this: [https://developer.mozilla.org/en-US/docs/Web/API/CloseEvent#Status_codes](https://developer.mozilla.org/en-US/docs/Web/API/CloseEvent#Status_codes)

### onerror
Fired on error occured. Has one argument, error object.

### onauthenticated
Fired on EvSocket passed authentication.

### onunauthorized
Fired on EvSocket failed authentication. After this event occurs, socket will close.

### onchanneljoin
Fired on user joined channel.

### onchannelleave
Fired on user left channel.