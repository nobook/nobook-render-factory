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
			conf.s = argv[++i];
			break;
		}
		//结束帧
		case '-e' : 
		{
			conf.e = argv[++i];
			break;
		}
		case '-i' :
		{
			conf.i = argv[++i];
			break;
		}
		case '-o' :
		{
			conf.o = argv[++i];
			break;
		}
	}
}

if (conf.e === undefined) {
	console.log("请输入开始帧 如：-e 0")
	return;
}

if (conf.s === undefined) {
	console.log("请输入结束帧 如：-s 100")
	return;
}

if (conf.i === undefined) {
	console.log("请输入渲染文件 如：-i xxx.zip 主文件必须要包含index.ma")
	return;
}

if (conf.o === undefined) {
	console.log("请输入输出目录 如：-o output_folder")
	return;
}

//根据开始和结束帧，生成渲染帧数组
var renderAry = [];
for (var i = conf.s; i <= conf.e; i ++) {
	renderAry.push(i);
}

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

server.listen(9989, function() {
	console.log("server is start!");
});

var wsServer = new WebSocketServer({
	httpServer:server,
	maxReceivedMessageSize:0x8000000
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

