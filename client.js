var WebSocketClinet = require('websocket').client;
var Buffer = require('buffer').Buffer;
var os = require('os');
var fileLister = require('file-lister');
var argv = process.argv;

var wsClient = new WebSocketClinet({
	//最大不超过900M
	maxReceivedMessageSize:0x90000000
});
console.log("V 1.2.1");
var conf = {p:9989};
for (var i = 2; i < argv.length; i ++) {
	var arg = argv[i];
	switch (arg) {
		//ip
		case '-ip' :
		{
			conf.ip = argv[++i];
			break;
		}
		//端口
		case '-p' : 
		{
			conf.p = argv[++i];
			break;
		}
	}
}
if (conf.ip) {
	console.log("server ip is " + conf.ip);
}
console.log("server port is " + conf.p);

var getJson = require('load-json');
var childProcess = require('child_process');
var fs = require('fs');
var rmdir = require('rmdir');

const decompress = require('decompress');
const decompressUnzip = require('decompress-unzip');
 

const PROTOCOL_RENDER_CONN = require('./const').PROTOCOL_RENDER_CONN;
//渲染程序路径/Applications/Autodesk/maya2016/Maya.app/Contents/bin/Render
var renderPath = 'Render';

wsClient.on('connect', function(conn) {
	console.log("connect");
	conn.on('message', function(message) {
		if (message.type == 'utf8') { 
			var data = JSON.parse(message.utf8Data);
			//渲染输出的目录
			var outputFolder = os.tmpDir() + '/render-output/';
			if (data.render != undefined) {
				var frame = data.render.frame;
				var execStr = renderPath + ' -s ' + frame + ' -e ' + frame + ' -rd ' + outputFolder + ' ./temp_render/model.mb';
				console.log('render Data:', data.render);
				console.log('exec command', execStr);
				//删除临时渲染文件目录
				rmdir(outputFolder, () => {
					//开始渲染
					childProcess.exec(execStr, (error, stdout, stderr) => {
						var platform = require('os').platform();
						var infoStr;
						if (platform === 'win32') {
							infoStr = stdout.toString();
						} else {
							infoStr = stderr.toString();
						}
						var reg = /Finished Rendering (.*).$/mgi;
						//回传数据
						fileLister([outputFolder], (error, files) => {
							for (var filePath of files) {
								var fileBuffer = fs.readFileSync(filePath);
								var path = 'render-output';
								var index = filePath.indexOf(path);
								//获取给服务器保存的文件名
								var writeFileName = filePath.substr(index + path.length + 1);
								//前4个字节为读出文件的长度
								var buffer = new Buffer(4 + writeFileName.length + fileBuffer.length);
								buffer.writeInt32BE(writeFileName.length);
								buffer.write(writeFileName, 4, 'ascii');
								fileBuffer.copy(buffer, 4 + writeFileName.length, 0, fileBuffer.length);
								conn.sendBytes(buffer);
								console.log("send binary data ", filePath);
							}
							requestRenderFrame();
						});
					});

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
	}
});

wsClient.on('connectFailed', function(error) {
	console.log("connect failed, reconnect again");
	setTimeout(connectToServer, 5000);
});

/**
 * 连接到服务器
 */
function connectToServer() {
	//加载服务器上的 render.json 判断局域网服务器的ip
	console.log(conf.ip);
	if (conf.ip) {
		wsClient.connect('ws://' + conf.ip + ':' + conf.p, PROTOCOL_RENDER_CONN);
	} else {
		getJson('http://shengwu.nobook.com.cn/render.json', {}, function(e, response) {
			wsClient.connect('ws://' + response.server + ':' + conf.p, PROTOCOL_RENDER_CONN);
		});
	}
}

connectToServer();
