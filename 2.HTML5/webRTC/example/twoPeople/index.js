function getUserMedia() {
    return navigator.getUserMedia 
        || navigator.webkitGetUserMedia 
        || navigator.mozGetUserMedia
}

function getRTCPeerConnection(pc_config) {
    return new RTCPeerConnection(pc_config) 
        || new webkitRTCPeerConnection(pc_config)
}

window.URL = window.URL || window.webkitURL;
navigator.getUserMedia = getUserMedia();

// 获取所有dom
let localVideo = document.getElementById('local-video');
let remoteVideo = document.getElementById('remote-video');
let textForSendSDP = document.getElementById('text-for-send-sdp');
let textForSendICE = document.getElementById('text-for-send-ice');
let textToReceiveSDP = document.getElementById('text-for-receive-sdp');
let textToReceiveICE = document.getElementById('text-for-receive-ice');

let localStream = '', peerConnection = null, peerStarted = false;
const mediaConstraints = {
    'mandatory': {
        'OfferToReceiveAudio': true,
        'OfferToReceiveVideo': true
    }
};

    // ----socket----
// 初始化soket通信
let socketReady = false;
let port = 8080;
let socket = io.connect(`http://localhost:${port}/`)
// 建立socket连接
socket.on('connect', onOpened)
    .on('message', onMessage);

function onOpened(evt) {
    console.log('已建立socket连接');
    socketReady = true;

    // 获取聊天室名称
    let roomName = getRoomName();
    socket.emit('enter', rootname);
}

function getRoomName() {
    let url = document.location.href;
    let args = url.split('?');
    if (args.length > 1) {
        let room = args[1];
        if (room !== '') {
            return room;
        }
    }
    return '_defaultroom';
}
// socket 消息处理
function onMessage(evt) {
    if (evt.type === 'offer') {
        console.log('接收到offer,设置offer,发送answer...');
        onOffer(evt);
    } else if (evt.type === 'answer' && peerStarted) {
        console.log('接收到answer,设置answer SDP');
        onAnswer(evt);
    } else if (evt.type === 'candidate' && peerStarted) {
        console.log('接收到ICE 候选人');
        onCandidate(evt);
    } else if (evt.type ==='bye' && peerStarted) {
        console.log('WebRTC 通信断开');
        stop();
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
        audio: true
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
function prepareNewConnection() {
    let pc_config = {'iceServers': []};
    let peer = null;
    try {
        peer = getRTCPeerConnection(pc_config); 
    } catch (error) {
        console.log('建立链接失败，错误：' + error.message);
    }
    peer.onicecandidate = function(evt) {
        if (evt.candidate) {
            console.log(evt.candidate);
            sendCandidate({
                type: 'candidate',
                sdpMLineIndex: evt.candidate.sdpMLineIndex,
                sdpMid: evt.candidate.sdpMid,
                candidate: evt.candidate.candidate
            })
        }
    };

    console.log('添加本地视频流');
    peer.addStream(localStream);
    peer.addEventListener('addstream', onRemoteStreamAdded, false);
    peer.addEventListener('removestream', onRemoteStreamRemoved, false);

    // 当接收到远程视频时，使用本地video元素进行显示
    function onRemoteStreamAdded(event) {
        console.log('添加远程视频流');
        remoteVideo.src =  window.URL.createObjectURL(event.stream);
    }
    // 当远程结束通信时，取消本地video元素的显示
    function onRemoteStreamRemoved(event) {
        console.log('移除远程视频了');
        remoteVideo.src = '';
    }
    return peer;
}

function sendOffer() {
    peerConnection = prepareNewConnection();
    peerConnection.createOffer(function(sessionDescription) {
        peerConnection.setLocalDescription(sessionDescription);
        console.log('发送：SDP');
        console.log(sessionDescription);
        sendSDP(sessionDescription);
    }, function (err) {
        console.log('创建Offer失败');
    }, mediaConstraints);
}

function setOffer(evt) {
    if (peerConnection) {
        console.error('peerConnection 已经存在');
    }
    peerConnection = prepareNewConnection();
    peerConnection.setRemoteDescription(new RTCSessionDescription(evt));
}

function sendAnswer(evt) {
    console.log('发送Answer，创建远程会话描述...');
    if (!peerConnection) {
        console.error('peerConnection 不存在');
        return;
    }
    peerConnection.createAnswer(function(sessionDescription) {
        peerConnection.setLocalDescription(sessionDescription);
        console.log('发送：SDP');
        console.log(sessionDescription);
        sendSDP(sessionDescription);
    }, function(e) {
        console.log(e);
        console.log('创建Answer失败');
    }, mediaConstraints);
}

function setAnswer(evt) {
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
                