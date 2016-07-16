#渲染农场配置
###1.安装MAYA2016
+ 文件包地址(内网)：smb://192.168.1.111/guest/software/development_tools/win/THREE_D
+ 配置环境变量
    * 右击**我的电脑**-->**属性**-->**高级**-->**环境变量** 
    * 将**X:/Program Files/Autodesk/Maya2016/bin** 加入到**PATH**中

###2.安装node.js
+ node.js 
    * 文件包地址(内网) smb://192.168.1.111/guest/software/development_tools/win/node.js
+ 安装nobook渲染农场程序
    * npm install -g nobook-render-factory

###3.运行
+ 客户端
    * render-client
+ 服务端
    * render-server -s 1 -e 20 -i input_file.zip
        - -s 渲染的开始帧
        - -e 渲染的结束帧
        - -i 渲染的输入文件
    * zip文件包规范
        - 被渲染的主文件需要命名为 model.mb
        - 材质链接的图片必须为相对路径（当前目录下必须有workspace.mel文件)
        
###4.更新
+ npm update -g nobook-render-factory