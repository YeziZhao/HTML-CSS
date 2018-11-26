function getUserMedia() {
    return navigator.getUserMedia 
        || navigator.webkitGetUserMedia 
        || navigator.mozGetUserMedia
}

function getRTCPeerConnection(pc_config) {
    return new RTCPeerConnection(pc_config) 
        || new webkitRTCPeerConnection(pc_config)
}

// 获取所有dom
let localVideo = document.getElementById('local-video');
let localStream = '', peerConnection = null, peerStarted = false;
const mediaConstraints = {
    'mandatory': {
        'OfferToReceiveAudio': false,
        'OfferToReceiveVideo': true
    }
};

// 多人用video元素
let videoElementsInUse = {};
let videoElementsStandBy = {};
pushVideoStandBy(getVideoForRemote(0)); 
pushVideoStandBy(getVideoForRemote(1)); 
pushVideoStandBy(getVideoForRemote(2)); 

function getVideoForRemote(index) {
    let elementId = 'remote-video-' + index;
    return document.getElementById(elementId);
}
function getAudioForRemote(index) {
    let elementId = 'remote-audio-' + index;
    return document.getElementById(elementId);
}
function pushVideoStandBy(element) {
    videoElementsStandBy[element.id] = element;
}
function popVideoStandBy() {
    let element = null;
    for (let id in videoElementsStandBy) {
        element = videoElementsStandBy[id];
        delete videoElementsStandBy[id];
        return element;
    }
    return null;
}
function pushVideoInUse(id, element) {
    videoElementsInUse[id] = element;
}
function popVideoInUse(id) {
    let element = videoElementsInUse[id];
    delete videoElementsInUse[id];
    return element;
}
function attachVideo(id, stream) {
    console.log('尝试添加video. id : ' +  id);
    let videoElement = popVideoStandBy();
    if (videoElement) {
        videoElement.src = window.URL.createObjectURL(stream);
        console.log('videoElement.src = ' + videoElement.src);
        pushVideoInUse(id, videoElement);
        videoElement.style.display = 'block';
    } else {
        console.log('-----没有可用的video元素');
    }
}
function detachVideo(id) {
    console.log('尝试移除video. id= ' + id);
    let videoElement = popVideoInUse(id);
    if (videoElement) {
        videoElement.pause();
        videoElement.src = '';
        console.log('videoElement.src ' + videoElement.src);
        pushVideoStandBy(videoElement);
    } else {
        console.log('警告 --- 没有id 为 ' + id  + '的video元素');
    }
}

function isLocalStreamStarted() {
    if (localStream) {
        return true;
    }
    return false;
}
// 多人聊天室，根据对方数量创建PeerConnection
let MAX_CONNECTION_COUNT = 3;
let connections = []; // 连接数组
function Connection() {
    let self = this;
    let id = ''; // 对方的socket.id 
    let peerconnection = null; // RTCPeerConnection 对象实例
    let estabelished = false; // 是否已建立里娜姐
    let iceReady = false;
}
function getConnection(id) {
    let con = null;
    con = connections[id];
    return con;
}
function addConnection(id, connection) {
    connections[id] = connection;
}

window.URL = window.URL || window.webkitURL;
navigator.getUserMedia = getUserMedia();


// ----socket----
// 初始化soket通信
let socketReady = false;
let port = 8080;
let socket = io.connect(`http://localhost:${port}/`)
// 建立socket连接
socket.on('connect', onOpened)
    .on('message', onMessage);

// 广播方式：信令服务器接收到Offer SDP 指向非自身且同聊天室的用户发送
// - 确认谁在同一个分组内（call-response）
// - 然后一个一个进行Offer-Answer交换

function onOpened(evt) {
    console.log('已建立socket连接');
    socketReady = true;
}

// call-response 处理
function call() {
    if (!isLocalStreamStarted()) {
        return;
    }
    socket.json.send({
        type: 'call'
    });
}

// socket 消息处理:这段代码进行了全员广播
// - 接收方获取call函数中发出的消息,同时向发送方返回response消息
// - 发送方接收到response消息后，向该接收方发送offer SDP
// 同时向发送方
function onMessage(evt) {
    let id = evt.from;
    let target = evt.sendto;
    let conn = getConnection(id);
    
    if (evt.type === 'call') {
        if (!isLocalStreamStarted()) {
            return;
        }
        if (conn) {
            return; // 已经建立连接
        }
        if (isConnectPossible()) { // 未超过最大连接数
            socket.json.send({
                type: 'response',
                sendto: id
            })
        } else {
            console.warn('已经到达最大连接数，因此本链接被忽略');
        }
    } else if (evt.type === 'response') {
        sendOffer(id);
        return;
    }
}

let iceSeparator = '--------ICE候选者--------';
let CR = String.fromCharCode(13);
// -----------交换信息------------
function onSDP() {
    let text = textToReceiveSDP.value;
    let evt = JSON.parse(text);
    if (peerConnection) {
        onAnswer(evt);
    } else {
        onOffer(evt);
    }

    textToReceiveSDP.value = '';
}

function onICE() {
    let text = textToReceiveICE.value;
    let arr = text.split(iceSeparator);
    for (let i = 0, len = arr.length; i < len; i++) {
        let evt = JSON.parse(arr[i]);
        onCandidate(evt);
    }
    textToReceiveICE.value = '';
}

function onOffer(evt) {
    console.log('接收到Offer.....');
    console.log(evt);
    setOffer(evt)
    sendAnswer(evt);

    // 追加
    peerStarted = true;
}

function onAnswer(evt) {
    console.log('接收到Answer.....');
    console.log(evt);
    setAnswer(evt);
}

