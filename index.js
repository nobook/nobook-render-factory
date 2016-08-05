#!/usr/bin/env node
var fs = require('fs');
var websocket = require('websocket');
var http = require('http');
var mkdir = require('mkdir-p');
//渲染配置
var conf = {};
var argv = process.argv;
//读取渲染参数
for (var i = 2; i < argv.length; i ++) {
	var arg = argv[i];
	switch (arg) {
		//开始帧
		case '-s' :
		{
			conf.s = parseInt(argv[++i]);
			break;
		}
		//结束帧
		case '-e' : 
		{
			conf.e = parseInt(argv[++i]);
			break;
		}
		//渲染文件
		case '-i' :
		{
			conf.i = argv[++i];
			break;
		}
		//frames, 可以渲染不连续的帧
		case '-fs' :
		{
			conf.fs = argv[++i];
			break;
		}
		//p, 端口号
		case '-p' :
		{
			conf.p = argv[++i];
			break;
		}
	}
}

if (conf.fs === undefined) {
	if (conf.e === undefined) {
		console.log("请输入开始帧 如：-e 0")
		return;
	}

	if (conf.s === undefined) {
		console.log("请输入结束帧 如：-s 100")
		return;
	}
}

if (conf.i === undefined) {
	console.log("请输入渲染文件 如：-i xxx.zip 主文件必须要包含index.ma")
	return;
}

//根据开始和结束帧，生成渲染帧数组
var renderAry = [];
if (conf.fs) {
	renderAry = conf.fs.split(',');
} else {
	for (var i = conf.s; i <= conf.e; i ++) {
		renderAry.push(i);
	}
}
//翻转数组
renderAry.reverse();

//正在被渲染的帧
var renderingAry = [];
const PROTOCOL_RENDER_CONN = require('./const').PROTOCOL_RENDER_CONN;

//连接数组
var connAry = [];

//获取 web socket server
var WebSocketServer = websocket.server;
//声明一个httpserver
var server = http.createServer(function(request, response) {
	console.log(request, response);
});

server.listen(conf.p || 9989, function() {
	console.log("server is start!");
});

var wsServer = new WebSocketServer({
	httpServer:server,
	maxReceivedMessageSize:0x8000000,
	dropConnectionOnKeepaliveTimeout:false
});

wsServer.on('request', function(request) {
	//console.log('-->', request.requestedProtocols);
	if (request.requestedProtocols[0] === PROTOCOL_RENDER_CONN) {
		var connection = request.accept(PROTOCOL_RENDER_CONN, request.origin);
		connAry.push(connection);

		connection.on('message', function(message) {
			if (message.type === 'utf8') {
				switch (message.utf8Data) {
					//请求渲染帧
					case 'requestRenderFrame':
					{
						var data = requestRenderFrame();
						//设置当前渲染的数据
						connection.currentRenderData = data;
						console.log(data);
						connection.sendUTF(JSON.stringify(data));
						break;
					}
				}	
			} else if (message.type === 'binary') {
				var position = 0;
				//从客户端传过来的渲染文件
				var buffer = message.binaryData;
				//文件长度
				var fileNameLength = buffer.readInt32BE(0);
				position = 4;
				//文件名
				var fileName = buffer.toString('ascii', position, position + fileNameLength);
				position += fileNameLength;
				//需要保存的文件buffer
				var fileBuffer = buffer.slice(position, buffer.length);
				var outputFile = 'receive-render/' + fileName;
				outputFile = outputFile.replace(/\\/gi, '/');
				var outputFolder = outputFile.substr(0, outputFile.lastIndexOf('/'));	
				console.log(outputFolder)
				mkdir.sync(outputFolder);
				//fs.unlinkSync(outputFile);
				fs.writeFileSync(outputFile, fileBuffer);
			}
		});

		connection.on('close', function() {
			var index = connAry.indexOf(this);
			if (index != -1) {
				connAry.splice(index, 1);
			}
			if (connection.currentRenderData) {
				renderAry.push(connection.currentRenderData.render.frame);
			}
			console.log("remove connection " + this);
		});

		//将文件发送给客户端
		var buffer = fs.readFileSync(conf.i);
		connection.sendBytes(buffer);
	}
});

/**
 * 获取下一帧渲染的数据
 */
function requestRenderFrame() {
	var data = renderAry.pop();
	if (data == null) {
		return {};
	}
	return {render:{
		frame:data
	}};
}

