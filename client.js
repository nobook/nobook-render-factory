var WebSocketClinet = require('websocket').client;
var Buffer = require('buffer').Buffer;
var wsClient = new WebSocketClinet({
	//最大不超过80M
	maxReceivedMessageSize:0x8000000

});
var getJson = require('load-json');
var childProcess = require('child_process');
var fs = require('fs');
var rmdir = require('rmdir');

const decompress = require('decompress');
const decompressUnzip = require('decompress-unzip');
 

const PROTOCOL_RENDER_CONN = require('./const').PROTOCOL_RENDER_CONN;
//渲染程序路径
var renderPath = '/Applications/Autodesk/maya2016/Maya.app/Contents/bin/Render';

wsClient.on('connect', function(conn) {
	console.log("connect");
	conn.on('message', function(message) {
		if (message.type == 'utf8') { 
			var data = JSON.parse(message.utf8Data);
			if (data.render != undefined) {
				var frame = data.render.frame;
				var execStr = renderPath + ' -s ' + frame + ' -e ' + frame + ' -rd ./render-output ./temp_render/model.mb';
				console.log('render Data:', data.render);
				console.log('exec command', execStr);
				//开始渲染
				childProcess.exec(execStr, (error, stdout, stderr) => {
					//console.log('error:', error, "=======");
					//console.log('stdout:', stdout, "=======");
					stderr = stderr.toString();
					var reg = /Finished Rendering (.*).$/mgi;
					while (true) {
						var result = reg.exec(stderr);
						//如果有那么把文件回传给服务器
						console.log(result);
						if (result == null) {
							break;
						} else {
							var filePath = result[1];
							var fileBuffer = fs.readFileSync(filePath);
							var path = 'render-output/';
							var index = filePath.indexOf(path);
							//获取给服务器保存的文件名
							var writeFileName = filePath.substr(index + path.length);
							//前4个字节为读出文件的长度
							var buffer = new Buffer(4 + writeFileName.length + fileBuffer.length);
							buffer.writeInt32BE(writeFileName.length);
							buffer.write(writeFileName, 4, 'ascii');
							fileBuffer.copy(buffer, 4 + writeFileName.length, 0, fileBuffer.length);
							conn.sendBytes(buffer);
							console.log("send binary data ", filePath);
							requestRenderFrame();
						}
					}

				});
			}
		} else if (message.type === 'binary'){
			//从服务端发送来的文件
			fs.writeFileSync('receive.zip', message.binaryData);
			//删除临时目录
			rmdir('temp_render', function() {
				//解压接收的文件
				decompress('receive.zip', 'temp_render', {
					plugins: [
						decompressUnzip()
					]
				}).then(() => {
					console.log('解压完成');
					//请求渲染帧
					requestRenderFrame();
				});
			});
		}
	});

	conn.on('close', function() {
		console.log(arguments);	
		connectToServer();
	});

	//请求渲染帧
	function requestRenderFrame() {
		conn.sendUTF('requestRenderFrame');

/*
		var filePath = "/Users/onlyjyf/Documents/maya/projects/default/render-output/XZ_shiti/XZ_shiti16.tga";
				var fileBuffer = fs.readFileSync(filePath);
				var path = 'render-output/';
				var index = filePath.indexOf(path);
				//获取给服务器保存的文件名
				var writeFileName = filePath.substr(index + path.length);
				//前4个字节为读出文件的长度
				var buffer = new Buffer(4 + writeFileName.length + fileBuffer.length);
				buffer.writeInt32BE(writeFileName.length);
				buffer.write(writeFileName, 4, 'ascii');
				fileBuffer.copy(buffer, 4 + writeFileName.length, 0, fileBuffer.length);
				console.log(fileBuffer);
				conn.sendBytes(buffer);
				*/
	}
});

wsClient.on('connectFailed', function(error) {
	console.log("connect failed, reconnect again");
	setTimeout(connectToServer, 1000);
});

/**
 * 连接到服务器
 */
function connectToServer() {
	//加载服务器上的 render.json 判断局域网服务器的ip
	getJson('http://shengwu.nobook.com.cn/render.json', {}, function(e, response) {
		wsClient.connect('ws://' + response.server + ':9989', PROTOCOL_RENDER_CONN);
	});
}

connectToServer();