function onCandidate(evt) {
    let id = evt.from;
    let conn = getConnection(id);
    if (!conn) {
        console.log('peerConnection 不存在');
        return;
    }
    // 检查ICE 是否准备好
    if (! conn.iceReady) {
        console.log('ICE 尚未准备好');
        return;
    }
    let candidate = new RTCIceCandidate({
        sdpMLineIndex: evt.sdpMLineIndex,
        sdpMid: evt.sdpMid,
        candidate: evt.candidate
    });
    console.log('接收到Candidate....');
    console.log(candidate);
    peerConnection.addIceCandidate(candidate);
}

function sendSDP(sdp) {
    let text = JSON.stringify(sdp);
    console.log(text);
    textForSendSDP.value = text;

    // 增加socket发送
    socket.json.send(sdp);
}

function sendCandidate(candidate) {
    let text = JSON.stringify(candidate);
    console.log(text);
    textForSendICE.value = (textForSendICE.value) + CR + iceSeparator + CR + text + CR;
    textForSendICE.scrollTop = textForSendICE.scrollHeight;
    // 增加socket发送
    socket.json.send(candidate);
}

// ------------视频处理--------------
function startVideo() {
    navigator.getUserMedia({
        video: true,
        audio: false
    }, (stream) => {
        localStream = stream;
        localVideo.src = window.URL.createObjectURL(stream);
        localVideo.play();
        localVideo.volume = 0;
    }, (error) => {
        alert(`发生了一个错误：{错误代码：${error.code} }`);
        return;
    });
}

function stopVideo() {
    localVideo.src = '';
    localStream.stop();
}

// --------------处理链接-----------
function prepareNewConnection(id) {
    let pc_config = {'iceServers': [
        {
            url: 'stun:stun.l.google.com:19302'
        }
    ]};
    let peer = null;
    try {
        peer = getRTCPeerConnection(pc_config); 
    } catch (error) {
        console.log('建立链接失败，错误：' + error.message);
    }
    let conn = new Connection();
    conn.id = id;
    conn.peerconnection = peer;
    peer.id = id;
    addConnection(id, conn);
    peer.onicecandidate = function(evt) {
        if (evt.candidate) {
            console.log(evt.candidate);
            sendCandidate({
                type: 'candidate',
                sendto: conn.id,
                sdpMLineIndex: evt.candidate.sdpMLineIndex,
                sdpMid: evt.candidate.sdpMid,
                candidate: evt.candidate.candidate
            })
        } else {
            conn.estabelished = true;
        }
    };

    console.log('添加本地视频流');
    peer.addStream(localStream);
    peer.addEventListener('addstream', onRemoteStreamAdded, false);
    peer.addEventListener('removestream', onRemoteStreamRemoved, false);
    peer.addEventListener('iceconnectionstatechange', onIceconnectionstatechange, false);
    // 当接收到远程视频时，使用本地video元素进行显示
    function onRemoteStreamAdded(event) {
        console.log('添加远程视频流');
        attachVideo(this.id, event.stream);
    }
    // 当远程结束通信时，取消本地video元素的显示
    function onRemoteStreamRemoved(event) {
        console.log('移除远程视频了');
        detachVideo(this.id);
    }
    function onIceconnectionstatechange(event) {
        if (peer.iceConnectionState == 'disconnected') {
            detachVideo(this.id);
        }
    }
    return conn;
}

function sendOffer(id) {
    let peerConnection = getConnection(id); // 寻找已创建的连接
    if (!peerConnection) {
        peerConnection = prepareNewConnection(id);
    }
    peerConnection.createOffer(function(sessionDescription) {
        peerConnection.iceReady = true;
        peerConnection.setLocalDescription(sessionDescription);
        sessionDescription.sendto = peerConnection.id; // 指定发送的对方
        sendSDP(sessionDescription);
    }, function (err) {
        console.log('创建Offer失败');
    }, mediaConstraints);
    peerConnection.iceReady = true;
}

function setOffer(evt) {
    let id = evt.from;
    let peerConnection = getConnection(id); 
    if (peerConnection) {
        console.error('peerConnection 已经存在');
    }
    peerConnection = prepareNewConnection(id);
    peerConnection.setRemoteDescription(new RTCSessionDescription(evt));
}

function sendAnswer(evt) {
    console.log('发送Answer，创建远程会话描述...');
    let id = evt.from;
    let peerConnection = getConnection(id);
    if (!peerConnection) {
        console.error('peerConnection 不存在');
        return;
    }
    peerConnection.createAnswer(function(sessionDescription) {
        peerConnection.iceReady = true;
        peerConnection.setLocalDescription(sessionDescription);
        sessionDescription.sendto = id; // 指定发信的对方
        sendSDP(sessionDescription);
    }, function(e) {
        console.log(e);
        console.log('创建Answer失败');
    }, mediaConstraints);
    peerConnection.iceReady = true;
}

function setAnswer(evt) {
    let id = evt.from;
    let peerConnection = getConnection(id);
    if (!peerConnection) {
        console.error('peerConnection 不存在');
        return;
    }
    peerConnection.setRemoteDescription(new RTCSessionDescription(evt));
}

// ------------处理用户UI时间-----------
// 开始建立链接
function connect() {
    // 修改 添加socketReady 判断
    if (!peerStarted && localStream && socketReady) {
        sendOffer();
        peerStarted = true;
    } else {
        alert('请首先捕获本地视频数据');
    }
}

// 停止链接
function hangUp() {
    console.log('挂断！');
    stop();
}

function stop() {
    peerConnection.close();
    peerConnection = null;
    peerStarted = false;
}
                